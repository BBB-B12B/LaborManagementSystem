# karpathy-skills (multica-ai/andrej-karpathy-skills) — comparison vs our harness · 2026-06-21

Source: https://github.com/multica-ai/andrej-karpathy-skills
Studied: 2026-06-21 (this session, via research subagent + scrutinize second-pass).

## What the repo actually is
A THIN package — 3 files (CLAUDE.md, CURSOR.md, EXAMPLES.md) + a thin plugin wrapper. ONE skill folder `skills/karpathy-guidelines/`. The "4 skills" are SECTIONS inside one CLAUDE.md, not separate skill files. **No scripts, no hooks, no runtime.** Everything is a mindset rule — foundation-level, not infrastructure-level. It encodes 4 of Andrej Karpathy's observed anti-patterns in LLM-assisted coding.

## The 4 principles vs what we already have
| karpathy principle | essence | our harness equivalent | status |
|---|---|---|---|
| Think Before Coding | surface confusion / clarify before acting; don't guess silently | G0 clarity gate + new T-228 scope-grill | ALREADY COVERED |
| Simplicity First | ban speculative features / over-engineering / gold-plating | scrutinize (simpler-way pass) + skeptical_reviewer | ALREADY COVERED |
| Goal-Driven Execution | turn vague tasks into verifiable success criteria + self-verify loop | Verify-N per MECE section + REACT L4 + R12 | ALREADY COVERED |
| **Surgical Changes** | edit ONLY requested scope; no drive-by refactoring (every unrequested change is an untested change) | editor SKILL says "surgically" in description only — NO enforced rule (verified by grep) | **GAP → T-230** |

## Verdict (scrutinize)
The repo is FOUNDATIONAL exactly as the user sensed — but 3 of 4 principles are ALREADY in our harness DNA. **The repo VALIDATES our architecture more than it adds new capability.** Only genuine gap = Surgical-Changes (enforced minimal-diff / no-drive-by-refactor discipline) → captured as **T-230** (scope-discipline rule in editor/coder SKILL + `[scope-creep]` diff check at Phase 3 Close).

Anti-skill-sprawl held: 4 principles → 0 new skills, 1 thin rule/discipline task.

## Spin-off: harness-efficiency scrutinize (same session)
The karpathy "do the rules cost what they save?" lens prompted a full outsider scrutinize of OUR harness efficiency → produced T-231 (trim R1 footer ceremony), T-232 (merge C0+C0.5 routing — highest value, every-turn), T-233 (verify-then-trim `Tier` from R5 [pre-read]), T-234 (deterministic skill tie-break at B2). REJECTED: inline R3/R4/R8 tables into CLAUDE.md (cargo-cult — CLAUDE.md is always-loaded; fights small-front-door design). See roadmap REJECTED 2026-06-21 entry.

## Refs
- roadmap T-230 (surgical-change), T-231..T-234 (efficiency), REJECTED 2026-06-21.
- Sibling notes: mattpocock-skills-comparison-2026-06-19.md · 9arm-skills-upstream-comparison-2026-06-18.md.
