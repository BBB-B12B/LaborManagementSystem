---
repo_name: "{{repo_name}}"
date: "{{date}}"
source_url: "{{source_url}}"
language: "{{language}}"
size_tier: "{{size_tier}}"
file_count: {{file_count}}
---

# Repo Map — {{repo_name}}

## File Tree
> Condensed tree. Skip: node_modules / dist / build / .git / lock files.

```
{{repo_name}}/
├── {{dir_1}}/
│   ├── {{file_1_1}}          # {{description_1_1}}
│   └── {{file_1_2}}          # {{description_1_2}}
├── {{dir_2}}/
│   └── {{file_2_1}}          # {{description_2_1}}
├── {{root_file_1}}            # {{description_root_1}}
└── {{root_file_2}}            # {{description_root_2}}
```

---

## Key Files
> Files with highest reference_count or architectural importance.

| # | File | Lang | Lines | reference_count | Role |
|---|---|---|---|---|---|
| 1 | `{{key_file_1}}` | {{lang_1}} | L1–L{{lines_1}} | {{refs_1}} | {{role_1}} |
| 2 | `{{key_file_2}}` | {{lang_2}} | L1–L{{lines_2}} | {{refs_2}} | {{role_2}} |
| 3 | `{{key_file_3}}` | {{lang_3}} | L1–L{{lines_3}} | {{refs_3}} | {{role_3}} |
| 4 | `{{key_file_4}}` | {{lang_4}} | L1–L{{lines_4}} | {{refs_4}} | {{role_4}} |
| 5 | `{{key_file_5}}` | {{lang_5}} | L1–L{{lines_5}} | {{refs_5}} | {{role_5}} |

---

## Entry Points
> Files that bootstrap or expose the main interface.

| File | Lines | Type | Description |
|---|---|---|---|
| `{{entry_1}}` | L{{e1_start}}–L{{e1_end}} | {{entry_type_1}} | {{entry_desc_1}} |
| `{{entry_2}}` | L{{e2_start}}–L{{e2_end}} | {{entry_type_2}} | {{entry_desc_2}} |

---

## Symbol Index
> Key exported symbols / functions / classes. Referenced in summary + improvement docs.

| Symbol | File | Line | Type | Used by (count) |
|---|---|---|---|---|
| `{{symbol_1}}` | `{{sym_file_1}}` | L{{sym_line_1}} | {{sym_type_1}} | {{sym_uses_1}} |
| `{{symbol_2}}` | `{{sym_file_2}}` | L{{sym_line_2}} | {{sym_type_2}} | {{sym_uses_2}} |
| `{{symbol_3}}` | `{{sym_file_3}}` | L{{sym_line_3}} | {{sym_type_3}} | {{sym_uses_3}} |

---

## Config & Schema Files
> Environment, DB schema, API contracts.

| File | Purpose | Key Fields |
|---|---|---|
| `{{config_file_1}}` | {{config_purpose_1}} | {{config_fields_1}} |
| `{{config_file_2}}` | {{config_purpose_2}} | {{config_fields_2}} |

---

## Index
> Quick lookup by topic.

| Topic | File | Section |
|---|---|---|
| Architecture overview | `{{repo_name}}_summary.md` | §Architecture |
| Implementation plan | `{{repo_name}}_improvement.md` | §Implementation Plan |
| Entry bootstrap | this file | §Entry Points |
| Symbol lookup | this file | §Symbol Index |
