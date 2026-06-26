# Obsidian Graph View — Design Principles (for T-273 backlink-graph build)

Researched 2026-06-25 from Obsidian official help + forum.obsidian.md. Obsidian is
closed-source, so this captures OBSERVABLE behaviour + documented settings, not internals.
Purpose: reuse proven principles for our self-contained offline backlink-graph HTML
(208 nodes, ~2400 `related` edges with numeric `score`, 32 `topic` values).

## Mechanics observed

**Forces (physics)** — 4 user sliders:
- `center_force` — pulls nodes toward centre (compactness)
- `repel_force` — nodes push apart (inverse-square)
- `link_force` — spring tension on edges
- `link_distance` — target edge length
- Physics is d3-force-style; backend migrated to Pixi/WebGL for rendering. Nodes start
  near centre + small random jitter; distance-threshold skips far pairs.

**Display**
- `node_size` slider; node size ALSO scales with in-degree (more links → bigger).
- `text_fade_threshold` — labels fade/vanish below a ZOOM level (zoom-threshold cutoff, not just opacity).
- `link_thickness` — uniform across edges (no per-edge weight natively).
- `arrows` toggle for directionality.

**Filters** — free-text search (query syntax `tag:` `path:`), toggles: show tags as nodes,
attachments, "existing files only", show/hide orphans.

**Groups / colour** — up to ~6 practical colour groups; each group = a search query,
first-match-wins. No automatic folder grouping (must write path queries).

**Local vs global** — local graph = depth slider 1–5+ hops from active note; global = whole vault.

**Performance** — practical ceiling ~25k nodes desktop; ~130k freezes (single-thread CPU bound
despite WebGL). No built-in LOD / culling / clustering; community workaround = filter before opening.
Force runs until alpha decays (no user alpha/tick control).

## Mapping to our build (ADOPT / ADAPT / SKIP)

| Obsidian feature | Decision | Why for us |
|---|---|---|
| 4-force physics | ADOPT | standard d3-force; expose as sliders (Plus) |
| node size by in-degree | ADOPT | score-weighted degree → hubs visible |
| zoom text-fade | ADOPT | 208 labels overlap; show on zoom-in / hover |
| local graph (depth hops) | ADOPT | click-to-focus depth-1/2 — legibility-critical at 208 nodes |
| arrows toggle | ADOPT (default off) | `related` is undirected |
| uniform link thickness | ADAPT | we map `score` → edge opacity/weight (Obsidian CANNOT) |
| query colour groups | ADAPT | auto-colour by `topic` field, no manual queries |
| WebGL/Pixi renderer | SKIP | 208 nodes is tiny; plain d3-force canvas/SVG suffices |
| "existing files only" | SKIP | all 208 nodes are real |

## Features WE add that Obsidian lacks (our differentiators)
1. **Score-threshold slider** — live-filter edges by `score ≥ N`; biggest legibility win, cuts ~2400 edges to a meaningful subset.
2. **Click-to-focus / local neighbourhood** — dim non-neighbours; without it 208 nodes + edges is an unreadable hairball.
3. **Topic-cluster layout** — pull same-`topic` nodes together (forceCluster / topic centroids); kills the hairball. Long-requested in Obsidian, never shipped.
4. **Settle/freeze button** — instantly cool the simulation so labels are readable (Obsidian exposes no alpha control).

## Single-source-of-truth note
The graph HTML must be GENERATED from `knowledge/index_files.json` by a script
(`scripts/build_backlink_graph.py`), never hand-authored — regenerate when the index changes.

## Sources
- Graph view — Obsidian Help: https://obsidian.md/help/plugins/graph
- Graph view physics / force-directed — forum: https://forum.obsidian.md/t/graph-view-physics-and-force-directed-graphs/72586
- Large-vault graph performance — forum: https://forum.obsidian.md/t/obsidian-graph-view-doesnt-work-for-a-large-vault/106287
- Cluster positioning request — forum: https://forum.obsidian.md/t/graph-view-settings-to-move-node-clusters-into-better-positions/17809
- Graph CSS variables — Obsidian dev docs: https://docs.obsidian.md/Reference/CSS+variables/Plugins/Graph
