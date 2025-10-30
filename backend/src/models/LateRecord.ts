/**
 * LateRecord Model
 * บันทึกการมาสาย
 *
 * Description: Records of late arrivals for daily contractors.
 * Firestore Collection: lateRecords
 */

export interface LateRecord {
  id: string;
  wagePeriodId: string;
  dailyContractorId: string;
  projectLocationId: string;
  lateDate: Date;
  scanTime: Date;
  expectedTime: Date; // Usually 08:00
  lateMinutes: number;
  lateDeduction: number; // Amount deducted from wages
  notes?: string;
  createdAt: Date;
  recordedBy: string;
}

export interface CreateLateRecordInput {
  wagePeriodId: string;
  dailyContractorId: string;
  projectLocationId: string;
  lateDate: Date;
  scanTime: Date;
  expectedTime: Date;
  lateMinutes: number;
  notes?: string;
}

/**
 * คำนวณการหักเงินจากการมาสาย
 * Calculate late deduction (implementation may vary)
 */
export function calculateLateDeduction(lateMinutes: number, hourlyRate: number): number {
  // ตัวอย่าง: หัก 1 ชั่วโมงสำหรับการมาสาย 15 นาทีขึ้นไป
  if (lateMinutes >= 15) {
    return hourlyRate; // หัก 1 ชั่วโมง
  }
  return 0;
}

/**
 * Firestore document converter for LateRecord
 */
export const lateRecordConverter = {
  toFirestore: (record: Omit<LateRecord, 'id'>): any => {
    return {
      wagePeriodId: record.wagePeriodId,
      dailyContractorId: record.dailyContractorId,
      projectLocationId: record.projectLocationId,
      lateDate: record.lateDate,
      scanTime: record.scanTime,
      expectedTime: record.expectedTime,
      lateMinutes: record.lateMinutes,
      lateDeduction: record.lateDeduction,
      notes: record.notes || null,
      createdAt: record.createdAt,
      recordedBy: record.recordedBy,
    };
  },
  fromFirestore: (snapshot: any): LateRecord => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      wagePeriodId: data.wagePeriodId,
      dailyContractorId: data.dailyContractorId,
      projectLocationId: data.projectLocationId,
      lateDate: data.lateDate.toDate(),
      scanTime: data.scanTime.toDate(),
      expectedTime: data.expectedTime.toDate(),
      lateMinutes: data.lateMinutes,
      lateDeduction: data.lateDeduction,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
      recordedBy: data.recordedBy,
    };
  },
};
