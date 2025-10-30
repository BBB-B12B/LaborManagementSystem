/**
 * Wage Calculation Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มคำนวณค่าแรง
 *
 * Validation for Wage Calculation forms (FR-WC)
 * Used in Wage Period creation and management
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  baseDate,
  positiveNumber,
  nonNegativeNumber,
  errorMessages,
} from './baseSchemas';

/**
 * Validate 15-day period
 * FR-WC-001: Wage period must be exactly 15 days
 */
export function validate15DayPeriod(startDate: Date, endDate: Date): boolean {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 15;
}

/**
 * Wage period creation schema
 * Used when creating a new wage period
 */
export const wagePeriodCreateSchema = z
  .object({
    // Project selection
    projectLocationId: requiredString('โครงการ'),

    // Period dates
    startDate: baseDate('วันที่เริ่มต้นงวด')
      .refine(
        (date) => date <= new Date(),
        'วันที่เริ่มต้นต้องไม่เกินวันปัจจุบัน'
      ),

    endDate: baseDate('วันที่สิ้นสุดงวด')
      .refine(
        (date) => date <= new Date(),
        'วันที่สิ้นสุดต้องไม่เกินวันปัจจุบัน'
      ),

    // Notes
    notes: optionalString,
  })
  .refine(
    (data) => data.endDate > data.startDate,
    {
      message: 'วันที่สิ้นสุดต้องมาหลังวันที่เริ่มต้น',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => validate15DayPeriod(data.startDate, data.endDate),
    {
      message: 'งวดค่าแรงต้องเป็น 15 วันพอดี (FR-WC-001)',
      path: ['endDate'],
    }
  );

/**
 * Additional Income schema
 * Used for adding extra income to DC in a wage period
 */
export const additionalIncomeSchema = z.object({
  dailyContractorId: requiredString('แรงงานรายวัน'),

  wagePeriodId: requiredString('งวดค่าแรง'),

  description: requiredString('รายละเอียด')
    .min(2, errorMessages.minLength(2))
    .max(200, errorMessages.maxLength(200)),

  amount: positiveNumber('จำนวนเงิน')
    .max(50000, 'รายได้พิเศษสูงสุด 50,000 บาท'),

  date: baseDate('วันที่'),
});

/**
 * Additional Expense schema
 * Used for adding extra expenses to DC in a wage period
 */
export const additionalExpenseSchema = z.object({
  dailyContractorId: requiredString('แรงงานรายวัน'),

  wagePeriodId: requiredString('งวดค่าแรง'),

  description: requiredString('รายละเอียด')
    .min(2, errorMessages.minLength(2))
    .max(200, errorMessages.maxLength(200)),

  amount: positiveNumber('จำนวนเงิน')
    .max(50000, 'รายจ่ายพิเศษสูงสุด 50,000 บาท'),

  date: baseDate('วันที่'),
});

/**
 * DC Income Details schema
 * Used for setting wage rates for DC
 */
export const dcIncomeDetailsSchema = z.object({
  dailyContractorId: requiredString('แรงงานรายวัน'),

  hourlyRate: positiveNumber('ค่าแรงต่อชั่วโมง')
    .min(50, 'ค่าแรงต่ำสุด 50 บาท')
    .max(1000, 'ค่าแรงสูงสุด 1,000 บาท'),

  professionalRate: nonNegativeNumber('ค่าวิชาชีพ')
    .max(500, 'ค่าวิชาชีพสูงสุด 500 บาท'),

  phoneAllowancePerPeriod: nonNegativeNumber('ค่าโทรศัพท์ต่องวด')
    .max(500, 'ค่าโทรศัพท์สูงสุด 500 บาท'),

  effectiveDate: baseDate('วันที่มีผลบังคับใช้'),
});

/**
 * DC Expense Details schema
 * Used for setting expense rates for DC
 */
export const dcExpenseDetailsSchema = z.object({
  dailyContractorId: requiredString('แรงงานรายวัน'),

  accommodationCostPerPeriod: nonNegativeNumber('ค่าที่พักต่องวด')
    .max(5000, 'ค่าที่พักสูงสุด 5,000 บาท'),

  followerCount: nonNegativeNumber('จำนวนผู้ติดตาม')
    .int('ต้องเป็นจำนวนเต็ม')
    .max(10, 'ผู้ติดตามสูงสุด 10 คน'),

  refrigeratorCostPerPeriod: nonNegativeNumber('ค่าตู้เย็นต่องวด')
    .max(500, 'ค่าตู้เย็นสูงสุด 500 บาท'),

  soundSystemCostPerPeriod: nonNegativeNumber('ค่าเครื่องเสียงต่องวด')
    .max(500, 'ค่าเครื่องเสียงสูงสุด 500 บาท'),

  tvCostPerPeriod: nonNegativeNumber('ค่าทีวีต่องวด')
    .max(500, 'ค่าทีวีสูงสุด 500 บาท'),

  washingMachineCostPerPeriod: nonNegativeNumber('ค่าเครื่องซักผ้าต่องวด')
    .max(500, 'ค่าเครื่องซักผ้าสูงสุด 500 บาท'),

  portableAcCostPerPeriod: nonNegativeNumber('ค่าแอร์เคลื่อนที่ต่องวด')
    .max(1000, 'ค่าแอร์เคลื่อนที่สูงสุด 1,000 บาท'),

  effectiveDate: baseDate('วันที่มีผลบังคับใช้'),
});

/**
 * Wage period filter schema
 * Used for filtering wage periods
 */
export const wagePeriodFilterSchema = z.object({
  projectLocationId: z.string().optional(),
  status: z.enum(['draft', 'calculated', 'approved', 'paid', 'locked']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

/**
 * Type exports
 */
export type WagePeriodCreateInput = z.infer<typeof wagePeriodCreateSchema>;
export type AdditionalIncomeInput = z.infer<typeof additionalIncomeSchema>;
export type AdditionalExpenseInput = z.infer<typeof additionalExpenseSchema>;
export type DCIncomeDetailsInput = z.infer<typeof dcIncomeDetailsSchema>;
export type DCExpenseDetailsInput = z.infer<typeof dcExpenseDetailsSchema>;
export type WagePeriodFilterInput = z.infer<typeof wagePeriodFilterSchema>;

export default {
  wagePeriodCreateSchema,
  additionalIncomeSchema,
  additionalExpenseSchema,
  dcIncomeDetailsSchema,
  dcExpenseDetailsSchema,
  wagePeriodFilterSchema,
  validate15DayPeriod,
};
