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
import { AuthRequest } from '../api/middleware/auth';

// ---------------------------------------------------------------------------
// Helper: แปลง frontend filterStatus → backend status array
// ---------------------------------------------------------------------------

function mapFilterStatusToStatuses(filterStatus: string): ReconciliationStatus[] | undefined {
  switch (filterStatus) {
    case 'all_normal':
      return ['MATCHED', 'LEAVE'];
    case 'normal':
      return ['MATCHED'];
    case 'all_abnormal':
    case 'abnormal': // คลิกการ์ดหลักสีแดง → แสดงรายการผิดปกติทั้งหมดที่ยังค้างอยู่
    case 'abnormal_pending':
      return ['CONFLICTED', 'MISSING_SCAN', 'MISSING_DAILY', 'UNREGISTERED_EMPLOYEE', 'ABSENT'];
    case 'missingDaily':
      return ['MISSING_DAILY'];
    case 'missingScan':
      return ['MISSING_SCAN'];
    case 'workHourConflict': // card เดียว (รวมทั้ง OT และชั่วโมงปกติ)
      return ['CONFLICTED'];
    case 'unregistered':
      return ['UNREGISTERED_EMPLOYEE'];
    case 'absent':
      return ['ABSENT'];
    case 'leave':
      return ['LEAVE'];
    case 'pendingLeave':
      return ['PENDING_LEAVE_REVIEW'];
    case 'abnormal_fixed':
      // 'abnormal_fixed' จะกรองเฉพาะ status 'MATCHED' ร่วมกับ isResolved=true เพื่อไม่ให้นับซ้ำกับ ลา (LEAVE)
      return ['MATCHED'];
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// GET /api/reconciliation
// ---------------------------------------------------------------------------

/**
 * ดึงรายการ ReconciliationRecords ตาม filter
 * Query params: projectLocationId, status, startDate, endDate, employeeId
 */

export async function getReconciliationRecords(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const {
      homeProjectId, // param ใหม่ที่ frontend ส่งมา
      projectLocationId, // backward compat — ถ้า frontend เก่ายังส่ง projectLocationId
      status,
      startDate,
      endDate,
      employeeId,
      filterStatus,
      page,
      pageSize,
    } = req.query;

    // รองรับทั้ง homeProjectId (ใหม่) และ projectLocationId (เก่า)
    const targetProject = (homeProjectId || projectLocationId) as string | undefined;
    const userProjects = authReq.user?.projectLocationIds || [];

    // RBAC: All users are restricted to their assigned projectLocationIds
    if (targetProject) {
      if (!userProjects.includes(targetProject)) {
        res.status(403).json({ success: false, error: 'Access denied for this project' });
        return;
      }
    } else {
      if (userProjects.length === 0) {
        res.json({ success: true, data: [], total: 0, page: 0, pageSize: 100 });
        return;
      }
    }

    // Map filterStatus (frontend) → status array (backend)
    const statusFilter: ReconciliationStatus | ReconciliationStatus[] | undefined = status
      ? (status as ReconciliationStatus)
      : filterStatus
        ? mapFilterStatusToStatuses(filterStatus as string)
        : undefined;

    // 'locked' filter — ใช้ isLocked field แทน status
    const isLocked = filterStatus === 'locked' ? true : undefined;
    // 'abnormal_fixed' — ใช้ isResolved=true filter → ดึงเฉพาะ record ที่มี resolvedAt
    const isResolved = filterStatus === 'abnormal_fixed' ? true : undefined;

    const result = await reconciliationService.getRecords({
      homeProjectId: targetProject,
      allowedHomeProjects: targetProject ? undefined : userProjects,
      status: statusFilter,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      employeeId: employeeId as string | undefined,
      isLocked,
      isResolved,
      page: page !== undefined ? parseInt(page as string, 10) : 0,
      pageSize: pageSize !== undefined ? parseInt(pageSize as string, 10) : 100,
    });

    // Enrich projectName สำหรับ records ที่ยังไม่มีชื่อโครงการ
    // Query แบบ global (ไม่ผ่าน RBAC) เพื่อให้แสดงชื่อโครงการที่พนักงานไปทำงาน
    const missingNameIds = [
      ...new Set(
        result.records
          .filter((r) => !r.projectName && r.projectLocationId)
          .map((r) => r.projectLocationId)
      ),
    ];

    if (missingNameIds.length > 0) {
      try {
        const { collections } = await import('../config/collections');
        const projectNameMap = new Map<string, string>();

        // Batch query — Firestore 'in' รองรับสูงสุด 10 ค่าต่อครั้ง
        const batchSize = 10;
        for (let i = 0; i < missingNameIds.length; i += batchSize) {
          const batch = missingNameIds.slice(i, i + batchSize);

          // 1) หา document ที่ doc ID ตรงกับ projectLocationId
          const idSnap = await collections.projectLocations.where('__name__', 'in', batch).get();
          idSnap.forEach((doc) => {
            const name = doc.data().projectName;
            if (name) projectNameMap.set(doc.id, name);
          });

          // 2) Fallback: หาจาก code field
          const stillMissingByCode = batch.filter((id) => !projectNameMap.has(id));
          if (stillMissingByCode.length > 0) {
            const codeSnap = await collections.projectLocations
              .where('code', 'in', stillMissingByCode)
              .get();
            codeSnap.forEach((doc) => {
              const d = doc.data();
              if (d.projectName && d.code) projectNameMap.set(d.code, d.projectName);
            });
          }

          // 3) Fallback: หาจาก projectCode field
          const stillMissingByProjectCode = batch.filter((id) => !projectNameMap.has(id));
          if (stillMissingByProjectCode.length > 0) {
            const pcSnap = await collections.projectLocations
              .where('projectCode', 'in', stillMissingByProjectCode)
              .get();
            pcSnap.forEach((doc) => {
              const d = doc.data();
              if (d.projectName && d.projectCode) projectNameMap.set(d.projectCode, d.projectName);
            });
          }
        }

        // Patch projectName เข้า records ที่ยังไม่มีชื่อ
        result.records.forEach((r) => {
          if (!r.projectName && projectNameMap.has(r.projectLocationId)) {
            r.projectName = projectNameMap.get(r.projectLocationId);
          }
        });
      } catch (enrichErr) {
        console.warn('[reconciliation] projectName enrichment failed:', enrichErr);
      }
    }

    res.json({
      success: true,
      data: result.records,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    console.error('[reconciliation] getRecords error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation records' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/reconciliation/stats
// ---------------------------------------------------------------------------

/**
 * ดึงสถิติ aggregate counts สำหรับ SummaryStats
 * ใช้ Firestore Count Aggregate — ไม่โหลดข้อมูลทั้งหมด เร็วและประหยัด reads
 * Query params: projectLocationId, startDate, endDate
 */
export async function getReconciliationStats(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const { homeProjectId, projectLocationId, startDate, endDate } = req.query;

    // รองรับทั้ง homeProjectId (ใหม่) และ projectLocationId (เก่า)
    const targetProject = (homeProjectId || projectLocationId) as string | undefined;
    const userProjects = authReq.user?.projectLocationIds || [];

    // RBAC
    if (targetProject) {
      if (!userProjects.includes(targetProject)) {
        res.status(403).json({ success: false, error: 'Access denied for this project' });
        return;
      }
    } else {
      if (userProjects.length === 0) {
        res.json({
          success: true,
          data: { totalRows: 0, normalCount: 0, pendingCount: 0, resolvedCount: 0 },
        });
        return;
      }
    }

    const stats = await reconciliationService.getStats({
      homeProjectId: targetProject,
      allowedHomeProjects: targetProject ? undefined : userProjects,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[reconciliation] getStats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation stats' });
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
    const authReq = req as AuthRequest;
    const { homeProjectId, projectLocationId, startDate, endDate } = req.query;

    // รองรับทั้ง homeProjectId (ใหม่) และ projectLocationId (เก่า)
    const targetProject = (homeProjectId || projectLocationId) as string | undefined;
    const userProjects = authReq.user?.projectLocationIds || [];

    // RBAC: All users are restricted to their assigned projectLocationIds
    if (targetProject) {
      if (!userProjects.includes(targetProject)) {
        res.status(403).json({ success: false, error: 'Access denied for this project' });
        return;
      }
    } else {
      if (userProjects.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }
    }

    const data = await reconciliationService.getAnomaliesForExport({
      homeProjectId: targetProject,
      allowedHomeProjects: targetProject ? undefined : userProjects,
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
      res
        .status(400)
        .json({ success: false, error: 'projectLocationId, startDate, endDate are required' });
      return;
    }

    const result = await reconciliationService.generateForProject(
      projectLocationId,
      startDate,
      endDate
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[reconciliation] generateForProjectAuto error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate reconciliation records',
    });
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
          r.isLeave
        )
      )
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

// ---------------------------------------------------------------------------
// POST /api/reconciliation/:id/resolve-manual
// ---------------------------------------------------------------------------

/**
 * Admin แก้ไขชั่วโมงด้วยตนเอง (Manual Resolve)
 * Body: { normalHours, otMorning, otNoon, otEvening, reason }
 */
export async function resolveManual(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.uid;

    if (!adminId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const payload = req.body;
    await reconciliationService.resolveManual(id, adminId, payload);
    res.json({ success: true, message: 'Resolved manually successfully' });
  } catch (error: any) {
    console.error('[reconciliation] resolveManual error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to resolve manual' });
  }
}

/**
 * Admin ตรวจสอบใบรับรองแพทย์ (Review Leave Status)
 * Body: { isApproved: boolean, reason?: string }
 */
export async function reviewLeaveStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.uid;

    if (!adminId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { isApproved, reason } = req.body as { isApproved: boolean; reason?: string };
    if (isApproved === undefined) {
      res.status(400).json({ success: false, error: 'isApproved is required' });
      return;
    }

    // 1. อัปเดตฝั่ง LaborManagementSystem
    await reconciliationService.reviewLeaveStatus(id, adminId, isApproved, reason);

    // 2. ถ้าไม่อนุมัติ ให้ยิงไปแก้ต้นฉบับและ trigger AfterSale
    if (!isApproved) {
      // id จะเป็นรูปแบบ REC_{employeeId}_{workDate}
      const parts = id.split('_');
      if (parts.length >= 3) {
        const employeeId = parts[1];
        const workDate = parts.slice(2).join('_'); // รองรับกรณี date มี _ (แม้ปกติจะเป็น YYYY-MM-DD)
        const { taskService } = await import('../services/TaskService');
        await taskService.rejectMedCertInDailyReport(employeeId, workDate);
      }
    }

    res.json({ success: true, message: 'Leave status reviewed successfully' });
  } catch (error: any) {
    console.error('[reconciliation] reviewLeaveStatus error:', error);
    res
      .status(500)
      .json({ success: false, error: error.message || 'Failed to review leave status' });
  }
}

/**
 * Admin แก้ไขรายการสแกนนิ้ว (Manual Adjust Scan Data)
 * Body: { punches, reason }
 */
export async function updateScanPunches(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.uid;

    if (!adminId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { punches, reason } = req.body as { punches: string[]; reason?: string };
    if (!punches || !Array.isArray(punches)) {
      res.status(400).json({ success: false, error: 'punches array is required' });
      return;
    }

    const finalReason = reason && reason.trim() !== '' ? reason : 'ปรับปรุงเวลาสแกนนิ้ว';

    await reconciliationService.updateScanPunches(id, adminId, punches, finalReason);
    res.json({ success: true, message: 'Scan punches updated successfully' });
  } catch (error: any) {
    console.error('[reconciliation] updateScanPunches error:', error);
    res
      .status(500)
      .json({ success: false, error: error.message || 'Failed to update scan punches' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/reconciliation/export-excel
// ---------------------------------------------------------------------------

/**
 * Export ข้อมูล Reconciliation เป็นไฟล์ Excel (.xlsx)
 * Query params: homeProjectId/projectLocationId, startDate, endDate
 */
export async function exportToExcel(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const { homeProjectId, projectLocationId, startDate, endDate } = req.query;

    const targetProject = (homeProjectId || projectLocationId) as string | undefined;
    const userProjects = authReq.user?.projectLocationIds || [];

    // RBAC
    if (targetProject) {
      if (!userProjects.includes(targetProject)) {
        res.status(403).json({ success: false, error: 'Access denied for this project' });
        return;
      }
    } else {
      if (userProjects.length === 0) {
        res.status(400).json({ success: false, error: 'No projects assigned to this user' });
        return;
      }
    }

    // Map filterStatus → status array (not used anymore because we export ALL statuses)
    const result = await reconciliationService.getRecords({
      homeProjectId: targetProject,
      allowedHomeProjects: targetProject ? undefined : userProjects,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      page: 0,
      pageSize: 10000, // ดึงทั้งหมดเพื่อส่งออก
    });

    const excelBuffer = await reconciliationService.generateForemanExcel(result.records);

    const dateRange =
      startDate && endDate ? `${startDate}_${endDate}` : new Date().toISOString().split('T')[0];
    const excelFilename = `รายงานความผิดปกติ_${dateRange}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${encodeURIComponent(excelFilename)}`
    );
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('[reconciliation] exportToExcel error:', error);
    res.status(500).json({ success: false, error: error.message || 'Export failed' });
  }
}
