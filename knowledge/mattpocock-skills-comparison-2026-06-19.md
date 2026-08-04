# mattpocock/skills — Structure + Comparison vs Our Harness

> Reference note. Source: https://github.com/mattpocock/skills (Matt Pocock — TypeScript educator).
> Captured 2026-06-19 (researched via 3 parallel sub-agents). Read-only study. Companion to
> [[9arm-skills-upstream-comparison-2026-06-18]] — second external skill repo studied for harness development.

## 1. Repo structure

Packaged as a Claude Code plugin (`npx skills add mattpocock/skills`). 34 SKILL.md across 6 buckets:
engineering/ (14, public) · productivity/ (5, public) · misc/ (4, public) · personal/ (2, private) · in-progress/ (5, draft) · deprecated/ (4, retired).
Supporting infra: `.claude-plugin/plugin.json` (flat manifest — only public buckets listed) · `CONTEXT.md` (project glossary, loaded every session) · `docs/adr/` (architecture decision records) · `.out-of-scope/` (rejection log) · CI release workflow · `setup-matt-pocock-skills` (one-time per-repo configurator).

## 2. Standout ideas (philosophy level)

### writing-great-skills — Matt's skill-authoring guide (the gem; user-invoked reference skill)
- **Predictability is the root virtue** — a skill enforces a deterministic PROCESS, not a deterministic output.
- **Leading words** — reuse a pretrained concept the model already thinks with (`tracer bullet`, `red`, `tight`, `fog of war`); repetition accumulates a distributed definition in the fewest tokens. "Vocabulary design IS skill design."
- **Information hierarchy ladder**: in-skill step → in-skill reference → external reference (behind a context pointer). Push too little down → top bloats; too much → hide needed material.
- **Progressive disclosure is variance control, not token optimization** — the WORDING of a context pointer (not its target) decides when the agent reaches the material. A flaky pointer to must-have material is a bug in prose.
- **Kill no-ops** — "does it change behaviour vs the default? If not, delete the whole sentence." Be aggressive.
- **Duplication is always wrong** — one meaning, one place; synonyms that rename a branch are duplication.
- **Completion criteria must be checkable + exhaustive** — vague bounds invite premature completion.
- **Failure modes**: premature completion · duplication · sediment (stale safe-to-add/risky-to-remove layers) · sprawl · no-op.

### Invocation axis as a hard type system (docs/invocation.md)
user-invoked (`disable-model-invocation: true`, no trigger phrasing → model structurally CANNOT fire it) vs model-invoked (trigger-rich). Rule: user-invoked MAY call model-invoked, never the reverse — a directed dependency graph by convention that prevents prompt-injection chains. grill-me (user) is a 3-word wrapper over grilling (model) purely to offer a zero-context-load entry point — invocation axis is a deliberate cost-allocation decision (every model-invoked skill taxes every turn).

### .out-of-scope/ — rejection memory
Each categorically-rejected feature becomes a permanent, citable file (problem / rationale / prior request refs). Prevents reopening the same design debate. Documents philosophy more precisely than a README.

### git-guardrails — structural enforcement
Ships a shell hook to `.claude/hooks/` that exits code 2 (hard auth failure, not advisory) on dangerous git commands. Same layer as our PreToolUse gates.

## 3. Comparison vs our harness

| Matt's | Our analog | Takeaway |
|---|---|---|
| writing-great-skills | skill_auditor / harness_editor | We have auditing skills but no crisp authoring-PRINCIPLES doc. Matt's principles (leading words, kill no-ops, duplication, progressive disclosure as variance control) are directly applicable to leaning our verbose harness. |
| diagnosing-bugs "red-capable command before any hypothesis" | debug (R9 / T-220) | Stronger pre-condition than ours (we require a repro; Matt requires a command that can go RED on THIS bug). Fold into T-220. |
| teach (MISSION.md + learning-records + zone-of-proximal-development; knowledge vs skills vs wisdom; storage- vs fluency-strength) | user-coach | Much deeper than our quiz. Worth borrowing the stateful structure. |
| handoff | session_handoff / session_manager | Convergent (write to temp, reference artifacts not copy). |
| design-it-twice (parallel sub-agents, different constraints, compare on objective axes) | our spawn/Workflow pattern (used in T-222) | Convergent — validates our parallel-spawn approach. |
| triage AGENT-BRIEF "ban file paths — they go stale" | our [pre-read]/file:line everywhere | TENSION worth examining: Matt makes async briefs durable by banning paths; we lean hard on file:line. Different contexts (his = async handoff brief; ours = live index), but the durability point is real for our session_handoff. |
| invocation axis (user vs model invoked, structural) | skill-manifest triggers | We could make the user-invoked vs model-invoked distinction explicit/structural. |
| .out-of-scope/ rejection memory | CODING_FAILURE_PATTERNS (bugs only) | NEW for us: a design-DECISION rejection log, not just a bug log. |
| deprecated bucket lesson: standalone skills collapse into composable primitives | our 24 skills | Proliferating skills = maintenance liability. Audit for merge candidates. |

## 4. Two-signal observation (load-bearing)
Both external skill repos studied — 9arm AND mattpocock — ship LEANER skills than ours, and both treat leanness as a virtue (9arm implicitly; Matt explicitly via "kill no-ops / predictability / leading words"). Our harness is heavy (large CLAUDE.md/AGENTS.md, 24 skills, heavy ceremony). This is now a 2-source signal that a leanness pass is high-value.

## 5. Steal-worthy → development tasks (logged as roadmap)
1. Audit all 24 skills against writing-great-skills principles (kill no-ops, dedupe, leading words) — lean the harness.
2. Add `.out-of-scope/` design-decision rejection memory (complements CFP).
3. user-coach upgrade: adopt teach's MISSION + learning-records + zone-of-proximal-development.
4. (fold) debug T-220: add the "red-capable command before hypothesis" gate.

## Related
- [[9arm-skills-upstream-comparison-2026-06-18]] (first external repo; the leanness signal started here)
- T-219 (scrutinize Trace+Verify) · T-220 (debug fail-path / red-command) — existing tasks this informs.
- T-222 (harness install into DriverWedgeCal) — used the design-it-twice / parallel-spawn pattern Matt documents.
