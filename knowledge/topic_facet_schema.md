# Topic-Facet Backlink Schema (v2)
date: 2026-06-14
status: design-approved — supersedes flat `topics[]` in index_files.json
origin: design converged across session 2026-06-14 (user + agent), adversarial review per audit_engine_rubric.md

## 1 · Why v1 (flat topics) is weak
- `overlap = |A∩B| / |A|` is asymmetric → "strong" inflated for files with few topics.
- All topics weighted equally → rare, high-signal topics drowned by common hub topics.
- One `topics` list conflates TWO orthogonal facets: *what kind of file* vs *what it is about*.
- AI tagging is non-deterministic → re-running shifts results, so counts/links drift.

## 2 · Two-facet model
- **FACET 1 — `type`**: what KIND of file (harness / tool / skill / ...). Small closed vocab.
  Used for navigation/filter ONLY. NOT part of the link-strength formula in v2.
- **FACET 2 — `topic`**: what the file is ABOUT. Closed vocab (topic_registry.json).
  Per-file weighted into `major` / `minor`.

## 3 · Per-file entry schema (extends each index_files.json entry)
```json
{
  "type": "harness",
  "topics": { "major": ["token_tracking"], "minor": ["compact_handling"] },
  "topic_map": [
    { "topic": "token_tracking", "lines": [[10,45],[88,92]], "critical": false },
    { "topic": "react_loop",     "lines": [[46,87]],         "critical": true  }
  ],
  "coverage": 0.84,
  "tagged_at_hash": "a1b2c3d4",
  "description": "...", "backlinks": [], "references": [], "related": [],
  "rules_defined": [], "rules_referenced": []
}
```

## 4 · `type` vocabulary (closed — type_registry)
`harness · tool · skill · knowledge · session · index · config · doc`
Extend ONLY via the same propose+confirm gate as topics (§8).

## 5 · Tagging procedure (run ONCE per file, at create/edit)
- **T1.** AI maps line-ranges → topic ids, choosing ids ONLY from topic_registry.json (closed vocab).
  Per topic returns `{topic_id, lines:[[start,end]...], critical:bool, why}`. Ranges MAY overlap
  (one line can support more than one topic).
- **T2.** `coverage = distinct lines covered by ≥1 topic / total non-blank lines`.
  If `coverage < 0.80` → AI adds topics until ≥0.80 (the Pareto floor: capture the 80% that matters).
- **T3.** major/minor split — **PURE CODE, deterministic**:
  rank topics by total covered line-count desc → top `ceil(0.20 × N)` = `major` (floor: at least 1).
  Any topic with `critical:true` is forced into `major` regardless of line-count.
- **T4.** store `topic_map` + `topics{major,minor}` + `coverage` + `tagged_at_hash = sha1(file)[:8]`.

## 6 · Determinism rule (fixes "AI is not stable")
- AI runs at **T1 only**. Everything downstream (T3 split, backlink scoring) is pure code over stored data.
- Re-tag trigger = `sha1(file)[:8] ≠ tagged_at_hash`. Same content → tags frozen → identical forever.
- Backlink + major/minor are reproducible from the stored `topic_map`; no AI call at sync time.
- On write, spot-check `coverage ≥ 0.80`; AI variance is confined to tag-time and is reviewable.

## 7 · Link-strength formula (Topic-only, per-file weighted)
For files A, B with shared topics `S = topics(A) ∩ topics(B)`:
```
weight_F(t) = 2 if t in major(F)
            = 1 if t in minor(F)
score(A,B)  = Σ_{t in S} min(weight_A(t), weight_B(t))
```
`min(...)` → a topic counts as strongly shared only when BOTH files treat it as major.
Tiers (tune after first run): `score ≥ 4` strong · `2–3` related · `1` weak · `0` none.
- `type` is NOT in this formula — a tool file and a harness file may still link strongly on shared topics.
- **[v3, optional]** multiply each weight by `IDF = log(total_files / files_carrying(t))` to down-weight
  common topics. Defer until corpus > ~50 files (marginal gain while small).

## 8 · New-topic / new-type minting (reuse harness_doctor gate)
- Vocabulary is front-loaded. A tag-time miss does NOT auto-create a topic.
- Mint path = emit `[new-topic-proposed]` + keyword-dedup (`keyword match ≥ 2 existing → reuse, NEVER new`)
  + user confirm. Identical discipline to the CFP doctor flow.
- On minting a new topic: run a one-time `grep` of the corpus. If it appears centrally in ≥ N existing
  files → flag those for re-tag. Otherwise skip (peripheral, per Pareto — no full re-sync).

## 9 · Known residual watch-points
- line-count ≠ importance: a short critical rule could rank as minor → `critical:true` override (T3).
- AI line-mapping variance: confined to tag-time, mitigated by the §6 hash-lock + coverage spot-check.
- Type kept to a single facet; do not add a 3rd/4th facet while the corpus is small (cost > benefit).
- Two-namespace trap (T-193): this schema's file-facet topics live in `knowledge/topic_registry.json`
  and use **snake_case** (e.g. `token_tracking`, `error_protocol`). CFP classification topics live in
  `knowledge/cfp_topics.md` and use **kebab-case** (e.g. `token-tracking`, `boot-routing`). They are
  DELIBERATELY separate vocabularies for different domains — similar-looking ids (`token_tracking` vs
  `token-tracking`) are NOT the same topic. Never cross-assign: file facets only validate against
  topic_registry.json; CFP topics only against cfp_topics.md. backlink_analyzer/code_graph read the
  former; harness_doctor/self_improve read the latter.
