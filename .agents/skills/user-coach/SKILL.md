---
name: user-coach
description: Use after completing a substantial task to quiz the user (2-3 plain-Thai questions) on what was just built or explained, record the results to knowledge/user_learning_profile.json, and adapt how heavily technical terms get glossed based on the user's tracked strengths and weaknesses. This is the learn-alongside loop the user explicitly asked for — USE, QUIZ, RECORD, ADAPT.
---

# user-coach — Learn-Alongside Loop

Every important task becomes a learning moment. Results are tracked in a JSON
profile and explanations adapt to the user's real strengths/weaknesses.
The loop: **USE → QUIZ → RECORD → ADAPT** (output feeds back to self-adjust).

## When to Invoke
- A substantial task just finished (files written, feature built, bug fixed, concept explained).
- The user asks to be quizzed, or asks how they are progressing.
- Manually: the user types `/user-coach` or says "ควิซหน่อย" / "ทดสอบหน่อย".

## When NOT to Use
- Trivial / read-only turns (a lookup, a yes/no, a one-line answer) — no quiz.
- Mid-task: never interrupt execution with a quiz. Wait for the task to close.
- The user is rushed or frustrated — offer gently, never force ("อยากลองทำควิซสั้น ๆ ไหมครับ?").

## Operating Stance
- The user is non-technical and still building English (see memory: `user-profile-non-technical`).
  Treat confusion as a failed explanation, not a slow user.
- Goal is comprehension + confidence, not grading. Celebrate progress; never shame a wrong answer.
- The profile serves the user — it is a coaching tool, not a report card.

## Prerequisites
- `scripts/learning_profile.py` exists (the engine).
- `knowledge/user_learning_profile.json` exists (the store).
- A stable kebab-case topic slug for the task just done (e.g. `harness-gates`, `json-schema`).

## Workflow — USE → QUIZ → RECORD → ADAPT

### 1. USE (every turn — automatic)
The UserPromptSubmit hook runs `analyze` and injects `[learning-state] glossing: <depth> · weak: [...]`.
Read it and adapt this turn:
- glossing **high** → gloss every technical term with Thai meaning + an everyday analogy.
- glossing **medium** → gloss only new or weak terms.
- glossing **low** → gloss sparingly.
- Any topic in `weak: [...]` → explain that area extra carefully this turn.

### 2. QUIZ (at task close)
After delivering and explaining a substantial result, offer a short quiz:
- 2-3 questions on the concepts just used, in plain Thai.
- Mixed format: one multiple-choice, one true/false or fill-in-blank, one "explain in your own words".
- Anchor each question to something concrete from the task — never abstract trivia.
- Wait for answers. Grade gently and explain every item, right or wrong.

### 3. RECORD (right after the quiz)
Run the engine — this is what makes the data USED, not just stored:
```
python3 scripts/learning_profile.py record --topic "<slug>" --correct <N> --total <M> --note "<what clicked / what tripped them>"
```
It recomputes mastery, status, weak/strong areas, and the next glossing depth.

### 4. ADAPT (carries to the next turn)
`record` updated the profile; the hook runs `analyze` every turn — so the next
turn's `[learning-state]` already reflects the new data. Glossing depth and focus
topics adjust automatically. No manual step.

## Output Spec
Quiz block in Thai, for example:
```
📝 ควิซสั้น ๆ (3 ข้อ) — เรื่อง <topic>
1. (เลือกตอบ) ...?   ก) ...   ข) ...   ค) ...
2. (ถูก/ผิด) ...?
3. (อธิบายสั้น ๆ ด้วยคำของคุณ) ...?
```
After the user answers: show `เฉลย + คะแนน N/M`, a one-line plain explanation per
item, then a short encouragement line — then silently run `record`.

## Hard Rules
- NEVER skip RECORD after a quiz — storage-without-use is exactly what the user rejected.
- NEVER quiz mid-task or on a trivial turn.
- ALWAYS quiz in Thai, plain language; gloss any technical term inside the quiz itself.
- ALWAYS reuse a stable kebab-case topic slug so history accumulates per topic over time.
- Keep it short (max 3 questions) — this is reinforcement, not an exam.
