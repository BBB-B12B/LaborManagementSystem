/**
 * Login Form Validation Schema
 * สคีมาการตรวจสอบฟอร์มเข้าสู่ระบบ
 *
 * Uses Zod for runtime validation
 */

import { z } from 'zod';

/**
 * Login form validation schema
 * - Username: required, min 3 characters
 * - Password: required, min 6 characters
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'กรุณากรอกชื่อผู้ใช้')
    .min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'),
  password: z
    .string()
    .min(1, 'กรุณากรอกรหัสผ่าน')
    .min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  rememberMe: z.boolean().optional().default(false),
});

/**
 * Login form data type
 */
export type LoginFormData = z.infer<typeof loginSchema>;

export default loginSchema;
