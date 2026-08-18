/**
 * Per-project document-header config store for the Daily Request PDF (T-069).
 *
 * The Daily Request letterhead carries values that are constant *within* a project
 * but differ *across* projects (Tier 2): the project logo, the contractor name
 * ("ผู้รับจ้าง"), and the document-number prefix ("เลขที่ …/……"). Those live here,
 * one Firestore doc per project (doc id = projectId), decoupled from the Project
 * record itself. projectName is NOT stored here — it is read from the Project doc
 * at render time (single source of truth).
 *
 * Storage layout (LMS Firebase Storage + Firestore, Admin SDK — emulator in dev,
 * real infra in prod, same as dailyRequestTemplate.ts):
 *   - the logo bytes -> Storage   project-assets/{projectId}/logo.<ext>   (overwrite-latest, added in S2)
 *   - the config row -> Firestore collection `documentHeaderConfigs`, doc id = projectId
 *
 * Everything is additive + reversible: an empty config makes the PDF header degrade
 * gracefully (no logo, projectName from the Project doc, no contractor line, blank เลขที่).
 */

import { Timestamp } from 'firebase-admin/firestore';
import { db, storage } from '../../config/firebase';

const COLLECTION = 'documentHeaderConfigs';
const STORAGE_PREFIX = 'project-assets';

export interface DailyRequestHeaderConfig {
  projectId: string;
  logoUrl?: string | null;
  logoPath?: string | null;
  contractorName?: string | null;
  showContractor: boolean;
  docNumberPrefix?: string | null; // Daily REQUEST doc-number prefix
  docNumberPrefixReport?: string | null; // Daily REPORT doc-number prefix (distinct from request)
  updatedAt?: Timestamp;
  updatedBy?: string | null;
}

/** The mutable slice a caller may write — id + audit fields are set server-side. */
export type HeaderConfigPatch = Partial<
  Omit<DailyRequestHeaderConfig, 'projectId' | 'updatedAt' | 'updatedBy'>
>;

/** A blank config so a project with no saved header still renders. */
function emptyConfig(projectId: string): DailyRequestHeaderConfig {
  return {
    projectId,
    logoUrl: null,
    logoPath: null,
    contractorName: null,
    showContractor: false,
    docNumberPrefix: null,
    docNumberPrefixReport: null,
  };
}

/** Read a project's header config, or a blank default when none is saved yet. */
export async function getHeaderConfig(
  projectId: string
): Promise<DailyRequestHeaderConfig> {
  const snap = await db.collection(COLLECTION).doc(projectId).get();
  if (!snap.exists) return emptyConfig(projectId);
  const d = snap.data() || {};
  return {
    projectId,
    logoUrl: d.logoUrl ?? null,
    logoPath: d.logoPath ?? null,
    contractorName: d.contractorName ?? null,
    showContractor: d.showContractor ?? false,
    docNumberPrefix: d.docNumberPrefix ?? null,
    docNumberPrefixReport: d.docNumberPrefixReport ?? null,
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy ?? null,
  };
}

/**
 * Merge-upsert a project's header config. Only the caller-supplied fields are
 * written (merge:true), so a logo upload (S2) and a text edit don't clobber each
 * other. Returns the freshly-read config.
 */
export async function saveHeaderConfig(
  projectId: string,
  cfg: HeaderConfigPatch,
  uid: string
): Promise<DailyRequestHeaderConfig> {
  const patch: Record<string, unknown> = {
    projectId,
    updatedAt: Timestamp.now(),
    updatedBy: uid || null,
  };
  if (cfg.logoUrl !== undefined) patch.logoUrl = cfg.logoUrl;
  if (cfg.logoPath !== undefined) patch.logoPath = cfg.logoPath;
  if (cfg.contractorName !== undefined) patch.contractorName = cfg.contractorName;
  if (cfg.showContractor !== undefined) patch.showContractor = cfg.showContractor;
  if (cfg.docNumberPrefix !== undefined) patch.docNumberPrefix = cfg.docNumberPrefix;
  if (cfg.docNumberPrefixReport !== undefined)
    patch.docNumberPrefixReport = cfg.docNumberPrefixReport;
  await db.collection(COLLECTION).doc(projectId).set(patch, { merge: true });
  return getHeaderConfig(projectId);
}

/**
 * Download the stored logo bytes for a project as a base64 data URI, or null when
 * no logo is set / the object is missing. Called ONLY on the PDF-render paths (not
 * the preview GET) so a preview never pays for a Storage download. The PDF embeds
 * the logo as a data URI rather than a network <img src> for render reliability
 * (Puppeteer has no outbound network guarantee against Storage).
 */
export async function getLogoDataUri(
  logoPath: string | null | undefined
): Promise<string | null> {
  if (!logoPath) return null;
  try {
    const file = storage.bucket().file(logoPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [meta] = await file.getMetadata();
    const contentType = meta.contentType || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    // A logo hiccup must never break PDF generation — degrade to no-logo.
    return null;
  }
}

/** Map an image content-type to a file extension (default png). */
function extForContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return map[(contentType || '').toLowerCase()] || 'png';
}

/**
 * Upload a project logo to Storage (overwrite-latest) and persist its
 * {logoUrl, logoPath} onto the header config. Returns the updated config.
 *
 * logoPath is the source of truth the PDF render reads (base64-embedded via
 * getLogoDataUri); logoUrl is a best-effort public URL for the settings-tab
 * preview only — a makePublic hiccup (e.g. the emulator) must not fail the upload.
 */
export async function uploadLogo(
  projectId: string,
  buffer: Buffer,
  contentType: string,
  uid: string
): Promise<DailyRequestHeaderConfig> {
  const ext = extForContentType(contentType);
  const logoPath = `${STORAGE_PREFIX}/${projectId}/logo.${ext}`;
  const file = storage.bucket().file(logoPath);
  const ct = contentType || 'image/png';
  await file.save(buffer, {
    resumable: false, // small one-shot upload — plays nicer with the emulator
    contentType: ct,
    metadata: { contentType: ct },
  });

  let logoUrl: string;
  try {
    await file.makePublic();
    logoUrl = file.publicUrl();
  } catch {
    // makePublic can fail on the emulator — fall back to the conventional public
    // URL string. The PDF never depends on this (it reads logoPath), so a
    // non-resolving preview URL in dev is harmless.
    logoUrl = file.publicUrl();
  }

  return saveHeaderConfig(projectId, { logoUrl, logoPath }, uid);
}

export { COLLECTION as HEADER_CONFIG_COLLECTION, STORAGE_PREFIX as LOGO_STORAGE_PREFIX };
