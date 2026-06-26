"""
session_indexer.py
Scans .sessions/session_*.json and builds knowledge/index_sessions.json.

index_sessions.json is a THIN POINTER index — heavy detail (files_changed, actions,
friction) lives in the session_NNN.json detail file, not here. Each entry stores only:
  - session_id    : the session it points back to
  - path          : relative path to the rich detail file (read it for full detail)
  - tasks         : associated_tasks[] from the session
  - status        : completed | in_progress | blocked
  - date          : from session JSON or file mtime
  - skill         : skill name from session JSON (or null)
  - summary       : first 200 chars of summary_context (excerpt for fast lookup)
  - keywords      : noise-filtered tokens (no pure-digit / line-count junk)

Usage:
    python scripts/session_indexer.py
    python scripts/session_indexer.py --rebuild
"""

import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = PROJECT_ROOT / ".sessions"
INDEX_PATH   = PROJECT_ROOT / "knowledge/index_sessions.json"

NOISE = {
    "the", "a", "an", "and", "or", "to", "in", "of", "for", "is", "was",
    "with", "all", "from", "this", "that", "by", "at", "on", "it", "its",
    "as", "be", "are", "were", "has", "have", "been", "not", "no", "new",
    "added", "updated", "completed", "session", "file", "files",
}

WORD_RE = re.compile(r"[a-zA-Z0-9_\-\.]+")
CAMEL_RE = re.compile(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
# Drop pure-digit tokens ("030") and line-count noise ("198l") — junk keywords.
NUM_NOISE_RE = re.compile(r"^\d+[lL]?$")


def tokenize_text(text: str) -> set[str]:
    tokens = set()
    for word in WORD_RE.findall(text):
        # Split camelCase
        parts = CAMEL_RE.split(word)
        for p in parts:
            p = p.lower().strip("._-")
            if len(p) > 2 and p not in NOISE and not NUM_NOISE_RE.match(p):
                tokens.add(p)
    return tokens


def extract_keywords(session: dict, session_id: str) -> list[str]:
    tokens = set()

    # From session_id slug
    slug_parts = session_id.replace("session_", "").split("_")
    for p in slug_parts:
        if len(p) > 2 and not p.isdigit() and p not in NOISE:
            tokens.add(p.lower())

    # From summary_context
    tokens.update(tokenize_text(session.get("summary_context", "")))

    # From files_changed
    for f in session.get("files_changed", []):
        tokens.update(tokenize_text(f))

    # From History actions (may be list of dicts or list of strings)
    for h in session.get("History", []):
        if isinstance(h, dict):
            tokens.update(tokenize_text(h.get("action", "")))
        elif isinstance(h, str):
            tokens.update(tokenize_text(h))

    # Always include task IDs as keywords (e.g. "t-055", "t055")
    for t in session.get("associated_tasks", []):
        tokens.add(t.lower())
        tokens.add(t.lower().replace("-", ""))

    return sorted(tokens)


def infer_date(session_id: str, file_path: Path) -> str:
    # Try to extract date from path mtime
    try:
        mtime = file_path.stat().st_mtime
        return datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
    except Exception:
        return "unknown"


def scan_sessions() -> dict[str, dict]:
    result = {}
    for path in sorted(SESSIONS_DIR.glob("session_*.json")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue

        session_id = data.get("session_id", path.stem)
        rel_path   = str(path.relative_to(PROJECT_ROOT))

        # Build 200-char excerpt from summary_context
        summary_full = data.get("summary_context", "")
        excerpt = summary_full[:200].rstrip() + ("…" if len(summary_full) > 200 else "")

        keywords = extract_keywords(data, session_id)

        # Support both "associated_tasks" (old schema) and "tasks" (new schema)
        tasks = data.get("associated_tasks", data.get("tasks", []))

        # THIN entry — pointer only. Heavy fields (files_changed/actions/friction)
        # live in the detail file at `path`; read it when full detail is needed.
        result[session_id] = {
            "path":     rel_path,
            "tasks":    tasks,
            "status":   data.get("status", "unknown"),
            "date":     data.get("date") or infer_date(session_id, path),
            "skill":    data.get("skill") or None,
            "summary":  excerpt,
            "keywords": keywords,
        }

    return result


def build_index(sessions: dict[str, dict], rebuild: bool = False) -> None:
    existing = {}
    if not rebuild and INDEX_PATH.exists():
        try:
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
                # Support both list and dict formats. Key by session_id (NOT path) so a
                # fresh thin scan overwrites the old heavy entry instead of duplicating it.
                if isinstance(raw, list):
                    existing = {e.get("session_id", e.get("path", str(i))): e for i, e in enumerate(raw)}
                else:
                    existing = raw.get("sessions", {})
        except Exception:
            pass

    if rebuild:
        merged = sessions
    else:
        # Merge: always overwrite with fresh scan (sessions are immutable once closed)
        merged = {**existing, **sessions}

    # Write as a list for easier downstream consumption (each entry includes session_id)
    entries = []
    for sid, info in merged.items():
        entry = {"session_id": sid, **info}
        entries.append(entry)

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def main():
    rebuild = "--rebuild" in sys.argv
    mode = "REBUILD" if rebuild else "incremental"
    print(f"Scanning .sessions/session_*.json [{mode}] ...")
    sessions = scan_sessions()
    print(f"  Found {len(sessions)} session(s).")
    build_index(sessions, rebuild=rebuild)
    print(f"  knowledge/index_sessions.json updated.")
    print("\nSample (last 3):")
    for sid, info in list(sessions.items())[-3:]:
        print(f"  {sid}")
        print(f"    tasks: {info['tasks']}  status: {info['status']}")
        print(f"    skill: {info['skill']}  date: {info['date']}")
        print(f"    keywords: {info['keywords'][:5]}")


if __name__ == "__main__":
    main()
