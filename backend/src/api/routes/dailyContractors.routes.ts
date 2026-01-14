/**
 * Daily Contractor Routes
 * เส้นทาง API สำหรับจัดการแรงงานรายวัน (DC)
 *
 * Routes: GET/POST/PUT/DELETE /api/daily-contractors
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import { dailyContractorService } from '../../services/dailyContractor/DailyContractorService';
import type { DailyContractorDTO } from '../../models/DailyContractor';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import * as XLSX from 'xlsx';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const normalizeKey = (value: string): string => value.trim().toLowerCase();

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        const next = content[i + 1];
        if (next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(current);
      current = '';
    } else if (char === '\r') {
      // skip carriage return
    } else if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (inQuotes) {
    throw new Error('CSV format error: unexpected end of file (unterminated quote)');
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows
    .map((cols) => cols.map((value) => value.trim()))
    .filter((cols) => cols.some((value) => value.length > 0));
}

const createAccessor = (headers: string[]) => {
  const headerMap = new Map<string, number>();
  headers.forEach((header, index) => {
    headerMap.set(normalizeKey(header), index);
  });

  return (row: string[], key: string): string => {
    const idx = headerMap.get(normalizeKey(key));
    if (idx === undefined) {
      return '';
    }
    return row[idx] ?? '';
  };
};

const toNumber = (value: string): number => {
  if (!value) return 0;
  const normalized = value.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toInteger = (value: string): number => {
  if (!value) return 0;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toBoolean = (value: string): boolean => {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const toDate = (value: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return undefined;

  // Sanity check for far future dates (e.g. timestamps in microseconds)
  // If year > 3000, try dividing by 1000 if it brings it to reasonable range
  if (parsed.getFullYear() > 3000) {
    const reduced = new Date(time / 1000);
    if (reduced.getFullYear() >= 1970 && reduced.getFullYear() < 3000) {
      return reduced;
    }
  }

  return parsed;
};

const toProjectIds = (value: string): string[] => {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

async function attachCompensationFlags(contractors: DailyContractorDTO[]) {
  const enriched = await Promise.all(
    contractors.map(async (contractor) => {
      const { income, expense } = await dailyContractorService.getCompensationDetails(
        contractor.id
      );
      return {
        ...contractor,
        hasCompensation: Boolean(income && expense),
      };
    })
  );
  return enriched;
}

/**
 * GET /api/daily-contractors
 * ดึงรายการ Daily Contractors (with filters)
 */
router.get(
  '/',
  [
    query('skillId').optional().isString(),
    query('projectLocationId').optional().isString(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { skillId, projectLocationId, search } = req.query;

      let contractors: DailyContractorDTO[] = [];
      let total = 0;
      let page = parseInt(req.query.page as string) || 1;
      let pageSize = parseInt(req.query.pageSize as string) || 50;

      if (skillId) {
        const result = await dailyContractorService.getBySkill(skillId as string);
        contractors = result;
        total = result.length;
        page = 1;
        pageSize = result.length;
      } else if (projectLocationId) {
        const result = await dailyContractorService.getByProject(projectLocationId as string);
        contractors = result;
        total = result.length;
        page = 1;
        pageSize = result.length;
      } else if (search) {
        const result = await dailyContractorService.searchByKeyword(search as string, {
          page,
          pageSize,
        });
        contractors = result.map((dc) => dailyContractorService.toDTO(dc));
        total = contractors.length;
        page = 1;
        pageSize = contractors.length;
      } else {
        const result = await dailyContractorService.getAll({
          page,
          pageSize,
        });
        contractors = result.items.map((dc) => dailyContractorService.toDTO(dc));
        total = result.total;
        page = result.page;
        pageSize = result.pageSize;
      }

      const contractorsWithFlags = await attachCompensationFlags(contractors);

      res.json({
        success: true,
        data: {
          dailyContractors: contractorsWithFlags,
          total,
          page,
          pageSize,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/daily-contractors/active
 * ดึงรายการ DCs ที่ active เท่านั้น
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const contractors = await dailyContractorService.getActiveDCs();

    res.json({
      success: true,
      data: contractors,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post(
  '/import',
  authorize(['AM', 'FM']),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        throw new AppError('กรุณาอัปโหลดไฟล์ CSV', 400);
      }

      const decodeTis620 = (buffer: Buffer): string => {
        let result = '';
        for (let i = 0; i < buffer.length; i++) {
          const b = buffer[i];
          if (b < 0x80) {
            result += String.fromCharCode(b);
          } else if (b >= 0xA1 && b <= 0xDA) {
            result += String.fromCharCode(0x0E01 + (b - 0xA1));
          } else if (b >= 0xDF && b <= 0xFB) {
            result += String.fromCharCode(0x0E3F + (b - 0xDF));
          } else if (b === 0xDB) result += '\u0E2F';
          else if (b === 0xDC) result += '\u0E46';
          else if (b === 0xDD) result += '\u0E4C';
          else if (b === 0xDE) result += '\u0E4D';
          else result += String.fromCharCode(b); // fallback
        }
        return result;
      };

      const rawBuffer = req.file.buffer;
      let rows: string[][] = [];
      let headers: string[] = [];

      // Check for Excel file signature or mimetype
      const isExcel = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        req.file.originalname.endsWith('.xlsx');

      if (isExcel) {
        const workbook = XLSX.read(rawBuffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert to array of arrays (header is row 0)
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
        // Filter empty rows
        rows = rows.filter(row => row.some(cell => cell && cell.toString().trim().length > 0));

        // Convert all cells to strings to match CSV behavior
        rows = rows.map(row => row.map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim()));

        console.log('[Import] Parsed XLSX file. Rows:', rows.length);
      } else {
        // Fallback to CSV handling (existing logic)
        let csvContent = rawBuffer.toString('utf-8');

        // 1. Try UTF-8 (Strip BOM if present)
        if (csvContent.charCodeAt(0) === 0xFEFF) {
          csvContent = csvContent.slice(1);
        }

        rows = parseCsv(csvContent);

        // 2. Validate Headers (Check for key Thai field)
        headers = rows.length > 0 ? rows[0] : [];
        const isHeaderValid = (h: string[]) => h.some(col => col.includes('รหัสพนักงาน') || col.includes('ชื่อ'));

        if (!isHeaderValid(headers)) {
          console.warn('[CSV Import] UTF-8 headers invalid, trying TIS-620/Windows-874...');
          const decodedLegacy = decodeTis620(rawBuffer);
          const rowsLegacy = parseCsv(decodedLegacy);
          if (rowsLegacy.length > 0 && isHeaderValid(rowsLegacy[0])) {
            console.log('[CSV Import] Succeeded with TIS-620');
            rows = rowsLegacy;
            headers = rows[0];
          } else {
            console.warn('[CSV Import] Failed to decode with TIS-620, reverting to UTF-8 (may be garbage)');
          }
        }
      }

      if (rows.length > 0) {
        headers = rows[0];
      }

      if (rows.length === 0) {
        throw new AppError('ไฟล์ไม่มีข้อมูล', 400);
      }


      // Debug logging
      console.log('[CSV Import] Raw Headers:', headers);
      console.log('[CSV Import] Normalized Headers:', headers.map(h => normalizeKey(h)));

      const dataRows = rows.slice(1);

      if (dataRows.length === 0) {
        throw new AppError('ไม่พบข้อมูลแรงงานในไฟล์', 400);
      }

      const getValue = createAccessor(headers);

      const summary = {
        total: dataRows.length,
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ row: number; employeeId?: string; message: string }>,
      };

      for (let index = 0; index < dataRows.length; index += 1) {
        const row = dataRows[index];
        const rowNumber = index + 2; // header row is line 1
        console.log(`[CSV Import] Processing row ${rowNumber}/${dataRows.length + 1}`);

        const employeeId = getValue(row, 'รหัสพนักงาน');
        const name = getValue(row, 'ชื่อ-นามสกุล');
        const skillId = getValue(row, 'รหัสทักษะ');

        if (!employeeId || !name || !skillId) {
          console.warn(`[CSV Import] Row ${rowNumber} missing required fields`);
          summary.skipped += 1;
          summary.errors.push({
            row: rowNumber,
            employeeId: employeeId || undefined,
            message: 'ข้อมูลไม่ครบถ้วน (ต้องระบุ รหัสพนักงาน, ชื่อ-นามสกุล, รหัสทักษะ)',
          });
          continue;
        }

        const projectIdsRaw = getValue(row, 'รหัสโครงการ (คั่นด้วยคอมมา)');
        const startDate = toDate(getValue(row, 'วันเริ่มงาน (ปปปป-ดด-วว)'));
        const isActive = toBoolean(getValue(row, 'สถานะใช้งาน (TRUE/FALSE)'));

        const hourlyRate = toNumber(getValue(row, 'ค่าแรงต่อชั่วโมง (บาท)'));
        const professionalRate = toNumber(getValue(row, 'ค่าวิชาชีพ (บาท/วัน)'));
        const phoneAllowance = toNumber(getValue(row, 'ค่าโทรศัพท์ต่องวด (บาท)'));
        const accommodationCost = toNumber(getValue(row, 'ค่าที่พักต่องวด (บาท)'));
        const followerCount = toInteger(getValue(row, 'จำนวนผู้ติดตาม'));
        const refrigeratorCost = toNumber(getValue(row, 'ค่าตู้เย็นต่องวด (บาท)'));
        const soundSystemCost = toNumber(getValue(row, 'ค่าเครื่องเสียงต่องวด (บาท)'));
        const tvCost = toNumber(getValue(row, 'ค่าทีวีต่องวด (บาท)'));
        const washingMachineCost = toNumber(getValue(row, 'ค่าเครื่องซักผ้าต่องวด (บาท)'));
        const portableAcCost = toNumber(getValue(row, 'ค่าแอร์เคลื่อนที่ต่องวด (บาท)'));


        try {
          console.time(`[CSV Import] Row ${rowNumber} DB Ops`);
          const contractor = await dailyContractorService.createDC(
            {
              employeeId,
              name,
              skillId,
              projectLocationIds: toProjectIds(projectIdsRaw),
              isActive,
              startDate,
            },
            'import-csv'
          );

          await dailyContractorService.upsertCompensationDetails(
            contractor.id,
            {
              income: {
                hourlyRate,
                professionalRate,
                phoneAllowancePerPeriod: phoneAllowance,
              },
              expense: {
                accommodationCostPerPeriod: accommodationCost,
                followerCount,
                refrigeratorCostPerPeriod: refrigeratorCost,
                soundSystemCostPerPeriod: soundSystemCost,
                tvCostPerPeriod: tvCost,
                washingMachineCostPerPeriod: washingMachineCost,
                portableAcCostPerPeriod: portableAcCost,
              },
            },
            'import-csv'
          );
          console.timeEnd(`[CSV Import] Row ${rowNumber} DB Ops`);

          summary.imported += 1;
        } catch (error: any) {
          console.error(`[CSV Import] Row ${rowNumber} Error:`, error);
          summary.skipped += 1;
          summary.errors.push({
            row: rowNumber,
            employeeId,
            message: error.message || 'บันทึกข้อมูลไม่สำเร็จ',
          });
          logger.error('Failed to import daily contractor row', {
            rowNumber,
            employeeId,
            error: error?.message,
          });
        }
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'ไม่สามารถนำเข้าข้อมูลแรงงานได้',
      });
    }
  });

/**
 * GET /api/daily-contractors/:id
 * ดึงข้อมูล Daily Contractor ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const contractor = await dailyContractorService.getByIdDTO(req.params.id);

    if (!contractor) {
      throw new AppError('Daily contractor not found', 404);
    }

    res.json({
      success: true,
      data: contractor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/daily-contractors/:id/compensation
 * ดึงรายละเอียดค่าแรงและค่าใช้จ่ายของแรงงานรายวัน
 */
router.get('/:id/compensation', async (req: Request, res: Response) => {
  try {
    const { income, expense } = await dailyContractorService.getCompensationDetails(
      req.params.id
    );

    res.json({
      success: true,
      data: {
        income: income
          ? {
            hourlyRate: income.hourlyRate,
            otHourlyRate: parseFloat((income.hourlyRate * 1.5).toFixed(2)),
            professionalRate: income.professionalRate,
            phoneAllowancePerPeriod: income.phoneAllowance,
            effectiveDate: income.effectiveDate,
          }
          : null,
        expense: expense
          ? {
            accommodationCostPerPeriod: expense.accommodationCost,
            followerCount: expense.followerCount,
            followerAccommodationPerPeriod: expense.followerAccommodation,
            refrigeratorCostPerPeriod: expense.refrigeratorCost,
            soundSystemCostPerPeriod: expense.soundSystemCost,
            tvCostPerPeriod: expense.tvCost,
            washingMachineCostPerPeriod: expense.washingMachineCost,
            portableAcCostPerPeriod: expense.portableAcCost,
            effectiveDate: expense.effectiveDate,
          }
          : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/daily-contractors/:id/compensation
 * บันทึก/อัปเดตรายละเอียดค่าแรงและค่าใช้จ่ายของแรงงานรายวัน
 */
router.put(
  '/:id/compensation',
  [
    body('income.hourlyRate').optional().isFloat({ min: 0 }),
    body('income.professionalRate').optional().isFloat({ min: 0 }),
    body('income.phoneAllowancePerPeriod').optional().isFloat({ min: 0 }),
    body('expense.accommodationCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.followerCount').optional().isInt({ min: 0 }),
    body('expense.refrigeratorCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.soundSystemCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.tvCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.washingMachineCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.portableAcCostPerPeriod').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const updatedBy = req.body.updatedBy || 'system';
      const incomePayload = req.body.income
        ? {
          hourlyRate: Number(req.body.income.hourlyRate ?? 0),
          professionalRate: Number(req.body.income.professionalRate ?? 0),
          phoneAllowancePerPeriod: Number(req.body.income.phoneAllowancePerPeriod ?? 0),
        }
        : undefined;

      const expensePayload = req.body.expense
        ? {
          accommodationCostPerPeriod: Number(
            req.body.expense.accommodationCostPerPeriod ?? 0
          ),
          followerCount: Number(req.body.expense.followerCount ?? 0),
          refrigeratorCostPerPeriod: Number(
            req.body.expense.refrigeratorCostPerPeriod ?? 0
          ),
          soundSystemCostPerPeriod: Number(
            req.body.expense.soundSystemCostPerPeriod ?? 0
          ),
          tvCostPerPeriod: Number(req.body.expense.tvCostPerPeriod ?? 0),
          washingMachineCostPerPeriod: Number(
            req.body.expense.washingMachineCostPerPeriod ?? 0
          ),
          portableAcCostPerPeriod: Number(
            req.body.expense.portableAcCostPerPeriod ?? 0
          ),
        }
        : undefined;

      const { income, expense } = await dailyContractorService.upsertCompensationDetails(
        req.params.id,
        {
          income: incomePayload,
          expense: expensePayload,
        },
        updatedBy
      );

      res.json({
        success: true,
        data: {
          income: income
            ? {
              hourlyRate: income.hourlyRate,
              otHourlyRate: parseFloat((income.hourlyRate * 1.5).toFixed(2)),
              professionalRate: income.professionalRate,
              phoneAllowancePerPeriod: income.phoneAllowance,
              effectiveDate: income.effectiveDate,
            }
            : null,
          expense: expense
            ? {
              accommodationCostPerPeriod: expense.accommodationCost,
              followerCount: expense.followerCount,
              followerAccommodationPerPeriod: expense.followerAccommodation,
              refrigeratorCostPerPeriod: expense.refrigeratorCost,
              soundSystemCostPerPeriod: expense.soundSystemCost,
              tvCostPerPeriod: expense.tvCost,
              washingMachineCostPerPeriod: expense.washingMachineCost,
              portableAcCostPerPeriod: expense.portableAcCost,
              effectiveDate: expense.effectiveDate,
            }
            : null,
        },
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/daily-contractors
 * สร้าง Daily Contractor ใหม่
 */
router.post(
  '/',
  [
    body('employeeId').optional({ checkFalsy: true }).trim(),
    body('name').optional({ checkFalsy: true }).trim(),
    body('skillId').optional({ checkFalsy: true }).trim(),
    body('username').optional({ checkFalsy: true }).trim(),
    body('password').optional({ checkFalsy: true }).isLength({ min: 8 }),
    body('projectLocationIds').optional().isArray(),
    body('phoneNumber').optional({ checkFalsy: true }).trim(),
    body('idCardNumber').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('emergencyContact').optional({ checkFalsy: true }).trim(),
    body('emergencyPhone').optional({ checkFalsy: true }).trim(),
    body('isActive').optional().isBoolean(),
    body('startDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid startDate'),
    body('endDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid endDate'),
  ],
  authorize(['AM', 'FM']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const createdBy = (req as AuthRequest).user?.id;
      if (!createdBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      // Convert date strings to Date objects
      const input = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      const contractor = await dailyContractorService.createDC(input, createdBy);

      res.status(201).json({
        success: true,
        data: contractor,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * PUT /api/daily-contractors/:id
 * อัปเดท Daily Contractor
 */
router.put(
  '/:id',
  [
    body('employeeId').optional({ checkFalsy: true }).trim(),
    body('name').optional({ checkFalsy: true }).trim(),
    body('skillId').optional({ checkFalsy: true }).trim(),
    body('username').optional({ checkFalsy: true }).trim(),
    body('password').optional({ checkFalsy: true }).isLength({ min: 8 }),
    body('projectLocationIds').optional().isArray(),
    body('phoneNumber').optional({ checkFalsy: true }).trim(),
    body('idCardNumber').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('emergencyContact').optional({ checkFalsy: true }).trim(),
    body('emergencyPhone').optional({ checkFalsy: true }).trim(),
    body('isActive').optional().isBoolean(),
    body('startDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid startDate'),
    body('endDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid endDate'),
  ],
  authorize(['AM', 'FM']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const updatedBy = (req as AuthRequest).user?.id;
      if (!updatedBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      // Convert date strings to Date objects
      const input: any = { ...req.body };
      if (input.startDate) input.startDate = new Date(input.startDate);
      if (input.endDate) input.endDate = new Date(input.endDate);

      const contractor = await dailyContractorService.updateDC(
        req.params.id,
        input,
        updatedBy
      );

      if (!contractor) {
        throw new AppError('Daily contractor not found', 404);
      }

      res.json({
        success: true,
        data: contractor,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /api/daily-contractors/:id
 * ลบ Daily Contractor (soft delete)
 */
router.delete('/:id', authorize(['AM', 'FM']), async (req: Request, res: Response) => {
  try {
    const updatedBy = (req as AuthRequest).user?.id;
    const success = await dailyContractorService.softDelete(req.params.id, updatedBy);

    if (!success) {
      throw new AppError('Daily contractor not found', 404);
    }

    res.json({
      success: true,
      message: 'Daily contractor deleted successfully',
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
