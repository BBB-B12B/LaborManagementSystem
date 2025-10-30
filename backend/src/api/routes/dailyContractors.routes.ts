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

const router = Router();

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
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
router.get('/active', async (req: Request, res: Response) => {
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

router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError('กรุณาอัปโหลดไฟล์ CSV', 400);
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const rows = parseCsv(csvContent);

    if (rows.length === 0) {
      throw new AppError('ไฟล์ไม่มีข้อมูล', 400);
    }

    const headers = rows[0];
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

      const employeeId = getValue(row, 'Employee ID');
      const name = getValue(row, 'Full Name');
      const skillId = getValue(row, 'Skill ID');

      if (!employeeId || !name || !skillId) {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          employeeId: employeeId || undefined,
          message: 'ข้อมูลไม่ครบถ้วน (ต้องระบุ Employee ID, Full Name, Skill ID)',
        });
        continue;
      }

      const projectIdsRaw = getValue(row, 'Project Location IDs (comma-separated)');
      const startDate = toDate(getValue(row, 'Start Date (YYYY-MM-DD)'));
      const endDate = toDate(getValue(row, 'End Date (YYYY-MM-DD)'));
      const isActive = toBoolean(getValue(row, 'Is Active (TRUE/FALSE)'));

      const hourlyRate = toNumber(getValue(row, 'Hourly Rate (THB)'));
      const professionalRate = toNumber(getValue(row, 'Professional Rate (THB)'));
      const phoneAllowance = toNumber(getValue(row, 'Phone Allowance Per Period (THB)'));
      const accommodationCost = toNumber(getValue(row, 'Accommodation Cost Per Period (THB)'));
      const followerCount = toInteger(getValue(row, 'Follower Count'));
      const refrigeratorCost = toNumber(getValue(row, 'Refrigerator Cost Per Period (THB)'));
      const soundSystemCost = toNumber(getValue(row, 'Sound System Cost Per Period (THB)'));
      const tvCost = toNumber(getValue(row, 'TV Cost Per Period (THB)'));
      const washingMachineCost = toNumber(getValue(row, 'Washing Machine Cost Per Period (THB)'));
      const portableAcCost = toNumber(getValue(row, 'Portable AC Cost Per Period (THB)'));

      const phoneNumber = getValue(row, 'Phone Number') || undefined;
      const idCardNumber = getValue(row, 'ID Card Number') || undefined;
      const address = getValue(row, 'Address') || undefined;
      const emergencyContact = getValue(row, 'Emergency Contact') || undefined;
      const emergencyPhone = getValue(row, 'Emergency Phone') || undefined;

      try {
        const contractor = await dailyContractorService.createDC(
          {
            employeeId,
            name,
            skillId,
            projectLocationIds: toProjectIds(projectIdsRaw),
            phoneNumber,
            idCardNumber,
            address,
            emergencyContact,
            emergencyPhone,
            isActive,
            startDate,
            endDate,
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

        summary.imported += 1;
      } catch (error: any) {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          employeeId,
          message: error?.message || 'ไม่สามารถสร้างแรงงานได้',
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
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      // TODO: Get createdBy from authenticated user
      const createdBy = req.body.createdBy || 'system';

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
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      // TODO: Get updatedBy from authenticated user
      const updatedBy = req.body.updatedBy || 'system';

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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await dailyContractorService.softDelete(req.params.id);

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
