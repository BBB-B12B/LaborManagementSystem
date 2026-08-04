/**
 * Wage Period Routes
 * เส้นทาง API สำหรับจัดการงวดค่าแรง
 *
 * Routes: GET/POST/PUT /api/wage-periods
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { wagePeriodService } from '../../services/wage/WagePeriodService';
import { AppError } from '../middleware/errorHandler';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

// All wage period routes require authentication
router.use(authenticate);

/**
 * RBAC scope for the caller: only MD (FR-A-008) and GOD (system superuser)
 * see/act on every project. Every other role — including AM — is scoped to
 * their own projectLocationIds (see the GET / handler for the full rationale).
 */
function getScope(req: Request) {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.roleCode || (authReq.user as any)?.roleId;
  const isSuperUser = userRole === 'GOD' || userRole === 'MD';
  const userProjects = authReq.user?.projectLocationIds || [];
  return { isSuperUser, userProjects };
}

/** Throws 403 if the caller isn't allowed to act on this projectCode. */
function assertProjectAccess(req: Request, projectCode: string | undefined) {
  const { isSuperUser, userProjects } = getScope(req);
  if (!isSuperUser && !(projectCode && userProjects.includes(projectCode))) {
    throw new AppError('Access denied for this project', 403);
  }
}

/**
 * GET /api/wage-periods
 * ดึงรายการ Wage Periods (with filters)
 */
router.get(
  '/',
  [
    query('projectCode').optional().isString(),
    query('status').optional().isIn(['draft', 'calculated', 'approved', 'paid', 'locked']),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { projectCode, status } = req.query;
      const { isSuperUser, userProjects } = getScope(req);

      if (projectCode) {
        assertProjectAccess(req, projectCode as string);
      }

      let periodsData;

      if (projectCode) {
        const items = await wagePeriodService.getByProject(projectCode as string);
        periodsData = {
          wagePeriods: items,
          total: items.length,
          page: 1,
          pageSize: items.length || 50,
        };
      } else if (status) {
        let items = await wagePeriodService.getByStatus(status as any);
        if (!isSuperUser) {
          items = items.filter((item) => userProjects.includes(item.projectCode));
        }
        periodsData = {
          wagePeriods: items,
          total: items.length,
          page: 1,
          pageSize: items.length || 50,
        };
      } else if (!isSuperUser && userProjects.length === 0) {
        // No project assignment and not a super user -> nothing to show
        periodsData = { wagePeriods: [], total: 0, page: 1, pageSize: 50 };
      } else {
        const result = await wagePeriodService.getAll({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          allowedProjectCodes: isSuperUser ? undefined : userProjects,
        });
        periodsData = {
          wagePeriods: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      }

      res.json({
        success: true,
        data: periodsData,
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
 * GET /api/wage-periods/:id
 * ดึงข้อมูล Wage Period ตาม ID
 */
router.get('/:id', authorize(['AM', 'PM', 'PD', 'MD']), async (req: Request, res: Response) => {
  try {
    const period = await wagePeriodService.getById(req.params.id);

    if (!period) {
      throw new AppError('Wage period not found', 404);
    }

    // RBAC: block access to periods outside the caller's assigned projects.
    const { isSuperUser, userProjects } = getScope(req);
    if (!isSuperUser && !userProjects.includes(period.projectCode)) {
      throw new AppError('Wage period not found', 404);
    }

    res.json({
      success: true,
      data: period,
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
 * POST /api/wage-periods
 * สร้าง Wage Period ใหม่
 */
router.post(
  '/',
  [
    body('projectCode').notEmpty(),
    body('projectName').notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
  ],
  authorize(['AM', 'PM', 'PD', 'MD']),
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

      assertProjectAccess(req, req.body.projectCode);

      // Convert date strings to Date objects
      const input = {
        projectCode: req.body.projectCode,
        projectName: req.body.projectName,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      };

      const period = await wagePeriodService.createWagePeriod(input, createdBy);

      res.status(201).json({
        success: true,
        data: period,
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
 * POST /api/wage-periods/:id/calculate
 * คำนวณค่าแรงสำหรับงวด
 */
router.post(
  '/:id/calculate',
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const calculatedBy = (req as AuthRequest).user?.id;
      if (!calculatedBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      const existing = await wagePeriodService.getById(req.params.id);
      if (!existing) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, existing.projectCode);

      const period = await wagePeriodService.calculateWages(req.params.id, calculatedBy);

      if (!period) {
        throw new AppError('Wage period not found', 404);
      }

      res.json({
        success: true,
        data: period,
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
 * POST /api/wage-periods/:id/approve
 * อนุมัติงวดค่าแรง
 */
router.post(
  '/:id/approve',
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const approvedBy = (req as AuthRequest).user?.id;
      if (!approvedBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      const existing = await wagePeriodService.getById(req.params.id);
      if (!existing) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, existing.projectCode);

      const period = await wagePeriodService.approvePeriod(req.params.id, approvedBy);

      if (!period) {
        throw new AppError('Wage period not found', 404);
      }

      res.json({
        success: true,
        data: period,
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
 * POST /api/wage-periods/:id/mark-paid
 * ทำเครื่องหมายว่าจ่ายแล้ว
 */
router.post(
  '/:id/mark-paid',
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const paidBy = (req as AuthRequest).user?.id;
      if (!paidBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      const existing = await wagePeriodService.getById(req.params.id);
      if (!existing) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, existing.projectCode);

      const period = await wagePeriodService.markAsPaid(req.params.id, paidBy);

      if (!period) {
        throw new AppError('Wage period not found', 404);
      }

      res.json({
        success: true,
        data: period,
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
 * POST /api/wage-periods/:id/additional-income
 * เพิ่มรายได้เพิ่มเติม
 */
router.post(
  '/:id/additional-income',
  [
    body('dailyContractorId').notEmpty(),
    body('incomeType').notEmpty(),
    body('description').notEmpty(),
    body('amount').isNumeric(),
  ],
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const createdBy = (req as AuthRequest).user?.id;
      if (!createdBy) {
        throw new AppError('Unauthorized', 401);
      }

      const wagePeriod = await wagePeriodService.getById(req.params.id);
      if (!wagePeriod) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, wagePeriod.projectCode);

      const { additionalIncomeService } =
        await import('../../services/wage/AdditionalIncomeService');
      const item = await additionalIncomeService.create({
        wagePeriodId: req.params.id,
        dailyContractorId: req.body.dailyContractorId,
        incomeType: req.body.incomeType,
        description: req.body.description,
        amount: Number(req.body.amount),
        notes: req.body.notes,
        createdAt: new Date(),
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: item,
        message: 'Additional income added. Please re-calculate wage period.',
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/wage-periods/additional-income/:itemId
 * ลบรายได้เพิ่มเติม
 */
router.delete(
  '/additional-income/:itemId',
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const { additionalIncomeService } =
        await import('../../services/wage/AdditionalIncomeService');
      const item = await additionalIncomeService.getById(req.params.itemId);
      if (!item) {
        throw new AppError('Additional income not found', 404);
      }
      const wagePeriod = await wagePeriodService.getById(item.wagePeriodId);
      if (!wagePeriod) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, wagePeriod.projectCode);

      await additionalIncomeService.delete(req.params.itemId);

      res.json({
        success: true,
        message: 'Additional income deleted. Please re-calculate wage period.',
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/wage-periods/:id/additional-expense
 * เพิ่มรายจ่ายเพิ่มเติม
 */
router.post(
  '/:id/additional-expense',
  [
    body('dailyContractorId').notEmpty(),
    body('expenseType').notEmpty(),
    body('description').notEmpty(),
    body('amount').isNumeric(),
  ],
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const createdBy = (req as AuthRequest).user?.id;
      if (!createdBy) {
        throw new AppError('Unauthorized', 401);
      }

      const wagePeriod = await wagePeriodService.getById(req.params.id);
      if (!wagePeriod) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, wagePeriod.projectCode);

      const { additionalExpenseService } =
        await import('../../services/wage/AdditionalExpenseService');
      const item = await additionalExpenseService.create({
        wagePeriodId: req.params.id,
        dailyContractorId: req.body.dailyContractorId,
        expenseType: req.body.expenseType,
        description: req.body.description,
        amount: Number(req.body.amount),
        notes: req.body.notes,
        createdAt: new Date(),
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: item,
        message: 'Additional expense added. Please re-calculate wage period.',
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/wage-periods/additional-expense/:itemId
 * ลบรายจ่ายเพิ่มเติม
 */
router.delete(
  '/additional-expense/:itemId',
  authorize(['AM', 'PM', 'PD', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const { additionalExpenseService } =
        await import('../../services/wage/AdditionalExpenseService');
      const item = await additionalExpenseService.getById(req.params.itemId);
      if (!item) {
        throw new AppError('Additional expense not found', 404);
      }
      const wagePeriod = await wagePeriodService.getById(item.wagePeriodId);
      if (!wagePeriod) {
        throw new AppError('Wage period not found', 404);
      }
      assertProjectAccess(req, wagePeriod.projectCode);

      await additionalExpenseService.delete(req.params.itemId);

      res.json({
        success: true,
        message: 'Additional expense deleted. Please re-calculate wage period.',
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/wage-periods/:id
 * ลบงวดค่าแรง (Soft Delete)
 * [T-350] แก้ไขปัญหา 404 error เมื่อกดถังขยะ
 */
router.delete('/:id', authorize(['AM', 'PM', 'PD', 'MD']), async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized - Missing user context', 401);
    }

    const existing = await wagePeriodService.getById(req.params.id);
    if (!existing) {
      throw new AppError('Wage period not found', 404);
    }
    assertProjectAccess(req, existing.projectCode);

    const success = await wagePeriodService.softDelete(req.params.id, userId);

    if (!success) {
      throw new AppError('Wage period not found', 404);
    }

    res.json({
      success: true,
      message: 'ลบงวดค่าแรงสำเร็จ',
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
