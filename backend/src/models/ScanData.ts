/**
 * ScanData Model (Daily Aggregation)
 * ข้อมูลสแกนนิ้วแบบรายวัน (1 คน 1 วัน 1 เอกสาร)
 *
 * Description: Aggregated fingerprint scan records for a specific employee on a specific date.
 * Firestore Collection: scanData
 * Document ID Format: SCAN_[employeeId]_[workDate] (e.g., SCAN_200247_2025-10-21)
 */

export interface ScanData {
  id: string; // SCAN_[employeeId]_[workDate]
  employeeId: string;
  employeeNumber?: string; // Cache for display
  projectLocationId: string;
  workDate: string; // YYYY-MM-DD

  // Aggregated Punches
  punches: string[]; // ["07:42", "12:00", "13:00", "17:05"] (Sorted HH:mm)
  firstIn: string; // "07:42" (From punches[0])
  lastOut: string; // "17:05" (From punches[length-1])

  // Status Flags
  isDeleted: boolean; // Soft Delete
  deletedAt?: Date;
  deletedBy?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  importedAt: Date;
  importedBy: string;
  importBatchId?: string;
  importSource?: string;
  importNote?: string;

  // Legacy / Compatibility (Optional)
  notes?: string;
  rawData?: Record<string, unknown>;
}

export interface CreateScanDataInput {
  dailyContractorId?: string; // Deprecated but might be needed for lookup
  employeeId: string;
  projectLocationId: string;
  scanDateTime: Date; // Used to derive workDate and punch time
  importNote?: string;
}

/**
 * Format Date to YYYY-MM-DD
 */
export function formatWorkDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format Date to HH:mm
 */
export function formatPunchTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Generate Document ID
 */
export function generateScanDocId(employeeId: string, workDate: string): string {
  return `SCAN_${employeeId}_${workDate}`;
}

/**
 * Firestore document converter for ScanData
 */
export const scanDataConverter = {
  toFirestore: (data: Omit<ScanData, 'id'>): any => {
    return {
      employeeId: data.employeeId,
      employeeNumber: data.employeeNumber || null,
      projectLocationId: data.projectLocationId,
      workDate: data.workDate,
      punches: data.punches,
      firstIn: data.firstIn,
      lastOut: data.lastOut,
      isDeleted: data.isDeleted,
      deletedAt: data.deletedAt || null,
      deletedBy: data.deletedBy || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      importedAt: data.importedAt,
      importedBy: data.importedBy,
      importBatchId: data.importBatchId || null,
      importSource: data.importSource || null,
      importNote: data.importNote || null,
      notes: data.notes || null,
      rawData: data.rawData || null,
    };
  },
  fromFirestore: (snapshot: any): ScanData => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      employeeNumber: data.employeeNumber,
      projectLocationId: data.projectLocationId,
      workDate: data.workDate,
      punches: data.punches || [],
      firstIn: data.firstIn || '',
      lastOut: data.lastOut || '',
      isDeleted: data.isDeleted || false,
      deletedAt: data.deletedAt?.toDate(),
      deletedBy: data.deletedBy,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      importedAt: data.importedAt?.toDate(),
      importedBy: data.importedBy,
      importBatchId: data.importBatchId,
      importSource: data.importSource,
      importNote: data.importNote,
      notes: data.notes,
      rawData: data.rawData,
    };
  },
};

