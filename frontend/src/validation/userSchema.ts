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
  nonEmptyArray(z.string(), '�1,�,,�,��,؅,?�,��,�')
);

export const userCreateSchema = z.object({
  employeeId: requiredString('�,��,��,�,��,z�,T�,�,?�,؅,��,T')
    .min(3, errorMessages.minLength(3))
    .max(20, errorMessages.maxLength(20)),
  username: username.transform((value) => value.toLowerCase()),
  password: strongPassword,
  name: requiredString('�,S�,��1^�,--�,T�,��,��,��,?�,,�,�')
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
    employeeId: requiredString('�,��,��,�,��,z�,T�,�,?�,؅,��,T')
      .min(3, errorMessages.minLength(3))
      .max(20, errorMessages.maxLength(20)),
    username: username.transform((value) => value.toLowerCase()),
    password: optionalString,
    name: requiredString('�,S�,��1^�,--�,T�,��,��,��,?�,,�,�')
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
      message: '�,��,��,�,��,o�1^�,��,T�,�1%�,-�,؅,��,�,-�,��1^�,��,؅,T�1%�,-�,� 6 �,�,�,�,-�,�,?�,c�,�',
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
    currentPassword: requiredString('�,��,��,�,��,o�1^�,��,T�,>�,�,^�,^�,,�,s�,�,T'),
    newPassword: strongPassword,
    confirmNewPassword: requiredString('�,��,��,T�,��,�,T�,��,��,�,��,o�1^�,��,T�1��,��,��1^'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: errorMessages.passwordMismatch,
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '�,��,��,�,��,o�1^�,��,T�1��,��,��1^�,�1%�,-�,؅1,�,��1^�,<�1%�,3�,?�,�,s�,��,��,�,��,o�1^�,��,T�1?�,"�,'�,�',
    path: ['newPassword'],
  });

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
