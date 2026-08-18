// Daily Report PDF engine (T-058) — SELF-CONTAINED in LMS backend.
//
// Architecture (spike decision 2026-08-13): LMS OWNS PDF generation so the old
// qc-report-new system can be retired. Host = this Express backend (Docker /
// node:20-alpine container), NOT Cloud Functions — a persistent container can run
// a real Chromium without the heavy @sparticuz/chromium serverless shim.
//
// Puppeteer resolution:
//   - Local dev (Windows): full `puppeteer` bundles a matching Chromium at install.
//   - Container (Alpine):  set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
//                          (apk chromium) + PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true.
//
// Template = ESCENT HATYAI daily report: a work-details table grouped by work
// category, then photo pages (6 photos/page, caption below each), also grouped by
// category. Photo-grid CSS is ported from qc-report-new pdf-generator.ts (proven
// A4 2x3 layout). Page-1 "ทรัพยากรที่ใช้" (resources/weather) is out of scope for v1;
// the พื้นที่ (area) column renders blank (no source field yet — separate ticket).

import puppeteer from 'puppeteer';

// ---- Data contract (matches GET /api/tasks/daily-report-doc, S1b) ----------
export interface DailyReportPhoto {
  id: string;
  url: string;
  caption: string; // task name + progress
}

export interface DailyReportEntry {
  categoryId?: string | null;
  categoryName: string;
  taskName: string;
  todayProgress: number; // %วันนี้ (today's added progress)
  cumulativeProgress: number; // %สะสม (cumulative)
  note?: string;
  status?: string | null;
  photos: DailyReportPhoto[];
}

export interface DailyReportGroup {
  categoryId?: string | null;
  categoryName: string;
  entries: DailyReportEntry[];
}

export interface DailyReportHeader {
  logoDataUri?: string | null; // base64 data URI, embedded server-side (no network fetch)
  projectTitle?: string | null; // falls back to projectName / projectId
  docNumberPrefix?: string | null; // Daily REPORT running-number prefix ("เลขที่ <prefix>/…")
  contractorName?: string | null;
  showContractor?: boolean;
}

export interface DailyReportDoc {
  projectId: string;
  projectName?: string;
  date: string; // YYYY-MM-DD
  groups: DailyReportGroup[];
  header?: DailyReportHeader;
}

// ---- helpers ---------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(n: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  // trim trailing .0 for whole numbers, keep up to 1 decimal otherwise
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function fmtThaiDate(isoDate: string): string {
  // YYYY-MM-DD -> D MMM YYYY(BE) in Thai
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return `${d} ${months[mo] ?? ''} ${y + 543}`;
}

// Fetch a remote image and inline it as a data URI. Loading remote URLs directly
// in Chromium is timing-fragile; embedding base64 is deterministic. Failures are
// tolerated (rendered as an empty photo box) so one bad URL never fails the PDF.
async function toDataUri(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url; // already inline — no fetch needed
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ---- CSS (photo-grid ported from qc-report-new; table CSS is new) ----------

function inlineCSS(): string {
  return `
    <style>
      @page { size: A4; margin: 7.5mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Sarabun', 'TH Sarabun New', 'Tahoma', sans-serif;
        font-size: 12px; line-height: 1.3; color: #000; background: white;
      }
      .page {
        /* @page reserves 7.5mm margins on A4 (210×297) → printable area is
           195×282mm, and the box is exactly that (no padding → content is a
           full 195mm wide). The old 210mm width was the FULL sheet width, so
           with 10mm margins the right 20mm of every page spilled onto an extra
           sheet. Matches dailyRequestPdf's geometry. */
        width: 195mm; min-height: 282mm; margin: 0 auto; background: white;
        display: flex; flex-direction: column; position: relative;
      }
      .page-break { page-break-after: always; }

      /* Report header (letterhead) — logo left, centered โครงการ + title, and
         เลขที่/วันที่/Duration on the right (matches the ESCENT HATYAI paper form).
         No logo → the row collapses and the title rises. */
      /* No rule under the letterhead (user call, 2026-08-18): the document reads
         cleaner with whitespace doing the separating. Spacing kept so the header
         does not crowd the table. */
      .doc-header { padding-bottom: 8px; margin-bottom: 10px; }
      .dh-logo img { max-width: 200px; max-height: 60px; object-fit: contain; display: block; }
      .dh-title { text-align: center; padding: 0 10px; margin-top: 4px; }
      .dh-title .project { font-size: 16px; font-weight: bold; }
      .dh-title .subtitle { font-size: 15px; font-weight: bold; margin-top: 6px; }
      .dh-bottom { display: flex; align-items: flex-start; margin-top: 8px; }
      .dh-contractor { font-size: 13px; }
      .dh-meta { margin-left: auto; text-align: right; font-size: 13px; }
      .dh-meta div { margin-bottom: 2px; }

      /* Work-details table */
      .work-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .work-table th, .work-table td {
        border: 1px solid #000; padding: 4px 6px; font-size: 12px; vertical-align: top;
      }

      .work-table th { background: #e8e8e8; text-align: center; font-weight: bold; }
      .work-table td.center { text-align: center; }
      .work-table tr.cat-row td {
        background: #f2f2f2; font-weight: bold; text-align: left;
      }
      .col-no    { width: 6%;  text-align: center; }
      .col-task  { width: 40%; }
      .col-area  { width: 12%; }
      .col-today { width: 10%; text-align: center; }
      .col-cumu  { width: 10%; text-align: center; }
      .col-note  { width: 22%; }

      /* Signature footer (ช่องเซ็นท้ายตารางงาน) — static blank fields to sign by
         hand, no data source. margin-top:auto sinks the block to the bottom of
         the flex .page when the work table is short; on a table that overflows
         the sheet the block simply follows the table (break-inside keeps it
         whole instead of splitting across the page edge). */
      .rsign-table {
        width: 100%; border-collapse: collapse; margin-top: auto;
        page-break-inside: avoid; break-inside: avoid;
      }
      .rsign-table th, .rsign-table td { border: 1px solid #000; }
      /* Thicker rule separating the block from the work table above. Declared
         after the shared border rule (same specificity) so it wins without
         !important. */
      .rsign-table th { border-top-width: 2px; }
      .rsign-head { text-align: center; font-weight: bold; font-size: 13px; padding: 4px 6px; }
      .rsign-cell {
        width: 33.33%; padding: 16px 16px 8px; text-align: center; vertical-align: top;
      }
      /* Dotted line to sign on, then the printed-name parens centered under it. */
      .rsign-sign { border-bottom: 1px dotted #000; height: 24px; margin: 0 14px; }
      .rsign-paren { display: flex; justify-content: center; align-items: center; margin: 5px 14px 0; }
      .rsign-paren .rsign-pdots {
        flex: 0 1 150px; border-bottom: 1px dotted #000; height: 1em; margin: 0 2px;
      }
      .rsign-role { margin-top: 10px; }
      /* "วันที่ ……" — the label must never wrap ("วัน"/"ที่" on two lines), so it
         is a nowrap span and the dotted tail is what shrinks. */
      .rsign-date { display: flex; justify-content: center; align-items: flex-end; margin-top: 10px; }
      .rsign-date .rsign-dlbl { white-space: nowrap; }
      .rsign-date .rsign-ddots {
        flex: 0 1 110px; min-width: 60px; border-bottom: 1px dotted #000;
        height: 1em; margin-left: 5px;
      }

      /* Photo pages — continuous flow across categories (save paper).
         A divider line precedes each category; categories share pages but a
         new category always starts on a new row. Fixed-height rows let @page
         paginate naturally (~3 rows / 6 photos per A4 page). */
      /* Same 195mm inner width as .page (the photo pages are body-level blocks,
         not .page boxes — without this they stretch to the viewport on screen
         and only happen to collapse to the printable width on paper). */
      .photo-section { width: 195mm; margin: 0 auto; border-collapse: collapse; }
      /* Repeating identifying header (T-075). The whole photo flow is ONE table,
         and Chrome re-prints a <thead> at the top of every page the table spans —
         so a photo page separated from the rest still names its project, date and
         document number. Styled like the old one-off sub-line, not like a table
         heading (left, normal weight, small grey). */
      /* Deliberately NO bottom rule: a category that happens to start at the top
         of a page would then print two horizontal lines a few px apart (this rule
         plus .cat-divider's own border-top), and CSS cannot know that a row landed
         at the top of a printed page. Spacing alone separates the header. */
      .photo-head {
        font-size: 12px; color: #333; text-align: left; font-weight: normal;
        padding: 0 0 10px;
      }
      /* Small top pad = breathing room under the repeated header on EVERY page
         (a first-child-only rule would leave pages 2+ touching the header rule). */
      .photo-cell { padding: 6px 0 0; }
      /* Break control belongs on the ROWS: inside a table Chrome applies
         break-after/inside avoidance at row level, so the break-after declared
         on .cat-divider itself would no longer stop a category header from being
         orphaned at the foot of a page once the divider lives inside a cell. */
      .photo-section tbody tr { break-inside: avoid; page-break-inside: avoid; }
      .photo-section tbody tr.cat-row { break-after: avoid; page-break-after: avoid; }
      /* No separator rule (user call, 2026-08-18) — the bold category name plus the
         gap above it is enough, and a rule here could land right under the repeated
         page header. break-after keeps the name from being orphaned at a page foot. */
      .cat-divider {
        font-size: 14px; font-weight: bold;
        margin-top: 14px; margin-bottom: 6px;
        break-inside: avoid; page-break-inside: avoid;
        break-after: avoid; page-break-after: avoid;
      }
      /* First category in the flow needs no gap above it — it already sits below
         the repeated header. Row-scoped: dividers live in table cells now. */
      .photo-section tbody tr:first-child .cat-divider { margin-top: 0; }
      .photo-row {
        display: flex; gap: 10px 12px; margin-bottom: 10px;
        break-inside: avoid; page-break-inside: avoid;
      }
      .photo-item {
        flex: 0 0 calc(50% - 6px); max-width: calc(50% - 6px);
        height: 76mm;
        display: flex; flex-direction: column; overflow: hidden;
        break-inside: avoid; page-break-inside: avoid;
      }
      .photo-wrapper {
        width: 100%; background: #f5f5f5; display: flex; align-items: center;
        justify-content: center; overflow: hidden; margin-bottom: 4px;
        flex-grow: 1; min-height: 0; position: relative;
      }
      .photo-wrapper.has-image { background: white; }
      .photo-wrapper img {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;
      }
      .photo-caption {
        text-align: center; font-size: 11px; padding: 2px 0;
        font-weight: normal; line-height: 1.3; flex-shrink: 0;
      }
    </style>
  `;
}

// ---- HTML builders ---------------------------------------------------------

// Letterhead ported from the Daily Request PDF, adapted for the report: same logo/
// project/เลขที่/วันที่ shape plus a Duration fill-in line. Degrades gracefully when
// no header/config is supplied (no logo, title from projectName/projectId, blank เลขที่).
function buildReportHeader(doc: DailyReportDoc): string {
  const h = doc.header || {};
  const projectTitle = h.projectTitle || doc.projectName || doc.projectId;
  const logo = h.logoDataUri ? `<img src="${esc(h.logoDataUri)}" alt="logo" />` : '';
  const docNo = `${esc(h.docNumberPrefix || '')}/……………`;
  const contractorLine =
    h.showContractor && h.contractorName
      ? `<div class="dh-contractor">ผู้รับจ้าง : ${esc(h.contractorName)}</div>`
      : '';
  return `
      <div class="doc-header">
        <div class="dh-top">
          <div class="dh-logo">${logo}</div>
          <div class="dh-title">
            <div class="project">โครงการ ${esc(projectTitle)}</div>
            <div class="subtitle">รายงานประจำวัน (DAILY REPORT)</div>
          </div>
        </div>
        <div class="dh-bottom">
          ${contractorLine}
          <div class="dh-meta">
            <div>เลขที่ ${docNo}</div>
            <div>วันที่ ${esc(fmtThaiDate(doc.date))}</div>
            <div>Duration ………/………</div>
          </div>
        </div>
      </div>`;
}

// Static signature block for the bottom of the work-table page — mirrors the
// paper form: two ผู้บันทึก/รายงาน/ผู้รับจ้าง columns (Site Engineer then
// Project Engineer) plus a รับทราบ/ผู้ควบคุมงาน column for the supervising
// company. Blank fields only — nothing here is data-bound.
function buildSignatureFooter(): string {
  const cell = (role: string) => `
          <td class="rsign-cell">
            <div class="rsign-sign"></div>
            <div class="rsign-paren">(<span class="rsign-pdots"></span>)</div>
            <div class="rsign-role">${role}</div>
            <div class="rsign-date"><span class="rsign-dlbl">วันที่</span><span class="rsign-ddots"></span></div>
          </td>`;
  return `
      <table class="rsign-table">
        <thead>
          <tr>
            <th class="rsign-head">ผู้บันทึก/รายงาน/ผู้รับจ้าง</th>
            <th class="rsign-head">ผู้บันทึก/รายงาน/ผู้รับจ้าง</th>
            <th class="rsign-head">รับทราบ / ผู้ควบคุมงาน</th>
          </tr>
        </thead>
        <tbody>
          <tr>${cell('Site Engineer')}${cell('Project Engineer')}${cell('บริษัท')}
          </tr>
        </tbody>
      </table>`;
}

function buildWorkTable(doc: DailyReportDoc): string {
  let rowNo = 0;
  const bodyRows = doc.groups
    .map((g) => {
      const catHeader = `
        <tr class="cat-row">
          <td colspan="6">หมวดงาน: ${esc(g.categoryName)}</td>
        </tr>`;
      const taskRows = g.entries
        .map((e) => {
          rowNo += 1;
          return `
        <tr>
          <td class="col-no">${rowNo}</td>
          <td class="col-task">${esc(e.taskName)}</td>
          <td class="col-area"></td>
          <td class="col-today">${fmtPct(e.todayProgress)}</td>
          <td class="col-cumu">${fmtPct(e.cumulativeProgress)}</td>
          <td class="col-note">${esc(e.note || '')}</td>
        </tr>`;
        })
        .join('');
      return catHeader + taskRows;
    })
    .join('');

  return `
    <div class="page">
      ${buildReportHeader(doc)}
      <table class="work-table">
        <thead>
          <tr>
            <th class="col-no" rowspan="2">ลำดับ</th>
            <th class="col-task" rowspan="2">รายละเอียดงาน</th>
            <th class="col-area" rowspan="2">พื้นที่</th>
            <th colspan="2">ดำเนินการได้</th>
            <th class="col-note" rowspan="2">หมายเหตุ</th>
          </tr>
          <tr>
            <th class="col-today">วันนี้</th>
            <th class="col-cumu">สะสม</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows || '<tr><td colspan="6" class="center">ไม่มีข้อมูลงานในวันนี้</td></tr>'}
        </tbody>
      </table>
      ${buildSignatureFooter()}
    </div>`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Photo section — photos flow continuously across categories to save paper.
// A divider line precedes each category; categories share pages (vertical
// continuation) but a new category always starts on a new row, so a photo is
// never mixed with another category's photos in the same row. Fixed-height
// rows let @page paginate the flow naturally instead of one page per category.
//
// The flow is a one-column TABLE (T-075) purely so its <thead> can carry the
// identifying line (project · date · doc number): Chrome re-prints a thead at
// the top of every page a table spans, so a photo page that gets separated from
// the rest still says which day and document it belongs to. Each block is its
// own <tr> — rows are where Chrome paginates a table, so the visual flow and the
// 6-photos-per-page rhythm are unchanged.
function buildPhotoPages(
  doc: DailyReportDoc,
  photoSrc: Map<string, string | null>
): string {
  const rows: string[] = [];
  // Every block becomes its own <tr> (not one giant cell) — row boundaries are
  // where Chrome paginates a table, so the flow keeps breaking exactly where the
  // old sibling divs did.
  const asRow = (inner: string, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}><td class="photo-cell">${inner}</td></tr>`;
  for (const g of doc.groups) {
    const photos = g.entries.flatMap((e) => e.photos);
    if (photos.length === 0) continue;
    rows.push(
      asRow(
        `<div class="cat-divider">หมวดงาน: ${esc(g.categoryName)}</div>`,
        'cat-row'
      )
    );
    for (const rowPhotos of chunk(photos, 2)) {
      const cells = rowPhotos
        .map((p) => {
          const data = photoSrc.get(p.id);
          const img = data
            ? `<div class="photo-wrapper has-image"><img src="${data}" /></div>`
            : `<div class="photo-wrapper"></div>`;
          return `
            <div class="photo-item">
              ${img}
              <div class="photo-caption">${esc(p.caption)}</div>
            </div>`;
        })
        .join('');
      rows.push(asRow(`<div class="photo-row">${cells}</div>`));
    }
  }
  if (rows.length === 0) return '';
  // Identifying one-liner, repeated on every photo page by the <thead> (T-075).
  // Same three values the letterhead prints, nothing new plumbed in. The doc
  // number is optional, so the whole segment drops rather than leaving a
  // dangling "เลขที่ /……".
  const h = doc.header || {};
  const parts = [
    `โครงการ ${esc(h.projectTitle || doc.projectName || doc.projectId)}`,
    `วันที่ ${esc(fmtThaiDate(doc.date))}`,
  ];
  if (h.docNumberPrefix) {
    parts.push(`เลขที่ ${esc(h.docNumberPrefix)}/……………`);
  }
  return `<table class="photo-section">
      <thead>
        <tr><th class="photo-head">${parts.join(' · ')}</th></tr>
      </thead>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>`;
}

// ---- public API ------------------------------------------------------------

/**
 * Render a Daily Report PDF from the S1b document shape.
 * Returns a PDF Buffer. Caller streams it to the client.
 */
/** Build the full report HTML (photos pre-fetched → data URIs). Exposed for tests. */
export async function buildDailyReportHtml(doc: DailyReportDoc): Promise<string> {
  // Pre-fetch every photo -> data URI (parallel, failures tolerated).
  const allPhotos = doc.groups.flatMap((g) => g.entries.flatMap((e) => e.photos));
  const photoSrc = new Map<string, string | null>();
  await Promise.all(
    allPhotos.map(async (p) => {
      photoSrc.set(p.id, await toDataUri(p.url));
    })
  );

  const tableHtml = buildWorkTable(doc);
  const photoHtml = buildPhotoPages(doc, photoSrc);
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8" />${inlineCSS()}</head><body>${tableHtml}${
    photoHtml ? '\n<div class="page-break"></div>\n' + photoHtml : ''
  }</body></html>`;
}

export async function renderDailyReportPdf(doc: DailyReportDoc): Promise<Buffer> {
  const html = await buildDailyReportHtml(doc);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 45000,
    });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
