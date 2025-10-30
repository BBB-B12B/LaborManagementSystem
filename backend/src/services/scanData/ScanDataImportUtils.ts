import { parse, isValid as isValidDate } from 'date-fns';
import XLSX from 'xlsx';
import type {
  BulkImportRecord,
  ImportErrorEntry,
} from './ScanDataService';
import { AppError } from '../../api/middleware/errorHandler';

const DATE_FORMATS = [
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
  'dd/MM/yyyy HH:mm:ss',
  'dd/MM/yyyy HH:mm',
  'dd-MM-yyyy HH:mm:ss',
  'dd-MM-yyyy HH:mm',
  'yyyy/MM/dd HH:mm:ss',
  'yyyy/MM/dd HH:mm',
  'MM/dd/yyyy HH:mm:ss',
  'MM/dd/yyyy HH:mm',
  'yyyyMMddHHmmss',
  'ddMMyyyyHHmmss',
  'ddMMyyyyHHmm',
  'yyyyMMddHHmm',
];

export interface ParsedFileResult {
  records: BulkImportRecord[];
  errors: ImportErrorEntry[];
  warnings: string[];
  detectedHeader?: string[];
}

const HEADER_ALIASES = {
  employee: ['employee', 'employeenumber', 'employeeid', 'empid', 'empno', 'employee_no'],
  date: ['datetime', 'date', 'time', 'scantime', 'timestamp', 'scan_datetime'],
};

function normalizeHeader(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase().replace(/[\s_\-]/g, '');
}

function looksLikeHeader(value: string): boolean {
  const normalized = normalizeHeader(value);
  if (normalized.length === 0) {
    return false;
  }

  return (
    HEADER_ALIASES.employee.includes(normalized) ||
    HEADER_ALIASES.date.includes(normalized)
  );
}

function parseDateValue(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }

  if (typeof raw === 'number') {
    // Excel serial date support
    const parseDateCode = (XLSX.SSF as unknown as { parse_date_code?: (value: number) => any }).parse_date_code;
    const excelDate = parseDateCode ? parseDateCode(raw) : null;
    if (excelDate) {
      return new Date(
        excelDate.y,
        excelDate.m - 1,
        excelDate.d,
        excelDate.H,
        excelDate.M,
        excelDate.S
      );
    }

    if (raw > 10_000_000_000) {
      return new Date(raw);
    }

    return new Date(raw * 1000);
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length === 0) {
    return null;
  }

  for (const format of DATE_FORMATS) {
    const parsed = parse(value, format, new Date());
    if (isValidDate(parsed)) {
      return parsed;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

interface DatLineParseResult {
  employeeNumber: string;
  dateValue: string;
  extras: string[];
}

function parseDatLine(line: string): DatLineParseResult | null {
  const delimiter = line.includes(',')
    ? ','
    : line.includes('\t')
    ? '\t'
    : undefined;

  let tokens = delimiter
    ? line
        .split(delimiter)
        .flatMap((segment) => segment.split(/\s+/g))
    : line.split(/\s+/g);

  tokens = tokens
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length < 2) {
    return null;
  }

  const employeeToken = tokens[0].replace(/^\uFEFF/, '');
  const remainingTokens = tokens.slice(1);

  let dateValue = '';
  let extras: string[] = [];

  if (remainingTokens.length >= 2) {
    const maybeDate = remainingTokens[0];
    const maybeTime = remainingTokens[1];

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

    if (datePattern.test(maybeDate) && timePattern.test(maybeTime)) {
      dateValue = `${maybeDate} ${maybeTime}`;
      extras = remainingTokens.slice(2);
    }
  }

  if (!dateValue) {
    dateValue = remainingTokens.join(' ').trim();
    extras = [];
  }

  if (looksLikeHeader(employeeToken) || looksLikeHeader(dateValue)) {
    return null;
  }

  return {
    employeeNumber: employeeToken,
    dateValue,
    extras,
  };
}

export function parseDatFile(buffer: Buffer): ParsedFileResult {
  const content = buffer.toString('utf8');
  const lines = content.split(/\r?\n/);
  const records: BulkImportRecord[] = [];
  const errors: ImportErrorEntry[] = [];
  const warnings: string[] = [];

  lines.forEach((rawLine, index) => {
    const rowNumber = index + 1;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      return;
    }

    const parsed = parseDatLine(trimmed);
    if (!parsed) {
      if (rowNumber === 1) {
        warnings.push('ข้าม header ของไฟล์ .dat');
        return;
      }

      errors.push({
        row: rowNumber,
        error: 'รูปแบบไฟล์ไม่ถูกต้อง (ต้องมีรหัสพนักงานและวันที่)',
      });
      return;
    }

    const { employeeNumber, dateValue, extras } = parsed;

    if (!employeeNumber) {
      errors.push({
        row: rowNumber,
        error: 'รหัสพนักงานว่าง',
      });
      return;
    }

    const scanDateTime = parseDateValue(dateValue);
    if (!scanDateTime) {
      errors.push({
        row: rowNumber,
        employeeNumber,
        error: `ไม่สามารถอ่านเวลาสแกน "${dateValue}"`,
      });
      return;
    }

    records.push({
      rowNumber,
      employeeNumber,
      scanDateTime,
      rawLine,
      rawData: extras.length
        ? {
            extras,
          }
        : undefined,
    });
  });

  return {
    records,
    errors,
    warnings,
  };
}

export function parseExcelFile(buffer: Buffer): ParsedFileResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  if (!workbook.SheetNames.length) {
    throw new AppError('ไม่พบแผ่นงานในไฟล์ Excel', 400);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  if (!rows.length) {
    throw new AppError('ไฟล์ Excel ไม่มีข้อมูล', 400);
  }

  const headerRow = rows[0];
  const normalizedHeaders = headerRow.map((value) => normalizeHeader(value));

  const employeeIndex = normalizedHeaders.findIndex((value) =>
    HEADER_ALIASES.employee.includes(value)
  );
  const dateIndex = normalizedHeaders.findIndex((value) =>
    HEADER_ALIASES.date.includes(value)
  );

  if (employeeIndex === -1 || dateIndex === -1) {
    throw new AppError('ไม่พบคอลัมน์ EmployeeNumber หรือ Date ในไฟล์ Excel', 400);
  }

  const records: BulkImportRecord[] = [];
  const errors: ImportErrorEntry[] = [];
  const warnings: string[] = [];

  rows.slice(1).forEach((row, idx) => {
    const rowNumber = idx + 2;
    const employeeRaw = row[employeeIndex];
    const dateRaw = row[dateIndex];

    const employeeNumber = typeof employeeRaw === 'string' ? employeeRaw.trim() : `${employeeRaw ?? ''}`.trim();
    const dateValue = typeof dateRaw === 'string' ? dateRaw : dateRaw ?? '';

    if (!employeeNumber && !dateValue) {
      return;
    }

    if (!employeeNumber) {
      errors.push({
        row: rowNumber,
        error: 'รหัสพนักงานว่าง',
      });
      return;
    }

    const scanDateTime = parseDateValue(dateValue);
    if (!scanDateTime) {
      errors.push({
        row: rowNumber,
        employeeNumber,
        error: `ไม่สามารถอ่านเวลาสแกน "${dateValue}"`,
      });
      return;
    }

    records.push({
      rowNumber,
      employeeNumber,
      scanDateTime,
      rawData: {
        employeeNumber: employeeRaw,
        scanDateTime: dateRaw,
      },
    });
  });

  return {
    records,
    errors,
    warnings,
    detectedHeader: headerRow.map((cell) => (typeof cell === 'string' ? cell : `${cell ?? ''}`)),
  };
}

export function detectFileType(filename: string): 'dat' | 'excel' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.dat')) {
    return 'dat';
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return 'excel';
  }

  return null;
}
