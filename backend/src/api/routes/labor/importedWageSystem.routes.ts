/**
 * ImportedWageSystem Routes
 * เส้นทาง API สำหรับระบบบันทึกจำนวนเแรงงาน (CSV)
 */

import { Router, Request, Response } from 'express';
import { importedWageSystemService } from '../../../services/wage/ImportedWageSystemService';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

/**
 * GET /api/imported-wage-system
 * List all project-contractor groups
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await importedWageSystemService.getAll();
    res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
});

/**
 * GET /api/imported-wage-system/projects
 * Get list of unique projects
 */
router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const projects = await importedWageSystemService.getUniqueProjects();
    res.json({
      success: true,
      data: projects,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
});

/**
 * GET /api/imported-wage-system/by-project/:projectName
 * Get all contractor-position groups for a specific project
 */
router.get('/by-project/:projectName', async (req: Request, res: Response) => {
  try {
    const { projectName } = req.params;
    const decodedProject = decodeURIComponent(projectName);
    const list = await importedWageSystemService.getContractorsByProject(decodedProject);

    res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
});

/**
 * GET /api/imported-wage-system/:id
 * Get details for a specific project/contractor group
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await importedWageSystemService.getById(id);

    if (!doc) {
      throw new AppError('ไม่พบข้อมูลที่ระบุ', 404);
    }

    res.json({
      success: true,
      data: doc,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
});

export default router;
