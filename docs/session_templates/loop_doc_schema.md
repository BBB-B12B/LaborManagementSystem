# Loop-Doc Schema — the reusable template for documenting any harness loop

> **Type:** reference · **Topic:** loop_doc_template · **Created:** 2026-06-24 (T-266) · **Origin:** extracted from `knowledge/self_improvement_loop.md` (the first loop doc) so every other harness loop comes out in the SAME shape — narrative + an enforced-stage table + a re-renderable diagram + real-file backlinks.

This file is a **fill-in-the-blanks skeleton**, not prose to read top to bottom. When you document a harness loop (boot, per-turn routing, info-gather, MECE, REACT, token, session-close, error/debug), copy the section order below into `knowledge/<loop_name>_loop.md` and replace every `<…>` placeholder. The goal: any agent can open any loop doc and find the same six parts in the same order.

**DOC-ONLY rule:** a loop doc *describes* machinery that already exists and is already enforced. It never invents new enforcement. Every stage row must point at a **real artifact** (a hook, a script, a gate, a mandatory emit) — if you cannot name the file that enforces a stage, mark it 🟡 (advisory) and say so honestly.

---

## Required section order (copy this skeleton)

### 1 · Frontmatter line
```
# <Loop Name> Loop (<one-line plain-word handle, e.g. "the front door">)

> **Type:** knowledge · **Topic:** <topic_id> · **Created:** <YYYY-MM-DD> (<T-N>) · **Origin:** <where this loop is canonically defined — e.g. AGENTS.md §<Section>>.
```

### 2 · What it is (1–2 short paragraphs)
Plain-language: what this loop does, when it fires, and why it exists. One everyday analogy is welcome (the audience includes a non-technical reader). End with the single sentence that captures the loop's job.

### 3 · The N-stage cycle
An ASCII diagram (arrows between the stages) **plus** a table. The table is the load-bearing part:

```
| # | Stage | Status | Enforced by (real artifact) |
|---|---|---|---|
| 1 | **<Stage name>** | 🟢/🟡 | <hook / script / gate / mandatory-emit — name the file> |
| … | … | … | … |
```

**Legend (copy verbatim):**
- 🟢 **ENFORCED** — a hook, gate, or mandatory-emit will BLOCK you (or auto-fire) if you skip it.
- 🟡 **ADVISORY** — currently on the honor system (remembered, not enforced). Naming it 🟡 is a forcing function: it flags a future gap to close.

### 4 · The principle
One bolded sentence — the single idea this loop embodies (e.g. self-improvement's "Every loop-closing step must be enforced, not remembered."). Then 1–3 sentences of why.

### 5 · Re-render the cycle (optional but encouraged)
A self-contained `svg` code block of the same diagram, paste-able into the visualize widget. Skip only if the cycle is trivially linear.

### 6 · Related (wiki backlinks to the real harness files)
The most important section for the backlink web. Bullet list — each stage's real file, plus sibling loops:
```
- **<what>:** [<file>](<relative/path>) — <one line on what to look for there>.
- **Sibling loops:** [[boot_loop]] · [[per_turn_routing_loop]] · … · [[self_improvement_loop]]
- **Catalog:** [knowledge/loops_catalog.md](loops_catalog.md) — the hub linking all loops.
```
Use `[[name]]` wiki-links between loop docs so `backlink_analyzer.py` can compute `related[]`.

---

## index_files.json entry stub (paste into knowledge/index_files.json at S10)
```json
"knowledge/<loop_name>_loop.md": {
  "type": "knowledge",
  "topic": "<topic_id>",
  "summary": "<one line>",
  "references": ["<real files this doc backlinks to>"],
  "related": [],
  "backlinks": []
}
```
`related[]`/`backlinks[]` are left empty here — `scripts/backlink_analyzer.py` (run in S10) computes them from the `[[wiki-links]]` and `references[]`.

---

## Related
- **The first loop doc (worked example of every section above):** [knowledge/self_improvement_loop.md](../../knowledge/self_improvement_loop.md).
- **Plan that rolls this template out to all 8 loops:** T-266 in [docs/master_roadmap.md](../master_roadmap.md).
- **Backlink machinery:** [scripts/backlink_analyzer.py](../../scripts/backlink_analyzer.py) · [knowledge/index_files.json](../../knowledge/index_files.json).
