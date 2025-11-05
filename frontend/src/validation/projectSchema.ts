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

  department: requiredString('Department is required'),

  name: requiredString('Project name is required')
    .min(3, errorMessages.minLength(3))
    .max(200, errorMessages.maxLength(200)),

  status: projectStatusEnum.default('active'),

  isActive: baseBoolean.default(true),
});

export const projectFilterSchema = z.object({
  department: z.string().optional(),
  status: projectStatusEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

export const PROJECT_STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  suspended: 'Suspended',
} as const;

export const getProjectStatusLabel = (status?: string): string => {
  if (!status) return 'Unknown';
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
