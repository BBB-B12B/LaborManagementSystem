---
repo_name: "{{repo_name}}"
date: "{{date}}"
source_url: "{{source_url}}"
language: "{{language}}"
size_tier: "{{size_tier}}"
---

# Research Summary — {{repo_name}}

## Overview
> 2–4 sentences: what does this repo do, who uses it, why it exists.

| Field | Value |
|---|---|
| Repo | `{{repo_name}}` |
| Language | {{language}} |
| Size Tier | {{size_tier}} ({{file_count}} files) |
| Source | {{source_url}} |
| Researched | {{date}} |

---

## Architecture
> High-level system design. Components, layers, data flow.

### Component Map
```
[Component A] → [Component B] → [Output]
```

### Key Layers
| Layer | Purpose | Path |
|---|---|---|
| Entry | Bootstrap / CLI | `{{entry_point}}` |
| Core | Business logic | `{{core_path}}` |
| Data | Storage / IO | `{{data_path}}` |
| Config | Settings / env | `{{config_path}}` |

---

## Flow
> Step-by-step: how a typical request/operation moves through the system.

1. **Trigger** — `{{entry_point}}` receives input
2. **Parse** — validated/transformed by `{{parser_file}}:{{parser_line}}`
3. **Process** — core logic at `{{core_file}}:{{core_line}}`
4. **Output** — response/side-effect via `{{output_file}}:{{output_line}}`

---

## Code References
> Files and line numbers linked to repo_map. Format: `[label](../research/{{repo_name}}_repo_map.md#key-files)`

| Label | File | Lines | Note |
|---|---|---|---|
| Entry Point | `{{entry_point}}` | L1–L{{entry_end}} | Application bootstrap |
| Core Handler | `{{core_file}}` | L{{core_start}}–L{{core_end}} | Primary business logic |
| Config Schema | `{{config_file}}` | L{{config_start}}–L{{config_end}} | Environment + settings |

---

## Patterns
> Notable design patterns, idioms, or architectural decisions worth adopting.

- **Pattern 1** — `{{pattern_name}}`: description of how it's used and why
- **Pattern 2** — ...

---

## Notes
> Anything unusual, caveats, version-specific behavior.
