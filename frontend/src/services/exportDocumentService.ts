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

export const exportDocumentService = {
  /**
   * Fetch the grouped daily-report document for a project + past date.
   * projectId = the project code (e.g. "P002") — the same value ProjectSelect emits.
   */
  getDailyReportDoc: (projectId: string, date: string): Promise<ExportDailyReportDoc> =>
    api.get<ExportDailyReportDoc>('/tasks/daily-report-doc', { projectId, date }),

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
