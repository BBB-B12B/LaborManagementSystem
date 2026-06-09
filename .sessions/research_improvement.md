---
repo_name: "{{repo_name}}"
date: "{{date}}"
source_url: "{{source_url}}"
language: "{{language}}"
size_tier: "{{size_tier}}"
---

# Improvement Plan — {{repo_name}}
> TS/Next.js adaptation of findings from {{repo_name}} ({{language}}).
> All code references adapted to TypeScript + Next.js App Router conventions.

---

## Findings

### Finding 1 — {{finding_title}}
| Field | Value |
|---|---|
| Source File | `{{source_file}}:{{source_line}}` |
| Pattern | {{pattern_name}} |
| Applicability | High / Medium / Low |
| Effort | Small / Medium / Large |

**What it does (original):**
> Description of the pattern/feature in the source repo.

**Why it matters for harness:**
> Why this is worth adopting. What problem it solves.

**Original code reference:**
```{{language_lower}}
// {{source_file}} L{{source_line}}–L{{source_end}}
// (excerpt — see {{repo_name}}_repo_map.md for full context)
{{original_code_snippet}}
```

**TS/Next.js adaptation:**
```typescript
// Adapted for: src/{{target_path}}
// Context: {{ts_context}}
{{ts_adapted_code}}
```

> ⚠️ Adaptation notes: {{adaptation_notes}}

---

### Finding 2 — {{finding_title_2}}
<!-- Repeat block above for each finding -->

---

## Implementation Plan

### Phase A — {{phase_a_title}} ({{effort_a}})
> Prerequisite: none | Depends on: none

**Steps:**
1. [ ] Create `src/{{file_a_1}}` — {{description_a_1}}
2. [ ] Update `src/{{file_a_2}}` — {{description_a_2}}
3. [ ] Add test: `src/__tests__/{{test_a}}.test.ts`

**Verify:**
```bash
# Confirm implementation
grep -n "{{symbol_a}}" src/{{file_a_1}}
```

---

### Phase B — {{phase_b_title}} ({{effort_b}})
> Prerequisite: Phase A complete

**Steps:**
1. [ ] ...

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| {{risk_1}} | High / Medium / Low | {{mitigation_1}} |
| {{risk_2}} | High / Medium / Low | {{mitigation_2}} |

---

## Quick Wins (≤1 day each)
> Low-effort, high-value items from this research.

- **QW-1**: {{quick_win_1}} → `src/{{qw_path_1}}`
- **QW-2**: {{quick_win_2}} → `src/{{qw_path_2}}`

---

## Dependencies / Prerequisites
> Packages or infra needed before implementation.

| Package | Purpose | Install |
|---|---|---|
| `{{package_1}}` | {{purpose_1}} | `npm install {{package_1}}` |

---

## References
- Summary: [`{{repo_name}}_summary.md`](./{{repo_name}}_summary.md)
- Repo Map: [`{{repo_name}}_repo_map.md`](./{{repo_name}}_repo_map.md)
- Source: {{source_url}}
