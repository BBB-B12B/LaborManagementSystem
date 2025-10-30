/**
 * Member/User Service
 * บริการจัดการผู้ใช้งาน (Member Management)
 *
 * API Integration for User CRUD operations
 * Authorization: Admin only (FR-M-001)
 */

import { apiClient, api } from './api/client';
import type { UserCreateInput, UserEditInput } from '../validation/userSchema';

/**
 * User data type (DTO from backend)
 */
export interface User {
  id: string;
  employeeId: string;
  username: string;
  name: string;
  roleId: string;
  department: 'PD01' | 'PD02' | 'PD03' | 'PD04' | 'PD05';
  dateOfBirth?: Date;
  startDate: Date;
  projectLocationIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User list response
 */
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * User filter options
 */
export interface UserFilterOptions {
  search?: string;
  roleId?: string;
  department?: string;
  isActive?: boolean;
 page?: number;
 pageSize?: number;
}

/**
 * Get all users with optional filters
 * GET /api/users
 */
export async function getAllUsers(
  filters?: UserFilterOptions
): Promise<UserListResponse> {
  const params = new URLSearchParams();

  if (filters?.search) params.append('search', filters.search);
  if (filters?.roleId) params.append('roleId', filters.roleId);
  if (filters?.department) params.append('department', filters.department);
  if (filters?.isActive !== undefined)
    params.append('isActive', String(filters.isActive));
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

  const response = await api.get<UserListResponse>('/users', Object.fromEntries(params));
  return response;
}

/**
 * Get user by ID
 * GET /api/users/:id
 */
export async function getUserById(id: string): Promise<User> {
  const response = await apiClient.get<{ success: boolean; data: User }>(
    `/users/${id}`
  );

  return response.data.data;
}

/**
 * Create new user
 * POST /api/users
 *
 * FR-M-002: สร้างผู้ใช้ใหม่
 * FR-M-006: Password must be >= 8 characters (validated in backend with bcrypt)
 */
export async function createUser(data: UserCreateInput): Promise<User> {
  const response = await apiClient.post<{ success: boolean; data: User }>(
    '/users',
    data
  );

  return response.data.data;
}

/**
 * Update user
 * PUT /api/users/:id
 *
 * FR-M-003: แก้ไขข้อมูลผู้ใช้
 */
export async function updateUser(id: string, data: UserEditInput): Promise<User> {
  const response = await apiClient.put<{ success: boolean; data: User }>(
    `/users/${id}`,
    data
  );

  return response.data.data;
}

/**
 * Delete user (soft delete)
 * DELETE /api/users/:id
 *
 * FR-M-004: ลบผู้ใช้ (soft delete, Edge Case 7)
 */
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

export async function importUsersFromFile(file: File): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.upload('/users/import', formData);
}

/**
 * Get users by department
 * GET /api/users?department=PD01
 */
export async function getUsersByDepartment(department: string): Promise<User[]> {
  const response = await apiClient.get<{ success: boolean; data: User[] }>(
    `/users?department=${department}`
  );

  return response.data.data;
}

/**
 * Get users by role
 * GET /api/users?roleId=xxx
 */
export async function getUsersByRole(roleId: string): Promise<User[]> {
  const response = await apiClient.get<{ success: boolean; data: User[] }>(
    `/users?roleId=${roleId}`
  );

  return response.data.data;
}

/**
 * Export all member service functions
 */
export const memberService = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByDepartment,
  getUsersByRole,
  importUsersFromFile,
};

export default memberService;
