/**
 * Daily Contractor (DC) Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มแรงงานรายวัน
 *
 * Validation for DC Management forms (FR-DC)
 * Used in DC create/edit forms and wage details
 */

import { z } from 'zod';
import {
  requiredString,
  optionalString,
  username,
  password,
  thaiPhone,
  optionalThaiPhone,
  thaiIdCard,
  optionalThaiIdCard,
  optionalDate,
  pastDate,
  baseBoolean,
  baseArray,
  positiveNumber,
  nonNegativeNumber,
  errorMessages,
  validateDateRange,
} from './baseSchemas';

/**
 * DC create schema
 * Used when creating a new Daily Contractor
 */
const optionalText = (min: number, max: number) =>
  z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      }
      return val ?? undefined;
    },
    z
      .string()
      .min(min, errorMessages.minLength(min))
      .max(max, errorMessages.maxLength(max))
      .optional()
  );

const optionalEmployeeId = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim().toUpperCase();
      return trimmed.length === 0 ? undefined : trimmed;
    }
    return val ?? undefined;
  },
  z
    .string()
    .min(3, errorMessages.minLength(3))
    .max(20, errorMessages.maxLength(20))
    .regex(/^[A-Z0-9-]+$/, 'รหัสพนักงานต้องเป็นตัวพิมพ์ใหญ่และตัวเลขเท่านั้น')
    .optional()
);

export const dcCreateSchema = z
  .object({
    // Basic Info
    employeeId: optionalEmployeeId,

    name: optionalText(2, 100),

    // Optional login credentials
    username: username.optional().nullable(),

    password: password.optional().nullable(),

    // Skill (Position)
    skillId: optionalText(1, 100),

    dateOfBirth: optionalDate,

    // Employment
    startDate: optionalDate,

    // Project Access
    projectLocationId: optionalText(1, 100),

    // Status
    isActive: baseBoolean.default(true),

    // T-230:  // Income Details
    dailyWageRate: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าแรงต่อวัน').default(0)
    ),
    professionalRate: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าวิชาชีพ').default(0)
    ),
    phoneAllowance: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าโทรศัพท์').default(0)
    ),
    allowance: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('เบี้ยเลี้ยง').default(0)
    ),
    mouDeductionRate: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าหัก MOU').default(0)
    ),

    // T-240: Detailed Financial Fields
    otherIncome: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('รายได้อื่นๆ').default(0)
    ),
    housingFee: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าห้องพัก').default(0)
    ),
    followerCount: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('จำนวนผู้ติดตาม').int().default(0)
    ),
    refrigeratorFee: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าตู้เย็น').default(0)
    ),
    soundSystemFee: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าเครื่องเสียง').default(0)
    ),
    tvFee: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าทีวี').default(0)
    ),
    laundryFee: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าเครื่องซักผ้า').default(0)
    ),
    airConFee: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าแอร์เคลื่อนที่').default(0)
    ),
    otherDeduction: z.preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      nonNegativeNumber('ค่าอื่นๆ').default(0)
    ),
  })
  .refine(
    (data) => {
      // If username is provided, password must also be provided
      if (data.username && !data.password) {
        return false;
      }
      return true;
    },
    {
      message: 'กรุณากรอกรหัสผ่าน',
      path: ['password'],
    }
  );

/**
 * DC edit schema
 * Used when editing existing DC
 */
export const dcEditSchema = z.object({
  // Basic Info
  employeeId: optionalEmployeeId,

  name: optionalText(2, 100),

  // Optional login credentials
  username: username.optional().nullable(),

  password: password.optional().nullable(),

  // Skill (Position)
  skillId: optionalText(1, 100),

  dateOfBirth: optionalDate,

  // Employment
  startDate: optionalDate,

  // Project Access
  projectLocationId: optionalText(1, 100),

  // Status
  isActive: baseBoolean.optional(),

  // T-230:  // Income Details
  dailyWageRate: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าแรงต่อวัน').optional()
  ),
  professionalRate: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าวิชาชีพ').optional()
  ),
  phoneAllowance: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าโทรศัพท์').optional()
  ),
  allowance: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('เบี้ยเลี้ยง').optional()
  ),
  mouDeductionRate: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าหัก MOU').optional()
  ),

  // T-240: Detailed Financial Fields
  otherIncome: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('รายได้อื่นๆ').optional()
  ),
  housingFee: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าห้องพัก').optional()
  ),
  followerCount: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('จำนวนผู้ติดตาม').int().optional()
  ),
  refrigeratorFee: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าตู้เย็น').optional()
  ),
  soundSystemFee: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าเครื่องเสียง').optional()
  ),
  tvFee: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าทีวี').optional()
  ),
  laundryFee: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าเครื่องซักผ้า').optional()
  ),
  airConFee: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าแอร์เคลื่อนที่').optional()
  ),
  otherDeduction: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    nonNegativeNumber('ค่าอื่นๆ').optional()
  ),
});

/**
 * DC Income Details schema
 * Used for setting wage rates
 */
export const dcIncomeDetailsSchema = z.object({
  dailyContractorId: requiredString('แรงงานรายวัน'),

  hourlyRate: positiveNumber('ค่าแรงต่อชั่วโมง')
    .min(50, 'ค่าแรงต่ำสุด 50 บาท')
    .max(1000, 'ค่าแรงสูงสุด 1,000 บาท'),

  // OT rate is auto-calculated as hourlyRate * 1.5
  otHourlyRate: positiveNumber('ค่าแรงโอที').optional(),

  professionalRate: nonNegativeNumber('ค่าวิชาชีพ').max(500, 'ค่าวิชาชีพสูงสุด 500 บาท'),

  phoneAllowancePerPeriod: nonNegativeNumber('ค่าโทรศัพท์').max(500, 'ค่าโทรศัพท์สูงสุด 500 บาท'),

  effectiveDate: baseBoolean.optional(),
});

/**
 * DC Expense Details schema
 * Used for setting expense rates
 */
export const dcExpenseDetailsSchema = z.object({
  dailyContractorId: requiredString('แรงงานรายวัน'),

  accommodationCostPerPeriod: nonNegativeNumber('ค่าที่พัก').max(5000, 'ค่าที่พักสูงสุด 5,000 บาท'),

  followerCount: nonNegativeNumber('จำนวนผู้ติดตาม')
    .int('ต้องเป็นจำนวนเต็ม')
    .max(10, 'ผู้ติดตามสูงสุด 10 คน'),

  // Follower accommodation = followerCount * 300 (auto-calculated)
  followerAccommodationPerPeriod: nonNegativeNumber('ค่าที่พักผู้ติดตาม').optional(),

  refrigeratorCostPerPeriod: nonNegativeNumber('ค่าตู้เย็น').max(500, 'ค่าตู้เย็นสูงสุด 500 บาท'),

  soundSystemCostPerPeriod: nonNegativeNumber('ค่าเครื่องเสียง').max(
    500,
    'ค่าเครื่องเสียงสูงสุด 500 บาท'
  ),

  tvCostPerPeriod: nonNegativeNumber('ค่าทีวี').max(500, 'ค่าทีวีสูงสุด 500 บาท'),

  washingMachineCostPerPeriod: nonNegativeNumber('ค่าเครื่องซักผ้า').max(
    500,
    'ค่าเครื่องซักผ้าสูงสุด 500 บาท'
  ),

  portableAcCostPerPeriod: nonNegativeNumber('ค่าแอร์เคลื่อนที่').max(
    1000,
    'ค่าแอร์เคลื่อนที่สูงสุด 1,000 บาท'
  ),

  effectiveDate: baseBoolean.optional(),
});

/**
 * DC filter schema
 * Used for filtering DCs in lists
 */
export const dcFilterSchema = z.object({
  search: optionalString,
  skillId: z.string().optional(),
  projectLocationId: z.string().optional(),
  isActive: z.boolean().optional(),
  hasWageDetails: z.boolean().optional(), // Filter DCs with/without wage details
});

/**
 * Validate DC employee ID uniqueness
 */
export const validateDCEmployeeIdUnique = async (
  employeeId: string,
  excludeId?: string
): Promise<boolean> => {
  // TODO: Implement API call to check uniqueness
  // const response = await api.get('/daily-contractors/check-employee-id', {
  //   params: { employeeId, excludeId }
  // });
  // return response.data.isUnique;
  return true; // Placeholder
};

/**
 * Type exports
 */
export type DCCreateInput = z.infer<typeof dcCreateSchema>;
export type DCEditInput = z.infer<typeof dcEditSchema>;
export type DCIncomeDetailsInput = z.infer<typeof dcIncomeDetailsSchema>;
export type DCExpenseDetailsInput = z.infer<typeof dcExpenseDetailsSchema>;
export type DCFilterInput = z.infer<typeof dcFilterSchema>;

export default {
  dcCreateSchema,
  dcEditSchema,
  dcIncomeDetailsSchema,
  dcExpenseDetailsSchema,
  dcFilterSchema,
  validateDCEmployeeIdUnique,
};
