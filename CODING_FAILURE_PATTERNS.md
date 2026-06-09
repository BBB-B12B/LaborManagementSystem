# CODING_FAILURE_PATTERNS.md — Known Agent Failure Modes

> Each pattern: what happened, why it broke, how to prevent it.
> Add new patterns after post-mortems. Never delete entries.
> CFP-001–CFP-004 archived → knowledge/cfp_archive.md (2026-05-26)

---

## CFP Entry Template
```
## CFP-<N+1> · <title>
topic: <topic_id>          ← REQUIRED · must match a topic in knowledge/cfp_topics.md
count: 0                   ← recurrence count · doctor increments on each new occurrence
recurrences: []            ← list of {date, cause} appended by doctor §1

**Symptom:** <what the agent did wrong>
**Root cause:** <why it happened>
**Prevention:** <rule or BC that prevents it>
**Detection signal:** <keyword/emit that doctor §1 matches against>
```
> topic must be one of: phase-gate-skip · mece-lifecycle · token-tracking · boot-routing · behavior-contract · harness-file-edit · session-close · data-safety
> count + recurrences are managed by harness_doctor — do NOT edit manually.

---

## CFP-005 · Skipping MECE Plan / Modifying Code Without Plan Alignment

**Symptom:** Agent starts modifying or creating source files without first creating, updating, or aligning on a MECE plan (`.sessions/mece_plan.md` or similar). This leads to missed constraints, incorrect file edits, and tool/procedural violations.

**Root cause:**
- Attempting to speed up execution by skipping Phase 2 (MECE Plan) of the Loop Architecture.
- Initiating file modifications during the info-gathering or diagnostics phase before the planning gates are cleared.

**Prevention:**
1. Under Loop Phase 2, always build a section-based plan that maps 1:1 to target Skill sections.
2. Document this plan in `.sessions/mece_plan.md` before making any source code edits.
3. Ensure the user confirms the plan or has explicitly approved the roadmap before starting execution (Phase 3).

**Detection signal:** Agent begins file edits without `[✓ MECE]` trace emitted, or `.sessions/mece_plan.md` is absent or not dated today.

---

## CFP-006 · Unbounded Loop → Token Exhaustion

**What happened:** Agent entered a loop (Phase 1 gather, verify-retry, or skill re-route) with no exit condition. It repeated the same tool calls until SESSION_TOTAL reached the halt threshold.

**Why it broke:** Three root causes:
1. Phase 1 Info Gather Loop had no iteration cap — agent kept judging context "insufficient" and re-reading the same files
2. Retry counter not persisted in session_handoff.md — after resume, retry budget reset to 0, allowing infinite retry across sessions
3. Skill re-route had no cycle guard — A→B→A→B re-routing possible without depth limit

**Prevention:**
- Phase 1: max 3 gather iterations → `[gather-stalled]` + ask user (see CLAUDE.md)
- Retry: write `attempt_count` to session_handoff.md → restore on resume (see session_manager/SKILL.md)
- Re-route: compare target skill vs previous section's skill → skip if same (see CLAUDE.md re-route guard)
- Verify: non-empty output ≠ pass — must match defined condition (see mece/SKILL.md)

**Detection signal:** SESSION_TOTAL approaches threshold but REACT loop doesn't pause; token warnings are skipped or `[loop]` emits continue without exit condition.

---

## CFP-007 · Using Local Date/Time APIs Without Gregorian Safety → Buddhist Year Corruption

**Symptom:**
In applications where dates are compared as strings (`YYYY-MM-DD` or `YYYY-MM`), or stored in the database in Gregorian format, client browsers configured to use local calendars (such as the Thai Buddhist calendar, common in Thailand) will return the local year (e.g. `2569`) instead of the Gregorian year (e.g. `2026`) via `new Date().getFullYear()` or `date.toLocaleDateString()`. This causes comparison logic to break (evaluating `2569 > 2026` as true) or writes corrupted Buddhist era dates into the database.

**Root cause:**
- `new Date().getFullYear()` returns the local calendar year on client browsers like Safari on iOS/macOS when the device calendar is set to Buddhist.
- Using simple string splitting or standard date APIs without enforcing a Gregorian/ISO calendar formatting.

**Prevention:**
1. Never use `new Date().getFullYear()` directly to get a Gregorian year for database/API communications or configurations.
2. Use safe utilities that adjust timezone and force UTC methods (like `utcAdjustedDate.getUTCFullYear()`) or format explicitly using `Intl.DateTimeFormat("en-US", { calendar: "gregory" })`.
3. In this project, use `getLocalGregorianString(new Date())` from `src/lib/date-utils.ts` and parse the year from it.

**Detection signal:** Output contains Buddhist year (≥ 2567) in a Gregorian context, or `date.getFullYear()` used without UTC/Gregorian conversion.

---

## CFP-008 · MECE Plan Staleness on Resume → Edits Target Wrong Lines

**Symptom:** Agent resumes from a previous session and executes Phase 3 on an old MECE plan. Source files were modified externally between sessions (git pull, manual edit). Agent edits wrong line numbers or targets renamed/moved symbols.

**Root cause:**
- Resume flow checks only for pending sections in mece_plan.md (grep count > 0)
- No validation that source files match the state when the plan was created
- Stale line numbers in plan → Edit tool targets wrong context → corrupts file

**Prevention:**
1. Session handoff must store `mece_plan_hash: <sha1 of mece_plan.md at plan creation>`
2. On resume: compare stored hash vs `sha1sum .sessions/mece_plan.md | cut -d' ' -f1`
3. If hash mismatch OR `git status --short src/` shows changes → emit [plan-stale] → ask user
4. User confirms stale plan → proceed · User says rebuild → run Phase 2 again

**Detection signal:** `[plan-stale]` trace emitted at resume

---

## CFP-009 · Parallel Sub-agent Token Accounting Gap → Missed Threshold Triggers

**Symptom:** Session runs parallel fan-out (≥2 sub-agents). After Cycle completes, SESSION_TOTAL reads ~45k but actual total is ~72k. 60k threshold never fires. Session continues past safe limit silently.

**Root cause:**
- Sub-agents estimate tokens independently with no merge coordination
- Orchestrator receives cycle results but does not add sub-agent `tokens_estimated` to SESSION_TOTAL
- Each parallel Cycle widens the gap — SESSION_TOTAL is increasingly stale

**Prevention:**
1. Sub-agent result file must include `tokens_estimated: N` (estimate of that sub-agent's total)
2. Orchestrator: after reading all cycle_N_*.json → sum `tokens_estimated` → add to SESSION_TOTAL
3. Write updated SESSION_TOTAL to session_tokens.md immediately (INVARIANTS.md §I7)
4. Apply R3 threshold check after every merge

**Detection signal:** SESSION_TOTAL suspiciously low after a multi-agent Cycle despite large output volume.

---

## CFP-010 · Skipping Loop Architecture Phases 1 & 2 (Info Gather & MECE Plan)

**Symptom:** Agent jumps to proposing an overall implementation plan artifact without running the Loop Architecture's Phase 1 Info Gather loop (checking files, verifying constraints) and Phase 2 MECE Plan (creating mece_plan.md with 1:1 section mapping and DoD verify criteria).

**Root cause:**
- Attempting to accelerate the task by jumping straight to a high-level design plan instead of strictly executing the MECE-structured planner in `.sessions/mece_plan.md`.
- Conflating the agent-facing MECE plan / task.md tracking with user-facing implementation plans.

**Prevention:**
1. Always follow the Loop Architecture: repeat Info Gather (Phase 1) until context is sufficient, then build a MECE Plan (Phase 2) mapping 1:1 to the target Skill sections in `.sessions/mece_plan.md`.
2. Define a clear `Verify-N` command/criterion for each section in the DoD.
3. Obtain explicit user confirmation on BOTH plan steps and verify criteria before execution (Phase 3).

**Detection signal:** User message complains with "ทำไมไม่ทำตามกระบวนการ" or "you forgot" + missing step name.

---

## CFP-011 · Creating Implementation Plan Artifact Before MECE Plan Approval (Recurrence of CFP-005/CFP-010)

**Symptom:** Agent creates the user-facing `implementation_plan.md` artifact before writing and obtaining approval for the section-based `.sessions/mece_plan.md`.

**Root cause:**
- Jumping directly to the final `implementation_plan.md` design artifact under planning mode rules, while violating the strict harness constraint that requires `.sessions/mece_plan.md` to be created and approved first.

**Prevention:**
1. Under Loop Phase 2, always write the MECE plan to `.sessions/mece_plan.md` first.
2. Never create or edit `implementation_plan.md` or any source code before the MECE plan is approved.

**Detection signal:** User message contains "ทำไมไม่ทำ mece_plan" or "ทำไมไม่ทำตาม" or "rule says" + "mece_plan".

---

## CFP-012 · Skipping MECE Plan for Bug Fixes and Follow-up Tasks

**Symptom:** Agent skipped Phase 2 MECE Plan for a bug fix/follow-up request on an approved task, and immediately edited source files without user permission or confirmation.

**Root cause:**
- Misinterpreting the "minor follow-up" planning exemption and failing to generate a MECE plan when the user requested to follow the process ("ตามกระบวนการของเราเลย mece plan").

**Prevention:**
1. If the user explicitly asks to follow the MECE plan process or complains about a missing plan, always build a `.sessions/mece_plan.md` first.
2. Never skip MECE planning for bugs that involve multi-component integration (such as DB API and React state routing).

**Detection signal:** User message contains "ทำไมไม่วางแผน mece มา" or "ทำไมไม่ทำตามกระบวนการ".

---

## CFP-013 · Omitting Harness Trace Tokens During Implementation → Silent Execution

**Symptom:** Agent executes multi-step tasks (Read, Edit, Write, Bash) without emitting required trace tokens. User sees only results — no `[pre-read]`, `[post-read]`, `[✓ written]`, or `[loop]` markers in responses.

**Root cause:**
- Agent shifts into "implementation mode" when handling many sequential tool calls
- Treats trace emission as optional rather than mandatory per-call obligation
- `[pre-read]` gate before Read and `[post-read]` verdict after Read are skipped silently
- `[✓ written]` grep-verify step omitted after Edit/Write calls
- `[loop]` section progress marker not emitted at section boundaries

**Prevention:**
1. Before every Read call: emit `[pre-read] Target: X · Tier: T<N> · Line: <N>` — no exceptions
2. After every Read result is processed: emit `[post-read] File: X · Verdict: relevant|partial|irrelevant`
3. After every Edit/Write: run `grep` to confirm change exists → emit `[✓ written]`
4. At each MECE section boundary: emit `[loop] Section N done · → Section N+1 next`
5. High tool-call volume is NOT an exemption — traces are more important during dense execution

**Detection signal:** User message contains "ไม่เห็นแสดง" or "ไม่ได้ emit" + trace token name ([pre-read]/[post-read]/[loop]/[✓ written]).

---

## CFP-014 · Closing Session with Incomplete/Unchecked MECE Plan or Compilation Errors

**Symptom:** Agent marks a task/session as complete in `session_handoff.md` and the master roadmap, but leaves sections or steps in `.sessions/mece_plan.md` as unchecked (`[ ]`), or leaves syntax/compilation errors in the modified code (such as missing imports of used functions like `eq`).

**Root cause:**
- Rushing to close the session or perform a handoff without verifying that every single section and step in `.sessions/mece_plan.md` has been checked off (`[x]`).
- Omitting project-wide syntax or type checks (e.g. build checks) before declaring a task completed, leading to broken files being checked into the branch.

**Prevention:**
1. Under Loop Phase 3 Completion Gate, always verify that the active thread task has all MECE plan steps marked as `[x]`.
2. Proactively double check all files modified during the session for missing imports or type errors.
3. Never hand off a session with a status of "completed" in `session_handoff.md` if any MECE plan steps or roadmap items for the session are still open or unchecked.

**Detection signal:** User message contains "ทำไมเหมือนมีงานค้าง" or "ยังไม่เสร็จทำไมข้าม" or "mece_plan ยังไม่เสร็จ".


---

## CFP-015 · MECE Plan Written to Chat/Artifact Instead of .sessions/mece_plan.md (Recurrence of CFP-005/CFP-010/CFP-011)

**Symptom:** Agent displays MECE plan in the chat response or in an `implementation_plan.md` artifact but does NOT write it to `.sessions/mece_plan.md`. The session file remains empty or contains a stale previous task's plan.

**Root cause:**
- Agent treated chat output as equivalent to the required session file write
- Skipped the mandatory `write_to_file` call to `.sessions/mece_plan.md` during Phase 2 M2/M3
- Also violated R11 by mixing Thai text into session files (English only rule)
- Also skipped M4 roadmap entry write before proceeding

**Prevention:**
1. Phase 2 M2: always call `write_to_file` to `.sessions/mece_plan.md` — never substitute with chat text
2. Session files must be English only — no Thai task names, descriptions, or step text
3. M4 (roadmap entries) must be written to `docs/master_roadmap.md` BEFORE asking user to confirm
4. Gate check: before starting Phase 3, verify `.sessions/mece_plan.md` exists and contains current task sections

**Detection signal:** User message contains "ไม่เขียนลง mece_plan.md" or "ทำนอกเหนือ harness" or points to `.sessions/mece_plan.md` still showing old content.

---

## CFP-016 · Skipping Per-Turn Routing (C1-C3) Checks and Working Before Boot in Subsequent Turns

**Symptom:** Agent starts editing files, running grep/find commands, or making database schema/routing actions in subsequent turns of a session without executing the Per-Turn Routing protocol (C1-C3, checking `active_thread.md`, and matching topic switches).

**Root cause:**
- The agent assumed that once the session had booted (B1-B3 run in the first turn), subsequent turns within the same user session did not require running the Per-Turn Routing checks (C1-C3) before performing file edits and tool calls.
- Violated the "Per-Turn Routing (every user message)" constraint: "Run C0 -> C1 -> C2 -> C3 before any work. No exceptions."

**Prevention:**
1. In every single turn, before calling ANY tools (like grep, view, edit), always read `.sessions/active_thread.md` using `view_file` to verify the current task topic and check if a topic switch or plan confirmation is needed.
2. The orchestrator must enforce this check immediately as the first tool call of every turn.

**Detection signal:** User message contains "ทำไมทำงานก่อนขั้น [Boot]" or "VBoot ก่อน" or "ลืมเช็ค boot" or "didn't run C1".

---

## CFP-017 · Skipping Boot Sequence, Per-Turn Routing, and Info Gather/MECE Plan Loop on Task Resumption/Topic Switch

**Symptom:** Agent starts writing `implementation_plan.md` or modifying code immediately on task resumption or when a new request is made, without displaying the Boot reply line 1, running C1-C3 per-turn routing, performing Phase 1 gather loop (`[✓ gather]`), or writing a section-based plan to `.sessions/mece_plan.md`.

**Root cause:**
- Attempting to skip to user-facing implementation plans or file edits without establishing thread phase context or executing the mandatory harness steps first.
- Forgetting that every task switch or task resumption requires a new Boot sequence check, per-turn routing check, and the execution of Phase 1 (Info Gather) and Phase 2 (MECE Plan) of the loop architecture.

**Prevention:**
1. At the start of every session/turn, check if the session needs to boot and emit the boot line 1.
2. Execute C1-C3 per-turn routing checking `active_thread.md`.
3. Run Phase 1 gather loop and emit `[✓ gather]`.
4. Run Phase 2 MECE Plan: write the step-by-step plan mapping 1:1 to skill sections in `.sessions/mece_plan.md` and get user confirmation before any code changes.

**Detection signal:** User message complains with "คุณกำลังละเมิดสิ่งที่เรากำหนดไว้ใน harness" or "ทำไมไม่ทำตามกระบวนการ".

---

## CFP-018 · Missing Resume Staleness Gate Check on Task Resumption

**Symptom:** Agent resumes execution on a previously in-progress task but fails to check if workspace code has changed since the last session or if the MECE plan hash matches, leading to working on stale context.

**Root cause:**
- Neglecting the resume staleness gate check described in the Boot Sequence.
- Directly starting work in Phase 3 without checking `git status` or matching plan hash.

**Prevention:**
1. On boot, if `phase == in_progress`, run `git status` to verify if there are any changes to files.
2. Compare the `mece_plan_hash` to ensure it is up to date, and if stale, ask the user to reconfirm the plan.

**Detection signal:** User complains about stale plan or code mismatch on resumption.

---

## CFP-019 · Incorrect MECE Plan Format or Placement

**Symptom:** MECE plan is not written to `.sessions/mece_plan.md` in the exact format defined, or the agent skips writing the plan to `.sessions/mece_plan.md` and only lists it in chat or chat artifacts.

**Root cause:**
- Omitting step-by-step section planning mapped 1:1 to skill sections inside the designated session file.
- Disregarding the requirement to get user confirmation on both the plan steps and DoD (Verify-N criteria) before making changes.

**Prevention:**
1. Always write the MECE plan to `.sessions/mece_plan.md`.
2. Format the plan with structured sections and Verify-N criteria for each section, and await user approval.

**Detection signal:** User or system warns about invalid MECE plan format or placement.

---

## CFP-020 · Harness File Edits Without Invoking harness_editor Skill First

**Symptom:** Agent begins editing harness configuration files (CLAUDE.md, AGENTS.md, SKILL.md, knowledge/, Implement/) without first routing to `harness_editor` at B2 skill resolution. The MECE plan is built as a generic task, bypassing harness_editor's Refusal Contract checks (mece_plan.md gate, T-ID check, wc-l scope probe, File Size Contract).

**Root cause:**
- Skill routing at B2 matches intent as a general task rather than recognizing harness file edits as a harness_editor trigger.
- Keywords like "edit backlink", "update index", "add to knowledge/" not listed in skill-manifest.json → manifest match fails → generic plan built.
- Agent proceeds with MECE planning before confirming `skill_name=harness_editor`, skipping behavioral contract invocation gate entirely.

**Prevention:**
1. Any task touching CLAUDE.md · AGENTS.md · SKILL.md · knowledge/ · Implement/ · index_files.json · topic_registry.json MUST resolve `skill_name=harness_editor` at B2 before any MECE planning.
2. Implement/04 Invocation Gate (⚡) must be checked: if harness files appear in task scope → route first.
3. skill-manifest.json harness_editor keywords must cover: "edit knowledge/", "update index_files", "backlink", "topic_registry", "update Implement/".

**Detection signal:** MECE plan exists (mece_plan.md) but `[Boot]` trace shows `Skill: <other>` while edited files include CLAUDE.md / AGENTS.md / SKILL.md / knowledge/ / Implement/. Or: harness files modified without `[harness-edit-done]` emitted.

---

## CFP-021 · mece_plan.md Sections Not Marked [X] During REACT Loop Execution

**Symptom:** Agent completes all task sections (all [✓ written] + Verify-N pass) but `.sessions/mece_plan.md` sections remain `- [ ] S<N>` throughout. On next boot or C2 routing check, the harness reads pending `[ ]` sections and either re-executes or wrongly reports task as incomplete.

**Root cause:**
- AGENTS.md Phase 3 L5 DECIDE lacked an explicit "mark mece_plan.md [X]" step.
- Agent tracked section completion only in memory/chat — file state was never updated.
- Consequence: gather_complete.md and mece_plan.md from previous tasks persist into next task, making Phase Transition Gate stale.

**Prevention:**
1. After every section's [✓ written] + Verify-N BOTH pass → immediately write `- [ ] S<N>` → `- [X] S<N>` to `.sessions/mece_plan.md` (file write, not just memory).
2. Phase 3 close step 0 (CLAUDE.md): verify all sections [X] before writing session_handoff.md.
3. L5 DECIDE in AGENTS.md now includes: `→ mark mece_plan.md: - [ ] S<N> → - [X] S<N> (file write)`.

**Detection signal:** After task reports done — `grep "^\- \[ \]" .sessions/mece_plan.md` returns results. Or: `active_thread.md phase: done` but mece_plan still has pending `[ ]` sections.

---

## CFP-022 · CHAT_TOTAL Boot Init Gap — Reset to 0 Instead of system_fixed (7,300)

**Symptom:** After compact-restore or fresh session start, CHAT_TOTAL is initialized to 0 and boot reply shows `Chat: ~0k`. Correct value should be `~7.3k` (system_fixed overhead always present in context).

**Root cause:**
- B1 command writes `CHAT_TOTAL: 0` to `.sessions/session_tokens.md` on compact-restore OR phase≠in_progress.
- No explicit step re-initializes CHAT_TOTAL to system_fixed=7,300 after reset.
- R1 formula documents "CHAT_TOTAL starts at system_fixed = 7,300" as a comment only — no harness enforcement.
- Model relies on working memory to apply system_fixed, but boot response showed 0 instead of 7,300.

**Prevention:**
1. B1 command must write `CHAT_TOTAL: 7300` (not 0) on compact-restore OR phase≠in_progress.
2. Boot reply `Chat: ~NNk` reads from session_tokens.md — correctly shows ~7k after fix.
3. system_fixed = CLAUDE.md ~2.6k + AGENTS.md ~3.4k + skills ~1.3k = 7,300 (one-time context overhead).

**Detection signal:** Boot reply shows `Chat: ~0k` after /compact or fresh session start. Or: `CHAT_TOTAL` in session_tokens.md = 0 immediately after B1 runs (should be 7300).

---

## CFP-023 · harness_editor Step 5 Docs Close Skipped — flow_updated Not Enforced

**Symptom:** harness_editor completes Edit+Verify steps ([pre-edit] + [✓ written]) but Step 5 (Docs Close: harness_flow + Implement/ update) is skipped. [harness-edit-done] emits without enforcing flow_updated=yes. T-034, T-035, T-036 all exhibited this pattern.

**Root cause:**
- harness_editor Output Contract has `flow_updated: <yes|no>` as a descriptive field — no gate prevents [harness-edit-done] if flow_updated=no.
- No Refusal Contract rule blocks task completion when Step 5 is incomplete.
- self_improve §4 says "apply via harness_editor" but has no explicit mece_plan gate or Step 5 check.
- Result: diagnosis/proposal skills (harness_doctor, self_improve) skip Step 5 silently.

**Prevention:**
1. harness_editor Refusal Contract: emit [harness-refused] if task about to close with flow_updated=no → complete Step 5 first.
2. self_improve §4: write mece_plan.md + T-ID in roadmap BEFORE delegating edits to harness_editor.
3. harness_doctor §5: already has mece_plan gate — verify it's followed.

**Detection signal:** Task marked done but harness_flow_*.md has no new entry matching task date. Or: grep "flow_updated: no" in session after harness file edits.

---

## CFP-024 · M5 Skip — mece_plan.md Not Written Before [✓ MECE] Emitted

**Symptom:** Agent emits [✓ MECE] and/or sends plan to user via chat response, but never calls Write/Edit tool to actually write .sessions/mece_plan.md. File either missing or stale (prior task date).

**Root cause:**
- Agent constructs plan content in response text → "feels done" because content exists in output
- No hard block prevents response from being sent before mece_plan.md is written
- self-improve fires → logs intent → but next session model has no memory of it
- Rule lives in AGENTS.md M5 which may be summarized lossy in long sessions

**Prevention:**
1. Before emitting [✓ MECE]: tool call Write mece_plan.md MUST precede the emit in same response
2. C2 routing check: if new task detected → grep .sessions/mece_plan.md date field → if not today → Phase 2 mandatory before any response claiming plan exists
3. [✓ MECE] is a file-write confirmation signal, not a declaration — treat like [✓ written]

**Detection signal:** `grep "^date:" .sessions/mece_plan.md` returns date ≠ today after plan was "confirmed". Or: [✓ MECE] emitted but file shows prior task content.

---

## CFP-025 · mece_plan.md Clear = Stripped Content Instead of Blank Template Reset

**Symptom:** After task complete, "Clear mece_plan.md" step writes minimal/stripped content (e.g. `# MECE Plan — (cleared)`) instead of resetting to the proper blank template from `docs/session_templates/mece_plan_schema.md`.

**Root cause:**
- Agent interprets "Clear" as "delete content" rather than "reset to reusable blank state"
- No explicit pointer to schema template in the Close Checklist item
- "Clear mece_plan.md Phase 1–3 (keep Phase 0 [X])" is ambiguous — doesn't say "use template"

**Prevention:**
1. Close Checklist item must read: "Clear mece_plan.md → Write blank template from `docs/session_templates/mece_plan_schema.md` (Phase 0 [X] kept · Phase 1–3 blank)"
2. Before writing: Read mece_plan_schema.md → copy blank Phase 1–3 sections → Write to mece_plan.md

**Detection signal:** `wc -l .sessions/mece_plan.md` returns < 20 lines after Clear step. Or: file missing Phase 1/Phase 2/Phase 3 headers.

## CFP-026 · Condition/Trigger Written Without Behavior Contract

**Symptom:** Rules like `>30 → emit [compact-warn]` or `IF X → do Y` appear as table rows, inline notes, or `→` shorthand — with no Pre-condition gate, no mandatory enforcement, no Post verification.

**Root cause:** AI writes conditions *descriptively* (as documentation/reference) rather than *contractually* (with enforcement gates). Reader understands what SHOULD happen but nothing enforces it actually fires.

**Prevention:** Every condition/trigger MUST follow BC structure:
```
Pre:      when/how to check (read which file · run which command)
Contract: exact action when condition met (not "emit" — "MUST emit before any response")
Post:     what verifies it happened (what fields must be present · what blocks if absent)
Enforce:  where in the flow this gate sits (C0.5 · PreToolUse hook · Phase gate)
```

**Detection signal:** grep for `→ emit\|>.*compact\|>.*HALT\|>.*STOP\|>.*warn` in rule files → check if adjacent lines contain `Pre:\|Contract:\|Post:\|Enforce:` — if not = CFP-026 violation.

**How to apply:** Before writing any `IF condition → action` rule anywhere in harness (CLAUDE.md/AGENTS.md/SKILL.md/schema templates): first draft Pre/Contract/Post/Enforce — THEN write the rule. Never write the shorthand first and "add contract later."

## CFP-027 · MECE Plan Presented to User Without Being Written to File

**Symptom:** AI presents a MECE plan in chat response (markdown table/sections) and asks user to confirm — but `.sessions/mece_plan.md` is never written. User sees the plan, confirms, and AI starts executing without a written plan file.

**Root cause:** AI treats "presenting the plan" as equivalent to "writing the plan." Phase 2 M5 requires the file to be written BEFORE or AT SAME TIME as asking user to confirm — not after.

**Prevention:** M5 order is strict:
1. Write `gather_complete.md` (Phase 1 close)
2. Write `mece_plan.md` using full template (Phase 2 M5)
3. THEN present plan summary to user + ask confirm
Never present plan in chat before mece_plan.md exists on disk.

**Detection signal:** User confirms plan → AI starts executing → `cat .sessions/mece_plan.md` missing or stale date → CFP-027 violation.

**How to apply:** At M5: Write tool call to `.sessions/mece_plan.md` MUST appear before the response text that presents the plan to the user. If Write fails → stop → fix → never skip to execution.

## CFP-028 · Footer Omitted or Missing Loop_W Field

**Symptom:** Response footer missing entirely, or shows `*(Turn: N | Session: ~NNNk | Chat: ~NNNk)*` without `Loop_W: N` field.

**Root cause:** Footer rule written as prose (`Emit ... every response`) without Behavior Contract enforcement — AI treats it as advisory not mandatory.

**Prevention:** Footer rule MUST use BC structure (Pre/Contract/Post/Enforce). `Contract:` must say "MUST append" not "emit." `Post:` must say "missing = invalid response."

**Detection signal:** Any response ending without `*(Turn:` line · or footer present but no `Loop_W:` field.

**How to apply:** Last step of every response: check footer is present with all fields (Turn · Loop_W · Session · Chat). If missing → re-emit before sending. No exceptions.

## CFP-029 · Phase 3 Close Sequence Skipped Before mece_plan Clear

**Symptom:** Agent runs `Clear mece_plan.md Phase 1–3` without completing the full Phase 3 close checklist — skipping Reviewer spawn, compact_state.md write, CFP count check, harness_doctor check, and Feedback delivery.

**Root cause:** Close treated as a single "clear" action rather than a 7-step checklist sequence. Agent shortcuts to the clear command without verifying all preceding steps are done.

**Prevention:** Phase 3 close block in mece/SKILL_detail.md §Phase 3 close block is a SEQUENTIAL checklist — every `- [ ]` must be ticked before the next step. Clear command is step 4 of 7, not the final step.

**Detection signal:** User says "เรียกหมอ" after close · or compact_state.md missing/stale after clear · or CFP count not verified after close.

**How to apply:** Before running Clear command — verify in order: ① Reviewer PASS ② active_thread phase:done ③ THEN clear ④ compact_state.md written ⑤ SESSION_TOTAL written ⑥ CFP count check ⑦ Feedback + Ask user.

## CFP-030 · Session Close BC Skipped — No session_*.json + No index_sessions Update

**Symptom:** Task completes (mece_plan cleared, active_thread phase:done) but no new `session_<NNN>.json` written and `python scripts/session_indexer.py` never run. Session history and index_sessions.json remain stale.

**Root cause:** Session close treated as optional bookkeeping — no Behavior Contract enforcing it. AI clears mece_plan and stops without checking session file creation or index update.

**Prevention:** mece_plan_schema PATH A/C and mece/SKILL_detail.md Phase 3 close block MUST include Session Close Behavior Contract (Pre/Contract/Post/Enforce). Contract: src/ changed → session_*.json write + session_indexer.py = MANDATORY before clear.

**Detection signal:** `ls .sessions/session_*.json | wc -l` unchanged after close when src/ was modified · or user says "ไม่มี session file" · or index_sessions.json timestamp stale.

**How to apply:** Before clearing mece_plan — run: `ls .sessions/session_*.json | wc -l` → if count unchanged AND task modified src/ → write session_<NNN>.json + `python scripts/session_indexer.py` → verify count +1 → then clear.

## CFP-031 · Loop_W Shows Stale Value (0) — File Not Read Before Footer

**Symptom:** Footer shows `Loop_W: 0` even after turn 2+ · PostToolUse hook has incremented the file · but response uses cached/estimated value instead of live file read.

**Root cause:** Footer BC says "MUST run grep … before footer" but AI appends footer using in-context remembered value from boot (0) instead of running the grep. File is updated by hook but AI never re-reads it.

**Prevention:** Footer step MUST be a live file read — not recalled from memory. Bash grep must run as a tool call in the SAME response, result used directly for Loop_W value. **(T-157) persist-every-turn:** AI MUST write SESSION_TOTAL + CHAT_TOTAL → session_tokens.md EVERY turn before the footer — not only at pause/halt/gate — so the footer never reads a stale file.

**Reset-timing root cause (T-157):** Separate defect under the same topic — SESSION_TOTAL was reset on EVERY boot via a date-match on compact_state.md. A stale/leftover compact_state.md from a *prior, completed* task therefore wrongly triggered a mid-task reset (SESSION→0 when it should have been preserved). **Marker prevention:** reset is now gated by a consume-once `session_reset=armed` field in compact_state.md — armed only by PATH B (genuine /compact at a mece checkpoint) or task-done close, consumed exactly once at the next boot by B1 / the UserPromptSubmit hook (flips →consumed). Stale compact_state with marker absent/consumed → SESSION preserved, never re-reset.

**Detection signal:** `Loop_W: 0` in footer when TURN_COUNT > 1 · OR user says "Loop_W ไม่นับ" / "Loop_W stuck" · OR footer grep result differs from displayed value · OR SESSION_TOTAL drops to 0 mid-task without a genuine /compact (reset-timing defect).

**How to apply:** Before every footer: `grep -E "^(SESSION_TOTAL|LOOP_WEIGHT):" .sessions/session_tokens.md` → use ONLY those values → never use boot-cached value. Loop_W: 0 on turn 2+ = immediate re-read signal. Reset only when marker `session_reset=armed` is consumed — never on a bare date-match.

topic: token-tracking · count: 2 · recurrences: [2026-06-02, {date: 2026-06-08, session: T-157, note: reset-timing defect — SESSION reset on every boot via date-match; stale compact_state.md wrongly reset mid-task. Fix: consume-once session_reset=armed marker (B1 + UserPromptSubmit hook) + persist-every-turn}]

## CFP-032 · R2 Tool Budget Overflow — Multi-Section Work in Single Response
Symptom: Executed S2→S6 (5 sections) in one response with ~37 tool calls, violating R2 ≤5 tool calls/turn. LOOP_WEIGHT spiked to 84.
Root cause: No per-turn budget check between sections; task continued without pausing for user. Budget limit treated as advisory not hard stop.
Prevention: After completing each MECE section, pause response and present result to user before proceeding to next section. Never chain S2→S3→…→SN in a single response.
Detection signal: LOOP_WEIGHT >30 mid-response; multiple [X] marks in mece_plan.md within same response.
topic: behavior-contract
count: 1
recurrences: [{date: 2026-06-04, session: T-085, note: S2-S6 all in one response}]

## CFP-033 · L4.5 PURGE Skipped — Tool Results Retained in Context After Verdict
Symptom: Read/Bash results kept in context after [post-read] or verify verdict emitted; no [dropped] signal; CHAT_TOTAL grows unnecessarily.
Root cause: L4.5 PURGE step treated as optional; no habit of explicitly dropping after verdict. Partial/irrelevant reads stay in context.
Prevention: After every [post-read] irrelevant → immediately note [dropped]; after verify bash → drop output; offload >50L via exec_log. Treat PURGE as mandatory step same weight as L4 VERIFY.
Detection signal: [post-read] verdict emitted with no subsequent [dropped] or [result-offloaded]; tool result >50L without offload path.
topic: token-tracking
count: 2
recurrences: [{date: 2026-06-04, session: T-085, note: multiple Read results kept; no [dropped] emitted}, {date: 2026-06-04, session: T-088, note: harness_doctor inline run — Read/grep results retained; [dropped] not emitted after verdicts}]

## CFP-034 · R5 Index-First [pre-read] Emitted Inconsistently (~60% compliance)
Symptom: [pre-read] Target/Tier/Line signal emitted before ~60% of Read calls; skipped on ~40% — especially under time pressure or when anchor line is already known from grep output.
Root cause: [pre-read] treated as optional annotation instead of mandatory gate; when line is "obvious" from grep context, emission skipped to save tokens.
Prevention: Make [pre-read] mechanical syntax — even one-line emit before every Read, no exceptions. Cost: 10 tokens. Skipping cost: R5 violation + rerun.
Detection signal: Bash grep output followed directly by Read tool call without intervening [pre-read] line in response.
topic: behavior-contract
count: 2
recurrences: [{date: 2026-06-04, session: T-085, note: ~40% of Read calls missing [pre-read]}, {date: 2026-06-04, session: T-088, note: harness_doctor inline — pre-read emitted inconsistently; skipped on known-line reads during fix execution}]

## CFP-035 · R6/Bash Filter — safe_run.py Not Applied Consistently
Symptom: Diagnostic bash calls (grep, python3, find) made without safe_run.py wrapper or grep filter, even when output could be >40L. Only S6 symbol_indexer used safe_run.py.
Root cause: safe_run.py associated mentally with "scripts that scan" not "any bash with unknown output length"; diagnostic commands assumed short.
Prevention: Before every Bash call — assess: could output be >40L? If yes → use safe_run.py or pipe \`2>&1 | grep -iE "error|warn|fail" | tail -20\`. Apply to ALL python3 script calls and find commands.
Detection signal: Bash call with python3/find/git log/npm/yarn without grep filter or safe_run.py prefix.
topic: behavior-contract
count: 1
recurrences: [{date: 2026-06-04, session: T-085, note: grep/find calls without filter; only symbol_indexer filtered}]

## CFP-036 · Workflow Step Skip — Fix Applied Before Mandatory Log/Audit Step
Symptom: AI jumps to a later step (fix/edit/write) without completing an earlier mandatory ordered step first (e.g. harness_doctor: log-to-optimization_logs.md → self-heal, not self-heal → log).
Root: Multi-step workflow protocols (doctor, M5, R8) not enforced as strict sequence — AI treats them as optional checklist rather than ordered gates.
Prevention: Every multi-step workflow with a mandatory order must have a BC Pre/Contract/Post/Enforce. Enforce field must reference the specific "step N must complete before step N+1" constraint explicitly.
Detection: Response applies a fix (Edit/Write to offending file) before any [audit-finding] or [✓ written] log emit — grep response for Edit/Write without preceding audit/log signal.
topic: workflow-step-skip
count: 1
recurrences: ["2026-06-04 T-086 harness_doctor — fixed SKILL.md file_manager ref without writing optimization_logs.md first"]

## CFP-037 · Premature Close — Phase 3 Close Sequence Without User Confirm
Symptom: AI marks task done / clears mece_plan / emits [harness-edit-done] without reading Close Checklist from mece_plan_schema.md — skips Reviewer spawn, [mece-audit], [session-health], knowledge_conflict_checker, Implement/ check
Root: (1) Completion Gate BC misread as auto-trigger · (2) Close Checklist treated as "already known" — never actually read from schema file · AI self-certifies done without running items
Prevention: MUST Read mece_plan_schema.md §Close Checklist EVERY close — not from memory · tick each item explicitly · [harness-edit-done] only after ALL items verified
Detection: grep response for [mece-audit] AND [session-health] AND [r8-sync-check] → any missing after [harness-edit-done] = violation
topic: premature-close
count: 4
recurrences: ["2026-06-04 T-086 harness_doctor — fixed SKILL.md without optimization_logs.md", "2026-06-04 T-095 harness_editor — reported Close Checklist done without reading schema · skipped Reviewer/mece-audit/session-health/kcc"]

## CFP-038 · [fix-required] Signal Emitted But harness_doctor Not Triggered
Symptom: AI emits [fix-required] CFP-N (count≥3) or [fix-escalated] (count≥5) in same response, then proceeds without triggering harness_doctor — threshold signal disconnected from mandatory escalation action
Root: Threshold detection (count++) and escalation action (→ harness_doctor) treated as separate optional steps — AI logs the signal but concludes "not needed" without checking trigger definition
Prevention: [fix-required] OR [fix-escalated] emitted → MUST immediately emit [doctor-invoked] + BLOCK (HALT all work) until [doctor-verdict] received · no exceptions · no deferral · "ไม่ต้องหมอ" = violation
Detection: grep response for [fix-required]\|[fix-escalated] → next action MUST be [doctor-invoked] + HALT · anything else = violation · BC-doctor-gate in mece_plan_schema.md enforces this at Close
topic: workflow-step-skip
count: 2
recurrences: ["2026-06-04 T-088: CFP-028 count=3 → [fix-required] emitted → AI said 'ไม่ต้องหมอ' and proceeded", "2026-06-04 T-095: CFP-037 count=4 → [fix-required] emitted → AI asked user permission instead of invoking immediately"]

## CFP-039 · Close Checklist Run Without Output Display
Symptom: AI completes Close Checklist items internally but shows no per-item result table to user — user cannot verify what was checked or passed.
Root: "งานเสร็จ" summary replaces per-item output; AI conflates running checklist with reporting it.
Prevention: After every Close Checklist run — MUST emit per-item table (item · result · note) before writing phase:done. Silent completion = violation.
Detection: grep response for checklist table (| R8 | or | Roadmap | or | harness_doctor |) after every [session-health] — missing = violation → backfill immediately
topic: session-close
count: 1
recurrences: []
