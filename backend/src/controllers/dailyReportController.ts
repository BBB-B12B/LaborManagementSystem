/**
 * Daily Report Controller
 * จัดการ HTTP requests สำหรับรายงานการทำงานรายวัน
 *
 * Endpoints:
 * - GET /api/daily-reports - Get all reports with filters
 * - GET /api/daily-reports/:id - Get single report
 * - POST /api/daily-reports - Create new report
 * - PUT /api/daily-reports/:id - Update report
 * - DELETE /api/daily-reports/:id - Delete report
 * - GET /api/daily-reports/:id/history - Get edit history
 * - POST /api/daily-reports/check-overlap - Check time overlap
 */

import { Request, Response } from 'express';
import {
  createDailyReport,
  updateDailyReport,
  deleteDailyReport,
  getDailyReportById,
  getAllDailyReports,
  getDailyReportHistory,
  checkTimeOverlap,
} from '../services/dailyReportService';

/**
 * GET /api/daily-reports
 *
 * Get all daily reports with optional filters
 *
 * Query params:
 * - projectId: Filter by project
 * - date: Filter by specific date
 * - dcId: Filter by DC
 * - startDate: Filter by date range start
 * - endDate: Filter by date range end
 * - workType: Filter by work type
 */
export async function getAllReports(req: Request, res: Response): Promise<Response> {
  try {
    const filters: any = {};

    if (req.query.projectId) filters.projectId = req.query.projectId as string;
    if (req.query.date) filters.date = new Date(req.query.date as string);
    if (req.query.dcId) filters.dcId = req.query.dcId as string;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.workType) filters.workType = req.query.workType as string;

    const reports = await getAllDailyReports(filters);

    return res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching daily reports:', error);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/daily-reports/:id
 *
 * Get a single daily report by ID
 */
export async function getReportById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const report = await getDailyReportById(id);

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error fetching daily report:', error);
    return res.status(404).json({
      error: 'ไม่พบรายงานการทำงาน',
      message: (error as Error).message,
    });
  }
}

/**
 * POST /api/daily-reports
 *
 * Create a new daily report
 *
 * Body:
 * - projectLocationId: string
 * - reportDate: Date
 * - dailyContractorIds: string[] (supports multi-select)
 * - workDescription: string
 * - startTime: string (HH:mm)
 * - endTime: string (HH:mm)
 * - workHours: number
 * - totalWage: number
 * - workType: 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening'
 * - isOvernight: boolean
 * - notes?: string
 * - imageUrls?: string[]
 */
export async function createReport(req: Request, res: Response): Promise<Response> {
  try {
    const userId = (req as any).user?.uid; // From auth middleware

    if (!userId) {
      return res.status(401).json({ error: 'ไม่ได้รับอนุญาต' });
    }

    const data = {
      ...req.body,
      reportDate: new Date(req.body.reportDate),
    };

    const report = await createDailyReport(data, userId);

    return res.status(201).json(report);
  } catch (error) {
    console.error('Error creating daily report:', error);
    return res.status(400).json({
      error: 'เกิดข้อผิดพลาดในการสร้างรายงาน',
      message: (error as Error).message,
    });
  }
}

/**
 * PUT /api/daily-reports/:id
 *
 * Update an existing daily report
 *
 * Body: Partial DailyReportData
 */
export async function updateReport(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'ไม่ได้รับอนุญาต' });
    }

    const data = {
      ...req.body,
      reportDate: req.body.reportDate ? new Date(req.body.reportDate) : undefined,
    };

    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    const report = await updateDailyReport(id, data, userId);

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error updating daily report:', error);
    return res.status(400).json({
      error: 'เกิดข้อผิดพลาดในการอัปเดทรายงาน',
      message: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/daily-reports/:id
 *
 * Delete a daily report
 */
export async function deleteReport(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    await deleteDailyReport(id);

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting daily report:', error);
    return res.status(400).json({
      error: 'เกิดข้อผิดพลาดในการลบรายงาน',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/daily-reports/:id/history
 *
 * Get edit history for a daily report
 */
export async function getReportHistory(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const history = await getDailyReportHistory(id);

    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching edit history:', error);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการดึงประวัติการแก้ไข',
      message: (error as Error).message,
    });
  }
}

/**
 * POST /api/daily-reports/check-overlap
 *
 * Check if time range overlaps with existing reports
 *
 * Body:
 * - dcId: string
 * - date: Date
 * - startTime: string (HH:mm)
 * - endTime: string (HH:mm)
 * - excludeReportId?: string
 */
export async function checkOverlap(req: Request, res: Response): Promise<Response> {
  try {
    const { dcId, date, startTime, endTime, excludeReportId } = req.body;

    if (!dcId || !date || !startTime || !endTime) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาระบุ dcId, date, startTime, endTime',
      });
    }

    const result = await checkTimeOverlap(
      dcId,
      new Date(date),
      startTime,
      endTime,
      excludeReportId
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error checking time overlap:', error);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการตรวจสอบเวลาทับซ้อน',
      message: (error as Error).message,
    });
  }
}
