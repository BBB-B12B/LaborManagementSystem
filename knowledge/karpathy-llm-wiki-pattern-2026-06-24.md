# Karpathy "LLM Wiki" Pattern — Research Note + Mapping to Our Harness

> Reference note. Source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
> (single file `llm-wiki.md`, ~12KB, conceptual idea-doc — NOT a codebase). Cloned + read
> 2026-06-24 via repo_researcher (S-tier, 1-phase synthesis). Read-only study.

## 1. The pattern (what Karpathy proposes)

A personal knowledge base that an **LLM incrementally builds and maintains** as interlinked
markdown. Contrast with RAG: RAG re-discovers knowledge from raw chunks on every query (no
accumulation). The LLM-Wiki **compiles knowledge once and keeps it current** — a persistent,
compounding artifact. Human curates sources + asks questions; LLM does all the bookkeeping
(summarizing, cross-referencing, filing, consistency). "Obsidian is the IDE; the LLM is the
programmer; the wiki is the codebase."

## 2. Three-layer architecture
- **Raw sources** — immutable curated documents. LLM reads, never modifies. Source of truth.
- **The wiki** — LLM-owned markdown (summaries, entity/concept pages, overview, synthesis). LLM creates/updates/cross-references; human only reads.
- **The schema** — a config doc that tells the LLM how the wiki is structured + workflows. Karpathy *explicitly names* `CLAUDE.md` (Claude Code) / `AGENTS.md` (Codex). "What makes the LLM a disciplined wiki maintainer rather than a generic chatbot."

## 3. Three operations
- **Ingest** — drop a source → LLM reads, discusses, writes a summary page, updates index, updates 10–15 related pages, appends to log.
- **Query** — search index → read pages → synthesize cited answer. KEY: good answers get **filed back as new pages** so explorations compound (don't vanish into chat).
- **Lint** — periodic health check: contradictions, stale claims, orphan pages (no inbound links), missing concept pages, missing cross-refs, data gaps.

## 4. Index + log
- **index.md** = content catalog (page → link + one-line summary + metadata), organized by category. Read first on every query. "Works surprisingly well at moderate scale (~100 sources, hundreds of pages) and **avoids embedding-based RAG infrastructure.**"
- **log.md** = append-only chronological. Consistent prefix (`## [2026-04-02] ingest | Title`) → grep-parseable: `grep "^## \[" log.md | tail -5`.
- Optional CLI search at larger scale: [qmd](https://github.com/tobi/qmd) (local BM25+vector, on-device, CLI+MCP).

## 5. ★ Mapping to OUR harness — we independently built ~80% of this

| Karpathy LLM-Wiki | Our harness equivalent | Status |
|---|---|---|
| Schema = CLAUDE.md / AGENTS.md | CLAUDE.md + AGENTS.md (very elaborate) | ✅ exact match (he names these files) |
| The wiki (LLM-owned md) | `knowledge/` + `memory/` | ✅ |
| index.md (content catalog) | `knowledge/index_files.json` | ✅ (ours is JSON, his is md) |
| log.md (append-only, grep prefix) | `.sessions/` logs, `token_log.jsonl`, roadmap/CFP grep prefixes | ✅ |
| Ingest operation | Phase 1 gather + knowledge capture | ✅ |
| Query (index-first, no RAG) | R5 index-first grep → Read | ✅ validates our no-embeddings approach |
| "file good answers back as pages" | this very note + research notes | ✅ |
| Lint (orphan/contradiction/stale) | `index_reconcile.py` [index-drift] + `knowledge_conflict_checker.py` + scrutinize skill | ✅ |
| Obsidian graph view | the offline backlink graph we are about to build | 🔜 in progress |
| Raw-sources immutable layer | (no clean separation — sources are external repos we research) | ⚠ partial gap |

## 6. Gaps worth adopting
- **Explicit immutable "raw sources" layer** — we blur source vs. synthesis; Karpathy keeps them separate (source = truth, never edited).
- **Inline contradiction-flagging discipline** — note where new data contradicts old, *in the page*, not only via a checker script.
- **Frontmatter for dynamic views** (his Dataview tip) — YAML tags/dates on knowledge files → queryable tables. We have `topics`/`type` in the index but not page frontmatter.
- **qmd-style local search** — only if `index_files.json` grows past "moderate scale"; until then grep-over-index is correct (he confirms index beats RAG at our scale).

## 7. Direct relevance to the graph build
Karpathy: *"Obsidian's graph view is the best way to see the shape of your wiki — what's connected to what, which pages are hubs, which are orphans."* This is a third-party validation of the exact tool we're building, and it ties the graph to the **Lint** operation: the graph is not decoration — it is the visual front-end of the health-check (orphans = dead docs, hubs = fragile single-points, clusters = topic coherence). Reinforces single-source-of-truth: graph reads the index, never stores its own links.

## Sources
- https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- https://github.com/tobi/qmd
- Vannevar Bush, "As We May Think" / Memex (1945) — cited as the spiritual ancestor
