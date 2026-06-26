## 7. Onboarding Protocol — Fresh Project

Follow these steps in order when setting up on a brand-new project.

```
Step 1: Create directories
  mkdir -p knowledge knowledge/cfp-proposals knowledge/cfp-proposals/applied knowledge/recipes .agents/skills/knowledge/index_manager scripts .sessions

Step 2: Write CLAUDE.md
  Use template from Section 4. Adjust R3 token thresholds to your model.

Step 2.5: Write governance docs
  docs/master_roadmap.md — copy from 03_config.md docs/master_roadmap.md Template
  docs/domain_rules.md   → create empty file: "# Domain Rules\n\n<!-- Add business rules here -->"

Step 3: Write all agent infrastructure files
  a. Skill files (all 9) — copy from 04_skills.md Sections 5a–5j:
     .agents/skills/knowledge/index_manager/SKILL.md
     .agents/skills/harness/mece/SKILL.md
     .agents/skills/coding/coder/SKILL.md
     .agents/skills/coding/editor/SKILL.md
     .agents/skills/knowledge/session_manager/SKILL.md
     .agents/skills/harness/token_auditor/SKILL.md
     .agents/skills/harness/token_tracker/SKILL.md
     .agents/skills/user/identity/SKILL.md
     .agents/skills/coding/agent/SKILL.md
  b. skill-manifest.json — copy from 03_config.md skill-manifest.json Template
  c. registry.md — copy from 03_config.md registry.md Template
  d. scripts/symbol_indexer.py — see 05_scripts.md
  e. CODING_FAILURE_PATTERNS.md — copy skeleton from 03_config.md CODING_FAILURE_PATTERNS.md Template

Step 4: Initialize indexes
  knowledge/index_files.json     → { "files": {} }
  knowledge/index_variables.json → { "variables": {} }
  knowledge/error_index.md       → # Error Index\n\n(empty)
  knowledge/index_cfp_fix.json   → keyed by CFP ID (NOT { "variables": {} })
    Schema per entry:
    {
      "CFP-XXX": {
        "status": "active",
        "description": "<title from CODING_FAILURE_PATTERNS.md>",
        "fixes": []
      }
    }
    Init: copy CFP IDs from CODING_FAILURE_PATTERNS.md → one key per ## CFP-XXX header

Step 4b: Configure platform + model tiers WITH the user (interactive — AI-guided · NOT a silent default)
  The harness needs 3 things it CANNOT guess. The AI walks the user through each, then writes detected.md.
  (model tiers ALWAYS need the user — the AI cannot know which models the user pays for.)

  ── 4b.1 · Map model tiers (ASK the user — never assume) ──
    AI asks: "คุณมี model อะไรใช้ได้บ้างครับ? (ชื่อ + เร็ว/ถูก หรือ แรง/แพง)"
    Map the answer to the 3 harness tiers (all spawn calls in AGENTS.md use TIER NAMES, never raw model IDs):
      MODEL_HIGH   = strongest reasoning model → MECE planning / architecture ONLY (reserved · not routine edits)
      MODEL_MEDIUM = mid-tier workhorse        → code edits / multi-step execution / structured output (baseline)
      MODEL_LOW    = fast/cheap model          → lookup / grep / read-only / Reviewer / Completion Gate
    Rule (canonical home: 03_config.md §Model Tiers): dial EFFORT first (low/med/high), tier second.
    Every skill MUST be followable by MODEL_MEDIUM with NO inference — MODEL_HIGH is reserved, not the default.
    Only ONE model available → set all 3 tiers to it + differentiate by EFFORT alone.
    Only TWO → MODEL_HIGH = MODEL_MEDIUM = stronger one · MODEL_LOW = cheaper one.

  ── 4b.2 · Confirm API provider (auto-probe, THEN ask to confirm) ──
    AI runs the B4 provider heuristic (AGENTS.md §Boot B4): platform→provider, else model-id —
      id contains `claude`→anthropic · `gpt`/`o[0-9]`→openai · `gemini`→google · else→unknown.
    Show the guess, ask the user to confirm. Provider decides cache + token-cost behaviour;
    applying the wrong provider's cache rule breaks immediately (see 03_config.md §Provider Profiles).
    Copy the matching row from §Provider Profiles into detected.md:
      api_provider / cache_mechanism / context_cliff_tokens / token_formula / cache_write_cost
    Unknown → token_formula: generic · cache_mechanism: none · context_cliff_tokens: 200000 (conservative floor).

  ── 4b.3 · Spawn tool (sub-agent capability) ──
    platform recognised (Known Mappings, 07_platform.md) → fill spawn_tool automatically.
    platform unknown → run the 4-question co-development dialogue (07_platform.md §Co-development Dialogue).

  ── Write .agents/platform/detected.md (fill ALL fields from 4b.1–4b.3 · never hardcode model IDs in skills) ──
    Template:
      platform: <name | unknown>
      spawn_tool: <tool | unknown>
      explore_type: <value | unknown>
      execution_type: <value | unknown>
      parallel_mode: <value | unknown>
      define_tool: <value | none>
      model_high: <model id chosen in 4b.1>
      model_medium: <model id chosen in 4b.1>
      model_low: <model id chosen in 4b.1>
      api_provider: <anthropic | openai | google | unknown>
      cache_mechanism: <from §Provider Profiles | none>
      context_cliff_tokens: <from §Provider Profiles | 200000>
      token_formula: <anthropic | openai | google | generic>
      cache_write_cost: <from §Provider Profiles | n/a>
      notes:
    (Leaving platform/provider = unknown is OK — B4 auto-detects on first boot. But run 4b.1 explicitly:
     model tiers always need the user.)

Step 4c: Configure Claude Code settings (.claude/settings.json)
  Recommended values:
    "effortLevel": "high"           ← model thinks harder; persists across sessions
    "fastModePerSessionOptIn": true ← enables /fast command; does NOT auto-enable each session
                                       → must run /fast manually each session to activate
  autoMode policy — DO NOT put in shared settings.json (ignored):
    → inject via managed settings or invocation-level config only
    → create separate presets for: exploration mode vs CI/verification mode
  Note: non-interactive runs (-p flag) abort on repeated classifier blocks — no human fallback

  Harness hooks (REQUIRED — wire into the "hooks" block of .claude/settings.json · these automate the loop):
    SessionStart (matcher "compact") → scripts/compact_reset.py --trigger=hook
        recomputes counters after /compact (CHAT=compact_size+sys_fixed · LOOP_WEIGHT=0 · SESSION=0 if session_reset=armed)
    UserPromptSubmit → inline token-state emitter (reads .sessions/session_tokens.md →
        prints `[token-state] SESSION/LOOP_W/CHAT` · emits [compact-rec] at CHAT>80k / [compact-STOP] at SESSION>90k|CHAT>120k
        per C0.5 thresholds · consumes session_reset=armed) + scripts/learning_profile.py analyze
    PreToolUse (matcher Edit|Write|Read|NotebookEdit) → inline python gate (3 guards):
        · never-full-load — blocks Read of prohibited files (knowledge/index_*.json · CODING_FAILURE_PATTERNS.md · docs/master_roadmap.md · INVARIANTS.md · knowledge/error_index.md)
        · phase gate — blocks Edit/Write to src/ unless gather_complete.md AND mece_plan.md are BOTH dated today
        · close-gate — blocks writing "phase: done" to active_thread.md until .sessions/.close_checklist_ack exists
    PreToolUse (matcher Bash) → scripts/git_guard.py (T-227 · separate entry from the gate above)
        · git-guard — hard-blocks (exit 2) 4 dangerous git patterns BEFORE they run: force-push
          (--force/-f/--force-with-lease) · reset --hard · clean -f · branch -D
        · shlex command-position match (no substring false-block) · fail-open on parse error
        · override: prefix `GIT_GUARD_OK=1` (detected as a command token, not shell env)
    PostToolUse → scripts/posttool_track.py (auto-accumulates SESSION_TOTAL + CHAT_TOTAL per tool call · provider-aware via detected.md token_formula)
    Stop → scripts/write_context_cache.sh + scripts/index_reconcile.py
        (index_reconcile = safety net: diffs git-changed files vs index_files.json, auto-runs idempotent regenerators
         — rule_indexer · backlink_analyzer · code_graph · symbol_indexer — plus repo_map_check.py --sync)
  All hook commands resolve ROOT via `${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}` → cross-platform, no hardcoded paths.
  Non-claude-code providers (no compact hook): the C0 plain-text-confirm path calls compact_reset.py manually instead (same single source · T-180).

Step 4d: Choose & configure the DOMAIN PACK with the user (interactive — AI-guided · the project layer)
  CORE (CLAUDE.md / AGENTS.md / Implement/) is project-agnostic. Everything project-specific
  (gates, framework rules, domain skills/tools) lives in ONE domain pack under domain/.
  Exactly one pack is active per project. The AI asks the 5 questions, then fills the pack —
  never silently defaulted (same co-config style as Step 4b for the provider).

  ── 4d.1 · Pick or create the pack ──
    An existing pack fits?  ls domain/*.md   → set that pack's `active: true`, all others `active: false`.
    None fits → copy the template:   cp domain/_TEMPLATE.md domain/<name>.md
      <name> = short project kind: coding · takeoff · legal · ...  (AI suggests, user confirms)
      then set its meta:  name: <name> · active: true · created: <today>

  ── 4d.2 · Co-config Q&A (AI asks each · user answers · AI writes the matching slot) ──
    Q1  What kind of project is this?                         → meta.name
    Q2  Where do the main work files live?                    → ## paths  work_root (+ protected: any must-not-touch folder · code_exts)
    Q3  Any folder/action that must HALT for a confirm first? → ## domain_gates  (write the FULL Pre/Contract/emit/Post/Enforce contract INLINE — no pointers)
    Q4  Any framework/library with non-obvious rules?         → ## framework  +  ## critical_rules  (one line each, with the why / ERR-id)
    Q5  Domain-specific skills/tools to register?             → ## skills  +  ## tools
    Record every answer verbatim under the pack's `## co-config Q&A` block.

  ── 4d.3 · Auto-detect to PRE-FILL Q4 (AI proposes · user confirms — never silent) ──
    package.json has "next"            → propose framework "Next.js — read node_modules/next/dist/docs/ first" + critical_rule "Edge Runtime: WebCrypto only, no Node APIs"
    drizzle.config.* present           → propose critical_rules "Miniflare D1: no multi-row INSERT / no onConflictDoNothing()" (ERR-007)
    requirements.txt / pyproject.toml  → propose Python framework notes
    Cargo.toml                         → propose Rust framework notes
    These only PRE-FILL the Q4 answer — the user confirms before they enter the pack.

  ── Verify ──
    grep -c "^## paths\|^## domain_gates\|^## critical_rules" domain/<name>.md   → expect 3
    grep -c "^  active: true" domain/*.md                                        → expect exactly 1

Step 5: Initialize session state
  Run: python3 scripts/bootstrap_sessions.py
  → Creates all 7 .sessions/ files from docs/session_templates/ (skips existing)
  → Templates define correct schema for each file (see docs/session_templates/)
  Manual fallback if script unavailable:
    .sessions/active_thread.md   → task: init\nphase: done\nnext: none
    .sessions/session_tokens.md  → SESSION_TOTAL: 0\nCHAT_TOTAL: 0\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0
    .sessions/self_improve_log.md → # Self-Improve Log
  See docs/session_templates/ for schema of: mece_plan · gather_complete · session_handoff · compact_state

Step 6: Write symbol_indexer.py
  Use spec from Section 6.

Step 7: Run initial scan
  python scripts/symbol_indexer.py

Step 8: Verify (see Section 9)
```

---

## 8. Integration Protocol — Existing Project (Seamless)

Use this when integrating into an already-developed codebase.
**This protocol never modifies source files** — only adds agent infrastructure.

```
Step 1: Detect project type
  - package.json + "next" → Next.js/TypeScript
  - requirements.txt / pyproject.toml → Python
  - Cargo.toml → Rust
  Adjust scan patterns in Step 4 accordingly.

Step 2: Create agent directories (skip if exist)
  mkdir -p knowledge knowledge/cfp-proposals knowledge/cfp-proposals/applied knowledge/recipes .agents/skills/knowledge/index_manager scripts .sessions

Step 2.5: Auto-discover project context
  a. Map directory structure:
     find . -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" -type d
     → Write result to REPO_MAP.md (replace <!-- EDIT: Document your project's source tree --> placeholder)

  b. Detect stack → PRE-FILL the active DOMAIN PACK (these feed Step 4d.3 · not core INVARIANTS):
     - Found package.json with "next" → Next.js: framework "read node_modules/next/dist/docs/ first" + critical_rule "Edge Runtime: WebCrypto only, no Node APIs"
     - Found drizzle.config.* → Miniflare D1: critical_rules "NO multi-row INSERT", "NO onConflictDoNothing()" (ERR-007)
     - Found requirements.txt / pyproject.toml → Python: relevant constraints
     - Found Cargo.toml → Rust: relevant constraints
     → AI proposes → user confirms → write into the active pack's ## critical_rules + ## framework (domain/<name>.md · Step 4d). Core INVARIANTS.md stays project-agnostic.

  c. Detect key libraries + patterns:
     grep -r "^import\|^from\|^require" src/ --include="*.ts" --include="*.tsx" --include="*.py" | \
     grep -oE "from ['\"]([^'\"]+)['\"]" | sort | uniq -c | sort -rn | head -20
     → Note top imports in AGENTS.md §Critical Project-Specific Rules

  d. Check recent activity:
     git log --oneline -10 2>/dev/null || echo "no git"
     → Note active files/areas in REPO_MAP.md §Quick Lookup Commands

  e. Scan for existing CLAUDE.md / AGENTS.md:
     - Found → ADD missing rules only (do NOT overwrite)
     - Not found → create from 03_config.md templates

Step 3: Write skill + script files
  Write all 10 skill files (same as Onboarding Step 3 — Sections 5a–5j).
  Write symbol_indexer.py (same as Onboarding Step 6 — Section 6).
  If CLAUDE.md already exists: ADD missing R5 (Index-First), R8 (Index Sync), R9 (Error Protocol) rules only.
  Do NOT overwrite existing CLAUDE.md rules.
  f. CODING_FAILURE_PATTERNS.md — copy skeleton from 03_config.md CODING_FAILURE_PATTERNS.md Template

Step 4: Build index_files.json from existing codebase
  For each source file (src/**/*.ts, src/**/*.tsx, or equivalent):
    a. Extract description: first JSDoc block comment OR first line comment OR filename-based summary
    b. Extract imports: grep for "import.*from" → resolve relative paths → add THIS file to their backlinks
    c. Write entry: { description, associated_tasks: [], backlinks: [...] }

Step 5: Build index_variables.json from existing codebase
  Run: python scripts/symbol_indexer.py
  Then for each symbol found:
    a. Determine type: Component (PascalCase function returning JSX), Hook (starts with "use"),
       DBTable (drizzle table), Function, Type, Class, Constant
    b. Detect used_in: grep -rl "SymbolName" src/ → filter to files that actually import it
    c. Write entry: { type, source, line, used_in: [...] }

Step 6: Initialize session state
  .sessions/active_thread.md   → task: integration-complete\nphase: done\nnext: none
  .sessions/session_tokens.md  → SESSION_TOTAL: 0\nCHAT_TOTAL: <sys_fixed>\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0

Step 7: Verify (see Section 9)
```

---

## 9. Track C — Upgrade Existing Harness (old version → current)

Use this when a project already has an **older harness version** installed with mismatched tree
structure, old index schemas, or missing skills (harness_editor · harness_doctor · session_manager).

→ Follow `Implement/09_migration.md` — 4-track upgrade procedure:
```
M1: Re-format indexes  (session_tokens.md · index_files.json schema · backlink_analyzer)
M2: Re-structure tree  (missing dirs + session files + mece_plan_schema + detected.md)
M3: Update skills      (overwrite SKILL.md · CLAUDE.md · AGENTS.md · add new skills)
M4: Verify             (run 08_checklist.md section-by-section)
```
⚡ Never touch `src/` during M1–M3. Commit before M3 as rollback checkpoint.

---

## 10. Verification Checklist

Run after onboarding or integration. All items must pass before starting development work.

```
[ ] knowledge/index_files.json   — exists, valid JSON, "files" key present, entries > 0 for existing projects
[ ] knowledge/index_variables.json — exists, valid JSON, "variables" key present
[ ] knowledge/error_index.md     — exists (may be empty), uses T-{Parent}-{BugID}-{Attempt} format
[ ] .agents/skills/skill-manifest.json — exists, valid JSON, keywords → skill routing defined
[ ] .agents/skills/harness/mece/SKILL.md — exists
[ ] .agents/skills/coding/coder/SKILL.md — exists, contains Roadmap Protocol
[ ] .agents/skills/coding/editor/SKILL.md — exists, contains Roadmap Protocol
[ ] .agents/skills/knowledge/index_manager/SKILL.md — exists (mode:file + mode:symbol)
[ ] scripts/symbol_indexer.py    — exists, runs without error
[ ] .sessions/active_thread.md   — exists, phase: done
[ ] .sessions/mece_plan.md       — exists (may be empty template); if has [ ] sections → resume flow active
[ ] After first Cycle execution: `.sessions/cycle_1_<section_id>.json` exists per section with `status: done|blocked`
[ ] CLAUDE.md                    — contains R5 (Index-First), R8 (Index Sync), R9 (Error Protocol), R-Roadmap, Token Gate, R19 (Self-Improvement)
[ ] CLAUDE.md §R4 lists 3 spawn patterns (Explore / Execution / Parallel fan-out) with max depth=1 rule
[ ] AGENTS.md                    — exists, contains Boot Sequence + Loop Architecture (Dual-Mode) + Quick Reference
[ ] INVARIANTS.md                — exists, contains I1–I5 + Protected Zones (incl. db_migrations/ + .sessions/)
[ ] REPO_MAP.md                  — exists, directory structure documented
[ ] CODING_FAILURE_PATTERNS.md  — exists, uses CFP-NNN format
[ ] knowledge/cfp-proposals/    — exists (CFP draft staging)
[ ] knowledge/cfp-proposals/applied/ — exists (CFP archive)
[ ] knowledge/recipes/          — exists (load-on-demand procedure notes)
[ ] docs/master_roadmap.md      — exists, has at least T-000 entry
[ ] .agents/skills/knowledge/session_manager/SKILL.md — exists, contains session close flow
[ ] .agents/skills/harness/token_auditor/SKILL.md — exists, contains threshold gate
[ ] .agents/skills/harness/token_tracker/SKILL.md — exists
[ ] .agents/skills/user/identity/SKILL.md — exists
[ ] `.agents/skills/coding/agent/SKILL.md` — contains Orchestration Protocol (Cycle fan-out, 7 steps) + Delegation Contract (goal/constraints/output_format/on_demand_files/cycle_context)
[ ] python scripts/symbol_indexer.py — exits 0, reports symbol count > 0
```

**Quick verify command:**
```bash
python scripts/symbol_indexer.py && \
python -c "import json; d=json.load(open('knowledge/index_files.json')); print(f'Files: {len(d[\"files\"])}')" && \
python -c "import json; d=json.load(open('knowledge/index_variables.json')); print(f'Symbols: {len(d[\"variables\"])}')"
```

Expected output:
```
Updated NNN symbols.
Files: NNN
Symbols: NNN
```

---

## 10. Quick-Reference Card

Print or paste this card into any agent conversation when starting work:

```
RULES FOR THIS PROJECT:
1. Before editing any file → grep knowledge/ indexes first
2. After every code change → run python scripts/symbol_indexer.py
3. After adding/removing imports → update knowledge/index_files.json backlinks
4. New error → ERR-XXX in knowledge/error_index.md
5. Session end → write .sessions/active_thread.md (phase: done/in_progress)
6. Token footer required every response → read/write .sessions/session_tokens.md
```

---

## 11. Project .gitignore — Harness Files

> ⚠️ **Scope: TARGET PROJECT only** — This gitignore section applies when deploying the harness INTO a real project repo. It is NOT for the `Harness Agent` development repo itself.
> The `Harness Agent` dev repo tracks all harness files (no `.sessions/` ignore) so development is fully versioned.

The harness is **developer tooling**, not project code. Add the following to your project's `.gitignore` so harness framework files are never committed to the main project repo.

### Paste into project `.gitignore`

```gitignore
# ─── Claude Code Harness (agent framework — not project source) ───────────────
# Core harness config (reusable across projects — clone from harness killer repo)
AGENTS.md
CLAUDE.md
CLAUDE.th.md
INVARIANTS.md
REPO_MAP.md
CODING_FAILURE_PATTERNS.md
Implement.md
Implement/

# Skill library
.agents/

# Harness utility scripts
scripts/lookup.py
scripts/symbol_indexer.py
scripts/session_indexer.py

# Session runtime state (changes every agent session)
.sessions/

# Optional semantic search cache
.claw-rag/

# Harness reference docs (regeneratable from harness killer repo)
knowledge/harness_flow*.md
knowledge/cfp_archive.md
knowledge/index_sessions.json
# ──────────────────────────────────────────────────────────────────────────────
```

### What to KEEP in project repo (project-specific harness state)

| File | Why commit |
|---|---|
| `knowledge/error_index.md` | Project-specific bug log — valuable history |
| `knowledge/index_files.json` | File dependency map — regeneratable but slow |
| `knowledge/index_variables.json` | Symbol index — regeneratable but slow |
| `docs/master_roadmap.md` | Task history + feature log |

### Two-repo pattern (recommended)

```
project-repo/          ← your actual project (commit src/, knowledge/, docs/)
  .gitignore           ← harness files listed above
  src/
  knowledge/error_index.md
  docs/master_roadmap.md

harness-killer-repo/   ← framework only (separate repo, sync manually)
  AGENTS.md
  CLAUDE.md
  .agents/skills/*/SKILL.md
  scripts/
  Implement/
```

On new project setup: clone harness killer → copy harness files into project dir → add `.gitignore` block above → proceed with setup (Section 1–9).

---