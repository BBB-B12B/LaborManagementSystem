/**
 * WagePeriod Model
 * งวดค่าแรง
 *
 * Description: Bi-weekly wage calculation periods for payroll processing.
 * Firestore Collection: wagePeriods
 */

export type PeriodStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'locked';

export interface DCWageSummary {
  dailyContractorId: string;
  employeeId: string;
  name: string;
  skillName: string;

  // ชั่วโมงทำงาน
  regularHours: number;
  otMorningHours: number;
  otNoonHours: number;
  otEveningHours: number;
  totalOtHours: number;
  totalHours: number;

  // การคำนวณรายได้
  hourlyRate: number;
  professionalRate: number;
  phoneAllowance: number;
  regularWages: number; // regularHours × hourlyRate
  otWages: number; // totalOtHours × hourlyRate × 1.5
  professionalFees: number; // regularHours × professionalRate
  additionalIncome: number; // รวมจาก AdditionalIncome
  totalIncome: number;

  // การคำนวณรายจ่าย
  accommodationCost: number;
  followerCount: number;
  followerAccommodation: number; // followerCount × 300
  refrigeratorCost: number;
  soundSystemCost: number;
  tvCost: number;
  washingMachineCost: number;
  portableAcCost: number;
  additionalExpenses: number; // รวมจาก AdditionalExpense
  socialSecurityDeduction: number;
  lateDeductions: number;
  totalExpenses: number;

  // การคำนวณสุทธิ
  netWages: number; // totalIncome - totalExpenses

  // References
  additionalIncomeIds: string[];
  additionalExpenseIds: string[];
  socialSecurityCalculationId?: string;
}

export interface WagePeriod {
  id: string;
  periodCode: string; // Format: YYYYMM-P1 or YYYYMM-P2
  projectLocationId: string;
  startDate: Date;
  endDate: Date;
  periodDays: number; // Always 15
  status: PeriodStatus;
  dcSummaries: DCWageSummary[];
  totalRegularHours: number;
  totalOtHours: number;
  totalGrossWages: number;
  totalDeductions: number;
  totalNetWages: number;
  hasUnresolvedDiscrepancies: boolean;
  calculatedAt?: Date;
  calculatedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateWagePeriodInput {
  projectLocationId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * ตรวจสอบว่างวดเป็น 15 วัน
 */
export function validatePeriodDays(startDate: Date, endDate: Date): boolean {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 15;
}

/**
 * สร้างรหัสงวด
 */
export function generatePeriodCode(startDate: Date): string {
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = startDate.getDate();
  const period = day === 1 ? 'P1' : 'P2';
  return `${year}${month}-${period}`;
}

/**
 * Firestore document converter for WagePeriod
 */
export const wagePeriodConverter = {
  toFirestore: (period: Omit<WagePeriod, 'id'>): any => {
    return {
      periodCode: period.periodCode,
      projectLocationId: period.projectLocationId,
      startDate: period.startDate,
      endDate: period.endDate,
      periodDays: period.periodDays,
      status: period.status,
      dcSummaries: period.dcSummaries,
      totalRegularHours: period.totalRegularHours,
      totalOtHours: period.totalOtHours,
      totalGrossWages: period.totalGrossWages,
      totalDeductions: period.totalDeductions,
      totalNetWages: period.totalNetWages,
      hasUnresolvedDiscrepancies: period.hasUnresolvedDiscrepancies,
      calculatedAt: period.calculatedAt || null,
      calculatedBy: period.calculatedBy || null,
      approvedAt: period.approvedAt || null,
      approvedBy: period.approvedBy || null,
      notes: period.notes || null,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
      createdBy: period.createdBy,
      updatedBy: period.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): WagePeriod => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      periodCode: data.periodCode,
      projectLocationId: data.projectLocationId,
      startDate: data.startDate.toDate(),
      endDate: data.endDate.toDate(),
      periodDays: data.periodDays,
      status: data.status,
      dcSummaries: data.dcSummaries || [],
      totalRegularHours: data.totalRegularHours || 0,
      totalOtHours: data.totalOtHours || 0,
      totalGrossWages: data.totalGrossWages || 0,
      totalDeductions: data.totalDeductions || 0,
      totalNetWages: data.totalNetWages || 0,
      hasUnresolvedDiscrepancies: data.hasUnresolvedDiscrepancies || false,
      calculatedAt: data.calculatedAt?.toDate(),
      calculatedBy: data.calculatedBy,
      approvedAt: data.approvedAt?.toDate(),
      approvedBy: data.approvedBy,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
