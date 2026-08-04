# T-253 S0 — Research & Grounding: User-Modeling / Potential-Development System

> Output of T-253 step S0 (research-first). Grounds the system in established principles + real reference implementations BEFORE building. Read this before S1.
> Design context: [[user-modeling-system-design]] (memory). Created 2026-06-23.

The system's stance (decided): a **coach/leader that develops POTENTIAL**, not a tutor that teaches everything. Observe → map strengths + weaknesses + dev-path → push fast but only when readiness is *measured*, never force-fed. Teach only what's needed.

---

## Part A — People-development frameworks (the "coach/leader" layer)

| Framework | Core idea | Software rule for T-253 | Source |
|---|---|---|---|
| **Strengths-Based / Gallup CliftonStrengths** | Grow top talents; *manage* weaknesses around them, don't grind on them | Top-sheet stores a strengths profile inferred from real successes. Route tasks toward top strengths ("you do X well — try this angle"); for weak areas offer support (templates/pairing) instead of forcing | [gallup.com](https://www.gallup.com/topic/strengths-based-development.aspx) |
| **Situational Leadership (Hersey–Blanchard)** | Best style ISN'T fixed — match it to follower readiness (competence + commitment) per task | Track per-skill competence+commitment. Low → directive step-by-step; growing-but-shaky → coach with questions; high → delegate, minimal prompts. **System reduces its own verbosity/control as user's mastery rises** | [situational.com](https://situational.com/situational-leadership/) |
| **GROW coaching (Whitmore)** | Draw out the person's own thinking via 4 stages — don't hand answers | Development conversations = state machine Goal→Reality→Options→Will. Lead with open questions; advance only when user produces own answer; end with a time-bound commitment the system can check later (closes the loop) | [performanceconsultants.com](https://www.performanceconsultants.com/resources/the-grow-model/) |
| **SBI Feedback (CCL)** — most operationalizable | Feedback = Situation + Behavior + Impact, factual, no labels | Every feedback the system emits fills 3 slots: cite the logged instance, describe observed behavior (no adjectives/character judgment), state the impact. Block vague praise/criticism. Aligns with "behaviors-not-labels" already in the design | [ccl.org](https://www.ccl.org/articles/leading-effectively-articles/sbi-feedback-model-a-quick-win-to-improve-talent-conversations-development/) |

**How they fit together:** Strengths = *what to develop* · Situational = *how much to direct vs delegate* · GROW = *conversation structure* · SBI = *feedback structure*.

---

## Part B — Learning science (the "readiness gate" layer)

| Concept | Core idea | Software rule | Source |
|---|---|---|---|
| **ZPD + Scaffolding (Vygotsky)** | Grow fastest in the gap between solo-ability and assisted-ability | Set next difficulty just above *confirmed* independent level. High support first, fade it as success climbs. Level up only when user succeeds with support fully removed | [ERIC EJ1081990](https://files.eric.ed.gov/fulltext/EJ1081990.pdf) |
| **Desirable Difficulties (Bjork)** | Overcomeable challenge improves long-term retention | Stretch until error rate sits in a productive band (~15–30%). ~0% errors → too easy, level up. Can't attempt → overload, strip back | [UNH/Bjork PDF](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf) |
| **Mastery Learning (Bloom)** | Don't advance until prior level demonstrably mastered | Hard gate: level-up requires ≥~85% on a fresh check of the prerequisite. Below → remediate the specific weak sub-skill, re-test | [UC Irvine](https://tea.dtei.uci.edu/resources/mastery-learning/) |
| **Spaced retrieval practice** | Confirm retention by recall over spaced intervals — not self-report | Permanent level-up requires a *delayed* check (e.g. +1 day, +7 days), not same-session only. Failed delayed retrieval demotes topic to "review" | [ERIC ED599273](https://files.eric.ed.gov/fulltext/ED599273.pdf) |
| **Flow (Csikszentmihalyi)** | Engagement peaks when challenge≈skill; must raise difficulty as skill grows | Track rolling challenge/skill ratio. Bored signals (fast, error-free) → raise difficulty. Anxiety signals (errors up, abandonment) → lower / add scaffold | [Frontiers review](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.815665/full) |

**READINESS SIGNALS (observable, performance-based — never self-report).** Level up a topic when MULTIPLE hold:
1. Accuracy ≥~85% on recent *unaided* attempts
2. Delayed retention confirmed (passes a check ≥1 day later — rules out cramming)
3. Falling hint/scaffold dependence (success held as assistance dropped to zero)
4. Productive, *declining* error band (~15–30%, trending down — not stuck/climbing)
5. Faster, more fluent responses over last N attempts (automaticity, not luck)
6. Transfer to a novel variant (handles a re-phrased problem → real understanding)

**Demote / hold** if delayed retrieval fails, errors climb, or success only with hints on. **Self-reported confidence is NOT a readiness signal.**

---

## Part C — Memory architecture (real reference implementations to copy)

**The pattern we want** (big append-only log + small distilled top-sheet read each turn + periodic consolidation) is proven and split across these:

| System | Raw-log layer | Distilled top-sheet | Periodic reflection | Repo / paper |
|---|---|---|---|---|
| **Generative Agents (Stanford)** ★engine | append-only memory stream | (retrieves top-k) | **reflection** — best match | [arxiv 2304.03442](https://arxiv.org/abs/2304.03442) |
| **Letta / MemGPT** ★top-sheet | recall + archival | **core memory** (in-context, fixed size) | self-edits blocks via tools | [github.com/letta-ai/letta](https://github.com/letta-ai/letta) |
| **LangMem (LangChain)** | episodic collection | structured **profile** doc | LLM Memory Manager consolidates | [github.com/langchain-ai/langmem](https://github.com/langchain-ai/langmem) |
| **Mem0** | accumulating memories | extracted facts | ADD-only + entity linking | [github.com/mem0ai/mem0](https://github.com/mem0ai/mem0) |
| **Zep / Graphiti** | bi-temporal graph | — | **fact invalidation** (old facts expire) | [github.com/getzep/graphiti](https://github.com/getzep/graphiti) |

**Generative Agents' importance scoring (canonical):** retrieval score = `recency (exp decay) × relevance (cosine) × importance (LLM-rated 1–10)`; reflection fires when summed importance of recent events crosses a threshold → synthesizes higher-level conclusions stored back as memories. → This IS our "distill at session close" + "deep tidy every N sessions."

**Learner-model math (to quantify strengths per skill):**
- **Bayesian Knowledge Tracing (BKT)** — per-skill mastery as a latent variable updated by each correct/incorrect interaction (prior/learn/slip/guess). `pyBKT` lib exists. [wiki](https://en.wikipedia.org/wiki/Bayesian_Knowledge_Tracing)
- **Open Learner Model (OLM)** — make the model *visible/editable* to the user (maps to our "user can see/edit profile" decision). [Springer SMILI](https://link.springer.com/chapter/10.1007/978-3-642-14363-2_15)
- **Overlay model** — learner = subset of expert/domain model (mastered vs not); simplest, pairs with BKT. [Springer](https://link.springer.com/article/10.1007/s11257-017-9193-2)

**Hands-on reference repos:**
- [NirDiamant/Agent_Memory_Techniques](https://github.com/NirDiamant/Agent_Memory_Techniques) — 30 runnable notebooks (MemGPT, Mem0, Letta, Zep, Graphiti, LoCoMo benchmark). Best starting point.
- [tfatykhov/awesome-agent-memory](https://github.com/tfatykhov/awesome-agent-memory) — curated list.

---

## Recommended architecture for T-253 (synthesis)

1. **Engine** = Generative Agents reflection loop → importance-scored append-only log, periodic synthesis into the profile. Matches our 3-tier cadence (jot during work → distill at close → deep-tidy every N sessions).
2. **Top-sheet** = Letta core-memory / LangMem `profile` → one small structured doc read every turn before answering. Stores: strengths · weaknesses · dev-path · per-skill mastery score · answer-style prefs.
3. **Mastery numbers** = BKT/overlay per skill → drives the Situational-Leadership verbosity dial + the readiness gate.
4. **Visible/editable** = make it an OLM (user can view/correct — our decision (b)).
5. **Drift** = adopt Zep-style fact-invalidation only if traits change over time (our conflict rule: newer+repeated beats old).
6. **Feedback + conversation** = SBI template for feedback, GROW state-machine for development chats.

**Note:** all URLs from live 2026-06-23 search. `letta-ai/letta` was flagged for a final confirm — treat as the canonical Letta path.
