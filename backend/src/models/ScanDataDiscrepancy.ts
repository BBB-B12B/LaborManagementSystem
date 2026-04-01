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
  discrepancyType: 'Type1' | 'Type2' | 'Type3';
  reportedHours: number; // จาก Daily Report
  scannedHours: number; // จาก Scan Data
  scanNormalStatus: number; // 0: ไม่ครบ, 1: ปกติ
  scanStatusLabel: string; // 'ปกติ' | 'ไม่ครบ'
  hoursDifference: number; // reportedHours - scannedHours
  severity: DiscrepancySeverity; // warning ถ้า difference > 2 hours
  status: DiscrepancyStatus;
  detectionReason: string;
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  projectName?: string;
  projectCode?: string;
  detectedBy: string; // System or user ID

  // --- NEW Detailed Metrics for Persistent Storage ---
  employeeNumber?: string;
  rowNumber?: number;
  department?: string;
  
  // Time slots (from scan)
  time1?: string | null;
  time2?: string | null;
  time3?: string | null;
  time4?: string | null;
  time5?: string | null;
  time6?: string | null;
  
  // Scan breakdowns
  scanLunchStatus?: number; // 0 or 1
  scanOTMorning?: number;
  scanOTEvening?: number;
  lateMinutes?: number;
  
  // Report breakdowns (Scheduled)
  reportNormalStatus?: number; // 0 or 1
  reportOTMorning?: number;
  reportOTEvening?: number;
  reportOTNoon?: number;
  
  // Diff Labels/Values
  morningOTDiff?: string | number;
  eveningOTDiff?: string | number;
  lunchOTDiff?: string | number;
}

export interface CreateScanDataDiscrepancyInput extends Omit<ScanDataDiscrepancy, 'id' | 'createdAt' | 'status' | 'severity' | 'hoursDifference'> {
  // We'll calculate derived fields in the service
}

/**
 * คำนวณความรุนแรงของความผิดปกติ
 */
export function calculateSeverity(hoursDifference: number): DiscrepancySeverity {
  const absDiff = Math.abs(hoursDifference);
  if (absDiff >= 2) return 'error';
  if (absDiff > 0.5) return 'warning';
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
      discrepancyType: discrepancy.discrepancyType,
      reportedHours: discrepancy.reportedHours,
      scannedHours: discrepancy.scannedHours,
      scanNormalStatus: discrepancy.scanNormalStatus,
      scanStatusLabel: discrepancy.scanStatusLabel,
      hoursDifference: discrepancy.hoursDifference,
      severity: discrepancy.severity,
      status: discrepancy.status,
      detectionReason: discrepancy.detectionReason,
      resolutionNotes: discrepancy.resolutionNotes || null,
      resolvedAt: discrepancy.resolvedAt || null,
      resolvedBy: discrepancy.resolvedBy || null,
      createdAt: discrepancy.createdAt,
      detectedBy: discrepancy.detectedBy,
      projectName: discrepancy.projectName || null,
      projectCode: discrepancy.projectCode || null,
      
      // Detailed metrics
      employeeNumber: discrepancy.employeeNumber || null,
      rowNumber: discrepancy.rowNumber || 0,
      department: discrepancy.department || null,
      time1: discrepancy.time1 || null,
      time2: discrepancy.time2 || null,
      time3: discrepancy.time3 || null,
      time4: discrepancy.time4 || null,
      time5: discrepancy.time5 || null,
      time6: discrepancy.time6 || null,
      scanLunchStatus: discrepancy.scanLunchStatus || 0,
      scanOTMorning: discrepancy.scanOTMorning || 0,
      scanOTEvening: discrepancy.scanOTEvening || 0,
      lateMinutes: discrepancy.lateMinutes || 0,
      reportNormalStatus: discrepancy.reportNormalStatus || 0,
      reportOTMorning: discrepancy.reportOTMorning || 0,
      reportOTEvening: discrepancy.reportOTEvening || 0,
      reportOTNoon: discrepancy.reportOTNoon || 0,
      morningOTDiff: discrepancy.morningOTDiff || null,
      eveningOTDiff: discrepancy.eveningOTDiff || null,
      lunchOTDiff: discrepancy.lunchOTDiff || null,
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
      discrepancyType: data.discrepancyType || 'Type1',
      reportedHours: data.reportedHours,
      scannedHours: data.scannedHours,
      scanNormalStatus: data.scanNormalStatus || 0,
      scanStatusLabel: data.scanStatusLabel || 'ไม่ครบ',
      hoursDifference: data.hoursDifference,
      severity: data.severity,
      status: data.status,
      detectionReason: data.detectionReason,
      resolutionNotes: data.resolutionNotes,
      resolvedAt: data.resolvedAt?.toDate(),
      resolvedBy: data.resolvedBy,
      createdAt: data.createdAt.toDate(),
      detectedBy: data.detectedBy,
      projectName: data.projectName,
      projectCode: data.projectCode,

      // Detailed metrics
      employeeNumber: data.employeeNumber,
      rowNumber: data.rowNumber,
      department: data.department,
      time1: data.time1,
      time2: data.time2,
      time3: data.time3,
      time4: data.time4,
      time5: data.time5,
      time6: data.time6,
      scanLunchStatus: data.scanLunchStatus,
      scanOTMorning: data.scanOTMorning,
      scanOTEvening: data.scanOTEvening,
      lateMinutes: data.lateMinutes,
      reportNormalStatus: data.reportNormalStatus,
      reportOTMorning: data.reportOTMorning,
      reportOTEvening: data.reportOTEvening,
      reportOTNoon: data.reportOTNoon,
      morningOTDiff: data.morningOTDiff,
      eveningOTDiff: data.eveningOTDiff,
      lunchOTDiff: data.lunchOTDiff,
    };
  },
};
