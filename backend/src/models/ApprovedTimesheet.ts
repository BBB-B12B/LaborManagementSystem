/**
 * ApprovedTimesheet Model
 * ตารางสรุปเวลาการทำงานที่ได้รับการอนุมัติแล้ว
 *
 * Description: Immutable record of approved working hours per employee per day.
 *              This is the Single Source of Truth for payroll calculation.
 *              Every record must be explicitly approved by an Admin — no auto-approval.
 *
 * Firestore Collection: approvedTimesheets
 * Document ID Format: ATS_[employeeId]_[workDate]  e.g. ATS_EMP001_2026-04-23
 */

import type { ApprovalSource } from './ReconciliationRecord';

// ---------------------------------------------------------------------------
// Main Interface
// ---------------------------------------------------------------------------

export interface ApprovedTimesheet {
  id: string;                        // ATS_{employeeId}_{workDate}
  employeeId: string;
  employeeName?: string;             // Cache สำหรับ UI / Export
  workDate: string;                  // YYYY-MM-DD
  projectLocationId: string;
  projectName?: string;              // Cache สำหรับ UI / Export

  // --- ชั่วโมงที่ใช้คำนวณค่าจ้าง ---
  approvedHours: number;             // ชม. รวมสุทธิ
  regularHours?: number;             // ชม. ปกติ (breakdown)
  otMorningHours?: number;           // ชม. OT เช้า
  otNoonHours?: number;              // ชม. OT เที่ยง
  otEveningHours?: number;           // ชม. OT เย็น

  // --- Traceability ---
  approvalSource: ApprovalSource;    // แหล่งข้อมูลที่ใช้
  reconciliationRecordId: string;    // ref → reconciliationRecords

  // --- Audit ---
  approvedBy: string;                // Admin userId เท่านั้น (ไม่มี 'system')
  approvedAt: Date;
  note?: string;

  // --- Metadata ---
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input Interface
// ---------------------------------------------------------------------------

export interface CreateApprovedTimesheetInput {
  employeeId: string;
  employeeName?: string;
  workDate: string;
  projectLocationId: string;
  projectName?: string;
  approvedHours: number;
  regularHours?: number;
  otMorningHours?: number;
  otNoonHours?: number;
  otEveningHours?: number;
  approvalSource: ApprovalSource;
  reconciliationRecordId: string;
  approvedBy: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateApprovedTimesheetId(employeeId: string, workDate: string): string {
  return `ATS_${employeeId}_${workDate}`;
}

// ---------------------------------------------------------------------------
// Firestore Converter
// ---------------------------------------------------------------------------

export const approvedTimesheetConverter = {
  toFirestore: (record: Partial<Omit<ApprovedTimesheet, 'id'>>): any => {
    const data: any = {};

    if (record.employeeId !== undefined) data.employeeId = record.employeeId;
    if (record.employeeName !== undefined) data.employeeName = record.employeeName;
    if (record.workDate !== undefined) data.workDate = record.workDate;
    if (record.projectLocationId !== undefined) data.projectLocationId = record.projectLocationId;
    if (record.projectName !== undefined) data.projectName = record.projectName;
    if (record.approvedHours !== undefined) data.approvedHours = record.approvedHours;
    if (record.regularHours !== undefined) data.regularHours = record.regularHours;
    if (record.otMorningHours !== undefined) data.otMorningHours = record.otMorningHours;
    if (record.otNoonHours !== undefined) data.otNoonHours = record.otNoonHours;
    if (record.otEveningHours !== undefined) data.otEveningHours = record.otEveningHours;
    if (record.approvalSource !== undefined) data.approvalSource = record.approvalSource;
    if (record.reconciliationRecordId !== undefined)
      data.reconciliationRecordId = record.reconciliationRecordId;
    if (record.approvedBy !== undefined) data.approvedBy = record.approvedBy;
    if (record.approvedAt !== undefined) data.approvedAt = record.approvedAt;
    if (record.note !== undefined) data.note = record.note;
    if (record.createdAt !== undefined) data.createdAt = record.createdAt;
    if (record.updatedAt !== undefined) data.updatedAt = record.updatedAt;

    return data;
  },

  fromFirestore: (snapshot: any): ApprovedTimesheet => {
    const data = snapshot.data();

    const toDate = (val: any): Date =>
      val?.toDate ? val.toDate() : val instanceof Date ? val : new Date();

    const toOptionalDate = (val: any): Date | undefined =>
      val ? (val?.toDate ? val.toDate() : val instanceof Date ? val : undefined) : undefined;

    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      workDate: data.workDate,
      projectLocationId: data.projectLocationId,
      projectName: data.projectName,
      approvedHours: data.approvedHours ?? 0,
      regularHours: data.regularHours,
      otMorningHours: data.otMorningHours,
      otNoonHours: data.otNoonHours,
      otEveningHours: data.otEveningHours,
      approvalSource: data.approvalSource,
      reconciliationRecordId: data.reconciliationRecordId,
      approvedBy: data.approvedBy,
      approvedAt: toDate(data.approvedAt),
      note: data.note,
      createdAt: toDate(data.createdAt),
      updatedAt: toOptionalDate(data.updatedAt) ?? toDate(data.createdAt),
    };
  },
};
