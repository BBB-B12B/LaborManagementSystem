# CFP Topics — Canonical Topic Registry
# Source of truth for harness_doctor §1 topic matching
# Every CFP must belong to exactly 1 topic.
# date_created: 2026-06-02

---

## topic: phase-gate-skip
name: Phase Gate Skip — MECE Plan Missing or Misplaced
keywords: [phase, mece, skip, plan, gather, info, loop-architecture, approval, artifact, chat, format, placement]
description: AI skips Phase 1 (Info Gather) or Phase 2 (MECE Plan), writes plan to wrong location, or bypasses approval gate.
cfp_ids: [CFP-005, CFP-010, CFP-011, CFP-012, CFP-015, CFP-019, CFP-024, CFP-027]

---

## topic: mece-lifecycle
name: MECE Plan Lifecycle — Staleness, Marking, Clearing
keywords: [stale, resume, mark, section, checkbox, clear, template, reset, incomplete, close, done]
description: MECE plan exists but is stale on resume, sections not marked [X], or plan cleared incorrectly (stripped vs blank template).
cfp_ids: [CFP-008, CFP-014, CFP-018, CFP-021, CFP-025, CFP-029]

---

## topic: token-tracking
name: Token Tracking — Loop Weight, Footer, CHAT_TOTAL
keywords: [token, loop_weight, footer, chat_total, session_total, boot, accounting, threshold, parallel, spike]
description: Token counters wrong at boot, loop weight not incremented, footer missing, or parallel agent tokens not counted.
cfp_ids: [CFP-006, CFP-009, CFP-013, CFP-022, CFP-028, CFP-033]

---

## topic: boot-routing
name: Boot + Per-Turn Routing Skipped
keywords: [boot, routing, c0, c1, c2, c3, b1, b2, b3, topic-switch, resume, turn]
description: Boot sequence (B1-B3) or per-turn routing (C0-C3) skipped or partially executed.
cfp_ids: [CFP-016, CFP-017]

---

## topic: behavior-contract
name: Behavior Contract Missing or Malformed
keywords: [behavior-contract, bc, pre, contract, post, enforce, condition, trigger, rule, enforcement]
description: A rule, condition, or trigger written without Pre/Contract/Post/Enforce structure — relies on hope instead of enforcement.
cfp_ids: [CFP-026, CFP-032, CFP-034, CFP-035]

---

## topic: harness-file-edit
name: Harness File Edit Protocol Violation
keywords: [harness_editor, harness, skill, edit, direct, docs, close, flow_updated, agent, delegate]
description: Harness files (CLAUDE.md, AGENTS.md, SKILL.md) edited directly without invoking harness_editor skill, or close steps skipped.
cfp_ids: [CFP-020, CFP-023]

---

## topic: session-close
name: Session Close Protocol Skipped
keywords: [session, close, session_manager, index_sessions, handoff, compact, json, tracking, checklist, output, display, summary, silent]
description: Session close sequence skipped or run silently — no session_*.json written, no index_sessions update, no checklist output shown to user.
cfp_ids: [CFP-030, CFP-039]

---

## topic: data-safety
name: Data Integrity — Date, Time, DB Safety
keywords: [date, time, datetime, gregorian, buddhist, buddhist-year, db, database, schema, local, api]
description: Local date/time APIs used without Gregorian safety, or DB schema changes without safety gates.
cfp_ids: [CFP-007]

---

## Stats
total_topics: 8
total_cfps_assigned: 26
largest_topic: phase-gate-skip (8 CFPs)

---

## topic: workflow-step-skip
name: Workflow Step Skip — Required Step Bypassed Mid-Flow
keywords: [workflow, step, skip, order, sequence, log, before, fix, doctor, audit, optimization, protocol, mandatory]
description: AI skips a mandatory ordered step in a multi-step workflow — e.g. doctor: log-before-fix, M5: write-before-present, R8: sync-before-done. Jumps to a later step without completing earlier required ones.
cfp_ids: [CFP-036]

---
## topic: premature-close
name: Premature Close — Phase 3 Close Sequence Run Without User Confirmation
keywords: [compact, close, path-a, premature, auto, user-confirm, completion-gate, compact_state, mece_plan, session]
description: AI runs the Phase 3 close sequence (compact_state.md write + mece_plan.md PATH A clear + active_thread phase:done) without user requesting /compact and without SESSION/LOOP_WEIGHT threshold being met.
cfp_ids: [CFP-037]
