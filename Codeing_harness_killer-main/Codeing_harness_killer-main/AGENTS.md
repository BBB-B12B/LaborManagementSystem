<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

<!-- BEGIN:agent-orientation -->
# Agent Orientation — Read Before Acting

You are operating inside the **Asset Plan** project. Rules apply to ALL agents regardless of vendor.

> **Full hard constraints → `CLAUDE.md`** · **Destructive gates → `INVARIANTS.md`** · **Repo structure → `REPO_MAP.md`**

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); [ "$phase" != "in_progress" ] && printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill_name
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files
```

- B1 auto-resets SESSION_TOTAL to 0 when phase ≠ in_progress
- If SESSION_TOTAL > 60k → warn user before proceeding

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: <name> · Sections: <N> · Tokens: ~<N>k`

---

## Per-Turn Routing (every user message)

| Situation | Action |
|---|---|
| User asks to fix a bug | Re-route → `editor` |
| User says "ปิด session" | Re-route → `session_manager` |
| User asks to create a new file | Re-route → `coder` |
| Same task type | Stay on current skill |

**Same session ≠ same skill.** Always check intent → re-read SKILL.md if skill changes.

---

## Loop Architecture

| Phase | What happens |
|---|---|
| 1 Info Gather | Repeat: identify missing context → R5 index-first → assess → emit [✓ gather] |
| 2 MECE Plan | Build plan (1:1 Skill sections) → Verify-N per section → user confirms → roadmap |
| 3 Execution | REACT LOOP: Select → Execute → Observe → Verify → Decide |

Completion Gate:
```
□ All sections executed  □ Writes [✓ written]  □ R8 Index Sync
□ Roadmap [X]           □ phase: done          □ SESSION_TOTAL written → .sessions/session_tokens.md
```

---

## Backlink Rule

Before editing any file:
```bash
grep -A 6 '"src/path/to/file.tsx"' knowledge/index_files.json
```
Check `backlinks[]` — every file listed imports the file you are about to edit. Update all of them.
→ Full dependency rules: **REPO_MAP.md** · Gates: **INVARIANTS.md**

---

## Quick Reference

| Rule | Requirement |
|---|---|
| Token footer | Every response: `*(Session total: ~NNN tokens)*` |
| File reads | grep index first → emit [pre-read] → Read offset+limit=60 |
| Symbol edits | grep index_variables → check used_in → emit [pre-edit] |
| Destructive actions | INVARIANTS.md §I1 — emit [gate] and wait confirm |
| DB changes | INVARIANTS.md §I2 — emit [db-gate] and HALT |
| Error protocol | R9: error_index → symbol_index → file_index (all 3 in order) |
| Roadmap | Every task logged before execution. `[ ]` → `[/]` → `[X]` |
| Manual close | "ปิด/close/done" → route `session_manager` §3 — 5 file writes + SESSION_TOTAL reset to 0 |
| Topic switch | New task = new session JSON — never carry raw History across tasks |

## Sub-agent Rules (R4)

| Pattern | When to use |
|---|---|
| Explore | scope ≥ 5 files / ≥ 300 lines → summary only |
| Execution | section > 8 steps + isolated output → structured result |
| Parallel fan-out | ≥ 2 sections in same Cycle → spawn simultaneously → write `.sessions/cycle_N_*.json` |
| Cycle transition | All sections in Cycle N done → read results → inject as context → spawn Cycle N+1 |

**Limits:** Max depth = 1 · Output must be structured (write `.sessions/cycle_N_<id>.json`) · Tokens count toward SESSION_TOTAL
**Before spawning:** emit `**[cycle N]** <spawn_tool> [<A>,<B>] → .sessions/cycle_N_*.json · depends-on: <none | cycle_N-1>`
**Platform:** read `.agents/platform/detected.md` for spawn_tool · if `platform: unknown` → run B4 probe first
**HALT rule:** Any section in Cycle N blocked → do NOT spawn Cycle N+1 → session_manager BLOCKED flow
**Full rules:** `CLAUDE.md §R4`

---

## Reference Files

| File | Purpose |
|---|---|
| `INVARIANTS.md` | Destructive gates (I1) + DB hard stop (I2) + symbol check (I4) |
| `REPO_MAP.md` | Directory layers, protected zones, quick lookup commands |
| `CODING_FAILURE_PATTERNS.md` | Known agent failure modes (CFP-001+) |
| `knowledge/error_index.md` | ERR-XXX error log (search first before any debug) |
| `docs/master_roadmap.md` | Task checklist |

---

## Critical Project-Specific Rules

- **Miniflare D1 (local):** No `onConflictDoNothing()` or multi-row INSERT — silent failures. Use SELECT+filter+single-row-insert. (ERR-007)
- **Edge Runtime:** No Node.js APIs. WebCrypto only.
- **CSV parsing:** Always PapaParse — never `split(",")` manually.
<!-- END:agent-orientation -->
