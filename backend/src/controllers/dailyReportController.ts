/**
 * Daily Report Controller (Aggregated)
 * จัดการ HTTP requests สำหรับรายงานการทำงานรายวัน (แบบรวม)
 *
 * Endpoints:
 * - POST /api/daily-reports/entry - Add/Update work entry
 * - DELETE /api/daily-reports/project/:projectId/date/:date/entry/:entryId - Remove work entry
 * - GET /api/daily-reports/project/:projectId/date/:date - Get report by day
 * - GET /api/daily-reports/project/:projectId/month/:year/:month - Get reports by month
 */

import { Request, Response } from 'express';
import { dailyReportService } from '../services/dailyReport/DailyReportService';
import { reconciliationService } from '../services/reconciliation/ReconciliationService';
import * as XLSX from 'xlsx';
import { DAILY_REPORT_COLUMNS } from '../utils/dailyReportExcel';
import { storage } from '../config/storage';
import { logger } from '../utils/logger';

/**
 * POST /api/daily-reports/entry
 * Add or Update a Work Entry
 */
export async function addWorkEntry(req: Request, res: Response): Promise<Response> {
  try {
    const { projectId, date, entry } = req.body;
    const userId = (req as any).user?.uid;

    if (!projectId || !date || !entry) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const report = await dailyReportService.addWorkEntry(
      projectId,
      new Date(date),
      {
        ...entry,
        startTime: new Date(entry.startTime),
        endTime: new Date(entry.endTime)
      },
      userId
    );

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error adding work entry:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * DELETE /api/daily-reports/project/:projectId/date/:date/worker/:workerId/entry/:entryId
 * Remove a Work Entry
 */
export async function removeWorkEntry(req: Request, res: Response): Promise<Response> {
  try {
    const { projectId, date, workerId, entryId } = req.params;
    const userId = (req as any).user?.uid;

    await dailyReportService.removeWorkEntry(
      projectId,
      new Date(date),
      workerId,
      entryId,
      userId
    );

    return res.status(204).send();
  } catch (error) {
    console.error('Error removing work entry:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/daily-reports/project/:projectId/date/:date
 * Get Daily Report by Project and Date
 */
export async function getByProjectAndDate(req: Request, res: Response): Promise<Response> {
  try {
    const { projectId, date } = req.params;
    const report = await dailyReportService.getByProjectAndDate(projectId, new Date(date));
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/daily-reports/project/:projectId/month/:year/:month
 * Get Daily Reports by Month
 */
export async function getByProjectAndMonth(req: Request, res: Response): Promise<Response> {
  try {
    const { projectId, year, month } = req.params;
    const reports = await dailyReportService.getByProjectAndMonth(
      projectId,
      parseInt(year),
      parseInt(month)
    );
    return res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching monthly reports:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
/**
 * POST /api/daily-reports/import-excel
 * Parse Excel file and return preview
 */
export async function importExcel(req: Request, res: Response): Promise<Response> {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const buffer = req.file.buffer;
    const preview = await dailyReportService.parseDailyReportExcel(buffer);

    // T-371-5: Upload the original file for audit trail
    let importFileUrl = null;
    try {
      importFileUrl = await storage.uploadBuffer(
        buffer,
        'daily-reports/imports',
        req.file.originalname,
        req.file.mimetype
      );
    } catch (error) {
      logger.error('Failed to upload import source file', { error });
    }

    return res.status(200).json({ 
      success: true, 
      data: preview,
      importFileUrl 
    });
  } catch (error) {
    console.error('Error importing Excel:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/daily-reports/bulk-create
 * Save many work entries at once
 */
export async function bulkCreate(req: Request, res: Response): Promise<Response> {
  try {
    const { data, importFileUrl } = req.body;
    const userId = (req as any).user?.uid;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    const count = await dailyReportService.bulkCreateDailyReports(data, userId, importFileUrl);
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Error bulk creating reports:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/daily-reports/template
 * Download Excel Template (v2)
 */
export async function downloadTemplate(_req: Request, res: Response): Promise<void> {
  try {
    const headers = [
      DAILY_REPORT_COLUMNS.DATE,
      DAILY_REPORT_COLUMNS.EMPLOYEE_ID,
      DAILY_REPORT_COLUMNS.WORKER_NAME,
      // Regular
      DAILY_REPORT_COLUMNS.HOURS_REGULAR,
      DAILY_REPORT_COLUMNS.TASK_REGULAR,
      DAILY_REPORT_COLUMNS.PROJECT_REGULAR,
      // OT Morning
      DAILY_REPORT_COLUMNS.HOURS_OT_MORNING,
      DAILY_REPORT_COLUMNS.TASK_OT_MORNING,
      DAILY_REPORT_COLUMNS.PROJECT_OT_MORNING,
      // OT Noon
      DAILY_REPORT_COLUMNS.HOURS_OT_NOON,
      DAILY_REPORT_COLUMNS.TASK_OT_NOON,
      DAILY_REPORT_COLUMNS.PROJECT_OT_NOON,
      // OT Evening
      DAILY_REPORT_COLUMNS.HOURS_OT_EVENING,
      DAILY_REPORT_COLUMNS.TASK_OT_EVENING,
      DAILY_REPORT_COLUMNS.PROJECT_OT_EVENING,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=daily_report_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/daily-reports/sync
 * Sync Daily Report from external systems (e.g. After-Sale, Construction)
 * and trigger Reconciliation logic.
 */
export async function syncDailyReport(req: Request, res: Response): Promise<Response> {
  try {
    const { employeeId, workDate, projectLocationId } = req.body;

    if (!employeeId || !workDate || !projectLocationId) {
      return res.status(400).json({ error: 'Missing required fields: employeeId, workDate, projectLocationId' });
    }
    
    // In a real implementation, we would save the DailyReport to Firestore here.
    logger.info(`Received sync payload for ${employeeId} on ${workDate}`);
    
    // Trigger reconciliation — ใช้ generateForEmployee (engine ใหม่) แทน matcherService.reconcile (engine เก่า)
    // generateForEmployee มี logic ครบ: isLocked, homeProjectId, HOLIDAY, LEAVE, employeeName lookup
    const record = await reconciliationService.generateForEmployee(employeeId, workDate, projectLocationId);
    
    return res.status(200).json({ success: true, record });
  } catch (error) {
    logger.error('Error syncing daily report:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}
