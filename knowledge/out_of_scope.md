# Out-of-Scope — Design-Decision Rejection Log

> Settled "we decided NOT to build X" debates. Complements `CODING_FAILURE_PATTERNS.md`
> (which logs BUGS) — this logs design DECISIONS we rejected, so they are not reopened.
> Created: 2026-06-22 (T-224). Ref: mattpocock comparison §2.

## How to use (mirror the T-229 glossary discipline — NEVER always-load this file)

- **READ (grep-first):** before proposing / justifying a NEW feature or capability, the
  pre-execution necessity gate (`skeptical_reviewer`) greps this file:
  `grep -i "<feature-keyword>" knowledge/out_of_scope.md`
  → **HIT** → the idea was already rejected. Surface the stored `rationale:` and do NOT
  reopen unless the user explicitly overrides (then update or remove the entry).
- **APPEND (on a reject verdict):** when `skeptical_reviewer` (or any settled design call)
  decides NOT to build something, add a new `### <slug>` block below with
  problem / rationale / refs / keywords / date.
- **On-demand grep ONLY** — never load this file into every turn (per-turn token weight
  is exactly what entry `e` below rejects).

Entry format:
```
### <slug>
problem:   <what was proposed>
rationale: <why we decided NOT to do it>
refs:      <roadmap line / ticket / discussion>
keywords:  <space-separated grep anchors>
date:      YYYY-MM-DD
```

---

### heavy-postmortem-artifact
problem:   adopt a heavy 9-block post-mortem artifact for every notable bug/incident.
rationale: at our single-user scale `CODING_FAILURE_PATTERNS.md` + `error_index.md` already
           cover bug records; a 9-block artifact is ceremony with no added recall value.
refs:      roadmap line 815(a) · mattpocock comparison §2
keywords:  postmortem post-mortem incident 9-block retrospective bug-record
date:      2026-06-22

### management-talk-skill
problem:   add a dedicated "management-talk" / exec-communication skill.
rationale: single-user project, no eng-org audience to manage upward to; `project_presenter`
           already covers the rare presentation need.
refs:      roadmap line 815(b)
keywords:  management-talk exec executive stakeholder upward-communication
date:      2026-06-22

### design-it-twice-build
problem:   build a "design-it-twice" mechanism (generate two designs, compare).
rationale: parallel-spawn already gives multiple independent attempts (proven in T-222) —
           nothing new to build; the capability exists.
refs:      roadmap line 815(c) · T-222
keywords:  design-it-twice two-designs parallel-design compare-designs
date:      2026-06-22

### ban-file-paths-in-briefs
problem:   triage rule that bans file paths inside briefs/handoffs.
rationale: essence too thin AND contradicts our working file:line style; the only real case
           is cross-day session_handoff, which is a 1-line refinement, not a task.
refs:      roadmap line 815(d)
keywords:  ban-file-paths brief-paths no-paths handoff-paths file:line
date:      2026-06-22

### always-loaded-glossary
problem:   a CONTEXT.md (or similar) glossary loaded into context every turn.
rationale: adds per-turn token weight — directly contradicts the leanness goal. AGENTS.md /
           REPO_MAP + leading-words (T-223) + on-demand glossary grep (T-229) already cover
           shared vocabulary without the always-on cost.
refs:      roadmap line 815(e) · T-223 · T-229
keywords:  always-loaded-glossary context.md per-turn-glossary shared-vocab CONTEXT
date:      2026-06-22

### adr-decision-records
problem:   adopt docs/adr/ architecture-decision-records.
rationale: no felt pain yet (YAGNI). The pain we actually hit is (1) reopening rejected ideas
           — covered by THIS file — and (2) bug recurrence — covered by CFP. ADRs would
           duplicate both at extra upkeep cost.
refs:      roadmap line 815(f)
keywords:  adr decision-record architecture-decision docs/adr
date:      2026-06-22

## T-236 · MERGE token_tracker + token_auditor — REJECTED 2026-06-23
Reject (permanent). Reason: divergent cadence (always-on every-turn vs on-demand >60k),
divergent model floor (haiku vs sonnet), divergent behavior (mechanical echo vs analytical
diagnosis). Merging would force-load rare audit content on the hot path + raise the always-on
floor to sonnet. The only real dedup (the token MODEL) was already single-sourced by T-244.
Do NOT re-propose merging these two — same-topic ≠ same-job.
