/**
 * ScanData Validation Schemas
 * Schema สำหรับ validation ข้อมูล ScanData และ Discrepancy
 */

import { z } from 'zod';

// Scan Type Enum
export const ScanTypeEnum = z.enum([
  'ot_morning_in',
  'ot_morning_out',
  'regular_in',
  'late',
  'lunch_break',
  'regular_out',
  'ot_noon',
  'ot_evening_in',
  'ot_evening_out',
]);

export type ScanType = z.infer<typeof ScanTypeEnum>;

// Discrepancy Type Enum
export const DiscrepancyTypeEnum = z.enum(['Type1', 'Type2', 'Type3']);
export type DiscrepancyType = z.infer<typeof DiscrepancyTypeEnum>;

// Severity Enum
export const SeverityEnum = z.enum(['low', 'medium', 'high']);
export type Severity = z.infer<typeof SeverityEnum>;

// Status Enum
export const DiscrepancyStatusEnum = z.enum([
  'pending',
  'verified',
  'fixed',
  'ignored',
]);
export type DiscrepancyStatus = z.infer<typeof DiscrepancyStatusEnum>;

// Resolution Action Enum
export const ResolutionActionEnum = z.enum([
  'update_daily_report',
  'create_daily_report',
  'mark_verified',
  'ignore',
]);
export type ResolutionAction = z.infer<typeof ResolutionActionEnum>;

/**
 * ScanData Upload Schema
 * สำหรับ validate ไฟล์ ScanData (.dat หรือ Excel) ที่ upload
 */
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = ['.dat', '.xlsx', '.xls'];
const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/octet-stream',
  'text/plain',
];

const hasAllowedExtension = (fileName: string): boolean => {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const ScanDataUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_UPLOAD_SIZE_BYTES, {
      message: 'ขนาดไฟล์ต้องไม่เกิน 100MB',
    })
    .refine(
      (file) => {
        const mime = file.type?.toLowerCase() ?? '';
        return (
          ALLOWED_MIME_TYPES.includes(mime) ||
          hasAllowedExtension(file.name)
        );
      },
      {
        message: 'รองรับเฉพาะไฟล์ .dat, .xlsx หรือ .xls',
      }
    ),
  projectLocationId: z.string().min(1, 'กรุณาเลือกโครงการ'),
  importNote: z.string().optional(),
});

export type ScanDataUploadInput = z.infer<typeof ScanDataUploadSchema>;

/**
 * ScanData Row Schema (from Excel)
 * แต่ละ row ในไฟล์ Excel ต้องมีข้อมูลตามนี้
 */
export const ScanDataRowSchema = z.object({
  employeeNumber: z
    .string()
    .min(1, 'EmployeeNumber ต้องไม่ว่าง')
    .or(z.number().transform((n) => n.toString())),
  date: z.date({
    required_error: 'Date ต้องไม่ว่าง',
    invalid_type_error: 'Date ต้องเป็นวันที่ที่ถูกต้อง',
  }),
});

export type ScanDataRow = z.infer<typeof ScanDataRowSchema>;

/**
 * ScanData Import Request Schema
 * Request สำหรับ import scan data
 */
export const ScanDataImportRequestSchema = z.object({
  projectLocationId: z.string().min(1),
  data: z.array(ScanDataRowSchema).min(1, 'ต้องมีข้อมูลอย่างน้อย 1 รายการ'),
  importNote: z.string().optional(),
});

export type ScanDataImportRequest = z.infer<typeof ScanDataImportRequestSchema>;

/**
 * ScanData Filter Schema
 * สำหรับ filter scan data list
 */
export const ScanDataFilterSchema = z.object({
  projectLocationId: z.string().optional(),
  dailyContractorId: z.string().optional(),
  employeeNumber: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  scanType: ScanTypeEnum.optional(),
  hasDiscrepancy: z.boolean().optional(),
  importBatchId: z.string().optional(),
});

export type ScanDataFilter = z.infer<typeof ScanDataFilterSchema>;

/**
 * Discrepancy Filter Schema
 * สำหรับ filter discrepancy list
 */
export const DiscrepancyFilterSchema = z.object({
  projectLocationId: z.string().optional(),
  dailyContractorId: z.string().optional(),
  employeeNumber: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  discrepancyType: DiscrepancyTypeEnum.optional(),
  severity: SeverityEnum.optional(),
  status: DiscrepancyStatusEnum.optional(),
});

export type DiscrepancyFilter = z.infer<typeof DiscrepancyFilterSchema>;

/**
 * Resolve Discrepancy Schema
 * สำหรับแก้ไข discrepancy
 */
export const ResolveDiscrepancySchema = z.object({
  discrepancyId: z.string().min(1),
  resolutionAction: ResolutionActionEnum,
  resolutionNotes: z.string().optional(),
  newDailyReportData: z.any().optional(), // ถ้าเลือก create_daily_report หรือ update_daily_report
});

export type ResolveDiscrepancyInput = z.infer<typeof ResolveDiscrepancySchema>;

/**
 * Late Record Filter Schema
 */
export const LateRecordFilterSchema = z.object({
  projectLocationId: z.string().optional(),
  dailyContractorId: z.string().optional(),
  employeeNumber: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  wagePeriodId: z.string().optional(),
  includedInWageCalculation: z.boolean().optional(),
});

export type LateRecordFilter = z.infer<typeof LateRecordFilterSchema>;

/**
 * Validation helpers
 */

/**
 * ตรวจสอบว่าไฟล์ Excel มี columns ที่จำเป็นหรือไม่
 */
export function validateExcelColumns(headers: string[]): {
  isValid: boolean;
  missingColumns: string[];
} {
  const requiredColumns = ['EmployeeNumber', 'Date'];
  const normalizedHeaders = headers.map((h) =>
    h.trim().toLowerCase().replace(/[_\s]/g, '')
  );

  const missingColumns: string[] = [];

  for (const required of requiredColumns) {
    const normalized = required.toLowerCase().replace(/[_\s]/g, '');
    if (!normalizedHeaders.includes(normalized)) {
      missingColumns.push(required);
    }
  }

  return {
    isValid: missingColumns.length === 0,
    missingColumns,
  };
}

/**
 * แปลง scan type เป็นข้อความภาษาไทย
 */
export function getScanTypeLabel(scanType: ScanType): string {
  const labels: Record<ScanType, string> = {
    ot_morning_in: 'เข้า OT เช้า',
    ot_morning_out: 'ออก OT เช้า',
    regular_in: 'เข้างานปกติ',
    late: 'มาสาย',
    lunch_break: 'พักเที่ยง',
    regular_out: 'ออกงานปกติ',
    ot_noon: 'OT เที่ยง',
    ot_evening_in: 'เข้า OT เย็น',
    ot_evening_out: 'ออก OT เย็น',
  };
  return labels[scanType] || scanType;
}

/**
 * แปลง discrepancy type เป็นข้อความภาษาไทย
 */
export function getDiscrepancyTypeLabel(type: DiscrepancyType): string {
  const labels: Record<DiscrepancyType, string> = {
    Type1: 'Daily Report < ScanData',
    Type2: 'Daily Report มี แต่ ScanData ไม่มี',
    Type3: 'Daily Report ไม่มี แต่ ScanData มี',
  };
  return labels[type];
}

/**
 * แปลง severity เป็นสี
 */
export function getSeverityColor(severity: Severity): 'error' | 'warning' | 'info' {
  const colors: Record<Severity, 'error' | 'warning' | 'info'> = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  };
  return colors[severity];
}

/**
 * แปลง discrepancy type เป็นสี
 */
export function getDiscrepancyTypeColor(
  type: DiscrepancyType
): 'error' | 'warning' | 'info' {
  const colors: Record<DiscrepancyType, 'error' | 'warning' | 'info'> = {
    Type1: 'error', // แดง
    Type2: 'warning', // เหลือง
    Type3: 'warning', // ส้ม (ใช้ warning แทน)
  };
  return colors[type];
}
