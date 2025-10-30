/**
 * Skill Routes
 * เส้นทาง API สำหรับจัดการทักษะ
 *
 * Routes: GET/POST/PUT/DELETE /api/skills
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { skillService } from '../../services/skill/SkillService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/skills
 * ดึงรายการ Skills (with pagination)
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
        throw new AppError('Validation failed', 400);
      }

      const result = await skillService.getAll({
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 50,
      });

      res.json({
        success: true,
        data: result,
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
 * GET /api/skills/active
 * ดึงรายการ Skills ที่ active เท่านั้น
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const skills = await skillService.getActiveSkills();

    res.json({
      success: true,
      data: skills,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/skills/:id
 * ดึงข้อมูล Skill ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const skill = await skillService.getById(req.params.id);

    if (!skill) {
      throw new AppError('Skill not found', 404);
    }

    res.json({
      success: true,
      data: skill,
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
 * POST /api/skills
 * สร้าง Skill ใหม่
 */
router.post(
  '/',
  [
    body('code').notEmpty().trim(),
    body('name').notEmpty().trim(),
    body('nameEnglish').optional().trim(),
    body('description').optional().trim(),
    body('baseHourlyRate').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const skill = await skillService.createSkill(req.body);

      res.status(201).json({
        success: true,
        data: skill,
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
 * PUT /api/skills/:id
 * อัปเดท Skill
 */
router.put(
  '/:id',
  [
    body('code').optional().trim(),
    body('name').optional().trim(),
    body('nameEnglish').optional().trim(),
    body('description').optional().trim(),
    body('baseHourlyRate').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const skill = await skillService.updateSkill(req.params.id, req.body);

      if (!skill) {
        throw new AppError('Skill not found', 404);
      }

      res.json({
        success: true,
        data: skill,
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
 * DELETE /api/skills/:id
 * ลบ Skill (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await skillService.softDelete(req.params.id);

    if (!success) {
      throw new AppError('Skill not found', 404);
    }

    res.json({
      success: true,
      message: 'Skill deleted successfully',
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
