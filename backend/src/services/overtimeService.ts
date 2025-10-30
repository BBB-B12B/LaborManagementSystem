/**
 * Overtime Service (Backend)
 * บริการจัดการข้อมูล OT (โอที) (Backend)
 *
 * Business logic for overtime records:
 * - CRUD operations with Firestore
 * - Edit history tracking
 * - Time overlap validation (with other OT and regular work)
 * - Multi-DC record creation
 * - OT wage calculation (1.5x base rate)
 * - Image upload to Cloudflare R2
 */

import { db } from '../config/firebase';
import { storage } from '../config/storage';
import { FieldValue } from 'firebase-admin/firestore';

export interface OvertimeData {
  projectLocationId: string;
  reportDate: Date;
  dailyContractorIds: string[];
  workDescription: string;
  otPeriod: 'morning' | 'noon' | 'evening';
  startTime: string;
  endTime: string;
  workHours: number;
  totalWage: number;
  isOvernight: boolean;
  notes?: string;
  imageUrls?: string[];
}

export interface EditHistoryData {
  entityId: string;
  entityType: 'overtime_record';
  action: 'create' | 'update';
  editedBy: string;
  changedFields?: Record<string, { before: any; after: any }>;
  notes?: string;
}

type OvertimeRecordWithId = OvertimeData & { id: string };
type DailyReportRecordWithId = {
  id: string;
  startTime: string;
  endTime: string;
  [key: string]: unknown;
};

/**
 * OT Period Time Ranges
 */
const OT_PERIODS = {
  morning: { start: '03:00', end: '08:00' },
  noon: { start: '12:00', end: '13:00' },
  evening: { start: '17:00', end: '22:00' },
} as const;

/**
 * Create a new overtime record
 *
 * - Supports single or multiple DCs
 * - Creates edit history for audit trail
 * - Uploads images to R2 if provided
 * - Validates OT period time ranges
 * - Calculates OT wage (1.5x base rate)
 */
export async function createOvertimeRecord(
  data: OvertimeData,
  createdBy: string
): Promise<any | any[]> {
  const { dailyContractorIds, imageUrls, ...commonData } = data;

  const periodConfig = OT_PERIODS[data.otPeriod];
  if (!periodConfig) {
    throw new Error('Invalid OT period');
  }

  if (
    data.startTime < periodConfig.start ||
    data.endTime > periodConfig.end
  ) {
    throw new Error('OT time is outside the configured period');
  }

  // Handle image uploads if provided
  let uploadedImageUrls: string[] = [];
  if (imageUrls && imageUrls.length > 0) {
    uploadedImageUrls = await uploadImages(imageUrls);
  }

  // Multi-DC: Create separate record for each DC
  if (dailyContractorIds.length > 1) {
    const records = [];

    for (const dcId of dailyContractorIds) {
      const recordRef = db.collection('overtime_records').doc();

      const recordData = {
        ...commonData,
        dailyContractorIds: [dcId], // Single DC per record
        imageUrls: uploadedImageUrls,
        createdBy,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await recordRef.set(recordData);

      // Create edit history for audit trail
      await createEditHistory({
        entityId: recordRef.id,
        entityType: 'overtime_record',
        action: 'create',
        editedBy: createdBy,
        notes: 'สร้าง OT ใหม่',
      });

      records.push({ id: recordRef.id, ...recordData });
    }

    return records;
  }

  // Single DC: Create one record
  const recordRef = db.collection('overtime_records').doc();

  const recordData = {
    ...commonData,
    dailyContractorIds,
    imageUrls: uploadedImageUrls,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await recordRef.set(recordData);

  // Create edit history
  await createEditHistory({
    entityId: recordRef.id,
    entityType: 'overtime_record',
    action: 'create',
    editedBy: createdBy,
    notes: 'สร้าง OT ใหม่',
  });

  return { id: recordRef.id, ...recordData };
}

/**
 * Update an existing overtime record
 *
 * - Tracks changes in edit history
 * - Calculates before/after for each field
 * - Recalculates OT wage if hours or rate changed
 */
export async function updateOvertimeRecord(
  id: string,
  data: Partial<OvertimeData>,
  editedBy: string
): Promise<any> {
  const recordRef = db.collection('overtime_records').doc(id);
  const recordDoc = await recordRef.get();

  if (!recordDoc.exists) {
    throw new Error('ไม่พบข้อมูล OT');
  }

  const beforeData = recordDoc.data();

  if (data.otPeriod) {
    const periodConfig = OT_PERIODS[data.otPeriod];
    if (!periodConfig) {
      throw new Error('Invalid OT period');
    }

    const updatedStart = (data.startTime ?? beforeData?.startTime) as string | undefined;
    const updatedEnd = (data.endTime ?? beforeData?.endTime) as string | undefined;

    if (
      updatedStart &&
      updatedEnd &&
      (updatedStart < periodConfig.start || updatedEnd > periodConfig.end)
    ) {
      throw new Error('OT time is outside the configured period');
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

  await recordRef.update(updateData);

  // Calculate changed fields for edit history
  const changedFields: Record<string, { before: any; after: any }> = {};
  Object.keys(data).forEach((key) => {
    const beforeValue = beforeData?.[key];
    const afterValue = data[key as keyof OvertimeData];

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
    entityType: 'overtime_record',
    action: 'update',
    editedBy,
    changedFields,
    notes: 'แก้ไข OT',
  });

  const updatedDoc = await recordRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() };
}

/**
 * Delete an overtime record
 */
export async function deleteOvertimeRecord(id: string): Promise<void> {
  const recordRef = db.collection('overtime_records').doc(id);
  const recordDoc = await recordRef.get();

  if (!recordDoc.exists) {
    throw new Error('ไม่พบข้อมูล OT');
  }

  // Hard delete
  await recordRef.delete();
}

/**
 * Get overtime record by ID
 */
export async function getOvertimeRecordById(id: string): Promise<any> {
  const recordDoc = await db.collection('overtime_records').doc(id).get();

  if (!recordDoc.exists) {
    throw new Error('ไม่พบข้อมูล OT');
  }

  return { id: recordDoc.id, ...recordDoc.data() };
}

/**
 * Get all overtime records with filters
 */
export async function getAllOvertimeRecords(filters?: {
  projectId?: string;
  date?: Date;
  dcId?: string;
  startDate?: Date;
  endDate?: Date;
  otPeriod?: 'morning' | 'noon' | 'evening';
}): Promise<any[]> {
  let query: any = db.collection('overtime_records');

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

  if (filters?.otPeriod) {
    query = query.where('otPeriod', '==', filters.otPeriod);
  }

  // Order by date descending
  query = query.orderBy('reportDate', 'desc');

  const snapshot = await query.get();
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get edit history for an overtime record
 */
export async function getOvertimeRecordHistory(id: string): Promise<any[]> {
  const historySnapshot = await db
    .collection('edit_history')
    .where('entityId', '==', id)
    .where('entityType', '==', 'overtime_record')
    .orderBy('editedAt', 'desc')
    .get();

  return historySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Check time overlap with other OT periods and regular work
 *
 * FR-OT-006: Validates that DC doesn't have overlapping OT periods on same day
 * FR-OT-007: Validates that OT doesn't overlap with regular work hours
 */
export async function checkOTTimeOverlap(
  dcId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeRecordId?: string
): Promise<{ hasOverlap: boolean; overlappingRecords: any[] }> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Check overlap with other OT records
  const otRecordsSnapshot = await db
    .collection('overtime_records')
    .where('dailyContractorIds', 'array-contains', dcId)
    .where('reportDate', '>=', startOfDay)
    .where('reportDate', '<=', endOfDay)
    .get();

  const overlappingOTRecords: OvertimeRecordWithId[] = otRecordsSnapshot.docs
    .filter((doc) => doc.id !== excludeRecordId)
    .map(
      (doc) =>
        ({ id: doc.id, ...(doc.data() as OvertimeData) } as OvertimeRecordWithId)
    )
    .filter((record) =>
      timeRangesOverlap(startTime, endTime, record.startTime, record.endTime)
    );

  // Check overlap with regular work hours (daily_reports)
  const dailyReportsSnapshot = await db
    .collection('daily_reports')
    .where('dailyContractorIds', 'array-contains', dcId)
    .where('reportDate', '>=', startOfDay)
    .where('reportDate', '<=', endOfDay)
    .get();

  const overlappingDailyReports: DailyReportRecordWithId[] = dailyReportsSnapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>),
        } as DailyReportRecordWithId)
    )
    .filter(
      (report) =>
        typeof report.startTime === 'string' &&
        typeof report.endTime === 'string' &&
        timeRangesOverlap(startTime, endTime, report.startTime, report.endTime)
    );

  const allOverlapping = [...overlappingOTRecords, ...overlappingDailyReports];

  return {
    hasOverlap: allOverlapping.length > 0,
    overlappingRecords: allOverlapping,
  };
}

/**
 * Calculate OT wage
 * OT rate = baseRate * 1.5 * hours + professionalRate
 */
export function calculateOTWage(
  hourlyRate: number,
  professionalRate: number,
  hours: number
): number {
  return Math.round(hourlyRate * 1.5 * hours + professionalRate);
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
    const url = await storage.uploadFile(imageUrl, 'overtime');
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
