/**
 * User Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มผู้ใช้งาน
 *
 * Validation for Member Management forms (FR-M)
 * Used in User create/edit forms
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  username,
  password,
  strongPassword,
  optionalDate,
  baseDate,
  pastDate,
  departmentEnum,
  roleEnum,
  nonEmptyArray,
  baseBoolean,
  errorMessages,
} from './baseSchemas';

/**
 * User create schema
 * Used when creating a new user (requires password)
 */
export const userCreateSchema = z
  .object({
    // Basic Info
    employeeId: requiredString('รหัสพนักงาน')
      .min(3, errorMessages.minLength(3))
      .max(20, errorMessages.maxLength(20)),

    username: username,

    password: strongPassword,

    confirmPassword: requiredString('ยืนยันรหัสผ่าน'),

    name: requiredString('ชื่อ-นามสกุล')
      .min(2, errorMessages.minLength(2))
      .max(100, errorMessages.maxLength(100)),

    // Role & Department
    roleId: roleEnum,

    department: departmentEnum,

    // Dates
    dateOfBirth: optionalDate,

    startDate: pastDate('วันที่เริ่มงาน').or(z.date()),

    // Project Access
    projectLocationIds: z.preprocess(
      (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          return val ? [val] : [];
        }
        return val ?? [];
      },
      nonEmptyArray(z.string(), 'โครงการ')
    ),

    // Status
    isActive: baseBoolean.default(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: errorMessages.passwordMismatch,
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      // If dateOfBirth is provided, it should be before startDate
      if (data.dateOfBirth && data.startDate) {
        return data.dateOfBirth < data.startDate;
      }
      return true;
    },
    {
      message: 'วันเกิดต้องมาก่อนวันที่เริ่มงาน',
      path: ['dateOfBirth'],
    }
  );

/**
 * User edit schema
 * Used when editing existing user (password is optional)
 */
export const userEditSchema = z
  .object({
    // Basic Info
    employeeId: requiredString('รหัสพนักงาน')
      .min(3, errorMessages.minLength(3))
      .max(20, errorMessages.maxLength(20)),

    username: username,

    // Password is optional when editing
    password: optionalString,

    confirmPassword: optionalString,

    name: requiredString('ชื่อ-นามสกุล')
      .min(2, errorMessages.minLength(2))
      .max(100, errorMessages.maxLength(100)),

    // Role & Department
    roleId: roleEnum,

    department: departmentEnum,

    // Dates
    dateOfBirth: optionalDate,

    startDate: pastDate('วันที่เริ่มงาน').or(z.date()),

    // Project Access
    projectLocationIds: z.preprocess(
      (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          return val ? [val] : [];
        }
        return val ?? [];
      },
      nonEmptyArray(z.string(), 'โครงการ')
    ),

    // Status
    isActive: baseBoolean,
  })
  .refine(
    (data) => {
      // If password is provided, confirmPassword must match
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      message: errorMessages.passwordMismatch,
      path: ['confirmPassword'],
    }
  )
  .refine(
    (data) => {
      // If password is provided, it must meet strength requirements
      if (data.password && data.password.length > 0) {
        return /^[A-Za-z]{6,}$/.test(data.password);
      }
      return true;
    },
    {
      message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรภาษาอังกฤษ',
      path: ['password'],
    }
  )
  .refine(
    (data) => {
      // If dateOfBirth is provided, it should be before startDate
      if (data.dateOfBirth && data.startDate) {
        return data.dateOfBirth < data.startDate;
      }
      return true;
    },
    {
      message: 'วันเกิดต้องมาก่อนวันที่เริ่มงาน',
      path: ['dateOfBirth'],
    }
  );

/**
 * User filter schema
 * Used for filtering users in lists
 */
export const userFilterSchema = z.object({
  search: optionalString,
  roleId: z.string().optional(),
  department: departmentEnum.optional(),
  isActive: baseBoolean.optional(),
  projectLocationId: z.string().optional(),
});

/**
 * Change password schema
 * Used for password change form
 */
export const changePasswordSchema = z
  .object({
    currentPassword: requiredString('รหัสผ่านปัจจุบัน'),
    newPassword: strongPassword,
    confirmNewPassword: requiredString('ยืนยันรหัสผ่านใหม่'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: errorMessages.passwordMismatch,
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
    path: ['newPassword'],
  });

/**
 * Type exports
 */
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserEditInput = z.infer<typeof userEditSchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export default {
  userCreateSchema,
  userEditSchema,
  userFilterSchema,
  changePasswordSchema,
};
