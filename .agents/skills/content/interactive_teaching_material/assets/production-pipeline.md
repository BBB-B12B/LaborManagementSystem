# Production Pipeline — Teaching-Media SOP (Phases 0–11)

> The master operating procedure for producing one piece of interactive teaching media,
> from client scoping to persona-tested delivery. The skill's other assets
> (`storyboard-planning.md`, `craft-reference.md`) are the **craft** layer (phases 6–7,10);
> this file is the **production** layer that wraps them.
>
> **The pipeline is a spiral, not a line.** Phase 11 (persona testing) feeds back into
> phases 6/7/10 — iterate until target personas can actually learn it. See "Loop" below.

---

## Phase 0 — Mindset (the lens on every phase, not a step)

Apply these beliefs to *every* decision downstream. When any choice is unclear, resolve it here.

1. **Everyone arrives Zero-Knowledge.** They do not know what you know. An example that looks
   trivial to you may be brand-new to them. Build the bridge; never assume the prior step.
2. **Participate, don't spectate.** Learning happens by *doing*, and it must be *fun*. Every
   screen has a hands-on interaction with instant feedback. If a screen is read-only, add one.
3. **Show, don't tell.** Explain with a picture or animation so the idea is seen directly. Reach
   for a visual first; prose only annotates it.
4. **Don't judge prior knowledge by your own experience.** Prefer the *simplest* example, and
   **reuse the same running example** — extend what they already learned, grow gradually, never jump.
5. **Story order ≠ source order.** Explode the knowledge into atoms → find the connections →
   *then* re-sequence so it grows step by step (see `[[knowledge-rearchitecture]]`). Never follow
   the textbook's order by default.
6. **Target the average-down-to-weakest.** Pitch the neutral default at the *average* learner and
   make it reach the *weakest* — never the smartest. For the weakest, layer extra context via
   **tooltips / hover / "show me more"** so the default stays clean but help is one tap away.

These six map to the skill's two pillars and Rules 1–9 in `SKILL.md`. Phase 0 is satisfied when
the maker can restate all six in the learner's own world.

---

## Standard folder map (the artifacts fall out of the phases)

```
<project>/
  New/                          # phase 3 inbox — user drops raw files here; emptied once filed
  Knowledge/                      # (knowledge/ on disk) — per-piece production artifacts below
    _reference/                   # standing methodology + convention docs (not per-piece) — see _reference/INDEX.md
    audience_profile.md         # phase 1
    Knowledge_Index.md          # phase 2 (sources) + phase 4 (exploded atoms + bindings)
    Index_File/                 # phase 3.5 — one index per source file (topics + page ranges)
      <sourcefile>.index.md
    KnowledgeBase/              # phase 5 — concentrated, usable knowledge per atom
      <atom>.md
  Production/
    learning_route.md           # phase 6 (route) + phase 7 (anim/interactive marks)
    assessment_map.md           # phase 8 (groups + checkpoints + question bank)
    persona_test_report.md      # phase 11
  04_WORK_ROADMAP.md            # phase 9
  <mece_plan per task>          # phase 10 (memory/workpad.md or .sessions/)
  README.md                     # repo_map tree — auto-updated on every add/remove (see sort-files)
```

---

## Phase 1 — Audience scope  *(root: do this FIRST)*

Nothing about content can be decided before you know the learner. This is the true starting point.

- **Input:** interview the commissioner (the person ordering the media).
- **Action:** establish — who are the users? what level/grade? province & context (signals readiness)?
  quality/readiness of the learners? Use educational **psychology** to frame the questions and
  interpret answers. Use the built-in **`WebSearch` + `WebFetch`** tools for research, school-ranking
  tables, standardized-test results to profile the cohort. Save anything found into `Knowledge/`.
- **Engine:** `WebSearch` + `WebFetch` · model: sonnet
- **Artifact:** `Knowledge/audience_profile.md` — must contain: age & daily-life world; prior-knowledge
  baseline; an **"average learner" persona** AND a **"weakest learner" persona**; cited research/data.
- **Gate (DoD):** profile names the learner's age + world, both personas exist, ≥1 cited source for any
  readiness claim. Phase 0 belief #4 & #6 are now actionable.
- **CoT hook:** *"If I only knew this profile, what is the ONE example world every screen should live in?"*

## Phase 2 — Topic scope + source research

- **Input:** interview which lesson/topic to build; any special emphasis; the *why*.
- **Action:** the moment the topic is fixed, research it broadly — use the **`deep-research` skill**
  (fan-out + adversarial verify) or **`WebSearch`/`WebFetch`** directly. Collect **popular,
  high-credibility** sources — teaching materials especially. For each: link + topic/heading + metadata
  ("if you ever need X, this link has it"). Save into `Knowledge_Index.md` for future in-work web searches.
- **Artifact:** `Knowledge/Knowledge_Index.md` (sources table: link · topic · meta · why-relevant).
- **Engine:** `deep-research` skill · `WebSearch`/`WebFetch` · model: sonnet
- **Gate:** ≥ a handful of credible sources, each row complete; emphasis from the commissioner recorded.
- **Note:** Phase 2 (web gathering) and Phase 3 (file gathering) **run in parallel** — both feed Phase 4.

## Phase 3 — Collect materials + Repo_map

- **Input:** ask for textbooks, past exams, all related docs. User places them in `New/`.
- **Action:** once complete, file every item into the structure above; write/refresh `README.md`
  **repo_map tree** (use the `sort-files` skill). The tree auto-updates on every add/remove.
- **Artifact:** filed folders + current `README.md` tree.
- **Gate:** `New/` is empty (everything filed); README tree matches disk.

## Phase 3.5 — Per-file index

- **Input:** every source file from Phase 3.
- **Action:** read each file; index its headings/topics with **page ranges** (topic → pp. X–Y).
- **Artifact:** `Knowledge/Index_File/<sourcefile>.index.md`, one per file.
- **Gate:** every source file has an index; each topic maps to a page range. Use a sub-agent for
  multi-file reads (R4).

## Phase 4 — Explode topics + bind to sources  *(the EXPLODE step)*

- **Input:** topic (Phase 2), source links (Phase 2), file indexes (Phase 3.5).
- **Action:** explode the topic into the smallest sub-topics (atoms) → a list. For each atom, attach:
  relevant research link(s) from Phase 2 + the file path + page from the Phase-3.5 indexes.
- **Artifact:** enrich `Knowledge_Index.md` — atom · source links · file:page references.
- **Gate:** every atom has ≥1 source reference (link or file:page). Nothing unsourced.

## Phase 5 — Extract Knowledge Base  *(the EXTRACT step)*

- **Input:** the bound atom index (Phase 4).
- **Action:** read the bound sources/files per atom; write **concentrated, usable** knowledge per atom,
  **with worked examples**, so an AI builder understands it deeply. For any process/flow, write it as
  **Chain-of-Thought steps**.
- **Artifact:** `Knowledge/KnowledgeBase/<atom>.md`, one per atom.
- **Gate:** each KB atom is self-contained, has ≥1 worked example, and any flow is expressed as CoT steps.

## Phase 6 — Sequence into a learning route  *(the CONNECT + SEQUENCE step)*

- **Input:** the KB atoms (Phase 5).
- **Action:** **CoT again** to order the atoms into a coherent story / learning route — which roots
  connect, what extends what, what belongs together, the path start→finish so a learner goes from
  zero to mastery systematically. This is the **Frame** of the media. Use `storyboard-planning.md`
  (and the Phase-0b CoT ladder `[[chain-of-thought-phase]]`).
- **Artifact:** `Production/learning_route.md` — ordered atoms + a one-line rationale per transition
  (*why this before that*).
- **Gate:** one linear route, no jumps, every transition justified; grows gradually (Phase 0 #5).

## Phase 7 — Mark Animation / Interactive points  *(the AMPLIFY step)*

- **Input:** the learning route (Phase 6).
- **Action:** for each atom decide where a visual/animation or an interaction earns its place. Two triggers:
  - it's a **critical concept** the next atoms build on → add **Interactive** to test & cement understanding (hands-on, fun);
  - it's **hard to picture from text** → add **Animation**; if direct depiction is easy, do it straight;
    if hard, use an **analogy/comparison** that makes it visible.
  More interactive is better — it holds attention and beats boredom. Bind each mark to its KB file path
  (Phase 5) so the builder pulls the right knowledge. Craft details in `craft-reference.md`.
- **Artifact:** enrich `learning_route.md` — per atom: Animation? Interactive? + KB path.
- **Gate:** every critical concept has an interaction; every hard concept has a visual/analogy; each
  mark cites a KB path. The Frame is now complete.

## Phase 8 — Group + assessment points

- **Input:** the marked route (Phase 7).
- **Action:** group atoms that belong together; insert **end-of-section checkpoints** as rest/pause
  points; list candidate **end-of-section questions** (future exam bank) and **final post-test** questions.
- **Artifact:** `Production/assessment_map.md` — groups · checkpoint per group · question bank · final test.
- **Gate:** each group has a checkpoint; a question list exists per group and for the final.

## Phase 9 — Roadmap

- **Input:** the Frame + assessment map.
- **Action:** write the detailed master plan — one roadmap item per route screen/section. Each item lists:
  - **file:** the working file
  - **Task context:** what to build (e.g. "Animation X + Interactive workshop Y in this section")
  - **DoD & Verification:** done when … and quality is verified how (must have Animation + Interactive workshop, etc.)
- **Artifact:** `04_WORK_ROADMAP.md`.
- **Gate:** every route screen is a roadmap item with all three fields filled.

## Phase 10 — MECE build plans + spawn  *(the BUILD step)*

- **Input:** the roadmap (Phase 9), taken one task at a time.
- **Action:** apply **MECE planning** — decompose a roadmap task into the smallest sub-tasks; group
  sub-tasks that can run **in parallel** (not dependent) into one spawn group. Each sub-task specifies:
  - **skill & tool:** which skill to invoke + which tools
  - **model:** fit to difficulty (simple → low model e.g. Haiku; reasoning → Sonnet — see R4)
  - **file:** the working file
  - **Task context:** the build detail
  - **DoD & Verification:** done when … and verified how
  Run to completion, **capture the rendered media (screenshot)** and review it against the concept
  (clean, on-concept, beautiful), then close the task in the Roadmap.
- **Artifact:** a `mece_plan` per task (in `memory/workpad.md` per R13/R14, or `.sessions/`).
- **Gate:** each sub-task has all 5 fields; each finished task has a reviewed screenshot + roadmap ticked.

## Phase 11 — Persona QA  *(the PROVE step)*

- **Input:** the built media (Phase 10).
- **Action:** **spawn 5–10 persona agents** matching the target audience (Phase 1, spanning
  average → weakest). Each does a real learn-through as an outsider and reports back where it confused
  them and what to fix.
- **Artifact:** `Production/persona_test_report.md` — per persona: confusion points + fix list.
- **Gate:** ≥5 personas covering average→weakest; each returns actionable feedback.

---

## Loop (the spiral)

Phase 11's feedback feeds **back** into Phase 6 (resequence), Phase 7 (add/refine anim & interactive),
and Phase 10 (rebuild the weak screens). Re-run the affected phases and re-test until personas — including
the **weakest** — can complete the media and demonstrate understanding. Only then is the piece done.

## Quick map: phase → artifact → Engine → Model (Harness-style routing)

Each phase names its **Engine** (skill / agent / tool) and a **model** floor→recommended, mirroring the
Harness `skill-manifest.json` `model_routing` convention. Agents live in `.claude/agents/`; skills in
`.claude/skills/`; tools are Claude built-ins.

| Phase | Artifact | Engine (skill · agent · tool) | Model |
|---|---|---|---|
| 0 | (mindset preamble) | `SKILL.md` pillars + Rules · `[[audience-teen-first-framing]]` | — |
| 1 | `Knowledge/audience_profile.md` | tool: `WebSearch` + `WebFetch` | sonnet |
| 2 | `Knowledge/Knowledge_Index.md` (sources) | skill: `deep-research` · tool: `WebSearch`/`WebFetch` | sonnet |
| 3 | filed folders + `README.md` tree | skill: `sort-files` | haiku |
| 3.5 | `Knowledge/Index_File/*.index.md` | agent: `file-indexer` | haiku |
| 4 | `Knowledge_Index.md` (atoms+bindings) | main · `[[knowledge-rearchitecture]]` | sonnet |
| 5 | `Knowledge/KnowledgeBase/*.md` | agent: `knowledge-extractor` · tool: `WebFetch` | sonnet |
| 6 | `Production/learning_route.md` | agent: `route-architect` · `storyboard-planning.md` · `[[chain-of-thought-phase]]` | sonnet |
| 7 | `learning_route.md` (anim/interactive marks) | agent: `route-architect` · `craft-reference.md` | sonnet |
| 8 | `Production/assessment_map.md` | main · `[[handout-deliverable-recipe]]` | sonnet |
| 9 | `04_WORK_ROADMAP.md` | main (orchestrator) | sonnet |
| 10 | `mece_plan` per task | skill: `interactive-teaching-material` · CLAUDE.md R13/R14 | sonnet-high |
| 11 | `Production/persona_test_report.md` | agent: `persona-learner` ×5–10 | sonnet |
