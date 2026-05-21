---
name: Skill Registry
description: Lightweight index of all available skills. Agent reads skill-manifest.json first (machine routing), then uses this file for micro-rules.
---

# Skill Registry

> **Routing order**: `skill-manifest.json` (keyword match, Boot B2) → this file (micro-rules) → full `SKILL.md` (edge cases only)

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
| SESSION_TOTAL > 60k (TOKEN PAUSE) | `token_auditor` |

> **Chained skills**: After `coder` or `editor` completes → ALWAYS run `file_manager` + `variable_manager` to sync indexes.

> **`mece` trigger priority** (highest → lowest): (1) Loop Phase 2 auto-run — fires ONCE per task; task boundary = Per-Turn skill change. Before overwriting `.sessions/mece_plan.md`, save existing plan to `.sessions/mece_plan_prev.md`. (2) Prefix before `editor` — when >1 file is affected by a fix. (3) Primary skill — when keywords like "implement/refactor" are the main intent. All three can apply; Phase 2 auto-run always supersedes.

---

> **Micro-Rule Protocol**: Use Micro-Rules below for common tasks — load full SKILL.md only when an edge case is not covered by the micro-rule.

| Skill | Path | Load When | context_files |
|-------|------|-----------|---------------|
| `agent` | `.agents/skills/agent/SKILL.md` | Manual only — not auto-routed. Generic orchestration micro-rules (index search, token check, session JSON). | `[.sessions/active_thread.md, docs/master_roadmap.md]` |
| `mece` | `.agents/skills/mece/SKILL.md` | Phase 2 — builds section plan, writes `.sessions/mece_plan.md` BEFORE user confirm | `[.sessions/mece_plan.md]` |
| `identity` | `.agents/skills/identity/SKILL.md` | Always loaded — persona and communication rules | `[]` |
| `coder` | `.agents/skills/coder/SKILL.md` | Creating new files or scaffolding new features | `[knowledge/index_files.json, docs/master_roadmap.md]` |
| `editor` | `.agents/skills/editor/SKILL.md` | Modifying or debugging existing files | `[knowledge/index_variables.json, knowledge/index_files.json]` |
| `file_manager` | `.agents/skills/file_manager/SKILL.md` | After any file is created, moved, or deleted | `[knowledge/index_files.json]` |
| `variable_manager` | `.agents/skills/variable_manager/SKILL.md` | After any component, function, or variable is added/renamed/deleted | `[knowledge/index_variables.json]` |
| `session_manager` | `.agents/skills/session_manager/SKILL.md` | At session start, context switch, task completion, or "จบ session" | `[.sessions/active_thread.md, .sessions/session_handoff.md, .sessions/session_tokens.md, .sessions/mece_plan.md]` |
| `token_tracker` | `.agents/skills/token_tracker/SKILL.md` | At the end of every interaction turn (Step 6 of loop) | `[.sessions/session_tokens.md]` |
| `token_auditor` | `.agents/skills/token_auditor/SKILL.md` | Triggered during TOKEN PAUSE when SESSION_TOTAL > 60k (see CLAUDE.md §R3) | `[.sessions/session_tokens.md]` |

---

## Micro-Rules (Inline — Load Full SKILL.md Only for Edge Cases)

### `agent`
- Read active session JSON before starting any task
- Search index with `grep_search` API tool (or `Select-String` on Windows) only — never read full index files, never search blindly
- Enforce Step 6 (token check) every turn without exception

### `identity`
- Always reply in the same language as the user
- Keep replies concise, on-point, focused on technical facts

### `coder`
- Create new files only — never modify existing logic
- After creating a file: immediately call `file_manager` + `variable_manager`

### `editor`
- **Lazy Lookup (3 Tiers)**: T1 → query symbol via `grep_search` tool (or `Select-String -Context 0,8` in index_variables.json) → enough? stop. T2 → widen search context (`-Context 2,20` in PowerShell) → enough? stop. T3 → `Read offset=<line-5> limit=60` only
- Edit <5 lines → targeted single-block edit; avoid full-file rewrites
- Filter CLI commands: `2>&1 | Select-String -Pattern "error","warn" | Select-Object -Last 20` (Windows PowerShell syntax)

### `file_manager`
- Update `knowledge/index_files.json` every time a file is created/moved/deleted
- Always check backlinks using `grep_search` tool (or `Select-String` in index_files.json) before deleting

### `variable_manager`
- Update `knowledge/index_variables.json` (with `line` field) every time a symbol is added/renamed/deleted
- After editing source file: run `python scripts/symbol_indexer.py` to refresh line numbers in index automatically
- Search used_in using `grep_search` tool (or `Select-String -Context 0,6` in index_variables.json) — never read full file

### `session_manager`
- Every 5 History entries (1 entry = 1 user message + 1 agent response, i.e. 1 round trip): distill old entries into 1 sentence in `summary_context` then delete (proactive — do not wait for compactor)
- Always close session: set `status: completed` + write `summary_context` before opening new session
- On "จบ session" / "ล้างแผน": read mece_plan.md → append summary to Session Archive → clear Sections to empty template → phase: done
- Token Gate triggered: archive state in mece_plan.md → generate Continuation Prompt → tell user to open new chat

### `token_tracker`
- Formula: → **CLAUDE.md §R1 is canonical** (`Input: chars × 0.3 + overhead` · `Output: thai_chars × 1.7 + en_chars × 0.3`)
- Accumulate every turn: `new_total = old_total + current_turn_tokens`

### `token_auditor`
- Runs only when SESSION_TOTAL > 60k (triggered during TOKEN PAUSE — see CLAUDE.md §R3)
- Log root cause in session_handoff.md
- **Gate:** before injecting rule into any SKILL.md → emit `[gate] token_auditor: inject into <skill>/SKILL.md — confirm? y/n` → wait user confirm

---

## Learned Routes (auto-updated — fast match before skill lookup)

| Keyword/Pattern | Skill | Score | Uses | Last Gap |
|---|---|---|---|---|
| _(auto-populated by session_manager after 3+ confirmed uses: pattern → skill)_ | | 4.0 | 0 | null |

---

## Scoring Rules
- Task success: score +0.1 (max 5.0)
- CFP logged or friction note written: score -0.5
- score < 2.5: route flagged unreliable → fallback to default skill (`editor`) _(advisory — agent must apply manually; not enforced by skill-manifest.json)_
- Threshold: pending friction notes for same skill ≥ 2 → alert user before next task (see R20)

---

## Hard Constraints (always active — no skill required)

See `CLAUDE.md`. These rules are enforced regardless of which skill is loaded:
- Output filtering (no raw log dumps)
- Max 5 tool calls per turn
- Structured JSON session logging
- Token transparency footer
- All AI-facing files must be English only (R7)
