"""
lookup.py — Pre-read oracle for agent R5 tier lookups.

Searches symbols, files, AND sessions in one call.
Agents use this as T0 BEFORE T1/T2/T3 grep tiers (editor/SKILL.md).

Usage:
    python scripts/lookup.py "JobDashboard"            # exact symbol
    python scripts/lookup.py "job dashboard"           # keyword search (symbols+files+sessions)
    python scripts/lookup.py "T-055"                   # task ID → session history
    python scripts/lookup.py --file "SiteJobDashboard" # file search only
    python scripts/lookup.py --session "harness"       # session search only

Output: JSON array sorted by score desc, each item:
  {
    "type":       "symbol" | "file" | "session",
    "name":       "<symbol | filepath | session_id>",
    "file":       "src/components/... | .sessions/session_NNN.json",
    "line":       42,           # null for sessions
    "read_hint":  {"offset": 37, "limit": 60},   # null for sessions
    "tasks":      ["T-055"],    # session only
    "summary":    "...",        # session only (200-char excerpt)
    "keywords":   [...],
    "score":      3
  }
"""

import json
import os
import re
import sys
from pathlib import Path

RAG_BASE_URL = os.environ.get("RAG_BASE_URL", "")


def _rag_query(query: str, top_k: int = 8) -> list[dict]:
    """Semantic search via claw-rag-service. Returns [] if service unavailable."""
    if not RAG_BASE_URL:
        return []
    import urllib.request
    try:
        payload = json.dumps({"query": query, "top_k": top_k}).encode()
        req = urllib.request.Request(
            f"{RAG_BASE_URL}/v1/query",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read())
        return [{
            "type": "file",
            "name": h["path"],
            "file": h["path"],
            "line": None,
            "line_end": None,
            "read_hint": {},
            "keywords": [],
            "best_section": h.get("snippet", "")[:120],
            "score": round((h.get("score") or 0) * 10, 2),
            "source": "rag",
        } for h in data.get("hits", [])]
    except Exception:
        return []

PROJECT_ROOT   = Path("/Volumes/BriteBrain/Projects/Asset Plan")
INDEX_VARS     = PROJECT_ROOT / "knowledge/index_variables.json"
INDEX_FILES    = PROJECT_ROOT / "knowledge/index_files.json"
INDEX_SESSIONS = PROJECT_ROOT / "knowledge/index_sessions.json"

CAMEL_RE = re.compile(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


def tokenize(text: str) -> list[str]:
    """Split query into searchable tokens."""
    # Split on spaces + camelCase
    words = re.split(r"[\s_\-/\.]+", text)
    tokens = []
    for w in words:
        parts = CAMEL_RE.split(w)
        tokens.extend([p.lower() for p in parts if p])
    return [t for t in tokens if len(t) > 1]


def load_index(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def score_symbol(entry: dict, tokens: list[str], query_exact: str) -> int:
    """Score a symbol entry against query tokens."""
    score = 0
    name = entry.get("name", "")
    keywords = [k.lower() for k in entry.get("keywords", [])]
    source = entry.get("source", entry.get("file", ""))

    # Exact name match = highest priority
    if name.lower() == query_exact.lower():
        score += 10

    # Name contains query (partial)
    if query_exact.lower() in name.lower():
        score += 5

    # Token matches against name tokens
    name_tokens = [t.lower() for t in CAMEL_RE.split(name) if t]
    for t in tokens:
        if t in name_tokens:
            score += 3
        if t in keywords:
            score += 2
        if t in source.lower():
            score += 1

    return score


def search_symbols(query: str, top_n: int = 8) -> list[dict]:
    data = load_index(INDEX_VARS)
    variables = data.get("variables", {})
    tokens = tokenize(query)
    results = []

    for name, entry in variables.items():
        entry["name"] = name
        s = score_symbol(entry, tokens, query)
        if s > 0:
            results.append((s, entry))

    results.sort(key=lambda x: -x[0])
    out = []
    for score, entry in results[:top_n]:
        read_hint = entry.get("read_hint", {})
        if not read_hint:
            line = entry.get("line", 1)
            line_end = entry.get("line_end", line + 60)
            read_hint = {"offset": max(1, line - 5), "limit": min(80, line_end - line + 15)}
        out.append({
            "type": "symbol",
            "name": entry["name"],
            "file": entry.get("source", entry.get("file", "?")),
            "line": entry.get("line"),
            "line_end": entry.get("line_end"),
            "read_hint": read_hint,
            "keywords": entry.get("keywords", []),
            "score": score,
            "source": "index_variables",
        })
    return out


def score_file(key: str, entry: dict, tokens: list[str], query_exact: str) -> int:
    """Score a file entry against query tokens."""
    score = 0
    desc = entry.get("description", "").lower()
    kw = [k.lower() for k in entry.get("keywords", [])]
    key_lower = key.lower()

    if query_exact.lower() in key_lower:
        score += 6
    for t in tokens:
        if t in key_lower:
            score += 3
        if t in kw:
            score += 2
        if t in desc:
            score += 1

    # Section name matches
    for sec in entry.get("key_sections", []):
        sec_name = sec.get("name", "").lower()
        for t in tokens:
            if t in sec_name:
                score += 2

    return score


def search_files(query: str, top_n: int = 5) -> list[dict]:
    data = load_index(INDEX_FILES)
    # Support {"files": {...}} wrapper (actual structure) or flat dict
    files_dict = data.get("files", data) if isinstance(data, dict) and "files" in data else data
    tokens = tokenize(query)
    results = []

    for key, entry in files_dict.items():
        if not isinstance(entry, dict):
            continue
        s = score_file(key, entry, tokens, query)
        if s > 0:
            results.append((s, key, entry))

    results.sort(key=lambda x: -x[0])
    out = []
    for score, key, entry in results[:top_n]:
        sections = entry.get("key_sections", [])
        # Find best matching section
        best_section = None
        best_sec_score = 0
        tok_set = set(tokens)
        for sec in sections:
            sec_tokens = set(tokenize(sec.get("name", "")))
            overlap = len(tok_set & sec_tokens)
            if overlap > best_sec_score:
                best_sec_score = overlap
                best_section = sec

        if best_section:
            read_hint = best_section.get("read_hint", {})
            line = best_section.get("line")
        else:
            read_hint = {}
            line = entry.get("line")

        out.append({
            "type": "file",
            "name": key,
            "file": key,
            "line": line,
            "line_end": None,
            "read_hint": read_hint,
            "keywords": entry.get("keywords", []),
            "best_section": best_section.get("name") if best_section else None,
            "score": score,
            "source": "index_files",
        })
    return out


def score_session(session_id: str, entry: dict, tokens: list[str], query_exact: str) -> int:
    """Score a session entry against query tokens."""
    score = 0
    sid_lower   = session_id.lower()
    kw          = [k.lower() for k in entry.get("keywords", [])]
    tasks       = [t.lower() for t in entry.get("tasks", [])]
    summary     = entry.get("summary", "").lower()

    # Exact task ID match (e.g. "T-055", "t055")
    q_lower = query_exact.lower()
    if q_lower in tasks or q_lower.replace("-", "") in [t.replace("-", "") for t in tasks]:
        score += 12

    # Session ID contains query
    if q_lower in sid_lower:
        score += 6

    for t in tokens:
        if t in sid_lower:
            score += 3
        if t in kw:
            score += 2
        if t in summary:
            score += 1
        # Task token match
        for task in tasks:
            if t in task:
                score += 2

    return score


def search_sessions(query: str, top_n: int = 5) -> list[dict]:
    data = load_index(INDEX_SESSIONS)
    sessions_dict = data.get("sessions", {}) if isinstance(data, dict) else {}
    tokens  = tokenize(query)
    results = []

    for sid, entry in sessions_dict.items():
        if not isinstance(entry, dict):
            continue
        s = score_session(sid, entry, tokens, query)
        if s > 0:
            results.append((s, sid, entry))

    results.sort(key=lambda x: -x[0])
    out = []
    for score, sid, entry in results[:top_n]:
        out.append({
            "type":      "session",
            "name":      sid,
            "file":      entry.get("path", f".sessions/{sid}.json"),
            "line":      None,
            "line_end":  None,
            "read_hint": None,
            "tasks":     entry.get("tasks", []),
            "status":    entry.get("status", "unknown"),
            "date":      entry.get("date", ""),
            "summary":   entry.get("summary", ""),
            "keywords":  entry.get("keywords", []),
            "score":     score,
            "source":    "index_sessions",
        })
    return out


def format_human(results: list[dict]) -> str:
    if not results:
        return "No matches found."
    lines = []
    for r in results:
        t = r["type"]
        if t == "session":
            tasks = ", ".join(r.get("tasks", [])) or "none"
            summary = r.get("summary", "")[:100]
            lines.append(
                f"[score={r['score']}] SESSION `{r['name']}`\n"
                f"  file: {r['file']}\n"
                f"  tasks: {tasks}  status: {r.get('status','')}  date: {r.get('date','')}\n"
                f"  summary: {summary}…"
            )
        else:
            rh  = r.get("read_hint") or {}
            hint = f"offset={rh.get('offset','?')} limit={rh.get('limit','?')}" if rh else "no hint"
            sec  = f" [{r['best_section']}]" if r.get("best_section") else ""
            lines.append(
                f"[score={r['score']}] {t.upper()} `{r['name']}`{sec}\n"
                f"  file: {r['file']}\n"
                f"  line: {r.get('line','?')}  read_hint: {hint}"
            )
    return "\n\n".join(lines)


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    file_only    = "--file" in args
    session_only = "--session" in args
    json_out     = "--json" in args
    flags = {"--file", "--session", "--raw", "--json"}
    query_parts = [a for a in args if a not in flags]
    query = " ".join(query_parts)

    if not query:
        print("Usage: python scripts/lookup.py <query> [--file] [--session] [--json]")
        sys.exit(1)

    sym_results     = [] if (file_only or session_only) else search_symbols(query)
    file_results    = [] if session_only else search_files(query)
    session_results = search_sessions(query)

    if not session_only and RAG_BASE_URL:
        rag_hits = _rag_query(query)
        if rag_hits:
            seen = {h["file"] for h in rag_hits}
            sym_results  = [r for r in sym_results  if r.get("file") not in seen]
            file_results = [r for r in file_results if r.get("file") not in seen]
            combined = rag_hits + sym_results + file_results + session_results
        else:
            combined = sym_results + file_results + session_results
    else:
        combined = sym_results + file_results + session_results
    combined.sort(key=lambda x: -x["score"])

    if json_out:
        print(json.dumps(combined, indent=2))
    else:
        print(f"Query: \"{query}\"  →  {len(combined)} match(es)\n")
        print(format_human(combined))


if __name__ == "__main__":
    main()
