/**
 * User Routes
 * เส้นทาง API สำหรับจัดการผู้ใช้งาน
 *
 * Routes: GET/POST/PUT/DELETE /api/users
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import { userService } from '../../services/auth/UserService';
import { CreateUserInput } from '../../models/User';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../../utils/logger';

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
      // ignore carriage return
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

const router = Router();

/**
 * GET /api/users
 * ดึงรายการผู้ใช้ทั้งหมด (พร้อม pagination)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('User create validation failed', {
          errors: errors.array(),
        });
        throw new AppError('Validation failed', 400);
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const result = await userService.getAllUsers({ page, pageSize });

      res.json({
        success: true,
        data: {
          users: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
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
 * GET /api/users/:id
 * ดึงข้อมูลผู้ใช้ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await userService.getById(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: user,
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
 * POST /api/users
 * สร้างผู้ใช้ใหม่
 */
router.post(
  '/',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/^[A-Za-z0-9]+$/)
      .withMessage('Password must contain only letters and numbers'),
    body('name').notEmpty().withMessage('Name is required'),
    body('employeeId').notEmpty().withMessage('Employee ID is required'),
    body('roleId').notEmpty().withMessage('Role ID is required'),
    body('department').isIn(['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'HO', 'WH']).withMessage('Invalid department'),
    body('projectLocationIds').isArray().withMessage('Project location IDs must be an array'),
    body('startDate').notEmpty().withMessage('Start date is required'),
    body('startDate').isISO8601().withMessage('Start date must be a valid ISO8601 date'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Date of birth must be a valid ISO8601 date'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      // TODO: Get createdBy from authenticated user
      const createdBy = req.body.createdBy || 'system';

      const startDate = new Date(req.body.startDate);
      if (Number.isNaN(startDate.getTime())) {
        throw new AppError('Invalid start date', 400);
      }

      const dateOfBirth =
        req.body.dateOfBirth !== undefined && req.body.dateOfBirth !== null
          ? new Date(req.body.dateOfBirth)
          : undefined;

      if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
        throw new AppError('Invalid date of birth', 400);
      }

      const payload: CreateUserInput = {
        username: req.body.username,
        password: req.body.password,
        name: req.body.name,
        employeeId: req.body.employeeId,
        roleId: req.body.roleId,
        department: req.body.department,
        startDate,
        dateOfBirth,
        projectLocationIds: Array.isArray(req.body.projectLocationIds)
          ? req.body.projectLocationIds
          : [],
        isActive: req.body.isActive,
      };

      const user = await userService.createUser(payload, createdBy);

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(error.message.includes('already exists') ? 409 : 500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

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
      throw new AppError('ไม่พบข้อมูลผู้ใช้ในไฟล์', 400);
    }

    const getValue = createAccessor(headers);

    const summary = {
      success: 0,
      failed: 0,
    };

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      const rowNumber = index + 2;

      const employeeId = getValue(row, 'Employee ID');
      const username = getValue(row, 'Username');
      const password = getValue(row, 'Password');
      const fullName = getValue(row, 'Full Name');
      const roleIdRaw = getValue(row, 'Role ID');
      const departmentRaw = getValue(row, 'Department');
      const projectIdsRaw = getValue(row, 'Project Location IDs (comma-separated)');
      const startDateValue = getValue(row, 'Start Date (YYYY-MM-DD)');
      const birthDateValue = getValue(row, 'Date of Birth (YYYY-MM-DD)');
      const isActive = toBoolean(getValue(row, 'Is Active (TRUE/FALSE)'));

      const requiredMissing = [employeeId, username, password, fullName, roleIdRaw, departmentRaw, startDateValue].some(
        (value) => !value
      );

      if (requiredMissing) {
        summary.failed += 1;
        logger.warn('User import skipped: missing required fields', { rowNumber, employeeId });
        continue;
      }

      const roleId = roleIdRaw.toUpperCase();
      const department = departmentRaw.toUpperCase();
      if (!['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'].includes(roleId)) {
        summary.failed += 1;
        logger.warn('User import skipped: invalid role', { rowNumber, employeeId, roleId });
        continue;
      }
      if (!['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'HO', 'WH'].includes(department)) {
        summary.failed += 1;
        logger.warn('User import skipped: invalid department', { rowNumber, employeeId, department });
        continue;
      }

      const startDate = toDate(startDateValue);
      if (!startDate) {
        summary.failed += 1;
        logger.warn('User import skipped: invalid start date', { rowNumber, employeeId, startDateValue });
        continue;
      }

      const dateOfBirth = toDate(birthDateValue);

      const payload: CreateUserInput = {
        employeeId,
        username,
        password,
        name: fullName,
        roleId,
        department: department as CreateUserInput['department'],
        projectLocationIds: toProjectIds(projectIdsRaw),
        startDate,
        dateOfBirth,
        isActive,
      };

      try {
        await userService.createUser(payload, 'import-csv');
        summary.success += 1;
      } catch (error: any) {
        summary.failed += 1;
        logger.error('Failed to import user row', {
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
      error: error.message || 'ไม่สามารถนำเข้าข้อมูลผู้ใช้ได้',
    });
  }
});

/**
 * PUT /api/users/:id
 * อัปเดทข้อมูลผู้ใช้
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Get updatedBy from authenticated user
    const updatedBy = req.body.updatedBy || 'system';

    const user = await userService.updateUser(req.params.id, req.body, updatedBy);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: user,
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
 * DELETE /api/users/:id
 * ลบผู้ใช้ (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await userService.softDelete(req.params.id);

    if (!success) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
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
