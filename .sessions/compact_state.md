dt=2026-06-25
sk=editor
sk_h=skip
mece_h=skip
p3=in_progress
section=duplicate-taskname-bug
step=fix duplicate dialog clears taskName when user typed it before clicking duplicate
compact_size=4500
task: Fix duplicate clears taskName bug (TaskCreateModal)
phase: in_progress
next: in handleDuplicateConfirm, check that taskName is preserved — do NOT call reset() or setValue on taskName field; only setValue subtask fields
