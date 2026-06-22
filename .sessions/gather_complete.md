# Gather Complete — T-044 daily-reports photo attach: consistent camera+gallery on mobile

date: 2026-06-22
task: T-044 daily-reports image attach — give Android the same camera-OR-gallery choice as iOS via an in-app popup chooser

## Objective
On mobile, tapping "แนบรูป" in /daily-reports must offer the SAME choice on Android and iOS:
"ถ่ายรูป" (open camera) OR "เลือกรูปจากเครื่อง" (gallery/files). Currently Android jumps
straight to the file picker (no camera) because inputs use `accept="image/*"` with NO `capture`
attribute (confirmed: `capture` is used nowhere in the codebase) — the browser decides, and the
two platforms decide differently.

## Root cause
`<input type="file" accept="image/*">` with no `capture` -> browser-controlled UX. iOS shows a
menu (camera/library), Android Chrome usually opens gallery only. Fix = app controls the choice
via a popup, backed by two inputs: camera input (`accept="image/*" capture="environment"`) +
gallery input (original accept).

## Affected files
| File | Why | Lines |
|---|---|---|
| frontend/src/components/forms/PhotoSourcePicker.tsx | NEW reusable popup chooser component | new |
| frontend/src/pages/daily-reports/index.tsx | swap 4 label-wrapped inputs -> PhotoSourcePicker | ~1900, ~2069, ~4921, ~5121 |

## 4 attach sites in index.tsx
1. Site photo grid (~1936): Box label · accept image/* · multiple · onUpload(files)
2. Labor-shift photo grid (~2069): Box label · accept image/* · handleLaborShiftPhotoUpload(files, shiftKey) · disabled=isGridDisabled
3. Med-cert (table row, ~4927): IconButton label · accept image/*,application/pdf · onUploadCert(files[0])
4. Med-cert (expanded, ~5123): IconButton label · accept image/*,application/pdf · onUploadCert(files[0])

## Constraints
- Camera option = image only (capture). Gallery option keeps each site's original `accept`
  (image/* for photo grids, image/*,application/pdf for med-cert).
- Preserve existing visuals (140x140 dashed Box for grids, paperclip IconButton for med-cert).
- Reset input value after select so re-picking the same file fires onChange.
- No backend change. FE only. Do NOT commit/push (git-workflow-main-only).

## Acceptance criteria
- tsc EXIT=0
- All 4 sites render the popup; camera item triggers capture input, gallery item triggers plain input.
- grep -c "PhotoSourcePicker" index.tsx == 5 (1 import + 4 uses)
- grep "capture=" PhotoSourcePicker.tsx present.

[done] gather
