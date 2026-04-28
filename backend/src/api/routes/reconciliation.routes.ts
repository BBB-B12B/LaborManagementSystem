/**
 * Reconciliation Routes
 * เส้นทาง API สำหรับระบบ Reconcile Daily Report ↔ Scan Data
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getReconciliationRecords,
  getReconciliationById,
  generateReconciliationRecords,
  generateForProjectAuto,
  approveRecord,
  sendCorrection,
  confirmByDailyReport,
  deleteGhostScan,
  markAsExported,
  exportAnomalies,
} from '../../controllers/reconciliationController';

const router = Router();

// ทุก route ต้องผ่าน Auth
router.use(authenticate);

// GET  /api/reconciliation          — ดึงรายการตาม filter
router.get('/', getReconciliationRecords);

// GET  /api/reconciliation/export   — Export CSV รายการผิดปกติ (ต้องอยู่ก่อน /:id)
router.get('/export', exportAnomalies);

// GET  /api/reconciliation/:id      — ดึง record เดียว
router.get('/:id', getReconciliationById);

// POST /api/reconciliation/generate       — manual (pass records[])
router.post('/generate', generateReconciliationRecords);

// POST /api/reconciliation/generate-auto  — auto-fetch from Project B + local scan
router.post('/generate-auto', generateForProjectAuto);

// POST /api/reconciliation/mark-exported — Mark ว่า Export แล้ว
router.post('/mark-exported', markAsExported);

// POST /api/reconciliation/:id/approve        — Admin Approve
router.post('/:id/approve', approveRecord);

// POST /api/reconciliation/:id/correct        — Admin แจ้งแก้ไข
router.post('/:id/correct', sendCorrection);

// POST /api/reconciliation/:id/confirm-daily  — ยืนยันตาม Daily Report
router.post('/:id/confirm-daily', confirmByDailyReport);

// POST /api/reconciliation/:id/delete-scan    — ลบ Ghost Scan
router.post('/:id/delete-scan', deleteGhostScan);

export default router;
