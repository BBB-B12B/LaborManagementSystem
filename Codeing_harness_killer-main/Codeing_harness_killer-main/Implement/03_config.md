## 4. CLAUDE.md Gateway Template

Copy this into `CLAUDE.md` at project root. Adjust token thresholds to match your model's context window.

```markdown
# CLAUDE.md — Agent Gateway Rules

> Read first. Hard constraints.

## Boot
1. Check .sessions/active_thread.md → if phase: in_progress → resume; if done/missing → fresh start
2. Check .sessions/session_handoff.md for pending task
3. Read .sessions/session_tokens.md → load SESSION_TOTAL
4. Load .agents/skills/skill-manifest.json → route to correct skill
5. If SESSION_TOTAL >60k → warn user before starting
6. Reply line 1: **[Boot]** Thread · Tasks · Skill · Loaded

---

## R1 · Token Tracking
Read SESSION_TOTAL once at Boot (B1). Track in working memory each turn.
- Formula: Output = (thai_chars × 1.7) + (en_chars × 0.3)
- Input = (user_msg_chars × 0.3) + context_overhead + (tool_result_chars × 0.3)
- Tool results: classify by file type first — `.md`/`.txt` → split formula; `.ts`/`.js`/`.json` → `× 0.3`; Bash → check for Thai
- Write to file: **end of every response** · token pause · blocked halt · completion gate
- Emit [tokens] trace · append footer every response: `*(Session total: ~NNN tokens)*`
- ⚠️ Do not define token formulas in other skill files — use R1 values exclusively

### Tool Result Measurement

After every tool call with significant output, measure before adding to SESSION_TOTAL:

**Step 1 — Classify by source:**
| Source | Apply |
|---|---|
| `.md`, `.txt`, `.sessions/*` | Split formula — Thai likely |
| `.ts`, `.js`, `.json`, `.sql` | `total × 0.3` — code is English |
| Bash/grep output | Check for Thai presence → use split if found |

**Step 2 — Calculate:**
- `tokens = (thai_chars × 1.7) + ((total_chars − thai_chars) × 0.3)`
- No Thai detected → `tokens = total_chars × 0.3`
- Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×

**Step 3 — Bash char-count pattern** (append to commands with significant output):
```bash
result=$(your_command_here); echo "$result"; \
printf "[chars: total=%s thai=%s]\n" \
  "$(echo "$result" | wc -m)" \
  "$(echo "$result" | grep -oP '[\x{0e00}-\x{0e7f}]' | wc -l 2>/dev/null || echo 0)"
```
Read the `[chars: total=N thai=N]` line → apply Step 2 → add to SESSION_TOTAL → write file.

---

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

---

## R3 · Session Pause
| SESSION_TOTAL | Action |
|---|---|
| >60k | finish current loop step → TOKEN PAUSE |
| >90k | HALT immediately → save state → report to user |

---

## R4 · Sub-agent Decision
Run 1 Bash scope probe before any task.

**Spawn patterns (3 types):**

| Pattern | When | How |
|---|---|---|
| **Explore** | scope ≥ 5 files / ≥ 300 lines | `invoke_subagent` (TypeName: `"research"`) → summary ≤500 tokens → act on summary only |
| **Execution** | single section > 8 steps + isolated output | `invoke_subagent` (TypeName: `"self"`) → pass goal + constraints + output format → receive structured result |
| **Parallel fan-out** | ≥ 2 sections in same Cycle (no dependency) | `invoke_subagent` Subagents[...] (one per section) → each writes `.sessions/cycle_N_<section_id>.json` → read all results → pass as context to next Cycle → single Completion Gate after all Cycles |

**Hard limits:**
- Max depth: 1 level only — worker agents may NOT spawn further agents
- Sub-agent output: structured (JSON or table) — never prose
- Token budget: sub-agent tokens count toward SESSION_TOTAL (no separate budget)
- Parallel spawn: pass all sections as array in single `invoke_subagents` Subagents[] (not sequentially)
- Custom types: use `define_subagent` to register a new TypeName for the session before invoking

---

## R5 · Index-First Lookup

**Pre-Read Gate — emit BEFORE every Read call:**
```
**[pre-read]** Target: `<symbol>` · Tier: T<1|2|3> · Line: <N> · Will read: offset=<N> limit=60
```
Cannot fill Line? → grep not done yet → run grep first.

**Pre-Edit Gate — emit BEFORE every Edit/Write on a named symbol:**
```
**[pre-edit]** Symbol: `<name>` · index_variables lookup: T1 done · used_in: <N files> · safe to edit: <yes|needs review>
```
→ `grep -A 8 '"SymbolName"' knowledge/index_variables.json` → check `used_in` → review all dependents

**Lookup tiers (stop at first that yields line number):**
- T1: `grep -A 8 '"Symbol"' knowledge/index_variables.json` or `index_files.json`
- T2: `grep -B 2 -A 20 '"Symbol"' knowledge/index_variables.json`
- T3: `grep -n "Symbol" src/path/to/file.ts`

T1 partial match (path found but no line number) → proceed to T2. Still no line? → T3.

**Config files load ONCE at Boot (B1–B3) — never re-read mid-session:**
CLAUDE.md · index_files.json · index_variables.json → in working memory after Boot.
Re-read only after TOKEN PAUSE + resume.

| Prohibited | Required instead |
|---|---|
| Read without offset+limit | grep first → get line N → Read offset=N-5 limit=60 |
| Read >60 lines per call | Split into multiple targeted reads |
| Read knowledge/*.json in full | grep specific key only |
| Re-read CLAUDE.md mid-session | Already in working memory |

---

## R6 · Output Filter
Pipe all Bash: `cmd 2>&1 | grep -iE "error|warn|fail" | tail -20`

---

## R7 · Response Density
Default: table/bullet over prose. Comparison → table. Steps → numbered list.

---

## R8 · Index Sync (MANDATORY after every file change)
| Event | Action |
|---|---|
| Create/delete/move file | Update knowledge/index_files.json + backlinks |
| Edit file (add/remove imports) | Update backlinks in knowledge/index_files.json |
| Create/delete/rename symbol | Update knowledge/index_variables.json + run python scripts/symbol_indexer.py |

---

## R9 · Error Protocol
⚠️ MANDATORY 3-step check before any debug:
1. grep knowledge/error_index.md for symptom keyword
2. grep knowledge/index_variables.json for affected symbol
3. grep knowledge/index_files.json for backlinks

New error → Task ID format: `T-{ParentTask}-{BugID}-{AttemptID}` (e.g. `T-004-001-02`)
1. Add `[ ] T-{N}-{BugID}-01: <description>` to roadmap → set `[/]`
2. Fix code
3. Run python scripts/symbol_indexer.py
4. Assign ERR-XXX code
5. Write entry in knowledge/error_index.md (include Task ID + cross-link)
6. Mark roadmap `[X] T-{N}-{BugID}-{Attempt} (→ ERR-XXX)`

---

## R-Roadmap · All work must be logged
Before starting ANY task:
- New feature: `[ ] T-<N>: description`
- Bug fix: `[ ] T-{Parent}-{BugID}-{AttemptID}: description`
- Sub-task: `- [ ] T-<N>.{sub}: description`

Set `[/]` when starting → `[X]` when done.
---

## R19 · Self-Improvement
_Extension only — runs after Completion Gate. Does NOT modify Boot, Loop, or R1–R18._

**Post-task self-eval** — after all Completion Gate boxes checked, before session_manager close:
| check | pass condition |
|---|---|
| `invariant_ok` | No I1–I5 gate tripped unexpectedly during this task |
| `index_ok` | R8 Index Sync completed without error |
| `new_pattern` | No failure type encountered absent from CODING_FAILURE_PATTERNS.md |
| `routing_ok` | Skill used for each section matched skill-manifest.json at the start of that section. Mid-session re-routes via Per-Turn Routing do NOT count as mismatches. |
| `budget_ok` | Tool calls stayed ≤5 per turn throughout this task |

- All pass → no action, proceed to session close
- `new_pattern = true` → trigger CFP Auto-Draft below
- `routing_ok = false` OR `budget_ok = false` → write friction note to `.agents/skill-patches/pending/<skill>-gap-<YYYY-MM-DD>.md` (use `_template.md`), then lower skill score in registry.md by 0.5
- If `new_pattern = true` AND (`routing_ok = false` OR `budget_ok = false`): write CFP draft only — skip friction note

**CFP Auto-Draft** (only when `new_pattern = true`):
1. Write draft → `knowledge/cfp-proposals/CFP-draft-YYYY-MM-DD.md` (Symptom / Root cause / Prevention — same format as existing CFPs)
2. At session close → present to user: "พบ failure pattern ใหม่ — ต้องการเพิ่ม CFP ไหม? (y/n)"
3. Confirm → append to `CODING_FAILURE_PATTERNS.md` with next CFP number → move draft → `knowledge/cfp-proposals/applied/`
4. Decline → move draft → `knowledge/cfp-proposals/applied/` with `status: declined` in frontmatter

**Recipe Notes** — load-on-demand only:
- `knowledge/recipes/<topic>.md` — step-by-step safe procedures for recurring operations
- Load only when task matches topic — never load all recipes at Boot
- Add recipe when: operation repeats ≥ 2 times AND has a related CFP

**Safety:**
- Never modify `CODING_FAILURE_PATTERNS.md` directly — always wait for user confirm (extends CFP-004)
- Never run R19 self-eval before Completion Gate passes
- Prefer false-negative over false-positive when uncertain about new_pattern

```

---

## 11. AGENTS.md Template (Generic Harness)

Copy this file verbatim to `AGENTS.md` at project root.
Fill in `[PROJECT NAME]` and add project-specific rules in the placeholder at the bottom.

```markdown
<!-- BEGIN:agent-orientation -->
# Agent Orientation — Read Before Acting

You are operating inside the **[PROJECT NAME]** project. Rules apply to ALL agents regardless of vendor.

> **Full hard constraints → `CLAUDE.md`** · **Destructive gates → `INVARIANTS.md`** · **Repo structure → `REPO_MAP.md`**

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill_name
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files
```

- B1 always resets SESSION_TOTAL to 0 on every Boot — every new conversation starts fresh
- If SESSION_TOTAL > 60k → warn user before proceeding

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: <name> · Sections: <N> · Tokens: ~<N>k`

---

## Per-Turn Routing (every user message)

| Situation | Action |
|---|---|
| User asks to fix a bug | Re-route → `editor` |
| User says "close/done/end session" | Re-route → `session_manager` |
| User asks to create a new file | Re-route → `coder` |
| User asks to orchestrate multi-step task | Re-route → `agent` |
| User asks about session/identity state | Re-route → `identity` |
| token threshold exceeded | Re-route → `token_auditor` |
| Same task type | Stay on current skill |

**Same session ≠ same skill.** Always check intent → re-read SKILL.md if skill changes.

---

## Loop Architecture

| Phase | What happens |
|---|---|
| 1 Info Gather | Repeat: identify missing context → index-first → assess → emit [✓ gather] |
| 2 MECE Plan | Build plan (1:1 Skill sections) → Verify-N per section → user confirms → roadmap |
| 3 | Execution | Cycle Gate → group sections into Cycles → CYCLE LOOP: spawn Cycle N parallel → await → read cycle_N_*.json → spawn Cycle N+1 → Completion Gate |

**Phases 1–2 run ONCE per task. On resume: skip to Phase 3 at pending section.**

Completion Gate:
```
□ All sections executed  □ Writes [✓ written]  □ Index Sync
□ Roadmap [X]           □ phase: done          □ SESSION_TOTAL written → .sessions/session_tokens.md
```

---

## Backlink Rule

Before editing any file:
```bash
grep -A 6 '"src/path/to/file"' knowledge/index_files.json
```
Check `backlinks[]` — every file listed imports the file you are about to edit. Update all of them.

---

## Quick Reference

| Rule | Requirement |
|---|---|
| Token footer | Every response: `*(Session total: ~NNN tokens)*` |
| File reads | grep index first → Read offset+limit only (never full file >60 lines) |
| Symbol edits | grep index_variables → check used_in → emit [pre-edit] |
| Destructive actions | INVARIANTS.md §I1 — emit [gate] and wait confirm |
| Error protocol | error_index → symbol_index → file_index (all 3 in order) |
| Roadmap | Every task logged before execution. `[ ]` → `[/]` → `[X]` |
| Session close | route `session_manager` — writes: `active_thread.md` · `session_tokens.md` · `session_handoff.md` · session JSON · `master_roadmap.md` → SESSION_TOTAL: 0 |
| Topic switch | New task = new session JSON — never carry raw History across tasks |

---

## Reference Files

| File | Purpose |
|---|---|
| `INVARIANTS.md` | Destructive gates (I1) + hard stops (I2) |
| `REPO_MAP.md` | Directory layers, protected zones, quick lookup commands |
| `CODING_FAILURE_PATTERNS.md` | Known agent failure modes (fill as bugs occur) |
| `knowledge/error_index.md` | ERR-XXX error log (search first before any debug) |
| `docs/master_roadmap.md` | Task checklist |

---

## Critical Project-Specific Rules

<!-- EDIT: Add hard rules specific to this project's stack.
     Examples:
     - Database constraints (no multi-row inserts, no upsert on conflict, no float in int columns)
     - Runtime constraints (no Node.js APIs in edge runtime, WebCrypto only)
     - Parsing rules (always use library X, never manual split)
     Reference INVARIANTS.md for destructive-action gates. -->
<!-- END:agent-orientation -->
```

---

## 12. INVARIANTS.md Skeleton

Copy to `INVARIANTS.md`. Fill in I2 with project-specific hard stops.

```markdown
# INVARIANTS.md — Destructive Action Gates

> Hard stops for this project. Every AI agent must check this file before any irreversible action.

---

## I1 · Destructive Action Gate

Before any of these actions → emit `[gate]` → ask user → wait for explicit "yes":

- Deleting files or directories
- Overwriting existing data (DB write, file overwrite, bulk update)
- Running `rm`, `drop`, `truncate`, `DELETE` without scoped WHERE
- `git reset --hard`, `git push --force`, `git checkout --`

---

## I2 · Hard Stop Rules

<!-- EDIT: Add project-specific rules that must never be violated.
     Examples:
     - NO multi-row INSERT (insert one row at a time)
     - NO onConflictDoNothing() — silent failures in test environments
     - NO float in integer columns — always Math.round()
     - NO Node.js APIs in edge runtime
     - NO manual CSV split(",") — always use PapaParse / csv-parse
-->

---

## I3 · Knowledge Index Sync

After any symbol create/delete/rename → MUST update both indexes before closing task:
- `knowledge/index_variables.json` — symbol entry + line numbers
- `knowledge/index_files.json` — backlinks

Run: `python scripts/symbol_indexer.py` to regenerate.

---

## I4 · Pre-Edit Symbol Check (Required)

Before editing any symbol that appears in `knowledge/index_variables.json`:
```bash
grep -A 8 '"SymbolName"' knowledge/index_variables.json   # check used_in array
```
Emit and log:
```
[pre-edit] Symbol: `<name>` · used_in: <N files> · safe to edit: <yes|needs review>
```

## I5 · Roadmap Entry Required

Every task (bug fix, feature, enhancement) must exist in `docs/master_roadmap.md` before execution.
Never duplicate task IDs. grep roadmap before creating.

---

## Protected Zones

<!-- EDIT: List files/directories that must NEVER be overwritten without user confirmation.
     Examples:
     - CLAUDE.md · AGENTS.md · INVARIANTS.md — system files
     - docs/master_roadmap.md — task ledger
     - knowledge/index_files.json · knowledge/index_variables.json — indexes
     - db_migrations/ — never edit manually; use migration tooling only
-->
```

---

## 13. REPO_MAP.md Skeleton

Copy to `REPO_MAP.md`. Fill in directory layout and project-specific zones.

```markdown
# REPO_MAP.md — Repository Structure & Protected Zones

---

## Directory Layout

```
<!-- EDIT: Document your project's source tree here. Example:
src/
├── app/           # Next.js app router pages
├── components/    # Shared UI components
├── lib/           # Utilities and helpers
└── db/            # Database schema and queries
-->

knowledge/         # Agent indexes — managed by agent + symbol_indexer.py
.agents/skills/    # Skill definitions
.sessions/         # Session state
docs/              # Roadmap and logs
scripts/           # Automation scripts (symbol_indexer.py)
```

---

## Protected Zones

| Path | Rule |
|---|---|
| `knowledge/` | Never delete manually — managed by agent |
| `.sessions/` | Never delete manually — session state |
| `docs/master_roadmap.md` | Edit only via agent workflow (`[ ]` → `[/]` → `[X]`) |

<!-- EDIT: Add project-specific protected zones -->

---

## Quick Lookup Commands

```bash
# Find file by name
find src/ -name "*.ts" | grep "keyword"

# Find symbol definition
grep -rn "export.*FunctionName" src/

# Check who imports a file
grep -A 6 '"src/path/to/file"' knowledge/index_files.json

# Find all usages of a symbol
grep -rl "SymbolName" src/
```

<!-- EDIT: Add project-specific module boundaries and lookup patterns -->
```

---

## skill-manifest.json Template

Copy to `.agents/skills/skill-manifest.json`. Add or remove skills to match your project.

```json
{
  "version": "2.0",
  "default_skill": "editor",
  "skills": {
    "editor": {
      "path": ".agents/skills/editor/SKILL.md",
      "keywords": ["แก้", "fix", "bug", "edit", "debug", "เปลี่ยน", "ปรับ", "อัปเดต", "update", "modify"]
    },
    "coder": {
      "path": ".agents/skills/coder/SKILL.md",
      "keywords": ["สร้าง", "create", "new file", "implement", "feature", "add", "เพิ่ม"]
    },
    "file_manager": {
      "path": ".agents/skills/file_manager/SKILL.md",
      "keywords": ["move", "rename", "delete file", "restructure", "ย้าย", "ลบ", "เปลี่ยนชื่อ"]
    },
    "variable_manager": {
      "path": ".agents/skills/variable_manager/SKILL.md",
      "keywords": ["rename symbol", "refactor", "export", "symbol", "function name"]
    },
    "session_manager": {
      "path": ".agents/skills/session_manager/SKILL.md",
      "keywords": ["จบ session", "close", "end session", "สรุป session", "ปิด session"]
    },
    "mece": {
      "path": ".agents/skills/mece/SKILL.md",
      "keywords": ["plan", "วางแผน", "mece", "orchestrate", "phases"]
    },
    "agent": {
      "path": ".agents/skills/agent/SKILL.md",
      "keywords": ["orchestrate", "multi-step", "coordinate", "spawn", "จัดการหลายขั้นตอน", "cycle", "fan-out", "orchestrate cycles"]
    },
    "identity": {
      "path": ".agents/skills/identity/SKILL.md",
      "keywords": ["identity", "session state", "who am i", "current skill", "ตัวตน"]
    },
    "token_auditor": {
      "path": ".agents/skills/token_auditor/SKILL.md",
      "keywords": ["token limit", "context full", "approaching limit", "token threshold"]
    },
    "token_tracker": {
      "path": ".agents/skills/token_tracker/SKILL.md",
      "keywords": ["token count", "session total", "how many tokens", "นับ token"]
    }
  }
}
```

---

## registry.md Template

Copy to `.agents/skills/registry.md`. Human-readable fallback routing table.

```markdown
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
```

---

## docs/master_roadmap.md Template

Copy to `docs/master_roadmap.md`. Replace `[PROJECT NAME]` and add feature sections.

```markdown
# Master Project Roadmap: [PROJECT NAME]

> **📌 CURRENT ACTIVE FOCUS:** Phase 1 - Project Initialization & Architecture Setup
> **📊 OVERALL PROGRESS:** 0%

---

## 📚 System Documentation (Governance)
- `docs/master_roadmap.md`: แผนงานหลัก (อัปเดตตลอด)
- `docs/domain_rules.md`: กฎและ Business Logic ที่ตายตัว
- `knowledge/error_index.md`: แหล่งรวมความรู้สำหรับแก้ Bug และ Error

---

## 🖥️ Phase 1: Project Foundation

### Feature 1.1: Core Setup
- [X] T-000: ติดตั้งระบบ Agent และโครงสร้างพื้นฐาน

<!-- Add feature sections below. Format:
### Feature N.N: Name
- [ ] T-001: description (session_NNN)
- [/] T-002: in progress (session_NNN)
- [X] T-003: done (session_NNN)
-->

---

### 🐛 Bug & Error Task Format Reference
> **Format:** `{TaskID}-{BugID}-{AttemptID}`
> **Example:** `T-004-001-02`

---
> **Status:** `[ ]` (ยังไม่เริ่ม) → `[/]` (กำลังทำ/รอตรวจ) → `[X]` (เสร็จ/ตรวจผ่าน)
```

---

## CODING_FAILURE_PATTERNS.md Template

Copy to `CODING_FAILURE_PATTERNS.md` at project root. Agent adds entries whenever a bug requires ≥2 fix attempts.

```markdown
# Coding Failure Patterns

> Agent adds an entry here whenever a fix requires ≥2 attempts. Search this file before attempting any similar fix.

---

<!-- Entry format:
## CFP-NNN · [Short title]
- **Symptom:** What the error looks like / what went wrong
- **Root Cause:** Why it happens (the real reason, not the surface error)
- **Wrong approach:** What was tried first (and why it failed)
- **Resolution:** The correct fix
- **Files affected:** src/path/to/file.ts
- **Task:** T-NNN-NNN · Session: session_NNN
-->
```

---

## Trace Token Reference

All valid trace tokens agents must emit. Include in `CLAUDE.md` Quick Reference.

| Token | When to emit |
|---|---|
| `**[Boot]**` | First line of every session response |
| `**[pre-read]**` | Before every file read (index-first lookup) |
| `**[pre-edit]**` | Before editing any symbol — after used_in check |
| `**[gate]**` | Before any destructive action (I1) — wait for confirm |
| `**[db-gate]**` | Before any DB schema change (I2) — wait for confirm |
| `**[R8]**` | After file create/edit/delete — running symbol_indexer.py |
| `**[loop]**` | After each MECE section completes |
| `**[resume]**` | When resuming an in_progress thread |
| `**[tokens]**` | Token checkpoint (A=before, B=after, C=final) |
| `**[MECE]**` | MECE plan sent to user — waiting confirm |

---
