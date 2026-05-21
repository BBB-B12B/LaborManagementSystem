---
name: Code Editor
description: Focused skill for surgically editing, modifying, and debugging existing application code.
---

## Sections
```
- id: 1
  name: "Diagnose"
  steps: ["R9 3-checks (error_index → symbol_index → file_index)", "read source at line", "assess blast radius"]
- id: 2
  name: "Edit & Verify"
  steps: ["R5 index-first lookup", "apply targeted edit", "[✓ written] grep verify change exists"]
- id: 3
  name: "Sync & Close"
  steps:
    - "python scripts/symbol_indexer.py"
    - "roadmap: mark [X] T-{N}-{BugID}-{AttemptID} with completion annotation"
    - "error_index: assign next ERR-N → write full entry (Symptom/Root Cause/Resolution)"
    - "active_thread.md → phase: done"
```

# Code Editor Skill

## Responsibilities
You are the "Surgeon". Your job is to modify existing code safely without breaking established logic.

## Roadmap Protocol (MANDATORY — before and after every edit)

**Before editing:**
```bash
# Step 1 — find parent task and assign ID
grep -n "\[.\] T-" docs/master_roadmap.md | tail -10
# → Bug fix:  find parent T-<N> → count existing bugs → assign T-{N}-{BugID}-01
# → Sub-task: find parent T-<N> → assign T-<N>.{sub}: <description>

# Step 2 — add entry to roadmap ([ ] = not started, [/] = in progress)
# Format to add:
[ ] T-{N}-{BugID}-01: <short description of bug>   ← add before starting
[/] T-{N}-{BugID}-01: <short description of bug>   ← update when starting

# Step 3 — Run R9 3-step checks before touching any code
```

**After editing — 4 mandatory steps:**
```bash
# Step 1 — sync symbol index
python scripts/symbol_indexer.py

# Step 2 — mark roadmap done with completion annotation
# Find the [ ] / [/] entry, replace with:
[X] T-{N}-{BugID}-01: <description> (→ ERR-XXX) · attempts: 1 · tool_calls: <N>

# Step 3 — assign ERR number and write error_index entry (REQUIRED for every bug fix)
grep "## ERR-" knowledge/error_index.md | tail -1
# → take highest number + 1 → assign as ERR-XXX

# Write entry at bottom of knowledge/error_index.md:
## ERR-XXX: <Short title>
- **Task:** T-{N}-{BugID}-01 · **Session:** session_<NNN>
- **File:** src/path/to/file.ts · **Line:** <N>
- **Symptom:** <what the error looked like>
- **Root Cause:** <why it happened>
- **Resolution:** <exact fix applied>

# Step 4 — call variable_manager if any symbol body was changed
```

## Editing Best Practices

### Lookup Protocol — 3-Tier Escalation

Every lookup follows this exact sequence. Emit a trace at each step. Stop the moment you have a line number.

---

**Tier 1 — grep index (ALWAYS start here)**

```bash
# Action:
grep -A 8 '"SymbolName"' knowledge/index_variables.json
# or for file lookup:
grep -A 6 '"src/path/file.tsx"' knowledge/index_files.json
```
Emit trace:
```
**[index T1]** Symbol: `SymbolName` → source: `src/components/LoginForm.tsx` · line: 42
```
→ Got source + line? Emit pre-read gate → Read → STOP. Do NOT go to Tier 2.
```
**[pre-read]** Target: `SymbolName` · Tier: T1 · Line: 42 · Will read: offset=37 limit=60
```

---

**Tier 2 — widen index (only if Tier 1 found nothing)**

```bash
# Action:
grep -B 2 -A 20 '"SymbolName"' knowledge/index_variables.json
```
Emit trace:
```
**[index T2]** Symbol: `SymbolName` → <found: line N | not found: proceed to T3>
```
→ Got line number? Emit pre-read gate → Read → STOP.
```
**[pre-read]** Target: `SymbolName` · Tier: T2 · Line: <N> · Will read: offset=<N-5> limit=60
```
→ Still no line number? → proceed to Tier 3.

---

**Tier 3 — grep source file (symbol not in index at all)**

Step 3a — find line number first:
```bash
# Action:
grep -n "SymbolName\|function SymbolName\|const SymbolName" src/path/to/file.ts
```
Emit trace:
```
**[index T3]** grep `SymbolName` in `src/path/to/file.ts` → line: 42
```

Step 3b — read only that range:
```
**[pre-read]** Target: `SymbolName` · Tier: T3 · Line: 42 · Will read: offset=37 limit=60
Read  file_path=src/path/to/file.ts  offset=37  limit=60
```

---

**Hard limits — no exceptions:**
| Prohibited | What to do instead |
|---|---|
| Read file without offset+limit | Run T1 or T3 grep first → get line N → Read offset=N-5 limit=60 |
| Read >60 lines in one call | Use multiple targeted reads at different offsets |
| Skip straight to Read without grep | Always grep first — no exceptions |
| "Need full file to understand structure" | T1→T2→T3 provides sufficient context. Full reads = violation |

If you catch yourself about to Read without a line number → emit:
```
**[violation] R5** — no line number yet · running grep first
```
Then run the appropriate grep tier.

---

### Edit Rules

- Edit <5 lines → targeted edit tool with exact old/new block only
- Edit multiple locations → one targeted edit per location
- Never rewrite the entire file for a few line changes
- Always view surrounding context (±5 lines) before editing

3. **Context Preservation**: Always view surrounding context before editing. Never overwrite without understanding the structure.

4. **Bug Fixing — search error_index first:**
   ```bash
   grep -A 12 'symptom_keyword\|ERR-00' knowledge/error_index.md | head -30
   ```
   Found matching ERR-XXX → apply resolution immediately, no re-analysis needed.
   Not found → follow CLAUDE.md R-Roadmap + R9 (create roadmap entry T-{N}-{BugID}-{AttemptID} → fix → assign ERR code)

5. **Piping — always filter before returning:**
   ```bash
   command 2>&1 | grep -iE "error|warn|fail" | tail -20
   ```
   If filtered output answers the question → stop, no need for more logs.

6. **Formatting**: Always preserve original indentation, style, and imports.

7. **Verification Matrix**: If task involves any of — API route, DB operation, auth/session, CSV parsing, or component edit — load `TESTING.md` (per CLAUDE.md §R19 Reference Docs) before making changes. Skip for config-only or comment-only edits.

## Limitations
- Do not create entirely new architectures here. If a task requires widespread new file scaffolding, the Agent Orchestrator should use the `coder` skill instead.
