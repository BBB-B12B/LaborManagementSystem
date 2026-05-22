# Implement/08_checklist.md — Post-Installation Verification Checklist

> Run this checklist after completing Track A or Track B setup.
> For each item: run the Verify command → if it fails → follow the Fix action.
> All commands run from `[PROJECT_ROOT]` (the directory containing CLAUDE.md).

**Total required files: 22**
(10 skill files + 3 config + 2 routing + 1 platform + 3 knowledge + 1 script + 1 docs + 1 failure patterns)

> Note: `02_setup.md §9` has a flat checkbox list. This file adds per-section grep verification and fix actions that §9 does not cover.

---

## 1. Config Files (3 required)

### 1.1 `CLAUDE.md`

Required sections (quick count):
```bash
grep -c "## Boot\|## R1\|## R2\|## R3\|## R4\|## R5\|Loop Architecture\|Cycle Gate\|platform-unknown\|Completion Gate" CLAUDE.md
```
Expected: ≥ 10 matches

| Section | Verify command | Expected |
|---|---|---|
| Boot B1–B4 | `grep -c "\[B[1-4]\]" CLAUDE.md` | 4 |
| R4 spawn patterns | `grep -c "Explore\|Execution\|Parallel fan-out" CLAUDE.md` | 3 |
| R4 platform-agnostic | `grep -c "spawn_tool\|detected.md\|platform-unknown" CLAUDE.md` | ≥ 3 |
| Cycle Gate | `grep -c "Cycle Gate\|cycle_N_" CLAUDE.md` | ≥ 2 |
| Completion Gate | `grep -c "Completion Gate" CLAUDE.md` | ≥ 1 |

Fix if missing: `Implement/03_config.md` → CLAUDE.md template → copy missing section.

---

### 1.2 `AGENTS.md`

| Section | Verify command | Expected |
|---|---|---|
| Boot Sequence | `grep -c "\[B1\]\|\[B2\]\|\[B3\]" AGENTS.md` | 3 |
| Loop Architecture | `grep -c "Loop Architecture\|Phase" AGENTS.md` | ≥ 3 |
| Quick Reference table | `grep -c "Token footer\|File reads\|Symbol edits" AGENTS.md` | ≥ 3 |
| Sub-agent Rules | `grep -c "Sub-agent Rules\|spawn_tool\|Cycle transition" AGENTS.md` | ≥ 3 |
| Critical Rules | `grep -c "Critical\|Edge Runtime\|PapaParse\|D1" AGENTS.md` | ≥ 2 |

Fix if missing: `Implement/03_config.md` → AGENTS.md template.

---

### 1.3 `INVARIANTS.md`

| Gate | Verify command | Expected |
|---|---|---|
| I1 Destructive | `grep -c "I1\|destructive\|\[gate\]" INVARIANTS.md` | ≥ 2 |
| I2 DB hard stop | `grep -c "I2\|db-gate\|HALT" INVARIANTS.md` | ≥ 2 |
| I3 Index sync | `grep -c "I3\|index.*sync\|symbol_indexer" INVARIANTS.md` | ≥ 2 |
| I4 Symbol check | `grep -c "I4\|symbol.*check\|used_in" INVARIANTS.md` | ≥ 2 |
| I5 Roadmap gate | `grep -c "I5\|roadmap.*gate\|\[X\]" INVARIANTS.md` | ≥ 2 |

Fix if missing: `Implement/03_config.md` → INVARIANTS.md template.

---

## 2. Skill Files (10 required)

All skill files must have: frontmatter (`name` + `description`) · `Sections[]` YAML · main content · Context Gate.

Run this to check all 10 exist:
```bash
ls .agents/skills/agent/SKILL.md .agents/skills/coder/SKILL.md .agents/skills/editor/SKILL.md \
   .agents/skills/file_manager/SKILL.md .agents/skills/identity/SKILL.md .agents/skills/mece/SKILL.md \
   .agents/skills/session_manager/SKILL.md .agents/skills/token_auditor/SKILL.md \
   .agents/skills/token_tracker/SKILL.md .agents/skills/variable_manager/SKILL.md 2>&1
```
Expected: 10 paths printed, zero "No such file" errors.

Run this to check all 10 have a Context Gate:
```bash
grep -l "Context Gate" .agents/skills/*/SKILL.md | wc -l
```
Expected: 10

### Per-skill section requirements

| Skill | Required terms (grep pattern) | Min matches |
|---|---|---|
| `agent` | `Orchestration Protocol\|Delegation Contract\|cycle_context\|detected.md` | 4 |
| `coder` | `Roadmap Protocol\|Coding Standards\|Sections\|Responsibilities` | 4 |
| `editor` | `Roadmap Protocol\|3-Tier\|Edit\|Sections\|Responsibilities` | 5 |
| `file_manager` | `Backlink\|Triggers\|Pre-Analysis\|Sections` | 4 |
| `identity` | `Fatal Constraint\|session_compactor\|git.*commit\|push` | 3 |
| `mece` | `Plan Format\|Execution Protocol\|Templates\|Sections` | 4 |
| `session_manager` | `BLOCKED\|Resume Flow\|mandatory\|blocked_cycle` | 4 |
| `token_auditor` | `Self-Heal\|inject\|offending\|Audit` | 3 |
| `token_tracker` | `SESSION_TOTAL\|TOKEN PAUSE\|Completion Gate` | 3 |
| `variable_manager` | `Triggers\|Pre-Analysis\|symbol_indexer\|Sections` | 4 |

Verify a specific skill (swap in any skill name):
```bash
grep -c "Orchestration Protocol\|Delegation Contract\|cycle_context\|detected.md" .agents/skills/agent/SKILL.md
```

Fix if any skill is missing or incomplete: `Implement/04_skills.md` → find that skill's section → copy full content to `.agents/skills/<skill>/SKILL.md`.

---

## 3. Routing Files (2 required)

### 3.1 `.agents/skills/registry.md`

```bash
grep -c "agent\|coder\|editor\|file_manager\|identity\|mece\|session_manager\|token_auditor\|token_tracker\|variable_manager" .agents/skills/registry.md
```
Expected: ≥ 10 (at least one match per skill)

### 3.2 `.agents/skills/skill-manifest.json`

Validate JSON and count skill entries:
```bash
python3 -c "
import json
d = json.load(open('.agents/skills/skill-manifest.json'))
skills = d.get('skills', d) if isinstance(d, dict) else d
print('Skill entries:', len(skills) if isinstance(skills, list) else 'check structure')
"
```
Expected: 10

Count keyword arrays:
```bash
grep -c '"keywords"' .agents/skills/skill-manifest.json
```
Expected: 10

Fix if missing or incomplete: `Implement/03_config.md` → skill-manifest.json template → add the missing skill entry.

---

## 4. Platform Adapter (1 required)

### 4.1 `.agents/platform/detected.md`

```bash
cat .agents/platform/detected.md
```
Check that `platform:` field is NOT `unknown`.

If `platform: unknown` → the Platform Probe (Boot B4) has not yet run. Run it now:
```bash
# Option A — trigger automatically by starting a new agent session (Boot B4 fires on unknown)
# Option B — answer Q1–Q4 in the [platform-unknown] co-development dialogue (see 07_platform.md)
# Option C — set manually if platform is already known:
sed -i 's/platform: unknown/platform: antigravity/' .agents/platform/detected.md
sed -i 's/spawn_tool: unknown/spawn_tool: invoke_subagent/' .agents/platform/detected.md
```

See `Implement/07_platform.md` for all known platform mappings.

---

## 5. Knowledge Files (3 required)

### 5.1 `knowledge/index_files.json`

```bash
python3 -c "import json; d=json.load(open('knowledge/index_files.json')); print('Files indexed:', len(d))"
```
Expected: ≥ 1 after first indexing run (0 is acceptable on a brand-new project before any files exist).

### 5.2 `knowledge/index_variables.json`

```bash
python3 -c "import json; d=json.load(open('knowledge/index_variables.json')); print('Symbols indexed:', len(d))"
```
Expected: ≥ 1 after first `symbol_indexer.py` run.

### 5.3 `knowledge/error_index.md`

```bash
grep -c "^## ERR-\|^# " knowledge/error_index.md
```
Expected: ≥ 1 (file exists with at least a header — `ERR-` entries are added as bugs are fixed).

Fix: if any knowledge file is missing, create it from the schemas in `Implement/01_overview.md`:
- `index_files.json` → empty JSON object `{}`
- `index_variables.json` → empty JSON object `{}`
- `error_index.md` → single line: `# Error Index`

---

## 6. Scripts (1 required)

### 6.1 `scripts/symbol_indexer.py`

Existence check:
```bash
ls scripts/symbol_indexer.py
```

Run check (must exit without ImportError):
```bash
python3 scripts/symbol_indexer.py --help 2>/dev/null || python3 scripts/symbol_indexer.py 2>&1 | head -5
```

Full integration test:
```bash
python3 scripts/symbol_indexer.py && grep -c '"line"' knowledge/index_variables.json
```
Expected: ≥ 1 symbol with a `"line"` field indexed.

Fix: `Implement/05_scripts.md` → symbol_indexer.py spec → implement the full script.

---

## 7. Docs (1 required)

### 7.1 `docs/master_roadmap.md`

```bash
grep -c "^\- \[[ X/]\]" docs/master_roadmap.md
```
Expected: ≥ 1 task entry using format `- [ ] T-N: <task>`.

Fix: create `docs/master_roadmap.md` with at least one placeholder:
```markdown
# Master Roadmap
- [ ] T-001: Initial setup
```

---

## 8. Failure Patterns (1 required)

### 8.1 `CODING_FAILURE_PATTERNS.md`

```bash
grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md
```
Expected: ≥ 1 pattern entry using format `## CFP-NNN: <title>`.

Fix: create `CODING_FAILURE_PATTERNS.md` with CFP-001 as a placeholder:
```markdown
# Coding Failure Patterns
## CFP-001: Placeholder
Added by setup. Replace with first real pattern when a bug requires ≥2 attempts.
```

---

## 9. Session Directory (runtime — verify after first task)

These files are created at runtime by Boot B1. Check after the first agent task completes:

```bash
ls .sessions/active_thread.md .sessions/session_tokens.md 2>&1
```
Expected: both exist.

```bash
cat .sessions/active_thread.md
```
Expected: contains `task:`, `phase:`, and `next:` fields.

If missing: start any agent task — Boot B1 creates them automatically.

---

## Summary Verification Script

Run all checks in one pass from `[PROJECT_ROOT]`:

```bash
echo "=== 1. Config Files ===" && \
  grep -c "## Boot\|## R1\|## R4\|Loop Architecture\|Completion Gate" CLAUDE.md && \
  grep -c "Sub-agent Rules\|spawn_tool" AGENTS.md && \
  grep -c "I1\|I2\|I3\|I4\|I5" INVARIANTS.md && \
echo "=== 2. Skill Files ===" && \
  ls .agents/skills/*/SKILL.md | wc -l && \
  grep -l "Context Gate" .agents/skills/*/SKILL.md | wc -l && \
echo "=== 3. Routing ===" && \
  grep -c '"keywords"' .agents/skills/skill-manifest.json && \
  grep -c "agent\|coder\|editor" .agents/skills/registry.md && \
echo "=== 4. Platform ===" && \
  grep "^platform:" .agents/platform/detected.md && \
echo "=== 5. Knowledge ===" && \
  ls knowledge/index_files.json knowledge/index_variables.json knowledge/error_index.md 2>&1 && \
echo "=== 6. Scripts ===" && \
  ls scripts/symbol_indexer.py && \
echo "=== 7. Docs ===" && \
  ls docs/master_roadmap.md CODING_FAILURE_PATTERNS.md && \
echo "=== ALL CHECKS DONE ==="
```

**Expected output (healthy install):**

```
=== 1. Config Files ===
<number ≥ 5>    ← CLAUDE.md section count
<number ≥ 2>    ← AGENTS.md section count
<number ≥ 5>    ← INVARIANTS.md gate count
=== 2. Skill Files ===
10              ← SKILL.md files
10              ← files with Context Gate
=== 3. Routing ===
10              ← keywords entries in skill-manifest.json
<number ≥ 3>    ← skill names in registry.md
=== 4. Platform ===
platform: antigravity   (or other known platform — NOT "unknown")
=== 5. Knowledge ===
knowledge/index_files.json
knowledge/index_variables.json
knowledge/error_index.md
=== 6. Scripts ===
scripts/symbol_indexer.py
=== 7. Docs ===
docs/master_roadmap.md
CODING_FAILURE_PATTERNS.md
=== ALL CHECKS DONE ===
```

Any `No such file` error or count below the expected threshold → locate the section above → apply the Fix action.
