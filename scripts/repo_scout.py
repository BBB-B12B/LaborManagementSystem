#!/usr/bin/env python3
"""
repo_scout.py — Clone or validate a Git repo, enumerate files, detect language, output JSON.

Usage:
    python3 scripts/repo_scout.py <url_or_local_path> [--output .sessions/repo_scout_<name>.json]
    python3 scripts/repo_scout.py --help

Output JSON schema:
{
  "repo_name": str,
  "source_url": str,          # original url or absolute local path
  "language": str,            # primary language detected
  "languages": {str: int},    # all detected languages with file count
  "size_tier": str,           # "S" | "M" | "L" | "XL"
  "file_count": int,
  "files": [str],             # all files (relative paths), max 5000
  "entry_points": [str],      # likely entry points (main/index/app/server/cli)
  "key_files": [str],         # top files by ext priority
  "clone_path": str,          # local path where repo lives
  "error": str | null         # non-null if scout failed
}
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from collections import Counter

# ── Language detection ─────────────────────────────────────────────────────────

EXT_TO_LANG = {
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++", ".cc": "C++", ".cxx": "C++",
    ".c": "C",
    ".swift": "Swift",
    ".dart": "Dart",
    ".ex": "Elixir", ".exs": "Elixir",
    ".hs": "Haskell",
    ".scala": "Scala",
}

SKIP_DIRS = {
    ".git", "node_modules", ".next", "__pycache__", "dist", "build",
    ".venv", "venv", "vendor", ".cache", "coverage", ".nyc_output",
    "target", ".gradle", "out",
}

SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".woff", ".woff2", ".ttf", ".eot",
    ".mp4", ".mp3", ".wav",
    ".zip", ".tar", ".gz", ".tgz",
    ".lock",  # package-lock.json / yarn.lock are too noisy
}

ENTRY_PATTERNS = [
    "main", "index", "app", "server", "cli", "cmd",
    "start", "run", "entry", "__main__",
]

KEY_EXT_PRIORITY = [
    ".ts", ".tsx", ".py", ".go", ".rs", ".js", ".jsx",
    ".java", ".kt", ".rb", ".php", ".cs",
]

SIZE_TIERS = [
    ("S", 200),
    ("M", 1000),
    ("L", 5000),
    ("XL", float("inf")),
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_size_tier(count: int) -> str:
    for tier, threshold in SIZE_TIERS:
        if count <= threshold:
            return tier
    return "XL"


def enumerate_files(root: str):
    """Walk repo root, skip noise dirs/exts, return relative paths."""
    root_path = Path(root)
    files = []
    for dirpath, dirnames, filenames in os.walk(root_path):
        # prune skip dirs in-place
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fname in filenames:
            fpath = Path(dirpath) / fname
            if fpath.suffix.lower() in SKIP_EXTS:
                continue
            rel = str(fpath.relative_to(root_path))
            files.append(rel)
            if len(files) >= 5000:
                return files
    return files


def detect_languages(files: list) -> dict:
    counts: Counter = Counter()
    for f in files:
        ext = Path(f).suffix.lower()
        lang = EXT_TO_LANG.get(ext)
        if lang:
            counts[lang] += 1
    return dict(counts.most_common())


def primary_language(langs: dict) -> str:
    return next(iter(langs), "unknown")


def find_entry_points(files: list) -> list:
    entries = []
    for f in files:
        stem = Path(f).stem.lower()
        if stem in ENTRY_PATTERNS:
            entries.append(f)
    return entries[:20]


def find_key_files(files: list, top_n: int = 50) -> list:
    by_ext: dict = {}
    for f in files:
        ext = Path(f).suffix.lower()
        if ext in KEY_EXT_PRIORITY:
            by_ext.setdefault(ext, []).append(f)

    key = []
    for ext in KEY_EXT_PRIORITY:
        candidates = sorted(by_ext.get(ext, []))
        key.extend(candidates)
        if len(key) >= top_n:
            break
    return key[:top_n]


def is_git_repo(path: str) -> bool:
    try:
        subprocess.check_output(
            ["git", "-C", path, "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def clone_repo(url: str, dest: str) -> tuple:
    """Returns (success: bool, error: str)."""
    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1", url, dest],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return False, result.stderr.strip()
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "clone timed out after 120s"
    except FileNotFoundError:
        return False, "git not found in PATH"


def repo_name_from_url(url: str) -> str:
    name = url.rstrip("/").split("/")[-1]
    if name.endswith(".git"):
        name = name[:-4]
    return name or "repo"


# ── Main ───────────────────────────────────────────────────────────────────────

def scout(source: str) -> dict:
    result = {
        "repo_name": "",
        "source_url": source,
        "language": "unknown",
        "languages": {},
        "size_tier": "S",
        "file_count": 0,
        "files": [],
        "entry_points": [],
        "key_files": [],
        "clone_path": "",
        "error": None,
    }

    tmp_dir = None
    clone_path = source

    # Determine if URL or local path
    is_url = source.startswith("http://") or source.startswith("https://") or source.startswith("git@")

    if is_url:
        result["repo_name"] = repo_name_from_url(source)
        tmp_dir = tempfile.mkdtemp(prefix="repo_scout_")
        clone_path = os.path.join(tmp_dir, result["repo_name"])
        print(f"[scout] Cloning {source} → {clone_path}", file=sys.stderr)
        success, err = clone_repo(source, clone_path)
        if not success:
            result["error"] = f"clone-failed: {err}"
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return result
    else:
        # Local path
        clone_path = os.path.abspath(source)
        if not os.path.exists(clone_path):
            result["error"] = f"path-invalid: {clone_path} does not exist"
            return result
        if not is_git_repo(clone_path):
            result["error"] = f"path-invalid: {clone_path} is not a git repository"
            return result
        result["repo_name"] = os.path.basename(clone_path)

    result["clone_path"] = clone_path

    try:
        files = enumerate_files(clone_path)
        langs = detect_languages(files)
        file_count = len(files)

        result["languages"] = langs
        result["language"] = primary_language(langs)
        result["size_tier"] = get_size_tier(file_count)
        result["file_count"] = file_count
        result["files"] = files
        result["entry_points"] = find_entry_points(files)
        result["key_files"] = find_key_files(files)

    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Scout a Git repo — clone or validate local, enumerate files, detect language."
    )
    parser.add_argument("source", nargs="?", help="GitHub URL or local path to repo")
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output JSON path (default: .sessions/repo_scout_<repo_name>.json)",
    )
    args = parser.parse_args()

    if not args.source:
        parser.print_help()
        sys.exit(0)

    data = scout(args.source)

    # Default output path
    out_path = args.output
    if not out_path:
        safe_name = data["repo_name"].replace("/", "_").replace(" ", "_") or "unknown"
        out_path = os.path.join(".sessions", f"repo_scout_{safe_name}.json")

    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)

    if data["error"]:
        print(f"[scout-error] {data['error']}", file=sys.stderr)
        sys.exit(1)

    print(
        f"[scout-done] repo: {data['repo_name']} · tier: {data['size_tier']} "
        f"· files: {data['file_count']} · lang: {data['language']}"
    )
    print(f"[output] {out_path}")
    sys.exit(0)


if __name__ == "__main__":
    main()
