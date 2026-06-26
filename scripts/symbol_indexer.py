"""
symbol_indexer.py
Scans TypeScript/TSX source files and records exported symbols with enriched metadata:
  - line       : line where export declaration starts
  - line_end   : approximate line where symbol body ends
  - read_hint  : {"offset": N, "limit": L} precomputed for agent Read calls
  - keywords   : searchable tags derived from symbol name + existing fields

Usage:
    python scripts/symbol_indexer.py
"""

import json
import os
import re
from pathlib import Path

# Resolve the target project from this script's own location (scripts/ -> project root),
# matching repo_map_check.py. A copied-in script auto-targets whatever project it lives in
# — no hardcoded path, no dependence on the caller's cwd.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_VARS_PATH = PROJECT_ROOT / "knowledge/index_variables.json"
INDEX_FILES_PATH = PROJECT_ROOT / "knowledge/index_files.json"
SRC_ROOT = PROJECT_ROOT / "src"

EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(function|const|let|var|type|interface|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)"
)

CAMEL_RE = re.compile(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


def classify(name: str, rel_path: str, kind: str) -> str:
    """Infer a symbol's type from its file path + declaration keyword.
    Path signals win over keyword signals. Returns "Unknown" only as a last resort."""
    p = rel_path.replace("\\", "/")
    # Path-based signals (strongest)
    if ("/db/schema" in p or p.endswith("/schema.ts")) and kind in ("const", "let", "var"):
        return "DBTable"
    if p.endswith("/route.ts") or p.endswith("/route.tsx"):
        return "APIRoute"
    if p.endswith("/page.tsx") or p.endswith("/page.ts"):
        return "PageComponent"
    if p.endswith("/layout.tsx") or p.endswith("/template.tsx"):
        return "PageComponent"
    if p.endswith("/middleware.ts"):
        return "Middleware"
    # Declaration-keyword signals
    if kind in ("interface", "type"):
        return "Interface"
    if kind == "enum":
        return "Enum"
    if kind == "class":
        return "Class"
    # React component: PascalCase name in a .tsx file
    if p.endswith(".tsx") and name[:1].isupper():
        return "ReactComponent"
    # React hook convention: useXxx
    if name.startswith("use") and len(name) > 3 and name[3:4].isupper():
        return "Hook"
    if kind in ("function", "const", "let", "var"):
        return "Function"
    return "Unknown"


def split_camel(name: str) -> list[str]:
    """Split camelCase/PascalCase into lowercase tokens."""
    return [t.lower() for t in CAMEL_RE.split(name) if t]


def infer_line_end(lines: list[str], start: int) -> int:
    """
    Estimate where a symbol body ends by tracking brace depth.
    Returns line number (1-based). Falls back to start+60 if no braces found.
    """
    depth = 0
    found_open = False
    for i in range(start - 1, min(start + 300, len(lines))):
        text = lines[i]
        depth += text.count("{") - text.count("}")
        if not found_open and "{" in text:
            found_open = True
        if found_open and depth <= 0:
            return i + 1  # 1-based
    return min(start + 60, len(lines))


def make_read_hint(line: int, line_end: int) -> dict:
    offset = max(1, line - 5)
    limit = min(80, line_end - line + 15)
    return {"offset": offset, "limit": limit}


def extract_keywords(name: str, existing: dict) -> list[str]:
    """Build keyword list from name tokens + existing fields."""
    tokens = set(split_camel(name))
    # From source path components
    source = existing.get("source", "")
    for part in Path(source).parts:
        tokens.update(split_camel(part.replace(".tsx", "").replace(".ts", "")))
    # From fields array
    for field in existing.get("fields", []):
        tokens.update(field.lower().replace("-", " ").split())
    # Remove noise
    noise = {"src", "app", "api", "components", "tsx", "ts", "the", "a", "an", "and", "or"}
    return sorted(tokens - noise)


def scan_symbols() -> dict[str, dict]:
    """Return enriched symbol metadata for every exported symbol in src/."""
    result: dict[str, dict] = {}
    for root, dirs, files in os.walk(SRC_ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".next", "__pycache__")]
        for filename in files:
            if not filename.endswith((".ts", ".tsx")):
                continue
            full = Path(root) / filename
            rel = str(full.relative_to(PROJECT_ROOT))
            try:
                lines = full.read_text(encoding="utf-8").splitlines()
            except Exception:
                continue
            for lineno, text in enumerate(lines, start=1):
                m = EXPORT_RE.match(text.strip())
                if m:
                    kind = m.group(1)
                    name = m.group(2)
                    if name not in result:
                        line_end = infer_line_end(lines, lineno)
                        result[name] = {
                            "file": rel,
                            "line": lineno,
                            "line_end": line_end,
                            "read_hint": make_read_hint(lineno, line_end),
                            "type": classify(name, rel, kind),
                        }
    return result


def update_files_index(symbols_by_file: dict[str, list[dict]]) -> None:
    """Add key_sections and keywords to each file entry in index_files.json."""
    if not INDEX_FILES_PATH.exists():
        return
    with open(INDEX_FILES_PATH, "r", encoding="utf-8") as f:
        index = json.load(f)

    # Support {"files": {...}} wrapper (actual structure) or flat dict
    files_dict = index.get("files", index) if isinstance(index, dict) else index

    for file_path, syms in symbols_by_file.items():
        entry = files_dict.get(file_path)
        if entry is None:
            continue
        entry["key_sections"] = [
            {
                "name": s["name"],
                "line": s["line"],
                "read_hint": s["read_hint"],
            }
            for s in sorted(syms, key=lambda x: x["line"])
        ]
        path_tokens = split_camel(Path(file_path).stem)
        existing_kw = set(entry.get("keywords", []))
        existing_kw.update(path_tokens)
        entry["keywords"] = sorted(existing_kw)

    with open(INDEX_FILES_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)


def merge_into_index(new_symbols: dict[str, dict]) -> None:
    """Merge enriched metadata into index_variables.json."""
    if INDEX_VARS_PATH.exists():
        with open(INDEX_VARS_PATH, "r", encoding="utf-8") as f:
            index = json.load(f)
    else:
        index = {"variables": {}}

    variables = index.get("variables", {})

    for name, info in new_symbols.items():
        if name in variables:
            existing = variables[name]
            existing["line"] = info["line"]
            existing["line_end"] = info["line_end"]
            existing["read_hint"] = info["read_hint"]
            existing.setdefault("source", info["file"])
            # Fully auto: classify() is authoritative. Overwrite when it can tell;
            # keep the prior type only when classify() returns Unknown (never regress a
            # good label to Unknown). No human-curated types exist to protect — the old
            # values were a one-time enrichment seed, so re-deriving them every run is
            # correct and reproducible (same principle as backlink_analyzer).
            new_type = info.get("type", "Unknown")
            if new_type != "Unknown":
                existing["type"] = new_type
            existing["keywords"] = extract_keywords(name, existing)
        else:
            variables[name] = {
                "type": info.get("type", "Unknown"),
                "source": info["file"],
                "line": info["line"],
                "line_end": info["line_end"],
                "read_hint": info["read_hint"],
                "keywords": extract_keywords(name, {}),
                "used_in": [],
            }

    missing = [k for k in variables if k not in new_symbols]
    if missing:
        print(f"[WARN] {len(missing)} symbol(s) in index not found in source: {missing[:5]}")

    index["variables"] = variables
    with open(INDEX_VARS_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    # Build per-file symbol map for files index update
    symbols_by_file: dict[str, list[dict]] = {}
    for name, info in new_symbols.items():
        f = info["file"]
        symbols_by_file.setdefault(f, []).append({"name": name, **info})
    update_files_index(symbols_by_file)


def main():
    print("Scanning exported symbols in src/ ...")
    symbols = scan_symbols()
    print(f"  Found {len(symbols)} exported symbol(s).")
    merge_into_index(symbols)
    print(f"  knowledge/index_variables.json updated (line, line_end, read_hint, keywords).")
    print(f"  knowledge/index_files.json updated (key_sections, keywords).")
    print("\nSample (first 5):")
    for name, info in list(symbols.items())[:5]:
        print(f"  {name}: {info['file']}:{info['line']}–{info['line_end']} hint={info['read_hint']}")


if __name__ == "__main__":
    main()
