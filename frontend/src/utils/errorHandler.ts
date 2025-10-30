/**
 * Error Handler Utility
 * ฟังก์ชันจัดการ Error
 */

import { AxiosError } from 'axios';

/**
 * Error response type
 */
export interface ErrorResponse {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

/**
 * Handle axios error
 */
export const handleAxiosError = (error: AxiosError): ErrorResponse => {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const data: any = error.response.data;

    return {
      message: data.error || data.message || getErrorMessage(status),
      code: data.code,
      status,
      details: data.details,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์',
      code: 'NETWORK_ERROR',
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'เกิดข้อผิดพลาด',
      code: 'UNKNOWN_ERROR',
    };
  }
};

/**
 * Get error message by status code
 */
export const getErrorMessage = (status: number): string => {
  switch (status) {
    case 400:
      return 'ข้อมูลไม่ถูกต้อง';
    case 401:
      return 'กรุณาเข้าสู่ระบบใหม่';
    case 403:
      return 'ไม่มีสิทธิ์เข้าถึง';
    case 404:
      return 'ไม่พบข้อมูล';
    case 409:
      return 'ข้อมูลซ้ำ';
    case 422:
      return 'ข้อมูลไม่ถูกต้อง';
    case 500:
      return 'เซิร์ฟเวอร์ขัดข้อง';
    case 502:
      return 'เซิร์ฟเวอร์ไม่ตอบสนอง';
    case 503:
      return 'เซิร์ฟเวอร์ไม่พร้อมใช้งาน';
    default:
      return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
};

/**
 * Handle generic error
 */
export const handleError = (error: any): ErrorResponse => {
  if (error.isAxiosError) {
    return handleAxiosError(error);
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'ERROR',
    };
  }

  return {
    message: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ',
    code: 'UNKNOWN_ERROR',
  };
};

/**
 * Log error to console (development) or tracking service (production)
 */
export const logError = (error: any, context?: string): void => {
  const errorInfo = handleError(error);

  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', context || '', errorInfo, error);
  } else {
    // TODO: Send to error tracking service (e.g., Sentry)
    console.error('[Error]', context || '', errorInfo.message);
  }
};

/**
 * Show user-friendly error message
 */
export const getUserErrorMessage = (error: any): string => {
  const errorInfo = handleError(error);
  return errorInfo.message;
};
