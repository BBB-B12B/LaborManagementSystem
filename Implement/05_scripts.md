## 6. `scripts/symbol_indexer.py` Spec

If the script does not exist, implement it with this behavior:

```
Input:  Scans all .ts / .tsx files under src/
        Detects lines matching: export (async)? (function|const|let|var|type|interface|class|enum) <Name>
Output: Updates knowledge/index_variables.json
        For each matched symbol: sets "source" and "line" fields
        Does NOT overwrite "type", "fields", or "used_in" — merge only
```

Minimal Python implementation pattern:

```python
import re, json
from pathlib import Path

BASE = Path(__file__).parent.parent
INDEX = BASE / "knowledge/index_variables.json"
EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)"
)

def scan():
    hits = {}
    for f in (BASE / "src").rglob("*.ts"):
        for i, line in enumerate(f.read_text().splitlines(), 1):
            m = EXPORT_RE.match(line.strip())
            if m:
                hits[m.group(1)] = {"source": str(f.relative_to(BASE)), "line": i}
    for f in (BASE / "src").rglob("*.tsx"):
        for i, line in enumerate(f.read_text().splitlines(), 1):
            m = EXPORT_RE.match(line.strip())
            if m:
                hits[m.group(1)] = {"source": str(f.relative_to(BASE)), "line": i}
    return hits

data = json.loads(INDEX.read_text()) if INDEX.exists() else {"variables": {}}
for name, loc in scan().items():
    data["variables"].setdefault(name, {}).update(loc)
INDEX.write_text(json.dumps(data, indent=2, ensure_ascii=False))
print(f"Updated {len(scan())} symbols.")
```

---

## 7. `scripts/lookup.py` Spec — T0 Pre-Read Oracle

Run before any `Read` call or grep to get file + line + `read_hint` in one shot.

```
Usage:
  python scripts/lookup.py "SymbolOrKeyword"          # search symbols + files
  python scripts/lookup.py "keyword" --session        # search sessions only
  python scripts/lookup.py "keyword" --file           # search files only
  python scripts/lookup.py "keyword" --json           # JSON output (machine-readable)
  python scripts/lookup.py "T-055" --session --json   # find session by task ID

Output format (--json):
  [
    {
      "type": "symbol" | "file" | "session",
      "name": "<symbol or filename or session_id>",
      "file": "<path>",
      "line": <N>,
      "line_end": <N>,
      "read_hint": "offset=<N> limit=<N>",
      "keywords": ["..."],
      "score": <int 0–12>,
      "source": "index_variables" | "index_files" | "index_sessions" | "rag"
    },
    ...
  ]

Returns: top results sorted by score descending.
Empty result → proceed to T1 grep tier.
```

Data sources searched:
- `knowledge/index_variables.json` — symbols (`type: "symbol"`, `source: "index_variables"`)
- `knowledge/index_files.json` — files (`type: "file"`, `source: "index_files"`)
- `knowledge/index_sessions.json` — session history (`type: "session"`, `source: "index_sessions"`, --session flag)
- `claw-rag-service` — semantic search (`source: "rag"`) · enabled when `RAG_BASE_URL` env var is set · results prepended before index hits · fallback to index on service unavailable

Scoring: token overlap scoring (int) · rag source: cosine similarity normalized 0–10

Integration points:
- **`editor/SKILL.md §T0`** — run before any Read: `python scripts/lookup.py "SymbolName" --json`
- **`coder/SKILL.md §1`** — check if feature already built: `python scripts/lookup.py "feature" --session --json`
- **`session_manager/SKILL.md §2 Step 1a`** — resume flow: find prior session for task
- **`self_improve/SKILL.md §2 Step 4.5`** — find session that triggered top CFP
- **`CLAUDE.md §R5`** — T0 tier before T1-T3 grep tiers

Minimal implementation pattern:
```python
import json, sys
from pathlib import Path

BASE = Path(__file__).parent.parent
VARS_INDEX = BASE / "knowledge/index_variables.json"
FILES_INDEX = BASE / "knowledge/index_files.json"
SESS_INDEX  = BASE / "knowledge/index_sessions.json"

def load_json(p):
    if not p.exists(): return {}
    return json.loads(p.read_text())

# Search logic: score each entry by keyword overlap
# --json: output JSON array · --session: search only sessions · --file: search only files
```

---

## 8. `scripts/session_indexer.py` Spec

Builds `knowledge/index_sessions.json` from all `.sessions/session_*.json` files.
Run automatically at every session close (session_manager §3 Step 5).

```
Input:  Scans .sessions/session_*.json (all session archive files)
Output: Writes knowledge/index_sessions.json

For each session file extracts:
  - session_id     (from JSON "session_id" field)
  - tasks          (from "associated_tasks" array)
  - status         (from "status" field)
  - date           (from file mtime or session_id suffix)
  - keywords       (tokenized from: session_id + tasks + summary_context + files_changed + History)
  - summary        (first 200 chars of "summary_context")
  - files_changed  (list from "files_changed" array if present)
```

Output schema:
```json
{
  "sessions": {
    "session_001_topic": {
      "path": ".sessions/session_001_topic.json",
      "tasks": ["T-001"],
      "status": "completed",
      "date": "2026-05-25",
      "keywords": ["keyword1", "keyword2"],
      "summary": "First 200 chars of summary_context...",
      "files_changed": ["src/path/to/file.tsx"]
    }
  }
}
```

Integration:
- **`session_manager/SKILL.md §3 Step 5`** — run after closing session JSON (Step 1)
- **`lookup.py`** — reads `index_sessions.json` when `--session` flag used

Note on History type guard (required):
```python
# Old sessions may have History: ["string"] instead of History: [{dict}]
for h in session.get("History", []):
    if isinstance(h, dict):
        tokens.update(tokenize_text(h.get("action", "") + " " + h.get("result", "")))
    elif isinstance(h, str):
        tokens.update(tokenize_text(h))
```

---
