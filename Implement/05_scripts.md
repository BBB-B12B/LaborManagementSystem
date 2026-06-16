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

## 9. Harness Automation Scripts (current set · run by hooks + Index Sync)

> These are the scripts the live harness depends on (CLAUDE.md R8 + AGENTS.md §Index Sync + .claude/settings.json hooks).
> All are **idempotent** (safe to re-run) unless noted. Trigger column = WHEN it must run.

| Script | What it does | Trigger (when to run) |
|---|---|---|
| `backlink_analyzer.py` | Regenerates semantic `related[]` / `backlinks[]` edges in `knowledge/index_files.json` | File created / moved / deleted → `python3 scripts/backlink_analyzer.py` |
| `code_graph.py` | Tier-A regex import graph → hard `imports[]` / `imported_by[]` edges in `index_files.json` (distinct from semantic edges) | Code file (.py/.ts/.js) created/edited/deleted → `python3 scripts/code_graph.py --write` (T-192) |
| `symbol_indexer.py` | Refreshes symbol `source`/`line` in `index_variables.json` (see §6) | Symbol with cross-file dependency created/renamed → `python3 scripts/symbol_indexer.py` |
| `rule_indexer.py` | Regenerates `rules_defined[]` / `rules_referenced[]` in `index_files.json` | Harness rule file edited (CLAUDE.md · AGENTS.md · Implement/* · */SKILL.md · INVARIANTS.md · CFP) → `python3 scripts/rule_indexer.py` (T-182) |
| `repo_map_check.py` | Regenerates the REPO_MAP.md AUTO structure block (folders + per-folder counts · carries renames via `git -M` · curated descriptions never overwritten) | Top-level/nested folder or file added/moved/removed → `python3 scripts/repo_map_check.py --sync` (T-190) |
| `index_reconcile.py` | **Stop-hook safety net** — diffs git-changed files vs `index_files.json`, emits `[index-drift]`, auto-runs the idempotent regenerators above (rule_indexer · backlink_analyzer · code_graph · symbol_indexer) + repo_map_check `--sync` | Session close (Stop hook · automatic) · manual: `python3 scripts/index_reconcile.py --sync` (T-183/T-190/T-193) |
| `session_indexer.py` | Regenerates `index_sessions.json` (see §8) — NOT auto-run by the reconciler | Session closed → `python3 scripts/session_indexer.py` |
| `posttool_track.py` | **PostToolUse hook** — auto-accumulates SESSION_TOTAL + CHAT_TOTAL per tool call (provider-aware · reads `token_formula` from detected.md) | Every tool call (hook · automatic) — agent never hand-writes these (T-178) |
| `compact_reset.py` | **Single source** for post-compact counter recompute (CHAT=compact_size+sys_fixed · LOOP=0 · SESSION=0 if armed/done else preserve · flips `session_reset=armed→consumed`) | SessionStart:compact hook (claude-code · auto) OR C0 plain-text confirm → `python3 scripts/compact_reset.py --trigger=<hook\|user-confirm>` (T-180) |
| `verify_runner.py` | Runs a MECE section's Verify-N commands (Phase 3 L4 automation) | `python3 scripts/verify_runner.py --section S<N> --file .sessions/mece_plan.md` |
| `safe_run.py` | Wraps a noisy Bash command, returns only error/warn/fail tail (R6 output filter) | `python3 scripts/safe_run.py "<cmd>"` when output likely > 40 lines |
| `trim_exec_log.py` | Prunes `.sessions/exec_log/` before /compact | Before /compact at Completion Gate |

Other utility scripts on disk (setup / analysis · not in the per-turn loop): `bootstrap_sessions.py` (Step 5 init), `session_close.py`, `session_compactor.py`, `session_analyzer.py`, `compute_compact_size.py`, `cfp_decay.py`, `choose_tools.py`, `knowledge_conflict_checker.py`, `learning_profile.py`, `backfill_knowledge_index.py`, `repo_scout.py`, `token_estimator.py`.

---
