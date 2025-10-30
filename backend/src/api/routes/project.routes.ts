/**
 * Project Routes
 * เส้นทาง API สำหรับโครงการ
 *
 * All routes require authentication
 * Create/Update/Delete require FM, PM, or Admin roles
 */

import { Router } from 'express';
import {
  getAllProjectsHandler,
  getActiveProjectsHandler,
  getProjectByIdHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  getDepartmentsHandler,
  getNextProjectCodeHandler,
} from '../../controllers/projectController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * GET /api/projects
 * Get all projects with filters
 * All authenticated users can view
 */
router.get('/', getAllProjectsHandler);

/**
 * GET /api/projects/active
 * Get active projects only
 * All authenticated users can view
 */
router.get('/active', getActiveProjectsHandler);

/**
 * GET /api/projects/departments
 * Get all departments
 */
router.get('/departments', getDepartmentsHandler);

/**
 * GET /api/projects/next-code
 * Retrieve the next running project code
 */
router.get('/next-code', authorize(['FM', 'PM', 'AM']), getNextProjectCodeHandler);

/**
 * GET /api/projects/:id
 * Get a single project
 * All authenticated users can view
 */
router.get('/:id', getProjectByIdHandler);

/**
 * POST /api/projects
 * Create a new project
 * Requires: FM, PM, AM roles
 */
router.post(
  '/',
  authorize(['FM', 'PM', 'AM']),
  createProjectHandler
);

/**
 * PUT /api/projects/:id
 * Update an existing project
 * Requires: FM, PM, AM roles
 */
router.put(
  '/:id',
  authorize(['FM', 'PM', 'AM']),
  updateProjectHandler
);

/**
 * DELETE /api/projects/:id
 * Delete a project (soft delete)
 * Requires: PM, AM roles (higher privileges)
 */
router.delete(
  '/:id',
  authorize(['PM', 'AM']),
  deleteProjectHandler
);

export default router;
