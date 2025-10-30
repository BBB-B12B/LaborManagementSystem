/**
 * Project (ProjectLocation) Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มโครงการ
 *
 * Validation for Project/ProjectLocation forms (FR-P)
 * Used for project management CRUD operations
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  optionalDate,
  projectStatusEnum,
  baseBoolean,
  errorMessages,
  validateDateRange,
} from './baseSchemas';

/**
 * Project create/edit schema
 * Used for project management
 */
export const projectSchema = z
  .object({
    code: requiredString('รหัสโครงการ')
      .min(2, errorMessages.minLength(2))
      .max(20, errorMessages.maxLength(20))
      .regex(/^[A-Z0-9-]+$/, 'รหัสโครงการต้องเป็นตัวพิมพ์ใหญ่ ตัวเลข หรือ - เท่านั้น')
      .transform((val) => val.toUpperCase()),

    name: requiredString('ชื่อโครงการ')
      .min(3, errorMessages.minLength(3))
      .max(200, errorMessages.maxLength(200)),

    location: requiredString('ที่อยู่โครงการ')
      .min(5, errorMessages.minLength(5))
      .max(2000, errorMessages.maxLength(2000)),

    department: requiredString('สังกัด'),

    projectManager: optionalString,

    startDate: optionalDate,
    endDate: optionalDate,

    status: projectStatusEnum.default('active'),

    description: optionalString,

    isActive: baseBoolean.default(true),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return validateDateRange(data.startDate, data.endDate);
      }
      return true;
    },
    {
      message: errorMessages.endDateBeforeStart,
      path: ['endDate'],
    }
  );

export const projectFilterSchema = z.object({
  department: z.string().optional(),
  status: projectStatusEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

export const PROJECT_STATUS_LABELS = {
  active: 'ดำเนินการอยู่',
  completed: 'เสร็จสิ้น',
  suspended: 'ระงับชั่วคราว',
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
