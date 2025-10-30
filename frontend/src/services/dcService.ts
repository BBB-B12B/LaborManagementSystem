/**
 * Daily Contractor (DC) Service
 * บริการจัดการแรงงานรายวัน
 *
 * API Integration for DC CRUD operations
 * Authorization: FM, SE, PM, Admin (FR-DC-001)
 */

import { apiClient, api } from './api/client';
import type { DCCreateInput, DCEditInput } from '../validation/dcSchema';

/**
 * Daily Contractor data type (DTO from backend)
 */
export interface DailyContractor {
  id: string;
  employeeId: string;
  name: string;
  skillId: string;
  projectLocationIds: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  hasCompensation?: boolean;
}

export interface DCCompensationIncome {
  hourlyRate: number;
  otHourlyRate: number;
  professionalRate: number;
  phoneAllowancePerPeriod: number;
  effectiveDate?: string | Date | null;
}

export interface DCCompensationExpense {
  accommodationCostPerPeriod: number;
  followerCount: number;
  followerAccommodationPerPeriod: number;
  refrigeratorCostPerPeriod: number;
  soundSystemCostPerPeriod: number;
  tvCostPerPeriod: number;
  washingMachineCostPerPeriod: number;
  portableAcCostPerPeriod: number;
  effectiveDate?: string | Date | null;
}

export interface DCCompensationDetails {
  income: DCCompensationIncome | null;
  expense: DCCompensationExpense | null;
}

export interface DCImportError {
  row: number;
  employeeId?: string;
  message: string;
}

export interface DCImportSummary {
  total: number;
  imported: number;
  skipped: number;
  errors: DCImportError[];
}

/**
 * DC list response
 */
export interface DCListResponse {
  dailyContractors: DailyContractor[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * DC filter options
 */
export interface DCFilterOptions {
  search?: string;
  skillId?: string;
  projectLocationId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Get all DCs with optional filters
 * GET /api/daily-contractors
 */
export async function getAllDCs(
  filters?: DCFilterOptions
): Promise<DCListResponse> {
  const params = new URLSearchParams();

  if (filters?.search) params.append('search', filters.search);
  if (filters?.skillId) params.append('skillId', filters.skillId);
  if (filters?.projectLocationId)
    params.append('projectLocationId', filters.projectLocationId);
  if (filters?.isActive !== undefined)
    params.append('isActive', String(filters.isActive));
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

  const response = await apiClient.get<{ success: boolean; data: DCListResponse }>(
    `/daily-contractors?${params.toString()}`
  );

  return response.data.data;
}

/**
 * Get active DCs only
 * GET /api/daily-contractors/active
 */
export async function getActiveDCs(): Promise<DailyContractor[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: DailyContractor[];
  }>('/daily-contractors/active');

  return response.data.data;
}

/**
 * Get DC by ID
 * GET /api/daily-contractors/:id
 */
export async function getDCById(id: string): Promise<DailyContractor> {
  const response = await apiClient.get<{
    success: boolean;
    data: DailyContractor;
  }>(`/daily-contractors/${id}`);

  return response.data.data;
}

/**
 * Create new DC
 * POST /api/daily-contractors
 *
 * FR-DC-002: Required fields: employeeId, name, skillId
 */
export async function createDC(data: DCCreateInput): Promise<DailyContractor> {
  const response = await apiClient.post<{
    success: boolean;
    data: DailyContractor;
  }>('/daily-contractors', data);

  return response.data.data;
}

/**
 * Update DC
 * PUT /api/daily-contractors/:id
 *
 * FR-DC-001: Update DC data
 */
export async function updateDC(
  id: string,
  data: DCEditInput
): Promise<DailyContractor> {
  const response = await apiClient.put<{
    success: boolean;
    data: DailyContractor;
  }>(`/daily-contractors/${id}`, data);

  return response.data.data;
}

/**
 * Delete DC (soft delete)
 * DELETE /api/daily-contractors/:id
 *
 * FR-DC-001: Delete DC (soft delete)
 */
export async function deleteDC(id: string): Promise<void> {
  await apiClient.delete(`/daily-contractors/${id}`);
}

/**
 * Import daily contractors from CSV file
 * POST /api/daily-contractors/import
 */
export async function importDailyContractorsFromFile(file: File): Promise<DCImportSummary> {
  const formData = new FormData();
  formData.append('file', file);
  return api.upload<DCImportSummary>('/daily-contractors/import', formData);
}

/**
 * Search DCs (autocomplete)
 * GET /api/daily-contractors?search=query
 *
 * FR-DC-003: DC Auto Complete search
 * SC-008: Search performance <0.5s
 */
export async function searchDCs(
  query: string,
  limit: number = 10
): Promise<DailyContractor[]> {
  const params = new URLSearchParams();
  params.append('search', query);
  params.append('pageSize', String(limit));
  params.append('isActive', 'true');

  const response = await apiClient.get<{ success: boolean; data: DCListResponse }>(
    `/daily-contractors?${params.toString()}`
  );

  return response.data.data.dailyContractors;
}

/**
 * Get DCs by skill
 * GET /api/daily-contractors?skillId=xxx
 */
export async function getDCsBySkill(skillId: string): Promise<DailyContractor[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: DCListResponse;
  }>(`/daily-contractors?skillId=${skillId}`);

  return response.data.data.dailyContractors;
}

/**
 * Get DCs by project
 * GET /api/daily-contractors?projectLocationId=xxx
 *
 * FR-DC-004: DC linked to authorized projects
 */
export async function getDCsByProject(
  projectLocationId: string
): Promise<DailyContractor[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: DCListResponse;
  }>(`/daily-contractors?projectLocationId=${projectLocationId}`);

  return response.data.data.dailyContractors;
}

/**
 * Get DC compensation (income & expense) details
 * GET /api/daily-contractors/:id/compensation
 */
export async function getDCCompensation(
  id: string
): Promise<DCCompensationDetails> {
  const response = await apiClient.get<{
    success: boolean;
    data: DCCompensationDetails;
  }>(`/daily-contractors/${id}/compensation`);

  return response.data.data;
}

/**
 * Upsert DC compensation (income & expense)
 * PUT /api/daily-contractors/:id/compensation
 */
export async function upsertDCCompensation(
  id: string,
  data: {
    income?: {
      hourlyRate: number;
      professionalRate: number;
      phoneAllowancePerPeriod: number;
    };
    expense?: {
      accommodationCostPerPeriod: number;
      followerCount: number;
      refrigeratorCostPerPeriod: number;
      soundSystemCostPerPeriod: number;
      tvCostPerPeriod: number;
      washingMachineCostPerPeriod: number;
      portableAcCostPerPeriod: number;
    };
  }
): Promise<DCCompensationDetails> {
  const response = await apiClient.put<{
    success: boolean;
    data: DCCompensationDetails;
  }>(`/daily-contractors/${id}/compensation`, data);

  return response.data.data;
}

/**
 * Check if employeeId is unique
 * GET /api/daily-contractors/check-employee-id?employeeId=xxx
 */
export async function checkEmployeeIdUnique(
  employeeId: string,
  excludeId?: string
): Promise<boolean> {
  const params = new URLSearchParams();
  params.append('employeeId', employeeId);
  if (excludeId) params.append('excludeId', excludeId);

  try {
    const response = await apiClient.get<{
      success: boolean;
      data: { isUnique: boolean };
    }>(`/daily-contractors/check-employee-id?${params.toString()}`);

    return response.data.data.isUnique;
  } catch {
    return false;
  }
}

/**
 * Export all DC service functions
 */
export const dcService = {
  getAllDCs,
  getActiveDCs,
  getDCById,
  createDC,
  updateDC,
  deleteDC,
  importDailyContractorsFromFile,
  searchDCs,
  getDCsBySkill,
  getDCsByProject,
  checkEmployeeIdUnique,
};

export default dcService;
