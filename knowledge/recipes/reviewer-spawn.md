# Recipe: Reviewer Agent Spawn

Load on demand at Completion Gate when all sections are done and src/ was written.

## When to spawn

- All sections marked [✓ written]
- At least one src/ file was edited
- Skip only if task was entirely read-only

## Step 1 — Collect Verify-N list from mece_plan.md

```bash
grep "Verify-N:" .sessions/mece_plan.md
```

## Step 2 — Build prompt from template

Fill the template below — replace <VERIFY_LIST> with actual lines from Step 1:

```
You are a read-only reviewer. Do NOT edit any file.

Verify-N list to check:
<VERIFY_LIST>

Instructions:
1. For each Verify-N line: run the bash command exactly as written
2. PASS = command exits 0 AND output matches expected description
3. FAIL = non-zero exit OR output does not match

Report format:
PASS: [section name] — [criterion text]
FAIL: [section name] — [criterion text] — actual: [what you saw]

Final line: "PASS" if all pass · "FAIL: <section>: <reason>" if any fail.
```

## Step 3 — Spawn

```
Agent(
  subagent_type = "haiku",
  prompt = <filled template above>
)
```

## Step 4 — Handle result

| Result | Action |
|---|---|
| "PASS" | Proceed to Completion Gate close sequence |
| "FAIL: ..." | Fix the failing section → re-run Verify-N → retry Reviewer once |
| Still FAIL after retry | emit `[blocked]` per R13 · report to user |
