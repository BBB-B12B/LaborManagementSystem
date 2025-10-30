/**
 * ScanDataDiscrepancy Model
 * ความผิดปกติข้อมูลสแกนนิ้ว
 *
 * Description: Records discrepancies between Daily Report hours and Scan Data hours.
 * Firestore Collection: scanDataDiscrepancies
 */

export type DiscrepancySeverity = 'info' | 'warning' | 'error';
export type DiscrepancyStatus = 'pending' | 'investigating' | 'resolved' | 'ignored';

export interface ScanDataDiscrepancy {
  id: string;
  dailyReportId: string;
  dailyContractorId: string;
  projectLocationId: string;
  workDate: Date;
  reportedHours: number; // จาก Daily Report
  scannedHours: number; // จาก Scan Data
  hoursDifference: number; // reportedHours - scannedHours
  severity: DiscrepancySeverity; // warning ถ้า difference > 2 hours
  status: DiscrepancyStatus;
  detectionReason: string;
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  detectedBy: string; // System or user ID
}

export interface CreateScanDataDiscrepancyInput {
  dailyReportId: string;
  dailyContractorId: string;
  projectLocationId: string;
  workDate: Date;
  reportedHours: number;
  scannedHours: number;
  detectionReason: string;
}

/**
 * คำนวณความรุนแรงของความผิดปกติ
 */
export function calculateSeverity(hoursDifference: number): DiscrepancySeverity {
  const absDiff = Math.abs(hoursDifference);
  if (absDiff > 2) return 'warning';
  if (absDiff > 0.5) return 'info';
  return 'info';
}

/**
 * Firestore document converter for ScanDataDiscrepancy
 */
export const scanDataDiscrepancyConverter = {
  toFirestore: (discrepancy: Omit<ScanDataDiscrepancy, 'id'>): any => {
    return {
      dailyReportId: discrepancy.dailyReportId,
      dailyContractorId: discrepancy.dailyContractorId,
      projectLocationId: discrepancy.projectLocationId,
      workDate: discrepancy.workDate,
      reportedHours: discrepancy.reportedHours,
      scannedHours: discrepancy.scannedHours,
      hoursDifference: discrepancy.hoursDifference,
      severity: discrepancy.severity,
      status: discrepancy.status,
      detectionReason: discrepancy.detectionReason,
      resolutionNotes: discrepancy.resolutionNotes || null,
      resolvedAt: discrepancy.resolvedAt || null,
      resolvedBy: discrepancy.resolvedBy || null,
      createdAt: discrepancy.createdAt,
      detectedBy: discrepancy.detectedBy,
    };
  },
  fromFirestore: (snapshot: any): ScanDataDiscrepancy => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dailyReportId: data.dailyReportId,
      dailyContractorId: data.dailyContractorId,
      projectLocationId: data.projectLocationId,
      workDate: data.workDate.toDate(),
      reportedHours: data.reportedHours,
      scannedHours: data.scannedHours,
      hoursDifference: data.hoursDifference,
      severity: data.severity,
      status: data.status,
      detectionReason: data.detectionReason,
      resolutionNotes: data.resolutionNotes,
      resolvedAt: data.resolvedAt?.toDate(),
      resolvedBy: data.resolvedBy,
      createdAt: data.createdAt.toDate(),
      detectedBy: data.detectedBy,
    };
  },
};
