/**
 * Wage Calculation Service
 * บริการคำนวณค่าแรง
 *
 * API Integration for Wage Period CRUD and calculation operations
 */

import { apiClient } from './api/client';
import type {
  WagePeriodCreateInput,
  AdditionalIncomeInput,
  AdditionalExpenseInput,
  DCIncomeDetailsInput,
  DCExpenseDetailsInput,
} from '../validation/wageSchema';

/**
 * Wage Period status
 */
export type PeriodStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'locked';

/**
 * DC Wage Summary (result of calculation)
 */
export interface DCWageSummary {
  dailyContractorId: string;
  employeeId: string;
  name: string;
  skillName: string;

  // Hours worked
  regularHours: number;
  otMorningHours: number;
  otNoonHours: number;
  otEveningHours: number;
  totalOtHours: number;
  totalHours: number;

  // Income calculations
  hourlyRate: number;
  professionalRate: number;
  phoneAllowance: number;
  regularWages: number;
  otWages: number;
  professionalFees: number;
  additionalIncome: number;
  totalIncome: number;

  // Expense calculations
  accommodationCost: number;
  followerCount: number;
  followerAccommodation: number;
  refrigeratorCost: number;
  soundSystemCost: number;
  tvCost: number;
  washingMachineCost: number;
  portableAcCost: number;
  additionalExpenses: number;
  socialSecurityDeduction: number;
  lateDeductions: number;
  totalExpenses: number;

  // Net calculation
  netWages: number;
}

/**
 * Wage Period data type
 */
export interface WagePeriod {
  id: string;
  periodCode: string;
  projectLocationId: string;
  startDate: Date;
  endDate: Date;
  periodDays: number;
  status: PeriodStatus;
  dcSummaries: DCWageSummary[];
  totalRegularHours: number;
  totalOtHours: number;
  totalGrossWages: number;
  totalDeductions: number;
  totalNetWages: number;
  hasUnresolvedDiscrepancies: boolean;
  calculatedAt?: Date;
  calculatedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wage period list response
 */
export interface WagePeriodListResponse {
  wagePeriods: WagePeriod[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Get all wage periods with optional filters
 * GET /api/wage-periods
 */
export async function getAllWagePeriods(filters?: {
  projectLocationId?: string;
  status?: PeriodStatus;
  page?: number;
  pageSize?: number;
}): Promise<WagePeriodListResponse> {
  const params = new URLSearchParams();

  if (filters?.projectLocationId)
    params.append('projectLocationId', filters.projectLocationId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

  const response = await apiClient.get<{
    success: boolean;
    data: WagePeriodListResponse;
  }>(`/wage-periods?${params.toString()}`);

  return response.data.data;
}

/**
 * Get wage period by ID
 * GET /api/wage-periods/:id
 */
export async function getWagePeriodById(id: string): Promise<WagePeriod> {
  const response = await apiClient.get<{ success: boolean; data: WagePeriod }>(
    `/wage-periods/${id}`
  );

  return response.data.data;
}

/**
 * Create new wage period
 * POST /api/wage-periods
 *
 * FR-WC-001: Validate 15-day period
 */
export async function createWagePeriod(
  data: WagePeriodCreateInput
): Promise<WagePeriod> {
  const response = await apiClient.post<{ success: boolean; data: WagePeriod }>(
    '/wage-periods',
    data
  );

  return response.data.data;
}

/**
 * Calculate wages for a period
 * POST /api/wage-periods/:id/calculate
 *
 * FR-WC-004 to FR-WC-027: All wage calculations
 * SC-011: Calculation <5 min
 */
export async function calculateWages(id: string): Promise<WagePeriod> {
  const response = await apiClient.post<{ success: boolean; data: WagePeriod }>(
    `/wage-periods/${id}/calculate`
  );

  return response.data.data;
}

/**
 * Approve wage period
 * POST /api/wage-periods/:id/approve
 */
export async function approveWagePeriod(id: string): Promise<WagePeriod> {
  const response = await apiClient.post<{ success: boolean; data: WagePeriod }>(
    `/wage-periods/${id}/approve`
  );

  return response.data.data;
}

/**
 * Delete wage period
 * DELETE /api/wage-periods/:id
 */
export async function deleteWagePeriod(id: string): Promise<void> {
  await apiClient.delete(`/wage-periods/${id}`);
}

/**
 * Export wage period to Excel
 * GET /api/wage-periods/:id/export
 *
 * SC-014: Export <10s
 */
export async function exportWagePeriodToExcel(id: string): Promise<Blob> {
  const response = await apiClient.get(`/wage-periods/${id}/export`, {
    responseType: 'blob',
  });

  return response.data;
}

/**
 * Add additional income to DC in period
 * POST /api/wage-periods/:periodId/additional-income
 */
export async function addAdditionalIncome(
  periodId: string,
  data: AdditionalIncomeInput
): Promise<void> {
  await apiClient.post(`/wage-periods/${periodId}/additional-income`, data);
}

/**
 * Add additional expense to DC in period
 * POST /api/wage-periods/:periodId/additional-expense
 */
export async function addAdditionalExpense(
  periodId: string,
  data: AdditionalExpenseInput
): Promise<void> {
  await apiClient.post(`/wage-periods/${periodId}/additional-expense`, data);
}

/**
 * Delete additional income
 * DELETE /api/additional-income/:id
 */
export async function deleteAdditionalIncome(id: string): Promise<void> {
  await apiClient.delete(`/additional-income/${id}`);
}

/**
 * Delete additional expense
 * DELETE /api/additional-expense/:id
 */
export async function deleteAdditionalExpense(id: string): Promise<void> {
  await apiClient.delete(`/additional-expense/${id}`);
}

/**
 * Set DC income details (wage rates)
 * POST /api/dc-income-details
 */
export async function setDCIncomeDetails(
  data: DCIncomeDetailsInput
): Promise<void> {
  await apiClient.post('/dc-income-details', data);
}

/**
 * Set DC expense details
 * POST /api/dc-expense-details
 */
export async function setDCExpenseDetails(
  data: DCExpenseDetailsInput
): Promise<void> {
  await apiClient.post('/dc-expense-details', data);
}

/**
 * Get DC income details
 * GET /api/dc-income-details/:dcId
 */
export async function getDCIncomeDetails(dcId: string): Promise<any> {
  const response = await apiClient.get(`/dc-income-details/${dcId}`);
  return response.data.data;
}

/**
 * Get DC expense details
 * GET /api/dc-expense-details/:dcId
 */
export async function getDCExpenseDetails(dcId: string): Promise<any> {
  const response = await apiClient.get(`/dc-expense-details/${dcId}`);
  return response.data.data;
}

/**
 * Download Excel file helper
 */
export function downloadExcelFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Export all wage service functions
 */
export const wageService = {
  getAllWagePeriods,
  getWagePeriodById,
  createWagePeriod,
  calculateWages,
  approveWagePeriod,
  deleteWagePeriod,
  exportWagePeriodToExcel,
  addAdditionalIncome,
  addAdditionalExpense,
  deleteAdditionalIncome,
  deleteAdditionalExpense,
  setDCIncomeDetails,
  setDCExpenseDetails,
  getDCIncomeDetails,
  getDCExpenseDetails,
  downloadExcelFile,
};

export default wageService;
