# Sub-agent Roster — interactive_teaching_material

> Converted from the source project's 4 loose `.claude/agents/*.md` files into THIS harness's
> R4 routing (model × effort, spawn via the Agent tool · max depth 1 · `[cycle N]` per fan-out).
> Do NOT copy the original agent files in — spawn these roles per the tiers below so they obey
> our cost/routing rules (R4) instead of running at a fixed model.

## R4 mapping (original `model:` → our tier)
| Role | Original model | Our tier | subagent_type | When (pipeline phase) |
|---|---|---|---|---|
| file-indexer | haiku | **MODEL_LOW** | general-purpose | Phase 3.5 — per source file |
| knowledge-extractor | sonnet | **MODEL_MEDIUM** | general-purpose | Phase 5 — extract KB |
| route-architect | sonnet | **MODEL_MEDIUM** | general-purpose | Phases 6–7 — sequence + amplify |
| persona-learner | sonnet | **MODEL_LOW** (read-only reviewer) | Explore | Phase 11 — persona QA (spawn 5–10) |

> Tier rule (R4): lookup/index/read-only → MODEL_LOW (haiku) · analysis/reasoning/write → MODEL_MEDIUM (sonnet).
> Spawn fan-outs in ONE message so they run concurrently. Pre-assign T-IDs before spawn.

---

## file-indexer  · MODEL_LOW · Phase 3.5 (one per source file)
**Goal:** read one source file end-to-end → write a topic→page-range index so later phases find any topic without re-reading.
**Input:** one source file path (PDF/doc).
**Do:** read fully → list headings/sections in document order → write `Knowledge/Index_File/<sourcefile>.index.md` = file path + page count + table (Topic/heading · page range pp. X–Y · 1-line what's there), order matches the doc.
**Gate:** precise page ranges (used to bind atoms to sources). Index = WHERE things are, not WHAT they say. Return index path + topic count.

## knowledge-extractor  · MODEL_MEDIUM · Phase 5 (one per topic atom or small batch)
**Goal:** turn raw sources into builder-ready Knowledge Base entries with worked examples.
**Input:** a topic atom + its bindings from `Knowledge/Knowledge_Index.md` (source links + `file:page` refs).
**Do:** read every bound source (files via Read · links via WebFetch) → cross-check, prefer high-credibility → write `Knowledge/KnowledgeBase/<atom>.md` with: **What it is** (plain) · **Why it matters** · **Worked example** (≥1, reuse the running-example world) · **Common misconception** · **Flow** (any procedure as explicit CoT 1→2→3 with the *why*) · **Sources**.
**Gate:** each entry self-contained · ≥1 worked example · any flow is CoT steps. Return one line per atom (path + status).

## route-architect  · MODEL_MEDIUM · Phases 6–7
**Goal:** sequence KB atoms into ONE coherent zero→hero route, then mark where Animation/Interactive earns its place. Story order ≠ source order.
**Input:** KB atoms in `Knowledge/KnowledgeBase/` + audience profile `Knowledge/audience_profile.md`.
**Do (explicit CoT — write the reasoning):** list every atom + prereqs/unlocks → find connections (roots/extensions/groups) → sequence into ONE linear route zero→mastery, every transition gets a one-line *why-before-what* rationale, no forward references → per atom mark: critical concept → **Interactive** · hard-to-picture → **Animation** (direct if easy, else learner-world analogy) · bind each mark to its KB path.
**Output:** write/update `Production/learning_route.md` — ordered atoms · per-transition rationale · per-atom Animation?/Interactive? + KB path. Consult `storyboard-planning.md` + `craft-reference.md`.
**Gate:** linear route, no jumps, every transition justified · every critical concept has an interaction · every hard concept a visual · each mark cites a KB path.

## persona-learner  · MODEL_LOW (read-only reviewer) · Phase 11 (spawn 5–10: average → weakest)
**Goal:** role-play ONE target learner who actually goes through the media and reports where it confused them. Stay in character — NOT an expert reviewer.
**Input:** (a) a persona (age, grade, daily-life world, prior-knowledge level), (b) the media (HTML path and/or screenshots/snapshot text).
**Do:** learn it for real, in order, as the persona (no skipping, no expert knowledge) → at each screen ask in character: did I understand? which word lost me? did the example connect to MY world? was there something to DO? fun or boring? → be honest about confusion (weakest persona gets stuck easily — say exactly where + why).
**Return ONLY:** Persona (one line) · Completed? Yes/No (if No, which screen + why) · Confusion points (screen · what · guessed cause) · What worked · Top 3 fixes (in the learner's words).
**Why:** the weakest persona's failure is the most valuable signal — surface it loudly.
