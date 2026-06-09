# 09 — Migration Guide (Old Harness → Current Version)

> Use this guide when a project already has an older version of the harness installed.
> Do NOT use for fresh projects — use Track A in `02_setup.md` instead.

## When to use

| Signal | Action |
|---|---|
| `.agents/skills/` exists but skill files have no `## Trigger` block | → this guide |
| `knowledge/` indexes have old schema (missing `topics[]`, `backlinks[]`) | → this guide |
| `.sessions/` has `chat_tokens.md` instead of `session_tokens.md` | → this guide |
| Tree structure doesn't match `REPO_MAP.md` | → this guide |
| Harness files present but 08_checklist fails ≥3 sections | → this guide |

---

## Track C — Upgrade Existing Harness

### Overview (4 tracks — run in order)

| Track | What | Scope |
|---|---|---|
| M1 | Re-format indexes to current schema | `knowledge/index_files.json` · `index_variables.json` · `index_cfp_fix.json` · `.sessions/session_tokens.md` |
| M2 | Re-structure harness tree (harness dirs only) | `.sessions/` · `docs/session_templates/` · `.agents/platform/` · `scripts/` |
| M3 | Update / overwrite skills + config | All `SKILL.md` files · `CLAUDE.md` · `AGENTS.md` · `Implement/` |
| M4 | Verify | Run `08_checklist.md` section-by-section |

> ⚡ Never touch `src/` during M1–M3. Only harness files.

---

## M1 — Re-format Indexes

### M1.1 · session_tokens.md (was chat_tokens.md)

```bash
# Check which file exists
ls .sessions/ | grep -E "chat_tokens|session_tokens"

# If chat_tokens.md exists → migrate
CHAT=$(grep "CHAT_TOTAL:" .sessions/chat_tokens.md 2>/dev/null | awk '{print $2}')
SESSION=$(grep "SESSION_TOTAL:" .sessions/chat_tokens.md 2>/dev/null | awk '{print $2}')
printf "SESSION_TOTAL: ${SESSION:-0}\nCHAT_TOTAL: ${CHAT:-7300}\n" > .sessions/session_tokens.md
rm .sessions/chat_tokens.md
echo "✓ session_tokens.md written"
```

Verify: `cat .sessions/session_tokens.md` → shows both `SESSION_TOTAL:` and `CHAT_TOTAL:` lines

### M1.2 · index_files.json — add missing fields

Check current schema:
```bash
python3 -c "
import json
d = json.load(open('knowledge/index_files.json'))
first = next(iter(d.values()), {})
missing = [k for k in ['topics','backlinks','references','related'] if k not in first]
print('Missing fields:', missing or 'none')
print('Entry count:', len(d))
"
```

If missing fields found → run backlink analyzer (adds `related[]` + any missing structure):
```bash
python3 scripts/backlink_analyzer.py
```

If `topics[]` missing on entries → add manually using closed list from `knowledge/topic_registry.json`:
```bash
python3 -c "
import json
reg = json.load(open('knowledge/topic_registry.json'))
print('Available topics:', list(reg.keys()))
"
```
Then edit each entry to add `\"topics\": [\"<matching-topic>\"]`.

Verify: `python3 -c "import json; d=json.load(open('knowledge/index_files.json')); print('OK:', len(d), 'entries')"` → no error

### M1.3 · index_variables.json — re-run indexer

```bash
python3 scripts/symbol_indexer.py
```

Verify: `python3 -c "import json; d=json.load(open('knowledge/index_variables.json')); print('symbols:', len(d))"` → ≥0 (no crash)

### M1.4 · index_cfp_fix.json — check schema

```bash
python3 -c "
import json
try:
    d = json.load(open('knowledge/index_cfp_fix.json'))
    print('entries:', len(d), '· schema ok')
except Exception as e:
    print('ERROR:', e)
"
```

If JSON invalid → inspect + fix manually. Expected schema per entry:
```json
{
  "cfp_id": "CFP-NNN",
  "title": "...",
  "discovered": "YYYY-MM-DD",
  "fixed_in": "T-NNN",
  "signals": ["..."],
  "fix": "..."
}
```

---

## M2 — Re-structure Harness Tree

### M2.1 · Required directories

```bash
mkdir -p .sessions docs/session_templates .agents/platform .agents/skills .agents/tools
mkdir -p scripts knowledge
echo "✓ directories checked"
```

### M2.2 · Required session files

```bash
# active_thread.md
[ -f .sessions/active_thread.md ] || printf "task: \nphase: done\nnext: \n" > .sessions/active_thread.md

# session_tokens.md (if not migrated in M1.1)
[ -f .sessions/session_tokens.md ] || printf "SESSION_TOTAL: 0\nCHAT_TOTAL: 7300\n" > .sessions/session_tokens.md

# compact_state.md (create blank if missing)
[ -f .sessions/compact_state.md ] || printf "dt=\ns=0k\ntask=none\ncfp=0\nsk=\nsk_h=\nmece_h=\np1=\np2=\np3=\nsection=\nstep=\nresume_at=none\n" > .sessions/compact_state.md

echo "✓ session files checked"
```

### M2.3 · mece_plan_schema.md template

```bash
[ -f docs/session_templates/mece_plan_schema.md ] \
  && echo "✓ mece_plan_schema.md present" \
  || echo "MISSING — copy from current harness repo: docs/session_templates/mece_plan_schema.md"
```

If missing: copy the file from the current harness version source.

### M2.4 · Platform detected.md

```bash
[ -f .agents/platform/detected.md ] \
  && echo "✓ detected.md present" \
  || echo "platform: unknown" > .agents/platform/detected.md && echo "created blank detected.md"
```

B4 will auto-detect and fill on next boot.

### M2.5 · scripts/lookup.py + session_indexer.py

```bash
ls scripts/ | grep -E "lookup.py|session_indexer.py|symbol_indexer.py|backlink_analyzer.py"
```

Missing scripts → copy from current harness repo `scripts/` directory.

---

## M3 — Update / Overwrite Skills + Config

> Strategy: overwrite all harness files with current versions. Preserve `src/`, user data, session history.

### M3.1 · Files to OVERWRITE (copy from current harness)

```
CLAUDE.md                              ← full overwrite (not src-specific)
AGENTS.md                              ← full overwrite
CODING_FAILURE_PATTERNS.md            ← merge: keep user's existing CFPs, append new ones
INVARIANTS.md                          ← merge: keep §I2 user rules, overwrite §I1 harness rules
REPO_MAP.md                            ← regenerate (run auto-discovery step in 02_setup.md §8 Step 2.5)
.agents/skills/*/SKILL.md             ← overwrite each (behavioral contract format required)
.agents/skills/skill-manifest.json    ← overwrite
.agents/skills/registry.md            ← overwrite
Implement/                             ← overwrite all files (00–09)
docs/master_roadmap.md                ← merge: keep completed [X] entries, add new tasks
knowledge/harness_flow_*.md           ← overwrite (keep Y-entries as history log)
```

### M3.2 · Files to PRESERVE (do not touch)

```
src/                                   ← never touch
knowledge/index_files.json            ← preserve + update schema (M1)
knowledge/index_variables.json        ← preserve + re-run indexer (M1)
knowledge/error_index.md              ← preserve (user's bug history)
.sessions/session_*.json              ← preserve (session history)
.sessions/session_tokens.md           ← preserve (migrated in M1.1)
```

### M3.3 · Skill overwrite procedure

For each SKILL.md:
```bash
# Before overwriting — check current line count
wc -l .agents/skills/<skill_name>/SKILL.md

# Overwrite with current version (copy from harness repo)
cp <harness_repo>/.agents/skills/<skill_name>/SKILL.md .agents/skills/<skill_name>/SKILL.md

# Verify 5-element behavioral contract intact
grep -c "## Trigger\|## Refusal\|## Workflow\|## Output Contract\|## Routing" \
  .agents/skills/<skill_name>/SKILL.md
# → must be ≥5
```

### M3.4 · Add new skills not in old version

Skills added since v1:
```
harness_editor   ← Step 5 gate + MECE plan enforcement
harness_doctor   ← CFP detection + self-repair
session_manager  ← 5-file close sequence
```

Create directories + copy SKILL.md + SKILL_detail.md for each:
```bash
for skill in harness_editor harness_doctor session_manager; do
  mkdir -p .agents/skills/$skill
  cp <harness_repo>/.agents/skills/$skill/SKILL.md .agents/skills/$skill/SKILL.md
  [ -f <harness_repo>/.agents/skills/$skill/SKILL_detail.md ] && \
    cp <harness_repo>/.agents/skills/$skill/SKILL_detail.md .agents/skills/$skill/SKILL_detail.md
  echo "✓ $skill installed"
done
```

Then update `skill-manifest.json` + `registry.md`:
```bash
# Verify new skills appear in manifest
grep -l "harness_editor\|harness_doctor\|session_manager" .agents/skills/skill-manifest.json
```

### M3.5 · Merge CODING_FAILURE_PATTERNS.md

```bash
# Count existing CFPs before merge
grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md

# Append new CFPs from current harness (manually copy entries not already present)
# Identify by CFP-ID — never duplicate
```

---

## M4 — Verify (Run 08_checklist.md)

After M1–M3 complete, run the post-installation verification:

```bash
# Quick summary scan
python3 -c "
import subprocess, re
files = [
    'CLAUDE.md','AGENTS.md','INVARIANTS.md','REPO_MAP.md',
    '.agents/skills/skill-manifest.json','.agents/skills/registry.md',
    'knowledge/index_files.json','knowledge/index_variables.json',
    'knowledge/harness_flow_20260526.md',
    '.sessions/active_thread.md','.sessions/session_tokens.md',
    '.agents/platform/detected.md',
    'docs/session_templates/mece_plan_schema.md',
    'docs/master_roadmap.md','CODING_FAILURE_PATTERNS.md',
]
import os
for f in files:
    status = '✓' if os.path.exists(f) else '✗ MISSING'
    print(f'{status}  {f}')
"
```

Then open `Implement/08_checklist.md` and run each section's grep commands in order.

**M4 pass criteria:**
- Zero `✗ MISSING` files
- 08_checklist §1–§9: no FAIL items
- `grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md` matches CFP_COUNT at boot

---

## Rollback Plan

If M3 overwrites cause breakage:
1. `git stash` or `git checkout -- <file>` to restore any overwritten file
2. Re-run M3 for that file only
3. Re-run M4 to verify

> Always commit before starting M3: `git add -A && git commit -m "pre-migration snapshot"`

---

## M5 — T-067+T-068 Migration (Loop Weight + Behavior Contract)

Apply after completing M1–M4 when upgrading an existing harness to include LOOP_WEIGHT tracking, PostToolUse hook, and C0.5 BC gate.

### Step 1 — session_tokens.md: add TURN_COUNT + LOOP_WEIGHT fields

```bash
grep -c "TURN_COUNT\|LOOP_WEIGHT" .sessions/session_tokens.md
# Expected pre-T-067: 0 → need to add both
```

Add missing fields:
```bash
grep -q "TURN_COUNT" .sessions/session_tokens.md || echo "TURN_COUNT: 0" >> .sessions/session_tokens.md
grep -q "LOOP_WEIGHT" .sessions/session_tokens.md || echo "LOOP_WEIGHT: 0" >> .sessions/session_tokens.md
```

Verify: `grep -c "TURN_COUNT\|LOOP_WEIGHT" .sessions/session_tokens.md` → 2

### Step 2 — PostToolUse hook: add to .claude/settings.json

```bash
python3 -m json.tool .claude/settings.json 2>/dev/null | grep -c "PostToolUse"
# 0 → add hook; ≥ 1 → skip
```

Add PostToolUse event under `hooks` in `.claude/settings.json` — weight table: Agent/Workflow/WebFetch/WebSearch=3 · Write/mcp__*=2 · all others=1.

Verify: `python3 -m json.tool .claude/settings.json | grep -c "PostToolUse"` → ≥ 1

### Step 3 — AGENTS.md: verify C0.5 BC gate present

```bash
grep -c "\[C0\.5\]" AGENTS.md
# 0 → add between [C0] and [C1] in Per-Turn Routing
```

C0.5 must use full Behavior Contract (Pre/Contract/Post/Enforce) with >30/50 thresholds per AGENTS.md §Per-Turn Routing spec.

### Step 4 — compact_checkpoint awareness for existing mece_plans

For existing mece_plan.md with ≥3 sections predating T-067 — insert `/compact checkpoint` after `ceil(N/2)` section in Sequential line + matching `- [ ] /compact checkpoint` in Steps.

Formula: `sections ≥ 3 OR (sections × 6) > 30 → insert after ceil(N/2)`

### Step 5 — error_index.md: migrate entries to new schema + add BC hooks

Each existing ERR-XXX entry must be converted to new schema (topic/problem/trigger/fix/it_work/occurrences/failed_approaches).

```bash
grep -c "^## ERR-" knowledge/error_index.md  # count entries to migrate
grep -c "^topic:" knowledge/error_index.md   # 0 → need migration · ≥1 → already migrated
```

Add BC enforcement blocks to CLAUDE.md R9 (if not already present):
```bash
grep -c "BC-topic-lookup\|BC-active-fix" CLAUDE.md  # → ≥ 2 (one per BC block)
```

**Behavior Contract — Topic Lookup (fires before writing any new ERR-XXX entry):**
```
Pre:    new ERR-XXX being documented
Contract: grep knowledge/error_topics.md for matching topic id
          match found → set topic: <id> · proceed
          no match → emit [topic-missing] domain:<desc> · add topic to error_topics.md first · then write entry
Post:   every ERR-XXX entry has a valid topic: field from error_topics.md
Enforce: entry without topic: field = [violation] BC-topic-lookup → add topic before continuing
```

**Behavior Contract — Active Fix (fires when it_work=false entry found during debug):**
```
Pre:    grep error_index.md for ERR-XXX → entry found with it_work: false
Contract: MUST read failed_approaches: list → choose approach NOT in that list
          emit [active-fix] ERR-XXX · Avoiding: <prior> · Trying: <new approach>
          after fix confirmed → update it_work: true + append to occurrences:
Post:   [active-fix] emitted before any fix attempt · entry updated on success
Enforce: debug without reading failed_approaches = [violation] BC-active-fix → read first · re-attempt
```

Verify: `grep -c "^topic:" knowledge/error_index.md` → = entry count · `grep -c "it_work:" knowledge/error_index.md` → = entry count

### Step 6 — Verify all M5 steps

```bash
grep -c "TURN_COUNT\|LOOP_WEIGHT" .sessions/session_tokens.md  # → 2
python3 -m json.tool .claude/settings.json 2>/dev/null | grep -c "PostToolUse"  # → ≥ 1
grep -c "\[C0\.5\]" AGENTS.md  # → ≥ 1
grep -c "Loop_W" CLAUDE.md  # → ≥ 1
grep -c "BC-topic-lookup\|BC-active-fix" CLAUDE.md  # → ≥ 2
grep -c "^topic:" knowledge/error_index.md  # → = ERR entry count
```
