/**
 * Project (ProjectLocation) Form Validation Schema
 *
 * Validation rules for project management create/edit forms.
 */

import { z } from 'zod';
import { requiredString, projectStatusEnum, baseBoolean, errorMessages } from './baseSchemas';

/**
 * Project create/edit schema
 */
export const projectSchema = z.object({
  code: requiredString('Project code is required')
    .min(2, errorMessages.minLength(2))
    .max(20, errorMessages.maxLength(20))
    .regex(/^[A-Z0-9-]+$/, 'Project code must contain only A-Z, 0-9, or hyphen (-)')
    .transform((val) => val.toUpperCase()),

  projectCode: requiredString('รหัสโครงการจำเป็นต้องระบุ')
    .min(1, errorMessages.minLength(1))
    .max(50, errorMessages.maxLength(50)),

  department: requiredString('Department is required'),

  name: requiredString('Project name is required')
    .min(3, errorMessages.minLength(3))
    .max(200, errorMessages.maxLength(200)),

  status: projectStatusEnum.default('active'),

  isActive: baseBoolean.default(true),
  projectManager: z
    .string()
    .max(200, errorMessages.maxLength(200))
    .optional()
    .transform((val) => (val ? val.trim() : val)),
  statusLabel: z.string().optional(),
});

export const projectFilterSchema = z.object({
  department: z.string().optional(),
  status: projectStatusEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

export const PROJECT_STATUS_LABELS = {
  active: 'กำลังดำเนินการอยู่',
  suspended: 'ระงับชั่วคราว',
  completed: 'ปิดโครงการ',
} as const;

export const getProjectStatusLabel = (status?: string): string => {
  if (!status) return 'ไม่ทราบสถานะ';
  return PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] || status;
};

export type ProjectFormData = z.infer<typeof projectSchema>;
export type ProjectFilterData = z.infer<typeof projectFilterSchema>;
export type ProjectStatus = 'active' | 'completed' | 'suspended';

export default {
  projectSchema,
  projectFilterSchema,
  PROJECT_STATUS_LABELS,
};
