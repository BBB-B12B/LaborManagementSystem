# Recipe: G0 Starter Interview Pattern

Load on demand when: task arrives with fewer than 3 clarity signals and G0 needs to fire.

## When G0 fires

Skip G0 if task has ≥3 of:
- specific feature name
- file path mentioned
- error message quoted
- phrased as "fix/add/update X in Y"

Otherwise → fire G0 before G1.

## Step 1 — Read REPO_MAP.md for affected-area options

```bash
grep -E "^###|^##" REPO_MAP.md | head -20
```

Use section names as options for the "affected area" question.

## Step 2 — AskUserQuestion call (4 questions, all with options)

```
AskUserQuestion([
  {
    question: "What outcome do you want?",
    header: "Goal",
    options: [
      { label: "Add feature",   description: "New capability or UI element" },
      { label: "Fix bug",       description: "Something is broken or incorrect" },
      { label: "Refactor",      description: "Restructure without changing behavior" },
      { label: "Other",         description: "Describe in free text" }
    ]
  },
  {
    question: "Which part of the system is affected?",
    header: "Area",
    options: [
      // populate from REPO_MAP.md sections — replace these examples
      { label: "API / backend",  description: "src/api/ or server-side logic" },
      { label: "UI / frontend",  description: "src/components/ or pages/" },
      { label: "Database",       description: "src/db/ or schema changes" },
      { label: "Agent harness",  description: ".agents/ or CLAUDE.md rules" }
    ]
  },
  {
    question: "Are there constraints or limits?",
    header: "Constraints",
    options: [
      { label: "None",           description: "No specific constraints" },
      { label: "Performance",    description: "Must not degrade speed/memory" },
      { label: "Scope limit",    description: "Only touch files in one area" },
      { label: "Compatibility",  description: "Must work with existing code" }
    ]
  },
  {
    question: "How will we know it's done?",
    header: "Done when",
    options: [
      { label: "Tests pass",     description: "Existing or new test suite passes" },
      { label: "UI works",       description: "Visible in browser, no errors" },
      { label: "Data correct",   description: "Output or DB state matches expectation" },
      { label: "Other",          description: "Describe in free text" }
    ]
  }
])
```

## Step 3 — Stop criteria

G0 is done when all 4 present:
- goal
- constraints
- affected files / area
- acceptance criteria

→ proceed to G1

## Stall handling

G0 runs ONCE. If user answers still leave spec incomplete → emit `[gather-stalled]` → ask user once in plain text → wait before G1.
