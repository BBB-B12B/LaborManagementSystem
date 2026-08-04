---
name: Debug
description: >
  Disciplined root-cause debugging of a reproducible failure — bug, crash, wrong output, or regression.
  Enforces disproof-first hypothesis ranking (rule the cheapest-to-kill suspects out before the expensive ones)
  and a breadcrumb ledger that records what was ruled out and why, so the search never loops back on a dead path.
  Deep home of the P3 discipline; R9 carries the always-on short form and points here for hard cases.
  Distinct from coder (which writes/edits code) — debug locates the cause first, then hands the fix to coder/editor.
  Trigger on: "debug this", "find the root cause", "why does this fail", "still broken", "same error",
  "หาสาเหตุ", "ทำไมมันพัง", "มันยังไม่หาย", "ดีบักให้หน่อย".
---

## Sections
```
- id: 1
  name: "Reproduce & Rank"
  steps: ["confirm a reproducible failure", "list ≥2 hypotheses", "rank by cheapest-to-disprove first"]
- id: 2
  name: "Disprove & Ledger"
  steps: ["attack the cheapest hypothesis to KILL it", "record verdict in the ledger", "repeat until one survives", "emit root cause"]
```

---

# Debug

## Operating Stance
- Disprove, don't confirm. The goal each step is to KILL a hypothesis, not to prove your favourite one. A suspect that survives an honest attempt to disprove it is the real lead — confirmation bias hunts for evidence it is right and misses the cause.
- Cheapest kill first. Rank hypotheses by how little effort it takes to rule each out, not by how likely it feels. A 10-second grep that eliminates a whole branch beats an hour chasing the "obvious" cause.
- Keep a breadcrumb ledger. Every ruled-out suspect is written down with the reason it was killed. The ledger is what stops the search from circling back to a dead path two steps later (the classic debugging loop).
- One variable at a time. Change one thing, observe, record. Changing two at once means you cannot attribute the result — and the ledger entry becomes worthless.
- Locate, don't fix. Debug finds and proves the root cause. The actual code change is delegated (coder / editor) — keep the two phases separate so the fix is verified against a known cause.

## When NOT to Use
- No reproducible failure yet (cannot trigger it on demand) → emit `[debug-refused] reason:no-repro` · gather a repro first · a non-reproducible bug produces guesswork, not a ledger.
- The cause is already known + obvious (typo · off-by-one you can see) → emit `[debug-skip] reason:trivial` · hand straight to coder/editor · no ceremony.
- It is a design/plan question, not a failure → that is skeptical_reviewer (plan) or scrutinize (artifact), not debug.
- "Make it faster" with no failing case → that is profiling/optimization, not root-cause debugging.

## When to Invoke
**Phrase variants** (user says one of these):
- "debug this" / "find the root cause" / "why does this fail" / "still broken" / "same error"
- Thai: "หาสาเหตุ" / "ทำไมมันพัง" / "มันยังไม่หาย" / "ดีบักให้หน่อย"
- R9 Error Protocol escalates a hard case here (short form could not isolate it).
- Orchestrator delegates a `Skill: debug` section from a MECE plan.

## Prerequisites
**Hard prerequisites — refuse without these two** — emit `[debug-refused] reason:<X>` and halt. Do not guess.

- [ ] A reproducible failure (exact steps / command / input that triggers it)
      → Why: without a repro every hypothesis is unfalsifiable — the ledger needs a test to kill suspects against
      → Missing: emit `[debug-refused] reason:no-repro` · halt · ask for the steps that trigger it
- [ ] The expected vs actual behaviour stated (what should happen vs what does)
      → Why: "broken" is not a target — the search needs the gap it is closing
      → Missing: emit `[debug-refused] reason:no-expected` · halt · ask "what did you expect instead?"

**Soft input — defaults, does not halt:**
- [ ] Recent changes / suspected area
      → Why: narrows the first hypotheses · Missing: default to widest plausible scope · emit `[debug-scope] defaulting:wide`

## Simpler-Way (P2 · always-on pointer)
Before committing to a deep hunt, ask once: is there a materially simpler explanation or a faster way to the same root cause? → run `scrutinize` if the approach is non-trivial. (scrutinize owns the full simpler-way pass — this is only the reflex pointer · debug-specific phrasing is intentional, not copy-drift from the standard P2 pointer.)

## Workflow — 2 mandatory passes (Reproduce & Rank → Disprove & Ledger)

### Section 1 · Reproduce & Rank
```
[R1] Reproduce the failure yourself — confirm the exact trigger. Cannot reproduce → [debug-refused] reason:no-repro. Reproduced → persist the repro {trigger, check, reproducible} → ERR-N in `error_index.md` (repro-pin FORMAT = harness_doctor §3, single source) so harness_editor Stage 3.6 can validate the fix later.
[R1.5] Trace symptom → origin — follow the failure from where it surfaces back to where it starts; emit `[trace] symptom:<x> → origin:<y>` BEFORE listing hypotheses. Skipping the trace = guessing at the cause.
       Know the fail path (the HOW of this trace) — localize the origin with the cheapest rung that works, climb only if it does not:
         rung 1 · attach a debugger / breakpoint at the symptom site — no code change · read live state first.
         rung 2 · source trace + knob enumeration — read the path and toggle the knobs that flip it: flags · env vars · branches · timing/ordering. Tells you WHICH input changes the failure.
         rung 3 · tagged in-code instrumentation — add temporary `[DBG-xxxx]` log lines (one tag → single-grep cleanup: `grep -rn "DBG-"` → remove before close). Last resort: only when live state + knobs do not reveal the origin.
[R2] List ≥2 hypotheses for the cause — emit `[hypotheses] H1:<...> · H2:<...> [· H3:...]`. One hypothesis = confirmation bias; force at least a rival.
[R2.5] Before ranking, grep `error_index.md` + `index_cfp_fix.json` for a prior similar failure (R9 Step-0 owns this — pointer, not a restate); a known prior fix or failed-approach re-prioritizes the ranking.
[R3] Rank by cheapest-to-disprove FIRST — emit `[rank] H<n>(<cost>) → H<m>(<cost>) → ...`. Cost = effort to KILL it, not likelihood.
```

### Section 2 · Disprove & Ledger  (MANDATORY — never skip the ledger)
```
[D1] Attack the cheapest-to-kill hypothesis with ONE targeted test (grep · log · isolate one variable). Goal: disprove it.
[D2] Record the verdict in the breadcrumb ledger — append ONE line:
       `[ledger] H<n>: KILLED — <evidence>` (ruled out · never revisit)
       `[ledger] H<n>: SURVIVED — <what held up>` (promote to lead)
[D3] Killed → next cheapest hypothesis ([D1]). Survived → it is the lead. Out of hypotheses + none survived → generate new ones from the ledger ([R2]) — do NOT re-test a KILLED one.
[D4] One hypothesis survives a real disproof attempt → emit `[root-cause] <cause> · proven-by:<test>` · hand the fix to coder/editor.
```

## Output Contract
- `[debug-refused] reason:<X>` — missing prerequisite · halt
- `[debug-skip] reason:trivial` — cause already obvious · below ceremony
- `[trace] symptom:<x> → origin:<y>` — symptom traced to its origin, before hypotheses ([R1.5])
- `[DBG-xxxx] <probe>` — temporary tagged instrumentation from [R1.5] rung 3 · single-grep cleanup (`grep -rn "DBG-"`) before close
- `[hypotheses] H1:… · H2:…` — ≥2, emitted before any test ([R2])
- `[rank] H<n> → H<m>` — cheapest-to-disprove order ([R3])
- `[ledger] H<n>: KILLED|SURVIVED — <reason>` — one line per hypothesis tested (the breadcrumb trail)
- `[root-cause] <cause> · proven-by:<test>` — closing line · then delegate the fix
- Locate-only: never emits `[✓ written]` for a code fix — that is coder/editor's contract.

## Output Tone
- Lead with the signal — `[hypotheses]` / `[ledger]` / `[root-cause]` first, reasoning second. No "I think the problem might be…".
- One ledger line per kill. Terse: `[ledger] H2: KILLED — config loads fine, env var is set`. No narration.
- Declarative only. Strip "it seems" / "maybe" / "let's try" — a hypothesis is stated, then killed or promoted.
- Keep the machine-readable signal words in every output — the orchestrator + R9 route on them.

## Hard Rules
- Never test a hypothesis without first ranking ≥2 — a lone hypothesis is a guess, not a search ([R2]+[R3] required).
- Never re-test a hypothesis the ledger marks KILLED — that is the debugging loop the ledger exists to prevent.
- Never change two variables in one test — the result becomes unattributable and the ledger entry is void.
- Never declare a `[root-cause]` that was not proven by a disproof attempt on its rivals — "it must be X" without killing the alternatives is a guess.
- Never apply the code fix here — emit `[root-cause]` and delegate to coder/editor (separate, verifiable phases).

## Relationship to R9 + coder (single-source note)
- `debug` = OWNER of the deep disproof-first + breadcrumb-ledger discipline (P3 full form · load-on-demand).
- R9 Error Protocol carries the always-on SHORT form (rank ≥2 · disprove cheapest first · log ruled-out) and escalates hard cases HERE — it does not re-implement the full ladder.
- `coder` / `editor` own the fix. Debug proves the cause; they change the code and emit `[✓ written]`. Keep the phases separate.

## hand-off
> Spec: docs/session_templates/handoff_block_schema.md · this skill OWNS the root-cause record; downstream applies the fix (T-202 single-source rule).
downstream: editor
artifact: root-cause record (the proven `[root-cause] <cause> · proven-by:<test>` line + supporting ledger)
format: `[root-cause]` + `[ledger]` lines emitted in the debug output
role: primary
required-inputs:
  - `[root-cause]` emitted AND proven-by a disproof attempt on its rivals (not a guess)
  - the failing file/symbol is named in the root-cause record
on-missing: HALT · emit `[handoff-blocked] missing:<inputs>` · ask the user · NO partial flow (cause not proven → no fix flows)
on-present: offer to flow to editor — apply the targeted fix at the named site, then editor emits `[✓ written]`
owner-note: debug stays SOLE owner of the cause-finding; editor only reads the root-cause + changes code
