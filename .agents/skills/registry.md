---
name: Skill Registry
description: Lightweight index of all available skills. Agent reads skill-manifest.json first (machine routing), then uses this file for micro-rules.
---

# Skill Registry

> **Routing order**: `skill-manifest.json` (keyword match, Boot step 5) → this file (micro-rules) → full `SKILL.md` (edge cases only)

## ⚡ Fast-Match: Keyword → Skill

| User says / task contains | Load skill |
|---|---|
| "fix", "bug", "error", "not working", "broken", "issue" | `editor` + **R7 first** → if >1 file affected: **`mece` before edit** |
| "implement", "refactor", "restructure", "build", "rename all" | `mece` → then `coder` or `editor` |
| "create", "new", "add page", "scaffold" | `coder` → then auto `file_manager` + `variable_manager` |
| "move", "delete", "rename file" | `file_manager` |
| "rename function/component", "refactor symbol" | `variable_manager` |
| "new session", "done", "wrap up", "switch task" | `session_manager` |
| token footer (every turn) | `token_tracker` (always active) |
| output > 8k | `token_auditor` |
| "แก้ harness", "update harness", "improve skill", "เพิ่ม rule", "edit SKILL.md", "harness edit" | `harness_editor` |

> **Chained skills**: After `coder` or `editor` completes → ALWAYS run `file_manager` + `variable_manager` to sync indexes.

---

> **Micro-Rule Protocol**: Use Micro-Rules below for common tasks — load full SKILL.md only when an edge case is not covered by the micro-rule.

| Skill | Path | Load When | context_files |
|-------|------|-----------|---------------|
| `agent` | `.agents/skills/agent/SKILL.md` | Always loaded — orchestration and 6-step loop | `[.sessions/<latest>.json, docs/master_roadmap.md]` |
| `identity` | `.agents/skills/identity/SKILL.md` | Always loaded — persona and communication rules | `[]` |
| `coder` | `.agents/skills/coder/SKILL.md` | Creating new files or scaffolding new features | `[knowledge/index_files.json, docs/master_roadmap.md]` |
| `editor` | `.agents/skills/editor/SKILL.md` | Modifying or debugging existing files | `[knowledge/index_variables.json, knowledge/index_files.json]` |
| `file_manager` | `.agents/skills/file_manager/SKILL.md` | After any file is created, moved, or deleted | `[knowledge/index_files.json]` |
| `variable_manager` | `.agents/skills/variable_manager/SKILL.md` | After any component, function, or variable is added/renamed/deleted | `[knowledge/index_variables.json]` |
| `session_manager` | `.agents/skills/session_manager/SKILL.md` | At session start, context switch, or task completion | `[.sessions/<latest>.json]` |
| `token_tracker` | `.agents/skills/token_tracker/SKILL.md` | At the end of every interaction turn (Step 6 of loop) | `[.sessions/<latest>.json]` |
| `token_auditor` | `.agents/skills/token_auditor/SKILL.md` | Only when `estimated_tokens` exceeds 8,000 | `[knowledge/index_files.json, docs/optimization_logs.md]` |
| `harness_editor` | `.agents/skills/harness_editor/SKILL.md` | Editing CLAUDE.md, AGENTS.md, SKILL.md files, knowledge/, Implement/ | `[knowledge/harness_flow_20260526.md]` |

---

## Micro-Rules (Inline — Load Full SKILL.md Only for Edge Cases)

### `agent`
- Read active session JSON before starting any task
- Search index with `grep -A N "keyword"` only — never read full index files, never grep blindly
- Enforce Step 6 (token check) every turn without exception

### `identity`
- Always reply in the same language as the user
- Keep replies concise, on-point, focused on technical facts

### `coder`
- Create new files only — never modify existing logic
- After creating a file: immediately call `file_manager` + `variable_manager`

### `editor`
- **Lazy Lookup (3 Tiers)**: T1 → `grep -A 8 '"Symbol"' knowledge/index_variables.json` → enough? stop. T2 → add context `-B 2 -A 20` → enough? stop. T3 → `Read offset=<line-5> limit=60` only
- Edit <5 lines → `sed -i` only (never use JSON edit tool)
- All bash commands must pipe and filter: `2>&1 | grep -iE "error|warn" | tail -20`

### `file_manager`
- Update `knowledge/index_files.json` every time a file is created/moved/deleted
- Always check backlinks with `grep -A 10 '"path"' knowledge/index_files.json` before deleting

### `variable_manager`
- Update `knowledge/index_variables.json` (with `line` field) every time a symbol is added/renamed/deleted
- After editing source file: run `python scripts/symbol_indexer.py` to refresh line numbers in index automatically
- Search used_in with `grep -A 6 '"Symbol"' knowledge/index_variables.json` — never read full file

### `session_manager`
- Every 5 History entries: distill old entries into 1 sentence in `summary_context` then delete (proactive — do not wait for compactor)
- Always close session: set `status: completed` + write `summary_context` before opening new session

### `token_tracker`
- Formula: `UTF-8 bytes // 3` (never use `chars / 4`)
- Accumulate every turn: `new_total = old_total + current_turn_tokens`

### `token_auditor`
- Runs only when >8,000 tokens
- Log root cause to `docs/optimization_logs.md` + inject rule into SKILL.md of the wasting skill

---

## Learned Routes (auto-updated — fast match before skill lookup)

| Keyword/Pattern | Skill | Score | Uses |
|---|---|---|---|
| _add confirmed routes here_ | | | |

---

## Hard Constraints (always active — no skill required)

See `CLAUDE.md`. These rules are enforced regardless of which skill is loaded:
- Output filtering (no raw log dumps)
- Max 5 tool calls per turn
- Structured JSON session logging
- Token transparency footer
- All AI-facing files must be English only (R7)
