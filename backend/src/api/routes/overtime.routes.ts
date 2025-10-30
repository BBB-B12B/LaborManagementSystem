/**
 * Overtime Routes
 * เส้นทาง API สำหรับ OT (โอที)
 *
 * All routes require authentication
 * Some routes require specific roles (SE, OE, PE, PM, PD, AM)
 */

import { Router } from 'express';
import {
  getAllOTRecords,
  getOTRecordById,
  createOTRecord,
  updateOTRecord,
  deleteOTRecord,
  getOTRecordHistory,
  checkOTOverlap,
} from '../../controllers/overtimeController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * GET /api/overtime
 * Get all overtime records with filters
 * All authenticated users can view
 */
router.get('/', getAllOTRecords);

/**
 * GET /api/overtime/:id
 * Get a single overtime record
 * All authenticated users can view
 */
router.get('/:id', getOTRecordById);

/**
 * POST /api/overtime
 * Create a new overtime record
 * Requires: SE, OE, PE, PM, PD, AM roles
 */
router.post(
  '/',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  createOTRecord
);

/**
 * PUT /api/overtime/:id
 * Update an existing overtime record
 * Requires: SE, OE, PE, PM, PD, AM roles
 */
router.put(
  '/:id',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  updateOTRecord
);

/**
 * DELETE /api/overtime/:id
 * Delete an overtime record
 * Requires: PM, PD, AM roles (higher privileges)
 */
router.delete(
  '/:id',
  authorize(['PM', 'PD', 'AM']),
  deleteOTRecord
);

/**
 * GET /api/overtime/:id/history
 * Get edit history for an overtime record
 * All authenticated users can view
 */
router.get('/:id/history', getOTRecordHistory);

/**
 * POST /api/overtime/check-overlap
 * Check if time range overlaps with existing OT records or regular work
 * All authenticated users can check
 */
router.post('/check-overlap', checkOTOverlap);

export default router;
