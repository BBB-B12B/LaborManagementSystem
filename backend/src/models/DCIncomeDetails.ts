/**
 * DCIncomeDetails Model
 * รายละเอียดรายได้ DC
 *
 * Description: Income details for each DC stored in sub-collection.
 * Firestore Collection: dailyContractors/{dcId}/dcIncomeDetails
 *
 * NOTE: hourlyRate is derived at calculation time: dailyWageRate / 8
 */

export interface DCIncomeDetails {
  id: string;
  dailyContractorId: string;
  dailyWageRate: number;   // ค่าแรงต่อวัน (hourlyRate = dailyWageRate / 8)
  professionalRate: number; // ค่าช่าง/ค่าฝีมือต่อวัน
  phoneAllowance: number;   // ค่าโทรศัพท์ต่องวด
  otherIncome: number;      // รายได้อื่นๆ ต่องวด
  mouDeductionRate: number; // อัตราหัก MOU (%)
  isActive: boolean;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateDCIncomeDetailsInput {
  dailyContractorId: string;
  dailyWageRate: number;
  professionalRate: number;
  phoneAllowance: number;
  otherIncome?: number;
  mouDeductionRate?: number;
  effectiveDate: Date;
}

export interface UpdateDCIncomeDetailsInput {
  dailyWageRate?: number;
  professionalRate?: number;
  phoneAllowance?: number;
  otherIncome?: number;
  mouDeductionRate?: number;
  effectiveDate?: Date;
  isActive?: boolean;
}

/**
 * Firestore document converter for DCIncomeDetails
 */
export const dcIncomeDetailsConverter = {
  toFirestore: (details: Omit<DCIncomeDetails, 'id'>): any => {
    return {
      dailyContractorId: details.dailyContractorId,
      dailyWageRate: details.dailyWageRate,
      professionalRate: details.professionalRate,
      phoneAllowance: details.phoneAllowance,
      otherIncome: details.otherIncome || 0,
      mouDeductionRate: details.mouDeductionRate || 0,
      isActive: details.isActive,
      effectiveDate: details.effectiveDate,
      createdAt: details.createdAt,
      updatedAt: details.updatedAt,
      createdBy: details.createdBy,
      updatedBy: details.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): DCIncomeDetails => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dailyContractorId: data.dailyContractorId,
      // Support legacy 'hourlyRate' field: if dailyWageRate missing, fallback to hourlyRate * 8
      dailyWageRate: data.dailyWageRate || (data.hourlyRate ? data.hourlyRate * 8 : 0),
      professionalRate: data.professionalRate || 0,
      phoneAllowance: data.phoneAllowance || 0,
      otherIncome: data.otherIncome || 0,
      mouDeductionRate: data.mouDeductionRate || 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
      effectiveDate: data.effectiveDate.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
