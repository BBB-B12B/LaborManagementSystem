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

const router = Router();

/**
 * GET /api/wage-periods
 * ดึงรายการ Wage Periods (with filters)
 */
router.get(
  '/',
  [
    query('projectId').optional().isString(),
    query('status').optional().isIn(['draft', 'calculated', 'approved', 'paid', 'locked']),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { projectId, status } = req.query;

      let periods;

      if (projectId) {
        periods = await wagePeriodService.getByProject(projectId as string);
      } else if (status) {
        periods = await wagePeriodService.getByStatus(status as any);
      } else {
        const result = await wagePeriodService.getAll({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
        });
        periods = result.items;
      }

      res.json({
        success: true,
        data: periods,
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
 * GET /api/wage-periods/:id
 * ดึงข้อมูล Wage Period ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const period = await wagePeriodService.getById(req.params.id);

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
});

/**
 * POST /api/wage-periods
 * สร้าง Wage Period ใหม่
 */
router.post(
  '/',
  [
    body('projectLocationId').notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
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
        projectLocationId: req.body.projectLocationId,
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
router.post('/:id/calculate', async (req: Request, res: Response) => {
  try {
    // TODO: Get calculatedBy from authenticated user
    const calculatedBy = req.body.calculatedBy || 'system';

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
});

/**
 * POST /api/wage-periods/:id/approve
 * อนุมัติงวดค่าแรง
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    // TODO: Get approvedBy from authenticated user
    const approvedBy = req.body.approvedBy || 'system';

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
});

/**
 * POST /api/wage-periods/:id/mark-paid
 * ทำเครื่องหมายว่าจ่ายแล้ว
 */
router.post('/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    // TODO: Get paidBy from authenticated user
    const paidBy = req.body.paidBy || 'system';

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
});

export default router;
