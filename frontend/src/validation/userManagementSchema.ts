/**
 * User Management Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มจัดการผู้ใช้
 *
 * Validation for User management forms (FR-M)
 * Used for member/user management CRUD operations
 * Admin only (FR-M-001)
 */

import { z } from 'zod';
import {
  username,
  strongPassword,
  requiredString,
  optionalDate,
  departmentEnum,
  roleEnum,
  baseBoolean,
  baseArray,
  errorMessages,
} from './baseSchemas';

/**
 * Employee ID validation
 * Required, unique, alphanumeric
 */
const employeeId = requiredString('รหัสพนักงาน')
  .min(3, errorMessages.minLength(3))
  .max(20, errorMessages.maxLength(20))
  .regex(/^[A-Z0-9-]+$/, 'รหัสพนักงานต้องเป็นตัวพิมพ์ใหญ่ ตัวเลข หรือ - เท่านั้น')
  .transform((val) => val.toUpperCase());

/**
 * User create schema
 * Used when creating new user (requires password)
 */
export const userCreateSchema = z.object({
  // Username (unique, no spaces, 3-20 chars)
  username,

  // Password (min 8 chars, must contain letter and number) - FR-M-006
  password: strongPassword,

  // Confirm password
  confirmPassword: strongPassword,

  // Full name
  name: requiredString('ชื่อ-นามสกุล')
    .min(2, errorMessages.minLength(2))
    .max(100, errorMessages.maxLength(100)),

  // Employee ID (unique, uppercase)
  employeeId,

  // Role (8 roles: AM, FM, SE, OE, PE, PM, PD, MD)
  roleId: roleEnum,

  // Department (PD01-PD05)
  department: departmentEnum,

  // Accessible Projects (multi-select, array of project IDs)
  projectLocationIds: baseArray(z.string()).default([]),

  // Birth Date (optional)
  birthDate: optionalDate,

  // Start Date (optional)
  startDate: optionalDate,

  // Active status
  isActive: baseBoolean.default(true),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: errorMessages.passwordMismatch,
    path: ['confirmPassword'],
  }
);

/**
 * User update schema
 * Used when editing existing user (password optional)
 */
export const userUpdateSchema = z.object({
  // Username (unique, no spaces, 3-20 chars)
  username,

  // Password (optional - only if user wants to change it)
  password: z.string().optional(),

  // Confirm password (only if password provided)
  confirmPassword: z.string().optional(),

  // Full name
  name: requiredString('ชื่อ-นามสกุล')
    .min(2, errorMessages.minLength(2))
    .max(100, errorMessages.maxLength(100)),

  // Employee ID (unique, uppercase)
  employeeId,

  // Role (8 roles)
  roleId: roleEnum,

  // Department (PD01-PD05)
  department: departmentEnum,

  // Accessible Projects (multi-select, array of project IDs)
  projectLocationIds: baseArray(z.string()).default([]),

  // Birth Date (optional)
  birthDate: optionalDate,

  // Start Date (optional)
  startDate: optionalDate,

  // Active status
  isActive: baseBoolean.default(true),
}).refine(
  (data) => {
    // If password provided, must match confirmPassword
    if (data.password || data.confirmPassword) {
      return data.password === data.confirmPassword;
    }
    return true;
  },
  {
    message: errorMessages.passwordMismatch,
    path: ['confirmPassword'],
  }
).refine(
  (data) => {
    if (data.password && data.password.length > 0) {
      return /^[A-Za-z]{6,}$/.test(data.password);
    }
    return true;
  },
  {
    message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรภาษาอังกฤษ',
    path: ['password'],
  }
);

/**
 * User filter schema
 * Used for filtering users in lists
 */
export const userFilterSchema = z.object({
  roleId: roleEnum.optional(),
  department: departmentEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

/**
 * Role labels for UI (8 roles)
 */
export const ROLE_LABELS = {
  AM: 'Admin (AM)',
  FM: 'Facility Manager (FM)',
  SE: 'Site Engineer (SE)',
  OE: 'Office Engineer (OE)',
  PE: 'Project Engineer (PE)',
  PM: 'Project Manager (PM)',
  PD: 'Project Director (PD)',
  MD: 'Managing Director (MD)',
} as const;

/**
 * Department labels for UI
 */
export const DEPARTMENT_LABELS = {
  PD01: 'PD01',
  PD02: 'PD02',
  PD03: 'PD03',
  PD04: 'PD04',
  PD05: 'PD05',
} as const;

/**
 * Get role label in Thai
 */
export const getRoleLabel = (roleId: string): string => {
  return ROLE_LABELS[roleId as keyof typeof ROLE_LABELS] || roleId;
};

/**
 * Get department label
 */
export const getDepartmentLabel = (department: string): string => {
  return DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS] || department;
};

/**
 * Type exports
 */
export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type UserUpdateFormData = z.infer<typeof userUpdateSchema>;
export type UserFilterData = z.infer<typeof userFilterSchema>;
export type Role = 'AM' | 'FM' | 'SE' | 'OE' | 'PE' | 'PM' | 'PD' | 'MD';
export type Department = 'PD01' | 'PD02' | 'PD03' | 'PD04' | 'PD05';

export default {
  userCreateSchema,
  userUpdateSchema,
  userFilterSchema,
  ROLE_LABELS,
  DEPARTMENT_LABELS,
  getRoleLabel,
  getDepartmentLabel,
};
