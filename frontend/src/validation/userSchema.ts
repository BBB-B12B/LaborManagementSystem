/**
 * User Form Validation Schema
 * Validation rules for Create/Edit member popup
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  username,
  strongPassword,
  departmentEnum,
  roleEnum,
  nonEmptyArray,
  baseBoolean,
  errorMessages,
} from './baseSchemas';

const projectArray = z.preprocess(
  (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      return val ? [val] : [];
    }
    return [];
  },
  nonEmptyArray(z.string(), 'โปรดเลือกอย่างน้อย 1 โครงการ')
);

export const userCreateSchema = z.object({
  employeeId: requiredString('รหัสพนักงาน')
    .min(3, errorMessages.minLength(3))
    .max(20, errorMessages.maxLength(20)),
  username: username.transform((value) => value.toLowerCase()),
  password: strongPassword,
  name: requiredString('ชื่อพนักงาน')
    .min(2, errorMessages.minLength(2))
    .max(100, errorMessages.maxLength(100)),
  fullNameEn: optionalString,
  roleId: roleEnum,
  department: departmentEnum,
  projectLocationIds: projectArray,
  isActive: baseBoolean.default(true),
});

export const userEditSchema = z
  .object({
    employeeId: requiredString('รหัสพนักงาน')
      .min(3, errorMessages.minLength(3))
      .max(20, errorMessages.maxLength(20)),
    username: username.transform((value) => value.toLowerCase()),
    password: optionalString,
    name: requiredString('ชื่อพนักงาน')
      .min(2, errorMessages.minLength(2))
      .max(100, errorMessages.maxLength(100)),
    fullNameEn: optionalString,
    roleId: roleEnum,
    department: departmentEnum,
    projectLocationIds: projectArray,
    isActive: baseBoolean,
  })
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return /^[A-Za-z0-9]{6,}$/.test(data.password);
      }
      return true;
    },
    {
      message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      path: ['password'],
    }
  );

export const userFilterSchema = z.object({
  search: optionalString,
  roleId: z.string().optional(),
  department: departmentEnum.optional(),
  isActive: baseBoolean.optional(),
  projectLocationId: z.string().optional(),
});

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
    message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน',
    path: ['newPassword'],
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserEditInput = z.infer<typeof userEditSchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const userSchemaExports = {
  userCreateSchema,
  userEditSchema,
  userFilterSchema,
  changePasswordSchema,
};

export default userSchemaExports;
