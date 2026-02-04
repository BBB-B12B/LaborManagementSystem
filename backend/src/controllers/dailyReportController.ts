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
 * DELETE /api/daily-reports/project/:projectId/date/:date/entry/:entryId
 * Remove a Work Entry
 */
export async function removeWorkEntry(req: Request, res: Response): Promise<Response> {
  try {
    const { projectId, date, entryId } = req.params;
    const userId = (req as any).user?.uid;

    await dailyReportService.removeWorkEntry(
      projectId,
      new Date(date),
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
