# MECE Plan — T-044 daily-reports photo attach (camera+gallery popup)

date: 2026-06-22
task: T-044 daily-reports image attach — Android gets same camera-OR-gallery choice as iOS via in-app popup
skill: coding

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [X] B1: compact_state checked · SESSION_TOTAL=0 · CHAT_TOTAL=sys_fixed · CFP_COUNT=37 stored
- [X] B2-B3: skill=coding identified · SKILL.md (compact-restore hashes)
- [X] C0-C3: topic-switch from T-039 -> T-044 confirmed · routing done

## Phase 1 — Info Gather
- [X] G1/G2: all 4 attach sites located · capture confirmed absent codebase-wide
- [X] G3: per-site file/symbol + Verify-N drafted · [✓ gather] emitted
- [X] gather_complete.md written today

### Files Read — Phase 1
| File | Why | Lines read |
|---|---|---|
| frontend/src/pages/daily-reports/index.tsx | locate 4 attach inputs + handlers | 1840-2089, 4890-5134 |
| frontend/src/pages/daily-reports/mobile/create.tsx | confirm mobile flow uses index.tsx surfaces | 1-60 |

## Phase 2 — Plan
- [X] M1.5: dependency_map: [PhotoSourcePicker.tsx -> index.tsx (import)] · risk: large file (index.tsx ~5k lines) -> use exact-match Edits · reversible (git checkout)
- [X] M2: sections below · Tool: Write/Edit · Avoid: backend, commit/push
- [ ] M3: plan + Verify-N sent to user -> awaiting confirm
- [ ] M4: roadmap [ ] T-044 added
- [X] M5: this file written from schema

## Phase 3 — Execute

### Cycle grouping
Cycle 1 — serial · agents: 1 → S1 (create component)
Cycle 2 — serial · agents: 1 → S2 (swap 4 sites · depends on S1)
Cycle 3 — serial · agents: 1 → S3 (verify tsc + index sync)

### Per-Section Invariants
- mece_plan dated today + T-044 roadmap [/] before edits · [pre-edit] before Edit · [✓ written] grep after
- L4.5 PURGE: drop Bash/grep after verdict · keep Read excerpts ≤10L

### S1 · T-044 · Create PhotoSourcePicker component      [Cycle 1 · serial]
Context: reusable popup chooser — tap trigger -> Menu. Items: ถ่ายรูป(camera capture, image/*), เลือกรูป(gallery, image/*). Optional 3rd item แนบไฟล์ shown only when `fileAccept` prop passed (e.g. image/*,application/pdf for med-cert). 2-3 hidden inputs accordingly. onSelect(FileList). Preserves trigger visual via children + sx + optional component prop. Photo grids: no fileAccept (2 items). Med-cert: fileAccept="image/*,application/pdf" (3 items).
Skill: coding
Model: model_medium
Input_From: none
File: frontend/src/components/forms/PhotoSourcePicker.tsx
Tool: Write
Avoid: backend, commit/push
Rollback: rm PhotoSourcePicker.tsx
Data_Sent: full component source (MUI Menu/MenuItem/ListItemIcon/ListItemText + lucide Camera/ImagePlus)
Token: ~400
Verify-1: grep -c "capture=\"environment\"" PhotoSourcePicker.tsx -> 1 ; grep -c "onSelect" PhotoSourcePicker.tsx -> >=2

### S2 · T-044 · Swap 4 attach sites in index.tsx         [Cycle 2 · serial]
Context: replace each `component="label"` Box/IconButton + inner hidden input with <PhotoSourcePicker> passing the same visual children, accept, multiple, disabled, and onSelect mapping to existing handlers (onUpload / handleLaborShiftPhotoUpload / onUploadCert).
Skill: coding
Model: model_medium
Input_From: S1
File: frontend/src/pages/daily-reports/index.tsx
Tool: Edit
Avoid: backend, commit/push
Rollback: git checkout frontend/src/pages/daily-reports/index.tsx
Data_Sent: 1 import line + 4 exact-match Edits (site grid, labor grid, 2 med-cert)
Token: ~500
Verify-1: grep -c "PhotoSourcePicker" index.tsx -> 5 ; grep -c "component=\"label\"" daily-reports/index.tsx -> 0

### S3 · T-044 · Verify + index sync                       [Cycle 3 · serial]
Context: tsc clean + register new file in index.
Skill: coding
Model: model_low
Input_From: S2
File: (verify only)
Tool: Bash
Avoid: commit/push
Rollback: n/a
Data_Sent: cd frontend && npx tsc --noEmit ; python3 scripts/backlink_analyzer.py
Token: ~200
Verify-1: tsc EXIT=0
Verify-2: [r8-sync-check] index_files.json includes PhotoSourcePicker.tsx

- [X] S1
- [X] S2
- [X] S3

## Phase 3 Close Checklist
- [X] all [X] · tsc EXIT=0 · R8 index sync · roadmap [X] T-044 · active_thread phase:done · NOT committed (user pushes on main)
