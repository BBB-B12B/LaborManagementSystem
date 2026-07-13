# Human-In-The-Loop — Manual Verification Queue

> Things a human must check on a real device / real login / real data — code + `tsc` alone can't prove these.
> Tick each box after verifying. When every box for a task is ticked, move the task to `## Verified` at the bottom.

---

## T-047 · Daily Report "รูปถ่ายหน้างาน" — document attach + preview popup
Status: code-complete + tsc-clean · **awaiting device verification**
Changed: `frontend/src/pages/daily-reports/index.tsx`

### A. Attach (Desktop · /daily-reports)
- [ ] Open a daily report, site section "รูปถ่ายหน้างาน", in edit mode
- [ ] Click the dashed attach tile → the picker now shows a **"แนบไฟล์/เอกสาร"** (Paperclip) option
- [ ] Attach a **PDF** → tile shows a **red** file-card (icon + filename), NOT a broken image
- [ ] Attach a **.docx / .xlsx** → tile shows a **gray** file-card
- [ ] Attach a normal **image** → tile still shows the image thumbnail as before
- [ ] Save/submit the report → succeeds, no error

### B. Preview (reopen the saved report)
- [ ] PDF card persists with the correct filename (the `timestamp-` prefix is stripped)
- [ ] Click the **PDF** card → popup opens with the PDF **rendered inline** (iframe)
- [ ] Click **"ดาวน์โหลด"** on the PDF → file **saves to disk** (or opens in a new tab — see E)
- [ ] Click a **.docx/.xlsx** card → popup shows a **download-only** card + working download
- [ ] Click an **image** → the **existing lightbox** opens (with prev/next), NOT the file dialog
- [ ] Report with **mixed image + PDF**: image lightbox carousel cycles through **images only** (no broken/blank frames from the PDF)

### C. Mobile (daily-reports mobile view / mobile create)
- [ ] Attach flow works via the mobile bottom-sheet picker
- [ ] "ถ่ายรูป" (geo-stamp camera) still works for images
- [ ] PDF inline preview + download work in the mobile browser

### D. Regression (must be UNCHANGED)
- [ ] Labor-shift / worker photo grids are still image-only and behave exactly as before
- [ ] Existing reports that only have images look and behave exactly as before

### E. Infra — only needed for true force-save on already-saved files
- [ ] Firebase Storage bucket has **CORS** configured to allow `GET` from the web app origin.
      If not set: the Download button falls back to **open-in-new-tab** (still usable, just not an instant save).
      Newly-picked files (not yet saved) always force-save fine (same-origin blob).

---

## T-051 · Daily Report Log — revision scoping (calendar 100% bleed)
Status: code-complete + tsc-clean · **awaiting device verification** (carried over)
Changed: `TaskDailyReportModal.tsx`, `backend/src/services/TaskService.ts`, `tasks.routes.ts` · ERR-091
- [ ] Leader rejects a task → a new revision is created (dailyProgress resets to 0)
- [ ] Open the Daily Report Log calendar for the **new** revision → day-1 is **empty** (0%), NOT the old revision's 100%
- [ ] The previous (rejected) revision's reports do not appear on the new revision's calendar
- [ ] Same-date reports across revisions are not dropped by backend dedup

---

## Verified
<!-- move fully-ticked task blocks here with the verify date, e.g.: -->
<!-- - T-050 · OT independence per job · verified 2026-07-xx on device -->
