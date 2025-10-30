/**
 * Overtime Controller
 * จัดการ HTTP requests สำหรับ OT (โอที)
 *
 * Endpoints:
 * - GET /api/overtime - Get all OT records with filters
 * - GET /api/overtime/:id - Get single OT record
 * - POST /api/overtime - Create new OT record
 * - PUT /api/overtime/:id - Update OT record
 * - DELETE /api/overtime/:id - Delete OT record
 * - GET /api/overtime/:id/history - Get edit history
 * - POST /api/overtime/check-overlap - Check time overlap
 */

import { Request, Response } from 'express';
import {
  createOvertimeRecord,
  updateOvertimeRecord,
  deleteOvertimeRecord,
  getOvertimeRecordById,
  getAllOvertimeRecords,
  getOvertimeRecordHistory,
  checkOTTimeOverlap,
} from '../services/overtimeService';

/**
 * GET /api/overtime
 *
 * Get all overtime records with optional filters
 *
 * Query params:
 * - projectId: Filter by project
 * - date: Filter by specific date
 * - dcId: Filter by DC
 * - startDate: Filter by date range start
 * - endDate: Filter by date range end
 * - otPeriod: Filter by OT period (morning/noon/evening)
 */
export async function getAllOTRecords(req: Request, res: Response): Promise<Response> {
  try {
    const filters: any = {};

    if (req.query.projectId) filters.projectId = req.query.projectId as string;
    if (req.query.date) filters.date = new Date(req.query.date as string);
    if (req.query.dcId) filters.dcId = req.query.dcId as string;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.otPeriod) filters.otPeriod = req.query.otPeriod as string;

    const records = await getAllOvertimeRecords(filters);

    return res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching overtime records:', error);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล OT',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/overtime/:id
 *
 * Get a single overtime record by ID
 */
export async function getOTRecordById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const record = await getOvertimeRecordById(id);

    return res.status(200).json(record);
  } catch (error) {
    console.error('Error fetching overtime record:', error);
    return res.status(404).json({
      error: 'ไม่พบข้อมูล OT',
      message: (error as Error).message,
    });
  }
}

/**
 * POST /api/overtime
 *
 * Create a new overtime record
 *
 * Body:
 * - projectLocationId: string
 * - reportDate: Date
 * - dailyContractorIds: string[] (supports multi-select)
 * - workDescription: string
 * - otPeriod: 'morning' | 'noon' | 'evening'
 * - startTime: string (HH:mm)
 * - endTime: string (HH:mm)
 * - workHours: number
 * - totalWage: number (calculated: hourlyRate * 1.5 * hours + professionalRate)
 * - isOvernight: boolean
 * - notes?: string
 * - imageUrls?: string[]
 */
export async function createOTRecord(req: Request, res: Response): Promise<Response> {
  try {
    const userId = (req as any).user?.uid; // From auth middleware

    if (!userId) {
      return res.status(401).json({ error: 'ไม่ได้รับอนุญาต' });
    }

    const data = {
      ...req.body,
      reportDate: new Date(req.body.reportDate),
    };

    const record = await createOvertimeRecord(data, userId);

    return res.status(201).json(record);
  } catch (error) {
    console.error('Error creating overtime record:', error);
    return res.status(400).json({
      error: 'เกิดข้อผิดพลาดในการสร้าง OT',
      message: (error as Error).message,
    });
  }
}

/**
 * PUT /api/overtime/:id
 *
 * Update an existing overtime record
 *
 * Body: Partial OvertimeData
 */
export async function updateOTRecord(req: Request, res: Response): Promise<Response> {
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

    const record = await updateOvertimeRecord(id, data, userId);

    return res.status(200).json(record);
  } catch (error) {
    console.error('Error updating overtime record:', error);
    return res.status(400).json({
      error: 'เกิดข้อผิดพลาดในการอัปเดท OT',
      message: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/overtime/:id
 *
 * Delete an overtime record
 */
export async function deleteOTRecord(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    await deleteOvertimeRecord(id);

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting overtime record:', error);
    return res.status(400).json({
      error: 'เกิดข้อผิดพลาดในการลบ OT',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/overtime/:id/history
 *
 * Get edit history for an overtime record
 */
export async function getOTRecordHistory(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const history = await getOvertimeRecordHistory(id);

    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching OT edit history:', error);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการดึงประวัติการแก้ไข',
      message: (error as Error).message,
    });
  }
}

/**
 * POST /api/overtime/check-overlap
 *
 * Check if time range overlaps with existing OT records or regular work
 *
 * Body:
 * - dcId: string
 * - date: Date
 * - startTime: string (HH:mm)
 * - endTime: string (HH:mm)
 * - excludeRecordId?: string
 */
export async function checkOTOverlap(req: Request, res: Response): Promise<Response> {
  try {
    const { dcId, date, startTime, endTime, excludeRecordId } = req.body;

    if (!dcId || !date || !startTime || !endTime) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาระบุ dcId, date, startTime, endTime',
      });
    }

    const result = await checkOTTimeOverlap(
      dcId,
      new Date(date),
      startTime,
      endTime,
      excludeRecordId
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error checking OT time overlap:', error);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการตรวจสอบเวลาทับซ้อน',
      message: (error as Error).message,
    });
  }
}
