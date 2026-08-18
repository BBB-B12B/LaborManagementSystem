// Daily Request PDF engine (T-062) — SELF-CONTAINED in LMS backend.
//
// Sibling of dailyReportPdf.ts (T-058). Same architecture (HTML -> Puppeteer ->
// A4 PDF, Thai Sarabun font) but SIMPLER: the source is the daily-request data
// users already log (After-Sale `requests` collectionGroup), there are NO photos,
// and the layout is a single flat numbered table — not the category-grouped +
// photo-page structure of the Daily Report.
//
// Template = ใบแจ้งการดำเนินงานประจำวัน (DAILY REQUEST): one row per logged work
// item with columns รายการที่ / รายละเอียดงาน / พื้นที่ / วัน เดือน ปี / เวลา.
// The letterhead first page is out of scope for v1. The พื้นที่ (area) column
// renders blank for now (no source field yet — same as Daily Report).
//
// Puppeteer resolution is identical to dailyReportPdf.ts (see that file's header).

import puppeteer from 'puppeteer';

// ---- Data contract (matches GET /api/tasks/daily-request-doc) ---------------
export interface DailyRequestRow {
  detail: string; // รายละเอียดงาน — task > subtask name
  area?: string; // พื้นที่ — blank for now (no source field yet)
  date: string; // วัน เดือน ปี — YYYY-MM-DD (per-row; usually = doc.date)
  time: string; // เวลา — a single period's range, e.g. "07:00 - 08:00" or "-"
  period?: string; // time-period key: otMorning | day | otNoon | otEvening | none (T-063)
  periodLabel?: string; // section header text: "OT เช้า" | "งานปกติ" | "OT เที่ยง" | "OT เย็น"
  periodOrder?: number; // display order within the doc (0..3, 99 = fallback)
}

/**
 * Per-project letterhead values for the document header (T-069). All optional so
 * the header degrades gracefully when a project has no saved config: no logo,
 * projectName falls back to the id, no contractor line, blank เลขที่.
 */
export interface DailyRequestHeader {
  logoDataUri?: string | null; // base64 data URI, embedded server-side (no network fetch)
  projectTitle?: string | null; // "โครงการ <projectTitle>" — usually the Project doc name
  contractorName?: string | null; // "ผู้รับจ้าง : <contractorName>"
  showContractor?: boolean; // hide the contractor line entirely when false
  docNumberPrefix?: string | null; // "เลขที่ <prefix>/………" — running number filled by hand
}

export interface DailyRequestDoc {
  projectId: string;
  projectName?: string;
  date: string; // YYYY-MM-DD — the report date
  rows: DailyRequestRow[];
  header?: DailyRequestHeader;
}

// ---- helpers ---------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// ---- CSS -------------------------------------------------------------------

function inlineCSS(): string {
  return `
    <style>
      @page { size: A4; margin: 7.5mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Sarabun', 'TH Sarabun New', 'Tahoma', sans-serif;
        font-size: 16px; line-height: 1.35; color: #000; background: white;
      }
      .page {
        /* @page reserves 7.5mm margins on A4 (210×297) → printable area is
           195×282mm. Box fills that width, but 4mm side padding insets the
           content so the outer table border isn't flush with the printable
           edge (a flush 1.5px border gets clipped ~half → looks thinner than
           the inner borders). box-sizing:border-box → content = 187mm. */
        width: 195mm; min-height: 282mm; margin: 0 auto; padding: 0 4mm;
        background: white; display: flex; flex-direction: column; position: relative;
      }

      /* Document header (letterhead) — matches the ESCENT HATYAI reference:
         TOP band  = large logo (left, absolute) + centered project + subtitle
         BOTTOM band = ผู้รับจ้าง (left) ↔ เลขที่/วันที่ (right) */
      /* No rule under the letterhead (user call, 2026-08-18 — same change made to
         the Daily Report so the two documents stay visually consistent): spacing
         alone separates the header from the table. */
      .doc-header {
        padding-bottom: 8px; margin-bottom: 10px;
      }
      /* Logo on its own row (top, left-aligned); the title centres full-width
         in the row BELOW it. No horizontal overlap, and the title stays
         page-centred. No logo → the empty row collapses and the title rises. */
      .dh-logo img { max-width: 240px; max-height: 66px; object-fit: contain; display: block; }
      .dh-title { text-align: center; padding: 0 10px; margin-top: 6px; }
      .dh-title .project { font-size: 18px; font-weight: bold; }
      .dh-title .subtitle { font-size: 16px; font-weight: bold; margin-top: 8px; }
      .dh-bottom { display: flex; align-items: flex-start; margin-top: 10px; }
      .dh-contractor { font-size: 15px; }
      .dh-meta { margin-left: auto; text-align: right; font-size: 15px; }
      .dh-meta div { margin-bottom: 2px; }

      /* Request table */
      .req-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .req-table th, .req-table td {
        border: 1.5px solid #000; padding: 6px 8px; font-size: 16px; vertical-align: top;
      }
      .req-table th { background: #e8e8e8; text-align: center; font-weight: bold; }
      .req-table td.center { text-align: center; }
      .req-table td.section {
        background: #d0d0d0; font-weight: bold; text-align: left; font-size: 16px;
      }
      .col-no     { width: 8%;  text-align: center; }
      .col-detail { width: 44%; }
      .col-area   { width: 16%; }
      .col-date   { width: 16%; text-align: center; }
      .col-time   { width: 16%; text-align: center; }

      /* Signature footer (approval block) — static form fields, no data source */
      .sign-table { width: 100%; border-collapse: collapse; margin-top: auto; }
      .sign-table td {
        border: 1.5px solid #000; padding: 8px 12px; vertical-align: top; font-size: 16px;
      }
      .sign-left  { width: 50%; height: 90px; }
      .sign-right { width: 50%; }
      .s-line { display: flex; align-items: flex-end; }
      .s-line .fill { flex: 1; border-bottom: 1px solid #000; margin-left: 6px; height: 1.1em; }
      /* Printed-name parens sit centered UNDER the signature line: reserve the
         label's width (invisible) so the parens balance over the blank line, not
         the whole cell. */
      .s-paren   { display: flex; margin-top: 1px; }
      .s-paren .s-lbl { visibility: hidden; white-space: nowrap; }
      /* Parens span the full width of the signature line above: "(" sits at the
         line start, ")" at the line end, matching the paper template. */
      .s-paren .s-pc  { flex: 1; display: flex; align-items: center; margin-left: 6px; }
      .s-paren .s-pc .p-gap { flex: 1; }
      /* Right-side signature parens span the full width of the ลงชื่อ line
         above — same technique as the left block, dotted to match this side. */
      .s-paren-c { display: flex; margin-top: 1px; }
      .s-paren-c .s-lbl { visibility: hidden; white-space: nowrap; }
      .s-paren-c .s-pc  { flex: 1; display: flex; align-items: center; margin-left: 6px; }
      .s-paren-c .s-pc .p-dot { flex: 1; border-bottom: 1px dotted #000; margin: 0 3px; height: 1em; }
      .s-pos     { margin-top: 5px; }
      .s-company { margin-top: 4px; }
      .s-date-l  { margin-top: 6px; }
      .s-head    { font-weight: bold; margin-bottom: 10px; }
      .s-approve { margin-bottom: 14px; }
      .s-approve .chk {
        display: inline-block; width: 16px; height: 16px;
        border: 1px solid #000; vertical-align: middle; margin-right: 6px;
      }
      .s-approve .chk2 { margin-left: 30px; }
      .s-sign { display: flex; align-items: flex-end; margin-top: 6px; }
      .s-sign .d-fill { flex: 1; border-bottom: 1px dotted #000; margin-left: 6px; height: 1.1em; }
      .s-date { margin-top: 8px; }
    </style>
  `;
}

// ---- HTML builder ----------------------------------------------------------

function buildSignatureFooter(): string {
  // Static approval/signature block (blank fields to sign by hand) — mirrors the
  // paper form: ผู้เสนอ (Site Engineer) + ตรวจสอบ (Project Engineer) on the left,
  // the supervising engineer's approval opinion on the right.
  return `
      <table class="sign-table">
        <tr>
          <td class="sign-left">
            <div class="s-line"><span>ผู้เสนอ :</span><span class="fill"></span></div>
            <div class="s-paren"><span class="s-lbl">ผู้เสนอ :</span><span class="s-pc">(<span class="p-gap"></span>)</span></div>
            <div class="s-pos">ตำแหน่ง : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Site Engineer</div>
          </td>
          <td class="sign-right" rowspan="2">
            <div class="s-head">ความเห็นของวิศวกรผู้ควบคุมงาน/สถาปนิกผู้ควบคุมงาน</div>
            <div class="s-approve">
              <span class="chk"></span> เสนออนุมัติ
              <span class="chk chk2"></span> ไม่อนุมัติ
            </div>
            <div class="s-sign"><span>ลงชื่อ</span><span class="d-fill"></span></div>
            <div class="s-paren-c"><span class="s-lbl">ลงชื่อ</span><span class="s-pc">(<span class="p-dot"></span>)</span></div>
            <div class="s-company">บริษัท</div>
            <div class="s-date">วันที่__________________ &nbsp;&nbsp; เวลา__________________</div>
          </td>
        </tr>
        <tr>
          <td class="sign-left">
            <div class="s-line"><span>ตรวจสอบ :</span><span class="fill"></span></div>
            <div class="s-paren"><span class="s-lbl">ตรวจสอบ :</span><span class="s-pc">(<span class="p-gap"></span>)</span></div>
            <div class="s-pos">ตำแหน่ง : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Project Engineer</div>
            <div class="s-company">บริษัท</div>
            <div class="s-date-l">วันที่.........................................................</div>
          </td>
        </tr>
      </table>`;
}

function buildDocHeader(doc: DailyRequestDoc): string {
  const h = doc.header || {};
  const projectTitle = h.projectTitle || doc.projectName || doc.projectId;
  const logo = h.logoDataUri
    ? `<img src="${esc(h.logoDataUri)}" alt="logo" />`
    : '';
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
            <div class="subtitle">ใบแจ้งการดำเนินงานประจำวัน (Daily Request)</div>
          </div>
        </div>
        <div class="dh-bottom">
          ${contractorLine}
          <div class="dh-meta">
            <div>เลขที่ ${docNo}</div>
            <div>วันที่ ${esc(fmtThaiDate(doc.date))}</div>
          </div>
        </div>
      </div>`;
}

function buildRequestTable(doc: DailyRequestDoc): string {
  // Rows arrive pre-sorted by periodOrder then detail (see buildDailyRequestDoc),
  // so a section header is emitted whenever the period label changes (T-063).
  // รายการที่ numbering is continuous across the whole document.
  let lastLabel: string | null = null;
  const bodyRows = doc.rows
    .map((r, i) => {
      const rowDate = r.date || doc.date;
      let header = '';
      if (r.periodLabel && r.periodLabel !== lastLabel) {
        lastLabel = r.periodLabel;
        header = `
        <tr><td class="section" colspan="5">${esc(r.periodLabel)}</td></tr>`;
      }
      return `${header}
        <tr>
          <td class="col-no">${i + 1}</td>
          <td class="col-detail">${esc(r.detail)}</td>
          <td class="col-area">${esc(r.area || '')}</td>
          <td class="col-date">${esc(fmtThaiDate(rowDate))}</td>
          <td class="col-time">${esc(r.time || '-')}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="page">
      ${buildDocHeader(doc)}
      <table class="req-table">
        <thead>
          <tr>
            <th class="col-no">รายการที่</th>
            <th class="col-detail">รายละเอียดงาน</th>
            <th class="col-area">พื้นที่</th>
            <th class="col-date">วัน เดือน ปี</th>
            <th class="col-time">เวลา</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows || '<tr><td colspan="5" class="center">ไม่มีข้อมูลการแจ้งงานในวันนี้</td></tr>'}
        </tbody>
      </table>
      ${buildSignatureFooter()}
    </div>`;
}

// ---- public API ------------------------------------------------------------

/** Build the full Daily Request HTML. Exposed for tests. */
export function buildDailyRequestHtml(doc: DailyRequestDoc): string {
  const tableHtml = buildRequestTable(doc);
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8" />${inlineCSS()}</head><body>${tableHtml}</body></html>`;
}

/**
 * Render a Daily Request PDF from the document shape.
 * Returns a PDF Buffer. Caller streams it to the client.
 */
export async function renderDailyRequestPdf(doc: DailyRequestDoc): Promise<Buffer> {
  const html = buildDailyRequestHtml(doc);

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
