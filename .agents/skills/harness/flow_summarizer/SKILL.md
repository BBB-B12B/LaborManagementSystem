---
name: Flow Summarizer
description: >
  Generates and maintains process-summary knowledge files (a .md with an embedded inline SVG +
  a redraw table) that describe how a system process actually works, built FROM real sources
  (code, rules, hooks) — never from memory — so an agent can audit the system and propose
  improvements, and so the summary stays in sync when the real behavior changes.
  Trigger on: "summarize how X works", "make a flow diagram of", "document this process",
  "build a process summary", "how does the whole pipeline work", "keep this flow doc up to date",
  "audit the flow doc", "is this diagram still accurate",
  "สรุปกระบวนการ", "ทำไดอะแกรม flow", "สรุปว่าระบบทำงานยังไง", "อัพเดตไฟล์ flow", "ตรวจ flow doc".
  Proactively: after a source file that an existing flow doc depends on changes (flow_freshness.py → [flow-stale]).
triggers:
  - summarize how X works / make a flow diagram / document this process
  - keep flow doc up to date / audit flow doc / is this diagram accurate
  - "สรุปกระบวนการ" / "ทำไดอะแกรม flow" / "อัพเดตไฟล์ flow"
---

## Sections
```
- id: 1
  name: "Scope & Source"
  steps: ["name the ONE process", "pin authoritative source files (anchors)", "refuse if no clear single source"]
- id: 2
  name: "Verify-from-real"
  steps: ["read real code/rules/hooks", "trace ACTUAL behavior line-by-line", "never write from memory — anti-drift core"]
- id: 3
  name: "Write summary"
  steps: ["frontmatter type/topic/domain + source_hashes + last_built", "§1 narrative", "§2 inline SVG", "§3 redraw table", "Related → point to sources, never restate rules"]
- id: 4
  name: "Drift-audit & propose"
  steps: ["compare summary vs reality ONLY (not whole-system)", "list drift gaps", "list improvement directions — propose, do not auto-apply"]
- id: 5
  name: "Freshness & sync"
  steps: ["stamp anchor hashes sha1[:8]", "anchor hash changed → [flow-stale] → re-verify", "R8 index sync"]
```

# Flow Summarizer Skill

## Operating Stance
- **Summary, not source.** A flow doc is a derived VIEW of the system. It must POINT to the authoritative files, never restate their rules — a restated rule is a second copy that silently rots (single-source-of-truth). When in doubt, link instead of copy.
- **From real, never from memory.** Every claim in the summary must trace to a line in a real source file you read THIS session. Memory and prior context are drift vectors — they describe what was true, not what is. This is the core discipline; if you cannot point at the code, you cannot write the claim.
- **One process per doc.** A flow doc summarizes exactly ONE process (file lifecycle, token tracking, boot sequence). A doc that tries to cover "the whole harness" is unmaintainable and always stale. Narrow scope is what keeps it true.
- **Drift-audit is narrow.** When auditing, compare the summary against current reality ONLY — does each claim still match the source? It is NOT a whole-system review. Improvement ideas are PROPOSED to the user, never auto-applied.
- **Anchor hashes are a heuristic, not a proof.** Freshness is "did the files this summary depends on change?" — a fast approximation. It can be false-fresh (a dependency outside the anchor set changed) or false-stale (a cosmetic edit to an anchor that didn't change behavior). State this tradeoff; never present [flow-stale] as certainty.

## Ownership Boundary
- **flow_summarizer OWNS:** creating process-/flow-summary knowledge files, and drift-auditing them against real sources.
- **harness_editor DEFERS here:** when an edit's target is a flow/process-summary doc, harness_editor hands off to flow_summarizer (single owner — no two skills writing the same file).
- **harness_doc_auditor stays separate:** it audits WRITTEN RULES against a rubric; flow_summarizer audits SUMMARY vs BEHAVIOR. Call doc_auditor only if a traced behavior contradicts a written rule.

## When NOT to Use
- Target is a rule file, SKILL.md, or src/ code (not a flow/process summary) → use `harness_editor` / `coder`.
- Request is "review the written rules for quality" → that is `harness_doc_auditor` (rubric on rules), not behavior tracing.
- No clear authoritative source for the process exists → **refuse** (see Prerequisites).

## Prerequisites
**Refuse without all of these** — emit `[flow-refused] reason:<X>` and halt.
- [ ] Exactly ONE process named (not "the whole system")
      → Missing: emit `[flow-refused] reason:no-single-process`
- [ ] At least one AUTHORITATIVE source file identified for that process
      → Why: a summary with no source is fiction — it cannot be verified or kept fresh
      → Missing: emit `[flow-refused] reason:no-source`
- [ ] mece_plan.md dated today + T-N `[/]` (this skill writes knowledge/ files)
      → Missing: emit `[flow-refused] reason:no-plan`

## Anchor-file Selection Rule
An **anchor** is a source file whose change = a change in the PROCESS's behavior. Pick anchors, not every file touched:
- INCLUDE: the script/rule that *implements* the step the diagram shows (e.g. `scripts/index_reconcile.py` for the safety-net box).
- EXCLUDE: files merely mentioned, test fixtures, docs that only describe.
- Heuristic — accept the tradeoff: too few anchors → false-fresh (real drift missed); too many → false-stale (noise on cosmetic edits). Prefer the smallest set that covers every box in the diagram, and say so in the doc.

## Workflow — 5 CoT-ordered sections

### Section 1 · Scope & Source
- Name the ONE process. Reject "summarize everything".
- Pin anchors via the Anchor-file Selection Rule. Grep/probe to confirm each exists.
- No clear single source → `[flow-refused] reason:no-source` · halt.

### Section 2 · Verify-from-real (anti-drift core)
- Read each anchor (grep + offset per R5/Never-Full-Load). Trace the ACTUAL control flow — what the code does, in order.
- Every box/arrow the diagram will show must map to a line you read. Emit `[traced] <claim> ← <file>:<line>` for each.
- A claim you cannot trace → DROP it or mark it an open question. Never fill the gap from memory.

### Section 3 · Write summary
- Frontmatter: `type: knowledge` · `topic` (major/minor per topic_facet_schema.md) · `domain` (closed enum) · `source_hashes:` (anchor → sha1[:8]) · `last_built:` (date).
- §1 narrative (plain words) · §2 inline SVG (single-source, AI-redrawable) · §3 redraw table (so any agent can regenerate the SVG).
- SVG craft (detail at the real grain): one box = one real step — never lump a multi-step stage into a single box. Multi-lane/comparison diagrams (shared-step-as-one-bar + align-by-stage) → rules live in `@.agents/skills/diagram-craft.md` (single source — do not restate here).
- Related: link to anchors + topic neighbors. Never restate a rule that lives in another file — point to its home.

### Section 4 · Drift-audit & propose
- Compare ONLY: each summary claim vs current source. Emit `[drift] <claim>` per mismatch, `[flow-ok]` if none.
- Then list improvement DIRECTIONS for the process (proposals). Present to user — do not auto-apply.

### Section 5 · Freshness & sync
- Stamp/refresh `source_hashes` = sha1[:8] of each anchor; set `last_built`.
- Drift signal: when an anchor's live hash ≠ stored hash → `[flow-stale] path:<doc> anchor:<file>` → re-run Section 2 before trusting the doc. (`scripts/flow_freshness.py` does this at session close.)
- R8 index sync: new doc/script → run indexers → `[r8-sync-check]`.
- New flow doc gotcha: enrolling a new doc creates a BLANK index stub. `backlink_analyzer.py` reads `topics` from the index ENTRY, not the .md frontmatter — so sync the frontmatter `topics` (+ `domain`) into the `index_files.json` entry FIRST, then run `backlink_analyzer.py`, or `related[]` stays 0.
