/**
 * Daily Report Service (Backend)
 * บริการจัดการข้อมูลรายงานการทำงานรายวัน (Backend)
 *
 * Business logic for daily reports:
 * - CRUD operations with Firestore
 * - Edit history tracking
 * - Time overlap validation
 * - Multi-DC report creation
 * - Image upload to Cloudflare R2
 */

import { db } from '../config/firebase';
import { storage } from '../config/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { dailyContractorService } from './dailyContractor/DailyContractorService';
import { wagePeriodService } from './wage/WagePeriodService';
import { AppError } from '../api/middleware/errorHandler';
import * as XLSX from 'xlsx';
import { parseExcelRow } from '../utils/dailyReportExcel';

export interface DailyReportData {
  projectLocationId: string;
  workDate: Date;
  dailyContractorIds: string[];
  taskId?: string;
  taskName: string;
  startTime: string;
  endTime: string;
  netHours: number;
  totalWage: number;
  workType: 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening';
  isOvernight: boolean;
  notes?: string;
  imageUrls?: string[];
}

export interface EditHistoryData {
  entityId: string;
  entityType: 'daily_report';
  action: 'create' | 'update';
  editedBy: string;
  changedFields?: Record<string, { before: any; after: any }>;
  notes?: string;
}

type DailyReportRecord = DailyReportData & { id: string };

/**
 * Create a new daily report
 *
 * - Supports single or multiple DCs
 * - Creates edit history for audit trail
 * - Uploads images to R2 if provided
 */
export async function createDailyReport(
  data: DailyReportData,
  createdBy: string
): Promise<any | any[]> {
  const { dailyContractorIds, imageUrls, taskId, ...commonData } = data;

  // Handle image uploads if provided
  let uploadedImageUrls: string[] = [];
  if (imageUrls && imageUrls.length > 0) {
    uploadedImageUrls = await uploadImages(imageUrls);
  }

  // [P2] Data Locking: Prevent creation on locked dates
  let finalProjectCode = '';
  if (data.projectLocationId) {
     const project = await db.collection('Project').doc(data.projectLocationId).get();
     finalProjectCode = project.data()?.code || '';
  }
  
  if (data.workDate) {
    const isLocked = await wagePeriodService.isDateLocked(data.workDate, finalProjectCode);
    if (isLocked) {
      throw new AppError('ไม่สามารถสร้างข้อมูลได้ เนื่องจากงวดค่าแรงนี้ได้รับการอนุมัติหรือจ่ายเงินแล้ว', 403);
    }
  }

  // Multi-DC: Create separate report for each DC
  if (dailyContractorIds.length > 1) {
    const reports = [];

    for (const dcId of dailyContractorIds) {
      const reportRef = db.collection('daily_reports').doc();

      // [T-400] Fetch employeeId for denormalization
      const dc = await dailyContractorService.getById(dcId);

      const reportData = {
        ...commonData,
        taskId: taskId || null,
        dailyContractorId: dcId, // Use singular field
        employeeId: dc?.employeeId || null, // [T-400] Link to ScanData
        verificationStatus: 'unverified' as const, // [T-401] Initial status
        imageUrls: uploadedImageUrls,
        status: 'submitted',
        isDeleted: false,
        version: 1,
        createdBy,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await reportRef.set(reportData);

      // Create edit history for audit trail
      await createEditHistory({
        entityId: reportRef.id,
        entityType: 'daily_report',
        action: 'create',
        editedBy: createdBy,
        notes: 'สร้างรายการใหม่',
      });

      reports.push({ id: reportRef.id, ...reportData });
    }

    return reports;
  }

  // Single DC: Create one report
  const reportRef = db.collection('daily_reports').doc();

  // [T-400] Fetch employeeId for denormalization
  const dc = await dailyContractorService.getById(dailyContractorIds[0]);

  const reportData = {
    ...commonData,
    taskId: taskId || null,
    dailyContractorId: dailyContractorIds[0], // Use singular field
    employeeId: dc?.employeeId || null, // [T-400] Link to ScanData
    verificationStatus: 'unverified' as const, // [T-401] Initial status
    imageUrls: uploadedImageUrls,
    status: 'submitted',
    isDeleted: false,
    version: 1,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await reportRef.set(reportData);

  // Create edit history
  await createEditHistory({
    entityId: reportRef.id,
    entityType: 'daily_report',
    action: 'create',
    editedBy: createdBy,
    notes: 'สร้างรายการใหม่',
  });

  // [T-400] Auto-update Task status to 'in-progress' if taskId is provided
  if (taskId) {
    try {
      // Import here to avoid circular dependency if any, or use from top
      const { taskService } = await import('./TaskService');
      await taskService.updateTaskStatus(taskId, 'in-progress', createdBy);
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  }

  return { id: reportRef.id, ...reportData };
}

/**
 * Update an existing daily report
 *
 * - Tracks changes in edit history
 * - Calculates before/after for each field
 */
export async function updateDailyReport(
  id: string,
  data: Partial<DailyReportData>,
  editedBy: string
): Promise<any> {
  const reportRef = db.collection('daily_reports').doc(id);
  const reportDoc = await reportRef.get();

  if (!reportDoc.exists) {
    throw new Error('ไม่พบรายงานการทำงาน');
  }

  const beforeData = reportDoc.data();

  if (beforeData) {
    // [P2] Data Locking: Check if the original or new date is locked
    const originalDate = (beforeData.workDate as any)?.toDate ? (beforeData.workDate as any).toDate() : beforeData.workDate;
    const projectCode = beforeData.projectCode || ''; 
    
    if (originalDate) {
      // For now, let's look up projectCode from projectLocationId if not present
      let finalProjectCode = projectCode;
      if (!finalProjectCode && beforeData.projectLocationId) {
         const project = await db.collection('Project').doc(beforeData.projectLocationId).get();
         finalProjectCode = project.data()?.code || '';
      }

      const isLocked = await wagePeriodService.isDateLocked(originalDate, finalProjectCode);
      if (isLocked) {
        throw new AppError('ไม่สามารถแก้ไขข้อมูลได้ เนื่องจากงวดค่าแรงนี้ได้รับการอนุมัติหรือจ่ายเงินแล้ว', 403);
      }
    }
  }

  // Handle image uploads if new images provided
  let uploadedImageUrls = data.imageUrls || [];
  if (data.imageUrls && data.imageUrls.some((url) => url.startsWith('data:'))) {
    uploadedImageUrls = await uploadImages(data.imageUrls);
  }

  const updateData = {
    ...data,
    imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Remove undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key as keyof typeof updateData] === undefined) {
      delete updateData[key as keyof typeof updateData];
    }
  });

  // [T-400] If dailyContractorId is changed, update employeeId accordingly
  if (data.dailyContractorIds && data.dailyContractorIds.length > 0) {
    const dc = await dailyContractorService.getById(data.dailyContractorIds[0]);
    (updateData as any).dailyContractorId = data.dailyContractorIds[0];
    (updateData as any).employeeId = dc?.employeeId || null;
    (updateData as any).verificationStatus = 'unverified'; // Reset status on DC change
  }

  await reportRef.update(updateData);

  // Calculate changed fields for edit history
  const changedFields: Record<string, { before: any; after: any }> = {};
  Object.keys(data).forEach((key) => {
    const beforeValue = beforeData?.[key];
    const afterValue = data[key as keyof DailyReportData];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changedFields[key] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  });

  // Create edit history
  await createEditHistory({
    entityId: id,
    entityType: 'daily_report',
    action: 'update',
    editedBy,
    changedFields,
    notes: 'แก้ไขรายการ',
  });

  const updatedDoc = await reportRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() };
}

/**
 * Delete a daily report
 *
 * Can implement soft delete by adding deletedAt field
 */
export async function deleteDailyReport(id: string): Promise<void> {
  const reportRef = db.collection('daily_reports').doc(id);
  const reportDoc = await reportRef.get();

  if (!reportDoc.exists) {
    throw new Error('ไม่พบรายงานการทำงาน');
  }

  const beforeData = reportDoc.data();

  if (beforeData) {
    // [P2] Data Locking: Prevent deletion on locked dates
    const originalDate = (beforeData.workDate as any)?.toDate ? (beforeData.workDate as any).toDate() : beforeData.workDate;
    
    if (originalDate) {
      let finalProjectCode = beforeData.projectCode || '';
      if (!finalProjectCode && beforeData.projectLocationId) {
         const project = await db.collection('Project').doc(beforeData.projectLocationId).get();
         finalProjectCode = project.data()?.code || '';
      }

      const isLocked = await wagePeriodService.isDateLocked(originalDate, finalProjectCode);
      if (isLocked) {
        throw new AppError('ไม่สามารถลบข้อมูลได้ เนื่องจากงวดค่าแรงนี้ได้รับการอนุมัติหรือจ่ายเงินแล้ว', 403);
      }
    }
  }

  // Hard delete
  await reportRef.delete();

  // Optional: Soft delete
  // await reportRef.update({
  //   deletedAt: FieldValue.serverTimestamp(),
  //   updatedAt: FieldValue.serverTimestamp(),
  // });
}

/**
 * Get daily report by ID
 */
export async function getDailyReportById(id: string): Promise<any> {
  const reportDoc = await db.collection('daily_reports').doc(id).get();

  if (!reportDoc.exists) {
    throw new Error('ไม่พบรายงานการทำงาน');
  }

  return { id: reportDoc.id, ...reportDoc.data() };
}

/**
 * Get all daily reports with filters
 */
export async function getAllDailyReports(filters?: {
  projectId?: string;
  date?: Date;
  dcId?: string;
  startDate?: Date;
  endDate?: Date;
  workType?: string;
}): Promise<any[]> {
  let query: any = db.collection('daily_reports');

  // Apply filters
  if (filters?.projectId) {
    query = query.where('projectLocationId', '==', filters.projectId);
  }

  if (filters?.date) {
    const startOfDay = new Date(filters.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filters.date);
    endOfDay.setHours(23, 59, 59, 999);

    query = query
      .where('workDate', '>=', startOfDay)
      .where('workDate', '<=', endOfDay);
  }

  if (filters?.dcId) {
    query = query.where('dailyContractorId', '==', filters.dcId);
  }

  if (filters?.startDate && filters?.endDate) {
    query = query
      .where('workDate', '>=', filters.startDate)
      .where('workDate', '<=', filters.endDate);
  }

  if (filters?.workType) {
    query = query.where('workType', '==', filters.workType);
  }

  // Order by date descending
  query = query.orderBy('reportDate', 'desc');

  const snapshot = await query.get();
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get edit history for a daily report
 */
export async function getDailyReportHistory(id: string): Promise<any[]> {
  const historySnapshot = await db
    .collection('edit_history')
    .where('entityId', '==', id)
    .where('entityType', '==', 'daily_report')
    .orderBy('editedAt', 'desc')
    .get();

  return historySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Check time overlap with existing reports
 *
 * Validates that DC doesn't have overlapping work hours on same day
 */
export async function checkTimeOverlap(
  dcId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeReportId?: string
): Promise<{ hasOverlap: boolean; overlappingReports: any[] }> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const reportsSnapshot = await db
    .collection('daily_reports')
    .where('dailyContractorId', '==', dcId)
    .where('workDate', '>=', startOfDay)
    .where('workDate', '<=', endOfDay)
    .get();

  const overlappingReports = reportsSnapshot.docs
    .filter((doc) => doc.id !== excludeReportId)
    .map<DailyReportRecord>((doc) => ({ id: doc.id, ...(doc.data() as DailyReportData) }))
    .filter((report) => {
      // Check if time ranges overlap
      return timeRangesOverlap(
        startTime,
        endTime,
        report.startTime,
        report.endTime
      );
    });

  return {
    hasOverlap: overlappingReports.length > 0,
    overlappingReports,
  };
}

/**
 * Create edit history entry
 */
async function createEditHistory(data: EditHistoryData): Promise<void> {
  const historyRef = db.collection('edit_history').doc();

  await historyRef.set({
    ...data,
    editedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Upload images to Cloudflare R2
 */
async function uploadImages(imageUrls: string[]): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (const imageUrl of imageUrls) {
    // Skip if already uploaded (not a data URL)
    if (!imageUrl.startsWith('data:')) {
      uploadedUrls.push(imageUrl);
      continue;
    }

    // Upload to R2
    const url = await storage.uploadFile(imageUrl, 'daily-reports');
    uploadedUrls.push(url);
  }

  return uploadedUrls;
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const [h1Start, m1Start] = start1.split(':').map(Number);
  const [h1End, m1End] = end1.split(':').map(Number);
  const [h2Start, m2Start] = start2.split(':').map(Number);
  const [h2End, m2End] = end2.split(':').map(Number);

  const minutes1Start = h1Start * 60 + m1Start;
  const minutes1End = h1End * 60 + m1End;
  const minutes2Start = h2Start * 60 + m2Start;
  const minutes2End = h2End * 60 + m2End;

  // Check overlap
  return (
    (minutes1Start < minutes2End && minutes1End > minutes2Start) ||
    (minutes2Start < minutes1End && minutes2End > minutes1Start)
  );
}
/**
 * Parse Excel for Daily Report Import
 *
 * - Reads Excel Buffer
 * - Maps columns to internal fields
 * - Validates Project Code and Employee ID
 */
export async function parseDailyReportExcel(
  buffer: Buffer
): Promise<any[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  const results: any[] = [];

  for (const row of rows) {
    const parsed = parseExcelRow(row);
    if (!parsed) continue;

    // 1. Lookup Project by Code
    const projectSnapshot = await db
      .collection('Project')
      .where('code', '==', parsed.projectCode)
      .limit(1)
      .get();
    
    // In case 'code' is not what we want, try 'projectCode' (T-360)
    let project = projectSnapshot.empty ? null : projectSnapshot.docs[0];
    if (!project) {
        const p2Snapshot = await db.collection('Project').where('projectCode', '==', parsed.projectCode).limit(1).get();
        project = p2Snapshot.empty ? null : p2Snapshot.docs[0];
    }

    // 2. Lookup DC by Employee ID
    const dcSnapshot = await db
      .collection('daily_contractors')
      .where('employeeId', '==', parsed.employeeId)
      .limit(1)
      .get();
    const dc = dcSnapshot.empty ? null : dcSnapshot.docs[0];

    // 3. Calculate Hours (T-370-3 User Request)
    let netHours = parsed.hours;
    if (netHours === undefined || isNaN(netHours)) {
      // Calculate from time
      const [h1, m1] = parsed.startTime.split(':').map(Number);
      const [h2, m2] = parsed.endTime.split(':').map(Number);
      const total = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
      
      // If regular, subtract 1h lunch
      const breakHours = parsed.workType === 'regular' ? 1.0 : 0;
      netHours = Math.max(0, total - breakHours);
    }

    results.push({
      ...parsed,
      projectLocationId: project?.id || null,
      projectName: (project?.data() as any)?.name || 'ไมพบโครงการ',
      dailyContractorId: dc?.id || null,
      matchedWorkerName: (dc?.data() as any)?.name || 'ไม่พบพนักงาน',
      netHours,
      isValid: !!project && !!dc,
    });
  }

  return results;
}

/**
 * Bulk save daily reports from Excel
 */
export async function bulkCreateDailyReports(
    data: any[],
    createdBy: string
): Promise<number> {
    let count = 0;
    for (const item of data) {
        // Find existing report or create new one for the day-project
        // For simplicity in this bulk import, we'll create individual reports
        // similar to createDailyReport's logic
        try {
            await createDailyReport({
                projectLocationId: item.projectLocationId,
                workDate: new Date(item.date),
                dailyContractorIds: [item.dailyContractorId],
                taskId: item.taskId,
                taskName: item.taskName,
                startTime: item.startTime,
                endTime: item.endTime,
                netHours: item.netHours,
                totalWage: 0, // Will be calculated by WagePeriodService
                workType: item.workType,
                isOvernight: false,
                notes: `Imported from Excel: ${item.notes || ''}`,
            }, createdBy);
            count++;
        } catch (error) {
            console.error(`Failed to import row for employee ${item.employeeId}:`, error);
        }
    }
    return count;
}
