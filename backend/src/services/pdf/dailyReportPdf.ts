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

export interface DailyReportDoc {
  projectId: string;
  projectName?: string;
  date: string; // YYYY-MM-DD
  groups: DailyReportGroup[];
}

const PHOTOS_PER_PAGE = 6; // 2 cols x 3 rows

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
      @page { size: A4; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Sarabun', 'TH Sarabun New', 'Tahoma', sans-serif;
        font-size: 12px; line-height: 1.3; color: #000; background: white;
      }
      .page {
        width: 210mm; min-height: 277mm; margin: 0 auto; background: white;
        display: flex; flex-direction: column; position: relative;
      }
      .page-break { page-break-after: always; }

      /* Report header */
      .doc-title { text-align: center; margin-bottom: 10px; }
      .doc-title h1 { font-size: 18px; font-weight: bold; }
      .doc-title .sub { font-size: 13px; margin-top: 2px; }

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

      /* Photo pages (ported qc 2x3 grid) */
      .photo-page-title { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
      .photo-page-sub { font-size: 12px; margin-bottom: 8px; color: #333; }
      .photos-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(3, 1fr);
        gap: 10px 12px; margin-top: 6px; flex-grow: 1; min-height: 0;
      }
      .photo-item {
        break-inside: avoid; page-break-inside: avoid;
        display: flex; flex-direction: column; min-height: 0; overflow: hidden;
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
      <div class="doc-title">
        <h1>รายงานประจำวัน (Daily Report)</h1>
        <div class="sub">${esc(doc.projectName || doc.projectId)} · วันที่ ${esc(
    fmtThaiDate(doc.date)
  )}</div>
      </div>
      <table class="work-table">
        <thead>
          <tr>
            <th class="col-no">ลำดับ</th>
            <th class="col-task">รายละเอียดงาน</th>
            <th class="col-area">พื้นที่</th>
            <th class="col-today">%วันนี้</th>
            <th class="col-cumu">%สะสม</th>
            <th class="col-note">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows || '<tr><td colspan="6" class="center">ไม่มีข้อมูลงานในวันนี้</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Photo pages, grouped by category (each category's photos paginate 6/page).
function buildPhotoPages(
  doc: DailyReportDoc,
  photoSrc: Map<string, string | null>
): string {
  const pages: string[] = [];
  for (const g of doc.groups) {
    const photos = g.entries.flatMap((e) => e.photos);
    if (photos.length === 0) continue;
    const pageChunks = chunk(photos, PHOTOS_PER_PAGE);
    pageChunks.forEach((pagePhotos, pageIdx) => {
      const cells = pagePhotos
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
      const suffix =
        pageChunks.length > 1 ? ` (${pageIdx + 1}/${pageChunks.length})` : '';
      pages.push(`
        <div class="page">
          <div class="photo-page-title">หมวดงาน: ${esc(g.categoryName)}${suffix}</div>
          <div class="photo-page-sub">${esc(doc.projectName || doc.projectId)} · ${esc(
        fmtThaiDate(doc.date)
      )}</div>
          <div class="photos-grid">${cells}</div>
        </div>`);
    });
  }
  return pages.join('\n<div class="page-break"></div>\n');
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
