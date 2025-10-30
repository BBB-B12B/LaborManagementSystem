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

export interface DailyReportData {
  projectLocationId: string;
  reportDate: Date;
  dailyContractorIds: string[];
  workDescription: string;
  startTime: string;
  endTime: string;
  workHours: number;
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
  const { dailyContractorIds, imageUrls, ...commonData } = data;

  // Handle image uploads if provided
  let uploadedImageUrls: string[] = [];
  if (imageUrls && imageUrls.length > 0) {
    uploadedImageUrls = await uploadImages(imageUrls);
  }

  // Multi-DC: Create separate report for each DC
  if (dailyContractorIds.length > 1) {
    const reports = [];

    for (const dcId of dailyContractorIds) {
      const reportRef = db.collection('daily_reports').doc();

      const reportData = {
        ...commonData,
        dailyContractorIds: [dcId], // Single DC per report
        imageUrls: uploadedImageUrls,
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

  const reportData = {
    ...commonData,
    dailyContractorIds,
    imageUrls: uploadedImageUrls,
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
      .where('reportDate', '>=', startOfDay)
      .where('reportDate', '<=', endOfDay);
  }

  if (filters?.dcId) {
    query = query.where('dailyContractorIds', 'array-contains', filters.dcId);
  }

  if (filters?.startDate && filters?.endDate) {
    query = query
      .where('reportDate', '>=', filters.startDate)
      .where('reportDate', '<=', filters.endDate);
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
    .where('dailyContractorIds', 'array-contains', dcId)
    .where('reportDate', '>=', startOfDay)
    .where('reportDate', '<=', endOfDay)
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
