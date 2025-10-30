/**
 * Daily Report Routes
 * เส้นทาง API สำหรับรายงานการทำงานรายวัน
 *
 * All routes require authentication
 * Some routes require specific roles (SE, OE, PE, PM, PD, AM)
 */

import { Router } from 'express';
import {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  getReportHistory,
  checkOverlap,
} from '../../controllers/dailyReportController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * GET /api/daily-reports
 * Get all daily reports with filters
 * All authenticated users can view
 */
router.get('/', getAllReports);

/**
 * GET /api/daily-reports/:id
 * Get a single daily report
 * All authenticated users can view
 */
router.get('/:id', getReportById);

/**
 * POST /api/daily-reports
 * Create a new daily report
 * Requires: SE, OE, PE, PM, PD, AM roles
 */
router.post(
  '/',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  createReport
);

/**
 * PUT /api/daily-reports/:id
 * Update an existing daily report
 * Requires: SE, OE, PE, PM, PD, AM roles
 */
router.put(
  '/:id',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  updateReport
);

/**
 * DELETE /api/daily-reports/:id
 * Delete a daily report
 * Requires: PM, PD, AM roles (higher privileges)
 */
router.delete(
  '/:id',
  authorize(['PM', 'PD', 'AM']),
  deleteReport
);

/**
 * GET /api/daily-reports/:id/history
 * Get edit history for a daily report
 * All authenticated users can view
 */
router.get('/:id/history', getReportHistory);

/**
 * POST /api/daily-reports/check-overlap
 * Check if time range overlaps with existing reports
 * All authenticated users can check
 */
router.post('/check-overlap', checkOverlap);

export default router;
