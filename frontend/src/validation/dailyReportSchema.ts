/**
 * Daily Report Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มรายงานประจำวัน
 *
 * Validation for Daily Report forms (FR-DR)
 * Used in Daily Report and OT entry forms
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  baseDate,
  timeString,
  workTypeEnum,
  baseBoolean,
  nonEmptyArray,
  nonNegativeNumber,
  errorMessages,
  validateTimeRange,
} from './baseSchemas';

const baseDailyReportSchema = z.object({
  // Project & Workers
  projectLocationId: requiredString('โครงการ'),

  dailyContractorIds: nonEmptyArray(z.string(), 'แรงงานรายวัน'),

  // Work Details
  taskName: requiredString('งานที่ทำ')
    .min(2, errorMessages.minLength(2))
    .max(200, errorMessages.maxLength(200)),

  workDate: baseDate('วันที่ทำงาน'),

  // Time
  startTime: timeString,

  endTime: timeString,

  // Work Type
  workType: workTypeEnum.default('regular'),

  // Hours (calculated, but can be manually adjusted)
  totalHours: nonNegativeNumber('ชั่วโมงรวม').optional(),

  breakHours: nonNegativeNumber('ชั่วโมงพัก').default(0),

  netHours: nonNegativeNumber('ชั่วโมงสุทธิ').optional(),

  // Overnight flag (for OT that crosses midnight)
  isOvernight: baseBoolean.default(false),

  // Notes & Attachments
  notes: optionalString,

  fileAttachmentIds: z.array(z.string()).optional().default([]),
});

const withCommonRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (data) => {
        // Validate time range (end time must be after start time, unless overnight)
        if (data.isOvernight) return true;
        return validateTimeRange(data.startTime, data.endTime);
      },
      {
        message: errorMessages.endTimeBeforeStart,
        path: ['endTime'],
      }
    )
    .refine(
      (data) => {
        // Work date cannot be in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return data.workDate <= today;
      },
      {
        message: 'วันที่ทำงานต้องไม่เป็นวันในอนาคต',
        path: ['workDate'],
      }
    )
    .refine(
      (data) => {
        // FR-OT-006: OT periods cannot overlap with regular hours
        // Regular hours: 08:00-17:00 (with lunch 12:00-13:00)
        if (data.workType === 'regular') {
          // Regular work should be within business hours
          return true; // Allow any time for regular work
        }

        // OT Morning: 03:00-08:00
        if (data.workType === 'ot_morning') {
          const startHour = parseInt(data.startTime.split(':')[0], 10);
          const endHour = parseInt(data.endTime.split(':')[0], 10);
          return startHour >= 3 && endHour <= 8;
        }

        // OT Noon: 12:00-13:00 (lunch break)
        if (data.workType === 'ot_noon') {
          const startHour = parseInt(data.startTime.split(':')[0], 10);
          const endHour = parseInt(data.endTime.split(':')[0], 10);
          return startHour >= 12 && endHour <= 13;
        }

        // OT Evening: 17:00-24:00
        if (data.workType === 'ot_evening') {
          const startHour = parseInt(data.startTime.split(':')[0], 10);
          return startHour >= 17;
        }

        return true;
      },
      {
        message: 'ช่วงเวลาไม่ตรงกับประเภทงาน',
        path: ['startTime'],
      }
    );

/**
 * Daily Report create/edit schema
 * Used for regular working hours and OT entry
 */
export const dailyReportSchema = withCommonRefinements(baseDailyReportSchema);

/**
 * Multi-DC Daily Report schema
 * Used when creating reports for multiple DCs with same task
 * (FR-DR-004: Support multi-select for DC List)
 */
export const multiDCReportSchema = withCommonRefinements(
  baseDailyReportSchema.extend({
    dailyContractorIds: nonEmptyArray(z.string(), 'แรงงานรายวัน'),
  })
);

/**
 * OT validation schema
 * Additional validation for OT-specific rules
 */
export const otReportSchema = withCommonRefinements(
  baseDailyReportSchema.extend({
    workType: z.enum(['ot_morning', 'ot_noon', 'ot_evening'], {
      required_error: 'กรุณาเลือกช่วงเวลา OT',
    }),
  })
);

/**
 * Daily Report filter schema
 * Used for filtering reports in lists
 */
export const dailyReportFilterSchema = z.object({
  projectLocationId: z.string().optional(),
  dailyContractorId: z.string().optional(),
  workType: workTypeEnum.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  search: z.string().optional(),
});

/**
 * Work hours calculation validation
 * Ensures calculated hours are reasonable
 */
export const validateWorkHours = (hours: number, workType: string): boolean => {
  // Regular work: max 8 hours per day (after lunch deduction) - FR-SD-007
  if (workType === 'regular' && hours > 8) {
    return false;
  }

  // OT Morning: max 5 hours (03:00-08:00)
  if (workType === 'ot_morning' && hours > 5) {
    return false;
  }

  // OT Noon: max 1 hour (12:00-13:00)
  if (workType === 'ot_noon' && hours > 1) {
    return false;
  }

  // OT Evening: max 12 hours (reasonable limit for overnight)
  if (workType === 'ot_evening' && hours > 12) {
    return false;
  }

  // All work must be positive hours
  return hours > 0;
};

/**
 * Edit History validation
 * Used when viewing/filtering edit history
 */
export const editHistoryFilterSchema = z.object({
  dailyReportId: requiredString('รหัสรายงาน'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  editedBy: z.string().optional(),
});

/**
 * Type exports
 */
export type DailyReportInput = z.infer<typeof dailyReportSchema>;
export type DailyReportFormData = DailyReportInput;
export type MultiDCReportInput = z.infer<typeof multiDCReportSchema>;
export type DailyReportFilterInput = z.infer<typeof dailyReportFilterSchema>;
export type OTReportInput = z.infer<typeof otReportSchema>;
export type EditHistoryFilterInput = z.infer<typeof editHistoryFilterSchema>;

export default {
  dailyReportSchema,
  multiDCReportSchema,
  dailyReportFilterSchema,
  otReportSchema,
  editHistoryFilterSchema,
  validateWorkHours,
};
