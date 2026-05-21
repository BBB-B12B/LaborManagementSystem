---
name: Token Auditor
description: Analyzes wasteful token consumption when SESSION_TOTAL > 60k. Identifies root cause and logs optimization lesson.
---

## Sections
```
- id: 1
  name: "Audit"
  steps: ["read session History", "run 3 audit checks", "log lesson to optimization_logs.md", "gate-confirm → inject rule into offending skill"]
```

---

# Token Auditor

## Trigger
Called by R3 when SESSION_TOTAL > 60k. Runs audit before TOKEN PAUSE completes.

## Audit Checks

**Check 1 — Surgical File Reading:**
Look for `Read` calls without `offset/limit` on files > 60 lines → flag as violation of R5.

**Check 2 — Unfiltered CLI Output:**
Check for Bash commands without `| grep | tail` filter → flag as violation of R6.

**Check 3 — Low-Overhead Tooling:**
Check for full-file edits when only a small targeted change was needed → flag as violation of R5 (index-first).

## Actions

1. **Log the Lesson** → append to `docs/optimization_logs.md`:
   ```
   Date: <date> · Session: <session_id>
   Total tokens: ~<N>k
   Root cause: <check that failed>
   Rule injected: <what was added>
   ```

2. **Self-Healing** → if a skill caused the waste:
   - Emit `[gate] token_auditor: inject rule into <skill>/SKILL.md — confirm? y/n` → wait user confirm
   - On confirm: add a STRICT rule to that skill's SKILL.md `## Sections` steps to prevent recurrence.

3. **Halt Threshold** → if SESSION_TOTAL > 90k: set session `"status": "paused_limit_reached"` → HALT → notify user per R3.
