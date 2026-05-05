/**
 * Reconciliation Routes
 * เส้นทาง API สำหรับระบบ Reconcile Daily Report ↔ Scan Data
 *
 * หมายเหตุ: ลบ /approve และ /correct ออกแล้ว
 * - การล็อกข้อมูล: ทำผ่านงวดงาน (onWagePeriodApproved)
 * - การแจ้งแก้ไข: Admin แจ้งนอกระบบเอง
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getReconciliationRecords,
  getReconciliationStats,
  getReconciliationById,
  confirmByDailyReport,
  deleteGhostScan,
  exportAnomalies,
  generateForProjectAuto,
} from '../../controllers/reconciliationController';

const router = Router();

// ทุก route ต้องผ่าน Auth
router.use(authenticate);

// GET  /api/reconciliation          — ดึงรายการตาม filter
router.get('/', getReconciliationRecords);

// GET  /api/reconciliation/stats    — aggregate counts สำหรับ SummaryStats (ต้องอยู่ก่อน /:id)
router.get('/stats', getReconciliationStats);

// GET  /api/reconciliation/export   — Export CSV รายการผิดปกติ (ต้องอยู่ก่อน /:id)
router.get('/export', exportAnomalies);

// POST /api/reconciliation/generate-auto — สร้าง/อัปเดต records สำหรับช่วงวันที่
router.post('/generate-auto', generateForProjectAuto);

// GET  /api/reconciliation/:id      — ดึง record เดียว
router.get('/:id', getReconciliationById);

// POST /api/reconciliation/:id/confirm-daily  — ยืนยันตาม Daily Report (กรณีลืม scan)
router.post('/:id/confirm-daily', confirmByDailyReport);

// POST /api/reconciliation/:id/delete-scan    — ลบ Ghost Scan
router.post('/:id/delete-scan', deleteGhostScan);

export default router;
