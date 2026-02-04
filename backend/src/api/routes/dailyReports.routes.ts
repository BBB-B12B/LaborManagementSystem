/**
 * Daily Report Routes (Aggregated)
 * เส้นทาง API สำหรับรายงานการทำงานรายวัน (แบบรวม)
 */

import { Router } from 'express';
import {
  addWorkEntry,
  removeWorkEntry,
  getByProjectAndDate,
  getByProjectAndMonth
} from '../../controllers/dailyReportController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

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
  '/project/:projectId/date/:date/entry/:entryId',
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

export default router;
