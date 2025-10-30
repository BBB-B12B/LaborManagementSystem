/**
 * DCIncomeDetails Model
 * รายละเอียดรายได้ DC
 *
 * Description: Standard income details for each DC that apply across all wage periods.
 * Firestore Collection: dcIncomeDetails
 */

export interface DCIncomeDetails {
  id: string;
  dailyContractorId: string;
  hourlyRate: number; // ค่าแรงต่อชั่วโมง
  professionalRate: number; // ค่าช่าง/ค่าฝีมือต่อชั่วโมง
  phoneAllowance: number; // ค่าโทรศัพท์ต่องวด
  isActive: boolean;
  effectiveDate: Date; // วันที่มีผลบังคับใช้
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateDCIncomeDetailsInput {
  dailyContractorId: string;
  hourlyRate: number;
  professionalRate: number;
  phoneAllowance: number;
  effectiveDate: Date;
}

export interface UpdateDCIncomeDetailsInput {
  hourlyRate?: number;
  professionalRate?: number;
  phoneAllowance?: number;
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
      hourlyRate: details.hourlyRate,
      professionalRate: details.professionalRate,
      phoneAllowance: details.phoneAllowance,
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
      hourlyRate: data.hourlyRate,
      professionalRate: data.professionalRate,
      phoneAllowance: data.phoneAllowance,
      isActive: data.isActive !== undefined ? data.isActive : true,
      effectiveDate: data.effectiveDate.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
