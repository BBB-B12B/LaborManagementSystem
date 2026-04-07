/**
 * DailyContractor Model
 * แรงงานรายวัน (DC)
 *
 * Description: Daily laborers who work on projects. Each DC has specific skills and can be assigned to multiple projects.
 * Firestore Collection: dailyContractors
 */

export interface DailyContractor {
  id: string;
  employeeId: string;
  username?: string;
  passwordHash?: string;
  name: string;
  skillId: string;
  projectLocationIds: string[];
  phoneNumber?: string | null;
  idCardNumber?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  idHistory?: string[]; // History of previous employeeIds
  // New Fields for Wage Configuration (T-230)
  dailyWageRate: number; // Default: 0
  professionalRate: number; // Default: 0
  phoneAllowance: number; // Default: 0
  mouDeductionRate: number; // Default: 0
  nationality: string; // Default: 'ไทย'
  // New Fields for Financial Refinement (T-240)
  otherIncome: number; // Default: 0
  housingFee: number; // Default: 0
  followerCount: number; // Default: 0
  refrigeratorFee: number; // Default: 0
  soundSystemFee: number; // Default: 0
  tvFee: number; // Default: 0
  laundryFee: number; // Default: 0
  airConFee: number; // Default: 0
  otherDeduction: number; // Default: 0
}

export interface DailyContractorDTO {
  id: string;
  employeeId: string;
  name: string;
  skillId: string;
  projectLocationIds: string[];
  phoneNumber?: string | null;
  idCardNumber?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  dailyWageRate: number;
  professionalRate: number;
  phoneAllowance: number;
  mouDeductionRate: number;
  nationality: string;
  // T-240 Fields
  otherIncome: number;
  housingFee: number;
  followerCount: number;
  refrigeratorFee: number;
  soundSystemFee: number;
  tvFee: number;
  laundryFee: number;
  airConFee: number;
  otherDeduction: number;
}

export interface CreateDailyContractorInput {
  employeeId?: string;
  username?: string;
  password?: string;
  name?: string;
  skillId?: string;
  projectLocationIds?: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  // T-230 & T-240
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
  projectLocationIds?: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  // T-230 & T-240
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

/**
 * Firestore document converter for DailyContractor
 */
export const dailyContractorConverter = {
  toFirestore: (dc: Omit<DailyContractor, 'id'>): any => {
    return {
      employeeId: dc.employeeId,
      username: dc.username || null,
      passwordHash: dc.passwordHash || null,
      name: dc.name,
      skillId: dc.skillId,
      projectLocationIds: dc.projectLocationIds,
      phoneNumber: dc.phoneNumber || null,
      idCardNumber: dc.idCardNumber || null,
      address: dc.address || null,
      emergencyContact: dc.emergencyContact || null,
      emergencyPhone: dc.emergencyPhone || null,
      isActive: dc.isActive,
      startDate: dc.startDate || null,
      endDate: dc.endDate || null,
      createdAt: dc.createdAt,
      updatedAt: dc.updatedAt,
      createdBy: dc.createdBy,
      updatedBy: dc.updatedBy,
      // T-230: New fields
      dailyWageRate: dc.dailyWageRate || 0,
      professionalRate: dc.professionalRate || 0,
      phoneAllowance: dc.phoneAllowance || 0,
      mouDeductionRate: dc.mouDeductionRate || 0,
      nationality: dc.nationality || 'ไทย',
      // T-240: New fields
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
    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      skillId: data.skillId,
      projectLocationIds: data.projectLocationIds || [],
      phoneNumber: data.phoneNumber,
      idCardNumber: data.idCardNumber,
      address: data.address,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      isActive: data.isActive !== undefined ? data.isActive : true,
      startDate: data.startDate?.toDate(),
      endDate: data.endDate?.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      // T-230: New fields
      dailyWageRate: data.dailyWageRate || 0,
      professionalRate: data.professionalRate || 0,
      phoneAllowance: data.phoneAllowance || 0,
      mouDeductionRate: data.mouDeductionRate || 0,
      nationality: data.nationality || 'ไทย',
      // T-240: New fields
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
