"""
session_indexer.py
Scans .sessions/session_*.json and builds knowledge/index_sessions.json.

Each entry stores:
  - path          : relative path to the session file
  - tasks         : associated_tasks[] from the session
  - status        : completed | in_progress | blocked
  - date          : inferred from session_id (session_NNN_YYYY-MM-DD) or file mtime
  - keywords      : extracted from summary_context + files_changed + tasks
  - summary       : first 200 chars of summary_context (excerpt for fast lookup)
  - files_changed : list of changed files (if present)
  - skill         : skill name from session JSON (or null)
  - topic         : first task description or keywords[0] (or null)
  - actions       : list of T-IDs completed in session
  - friction      : list of blocked/error event descriptions
  - promoted      : always false (never set by indexer)

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


def tokenize_text(text: str) -> set[str]:
    tokens = set()
    for word in WORD_RE.findall(text):
        # Split camelCase
        parts = CAMEL_RE.split(word)
        for p in parts:
            p = p.lower().strip("._-")
            if len(p) > 2 and p not in NOISE:
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


# Regex to find T-IDs like T-149, T-072, etc.
TASK_ID_RE = re.compile(r"\bT-\d+\b")


def extract_new_fields(session: dict, existing_keywords: list) -> dict:
    """Extract the 5 new fields from a session JSON dict."""
    try:
        # skill: top-level "skill" key
        skill = session.get("skill") or None

        # topic: first task description or first keyword
        topic = None
        tasks_raw = session.get("tasks", session.get("associated_tasks", []))
        if tasks_raw and isinstance(tasks_raw, list) and len(tasks_raw) > 0:
            first = tasks_raw[0]
            if isinstance(first, dict):
                topic = first.get("description") or first.get("title") or None
            elif isinstance(first, str):
                topic = first
        if not topic and existing_keywords:
            topic = existing_keywords[0]

        # actions: T-IDs from tasks where status = completed/done, or all T-IDs found by regex
        actions = []
        tasks_list = session.get("tasks", session.get("associated_tasks", []))
        if isinstance(tasks_list, list):
            for t in tasks_list:
                if isinstance(t, dict):
                    status = t.get("status", "").lower()
                    desc = t.get("description", t.get("title", ""))
                    ids = TASK_ID_RE.findall(desc)
                    if status in ("completed", "done") or not status:
                        actions.extend(ids)
                elif isinstance(t, str):
                    # Plain string like "T-119" or "T-119: some task"
                    ids = TASK_ID_RE.findall(t)
                    actions.extend(ids)
        # Also scan task_id top-level field (session_001 schema)
        task_id_field = session.get("task_id", "")
        if task_id_field:
            actions.extend(TASK_ID_RE.findall(str(task_id_field)))
        # Deduplicate preserving order
        seen = set()
        unique_actions = []
        for a in actions:
            if a not in seen:
                seen.add(a)
                unique_actions.append(a)
        actions = unique_actions

        # friction: blocked/error events
        friction = []
        for key in ("blocked", "errors", "friction", "error_events"):
            val = session.get(key)
            if isinstance(val, list):
                friction.extend([str(v) for v in val if v])
            elif isinstance(val, str) and val:
                friction.append(val)

        # promoted: always false
        promoted = False

        return {
            "skill": skill,
            "topic": topic,
            "actions": actions,
            "friction": friction,
            "promoted": promoted,
        }
    except Exception:
        return {
            "skill": None,
            "topic": None,
            "actions": [],
            "friction": [],
            "promoted": False,
        }


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
        new_fields = extract_new_fields(data, keywords)

        # Support both "associated_tasks" (old schema) and "tasks" (new schema)
        tasks = data.get("associated_tasks", data.get("tasks", []))

        result[session_id] = {
            "path":          rel_path,
            "tasks":         tasks,
            "status":        data.get("status", "unknown"),
            "date":          data.get("date") or infer_date(session_id, path),
            "keywords":      keywords,
            "summary":       excerpt,
            "files_changed": data.get("files_changed", []),
            # New fields
            "skill":         new_fields["skill"],
            "topic":         new_fields["topic"],
            "actions":       new_fields["actions"],
            "friction":      new_fields["friction"],
            "promoted":      new_fields["promoted"],
        }

    return result


def build_index(sessions: dict[str, dict], rebuild: bool = False) -> None:
    existing = {}
    if not rebuild and INDEX_PATH.exists():
        try:
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
                # Support both list and dict formats
                if isinstance(raw, list):
                    existing = {e.get("path", str(i)): e for i, e in enumerate(raw)}
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
        print(f"    skill: {info['skill']}  topic: {info['topic']}")
        print(f"    actions: {info['actions']}")
        print(f"    keywords: {info['keywords'][:5]}")


if __name__ == "__main__":
    main()
