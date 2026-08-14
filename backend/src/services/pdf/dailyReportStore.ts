/**
 * Daily Report persistence store (T-060)
 * บันทึก/ดึงเอกสารรายงานประจำวันที่สร้างแล้ว
 *
 * Persists a generated Daily Report PDF so it survives past the download:
 *   - the file bytes  -> LMS Firebase Storage  (daily-reports/{projectId}/{date}.pdf)
 *   - a small record  -> LMS Firestore         (collection `dailyReportDocs`)
 *
 * The record remembers which photos the user picked (selectedPhotoIds) so
 * reopening the same project+date can pre-check them, and lets the app hand
 * back the exact saved file WITHOUT regenerating it. One record per
 * project+date — overwrite-latest (createdAt is preserved, updatedAt bumped).
 *
 * Everything here uses the Admin SDK (db + storage from config/firebase), so it
 * works against the local emulators in dev and real LMS Storage in prod alike.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { db, storage } from '../../config/firebase';

const COLLECTION = 'dailyReportDocs';
const STORAGE_PREFIX = 'daily-reports';

/** Firestore doc id: one row per project+date. */
function docId(projectId: string, date: string): string {
  return `${projectId}__${date}`;
}

/** Storage object key: overwriting the same key IS the overwrite-latest for the file. */
function storageKey(projectId: string, date: string): string {
  return `${STORAGE_PREFIX}/${projectId}/${date}.pdf`;
}

/** The shape saved in Firestore + returned to the caller. */
export interface SavedDailyReport {
  projectId: string;
  date: string;
  selectedPhotoIds: string[];
  pdfPath: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** derived — true when a stored file is expected to exist */
  hasFile: boolean;
}

export interface DailyReportRecordInput {
  projectId: string;
  date: string;
  selectedPhotoIds: string[];
  pdfPath: string;
  createdBy: string;
  createdByName?: string | null;
}

/**
 * Upload the rendered PDF to LMS Storage (overwriting any previous file for the
 * same project+date). Returns the storage key (stored as pdfPath on the record).
 */
export async function uploadDailyReportPdf(
  buffer: Buffer,
  projectId: string,
  date: string
): Promise<string> {
  const key = storageKey(projectId, date);
  const file = storage.bucket().file(key);
  await file.save(buffer, {
    resumable: false, // small one-shot upload — plays nicer with the emulator
    contentType: 'application/pdf',
    metadata: { contentType: 'application/pdf' },
  });
  return key;
}

/**
 * Upsert the Firestore record for this project+date. Overwrite-latest:
 * the whole doc is replaced, but the original createdAt is carried over.
 */
export async function upsertDailyReportRecord(input: DailyReportRecordInput): Promise<void> {
  const ref = db.collection(COLLECTION).doc(docId(input.projectId, input.date));
  const snap = await ref.get();
  const now = Timestamp.now();
  const createdAt = (snap.exists && (snap.data()?.createdAt as Timestamp)) || now;

  await ref.set({
    projectId: input.projectId,
    date: input.date,
    selectedPhotoIds: input.selectedPhotoIds ?? [],
    pdfPath: input.pdfPath,
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    createdAt,
    updatedAt: now,
  });
}

/** Read the saved record for a project+date, or null when none exists yet. */
export async function getSavedDailyReport(
  projectId: string,
  date: string
): Promise<SavedDailyReport | null> {
  const snap = await db.collection(COLLECTION).doc(docId(projectId, date)).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return {
    projectId: d.projectId ?? projectId,
    date: d.date ?? date,
    selectedPhotoIds: Array.isArray(d.selectedPhotoIds) ? d.selectedPhotoIds : [],
    pdfPath: d.pdfPath ?? '',
    createdBy: d.createdBy ?? '',
    createdByName: d.createdByName ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    hasFile: Boolean(d.pdfPath),
  };
}

/**
 * Fetch the stored PDF bytes for "download original". Returns null when no file
 * is stored (caller falls back to regenerating). Uses the record's pdfPath when
 * present, else the deterministic key.
 */
export async function getStoredPdf(
  projectId: string,
  date: string
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const rec = await getSavedDailyReport(projectId, date);
  const key = rec?.pdfPath || storageKey(projectId, date);
  const file = storage.bucket().file(key);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  return { buffer, fileName: `daily-report_${projectId}_${date}.pdf` };
}
