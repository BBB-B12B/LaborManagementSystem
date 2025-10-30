/**
 * Form Validation Utilities
 * ฟังก์ชันช่วยตรวจสอบความถูกต้องของข้อมูล
 */

/**
 * Check if value is empty
 */
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Check if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if password meets requirements (min 8 characters)
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

/**
 * Check if employee ID is valid
 */
export const isValidEmployeeId = (id: string): boolean => {
  return /^\d+$/.test(id);
};

/**
 * Check if phone number is valid (Thai format)
 */
export const isValidThaiPhone = (phone: string): boolean => {
  // Thai phone: 10 digits starting with 0
  return /^0\d{9}$/.test(phone.replace(/[-\s]/g, ''));
};

/**
 * Check if time1 is before time2
 */
export const isTimeBefore = (time1: Date, time2: Date): boolean => {
  return time1.getTime() < time2.getTime();
};

/**
 * Check if time1 is after time2
 */
export const isTimeAfter = (time1: Date, time2: Date): boolean => {
  return time1.getTime() > time2.getTime();
};

/**
 * Validate time range (end > start)
 */
export const isValidTimeRange = (startTime: Date, endTime: Date): boolean => {
  return isTimeAfter(endTime, startTime);
};

/**
 * Check if number is in range
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Check if Employee ID starts with 9 (exempt from social security)
 */
export const isSocialSecurityExempt = (employeeId: string): boolean => {
  return employeeId.startsWith('9');
};

/**
 * Thai error messages
 */
export const errorMessages = {
  required: 'กรุณากรอกข้อมูล',
  invalidEmail: 'อีเมลไม่ถูกต้อง',
  invalidPassword: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  invalidPhone: 'เบอร์โทรศัพท์ไม่ถูกต้อง',
  invalidDate: 'วันที่ไม่ถูกต้อง',
  invalidTime: 'เวลาไม่ถูกต้อง',
  endTimeBeforeStart: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม',
  invalidNumber: 'ตัวเลขไม่ถูกต้อง',
  minLength: (min: number) => `ต้องมีความยาวอย่างน้อย ${min} ตัวอักษร`,
  maxLength: (max: number) => `ความยาวไม่เกิน ${max} ตัวอักษร`,
  minValue: (min: number) => `ค่าต่ำสุด ${min}`,
  maxValue: (max: number) => `ค่าสูงสุด ${max}`,
};
