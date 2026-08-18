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

/**
 * A project's uploaded Daily Request Excel template (T-065). Returned by
 * GET /daily-request-template; null when the project has never uploaded one.
 * uploadedAt is a serialized Firestore Timestamp — kept as unknown (same as the
 * saved-record timestamps above); the UI only needs fileName + who/when.
 */
export interface DailyRequestTemplateMeta {
  projectId: string;
  kind: string;
  storageKey: string;
  fileName: string;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt?: unknown;
}

/** First-sheet grid of an uploaded template, for an in-browser HTML-table preview. */
export interface DailyRequestTemplatePreview {
  sheetName: string;
  rows: string[][];
}

/** Per-project Daily Request letterhead config (T-069) — edited in "ตั้งค่าเอกสาร". */
export interface DailyRequestHeaderConfig {
  projectId: string;
  logoUrl?: string | null;
  logoPath?: string | null;
  contractorName?: string | null;
  showContractor: boolean;
  docNumberPrefix?: string | null; // Daily Request doc-number prefix
  docNumberPrefixReport?: string | null; // Daily Report doc-number prefix (distinct)
  updatedAt?: unknown;
  updatedBy?: string | null;
}

/** The editable text/toggle slice the settings form sends on save. */
export type DailyRequestHeaderConfigPatch = {
  contractorName?: string | null;
  showContractor?: boolean;
  docNumberPrefix?: string | null;
  docNumberPrefixReport?: string | null;
};

// ---- Inspection topic config (T-076) ---------------------------------------
// Ported from the qc-report-new inspection-report app's 3-level topic tree
// (หมวดหลัก → หมวดย่อย → หัวข้อการตรวจ), stored one config document per project.
// Same shape as the backend's InspectionTopicConfig
// (backend/src/services/inspection/inspectionTopicConfig.ts) — kept identical
// here so the settings UI can pass values straight through.

/**
 * A single dynamic field, attached to a SUB-CATEGORY only — asked once when a
 * sub-category is picked (a form header's blanks, e.g. 'เสาเบอร์'), not per topic.
 * The source app's dead `Topic.dynamicFields` is intentionally not ported; see the
 * backend service's comment for the evidence.
 */
export interface InspectionFieldConfig {
  label: string;
  type?: 'text' | 'dropdown';
  options?: string[];
}

/** หัวข้อการตรวจ — the leaf inspection topic (a checklist row; no fields of its own). */
export interface InspectionTopic {
  id: string;
  name: string;
}

/** หมวดย่อย — a sub-category: holds the shared fields plus one or more topics. */
export interface InspectionSubCategory {
  id: string;
  name: string;
  fields: InspectionFieldConfig[];
  topics: InspectionTopic[];
}

/** หมวดหลัก — the top-level category holding one or more sub-categories. */
export interface InspectionMainCategory {
  id: string;
  name: string;
  subCategories: InspectionSubCategory[];
}

/** The full per-project inspection-topic config. */
export interface InspectionTopicConfig {
  projectId: string;
  mainCategories: InspectionMainCategory[];
  updatedAt?: string; // ISO
  updatedBy?: string | null;
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

  // ---- Daily Request Excel template (T-065) ----------------------------------

  /**
   * Fetch the project's uploaded Daily Request template metadata, or null when
   * none has been uploaded. Drives the admin panel status + the "ออกด้วย
   * Template (Excel)" button (shown only when a template exists).
   */
  getRequestTemplate: (projectId: string): Promise<DailyRequestTemplateMeta | null> =>
    api.get<DailyRequestTemplateMeta | null>('/tasks/daily-request-template', { projectId }),

  /**
   * Upload (overwrite) the project's Daily Request .xlsx template. Admin only —
   * the backend guards this with checkRole(['MD']) (GOD auto-passes). Returns
   * the stored meta.
   */
  uploadRequestTemplate: (projectId: string, file: File): Promise<DailyRequestTemplateMeta> => {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);
    return api.upload<DailyRequestTemplateMeta>('/tasks/daily-request-template', formData);
  },

  /**
   * Fetch the uploaded template's first sheet as a string grid ({{tokens}} shown
   * verbatim) for an in-browser HTML-table preview, or null when no template.
   * Managers only — the backend guards it with checkRole(['MD','AM','LD']).
   */
  getRequestTemplatePreview: (
    projectId: string
  ): Promise<DailyRequestTemplatePreview | null> =>
    api.get<DailyRequestTemplatePreview | null>('/tasks/daily-request-template/preview', {
      projectId,
    }),

  /**
   * Fill the project's uploaded template with the day's request rows and return
   * the filled .xlsx as a Blob. Raw apiClient + responseType:'blob' (same reason
   * as generateRequestPdf). 400 when the project has no template uploaded yet.
   */
  generateRequestXlsx: async (projectId: string, date: string): Promise<Blob> => {
    const response = await apiClient.post(
      '/tasks/daily-request-xlsx',
      { projectId, date },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },

  /**
   * Download the sample template (demonstrates the {{token}} + data-marker-row
   * convention). The route is behind authenticate, so we must fetch it as a blob
   * with the auth header — a bare <a href> would 401. Returns a Blob.
   */
  downloadSampleTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/tasks/daily-request-template/sample', {
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

  // ---- Daily Request header config (T-069) -----------------------------------

  /**
   * Fetch a project's Daily Request letterhead config. The backend always returns
   * a config (blank defaults when none is saved), so the settings form can render
   * without a "not found" branch. Managers only (checkRole MD/AM/LD).
   */
  getHeaderConfig: (projectId: string): Promise<DailyRequestHeaderConfig> =>
    api.get<DailyRequestHeaderConfig>('/tasks/daily-request-header-config', { projectId }),

  /**
   * Save the text/toggle fields of a project's header config (merge-upsert). The
   * logo is uploaded separately via uploadLogo. Returns the updated config.
   */
  saveHeaderConfig: (
    projectId: string,
    cfg: DailyRequestHeaderConfigPatch
  ): Promise<DailyRequestHeaderConfig> =>
    api.put<DailyRequestHeaderConfig>('/tasks/daily-request-header-config', {
      projectId,
      ...cfg,
    }),

  /**
   * Upload a project logo (image) to Storage and persist it onto the header
   * config. Returns the updated config (with logoUrl for preview). Managers only.
   */
  uploadLogo: (projectId: string, file: File): Promise<DailyRequestHeaderConfig> => {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);
    return api.upload<DailyRequestHeaderConfig>('/tasks/daily-request-logo', formData);
  },

  // ---- Inspection topic config (T-076) ---------------------------------------

  /**
   * Fetch a project's inspection-topic config (the 3-level หมวดหลัก/หมวดย่อย/
   * หัวข้อ tree). The backend always returns a config (empty tree when none is
   * saved), same convention as getHeaderConfig.
   */
  getInspectionTopicConfig: (projectId: string): Promise<InspectionTopicConfig> =>
    api.get<InspectionTopicConfig>('/tasks/inspection-topic-config', { projectId }),

  /**
   * Save (merge-upsert) a project's inspection-topic tree. The whole tree is
   * sent — the settings UI edits it as a whole. Returns the updated config.
   */
  saveInspectionTopicConfig: (
    projectId: string,
    mainCategories: InspectionMainCategory[]
  ): Promise<InspectionTopicConfig> =>
    api.put<InspectionTopicConfig>('/tasks/inspection-topic-config', {
      projectId,
      mainCategories,
    }),
};

export default exportDocumentService;
