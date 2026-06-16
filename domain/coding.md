# Domain Pack — coding
> Swappable project layer for software-coding projects (Next.js / Cloudflare / TS).
> The CORE harness (CLAUDE.md / AGENTS.md / Implement/) is project-agnostic and points here.
> All commands/paths/thresholds are INLINE — a MEDIUM-tier model follows this with no chat history.

meta:
  name: coding
  active: true
  created: 2026-06-15

## paths
- work_root: src/
- protected: src/db/        # triggers the DB hard-stop gate below
- code_exts: .ts .tsx .js .py

## domain_gates
# Layered on top of the core R14/R15 gate FRAMEWORK. Core keeps the mechanism; the
# coding-specific trigger + payload live here, verbatim from the former CLAUDE.md R15.

- DB Hard Stop (R15):
    Pre:      about to edit any file under src/db/ OR modify a TS type that includes DB column fields
    Contract: HALT immediately — emit [db-gate] signal and wait for explicit "yes"
              emit: [db-gate] File: `<path>` · Symbol: `<name>` · Change: `<what>` · DB impact: `<tables>` · → Waiting for explicit "yes"
    Post:     DB edit proceeds ONLY after user types explicit "yes" (not just "ok" or "continue")
    Enforce:  any src/db/ write without [db-gate] + explicit "yes" = [violation] R15 → HALT · REVERT · re-emit [db-gate]

- Destructive scope (R14 coding paths):
    Pre:      about to delete/overwrite src/ or knowledge/ or .sessions/mece_plan.md · OR any src/db/ edit · OR batch >5 files
    Contract: MUST emit [gate] signal and HALT — no execution until explicit user confirm received
              emit: [gate] Action: `<what>` · Scope: `<files>` · Risk: `<why>` · Waiting: confirm
    Post:     action proceeds ONLY after user types explicit confirmation
    Enforce:  destructive action without [gate] emit + confirm = [violation] R14 → HALT · re-emit [gate]

## critical_rules
- Miniflare D1 (local): No `onConflictDoNothing()` or multi-row INSERT — silent failures. Use SELECT+filter+single-row-insert. (ERR-007)
- Edge Runtime: No Node.js APIs. WebCrypto only.
- CSV parsing: Always PapaParse — never `split(",")` manually.

## framework
- Next.js: read `node_modules/next/dist/docs/` first — conventions may differ from training data.
- Code import graph: .py/.ts/.js under scripts/ or src/ → maintain imports[]/imported_by[] via `python3 scripts/code_graph.py --write` (Tier-A regex import graph · hash-locked).

## skills
- coder: write new code to standards, self-correct linter errors, [✓ written] verify each file
- editor: surgically edit/refactor/debug existing application code (R9 3-checks → read at line → assess blast radius)
- variable_manager: sync code symbols → index_variables.json + run symbol_indexer.py

## tools
- code_graph.py: extract file→file IMPORT edges (hard structural edges) from code files
- symbol_indexer.py: scan TypeScript/TSX source files, record exported symbols with metadata

## co-config Q&A  (filled during Implement/02_setup.md)
- Q: What kind of project? → software coding (Next.js / Cloudflare Workers / TS)
- Q: Where do main work files live? → src/  (DB layer under src/db/)
- Q: Any folder/action that must HALT? → src/db/ edits → [db-gate] + explicit "yes"
- Q: Frameworks with non-obvious rules? → Next.js, Miniflare D1, Edge Runtime, PapaParse
- Q: Domain skills/tools? → coder, editor, variable_manager · code_graph.py, symbol_indexer.py
