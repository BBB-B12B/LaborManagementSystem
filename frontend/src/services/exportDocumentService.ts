/**
 * Export Document Service (T-058)
 * บริการออกเอกสารรายงานประจำวัน (PDF)
 *
 * Talks to the self-contained LMS backend PDF engine:
 *   GET  /api/tasks/daily-report-doc  -> the day's grouped work + photos (for the select UI)
 *   POST /api/tasks/daily-report-pdf  -> a rendered PDF (binary) for the chosen date + photos
 *
 * NOTE: the PDF endpoint returns raw binary, NOT the usual {success,data} envelope,
 * so it uses the raw axios `apiClient` with responseType:'blob' — the `api.post`
 * wrapper would try to unwrap JSON and corrupt the bytes.
 */

import apiClient, { api } from './api/client';

export interface ExportPhoto {
  id: string;
  url: string;
  caption: string; // task name + progress
}

export interface ExportEntry {
  categoryId?: string | null;
  categoryName: string;
  taskName: string;
  todayProgress: number; // %วันนี้
  cumulativeProgress: number; // %สะสม
  note?: string;
  status?: string | null;
  photos: ExportPhoto[];
}

export interface ExportGroup {
  categoryId?: string | null;
  categoryName: string;
  entries: ExportEntry[];
}

export interface ExportDailyReportDoc {
  projectId: string;
  date: string; // YYYY-MM-DD
  groups: ExportGroup[];
}

// ---- Daily Request (T-062) — a flat table, no photos --------------------------
export interface DailyRequestRow {
  detail: string; // รายละเอียดงาน — task > subtask name
  area?: string; // พื้นที่ — blank for now
  date: string; // วัน เดือน ปี — YYYY-MM-DD
  time: string; // เวลา — a single period's range, e.g. "07:00 - 08:00"
  period?: string; // time-period key: otMorning | day | otNoon | otEvening | none (T-063)
  periodLabel?: string; // section header text: "OT เช้า" | "งานปกติ" | "OT เที่ยง" | "OT เย็น"
  periodOrder?: number; // display order within the doc (0..3, 99 = fallback)
}

export interface ExportDailyRequestDoc {
  projectId: string;
  date: string; // YYYY-MM-DD
  rows: DailyRequestRow[];
}

/**
 * A previously-saved Daily Report (T-060). Returned by GET /daily-report-saved;
 * null when the date has never been generated + saved.
 */
export interface SavedDailyReport {
  projectId: string;
  date: string; // YYYY-MM-DD
  selectedPhotoIds: string[];
  pdfPath: string;
  createdBy: string;
  createdByName: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  hasFile: boolean; // true when a stored PDF is available to download
}

/**
 * A previously-saved Daily Request (T-064). Returned by GET /daily-request-saved;
 * null when the date has never been generated + saved. Unlike the Daily Report,
 * every generate keeps a NEW version — versionCount is how many exist.
 */
export interface SavedDailyRequest {
  projectId: string;
  date: string; // YYYY-MM-DD
  latestPath: string;
  versionCount: number;
  createdBy: string;
  createdByName: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  hasFile: boolean; // true when a stored PDF is available to download
}

export const exportDocumentService = {
  /**
   * Fetch the grouped daily-report document for a project + past date.
   * projectId = the project code (e.g. "P002") — the same value ProjectSelect emits.
   */
  getDailyReportDoc: (projectId: string, date: string): Promise<ExportDailyReportDoc> =>
    api.get<ExportDailyReportDoc>('/tasks/daily-report-doc', { projectId, date }),

  /**
   * Fetch the Daily Request document (flat rows) for a project + past date.
   */
  getDailyRequestDoc: (projectId: string, date: string): Promise<ExportDailyRequestDoc> =>
    api.get<ExportDailyRequestDoc>('/tasks/daily-request-doc', { projectId, date }),

  /**
   * Render the Daily Request PDF (table only, no photos). Returns a Blob.
   * Uses the raw apiClient with responseType:'blob' (same reason as generatePdf).
   */
  generateRequestPdf: async (projectId: string, date: string): Promise<Blob> => {
    const response = await apiClient.post(
      '/tasks/daily-request-pdf',
      { projectId, date },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },

  /**
   * Fetch the saved Daily Request record for a project+date, or null when nothing
   * is saved. Drives the "ดาวน์โหลดไฟล์เดิม" button (shown when hasFile).
   */
  getSavedRequest: (projectId: string, date: string): Promise<SavedDailyRequest | null> =>
    api.get<SavedDailyRequest | null>('/tasks/daily-request-saved', { projectId, date }),

  /**
   * Download the exact stored Daily Request PDF (latest version) — no regeneration.
   * Uses the raw apiClient with responseType:'blob' (same reason as generateRequestPdf).
   */
  downloadOriginalRequest: async (projectId: string, date: string): Promise<Blob> => {
    const response = await apiClient.get('/tasks/daily-request-file', {
      params: { projectId, date },
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  /**
   * Render the Daily Report PDF. Returns a Blob the caller can download.
   * selectedPhotoIds: undefined = all photos; [] = table only (no photo pages).
   */
  generatePdf: async (
    projectId: string,
    date: string,
    selectedPhotoIds?: string[]
  ): Promise<Blob> => {
    const response = await apiClient.post(
      '/tasks/daily-report-pdf',
      { projectId, date, selectedPhotoIds },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },

  /**
   * Fetch the saved record for a project+date, or null when nothing is saved.
   * Used to preselect the previously-chosen photos + decide whether to show the
   * "ดาวน์โหลดไฟล์เดิม" button.
   */
  getSaved: (projectId: string, date: string): Promise<SavedDailyReport | null> =>
    api.get<SavedDailyReport | null>('/tasks/daily-report-saved', { projectId, date }),

  /**
   * Download the exact stored PDF for a saved date — no regeneration.
   * Uses the raw apiClient with responseType:'blob' (same reason as generatePdf).
   */
  downloadOriginal: async (projectId: string, date: string): Promise<Blob> => {
    const response = await apiClient.get('/tasks/daily-report-file', {
      params: { projectId, date },
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};

export default exportDocumentService;
