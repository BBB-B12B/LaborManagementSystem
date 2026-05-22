# Skill Registry — Fast Match Table

> Fallback when skill-manifest.json lookup is ambiguous. List keyword → skill mappings.

| Keyword / Intent | Skill |
|---|---|
| แก้ bug / fix / debug | editor |
| สร้างไฟล์ใหม่ / create / implement | coder |
| ย้าย / ลบ / rename file | file_manager |
| rename symbol / refactor export | variable_manager |
| จบ session / close / สรุป | session_manager |
| วางแผน / orchestrate multi-step | agent |
| token limit warning | token_auditor |

## Default
No match → load `editor` skill.

> **`mece` trigger priority** (highest → lowest): (1) Loop Phase 2 auto-run — fires ONCE per task; task boundary = Per-Turn skill change. Before overwriting `.sessions/mece_plan.md`, save existing plan to `.sessions/mece_plan_prev.md`. (2) Prefix before `editor` — when >1 file is affected by a fix. (3) Primary skill — when keywords like "implement/refactor" are the main intent. All three can apply; Phase 2 auto-run always supersedes.

## Micro-rules
- MECE plan required for tasks >3 steps or any irreversible action
- token_auditor gates: >60k warn · >90k halt
- session_manager completes 6 steps on close: Step 0 R19 self-eval + session JSON + active_thread.md + session_tokens.md + session_handoff.md + mece_plan.md (clear)
- On close: enumerate any `.sessions/cycle_N_*.json` files written this session in the confirmation reply

## Learned Routes (auto-updated — fast match before skill lookup)

| Keyword/Pattern | Skill | Score | Uses | Last Gap |
|---|---|---|---|---|
| _(auto-populated by session_manager after 3+ confirmed uses: pattern → skill)_ | | 4.0 | 0 | null |

## Scoring Rules
- Task success: score +0.1 (max 5.0)
- CFP logged or friction note written: score -0.5
- score < 2.5: route flagged unreliable → fallback to default skill (`editor`)
- Threshold: pending friction notes for same skill ≥ 2 → alert user before next task
