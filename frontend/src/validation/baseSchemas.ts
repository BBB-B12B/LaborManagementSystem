/**
 * Base Validation Schemas
 * สคีมาการตรวจสอบพื้นฐาน
 *
 * Reusable Zod validation schemas with Thai error messages
 * Used across all form validation schemas
 */

import { z } from 'zod';

/**
 * Custom error messages in Thai
 */
export const errorMessages = {
  required: 'กรุณากรอกข้อมูล',
  requiredField: (field: string) => `กรุณากรอก${field}`,
  invalidEmail: 'อีเมลไม่ถูกต้อง',
  invalidPhone: 'เบอร์โทรศัพท์ไม่ถูกต้อง',
  invalidUrl: 'URL ไม่ถูกต้อง',
  invalidDate: 'วันที่ไม่ถูกต้อง',
  invalidTime: 'เวลาไม่ถูกต้อง',
  minLength: (min: number) => `ต้องมีความยาวอย่างน้อย ${min} ตัวอักษร`,
  maxLength: (max: number) => `ความยาวไม่เกิน ${max} ตัวอักษร`,
  minValue: (min: number) => `ค่าต่ำสุด ${min}`,
  maxValue: (max: number) => `ค่าสูงสุด ${max}`,
  mustBePositive: 'ต้องเป็นค่าบวก',
  mustBeNonNegative: 'ต้องเป็นค่าที่ไม่ติดลบ',
  invalidFormat: 'รูปแบบไม่ถูกต้อง',
  passwordMismatch: 'รหัสผ่านไม่ตรงกัน',
  passwordTooWeak: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  endTimeBeforeStart: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม',
  endDateBeforeStart: 'วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น',
  invalidSelection: 'กรุณาเลือกจากรายการ',
  duplicateValue: 'ข้อมูลซ้ำ',
  invalidThaiId: 'เลขบัตรประชาชนไม่ถูกต้อง',
};

/**
 * Base string schema with Thai error messages
 */
export const baseString = (fieldName?: string) =>
  z.string({
    required_error: fieldName ? errorMessages.requiredField(fieldName) : errorMessages.required,
    invalid_type_error: errorMessages.invalidFormat,
  });

/**
 * Optional string (can be empty or undefined)
 */
export const optionalString = z.string().optional().nullable();

/**
 * Required non-empty string
 */
export const requiredString = (fieldName?: string) =>
  baseString(fieldName).min(1, fieldName ? errorMessages.requiredField(fieldName) : errorMessages.required);

/**
 * String with min/max length
 */
export const stringWithLength = (min: number, max: number, fieldName?: string) =>
  requiredString(fieldName)
    .min(min, errorMessages.minLength(min))
    .max(max, errorMessages.maxLength(max));

/**
 * Email validation
 */
export const email = requiredString('อีเมล').email(errorMessages.invalidEmail);

/**
 * Thai phone number validation (10 digits starting with 0)
 */
export const thaiPhone = requiredString('เบอร์โทรศัพท์')
  .regex(/^0[0-9]{9}$/, errorMessages.invalidPhone);

/**
 * Optional Thai phone number
 */
export const optionalThaiPhone = z
  .string()
  .regex(/^0[0-9]{9}$/, errorMessages.invalidPhone)
  .optional()
  .nullable();

/**
 * Thai ID card number validation (13 digits)
 */
export const thaiIdCard = requiredString('เลขบัตรประชาชน')
  .length(13, 'เลขบัตรประชาชนต้องมี 13 หลัก')
  .regex(/^[0-9]{13}$/, errorMessages.invalidThaiId);

/**
 * Optional Thai ID card number
 */
export const optionalThaiIdCard = z
  .string()
  .length(13, 'เลขบัตรประชาชนต้องมี 13 หลัก')
  .regex(/^[0-9]{13}$/, errorMessages.invalidThaiId)
  .optional()
  .nullable();

/**
 * Password validation (min 6 characters)
 */
export const password = requiredString('รหัสผ่าน').min(6, errorMessages.passwordTooWeak);

/**
 * Strong password validation (min 8 characters, contains letter and number)
 */
export const strongPassword = requiredString('รหัสผ่าน')
  .min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
  .regex(/^[A-Za-z]+$/, 'รหัสผ่านต้องเป็นตัวอักษรภาษาอังกฤษเท่านั้น');

/**
 * Username validation (alphanumeric, 3-20 characters, no spaces)
 */
export const username = requiredString('ชื่อผู้ใช้')
  .min(3, errorMessages.minLength(3))
  .max(20, errorMessages.maxLength(20))
  .regex(/^[a-zA-Z0-9_.]+$/, 'ชื่อผู้ใช้ต้องเป็นตัวอักษร ตัวเลข _ หรือ . เท่านั้น');

/**
 * URL validation
 */
export const url = requiredString('URL').url(errorMessages.invalidUrl);

/**
 * Optional URL
 */
export const optionalUrl = z.string().url(errorMessages.invalidUrl).optional().nullable();

/**
 * Number schema with Thai error messages
 */
export const baseNumber = (fieldName?: string) =>
  z.number({
    required_error: fieldName ? errorMessages.requiredField(fieldName) : errorMessages.required,
    invalid_type_error: 'ต้องเป็นตัวเลข',
  });

/**
 * Required positive number
 */
export const positiveNumber = (fieldName?: string) =>
  baseNumber(fieldName).positive(errorMessages.mustBePositive);

/**
 * Required non-negative number (includes 0)
 */
export const nonNegativeNumber = (fieldName?: string) =>
  baseNumber(fieldName).nonnegative(errorMessages.mustBeNonNegative);

/**
 * Optional number
 */
export const optionalNumber = z.number().optional().nullable();

/**
 * Number with min/max
 */
export const numberWithRange = (min: number, max: number, fieldName?: string) =>
  baseNumber(fieldName)
    .min(min, errorMessages.minValue(min))
    .max(max, errorMessages.maxValue(max));

/**
 * Date schema with Thai error messages
 */
export const baseDate = (fieldName?: string) =>
  z.date({
    required_error: fieldName ? errorMessages.requiredField(fieldName) : errorMessages.required,
    invalid_type_error: errorMessages.invalidDate,
  });

/**
 * Optional date
 */
export const optionalDate = z.date().optional().nullable();

/**
 * Past date (must be before today)
 */
export const pastDate = (fieldName?: string) =>
  baseDate(fieldName).refine((date) => date < new Date(), {
    message: 'วันที่ต้องเป็นวันในอดีต',
  });

/**
 * Future date (must be after today)
 */
export const futureDate = (fieldName?: string) =>
  baseDate(fieldName).refine((date) => date > new Date(), {
    message: 'วันที่ต้องเป็นวันในอนาคต',
  });

/**
 * Time string validation (HH:mm format)
 */
export const timeString = requiredString('เวลา').regex(
  /^([01]\d|2[0-3]):([0-5]\d)$/,
  errorMessages.invalidTime
);

/**
 * Optional time string
 */
export const optionalTimeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, errorMessages.invalidTime)
  .optional()
  .nullable();

/**
 * Boolean schema
 */
export const baseBoolean = z.boolean({
  required_error: errorMessages.required,
  invalid_type_error: 'ต้องเป็นค่า true หรือ false',
});

/**
 * Optional boolean
 */
export const optionalBoolean = z.boolean().optional().nullable();

/**
 * Enum validation
 */
export const createEnum = <T extends [string, ...string[]]>(
  values: T,
  fieldName?: string
) =>
  z.enum(values, {
    required_error: fieldName ? errorMessages.requiredField(fieldName) : errorMessages.required,
    invalid_type_error: errorMessages.invalidSelection,
  });

/**
 * Array validation
 */
export const baseArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema, {
    required_error: errorMessages.required,
    invalid_type_error: 'ต้องเป็นรายการ',
  });

/**
 * Non-empty array
 */
export const nonEmptyArray = <T extends z.ZodTypeAny>(schema: T, fieldName?: string) =>
  baseArray(schema).min(1, fieldName ? `กรุณาเลือก${fieldName}อย่างน้อย 1 รายการ` : 'กรุณาเลือกอย่างน้อย 1 รายการ');

/**
 * Department enum (PD01-PD05)
 */
export const departmentEnum = createEnum(['PD01', 'PD02', 'PD03', 'PD04', 'PD05'], 'สังกัด');

/**
 * Role enum (8 roles)
 */
export const roleEnum = createEnum(['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'], 'บทบาท');

/**
 * Project status enum (Thai values)
 */
export const PROJECT_STATUS_VALUES = ['กำลังดำเนินการอยู่', 'ระงับชั่วคราว', 'ปิดโครงการ'] as const;
export const projectStatusEnum = createEnum(
  PROJECT_STATUS_VALUES as unknown as string[],
  'สถานะโครงการ'
);

/**
 * Work type enum
 */
export const workTypeEnum = createEnum(
  ['regular', 'ot_morning', 'ot_noon', 'ot_evening'],
  'ประเภทงาน'
);

/**
 * Date range validation
 * Ensures end date is after start date
 */
export const validateDateRange = (
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
): boolean => {
  if (!startDate || !endDate) return true; // Skip validation if dates not provided
  return endDate > startDate;
};

/**
 * Time range validation
 * Ensures end time is after start time
 */
export const validateTimeRange = (
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean => {
  if (!startTime || !endTime) return true; // Skip validation if times not provided
  return endTime > startTime;
};

/**
 * Helper: Convert empty string to null
 * Useful for optional fields
 */
export const emptyStringToNull = z.preprocess((val) => {
  if (typeof val === 'string' && val.trim() === '') return null;
  return val;
}, z.string().nullable());

/**
 * Helper: Convert string to number
 */
export const stringToNumber = z.preprocess((val) => {
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
}, z.number());

/**
 * Helper: Convert string to date
 */
export const stringToDate = z.preprocess((val) => {
  if (typeof val === 'string') {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? val : parsed;
  }
  return val;
}, z.date());

export default {
  errorMessages,
  baseString,
  requiredString,
  optionalString,
  stringWithLength,
  email,
  thaiPhone,
  optionalThaiPhone,
  thaiIdCard,
  optionalThaiIdCard,
  password,
  strongPassword,
  username,
  url,
  optionalUrl,
  baseNumber,
  positiveNumber,
  nonNegativeNumber,
  optionalNumber,
  numberWithRange,
  baseDate,
  optionalDate,
  pastDate,
  futureDate,
  timeString,
  optionalTimeString,
  baseBoolean,
  optionalBoolean,
  createEnum,
  baseArray,
  nonEmptyArray,
  departmentEnum,
  roleEnum,
  PROJECT_STATUS_VALUES,
  projectStatusEnum,
  workTypeEnum,
  validateDateRange,
  validateTimeRange,
  emptyStringToNull,
  stringToNumber,
  stringToDate,
};
