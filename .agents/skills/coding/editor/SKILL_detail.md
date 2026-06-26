# Code Editor — Detail Reference

Extended procedures for `editor/SKILL.md`. Load on-demand during Section 1 or 2 as needed.

---

## Lookup Protocol — 3-Tier Escalation

Every lookup follows this exact sequence. Emit a trace at each step. Stop the moment you have a line number.

---

**Tier 0 — pre-read oracle (run first, fastest)**

```bash
python scripts/lookup.py "SymbolName" --json
# or keyword: python scripts/lookup.py "job dashboard" --json
```
Emit trace:
```
**[index T0]** query: `SymbolName` → file: `src/...` · line: 42 · read_hint: offset=37 limit=60
```
→ Got file + line + read_hint? Emit pre-read gate → Read → STOP. Do NOT go to Tier 1.
```
**[pre-read]** Target: `SymbolName` · Line: 42 · Will read: offset=37 limit=60
```
→ Empty results or no line number? → proceed to Tier 1.

---

**Tier 1 — grep index (if T0 empty)**

```bash
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
**[pre-read]** Target: `SymbolName` · Line: 42 · Will read: offset=37 limit=60
```

---

**Tier 2 — widen index (only if Tier 1 found nothing)**

```bash
grep -B 2 -A 20 '"SymbolName"' knowledge/index_variables.json
```
Emit trace:
```
**[index T2]** Symbol: `SymbolName` → <found: line N | not found: proceed to T3>
```
→ Got line number? Emit pre-read gate → Read → STOP.
```
**[pre-read]** Target: `SymbolName` · Line: <N> · Will read: offset=<N-5> limit=60
```
→ Still no line number? → proceed to Tier 3.

---

**Tier 3 — grep source file (symbol not in index at all)**

Step 3a — find line number first:
```bash
grep -n "SymbolName\|function SymbolName\|const SymbolName" src/path/to/file.ts
```
Emit trace:
```
**[index T3]** grep `SymbolName` in `src/path/to/file.ts` → line: 42
```

Step 3b — read only that range:
```
**[pre-read]** Target: `SymbolName` · Line: 42 · Will read: offset=37 limit=60
Read  file_path=src/path/to/file.ts  offset=37  limit=60
```

---

**Hard limits — no exceptions:**
| Prohibited | What to do instead |
|---|---|
| Read file without offset+limit | Run T0 lookup.py (or T1/T3 grep) first → get line N → Read offset=N-5 limit=60 |
| Read >60 lines in one call | Use multiple targeted reads at different offsets |
| Skip straight to Read without grep | Always grep first — no exceptions |
| "Need full file to understand structure" | T1→T2→T3 provides sufficient context. Full reads = violation |

If you catch yourself about to Read without a line number → emit:
```
**[violation] R5** — no line number yet · running grep first
```
Then run the appropriate grep tier.

---

## Post-Read Verdict (MANDATORY — after every Read result)

Emit immediately after processing each Read result:
```
**[post-read]** File: `<path>` · Verdict: relevant|partial|irrelevant
```

| Verdict | Action |
|---|---|
| `relevant` | Keep full content in context |
| `partial` | Keep excerpt only — note line range · discard rest |
| `irrelevant` | Drop from context immediately — do NOT cite in `context_files:` |

Skipping `[post-read]` = CFP-004 violation (context bloat). No exceptions.

---

## Pre-Edit Gate — Blast-Radius Check (MANDATORY before every named symbol Edit)

Emit BEFORE every Edit/Write that modifies a named symbol:
```
**[pre-edit]** Symbol: `<name>` · index_variables lookup: T1 done · used_in: <N files> · safe to edit: <yes|needs review>
```

**Procedure:**
```
Step 1: grep -A 8 '"SymbolName"' knowledge/index_variables.json
         → extract "used_in": [...] array
Step 2: Count dependents — every file in used_in[] is a blast-radius target
         used_in empty    → safe to edit · emit [pre-edit] safe to edit: yes
         used_in non-empty → review each dependent first
           → grep each dependent file for usage of this symbol
           → confirm change is backward-compatible for all of them
           → if breaking change: stop → report blast radius to user before proceeding
Step 3: Emit [pre-edit] gate with result → only then proceed to Edit tool
```

Editing without this check = `[violation] R5-edit` → HALT · run check · re-confirm before Edit.

---

## R9 Step 0 — Recurring Fix Detection (run FIRST on every error task)

**Trigger signals** — treat as recurring if user message contains ANY of:
"ยังไม่หาย" · "แก้แล้วยัง" · "still broken" · "same error" · "กลับมาอีก" · "fix ไม่ผ่าน" · "ยังเจออยู่" · "ยังเป็นอยู่"
OR: same ERR-XXX already `[X]` in roadmap · same T-N-BugID referenced

**On recurring detection:**
```
Step 1: grep -n "T-{N}-{BugID}" docs/master_roadmap.md → find last AttemptID used
Step 2: grep -n "^## ERR-XXX" knowledge/error_index.md → Read offset=N limit=50
         → find "### Failed Approaches:" section → read all listed approaches
Step 2.5 (session history lookup):
  python scripts/lookup.py "T-{N}-{BugID}" --session --json
  → for each result: Read .sessions/<session_id>.json → check History[] and files_changed[]
  → add any NEW approaches found here to "DO NOT repeat" list
Step 3: DO NOT repeat any approach found in Step 2 or Step 2.5
Step 4: New roadmap entry with incremented AttemptID
Step 5: Emit [recurring] ERR-XXX · Prior attempts: N · Previous approach: <summary> · New approach: <what's different>
```

**Failed Approaches field** — write BEFORE escalating per R13:
```
### Failed Approaches:
- [YYYY-MM-DD] T-{N}-{BugID}-{Attempt}: <approach tried> → verify failed · Reason: <why it didn't resolve>
```
Append to the ERR-XXX entry in `knowledge/error_index.md`. Never escalate without recording first.

---

## R12 — Post-Edit Verification

| Action type | Verify by |
|---|---|
| Edit `src/` file | Re-read changed section (Read offset=N limit=30) · confirm no broken imports |
| Add/remove symbol | `python scripts/symbol_indexer.py` → confirm symbol appears/absent in index |
| DB schema change | No ERR-007 violations (no multi-row insert, no onConflictDoNothing, no float in int col) |
| Create/delete file | `knowledge/index_files.json` updated + all backlinks resolved |
| Error fix | ERR-XXX written in `knowledge/error_index.md` + roadmap marked `[X]` |

**Never report done before verification passes.**
R12 verify fail → write `### Failed Approaches:` → then emit `[blocked]` per R13.

---

## Edit Rules

- Edit <5 lines → targeted Edit tool with exact old/new block only
- Edit multiple locations → one targeted edit per location
- Never rewrite the entire file for a few line changes
- Always view surrounding context (±5 lines) before editing
- Context Preservation: never overwrite without understanding the structure
- Bug Fixing — search error_index first:
  ```bash
  grep -A 12 'symptom_keyword\|ERR-00' knowledge/error_index.md | head -30
  ```
  Found matching ERR-XXX → apply resolution immediately, no re-analysis needed.
- Piping — always filter before returning:
  ```bash
  command 2>&1 | grep -iE "error|warn|fail" | tail -20
  ```
- Formatting: always preserve original indentation, style, and imports.
