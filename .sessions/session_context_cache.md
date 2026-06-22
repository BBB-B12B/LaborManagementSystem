# Context Cache — 2026-06-22 14:21
task: T-044 daily-reports photo attach — camera+gallery popup (consistent Android/iOS)
phase: done
next: user tests on mobile (Android should now show ถ่ายรูป/เลือกรูป popup like iOS) then commits/pushes on main (do NOT commit/push). NEW file frontend/src/components/forms/PhotoSourcePicker.tsx (popup chooser: camera input has capture=environment; gallery + optional file input). Swapped into frontend/src/pages/daily-reports/index.tsx at 4 sites: site photo grid (2 opts), labor-shift photo grid (2 opts, disabled passthrough), 2x med-cert (3 opts incl. fileAccept image/*,application/pdf -> ถ่ายรูป/เลือกรูป/แนบไฟล์). Root cause: bare `<input accept=image/*>` with no capture let each browser decide. FE only, no backend. tsc EXIT=0.
session_total: ~405323
chat_total: ~428064
cache_read: 0
cache_write: 0
pending_sections:
  - [ ] M3: plan + Verify-N sent to user -> awaiting confirm
  - [ ] M4: roadmap [ ] T-044 added
