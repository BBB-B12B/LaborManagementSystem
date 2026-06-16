# Code-Linkage Index — Design Spec (hard-relationship)

> version: 1.0 · date: 2026-06-15 · task: T-192
> Defines how structural edges between code files/symbols are extracted into the index,
> kept deterministic via hash-lock, and queried (R5 index-first). This is the durable
> blueprint S2/S3 build from.

---

## 1. Two edge CLASSES — never merged

The index carries two distinct kinds of relationship. They are computed differently,
stored in different fields, and must NOT be blended into one score.

| Class | Meaning | How derived | Determinism | Example |
|---|---|---|---|---|
| **hard** | structural fact in the code | parsed (regex / AST) — pure code, no AI | fully deterministic | `a.py` **imports** `b.py` |
| **semantic** | topic / meaning overlap | AI-tagged facets → weighted overlap | AI-tag-once, hash-locked | two docs share topic `token-tracking` |

Rationale: a hard edge is a verifiable fact ("file A literally imports file B"); a semantic
edge is a similarity judgment. Mixing them would let a fuzzy topic guess outrank a real
import. (Confirmed by the Graphify research: Pass-1 structure = hard, separate from semantic.)

- semantic edges already live in `index_files.json` via the topic-facet schema (T-191,
  see `knowledge/topic_facet_schema.md`) and `scripts/backlink_analyzer.py`.
- this spec adds the **hard** layer. The two layers coexist; a query states which it wants.

---

## 2. Edge TYPES (hard layer)

| Edge type | Direction | Grain | Tier | Stored in |
|---|---|---|---|---|
| **import** | file → file | file-level | A (now) | `index_files.json` |
| **call** | symbol → symbol | symbol-level | B (deferred) | `index_variables.json` |
| **type-usage** | symbol → type | symbol-level | B (deferred) | `index_variables.json` |

- **import** — `import x from "./b"` / `from b import x` → edge `a → b`.
- **call** — function `f` calls function `g` → edge `f → g`.
- **type-usage** — symbol `f` references type `T` (param/return/annotation) → edge `f → T`.

---

## 3. Schema

### 3a. File-level (import edges) — `index_files.json`
Hard import edges use their OWN dedicated fields, kept separate from the existing
semantic fields (`references[]` / `related[]` are topic/rule-derived and untouched). This
honors §1 — the two classes never share a field, so a hard edge can never be confused with
a topic-similarity entry:

```jsonc
"scripts/index_reconcile.py": {
  // ── semantic layer (existing, untouched) ──
  "references": [ "knowledge/error_index.md" ],   // topic/rule-derived strings
  "related":    [ { "path": "...", "strength": "strong", "score": 6 } ],
  // ── hard layer (NEW · code_graph.py) ──
  "imports":     [ "scripts/backlink_analyzer.py" ],  // files THIS file imports (out-edges)
  "imported_by": [ ],                                 // files that import THIS file (in-edges)
  "extracted_at_hash": "a1b2c3d4"   // sha1[:8] of file content at extraction time
}
```
- `imports[]` = out-edges (sorted, unique, repo-relative paths) — internal targets only.
- `imported_by[]` = in-edges (reverse adjacency, rebuilt from all `imports[]`).
- both are lists of plain repo-relative path strings; external/stdlib imports are skipped.

### 3b. Symbol-level (call / type edges) — `index_variables.json` — Tier-B, deferred
```jsonc
"variables": {
  "make_read_hint@scripts/symbol_indexer.py": {
    "calls":      [ "infer_line_end@scripts/symbol_indexer.py" ],
    "called_by":  [ "build_index@scripts/symbol_indexer.py" ],
    "uses_types": [ ],
    "extracted_at_hash": "9f8e7d6c"
  }
}
```
Key format `symbol@path` keeps symbols unique across files. Empty `{"variables": {}}` today
is EXPECTED (no app code in src/ yet) — Tier-B fills it once TS code lands.

---

## 4. Hash-lock rule (determinism)

Extract edges ONCE per content hash; re-extract only when content changes.

```
for each code file:
  h = sha1(file_content)[:8]
  if index[file].extracted_at_hash == h:  skip   # unchanged → reuse stored edges
  else:                                    re-extract, write edges, set extracted_at_hash = h
```
- Same input file → same edges every run → **idempotent** (re-running changes nothing).
- No timestamps, no randomness, no AI in the hard layer → byte-identical output across runs.
- Same pattern as the topic-facet "AI-tag-once" lock, but stronger: hard extraction has no
  AI step at all, so it is deterministic by construction.

---

## 5. Tier-A (now) vs Tier-B (deferred)

| | Tier-A | Tier-B |
|---|---|---|
| extracts | import edges (file→file) | call + type-usage (symbol→symbol) |
| method | regex on import/from lines | AST / tree-sitter parse |
| languages | py + ts/js | ts (TS compiler) |
| status | **SHIP NOW** (`scripts/code_graph.py`) | **DEFERRED** |
| why now/later | testable today against `scripts/*.py` | needs TS app code under `src/` (none yet) |

Tier-A is the working foundation; Tier-B slots into the same schema (§3b) when there is TS
application code to parse. Building Tier-B before code exists would be over-engineering.

OUT OF SCOPE (rejected from Graphify, by design): media/audio/video transcription,
PDF/image ingestion, community-detection clustering, a separate graph database. The JSON
indexes ARE the graph (adjacency lists) — no extra datastore.

---

## 6. Query usage (R5 index-first)

These questions are answered from the index, NOT by grepping the whole tree:

| Question | Answer source |
|---|---|
| "who imports X?" | `index_files.json[X].imported_by[]` |
| "what does X import?" | `index_files.json[X].imports[]` |
| "who calls function f?" (Tier-B) | `index_variables.json[f@path].called_by[]` |
| "what does f call?" (Tier-B) | `index_variables.json[f@path].calls[]` |
| "blast radius of editing X" | union of `imported_by[]` (+ transitive) |

Before editing a symbol/file, R5 reads these edges to size the change (`used_in` / blast
radius) instead of a blind repo grep.

---

## 7. Sync (R8 wiring — see S3)

`scripts/code_graph.py` joins the idempotent regenerators that `scripts/index_reconcile.py`
auto-runs at session close (Stop hook). On file create/edit/delete it refreshes import edges,
respecting the hash-lock (unchanged files skipped). Registered in
`.agents/tools/tool-manifest.json`; a row added to the AGENTS.md Index Sync (R8) table.
