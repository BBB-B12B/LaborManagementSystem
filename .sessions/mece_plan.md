# MECE Plan — Bootstrap Agent System Harness
Created: 2026-05-21 | Last updated: 2026-05-21 16:05
Status: done | Budget: Used ~0k / Limit 50k

## Cycles
  Cycle 1: [S1, S2]
  Cycle 2: [S3, S4]
  Cycle 3: [S5, S6]
  Cycle 4: [S7]
  # S3 and S4 depend on directories created in S1 and configuration in S2
  # S5 and S6 depend on scripts written in S4
  # S7 depends on all previous sections being fully executed

## Sections
- [X] S1: Scaffold directories and platform adapter
      Skill: coder
      Context: [Implement/02_setup.md, Implement/07_platform.md]
      DoD: `test -d knowledge/cfp-proposals -a -d .sessions -a -f .agents/platform/detected.md` → expected: true (0)
      Est: ~5k tokens

- [X] S2: Deploy system configs (CLAUDE.md, AGENTS.md, INVARIANTS.md, REPO_MAP.md, CODING_FAILURE_PATTERNS.md)
      Skill: editor
      Context: [Implement/03_config.md, CLAUDE.md, AGENTS.md]
      DoD: `grep -c "## Boot" CLAUDE.md` → expected: >= 10, `grep -c "Gate" INVARIANTS.md` → expected: >= 5
      Est: ~10k tokens

- [X] S3: Write all 10 agent skill files, manifest, and registry
      Skill: coder
      Context: [Implement/04_skills.md, .agents/skills/]
      DoD: `ls .agents/skills/*/SKILL.md | wc -l` → expected: 10, `grep -c "Context Gate" .agents/skills/*/SKILL.md` → expected: 10
      Est: ~15k tokens

- [X] S4: Write symbol_indexer.py and bootstrap_indices.py scripts
      Skill: coder
      Context: [Implement/05_scripts.md, scripts/]
      DoD: `ls scripts/symbol_indexer.py scripts/bootstrap_indices.py` → expected: exists
      Est: ~8k tokens

- [X] S5: Run auto-discovery & generate files indices (index_files.json, index_variables.json, error_index.md)
      Skill: coder
      Context: [knowledge/]
      DoD: `python scripts/bootstrap_indices.py` → exits 0, index files exist and have >0 entries
      Est: ~8k tokens

- [X] S6: Initialize session states & docs roadmap
      Skill: coder
      Context: [.sessions/, docs/]
      DoD: `cat .sessions/active_thread.md` → expected: phase: done, `cat docs/master_roadmap.md` → expected: contains T-000
      Est: ~4k tokens

- [X] S7: Run verification checklist and summarize
      Skill: agent
      Context: [Implement/08_checklist.md]
      DoD: Run summary verification bash command → all checks done
      Est: ~4k tokens

## Continuation Prompt
Resume: read .sessions/mece_plan.md → find first [/] or [ ] → execute as sub-agent

## Session Archive
<!-- session_manager appends closed-plan summaries here -->
