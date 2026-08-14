/**
 * Daily Request persistence store (T-064)
 * บันทึก/ดึงเอกสารใบแจ้งงานประจำวันที่สร้างแล้ว
 *
 * Sibling of dailyReportStore.ts (T-060) — same Admin-SDK Storage+Firestore
 * approach, but with ONE deliberate difference: **auto-versioning**. Where the
 * Daily Report overwrites a single file per project+date, the Daily Request
 * NEVER overwrites — every generate writes a NEW versioned object and appends a
 * version entry to the record. This preserves document integrity: once a request
 * PDF is printed/sent, that exact file survives forever even if the source data
 * (After-Sale `requests`, which IS editable retroactively) later changes.
 *
 *   - the file bytes  -> LMS Firebase Storage  (daily-requests/{projectId}/{date}/{versionId}.pdf)
 *   - a small record  -> LMS Firestore         (collection `dailyRequestDocs`, one row per project+date)
 *
 * "ดาวน์โหลดไฟล์เดิม" hands back the LATEST saved version without regenerating.
 * A specific older version can be fetched by versionId (history UI deferred).
 *
 * Everything uses the Admin SDK (db + storage from config/firebase) so it works
 * against the local emulators in dev and real LMS Storage in prod alike.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { db, storage } from '../../config/firebase';

const COLLECTION = 'dailyRequestDocs';
const STORAGE_PREFIX = 'daily-requests';

/** Firestore doc id: one row per project+date (holds ALL versions for that day). */
function docId(projectId: string, date: string): string {
  return `${projectId}__${date}`;
}

/**
 * A collision-proof per-version id. `Date.now()` alone is not enough — a double
 * click within the same millisecond would reuse the key and silently overwrite
 * the earlier version (the exact data-loss this store exists to prevent), so a
 * short random suffix guarantees a distinct object per generate.
 */
function newVersionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Storage object key for one version — the {versionId} segment makes it unique. */
function storageKey(projectId: string, date: string, versionId: string): string {
  return `${STORAGE_PREFIX}/${projectId}/${date}/${versionId}.pdf`;
}

/** One saved version inside the record's versions[] history. */
export interface DailyRequestVersion {
  pdfPath: string;
  versionId: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: Timestamp;
}

/** The shape saved in Firestore + returned to the caller. */
export interface SavedDailyRequest {
  projectId: string;
  date: string;
  latestPath: string;
  versionCount: number;
  versions: DailyRequestVersion[];
  createdBy: string;
  createdByName: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** derived — true when at least one stored version exists */
  hasFile: boolean;
}

export interface DailyRequestVersionInput {
  projectId: string;
  date: string;
  pdfPath: string;
  versionId: string;
  createdBy: string;
  createdByName?: string | null;
}

/**
 * Upload a freshly rendered PDF as a NEW version (never overwrites a previous
 * one). Returns the storage key + the version id, which the caller then records
 * via appendDailyRequestVersion.
 */
export async function uploadDailyRequestPdf(
  buffer: Buffer,
  projectId: string,
  date: string
): Promise<{ pdfPath: string; versionId: string }> {
  const versionId = newVersionId();
  const key = storageKey(projectId, date, versionId);
  const file = storage.bucket().file(key);
  await file.save(buffer, {
    resumable: false, // small one-shot upload — plays nicer with the emulator
    contentType: 'application/pdf',
    metadata: { contentType: 'application/pdf' },
  });
  return { pdfPath: key, versionId };
}

/**
 * Append this version to the project+date record. The record is upsert-merged:
 * versions[] grows (never shrinks), latestPath points at the newest file, the
 * original createdBy/createdAt (first-ever generate) are preserved, updatedAt is
 * bumped. versionCount is kept in sync for the UI.
 */
export async function appendDailyRequestVersion(input: DailyRequestVersionInput): Promise<void> {
  const ref = db.collection(COLLECTION).doc(docId(input.projectId, input.date));
  const snap = await ref.get();
  const now = Timestamp.now();
  const existing = (snap.exists && snap.data()) || {};

  const priorVersions: DailyRequestVersion[] = Array.isArray(existing.versions)
    ? existing.versions
    : [];
  const version: DailyRequestVersion = {
    pdfPath: input.pdfPath,
    versionId: input.versionId,
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    createdAt: now,
  };
  const versions = [...priorVersions, version];

  await ref.set({
    projectId: input.projectId,
    date: input.date,
    latestPath: input.pdfPath,
    versionCount: versions.length,
    versions,
    // Preserve the first-ever creator + timestamp; each version keeps its own.
    createdBy: (existing.createdBy as string) || input.createdBy,
    createdByName:
      (existing.createdByName as string | null | undefined) ?? input.createdByName ?? null,
    createdAt: (existing.createdAt as Timestamp) || now,
    updatedAt: now,
  });
}

/** Read the saved record for a project+date, or null when none exists yet. */
export async function getSavedDailyRequest(
  projectId: string,
  date: string
): Promise<SavedDailyRequest | null> {
  const snap = await db.collection(COLLECTION).doc(docId(projectId, date)).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  const versions: DailyRequestVersion[] = Array.isArray(d.versions) ? d.versions : [];
  return {
    projectId: d.projectId ?? projectId,
    date: d.date ?? date,
    latestPath: d.latestPath ?? '',
    versionCount: typeof d.versionCount === 'number' ? d.versionCount : versions.length,
    versions,
    createdBy: d.createdBy ?? '',
    createdByName: d.createdByName ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    hasFile: Boolean(d.latestPath),
  };
}

/**
 * Fetch stored PDF bytes for "download original". Defaults to the LATEST version;
 * pass versionId to fetch a specific historical version. Returns null when no
 * matching stored file exists (caller falls back to regenerating).
 */
export async function getStoredDailyRequestPdf(
  projectId: string,
  date: string,
  versionId?: string
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const rec = await getSavedDailyRequest(projectId, date);
  if (!rec) return null;

  let key = rec.latestPath;
  if (versionId) {
    const match = rec.versions.find((v) => v.versionId === versionId);
    key = match?.pdfPath || '';
  }
  if (!key) return null;

  const file = storage.bucket().file(key);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  return { buffer, fileName: `daily-request_${projectId}_${date}.pdf` };
}
