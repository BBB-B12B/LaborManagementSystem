/**
 * DailyContractor Model
 * แรงงานรายวัน (DC)
 *
 * Description: Daily laborers who work on projects. Each DC has specific skill (ตำแหน่ง)
 * and can be assigned to multiple projects.
 * Firestore Collection: dailyContractors
 *
 * NOTE: Financial data (income/expense) is stored in sub-collections:
 *   - dcIncomeDetails
 *   - dcExpenseDetails
 */

export interface DailyContractor {
  id: string;
  employeeId: string;
  username?: string;
  passwordHash?: string;
  name: string;
  skillId: string;
  projectLocationId?: string;
  department?: string;
  dateOfBirth?: Date | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  idHistory?: string[]; // History of previous employeeIds
  foremanUsage?: Record<string, {
    count: number;
    name: string;
  }>;
  // T-230/T-240 Fields
  dailyWageRate?: number;
  professionalRate?: number;
  phoneAllowance?: number;
  mouDeductionRate?: number;
  nationality?: string;
  otherIncome?: number;
  housingFee?: number;
  followerCount?: number;
  refrigeratorFee?: number;
  soundSystemFee?: number;
  tvFee?: number;
  laundryFee?: number;
  airConFee?: number;
  otherDeduction?: number;
}

export interface DailyContractorDTO {
  id: string;
  employeeId: string;
  name: string;
  skillId: string;
  projectLocationId?: string;
  department?: string;
  dateOfBirth?: Date | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  foremanUsage?: Record<string, {
    count: number;
    name: string;
  }>;
}

export interface CreateDailyContractorInput {
  employeeId?: string;
  username?: string;
  password?: string;
  name?: string;
  skillId?: string;
  projectLocationId?: string;
  department?: string;
  dateOfBirth?: Date;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  dailyWageRate?: number;
  professionalRate?: number;
  phoneAllowance?: number;
  mouDeductionRate?: number;
  nationality?: string;
  otherIncome?: number;
  housingFee?: number;
  followerCount?: number;
  refrigeratorFee?: number;
  soundSystemFee?: number;
  tvFee?: number;
  laundryFee?: number;
  airConFee?: number;
  otherDeduction?: number;
}

export interface UpdateDailyContractorInput {
  employeeId?: string;
  username?: string;
  password?: string;
  name?: string;
  skillId?: string;
  projectLocationId?: string;
  department?: string;
  dateOfBirth?: Date;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  dailyWageRate?: number;
  professionalRate?: number;
  phoneAllowance?: number;
  mouDeductionRate?: number;
  nationality?: string;
  otherIncome?: number;
  housingFee?: number;
  followerCount?: number;
  refrigeratorFee?: number;
  soundSystemFee?: number;
  tvFee?: number;
  laundryFee?: number;
  airConFee?: number;
  otherDeduction?: number;
}

const parseDate = (val: any) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Firestore document converter for DailyContractor
 */
export const dailyContractorConverter = {
  toFirestore: (dc: DailyContractor): any => {
    return {
      employeeId: dc.employeeId,
      username: dc.username || null,
      passwordHash: dc.passwordHash || null,
      name: dc.name,
      skillId: dc.skillId,
      projectLocationId: dc.projectLocationId || null,
      department: dc.department || null,
      dateOfBirth: dc.dateOfBirth || null,
      isActive: dc.isActive,
      startDate: dc.startDate || null,
      endDate: dc.endDate || null,
      createdAt: dc.createdAt,
      updatedAt: dc.updatedAt,
      createdBy: dc.createdBy,
      updatedBy: dc.updatedBy,
      foremanUsage: dc.foremanUsage || null,
      dailyWageRate: dc.dailyWageRate || 0,
      professionalRate: dc.professionalRate || 0,
      phoneAllowance: dc.phoneAllowance || 0,
      mouDeductionRate: dc.mouDeductionRate || 0,
      nationality: dc.nationality || 'ไทย',
      otherIncome: dc.otherIncome || 0,
      housingFee: dc.housingFee || 0,
      followerCount: dc.followerCount || 0,
      refrigeratorFee: dc.refrigeratorFee || 0,
      soundSystemFee: dc.soundSystemFee || 0,
      tvFee: dc.tvFee || 0,
      laundryFee: dc.laundryFee || 0,
      airConFee: dc.airConFee || 0,
      otherDeduction: dc.otherDeduction || 0,
    };
  },
  fromFirestore: (snapshot: any): DailyContractor => {
    const data = snapshot.data();
    
    // Support for legacy data: if projectLocationIds exists and is an array with at least one element, use its first element
    let projectLocationId = data.projectLocationId;
    if (!projectLocationId && Array.isArray(data.projectLocationIds) && data.projectLocationIds.length > 0) {
      projectLocationId = data.projectLocationIds[0];
    }

    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      skillId: data.skillId || '',
      projectLocationId: projectLocationId || '',
      department: data.department || '',
      dateOfBirth: parseDate(data.dateOfBirth),
      isActive: data.isActive !== undefined ? data.isActive : true,
      startDate: parseDate(data.startDate),
      endDate: parseDate(data.endDate),
      createdAt: parseDate(data.createdAt) || new Date(),
      updatedAt: parseDate(data.updatedAt) || new Date(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      foremanUsage: data.foremanUsage,
      dailyWageRate: data.dailyWageRate || 0,
      professionalRate: data.professionalRate || 0,
      phoneAllowance: data.phoneAllowance || 0,
      mouDeductionRate: data.mouDeductionRate || 0,
      nationality: data.nationality || 'ไทย',
      otherIncome: data.otherIncome || 0,
      housingFee: data.housingFee || 0,
      followerCount: data.followerCount || 0,
      refrigeratorFee: data.refrigeratorFee || 0,
      soundSystemFee: data.soundSystemFee || 0,
      tvFee: data.tvFee || 0,
      laundryFee: data.laundryFee || 0,
      airConFee: data.airConFee || 0,
      otherDeduction: data.otherDeduction || 0,
    };
  },
};
