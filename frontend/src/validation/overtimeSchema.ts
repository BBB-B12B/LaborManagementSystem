/**
 * Overtime (OT) Form Validation Schema
 * สคีมาการตรวจสอบฟอร์ม OT
 *
 * Validation for Overtime entry forms (FR-OT)
 * Supports 3 OT periods: Morning, Noon, Evening
 * OT wage calculation: 1.5x base rate
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  baseDate,
  timeString,
  baseBoolean,
  nonEmptyArray,
  nonNegativeNumber,
  positiveNumber,
  errorMessages,
  validateTimeRange,
} from './baseSchemas';

/**
 * OT Period Enum
 * - morning: 03:00-08:00 (OT เช้า)
 * - noon: 12:00-13:00 (OT เที่ยง)
 * - evening: 17:00-22:00+ (OT เย็น)
 */
export const otPeriodEnum = z.enum(['morning', 'noon', 'evening'], {
  required_error: 'กรุณาเลือกช่วงเวลา OT',
  invalid_type_error: 'ช่วงเวลา OT ไม่ถูกต้อง',
});

/**
 * OT Period Time Ranges
 * Used for validation and display
 */
export const OT_PERIODS = {
  morning: {
    start: '03:00',
    end: '08:00',
    label: 'OT เช้า',
    description: '03:00 - 08:00',
  },
  noon: {
    start: '12:00',
    end: '13:00',
    label: 'OT เที่ยง',
    description: '12:00 - 13:00',
  },
  evening: {
    start: '17:00',
    end: '22:00',
    label: 'OT เย็น',
    description: '17:00 - 22:00+',
  },
} as const;

/**
 * Overtime create/edit schema
 * Used for OT entry in 3 time periods
 */
export const overtimeSchema = z
  .object({
    // Project & Workers
    projectLocationId: requiredString('โครงการ'),

    dailyContractorIds: nonEmptyArray(z.string(), 'แรงงานรายวัน'),

    // Work Details
    workDescription: requiredString('งาน')
      .min(2, errorMessages.minLength(2))
      .max(200, errorMessages.maxLength(200)),

    reportDate: baseDate('วันที่'),

    // OT Period
    otPeriod: otPeriodEnum,

    // Time
    startTime: timeString,

    endTime: timeString,

    // Work Hours (calculated, but can be manually adjusted)
    workHours: positiveNumber('ชั่วโมง OT'),

    // Wage (auto-calculated: hourlyRate * 1.5 * hours + professionalRate)
    totalWage: nonNegativeNumber('ค่าแรง OT'),

    // Overnight flag (for OT that crosses midnight)
    isOvernight: baseBoolean.default(false),

    // Notes & Attachments
    notes: optionalString,

    imageUrls: z.array(z.string()).optional().default([]),
  })
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
      // Report date cannot be in the future
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return data.reportDate <= today;
    },
    {
      message: 'วันที่ OT ต้องไม่เป็นวันในอนาคต',
      path: ['reportDate'],
    }
  )
  .refine(
    (data) => {
      // FR-OT-002: Validate time range for each OT period
      const startHour = parseInt(data.startTime.split(':')[0]);
      const endHour = parseInt(data.endTime.split(':')[0]);
      const endMinute = parseInt(data.endTime.split(':')[1]);

      // OT Morning: 03:00-08:00
      if (data.otPeriod === 'morning') {
        // Allow overnight (crossing midnight from previous day)
        if (data.isOvernight) return true;
        return startHour >= 3 && endHour <= 8;
      }

      // OT Noon: 12:00-13:00 (strict)
      if (data.otPeriod === 'noon') {
        return startHour >= 12 && (endHour < 13 || (endHour === 13 && endMinute === 0));
      }

      // OT Evening: 17:00-24:00+ (can cross midnight)
      if (data.otPeriod === 'evening') {
        return startHour >= 17 || data.isOvernight;
      }

      return true;
    },
    {
      message: 'เวลาต้องอยู่ในช่วง OT ที่เลือก',
      path: ['startTime'],
    }
  )
  .refine(
    (data) => {
      // FR-OT-003: Validate maximum OT hours per period
      const maxHours = {
        morning: 5, // 03:00-08:00 = 5 hours max
        noon: 1, // 12:00-13:00 = 1 hour max
        evening: 12, // 17:00-05:00 = 12 hours max (overnight)
      };

      return data.workHours <= maxHours[data.otPeriod];
    },
    {
      message: 'ชั่วโมง OT เกินกว่าที่กำหนดสำหรับช่วงเวลานี้',
      path: ['workHours'],
    }
  );

/**
 * OT filter schema
 * Used for filtering OT records in lists
 */
export const overtimeFilterSchema = z.object({
  projectLocationId: z.string().optional(),
  dailyContractorId: z.string().optional(),
  otPeriod: otPeriodEnum.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  search: z.string().optional(),
});

/**
 * OT rate calculation validator
 * Ensures OT wage = baseRate * 1.5 * hours + professionalRate
 */
export const validateOTWage = (
  hourlyRate: number,
  professionalRate: number,
  hours: number,
  calculatedWage: number
): boolean => {
  const expectedWage = hourlyRate * 1.5 * hours + professionalRate;
  // Allow small floating point differences (< 1 baht)
  return Math.abs(calculatedWage - expectedWage) < 1;
};

/**
 * OT hours calculation validator
 * Ensures hours are reasonable for the period
 */
export const validateOTHours = (
  startTime: string,
  endTime: string,
  otPeriod: 'morning' | 'noon' | 'evening',
  isOvernight: boolean
): { isValid: boolean; calculatedHours: number } => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // Handle overnight
  if (isOvernight && endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }

  const calculatedHours = (endMinutes - startMinutes) / 60;

  // Validate max hours per period
  const maxHours = {
    morning: 5,
    noon: 1,
    evening: 12,
  };

  return {
    isValid: calculatedHours > 0 && calculatedHours <= maxHours[otPeriod],
    calculatedHours: Math.round(calculatedHours * 10) / 10, // Round to 1 decimal
  };
};

/**
 * Get OT period label in Thai
 */
export const getOTPeriodLabel = (period: 'morning' | 'noon' | 'evening'): string => {
  return OT_PERIODS[period].label;
};

/**
 * Get OT period time range
 */
export const getOTPeriodRange = (period: 'morning' | 'noon' | 'evening'): { start: string; end: string } => {
  return {
    start: OT_PERIODS[period].start,
    end: OT_PERIODS[period].end,
  };
};

/**
 * Type exports
 */
export type OvertimeFormData = z.infer<typeof overtimeSchema>;
export type OvertimeFilterData = z.infer<typeof overtimeFilterSchema>;
export type OTPeriod = z.infer<typeof otPeriodEnum>;

export default {
  overtimeSchema,
  overtimeFilterSchema,
  otPeriodEnum,
  OT_PERIODS,
  validateOTWage,
  validateOTHours,
  getOTPeriodLabel,
  getOTPeriodRange,
};
