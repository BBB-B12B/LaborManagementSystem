## 7. Onboarding Protocol — Fresh Project

Follow these steps in order when setting up on a brand-new project.

```
Step 1: Create directories
  mkdir -p knowledge knowledge/cfp-proposals knowledge/cfp-proposals/applied knowledge/recipes .agents/skills/file_manager .agents/skills/variable_manager scripts .sessions

Step 2: Write CLAUDE.md
  Use template from Section 4. Adjust R3 token thresholds to your model.

Step 2.5: Write governance docs
  docs/master_roadmap.md — copy from 03_config.md docs/master_roadmap.md Template
  docs/domain_rules.md   → create empty file: "# Domain Rules\n\n<!-- Add business rules here -->"

Step 3: Write all agent infrastructure files
  a. Skill files (all 10) — copy from 04_skills.md Sections 5a–5j:
     .agents/skills/file_manager/SKILL.md
     .agents/skills/variable_manager/SKILL.md
     .agents/skills/mece/SKILL.md
     .agents/skills/coder/SKILL.md
     .agents/skills/editor/SKILL.md
     .agents/skills/session_manager/SKILL.md
     .agents/skills/token_auditor/SKILL.md
     .agents/skills/token_tracker/SKILL.md
     .agents/skills/identity/SKILL.md
     .agents/skills/agent/SKILL.md
  b. skill-manifest.json — copy from 03_config.md skill-manifest.json Template
  c. registry.md — copy from 03_config.md registry.md Template
  d. scripts/symbol_indexer.py — see 05_scripts.md
  e. CODING_FAILURE_PATTERNS.md — copy skeleton from 03_config.md CODING_FAILURE_PATTERNS.md Template

Step 4: Initialize indexes
  knowledge/index_files.json     → { "files": {} }
  knowledge/index_variables.json → { "variables": {} }
  knowledge/error_index.md       → # Error Index\n\n(empty)

Step 5: Initialize session state
  .sessions/active_thread.md   → task: init\nphase: done\nnext: none
  .sessions/session_tokens.md  → SESSION_TOTAL: 0

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
  mkdir -p knowledge knowledge/cfp-proposals knowledge/cfp-proposals/applied knowledge/recipes .agents/skills/file_manager .agents/skills/variable_manager scripts .sessions

Step 2.5: Auto-discover project context
  a. Map directory structure:
     find . -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" -type d
     → Write result to REPO_MAP.md (replace <!-- EDIT: Document your project's source tree --> placeholder)

  b. Detect stack + infer I2 hard stop rules:
     - Found package.json with "next" → Next.js: add "NO Node.js APIs in edge runtime — WebCrypto only"
     - Found drizzle.config.* → Drizzle ORM + D1: add "NO multi-row INSERT", "NO onConflictDoNothing()"
     - Found requirements.txt / pyproject.toml → Python: add relevant constraints
     - Found Cargo.toml → Rust: add relevant constraints
     → Write inferred rules to INVARIANTS.md §I2 (replace <!-- EDIT --> placeholder)

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
  .sessions/session_tokens.md  → SESSION_TOTAL: 0

Step 7: Verify (see Section 9)
```

---

## 9. Verification Checklist

Run after onboarding or integration. All items must pass before starting development work.

```
[ ] knowledge/index_files.json   — exists, valid JSON, "files" key present, entries > 0 for existing projects
[ ] knowledge/index_variables.json — exists, valid JSON, "variables" key present
[ ] knowledge/error_index.md     — exists (may be empty), uses T-{Parent}-{BugID}-{Attempt} format
[ ] .agents/skills/skill-manifest.json — exists, valid JSON, keywords → skill routing defined
[ ] .agents/skills/mece/SKILL.md — exists
[ ] .agents/skills/coder/SKILL.md — exists, contains Roadmap Protocol
[ ] .agents/skills/editor/SKILL.md — exists, contains Roadmap Protocol
[ ] .agents/skills/file_manager/SKILL.md  — exists
[ ] .agents/skills/variable_manager/SKILL.md — exists
[ ] scripts/symbol_indexer.py    — exists, runs without error
[ ] .sessions/active_thread.md   — exists, phase: done
[ ] .sessions/mece_plan.md       — exists (may be empty template); if has [ ] sections → resume flow active
[ ] CLAUDE.md                    — contains R5 (Index-First), R8 (Index Sync), R9 (Error Protocol), R-Roadmap, Token Gate, R19 (Self-Improvement)
[ ] AGENTS.md                    — exists, contains Boot Sequence + Loop Architecture (Dual-Mode) + Quick Reference
[ ] INVARIANTS.md                — exists, contains I1–I5 + Protected Zones (incl. db_migrations/ + .sessions/)
[ ] REPO_MAP.md                  — exists, directory structure documented
[ ] CODING_FAILURE_PATTERNS.md  — exists, uses CFP-NNN format
[ ] knowledge/cfp-proposals/    — exists (CFP draft staging)
[ ] knowledge/cfp-proposals/applied/ — exists (CFP archive)
[ ] knowledge/recipes/          — exists (load-on-demand procedure notes)
[ ] docs/master_roadmap.md      — exists, has at least T-000 entry
[ ] .agents/skills/session_manager/SKILL.md — exists, contains session close flow
[ ] .agents/skills/token_auditor/SKILL.md — exists, contains threshold gate
[ ] .agents/skills/token_tracker/SKILL.md — exists
[ ] .agents/skills/identity/SKILL.md — exists
[ ] .agents/skills/agent/SKILL.md — exists, contains orchestration protocol
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
