# Harness Doctor — Section Detail
> Full step-by-step procedures for Sections 1–5.
> Behavioral contract summary (Trigger/Refusal/Workflow/Output/Routing) → SKILL.md

---

## Section 1 — Diagnosis
> Topic-match flow replaces recurrence_after_fix lookup.
> Every step has a Behavior Contract (BC). No silent actions.

---

### Step 1.0 — Resume Check (BC-A — MANDATORY FIRST)
```
Behavior Contract A — Resume Check
Pre:    python3 -c "
import json, os
if not os.path.exists('knowledge/index_cfp_fix.json'):
    print('NO_APPROVED'); exit()
idx = json.load(open('knowledge/index_cfp_fix.json'))
approved = [(k,v) for k,v in idx.items()
            if isinstance(v,dict) and v.get('approved_proposal','') != ''
            and v.get('status','') == 'approved']
if approved:
    k, v = approved[0]
    print('APPROVED:', k, '|', v['approved_proposal'][:80])
else:
    print('NO_APPROVED')
"
Contract: IF output starts with 'APPROVED:' →
            emit [resume] CFP-N · approved_proposal: <summary>
            SKIP steps 1.1–1.3 → jump directly to §5 (Execute)
          MUST be FIRST action in §1 — before any other logic
          NEVER skip resume check even on 'fresh' session
Post:   [resume] emitted and §5 entered, OR NO_APPROVED and proceed to 1.1
Enforce: step labeled "1.0 — MANDATORY FIRST" — any §1 that starts at 1.1 = [violation] BC-A
```

---

### Step 1.1 — Keyword Match (BC-B)
```
Behavior Contract B — Keyword Match
Pre:    load cfp_topics.md keywords[] per topic_id
        extract symptom keywords from new error / user-reported pattern
        python3 -c "
import re
topics_raw = open('knowledge/cfp_topics.md').read()
blocks = re.split(r'\n---\n', topics_raw)
topics = {}
for b in blocks:
    tid = re.search(r'^## topic: (\S+)', b, re.M)
    kws = re.search(r'keywords: \[([^\]]+)\]', b)
    if tid and kws:
        topics[tid.group(1)] = [k.strip() for k in kws.group(1).split(',')]
print(topics)
"
Contract: score per topic = count of keywords[] that appear in symptom text
          match = topic where score ≥ 2
          IF match found:
            append to recurrences[] in index_cfp_fix.json (entry for highest count in topic)
            count++ on that entry
            emit [keyword-match] topic: <id> · score: N/M
            SKIP steps 1.2 + 1.3 → proceed to 1.4
          NEVER create new topic if keyword match score ≥ 2
Post:   [keyword-match] emitted + recurrence logged, OR score < 2 for all topics → proceed to 1.2
Enforce: emit [keyword-match] BEFORE updating index — no silent assignment
         if update done without [keyword-match] in session = [violation] BC-B
```

---

### Step 1.2 — AI Judge (BC-C — fallback when keyword match fails)
```
Behavior Contract C — AI Judge
Pre:    keyword match returned no result (score < 2 for all topics)
        read each topic's name + description from cfp_topics.md
        read symptom of new error
Contract: judge semantic similarity: new symptom vs each topic description
          emit verdict BEFORE taking any action:
            [topic-match] topic: <id> · confidence: 0.N  (if best match ≥ 0.7)
            OR [no-match] · confidence: 0.N              (if all topics < 0.7)
          confidence ≥ 0.7 → assign existing topic:
            append recurrence · count++ · proceed to 1.4
          confidence < 0.7 → proceed to exhaustion gate (1.3)
Post:   topic assigned (existing) + proceed to 1.4, OR escalate to 1.3
Enforce: confidence score MUST be emitted before any index write
         silent assignment without confidence emit = [violation] BC-C
```

---

### Step 1.3 — Topic Exhaustion Gate (BC-D — only when 1.1 + 1.2 both fail)
```
Behavior Contract D — Exhaustion Gate
Pre:    BOTH keyword match (score < 2) AND AI judge (confidence < 0.7) failed
        review all 8 topic descriptions one final time (re-read cfp_topics.md)
Contract: MUST emit [new-topic-proposed] with ALL fields before any file change:
            [new-topic-proposed] topic_id: <proposed_id>
            · name: <proposed name>
            · reason: <why no existing topic covers this>
            · nearest_existing: <closest topic_id and why it's insufficient>
          MUST HALT after emit — wait explicit user confirm before:
            - adding topic to cfp_topics.md
            - creating new CFP entry
          EXCEPTION: confidence > 0.9 from AI judge → auto-proceed, emit [auto-confirmed]
Post:   user confirms → new topic added + new CFP created · rejected → log under nearest topic
Enforce: creating new topic_id or CFP with new topic_id WITHOUT [new-topic-proposed] in session
         = [violation] T073-gate · halt · self-improve backfill immediately
```

---

### Step 1.4 — Count Threshold (BC-E — runs after every recurrence append)
```
Behavior Contract E — Count Threshold
Pre:    count field updated in index_cfp_fix.json (immediately after recurrence append)
Contract: read updated count value
          count ≥ 5 → MUST emit [fix-escalated] CFP-N · topic: <id> · count: N
                       escalate to user · no deferral · proceed to §2 with priority=HIGH
          count ≥ 3 → MUST emit [fix-required] CFP-N · topic: <id> · count: N
                       proceed to §2 (Harness Audit)
          count < 3 → emit [recurrence-logged] CFP-N · topic: <id> · count: N
                       END skill (no fix needed yet)
Post:   ONE of [fix-escalated] / [fix-required] / [recurrence-logged] emitted — never silent
Enforce: count update step always runs threshold check IMMEDIATELY after write
         skipping threshold check after count++ = [violation] BC-E
```

---

### Step 1.5 — Read CFP Entry (only when §2 Audit triggered)
```
[pre-read] Target: target_cfp entry · Tier: T1
grep -n "^## <target_cfp>" CODING_FAILURE_PATTERNS.md → line L
Read CODING_FAILURE_PATTERNS.md offset=L limit=30
[post-read] verdict: relevant | partial | irrelevant
→ extract: Symptom · Root cause · Prevention · Detection signal
→ store: target_cfp · target_topic · prior_fix_descriptions[]
→ record diagnosing_model (default: "claude-sonnet-4-6")
→ emit [diagnosis] target_cfp "<title>"
  · Topic: target_topic · Count: N · Fixes tried: M · Still recurring
  · Model: diagnosing_model · Symptom: <text>
  · Recurrence hypothesis: <why fix didn't hold>
```

---

## Section 2 — Harness Audit

Goal: locate WHERE the structural gap is that lets the pattern slip through again.

**Group → Audit target mapping:**

| Group | Primary audit targets |
|---|---|
| `skip_planning` | CLAUDE.md R13 · AGENTS.md §Loop Architecture · PreToolUse hook for gather/mece gate |
| `boot_gap` | CLAUDE.md §Boot · AGENTS.md §Boot Sequence · PreToolUse hook |
| `skip_verification` | AGENTS.md §Phase 3 L4 · CLAUDE.md R12 |
| `rule_drift` | CLAUDE.md §R<N> matching violation · AGENTS.md §Quick Reference |
| `premature_report` | AGENTS.md §Completion Gate |
| `index_desync` | CLAUDE.md R8 · AGENTS.md §Backlink Rule |
| `db_safety` | CLAUDE.md R15 · INVARIANTS.md §I2 |
| `token_management` | CLAUDE.md R3 · AGENTS.md §TOKEN PAUSE |

```
Step 1: Grep audit targets for target_group
  grep -n "<detection_signal_keywords>" CLAUDE.md | head -10
  grep -n "<detection_signal_keywords>" AGENTS.md | head -10
  (run both in one Bash call)

Step 2: Check hooks in settings.json
  grep -n "PreToolUse\|PostToolUse\|Stop" .claude/settings.json 2>/dev/null | head -15

Step 3: Classify the gap — exactly ONE of:
  (a) Rule exists · detection signal too narrow → widen keywords/condition
  (b) Rule exists · no hook enforces it → propose hook addition
  (c) Rule exists · agent ignores it → strengthen with emit gate + HALT
  (d) Rule missing entirely → draft new R-N or §section

Step 4: Emit [audit-finding]
  [audit-finding] Gap type: <a|b|c|d>
  · Location: <file> §<section> line <N>
  · Why prior fix failed: <specific reason — not vague>
  · Evidence: <grep output line that shows the gap>
```

---

## Section 3 — Proposal

```
Step 1: Draft structural fix based on gap type
  (a) Widen: expand detection_signal keywords in existing rule · edit that line only
  (b) Hook: propose new PreToolUse/Stop entry in .claude/settings.json
  (c) Gate: rewrite rule step as emit + HALT condition
  (d) New rule: draft R-N text following existing rule format

Step 2: Dry-run validation
  Does proposed change catch the original symptom?
    Simulate: if detection_signal_new matches symptom → YES
  Does it conflict with INVARIANTS.md?
    grep -iE "<2-3 key terms from proposal>" INVARIANTS.md | head -3
  Both OK → proceed to Step 3
  Conflict or dry-run fail → revise → max 2 revisions
    Still failing after 2 → emit [proposal-mismatch] · explain gap · ask user to redirect

Step 3: Present proposal — HALT · do NOT execute yet
  [harness-proposal] target_cfp "<title>"
  Model: diagnosing_model
  Gap type: <a|b|c|d>
  Location: <file> §<section> line <N>
  Change:
    BEFORE: <current text (≤3 lines)>
    AFTER:  <proposed text (≤5 lines)>
  Why this works: <how it prevents recurrence structurally>
  Why prior fix failed: <specific — not generic>
  → พิมพ์ "ทำเลย" เพื่อ execute หรือ "skip" เพื่อข้ามได้ครับ
```

---

## Section 4 — Approval Gate

```
HALT — read no files, edit no files until explicit user confirm arrives in chat.

Accepted: "ทำเลย" / "proceed" / "yes" / "ได้เลย" / "confirm" → Section 5
Rejected: "skip" / "ไว้ก่อน" / "no" →
  emit [harness-proposal-deferred] target_cfp
  write to session_handoff.md: cfp_deferred: { "target_cfp": deferred_count + 1 }
  end skill
```

---

## Section 5 — Execute + Verify

```
Step 1: Apply approved change
  [pre-edit] Symbol/Rule: <name> · used_in: <files> · safe to edit: yes
  Edit target file at identified location
  [post-read] verdict after edit: relevant (confirm change is present)
  Conventions:
    New rule → insert at R-N slot maintaining numerical order
    New hook → valid JSON, test with: python3 -c "import json; json.load(open('.claude/settings.json'))" → no error
    Widen detection → edit detection_signal line only, do not touch other CFP fields

Step 2: Update index_cfp_fix.json — record new fix attempt
  python3 -c "
import json
from datetime import date
idx = json.load(open('knowledge/index_cfp_fix.json'))
entry = idx.get('target_cfp', {})
entry.setdefault('fixes', []).append({
    'applied_date': str(date.today()),
    'by_model': 'diagnosing_model',
    'description': 'structural_change_summary',
    'status': 'pending'
})
entry['status'] = 'resolved-pending'
idx['target_cfp'] = entry
json.dump(idx, open('knowledge/index_cfp_fix.json', 'w'), indent=2)
print('fix recorded: pending')
  "

Step 3: Verify detection signal now works
  Re-run the Detection signal from the CFP entry
  → confirm it matches the new keyword / emit / gate
  PASS → [✓ detection-signal] Works
  FAIL → attempt one more refinement → still fail → [blocked] and report

Step 4: Update CODING_FAILURE_PATTERNS.md Fix Attempts section
  grep -n "^## target_cfp\|^### Fix Attempts" CODING_FAILURE_PATTERNS.md → find position
  Append under ### Fix Attempts:
    - [TODAY] [diagnosing_model] <structural_change_summary> → status: pending

Step 5: Completion
  [✓ harness-fix] target_cfp · Gap: <type> · File: <edited> · Detection: verified
  Fix status in index_cfp_fix.json: resolved-pending
  (session_manager §3 Step 0.6 will auto-update to "recurred" or "resolved" on next close)
```
