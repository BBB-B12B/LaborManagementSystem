/**
 * Per-project Excel template store + fill engine for the Daily Request document (T-065).
 *
 * The idea: an admin uploads ONE .xlsx form per project. That form carries
 * placeholder tokens (e.g. {{projectId}}, {{dateThai}}) in its header cells and a
 * single "data marker" row whose cells hold {{no}}/{{detail}}/{{area}}/{{time}}/
 * {{periodLabel}}. At generate time we load the project's saved template, swap the
 * header tokens for the real values, and expand that one marker row into as many
 * rows as the day has entries (styles preserved), then hand back the filled .xlsx
 * bytes. When a project has NO uploaded template, this module is simply not used —
 * the existing PDF flow (dailyRequestPdf.ts) stays untouched. Additive + reversible.
 *
 * Storage layout (LMS Firebase Storage + Firestore, Admin SDK — works against the
 * local emulators in dev and real LMS infra in prod, same as dailyRequestStore.ts):
 *   - the template bytes -> Storage   document-templates/{projectId}/dailyRequest.xlsx  (overwrite-latest)
 *   - a small pointer    -> Firestore collection `documentTemplates`, one row per project+kind
 *
 * Unlike the Daily Request PDF store (which versions every generate), the TEMPLATE
 * is overwrite-latest: a project has exactly one current Daily Request form, and
 * re-uploading replaces it. Version history for the templates themselves is out of
 * scope for phase 1.
 */

import { Timestamp } from 'firebase-admin/firestore';
import * as ExcelJS from 'exceljs';
import { db, storage } from '../../config/firebase';
import type { DailyRequestDoc, DailyRequestRow } from './dailyRequestPdf';

const COLLECTION = 'documentTemplates';
const STORAGE_PREFIX = 'document-templates';
/** phase 1 pilots exactly one document kind. */
const KIND = 'dailyRequest';

/** Firestore doc id: one row per project + document kind. */
function docId(projectId: string): string {
  return `${projectId}__${KIND}`;
}

/** Storage object key — overwrite-latest, so no version segment. */
function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}/${projectId}/${KIND}.xlsx`;
}

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The pointer shape saved in Firestore + returned to the caller. */
export interface DailyRequestTemplateMeta {
  projectId: string;
  kind: string;
  storageKey: string;
  fileName: string;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: Timestamp;
}

// ---- store -----------------------------------------------------------------

/**
 * Save (overwrite) a project's Daily Request template. Writes the bytes to Storage
 * and upserts the Firestore pointer. Returns the stored meta.
 */
export async function uploadDailyRequestTemplate(
  buffer: Buffer,
  projectId: string,
  uploadedBy: string,
  uploadedByName?: string | null,
  originalFileName?: string
): Promise<DailyRequestTemplateMeta> {
  const key = storageKey(projectId);
  const file = storage.bucket().file(key);
  await file.save(buffer, {
    resumable: false, // small one-shot upload — plays nicer with the emulator
    contentType: XLSX_CONTENT_TYPE,
    metadata: { contentType: XLSX_CONTENT_TYPE },
  });

  const now = Timestamp.now();
  const meta: DailyRequestTemplateMeta = {
    projectId,
    kind: KIND,
    storageKey: key,
    fileName: originalFileName || `${KIND}.xlsx`,
    uploadedBy,
    uploadedByName: uploadedByName ?? null,
    uploadedAt: now,
  };
  await db.collection(COLLECTION).doc(docId(projectId)).set(meta);
  return meta;
}

/** Read a project's template pointer, or null when none is uploaded yet. */
export async function getDailyRequestTemplateMeta(
  projectId: string
): Promise<DailyRequestTemplateMeta | null> {
  const snap = await db.collection(COLLECTION).doc(docId(projectId)).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return {
    projectId: d.projectId ?? projectId,
    kind: d.kind ?? KIND,
    storageKey: d.storageKey ?? storageKey(projectId),
    fileName: d.fileName ?? `${KIND}.xlsx`,
    uploadedBy: d.uploadedBy ?? '',
    uploadedByName: d.uploadedByName ?? null,
    uploadedAt: d.uploadedAt,
  };
}

/**
 * Fetch the raw template .xlsx bytes for a project, or null when none exists (the
 * caller then rejects the generate — a template must be uploaded first).
 */
export async function getDailyRequestTemplateBuffer(
  projectId: string
): Promise<Buffer | null> {
  const meta = await getDailyRequestTemplateMeta(projectId);
  if (!meta) return null;
  const file = storage.bucket().file(meta.storageKey);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  return buffer;
}

// ---- fill engine -----------------------------------------------------------

/**
 * Coerce any cell value (string, number, boolean, rich-text object, formula
 * result, null) to a plain string so token replacement never throws on a
 * non-string cell.
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Rich text: { richText: [{ text }, ...] }
  if (typeof value === 'object' && 'richText' in value && Array.isArray((value as ExcelJS.CellRichTextValue).richText)) {
    return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  }
  // Formula/hyperlink/shared: prefer a nested .result / .text when present.
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.result === 'string' || typeof obj.result === 'number') return String(obj.result);
  }
  return String(value);
}

/** Replace every {{token}} in `text` using `map` (unknown tokens → empty string). */
function substitute(text: string, map: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, name: string) =>
    Object.prototype.hasOwnProperty.call(map, name) ? map[name] : ''
  );
}

/** True when the coerced cell text carries at least one {{token}}. */
function hasToken(value: ExcelJS.CellValue): boolean {
  return /\{\{\s*[\w]+\s*\}\}/.test(cellToString(value));
}

/** Apply the token map to one cell in place (only when it holds a token). */
function fillCell(cell: ExcelJS.Cell, map: Record<string, string>): void {
  if (!hasToken(cell.value)) return;
  cell.value = substitute(cellToString(cell.value), map);
}

function fmtThaiDate(isoDate: string): string {
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

/**
 * Fill a project's Daily Request template with real data and return the filled
 * .xlsx bytes.
 *
 * Steps:
 *  1. load the uploaded template workbook from `templateBuffer`
 *  2. replace header {{tokens}} — {{projectId}} {{projectName}} {{date}} {{dateThai}} —
 *     across ALL cells of the first worksheet
 *  3. locate the single "data marker" row: the row containing a {{detail}} cell
 *  4. duplicateRow(markerRow, rows.length, true) → rows.length styled copies below it
 *  5. per copied row, substitute {{no}}/{{detail}}/{{area}}/{{time}}/{{periodLabel}}
 *  6. remove the original marker row
 *  7. return workbook.xlsx.writeBuffer()
 *
 * May throw (bad/locked template, no worksheet) — the caller decides whether to
 * fall back or surface the error.
 */
export async function fillDailyRequestTemplate(
  templateBuffer: Buffer,
  doc: DailyRequestDoc
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as unknown as ArrayBuffer);
  const ws = workbook.worksheets[0];
  if (!ws) throw new Error('template has no worksheet');

  const headerMap: Record<string, string> = {
    projectId: doc.projectId,
    // buildDailyRequestDoc does not currently populate projectName — fall back to
    // the id so a {{projectName}} placeholder never renders blank.
    projectName: doc.projectName || doc.projectId,
    date: doc.date,
    dateThai: fmtThaiDate(doc.date),
  };

  // 3. find the marker row (first row that contains a {{detail}} cell).
  let markerRowNumber = -1;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (markerRowNumber !== -1) return;
    let found = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!found && /\{\{\s*detail\s*\}\}/.test(cellToString(cell.value))) found = true;
    });
    if (found) markerRowNumber = rowNumber;
  });

  // 2. header tokens — every non-marker row gets the header map applied. The
  //    marker row is handled by the per-data-row pass below, so skip it here.
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === markerRowNumber) return;
    row.eachCell({ includeEmpty: false }, (cell) => fillCell(cell, headerMap));
  });

  if (markerRowNumber !== -1) {
    const rows: DailyRequestRow[] = Array.isArray(doc.rows) ? doc.rows : [];
    if (rows.length > 0) {
      // 4. insert rows.length styled copies directly below the marker.
      ws.duplicateRow(markerRowNumber, rows.length, true);
      // The copies occupy markerRowNumber+1 .. markerRowNumber+rows.length.
      rows.forEach((r, i) => {
        const target = ws.getRow(markerRowNumber + 1 + i);
        const rowMap: Record<string, string> = {
          ...headerMap,
          no: String(i + 1),
          detail: r.detail ?? '',
          area: r.area ?? '',
          time: r.time || '-',
          periodLabel: r.periodLabel ?? '',
        };
        target.eachCell({ includeEmpty: false }, (cell) => fillCell(cell, rowMap));
      });
    }
    // 6. remove the original marker row (whether or not any data rows were added,
    //    so a zero-row day leaves a clean sheet with the placeholders gone).
    ws.spliceRows(markerRowNumber, 1);
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

/**
 * Build a minimal sample .xlsx that demonstrates the placeholder convention, so an
 * admin can download it, adapt it to their project's letterhead, and re-upload.
 * Deliberately uses NO merged cells in the data-row region — merges break
 * duplicateRow's row expansion.
 */
export async function buildSampleDailyRequestTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('ใบแจ้งงานประจำวัน');

  ws.columns = [
    { width: 8 },  // ลำดับ
    { width: 48 }, // รายละเอียดงาน
    { width: 18 }, // พื้นที่
    { width: 18 }, // เวลา
    { width: 16 }, // ช่วงเวลา
  ];

  // Title + meta header (these MAY use merges — only the data region must not).
  const title = ws.addRow(['ใบแจ้งงานประจำวัน — โครงการ {{projectName}}']);
  title.font = { bold: true, size: 16 };
  ws.mergeCells(title.number, 1, title.number, 5);

  const meta = ws.addRow(['รหัสโครงการ: {{projectId}}    วันที่: {{dateThai}}  ({{date}})']);
  ws.mergeCells(meta.number, 1, meta.number, 5);

  ws.addRow([]); // spacer

  const head = ws.addRow(['ลำดับ', 'รายละเอียดงาน', 'พื้นที่', 'เวลา', 'ช่วงเวลา']);
  head.font = { bold: true };
  head.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  });

  // The single data-marker row — NO merges here. The fill engine finds it by its
  // {{detail}} cell and expands it into one row per entry.
  const marker = ws.addRow(['{{no}}', '{{detail}}', '{{area}}', '{{time}}', '{{periodLabel}}']);
  marker.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  });

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

// ---- preview ---------------------------------------------------------------

/** Max rows/cols returned in a preview so an odd template can't flood the API. */
const PREVIEW_MAX_ROWS = 60;
const PREVIEW_MAX_COLS = 20;

export interface DailyRequestTemplatePreview {
  sheetName: string;
  rows: string[][];
}

/**
 * Read a project's stored Daily Request template and return its first sheet as
 * a plain string grid ({{tokens}} shown verbatim) for an in-browser HTML-table
 * preview. No template → null. Cells are coerced via cellToString so an odd
 * cell (number, rich-text, formula, date) never throws; size is capped.
 */
export async function getDailyRequestTemplatePreview(
  projectId: string
): Promise<DailyRequestTemplatePreview | null> {
  const buffer = await getDailyRequestTemplateBuffer(projectId);
  if (!buffer) return null;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = workbook.worksheets[0];
  if (!ws) return { sheetName: '', rows: [] };

  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > PREVIEW_MAX_ROWS) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > PREVIEW_MAX_COLS) return;
      cells[colNumber - 1] = cellToString(cell.value);
    });
    // Fill any gaps left by sparse cells so the grid is rectangular-ish.
    for (let i = 0; i < cells.length; i += 1) {
      if (cells[i] === undefined) cells[i] = '';
    }
    rows.push(cells);
  });

  return { sheetName: ws.name, rows };
}
