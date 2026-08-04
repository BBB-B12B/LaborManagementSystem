#!/usr/bin/env python3
"""harness_sync.py — T-348 · S5

Port the harness ENGINE (master) to a machine's CENTRAL engine and report a
hash-based % completeness. Makes "edit master -> every downstream current"
MEASURABLE: per category and overall, how much of the engine the destination
actually has, byte-identical.

  master   = this repo's engine root (source of truth · harness_paths.engine_root)
  dest     = the machine central engine (HARNESS_ENGINE_ROOT, or --dest PATH)
  file set = scripts/engine_manifest.txt  (S4 · SINGLE SOURCE — the SAME list
             machine_install.sh installs; never re-listed here)

Usage
  python3 scripts/harness_sync.py [--dest PATH]        # dry-run: compare + %, writes nothing
  python3 scripts/harness_sync.py --apply [--dest PATH] # port differs+missing master->dest
  python3 scripts/harness_sync.py --self-test          # tmp master/dest, assert the % Math

R14: --apply overwrites files at the destination engine. In a headless /
autonomous-loop run there is no human to confirm, so --apply is BLOCKED and must
go to human review — never self-confirmed (mirrors danger_gate · R14/R15).
"""
from __future__ import annotations
import argparse
import hashlib
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from harness_paths import engine_root  # single-source resolver
except Exception:  # pragma: no cover - defensive fallback
    def engine_root() -> Path:
        env = os.environ.get("HARNESS_ENGINE_ROOT")
        return Path(env) if env else Path(__file__).resolve().parents[1]
try:
    from danger_gate import is_headless  # single-source headless detection (R14)
except Exception:  # pragma: no cover
    def is_headless(root) -> bool:
        return os.environ.get("HARNESS_HEADLESS") == "1"

MANIFEST_REL = "scripts/engine_manifest.txt"
# Junk that only adds false differs/missing noise to a completeness %.
_SKIP_NAMES = {".DS_Store", "__pycache__", ".git"}


def _skip(name: str) -> bool:
    return name in _SKIP_NAMES or name.startswith("._") or name.endswith(".pyc")


def _hash(path: Path) -> str | None:
    """sha256 of a file — same primitive as harness_onboard._hash."""
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except Exception:
        return None


def parse_manifest(master: Path) -> list[tuple[str, str]]:
    """[(kind, relpath)] from engine_manifest.txt. kind = 'dir' | 'file'."""
    mf = master / MANIFEST_REL
    entries: list[tuple[str, str]] = []
    for line in mf.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("dir:"):
            entries.append(("dir", s[4:].strip()))
        elif s.startswith("file:"):
            entries.append(("file", s[5:].strip()))
    return entries


def expand(master: Path, kind: str, rel: str) -> list[str]:
    """Expand one manifest entry into concrete engine-relative file paths."""
    if kind == "file":
        return [rel] if (master / rel).is_file() else []
    base = master / rel
    if not base.is_dir():
        return []
    out: list[str] = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if not _skip(d)]
        for fn in files:
            if _skip(fn):
                continue
            out.append(str((Path(root) / fn).relative_to(master)))
    return sorted(out)


def compare(master: Path, dest: Path, files: list[str]) -> dict:
    """Categorize each file as matched / differs / missing (by hash)."""
    matched: list[str] = []
    differs: list[str] = []
    missing: list[str] = []
    for rel in files:
        mh = _hash(master / rel)
        if mh is None:
            continue  # not in master -> nothing to port
        dh = _hash(dest / rel)
        if dh is None:
            missing.append(rel)
        elif mh == dh:
            matched.append(rel)
        else:
            differs.append(rel)
    return {"matched": matched, "differs": differs, "missing": missing}


def port(master: Path, dest: Path, rels: list[str]) -> int:
    """Copy each rel master->dest (overwrite), preserving mode/mtime."""
    n = 0
    for rel in rels:
        dst = dest / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(master / rel, dst)
        n += 1
    return n


def pct(matched: int, total: int) -> float:
    return 100.0 if total == 0 else round(matched / total * 100.0, 1)


def survey(master: Path, dest: Path) -> dict:
    """Per-category + overall completeness. Returns a report dict."""
    cats = []
    tot_m = tot_t = 0
    for kind, rel in parse_manifest(master):
        files = expand(master, kind, rel)
        c = compare(master, dest, files)
        total = len(c["matched"]) + len(c["differs"]) + len(c["missing"])
        tot_m += len(c["matched"])
        tot_t += total
        cats.append({"entry": f"{kind}:{rel}", "total": total,
                     "matched": len(c["matched"]), "differs": len(c["differs"]),
                     "missing": len(c["missing"]),
                     "differs_files": c["differs"], "missing_files": c["missing"],
                     "pct": pct(len(c["matched"]), total)})
    return {"categories": cats, "matched": tot_m, "total": tot_t,
            "pct": pct(tot_m, tot_t)}


def print_report(master: Path, dest: Path, rep: dict, applied: int | None) -> None:
    print(f"[harness-sync] master = {master}")
    print(f"[harness-sync] dest   = {dest}")
    print(f"{'entry':<32} {'have/total':>12} {'%':>7}   drift")
    for c in rep["categories"]:
        drift = ""
        if c["differs"] or c["missing"]:
            bits = []
            if c["differs"]:
                bits.append(f"{c['differs']} differ")
            if c["missing"]:
                bits.append(f"{c['missing']} missing")
            drift = " · ".join(bits)
        print(f"{c['entry']:<32} {str(c['matched'])+'/'+str(c['total']):>12} "
              f"{c['pct']:>6}%   {drift}")
    print(f"{'OVERALL':<32} {str(rep['matched'])+'/'+str(rep['total']):>12} "
          f"{rep['pct']:>6}%   <- % complete (the Math)")
    if applied is not None:
        print(f"[harness-sync] --apply ported {applied} file(s) master -> dest")


def run(dest_arg: str | None, apply: bool) -> int:
    master = engine_root().resolve()
    dest = Path(dest_arg).resolve() if dest_arg else Path(
        os.environ.get("HARNESS_ENGINE_ROOT", str(master))).resolve()
    if not (master / MANIFEST_REL).is_file():
        print(f"[harness-sync] FATAL: manifest not found at {master/MANIFEST_REL}",
              file=sys.stderr)
        return 2

    rep = survey(master, dest)
    applied: int | None = None

    if apply:
        if master == dest:
            print("[harness-sync] --apply skipped: master == dest (self-hosted, "
                  "nothing to port)")
        elif is_headless(os.environ.get("CLAUDE_PROJECT_DIR", ".")):
            print("[harness-sync] BLOCKED headless --apply: overwriting the central "
                  "engine needs human review — route to PR/review queue, never "
                  "self-confirm (R14/R15). Re-run --apply interactively.",
                  file=sys.stderr)
            return 3
        else:
            to_port = [f for c in rep["categories"]
                       for f in (c["differs_files"] + c["missing_files"])]
            applied = port(master, dest, to_port)
            rep = survey(master, dest)  # re-survey after porting

    print_report(master, dest, rep, applied)
    return 0


# --------------------------------------------------------------------------- #
# self-test: the REAL acceptance (tmp master/dest, assert the % Math)          #
# --------------------------------------------------------------------------- #
def _self_test() -> int:
    fails = []

    def check(name, cond):
        print(f"  {'PASS' if cond else 'FAIL'} · {name}")
        if not cond:
            fails.append(name)

    with tempfile.TemporaryDirectory() as m, tempfile.TemporaryDirectory() as d:
        master, dest = Path(m), Path(d)
        # minimal engine: manifest + one dir + one file
        (master / "scripts").mkdir()
        (master / "scripts" / "engine_manifest.txt").write_text(
            "dir:scripts\nfile:CLAUDE.md\n")
        (master / "scripts" / "a.py").write_text("A")
        (master / "scripts" / "b.py").write_text("B")
        (master / "CLAUDE.md").write_text("CONST")

        files_scripts = expand(master, "dir", "scripts")
        check("expand dir picks up manifest+a.py+b.py (3)", len(files_scripts) == 3)
        check("_skip drops junk", _skip("__pycache__") and _skip("._x") and _skip("x.pyc"))

        # dest empty -> 0% (4 files all missing: 3 scripts + CLAUDE.md)
        rep0 = survey(master, dest)
        check("empty dest -> 0.0%", rep0["pct"] == 0.0 and rep0["matched"] == 0)

        # port everything -> 100%
        allf = files_scripts + ["CLAUDE.md"]
        port(master, dest, allf)
        rep1 = survey(master, dest)
        check("after full port -> 100.0%", rep1["pct"] == 100.0)

        # dirty one file -> drops below 100, that file in 'differs'
        (dest / "scripts" / "a.py").write_text("A-CHANGED")
        rep2 = survey(master, dest)
        check("dirtied file -> <100%", rep2["pct"] < 100.0)
        diff_all = [f for c in rep2["categories"] for f in c["differs_files"]]
        check("dirtied file shows in differs", any("a.py" in f for f in diff_all))

        # remove one file -> shows in 'missing'
        (dest / "CLAUDE.md").unlink()
        rep3 = survey(master, dest)
        miss_all = [f for c in rep3["categories"] for f in c["missing_files"]]
        check("removed file shows in missing", "CLAUDE.md" in miss_all)

        # pct math: matched/total
        check("pct(3,4)==75.0", pct(3, 4) == 75.0)
        check("pct(0,0)==100.0 (empty set is trivially complete)", pct(0, 0) == 100.0)

        # dry-run writes nothing: re-port dry (apply=False path) leaves dest as-is
        before = sorted(p.name for p in (dest / "scripts").iterdir())
        survey(master, dest)  # pure comparison, no writes
        after = sorted(p.name for p in (dest / "scripts").iterdir())
        check("survey/dry-run writes nothing", before == after)

    print(f"[harness-sync --self-test] {'ALL PASS' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    return 0 if not fails else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Port harness engine master->central + % completeness")
    ap.add_argument("--dest", help="destination central engine (default: HARNESS_ENGINE_ROOT or self)")
    ap.add_argument("--apply", action="store_true", help="port differs+missing (default: dry-run)")
    ap.add_argument("--self-test", action="store_true", help="run the self-test battery")
    args = ap.parse_args()
    if args.self_test:
        return _self_test()
    return run(args.dest, args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
