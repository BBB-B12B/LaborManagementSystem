# Offline Backlink Graph + "Knowledge-Wiki for LLM" — Research Note

> Reference note. Captured 2026-06-24 while researching how to build an OFFLINE, single-file
> HTML graph (Obsidian-style) of our repo's file links, color-coded by topic. Read-only study
> — no harness files changed by the capture itself. Feeds a future build task (generator + template).

## 1. Core finding — the graph data already exists in this repo

`knowledge/index_files.json` (2,429 entries, keyed by file path) already holds everything a graph needs:
- **nodes** = each file path
- **edges** = `backlinks` / `references` / `related` fields
- **color group** = `topics` (`major` / `minor`)

So an Obsidian-style graph here is NOT a new data problem — it's a *rendering* problem: read this JSON → draw. "Update on every backlink change" = re-run a generator script that reads the live index.

## 2. Library comparison (for ~2,400 nodes, fully offline single .html)

| Library | Render tech | Practical node ceiling | Vendor offline (1 file)? | Topic color + search | Verdict |
|---|---|---|---|---|---|
| **vasturiano/force-graph** (~2.1k★) | Canvas (d3-force) | ~4k smooth | Yes — UMD JS inlined | `nodeAutoColorBy('topic')`, `onNodeHover` neighbor-highlight, re-feed to filter | **Best fit** — Obsidian-like out of the box |
| 3d-force-graph | WebGL/Three.js | 10k+ | Yes but heavy bundle | same API | Overkill; 3D not needed |
| D3.js force | SVG | ~1–2k | Yes | hand-build hover/zoom/search | Quartz uses it; SVG lags at 2.4k |
| vis-network | Canvas | ~3–5k | Yes (standalone UMD) | easy `group` color, built-in interaction | Solid fallback |
| Cytoscape.js | Canvas (WebGL preview 2025) | ~3k | Yes | verbose styling, analysis-focused | Heavier than needed |
| sigma.js | WebGL | 100k–500k | Yes (needs graphology too) | more wiring | Reserve for >10k nodes |
| Pyvis (Python→vis.js) | Canvas | ~3–5k | generates HTML but pulls CDN — must patch to inline | vis groups | Convenient generator, manual asset-inlining for offline |

Rule of thumb: **SVG ~1–2k · Canvas ~3–5k · WebGL 100k+**. At 2,400 nodes Canvas is the sweet spot; WebGL is unnecessary complexity.

## 3. Reference repos to learn from
- **jackyzha0/quartz** (~14k★) — digital-garden SSG; builds an Obsidian-style graph from `[[wikilinks]]`. Best architectural reference for the markdown→links→graph pipeline. https://github.com/jackyzha0/quartz
- **ObsidianHtml** — exports a vault to fully static HTML incl. graph-view config. https://obsidian-html.github.io/configurations/features/graph-view.html
- **force-graph large-graph example** — perf-tuning template (disable pointer interaction for max FPS). https://github.com/vasturiano/force-graph/blob/master/example/large-graph/index.html

## 4. Why this is interesting for an LLM harness (not just a pretty picture)
- **Two views of one knowledge base.** The *agent* navigates the knowledge base via the index (grep over `index_files.json`); a *human* navigates it via the graph. Same data, two front-ends. The graph is the human-facing read-model of the agent's index.
- **Bidirectional links = the wiki primitive.** Obsidian/Zettelkasten `[[wikilinks]]` and our `backlinks[]` are the same idea: every link is stored on both ends, so "what points at me?" is answerable. This is exactly what R8 index-sync + backlink_analyzer.py maintain. A graph just *visualizes the invariant we already enforce*.
- **The graph surfaces health problems for free:** orphan nodes (files nothing links to = candidate dead docs), hub nodes (over-referenced = single-point-of-failure docs), and topic clusters (does the color grouping match the intended architecture?). This doubles as a harness-quality audit tool, overlapping with index_reconcile.py's `[index-drift]` detection.
- **GraphRAG adjacency.** Industry "knowledge graph + retrieval" (GraphRAG) uses link structure to improve LLM retrieval. Our index is already a lightweight knowledge graph; the same structure could later feed retrieval, not just visualization.

## 5. Recommendation
Use **vasturiano/force-graph** (Canvas). Build pattern: a Python generator reads `index_files.json` → emits graph JSON (nodes+edges+topic→color) → writes ONE self-contained `.html` with the vendored `force-graph.min.js` inlined (no CDN, opens via `file://`). Learn the data pipeline from **Quartz**; copy perf tweaks from the **large-graph** example. Re-run the generator whenever backlinks change.

## Sources
- https://github.com/vasturiano/force-graph
- https://github.com/vasturiano/force-graph/blob/master/example/large-graph/index.html
- https://github.com/vasturiano/3d-force-graph
- https://github.com/jackyzha0/quartz
- https://obsidian-html.github.io/configurations/features/graph-view.html
- https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-javascript-2026
- https://blog.js.cytoscape.org/2025/01/13/webgl-preview/
