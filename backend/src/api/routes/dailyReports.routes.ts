/**
 * Daily Report Routes (Aggregated)
 * เส้นทาง API สำหรับรายงานการทำงานรายวัน (แบบรวม)
 */

import { Router } from 'express';
import {
  addWorkEntry,
  removeWorkEntry,
  getByProjectAndDate,
  getByProjectAndMonth,
  importExcel,
  bulkCreate,
  downloadTemplate,
  syncDailyReport
} from '../../controllers/dailyReportController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(authenticate);

/** Add/Update Work Entry */
router.post(
  '/entry',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  addWorkEntry
);

/** Remove Work Entry */
router.delete(
  '/project/:projectId/date/:date/worker/:workerId/entry/:entryId',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  removeWorkEntry
);

/** Get Report by Date */
router.get(
  '/project/:projectId/date/:date',
  getByProjectAndDate
);

/** Get Reports by Month */
router.get(
  '/project/:projectId/month/:year/:month',
  getByProjectAndMonth
);

/** Download Excel Template */
router.get(
  '/template',
  downloadTemplate
);

/** Import Excel (Preview Mode) */
router.post(
  '/import-excel',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  upload.single('file'),
  importExcel
);

/** Bulk Create (Commit Mode) */
router.post(
  '/bulk-create',
  authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  bulkCreate
);

/** Sync Daily Report from external system */
router.post(
  '/sync',
  // authorize(['SE', 'OE', 'PE', 'PM', 'PD', 'AM', 'ADMIN']), // Add appropriate roles later
  syncDailyReport
);

export default router;
