---
name: Router Policy
description: Routing tiers and fallback chain for skill/tool discovery. Read when routing is ambiguous or a new skill type is needed.
---

# Router Policy

> This file formalizes the 4-tier routing chain. AGENTS.md Boot B2 implements tier 1–2. Use this doc when diagnosing routing failures or extending the system.

## Routing Chain (ordered — try each tier before next)

```
[Tier 1] skill-index.md          Fast phrase/keyword match (curated table)
    ↓ no match
[Tier 2] skill-manifest.json     grep keywords[] (Boot B2 — machine routing)
    ↓ no match
[Tier 3] choose_tools.py         Semantic keyword search (skill + tool manifest)
    ↓ no match
[Tier 4] agent skill             Default orchestrator — routes further or asks user
```

## Decision Rules per Tier

### Tier 1 — skill-index.md
- **When:** user message contains exact phrase in fast-lookup table
- **Action:** load SKILL.md directly — skip manifest grep
- **Saves:** ~1 tool call (no grep needed)
- **File:** `knowledge/skill-index.md`

### Tier 2 — skill-manifest.json
- **When:** no exact phrase match in Tier 1 (default Boot B2 path)
- **Action:** `grep -B1 -A6 '"keywords"' .agents/skills/skill-manifest.json | head -80`
- **Match threshold:** 1+ keyword match → load that skill
- **File:** `.agents/skills/skill-manifest.json`

### Tier 3 — choose_tools.py
- **When:** Tier 2 returns no match OR multiple low-confidence matches
- **Action:** `python scripts/choose_tools.py --keywords "kw1,kw2" --top 3`
- **Returns:** top-N skill + tool matches with scores and context_files
- **File:** `scripts/choose_tools.py`

### Tier 4 — agent (default)
- **When:** all tiers fail to match
- **Action:** load `agent` skill → agent asks user for clarification or decomposes task
- **Never:** skip to this tier without trying Tier 1–3 first

## Chained Skills (always run after these — not optional)

| Skill completes | Must also run |
|---|---|
| `coder` | `file_manager` + `variable_manager` |
| `editor` (symbol changed) | `variable_manager` |
| Any session close | `self_improve` §3 Step 0 → `session_indexer.py` |
| Any symbol change | `symbol_indexer.py` |

## Index Sync — Routing System Itself

When the routing system changes, update these files:

| Change | Update |
|---|---|
| New SKILL.md added | `skill-manifest.json` + `knowledge/skill-index.md` |
| SKILL.md renamed/moved | `skill-manifest.json` path + `registry.md` |
| New tool script added | `.agents/tools/tool-manifest.json` |
| New fast-match phrase | `knowledge/skill-index.md` Learned Routes table |

## Backlinks

- [[knowledge/skill-index.md]]
- [[.agents/skills/skill-manifest.json]]
- [[scripts/choose_tools.py]]
- [[.agents/skills/registry.md]]
- [[AGENTS.md]]
