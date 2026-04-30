/**
 * Reconciliation Controller
 * API endpoints สำหรับระบบ Reconcile ข้อมูล Daily Report ↔ Scan Data
 *
 * Routes:
 *   POST   /api/reconciliation/generate        — สร้าง/อัปเดต records สำหรับช่วงวันที่
 *   GET    /api/reconciliation                 — ดึงรายการตาม filter
 *   GET    /api/reconciliation/export          — Export CSV รายการผิดปกติ
 *   GET    /api/reconciliation/:id             — ดึง record เดียว
 *   POST   /api/reconciliation/:id/approve     — Admin Approve
 *   POST   /api/reconciliation/:id/correct     — Admin แจ้งแก้ไข
 *   POST   /api/reconciliation/:id/confirm-daily — ยืนยันตาม Daily Report
 *   POST   /api/reconciliation/:id/delete-scan   — ลบ Ghost Scan
 *   POST   /api/reconciliation/mark-exported   — Mark ว่า Export แจ้งนอกระบบแล้ว
 */

import { Request, Response } from 'express';
import { reconciliationService } from '../services/reconciliation/ReconciliationService';
import type { ReconciliationStatus } from '../models/ReconciliationRecord';

// ---------------------------------------------------------------------------
// GET /api/reconciliation
// ---------------------------------------------------------------------------

/**
 * ดึงรายการ ReconciliationRecords ตาม filter
 * Query params: projectLocationId, status, startDate, endDate, employeeId
 */
export async function getReconciliationRecords(req: Request, res: Response): Promise<void> {
  try {
    const { projectLocationId, status, startDate, endDate, employeeId } = req.query;

    const records = await reconciliationService.getRecords({
      projectLocationId: projectLocationId as string | undefined,
      status: status as ReconciliationStatus | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      employeeId: employeeId as string | undefined,
    });

    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    console.error('[reconciliation] getRecords error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation records' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/reconciliation/export
// ---------------------------------------------------------------------------

/**
 * Export รายการผิดปกติเป็น JSON (Frontend จะแปลงเป็น CSV)
 * Query params: projectLocationId, startDate, endDate
 */
export async function exportAnomalies(req: Request, res: Response): Promise<void> {
  try {
    const { projectLocationId, startDate, endDate } = req.query;

    const data = await reconciliationService.getAnomaliesForExport({
      projectLocationId: projectLocationId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('[reconciliation] exportAnomalies error:', error);
    res.status(500).json({ success: false, error: 'Failed to export anomalies' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/reconciliation/:id
// ---------------------------------------------------------------------------

/**
 * ดึง ReconciliationRecord เดียวตาม ID
 */
export async function getReconciliationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const record = await reconciliationService.getById(id);

    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('[reconciliation] getById error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch record' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/reconciliation/generate
// ---------------------------------------------------------------------------

/**
 * สร้าง/อัปเดต ReconciliationRecords สำหรับพนักงานในช่วงวันที่
 * Body: { records: [...] }
 *
 * records[] จะถูกส่งมาจาก Frontend ที่ดึงข้อมูลจาก Daily Report + Scan Data มาแล้ว
 */
export async function generateForProjectAuto(req: Request, res: Response): Promise<void> {
  try {
    const { projectLocationId, startDate, endDate } = req.body as {
      projectLocationId: string;
      startDate: string;
      endDate: string;
    };

    if (!projectLocationId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'projectLocationId, startDate, endDate are required' });
      return;
    }

    const result = await reconciliationService.generateForProject(
      projectLocationId,
      startDate,
      endDate,
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[reconciliation] generateForProjectAuto error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate reconciliation records' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/reconciliation/generate  (manual — pass records[] from frontend)
// ---------------------------------------------------------------------------

/**
 * สร้าง/อัปเดต ReconciliationRecords สำหรับพนักงานในช่วงวันที่
 * Body: { projectLocationId, startDate, endDate, records: [...] }
 *
 * records[] จะถูกส่งมาจาก Frontend ที่ดึงข้อมูลจาก Daily Report + Scan Data มาแล้ว
 */
export async function generateReconciliationRecords(req: Request, res: Response): Promise<void> {
  try {
    const { records } = req.body as {
      records: Array<{
        employeeId: string;
        employeeName?: string;
        workDate: string;
        projectLocationId: string;
        projectName?: string;
        dailyReportHours?: number;
        scanDataHours?: number;
        dailyReportId?: string;
        scanDataId?: string;
        isHoliday?: boolean;
        isLeave?: boolean;
      }>;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, error: 'records array is required' });
      return;
    }

    const results = await Promise.allSettled(
      records.map((r) =>
        reconciliationService.upsertRecord(
          {
            employeeId: r.employeeId,
            employeeName: r.employeeName,
            workDate: r.workDate,
            projectLocationId: r.projectLocationId,
            projectName: r.projectName,
            dailyReportHours: r.dailyReportHours,
            scanDataHours: r.scanDataHours,
            dailyReportId: r.dailyReportId,
            scanDataId: r.scanDataId,
          },
          r.isHoliday,
          r.isLeave,
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    res.json({
      success: true,
      summary: { total: records.length, succeeded, failed },
    });
  } catch (error) {
    console.error('[reconciliation] generate error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate reconciliation records' });
  }
}

// approveRecord ถูกลบออกแล้ว — ไม่มีการ approve รายวัน การล็อกข้อมูลทำผ่านงวดงาน (onWagePeriodApproved)
// sendCorrection ถูกลบออกแล้ว — Admin แจ้งนอกระบบเอง

// ---------------------------------------------------------------------------
// POST /api/reconciliation/:id/confirm-daily
// ---------------------------------------------------------------------------

/**
 * Admin ยืนยันตาม Daily Report → ระบบเติม Scan Data อัตโนมัติ + editHistory
 * Body: { reason }
 */
export async function confirmByDailyReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.uid;

    if (!adminId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { reason } = req.body as { reason: string };
    if (!reason) {
      res.status(400).json({ success: false, error: 'reason is required' });
      return;
    }

    await reconciliationService.confirmByDailyReport(id, adminId, reason);
    res.json({ success: true, message: 'Confirmed by daily report successfully' });
  } catch (error: any) {
    console.error('[reconciliation] confirmByDailyReport error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to confirm' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/reconciliation/:id/delete-scan
// ---------------------------------------------------------------------------

/**
 * Admin ลบ Ghost Scan → Soft delete + editHistory + re-classify เป็น ABSENT
 * Body: { reason }
 */
export async function deleteGhostScan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.uid;

    if (!adminId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { reason } = req.body as { reason: string };
    if (!reason) {
      res.status(400).json({ success: false, error: 'reason is required' });
      return;
    }

    await reconciliationService.deleteGhostScan(id, adminId, reason);
    res.json({ success: true, message: 'Ghost scan deleted successfully' });
  } catch (error) {
    console.error('[reconciliation] deleteGhostScan error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete ghost scan' });
  }
}

// markAsExported ถูกลบออกแล้ว — Admin ดึงข้อมูลผ่าน getAnomaliesForExport แล้ว Export เอง
