/**
 * Project Location Routes
 * เส้นทาง API สำหรับจัดการโครงการ
 *
 * Routes: GET/POST/PUT/DELETE /api/projects
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { projectLocationService } from '../../services/project/ProjectLocationService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/projects
 * ดึงรายการ Projects (with filters)
 */
router.get(
  '/',
  [
    query('department').optional().isString().trim(),
    query('status').optional().isIn(['active', 'completed', 'suspended']),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { department, status, search } = req.query;

      let projects;

      if (department) {
        projects = await projectLocationService.getByDepartment(department as string);
      } else if (status) {
        projects = await projectLocationService.getByStatus(status as any);
      } else if (search) {
        const result = await projectLocationService.getAll();
        const keyword = (search as string).toLowerCase();
        projects = result.items.filter(
          (project) =>
            project.code.toLowerCase().includes(keyword) ||
            project.name.toLowerCase().includes(keyword)
        );
      } else {
        const result = await projectLocationService.getAll({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
        });
        projects = result.items;
      }

      res.json({
        success: true,
        data: projects,
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
 * GET /api/projects/active
 * ดึงรายการโครงการที่ active เท่านั้น
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const projects = await projectLocationService.getActiveProjects();

    res.json({
      success: true,
      data: projects,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/projects/departments
 * ดึงรายการสังกัดทั้งหมด (ไม่ซ้ำ)
 */
router.get('/departments', async (_req: Request, res: Response) => {
  try {
    const departments = await projectLocationService.getUniqueDepartments();

    res.json({
      success: true,
      data: departments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/projects/:id
 * ดึงข้อมูล Project ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await projectLocationService.getById(req.params.id);

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    res.json({
      success: true,
      data: project,
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
 * POST /api/projects
 * สร้าง Project ใหม่
 */
router.post(
  '/',
  [
    body('code').notEmpty().trim(),
    body('name').notEmpty().trim(),
    body('location').notEmpty().trim(),
    body('department').notEmpty().trim(),
    body('projectManager').optional().trim(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('status').optional().isIn(['active', 'completed', 'suspended']),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
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

      const project = await projectLocationService.createProject(input, createdBy);

      res.status(201).json({
        success: true,
        data: project,
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
 * PUT /api/projects/:id
 * อัปเดท Project
 */
router.put(
  '/:id',
  [
    body('code').optional().trim(),
    body('name').optional().trim(),
    body('location').optional().trim(),
    body('department').optional().trim(),
    body('projectManager').optional().trim(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('status').optional().isIn(['active', 'completed', 'suspended']),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
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

      const project = await projectLocationService.updateProject(
        req.params.id,
        input,
        updatedBy
      );

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      res.json({
        success: true,
        data: project,
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
 * DELETE /api/projects/:id
 * ลบ Project (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await projectLocationService.softDelete(req.params.id);

    if (!success) {
      throw new AppError('Project not found', 404);
    }

    res.json({
      success: true,
      message: 'Project deleted successfully',
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
