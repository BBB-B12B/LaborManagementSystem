#!/usr/bin/env python3
"""
code_graph.py — Tier-A hard-edge extractor (T-192).

Extracts file->file IMPORT edges (the "hard" relationship class) from code files and
writes them into knowledge/index_files.json under dedicated fields `imports` /
`imported_by`, kept separate from the semantic `references` / `related` fields.

Properties (see knowledge/code_linkage_index.md):
  - hard layer only: pure regex on import statements, NO AI -> deterministic.
  - hash-locked: re-extract a file only when its content sha1[:8] changed
    (extracted_at_hash); unchanged files reuse stored imports[].
  - idempotent: sorted/unique edges -> re-running produces identical output.
  - internal edges only: imports that resolve to a file inside the repo are kept;
    stdlib / third-party / unresolved specifiers are skipped.

Tier-B (AST call/type graph -> index_variables.json) is DESIGNED but NOT implemented
here; it is deferred until TS app code exists under src/.

Usage:
    python3 scripts/code_graph.py --dry-run   # report edges, write nothing
    python3 scripts/code_graph.py --write     # apply to index_files.json
"""
import argparse
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "knowledge", "index_files.json")

# Directories that contain code worth graphing. scripts/ has python today;
# src/ is where TS/JS app code will land.
CODE_ROOTS = ["scripts", "src"]
PY_EXT = (".py",)
TS_EXT = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
SKIP_DIRS = {".git", "node_modules", ".next", "__pycache__", ".sessions"}

# ---- Python imports -------------------------------------------------------
# import a.b.c  /  import a.b as x  /  import a, b
PY_IMPORT = re.compile(r"^\s*import\s+([\w\.]+(?:\s*,\s*[\w\.]+)*)", re.M)
# from a.b import c   /   from . import c   /   from .a import c
PY_FROM = re.compile(r"^\s*from\s+(\.*[\w\.]*)\s+import\s+", re.M)

# ---- TS/JS imports --------------------------------------------------------
# import ... from "x"  /  export ... from "x"  /  import "x"
TS_FROM = re.compile(r"""(?:^|\s)(?:import|export)\b[^;\n]*?from\s*['"]([^'"]+)['"]""", re.M)
TS_BARE = re.compile(r"""^\s*import\s*['"]([^'"]+)['"]""", re.M)
TS_REQUIRE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")


def sha8(text):
    return hashlib.sha1(text.encode("utf-8", "replace")).hexdigest()[:8]


def rel(path):
    """Absolute path -> repo-relative posix path."""
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def collect_code_files():
    files = []
    for croot in CODE_ROOTS:
        base = os.path.join(ROOT, croot)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                if fn.endswith(PY_EXT) or fn.endswith(TS_EXT):
                    files.append(os.path.join(dirpath, fn))
    return sorted(files)


def resolve_py(importer_abs, module, level):
    """Resolve a python dotted module to a repo file path, internal only."""
    candidates = []
    if level > 0:
        # relative import: climb `level` dirs from importer's directory
        base = os.path.dirname(importer_abs)
        for _ in range(level - 1):
            base = os.path.dirname(base)
        parts = module.split(".") if module else []
        candidates.append(os.path.join(base, *parts) + ".py")
        candidates.append(os.path.join(base, *parts, "__init__.py"))
    else:
        parts = module.split(".")
        # from repo root: a.b -> a/b.py
        candidates.append(os.path.join(ROOT, *parts) + ".py")
        candidates.append(os.path.join(ROOT, *parts, "__init__.py"))
        # same-dir flat layout: import sibling -> scripts/sibling.py
        candidates.append(os.path.join(os.path.dirname(importer_abs), *parts) + ".py")
    for c in candidates:
        if os.path.isfile(c):
            return rel(c)
    return None


def resolve_ts(importer_abs, spec):
    """Resolve a TS/JS relative specifier to a repo file path, internal only."""
    if not (spec.startswith(".") or spec.startswith("/")):
        return None  # bare specifier = external package
    base = os.path.dirname(importer_abs)
    target = os.path.normpath(os.path.join(base, spec))
    tries = [target]
    for ext in TS_EXT:
        tries.append(target + ext)
    for ext in TS_EXT:
        tries.append(os.path.join(target, "index" + ext))
    for c in tries:
        if os.path.isfile(c):
            return rel(c)
    return None


def extract_imports(abs_path, text):
    """Return sorted unique list of internal repo-relative import targets."""
    targets = set()
    if abs_path.endswith(PY_EXT):
        for m in PY_IMPORT.finditer(text):
            for mod in m.group(1).split(","):
                mod = mod.strip().split(" as ")[0].strip()
                if mod:
                    t = resolve_py(abs_path, mod, 0)
                    if t and t != rel(abs_path):
                        targets.add(t)
        for m in PY_FROM.finditer(text):
            raw = m.group(1)
            level = len(raw) - len(raw.lstrip("."))
            mod = raw.lstrip(".")
            t = resolve_py(abs_path, mod, level)
            if t and t != rel(abs_path):
                targets.add(t)
    else:
        for rgx in (TS_FROM, TS_BARE, TS_REQUIRE):
            for m in rgx.finditer(text):
                t = resolve_ts(abs_path, m.group(1))
                if t and t != rel(abs_path):
                    targets.add(t)
    return sorted(targets)


def main():
    ap = argparse.ArgumentParser(description="Tier-A import-graph extractor (T-192)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="report edges, write nothing")
    g.add_argument("--write", action="store_true", help="apply edges to index_files.json")
    args = ap.parse_args()
    write = args.write and not args.dry_run

    index = json.load(open(INDEX, encoding="utf-8")) if os.path.isfile(INDEX) else {}

    files = collect_code_files()
    extracted = 0
    skipped = 0
    edge_count = 0
    imports_map = {}  # repo-rel path -> [targets]

    for abs_path in files:
        rpath = rel(abs_path)
        try:
            text = open(abs_path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        h = sha8(text)
        entry = index.get(rpath)
        if entry and entry.get("extracted_at_hash") == h and "imports" in entry:
            imports_map[rpath] = list(entry.get("imports", []))  # hash-lock: reuse
            skipped += 1
            continue
        imps = extract_imports(abs_path, text)
        imports_map[rpath] = imps
        edge_count += len(imps)
        extracted += 1
        if write:
            entry = index.setdefault(rpath, {})
            entry["imports"] = imps
            entry["extracted_at_hash"] = h

    # Rebuild reverse adjacency (imported_by) from the full imports_map.
    reverse = {}
    for src_path, targets in imports_map.items():
        for t in targets:
            reverse.setdefault(t, set()).add(src_path)
    if write:
        # clear stale hard in-edges only on files we know about, then repopulate
        for rpath in imports_map:
            index.setdefault(rpath, {}).setdefault("imported_by", [])
        for rpath, entry in index.items():
            if "imported_by" in entry or rpath in reverse:
                entry = index.setdefault(rpath, {})
                entry["imported_by"] = sorted(reverse.get(rpath, set()))
        json.dump(index, open(INDEX, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    print("[code_graph] files=%d extracted=%d skipped(hash-lock)=%d import-edges=%d mode=%s"
          % (len(files), extracted, skipped, edge_count, "write" if write else "dry-run"))
    for rpath in sorted(imports_map):
        if imports_map[rpath]:
            print("  %s -> %s" % (rpath, ", ".join(imports_map[rpath])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
