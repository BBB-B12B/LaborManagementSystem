## 14. Orchestrator Protocol — Dual-Mode Execution

Two modes — identical file format, different execution:
- **Mode A (spawn capable):** Orchestrator writes `mece_plan.md` → spawns sub-agents per section
- **Mode B (no spawn / single model):** Orchestrator writes `mece_plan.md` → loops as sub-agent in same session or resumes in new chat

---

### 14a. `.sessions/mece_plan.md` — Schema

Orchestrator writes this file at **end of Phase 2 BEFORE user confirm**. Never cleared by model — only by `"จบ session"` command.

```markdown
# MECE Plan — <Task Name>
Created: <YYYY-MM-DD> | Last updated: <YYYY-MM-DD HH:MM>
Status: in_progress | Budget: Used ~0k / Limit 50k

## Cycles
  Cycle 1: [S1, S2]
  Cycle 2: [S3]
  # S3 context-input: cycle_1_S1.json, cycle_1_S2.json

## Sections
- [ ] S1: <task description>
      Skill: editor
      Context: [knowledge/index_variables.json, src/path/to/file.ts]
      DoD: `grep -c "keyword" src/path/to/file.ts` → expected: 1
      Est: ~8k tokens

- [ ] S2: <task description>
      Skill: file_manager
      Context: [knowledge/index_files.json]
      DoD: `grep "new-entry" knowledge/index_files.json` → expected: found
      Est: ~4k tokens

## Continuation Prompt
Resume: read .sessions/mece_plan.md → find first [/] or [ ] → execute as sub-agent

## Session Archive
<!-- session_manager appends closed-plan summaries here -->
```

**Section status markers:**

| Marker | Meaning |
|---|---|
| `[ ]` | Not started |
| `[/]` | In progress — mark before first tool call |
| `[X]` | Done — mark after DoD verify passes |

---

### 14b. Boot Detection

B1 must check mece_plan.md after reading active_thread.md:

```bash
pending=$(grep -cE "^\- \[[ /]\]" .sessions/mece_plan.md 2>/dev/null || echo "0")
current_cycle=$(grep "^current_cycle:" .sessions/session_handoff.md 2>/dev/null | awk '{print $2}')
# On resume: start from current_cycle, not from section 1
```

| pending | phase | Boot action |
|---|---|---|
| > 0 | in_progress | Skip Phase 1+2 → resume Phase 3 at first `[/]` or `[ ]` |
| > 0 | done | Ask: "มีแผนค้าง `<N>` sections — ทำต่อ (resume) หรือล้างแผน (clear)?" |
| 0 | any | Normal boot — fresh start |

---

### 14c. Sub-agent Loop Logic

```
Cycle-aware loop:
  1. FIND first Cycle with any [/] or [ ] section
     ไม่มีเลย (ทุก [X]) → session_manager close flow
  2. SPAWN all sections in that Cycle in parallel (one message)
  3. Each agent writes .sessions/cycle_N_<section_id>.json
  4. AWAIT all agents in Cycle N
  5. CHECK: all status=done? → read results → build context → advance to Cycle N+1
             any status=blocked? → HALT all pending Cycles → BLOCKED flow
  6. TOKEN GATE: next_est = sum of Est for ALL sections in next Cycle
     remaining > next_est AND pending > 0  →  spawn next Cycle immediately
     remaining ≤ next_est AND pending > 0  →  บอก user "เปิด chat ใหม่ + paste Continuation Prompt"
     pending = 0                            →  session_manager close flow
  7. REPEAT from step 1 for next Cycle
```

---

### 14d. "จบ session" Clear Flow

Triggered by: `"จบ session"` / `"clear plan"` / `"ล้างแผน"` / `"สรุป session"`

```
1. อ่าน mece_plan.md → สรุป done/remaining
2. Append to Session Archive:
   ### Closed: <date>
   Done: [S1, S2] | Remaining: [S3, S4] | Summary: <one-line>
3. อัปเดต active_thread.md → phase: done
4. เขียน Sections ใน mece_plan.md ใหม่เป็น template ว่าง
5. บอก user: "ปิดแผน '<Task Name>' แล้ว — Chat ใหม่ได้เลย"
```

**Template หลัง clear:**

```markdown
# MECE Plan — (empty)
Status: ready
<!-- Orchestrator will write here at next Phase 2 -->

## Session Archive
<!-- previous plans archived below -->
```

---

### 14e. Token Budget Guidelines

| Section Est | Max sections per chat (50k limit, ~5k boot overhead) |
|---|---|
| ~4k | 10 sections |
| ~8k | 5 sections |
| ~12k | 3 sections |
| >15k | must split into smaller sections |
