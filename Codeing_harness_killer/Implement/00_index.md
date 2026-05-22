# Implement — Agent System Bootstrap Index

> Read this file first. Each part covers one topic — load only what you need.

## Parts

| File | Contents | When to read |
|---|---|---|
| [01_overview.md](01_overview.md) | System capabilities, directory structure, index schemas | Always — first read |
| [02_setup.md](02_setup.md) | Onboarding (fresh project), Integration (existing project), Verification checklist | When setting up a project |
| [03_config.md](03_config.md) | CLAUDE.md, AGENTS.md, INVARIANTS.md, REPO_MAP.md templates | When writing config files |
| [04_skills.md](04_skills.md) | All 10 skill SKILL.md templates (file_manager, variable_manager, mece, coder, editor, session_manager, token_auditor, token_tracker, identity, agent) | When writing skill files |
| [05_scripts.md](05_scripts.md) | symbol_indexer.py spec | When writing the indexer script |
| [06_orchestrator.md](06_orchestrator.md) | Dual-mode execution, mece_plan.md schema, Cycle orchestration, cycle_N_*.json result files, sub-agent loop logic, token budget | When setting up orchestration or sub-agent spawn patterns (R4) |
| [07_platform.md](07_platform.md) | Platform adapter — auto-detection, known platform mappings, co-development dialogue for unknown platforms | When deploying on a new platform or when [platform-unknown] is emitted |
| [08_checklist.md](08_checklist.md) | Post-installation verification — 22 required files, per-file section checks, summary script | After completing Track A or Track B setup |

## Agent Reading Order

### Track A — Fresh Project (no existing code)
1. `01_overview.md` → understand structure
2. `02_setup.md §7` → follow Onboarding steps
3. `03_config.md` → write CLAUDE.md, AGENTS.md, INVARIANTS.md, REPO_MAP.md
4. `04_skills.md` → write all 10 SKILL.md files
5. `05_scripts.md` → write symbol_indexer.py
6. `07_platform.md` → run Platform Probe → write .agents/platform/detected.md
7. `02_setup.md §9` → run verification checklist
8. `08_checklist.md` → run summary verification script → fix any gaps

### Track B — Existing Project (has source code already)
1. `01_overview.md` → understand structure
2. `02_setup.md §8 Step 1` → detect project type (package.json / requirements.txt / Cargo.toml)
3. `02_setup.md §8 Step 2.5` → **auto-discover**: scan dirs → write REPO_MAP.md, infer I2 rules, detect libraries
4. `02_setup.md §8 Step 2–7` → create agent directories + write files
5. `03_config.md` → write CLAUDE.md, AGENTS.md, INVARIANTS.md (with auto-discovered rules filled in)
6. `04_skills.md` → write all 10 SKILL.md files
7. `05_scripts.md` → write symbol_indexer.py
8. `07_platform.md` → run Platform Probe → write .agents/platform/detected.md
9. `02_setup.md §9` → run verification checklist
10. `08_checklist.md` → run summary verification script → fix any gaps

> **Key difference:** Track B runs auto-discovery (Step 2.5) before writing any config files,
> so REPO_MAP.md and INVARIANTS.md §I2 are filled automatically from the actual codebase.

## Context Gate

Every skill SKILL.md ends with a "Context Gate" block:
> If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task

This is the mechanism that keeps INVARIANTS.md current as the codebase evolves.
Trigger: agent encounters a rule violation or discovers a constraint that must never be repeated.
Action: add entry to §I2 immediately — do not wait for session close.

## Living Documents (auto-updated during normal work)

These files are updated automatically by agent skills — no manual refresh needed:

| File | Updated by |
|---|---|
| `docs/master_roadmap.md` | All skills — task status [ ] → [/] → [X] |
| `knowledge/index_variables.json` | variable_manager + symbol_indexer.py after every code change |
| `knowledge/index_files.json` | file_manager — on every file create/move/delete |
| `knowledge/error_index.md` | editor skill — on every bug fix |
| `REPO_MAP.md` | file_manager + coder — when directories change |
| `INVARIANTS.md §I2` | Any skill — when new hard constraint discovered (Context Gate) |
| `CODING_FAILURE_PATTERNS.md` | editor skill — when bug fix requires ≥2 attempts |
| `AGENTS.md §Critical Rules` | coder + editor — when new library added |
| `.sessions/cycle_N_<section_id>.json` | agent skill — written by each sub-agent after completing its section |
