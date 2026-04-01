import { parse, isValid as isValidDate } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import XLSX from 'xlsx';
import type {
  BulkImportRecord,
  ImportErrorEntry,
} from './ScanDataService';
import { AppError } from '../../api/middleware/errorHandler';

const DATE_FORMATS = [
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd H:mm:ss',
  'yyyy-MM-dd HH:mm',
  'yyyy-MM-dd H:mm',
  'dd/MM/yyyy HH:mm:ss',
  'dd/MM/yyyy H:mm:ss',
  'dd/MM/yyyy HH:mm',
  'dd/MM/yyyy H:mm',
  'dd-MM-yyyy HH:mm:ss',
  'dd-MM-yyyy H:mm:ss',
  'dd-MM-yyyy HH:mm',
  'dd-MM-yyyy H:mm',
  'yyyy/MM/dd HH:mm:ss',
  'yyyy/MM/dd H:mm:ss',
  'yyyy/MM/dd HH:mm',
  'yyyy/MM/dd H:mm',
  'MM/dd/yyyy HH:mm:ss',
  'MM/dd/yyyy H:mm:ss',
  'MM/dd/yyyy HH:mm',
  'MM/dd/yyyy H:mm',
  'ddMMyyyyHHmmss',
  'ddMMyyyyHHmm',
  'yyyyMMddHHmmss',
  'yyyyMMddHHmm',

  // Date only formats (Standard)
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'yyyy/MM/dd',
  'MM/dd/yyyy',
  'yyyy-MM-dd',
  'yyyy.MM.dd',
  'dd.MM.yyyy',

  // Short years
  'dd/MM/yy',
  'dd-MM-yy',
  'yy-MM-dd',
  'yy/MM/dd',
  'dd.MM.yy',
  'yy.MM.dd',

  // Condensed
  'yyyyMMdd',
  'ddMMyyyy',
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

const THAI_MONTHS: Record<string, string> = {
  'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
  'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
  'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
  'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
  'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
  'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
};

function normalizeThaiDate(dateStr: string): string {
  let normalized = dateStr;
  for (const [thai, num] of Object.entries(THAI_MONTHS)) {
    if (normalized.includes(thai)) {
      normalized = normalized.replace(thai, num);
      break;
    }
  }

  // Handle BE years in DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const yearMatch = normalized.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[3], 10);
    if (year > 2500) {
      normalized = normalized.replace(year.toString(), (year - 543).toString());
    }
  }

  // Handle BE years in short format (e.g., 68 for 2568)
  // This is risky but common in Thailand (dd/MM/yy where yy is BE)
  // We'll only convert if yy > 60 and < 99 assuming it's around 256x
  const shortYearMatch = normalized.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (shortYearMatch) {
    const yr = parseInt(shortYearMatch[3], 10);
    // If yr is between 60 and 99, it's likely Buddhist Era (BE) 256x-259x
    if (yr >= 60 && yr <= 99) {
      const fullYear = 2500 + yr - 543; // Convert to AD
      normalized = normalized.substring(0, shortYearMatch.index! + shortYearMatch[0].length - 2) + fullYear.toString().substring(2);
      // Wait, let's just use the full 4 digit year for clarity before parsing
      normalized = normalized.substring(0, shortYearMatch.index! + shortYearMatch[0].length - 2 - (shortYearMatch[1].length + 1 + shortYearMatch[2].length + 1)) 
                 + shortYearMatch[1] + '/' + shortYearMatch[2] + '/' + fullYear;
    }
  }

  return normalized;
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
      const d = new Date(
        excelDate.y,
        excelDate.m - 1,
        excelDate.d,
        excelDate.H,
        excelDate.M,
        excelDate.S
      );
      return fromZonedTime(d, 'Asia/Bangkok');
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

  const normalizedValue = normalizeThaiDate(value);

  for (const format of DATE_FORMATS) {
    const parsed = parse(normalizedValue, format, new Date());
    if (isValidDate(parsed)) {
      return fromZonedTime(parsed, 'Asia/Bangkok');
    }
  }

  const parsed = new Date(normalizedValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

interface DatLineParseResult {
  employeeNumber: string;
  dateToken: string;
  timeTokens: string[];
  extras: string[];
  originalRemaining: string[];
}

function parseDatLine(line: string): DatLineParseResult | null {
  const hasComma = line.includes(',');
  const hasTab = line.includes('\t');

  let tokens: string[] = [];

  if (hasComma) {
    tokens = line.split(',').map(t => t.trim());
  } else if (hasTab) {
    tokens = line.split('\t').map(t => t.trim());
  } else {
    tokens = line.split(/\s+/g).map(t => t.trim());
  }

  tokens = tokens.filter((token) => token.length > 0);

  if (tokens.length < 2) {
    return null;
  }

  const employeeToken = tokens[0].replace(/[\uFEFF\u200B\s]+/g, '');
  const remainingTokens = tokens.slice(1);

  if (looksLikeHeader(employeeToken)) {
    return null;
  }

  const maybeDate = remainingTokens[0];
  const timeTokens: string[] = [];
  const extras: string[] = [];
  
  const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;

  for (let i = 1; i < remainingTokens.length; i++) {
    const token = remainingTokens[i];
    if (timePattern.test(token)) {
      timeTokens.push(token);
    } else {
      extras.push(token);
    }
  }

  return {
    employeeNumber: employeeToken,
    dateToken: maybeDate,
    timeTokens,
    extras,
    originalRemaining: remainingTokens
  };
}

export function parseNotepadText(content: string): ParsedFileResult {
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
        warnings.push('ข้าม header ของข้อมูล');
        return;
      }

      errors.push({
        row: rowNumber,
        error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องมีรหัสพนักงานและวันที่)',
      });
      return;
    }

    const { employeeNumber, dateToken, timeTokens, extras, originalRemaining } = parsed;

    if (!employeeNumber) {
      errors.push({
        row: rowNumber,
        error: 'รหัสพนักงานว่าง',
      });
      return;
    }

    if (timeTokens.length > 0) {
      let insertedCount = 0;
      
      const rowData: any = {
        EmployeeNumber: employeeNumber,
        Date: dateToken,
      };
      
      timeTokens.forEach((t, i) => {
        rowData[`Time${i+1}`] = t;
      });

      timeTokens.forEach((timeStr, i) => {
        const dateValue = `${dateToken} ${timeStr}`;
        const scanDateTime = parseDateValue(dateValue);

        if (scanDateTime) {
          records.push({
            rowNumber,
            employeeNumber,
            scanDateTime,
            rawLine,
            rawData: { extras, timeColumn: `Time${i+1}` },
            rowData: {
              ...rowData,
              Date: scanDateTime.toISOString().split('T')[0] // Format for UI mapping
            }
          });
          insertedCount++;
        } else {
          warnings.push(`แถว ${rowNumber}: ไม่สามารถอ่านเวลาสแกน "${dateValue}"`);
        }
      });

      if (insertedCount === 0) {
        errors.push({
          row: rowNumber,
          employeeNumber,
          error: `รูปแบบวันที่/เวลาไม่ถูกต้องในแถวนี้ ("${dateToken}")`,
          rowData
        });
      }
    } else {
      // Single date/time combo or missing time
      let dateValue = "";
      if (extras.length === 0) {
        dateValue = dateToken;
      } else {
        dateValue = originalRemaining.join(' ');
      }

      const scanDateTime = parseDateValue(dateValue);
      const rowData: any = {
        EmployeeNumber: employeeNumber,
        Date: dateToken,
      };

      if (!scanDateTime) {
        errors.push({
          row: rowNumber,
          employeeNumber,
          error: `ไม่สามารถอ่านเวลาสแกน "${dateValue}"`,
          rowData
        });
        return;
      }

      records.push({
        rowNumber,
        employeeNumber,
        scanDateTime,
        rawLine,
        rawData: extras.length ? { extras } : undefined,
        rowData
      });
    }
  });

  return {
    records,
    errors,
    warnings,
  };
}

export function parseDatFile(buffer: Buffer): ParsedFileResult {
  return parseNotepadText(buffer.toString('utf8'));
}

export function parseExcelFile(buffer: Buffer): ParsedFileResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  if (!workbook.SheetNames.length) {
    throw new AppError('ไม่พบแผ่นงานในไฟล์ Excel', 400);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Ensure we get raw values to correctly parse times
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  if (!rows.length) {
    throw new AppError('ไฟล์ Excel ไม่มีข้อมูล', 400);
  }

  const headerRow = rows[0];
  const normalizedHeaders = headerRow.map((value) => normalizeHeader(value));

  // Find column indexes
  const employeeIndex = normalizedHeaders.findIndex((value) =>
    HEADER_ALIASES.employee.includes(value)
  );
  const dateIndex = normalizedHeaders.findIndex((value) =>
    HEADER_ALIASES.date.includes(value)
  );

  if (employeeIndex === -1 || dateIndex === -1) {
    throw new AppError('ไม่พบคอลัมน์ EmployeeNumber หรือ Date ในไฟล์ Excel', 400);
  }

  // Find Time columns (Time1, Time2, ..., Time10)
  const timeIndexes: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const idx = normalizedHeaders.findIndex(h => h === `time${i}`);
    if (idx !== -1) timeIndexes.push(idx);
  }

  // Find Extra columns
  const normalStatusIndex = normalizedHeaders.findIndex(h => h === 'normalstatus');
  const lunchStatusIndex = normalizedHeaders.findIndex(h => h === 'lunchstatus');
  const morningOTIndex = normalizedHeaders.findIndex(h => h === 'morningot');

  const records: BulkImportRecord[] = [];
  const errors: ImportErrorEntry[] = [];
  const warnings: string[] = [];

  rows.slice(1).forEach((row, idx) => {
    const rowNumber = idx + 2;
    const employeeRaw = row[employeeIndex];
    const dateRaw = row[dateIndex];

    const employeeRawStr = typeof employeeRaw === 'string' ? employeeRaw : `${employeeRaw ?? ''}`;
    const employeeNumber = employeeRawStr.replace(/[\uFEFF\u200B\s]+/g, '');
    if (!employeeNumber) return; // Skip empty rows

    // Parse base date
    const dateValue = typeof dateRaw === 'string' ? dateRaw : `${dateRaw ?? ''}`;

    // Capture full row data for template display
    const rowData: any = {};
    headerRow.forEach((header, i) => {
      const key = typeof header === 'string' ? header : `Column${i + 1}`;
      rowData[key] = row[i];
    });

    const baseDate = parseDateValue(dateValue);
    if (!baseDate) {
      errors.push({
        row: rowNumber,
        employeeNumber,
        error: `รูปแบบวันที่ไม่ถูกต้อง "${dateValue}"`,
        rowData
      });
      return;
    }

    // Extract extra data
    const normalStatus = normalStatusIndex !== -1 ? row[normalStatusIndex] : undefined;
    const lunchStatus = lunchStatusIndex !== -1 ? row[lunchStatusIndex] : undefined;
    const morningOT = morningOTIndex !== -1 ? row[morningOTIndex] : undefined;

    const extras = {
      normalStatus,
      lunchStatus,
      morningOT
    };

    // If Time columns exist, iterate through them
    if (timeIndexes.length > 0) {
      let foundTime = false;
      timeIndexes.forEach((timeIdx, i) => {
        const timeVal = row[timeIdx];
        if (timeVal) {
          const timeStr = typeof timeVal === 'string' ? timeVal.trim() : `${timeVal}`;
          if (timeStr) {
            // Combine Date + Time
            // Assuming timeStr is "HH:mm" or "HH:mm:ss"
            const dateTimeStr = `${dateValue} ${timeStr}`;
            const scanDateTime = parseDateValue(dateTimeStr);

            if (scanDateTime) {
              foundTime = true;
              records.push({
                rowNumber,
                employeeNumber,
                scanDateTime,
                rawData: {
                  ...extras,
                  timeColumn: `Time${i + 1}`,
                  originalTime: timeStr
                },
                rowData: {
                  ...rowData,
                  Date: scanDateTime.toISOString().split('T')[0]
                }
              });
            } else {
              warnings.push(`แถว ${rowNumber}: ไม่สามารถอ่านเวลา Time${i + 1} "${timeStr}"`);
            }
          }
        }
      });

      if (!foundTime) {
        // If no time columns had data, check if baseDate itself had time (legacy support)
        if (baseDate.getHours() !== 0 || baseDate.getMinutes() !== 0) {
          records.push({
            rowNumber,
            employeeNumber,
            scanDateTime: baseDate,
            rawData: extras,
            rowData: {
              ...rowData,
              Date: baseDate.toISOString().split('T')[0]
            }
          });
        } else {
          // If no time found, we still push a record but with warning or handle as failure in service
          records.push({
            rowNumber,
            employeeNumber,
            scanDateTime: baseDate,
            rawData: extras,
            rowData: {
              ...rowData,
              Date: baseDate.toISOString().split('T')[0]
            }
          });
          warnings.push(`แถว ${rowNumber}: ไม่พบเวลาสแกนในคอลัมน์ Time1-10`);
        }
      }

    } else {
      // Legacy behavior: Date column contains full datetime
      records.push({
        rowNumber,
        employeeNumber,
        scanDateTime: baseDate,
        rawData: extras,
        rowData: {
          ...rowData,
          Date: baseDate.toISOString().split('T')[0] // Standardize for UI
        }
      });
    }
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
  if (lower.endsWith('.dat') || lower.endsWith('.txt')) {
    return 'dat';
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return 'excel';
  }

  return null;
}
