/**
 * ScanData Service
 * API integration สำหรับ ScanData Management
 */

import apiClient from './api/client';
import type {
  ScanDataFilter,
  LateRecordFilter,
} from '../validation/scanDataSchema';

/**
 * ScanData Interface
 */
export interface ScanData {
  id: string;
  employeeNumber: string;
  dailyContractorId?: string;
  dailyContractorName?: string;
  projectLocationId: string;
  projectLocationName?: string;
  scanDateTime: Date;
  scanDate: Date;
  scanType:
  | 'ot_morning_in'
  | 'ot_morning_out'
  | 'regular_in'
  | 'late'
  | 'lunch_break'
  | 'regular_out'
  | 'ot_noon'
  | 'ot_evening_in'
  | 'ot_evening_out';
  scanTimeSlot: string;
  isFirstScanOfDay: boolean;
  isLastScanOfDay: boolean;
  isDuplicate: boolean;
  relatedScanId?: string;
  calculatedHours?: number;
  roundedHours?: number;
  lateMinutes?: number;
  time1?: string;
  time2?: string;
  time3?: string;
  time4?: string;
  time5?: string;
  time6?: string;
  time7?: string;
  time8?: string;
  time9?: string;
  time10?: string;
  importBatchId: string;

  importTimestamp: Date;
  hasDiscrepancy: boolean;
  notes?: string;
  rawData?: any;
}


/**
 * Late Record Interface
 */
export interface LateRecord {
  id: string;
  dailyContractorId: string;
  dailyContractorName?: string;
  employeeNumber: string;
  projectLocationId: string;
  projectLocationName?: string;
  lateDate: Date;
  scanDataId: string;
  scanTime: Date;
  expectedTime: Date;
  lateMinutes: number;
  deductionAmount?: number;
  wagePeriodId?: string;
  includedInWageCalculation: boolean;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
}

/**
 * Import Result Interface
 */
export interface ImportResult {
  success: boolean;
  importBatchId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  duplicateRecords?: number;
  errors: Array<{
    row: number;
    employeeNumber?: string;
    error: string;
  }>;
  warnings: string[];
  records: Array<{
    row: number;
    status: 'success' | 'failed' | 'duplicate';
    employeeNumber?: string;
    data: any;
    error?: string;
  }>;
}


/**
 * Upload ScanData file (.dat หรือ Excel) และ import เข้าระบบ
 */
export async function uploadScanDataFile(
  file: File,
  projectLocationId: string,
  importNote?: string,
  dryRun?: boolean
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectLocationId', projectLocationId);
  if (importNote) {
    formData.append('importNote', importNote);
  }

  const response = await apiClient.post<{ success: boolean; data: ImportResult }>(
    '/scan-data/import',
    formData,
    {
      params: {
        dryRun: dryRun ? 'true' : 'false'
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data.data;
}

export const uploadScanDataExcel = uploadScanDataFile;

/**
 * Get all scan data with filtering
 */
export async function getAllScanData(
  filter?: ScanDataFilter & { enriched?: boolean; onlyDeleted?: boolean },
  page: number = 1,
  pageSize: number = 50
): Promise<{
  data: ScanData[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));

  if (filter) {
    if (filter.projectLocationId)
      params.append('projectLocationId', filter.projectLocationId);
    if (filter.dailyContractorId)
      params.append('dailyContractorId', filter.dailyContractorId);
    if (filter.employeeNumber) params.append('employeeNumber', filter.employeeNumber);
    if (filter.startDate)
      params.append('startDate', filter.startDate.toISOString());
    if (filter.endDate) params.append('endDate', filter.endDate.toISOString());
    if (filter.scanType) params.append('scanType', filter.scanType);
    if (filter.hasDiscrepancy !== undefined)
      params.append('hasDiscrepancy', String(filter.hasDiscrepancy));
    if (filter.importBatchId) params.append('importBatchId', filter.importBatchId);
    if (filter.enriched) params.append('enriched', 'true');
    if (filter.onlyDeleted) params.append('onlyDeleted', 'true');
  }


  const response = await apiClient.get<{
    success: boolean;
    data: ScanData[];
    total: number;
  }>(`/scan-data?${params.toString()}`);

  return {
    data: response.data.data,
    total: response.data.total || 0,
    page,
    pageSize,
  };
}

/**
 * Get scan data by ID
 */
export async function getScanDataById(id: string): Promise<ScanData> {
  const response = await apiClient.get<{ success: boolean; data: ScanData }>(
    `/scan-data/${id}`
  );
  return response.data.data;
}

/**
 * Delete scan data (ลบทั้ง batch)
 */
export async function deleteScanDataBatch(importBatchId: string): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete<{
    success: boolean;
    data: { deletedCount: number };
  }>(`/scan-data/batch/${importBatchId}`);
  return response.data.data;
}

/**
 * Delete scan data (ลบตามโครงการและวันที่)
 */
export async function deleteScanDataBulk(
  projectLocationId: string,
  startDate: Date,
  endDate: Date
): Promise<{ deletedCount: number }> {
  const params = new URLSearchParams();
  params.append('projectLocationId', projectLocationId);
  params.append('startDate', startDate.toISOString());
  params.append('endDate', endDate.toISOString());

  const response = await apiClient.delete<{
    success: boolean;
    data: { deletedCount: number };
  }>(`/scan-data/bulk?${params.toString()}`);
  return response.data.data;
}


/**
 * Get late records with filtering
 */
export async function getLateRecords(
  filter?: LateRecordFilter,
  page: number = 1,
  pageSize: number = 50
): Promise<{
  data: LateRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));

  if (filter) {
    if (filter.projectLocationId)
      params.append('projectLocationId', filter.projectLocationId);
    if (filter.dailyContractorId)
      params.append('dailyContractorId', filter.dailyContractorId);
    if (filter.employeeNumber) params.append('employeeNumber', filter.employeeNumber);
    if (filter.startDate)
      params.append('startDate', filter.startDate.toISOString());
    if (filter.endDate) params.append('endDate', filter.endDate.toISOString());
    if (filter.wagePeriodId) params.append('wagePeriodId', filter.wagePeriodId);
    if (filter.includedInWageCalculation !== undefined)
      params.append(
        'includedInWageCalculation',
        String(filter.includedInWageCalculation)
      );
  }

  const response = await apiClient.get<{
    success: boolean;
    data: LateRecord[];
    pagination: { total: number; page: number; pageSize: number };
  }>(`/late-records?${params.toString()}`);

  return {
    data: response.data.data,
    total: response.data.pagination.total,
    page: response.data.pagination.page,
    pageSize: response.data.pagination.pageSize,
  };
}

/**
 * Delete a single scan data record
 */
export async function softDeleteScanData(id: string): Promise<void> {
  await apiClient.delete(`/scan-data/${id}`);
}


/**
 * Add a manual scan record
 */
export async function addManualScan(payload: {
  employeeNumber: string;
  projectLocationId: string;
  scanDateTime: Date;
  notes?: string;
}): Promise<ScanData> {
  const response = await apiClient.post<{ success: boolean; data: ScanData }>(
    '/scan-data/manual',
    payload
  );
  return response.data.data;
}

/**
 * Update a scan record
 */
export async function updateScanDataRecord(
  id: string,
  updates: Partial<ScanData>
): Promise<ScanData> {
  const response = await apiClient.patch<{ success: boolean; data: ScanData }>(
    `/scan-data/${id}`,
    updates
  );
  return response.data.data;
}

/**
 * Auto-fill scan data using Daily Report times (shiftTimes)
 */
export async function fillFromDailyReport(
  employeeId: string,
  workDate: string,
  projectLocationId: string
): Promise<ScanData> {
  const response = await apiClient.post<{ success: boolean; data: ScanData }>(
    '/scan-data/fill-from-daily-report',
    {
      employeeId,
      workDate,
      projectLocationId,
    }
  );
  return response.data.data;
}


/**
 * Update all punches for a specific contractor and date (Manual correction)
 */
export async function updateDailyPunches(
  contractorId: string,
  date: Date,
  punches: string[],
  scanDataId?: string
): Promise<{ success: boolean; count: number }> {
  const response = await apiClient.put<{ success: boolean; count: number }>(
    '/scan-data/punches',
    {
      id: scanDataId,
      contractorId,
      date: date.toISOString(),
      punches
    }
  );
  return response.data;
}


/**
 * Export scan data to Excel
 */
export async function exportScanData(params: {
  projectLocationId: string;
  startDate: Date;
  endDate: Date;
  employeeNumber?: string;
  onlyDeleted?: boolean;
}): Promise<void> {
  // apiClient already handles the /api prefix, so we just need the path here
  const response = await apiClient.get('/scan-data/export', {
    params: {
      projectLocationId: params.projectLocationId,
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      employeeNumber: params.employeeNumber,
      onlyDeleted: params.onlyDeleted ? 'true' : 'false',
    },
    responseType: 'blob',
  });


  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `ScanData_Export_${new Date().getTime()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Delete a single scan data record by ID
 * DELETE /api/scan-data/:id
 */
export async function deleteScanDataById(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/scan-data/${id}`);
  return response.data;
}


/**
 * Restore a single scan data record by ID
 * POST /api/scan-data/:id/restore
 */
export async function restoreScanDataById(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/scan-data/${id}/restore`);
  return response.data;
}

