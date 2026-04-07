/**
 * Project (ProjectLocation) Form Validation Schema
 *
 * Validation rules for project management create/edit forms.
 */

import { z } from 'zod';
import { requiredString, projectStatusEnum, PROJECT_STATUS_VALUES, errorMessages } from './baseSchemas';

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

  projectName: requiredString('Project name is required')
    .min(3, errorMessages.minLength(3))
    .max(200, errorMessages.maxLength(200)),

  status: projectStatusEnum.default('กำลังดำเนินการอยู่'),
  projectManager: z
    .string()
    .max(200, errorMessages.maxLength(200))
    .optional()
    .transform((val) => (val ? val.trim() : val)),
});

export const projectFilterSchema = z.object({
  department: z.string().optional(),
  status: projectStatusEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

export const PROJECT_STATUS_OPTIONS = PROJECT_STATUS_VALUES;

export type ProjectFormData = z.infer<typeof projectSchema>;
export type ProjectFilterData = z.infer<typeof projectFilterSchema>;
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export default {
  projectSchema,
  projectFilterSchema,
  PROJECT_STATUS_OPTIONS,
};
