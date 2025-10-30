/**
 * DCExpenseDetails Model
 * รายละเอียดรายจ่าย DC
 *
 * Description: Standard expense details for each DC that apply across all wage periods.
 * Firestore Collection: dcExpenseDetails
 */

export interface DCExpenseDetails {
  id: string;
  dailyContractorId: string;
  accommodationCost: number; // ค่าที่พักต่องวด
  followerCount: number; // จำนวนผู้ติดตาม
  followerAccommodation: number; // ค่าที่พักผู้ติดตาม (followerCount × 300)
  refrigeratorCost: number; // ค่าตู้เย็น
  soundSystemCost: number; // ค่าเครื่องเสียง
  tvCost: number; // ค่าทีวี
  washingMachineCost: number; // ค่าเครื่องซักผ้า
  portableAcCost: number; // ค่าแอร์เคลื่อนที่
  isActive: boolean;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateDCExpenseDetailsInput {
  dailyContractorId: string;
  accommodationCost: number;
  followerCount: number;
  refrigeratorCost?: number;
  soundSystemCost?: number;
  tvCost?: number;
  washingMachineCost?: number;
  portableAcCost?: number;
  effectiveDate: Date;
}

export interface UpdateDCExpenseDetailsInput {
  accommodationCost?: number;
  followerCount?: number;
  refrigeratorCost?: number;
  soundSystemCost?: number;
  tvCost?: number;
  washingMachineCost?: number;
  portableAcCost?: number;
  effectiveDate?: Date;
  isActive?: boolean;
}

/**
 * คำนวณค่าที่พักผู้ติดตาม
 * Calculate follower accommodation cost (300 baht per follower per period)
 */
export function calculateFollowerAccommodation(followerCount: number): number {
  return followerCount * 300;
}

/**
 * Firestore document converter for DCExpenseDetails
 */
export const dcExpenseDetailsConverter = {
  toFirestore: (details: Omit<DCExpenseDetails, 'id'>): any => {
    return {
      dailyContractorId: details.dailyContractorId,
      accommodationCost: details.accommodationCost,
      followerCount: details.followerCount,
      followerAccommodation: details.followerAccommodation,
      refrigeratorCost: details.refrigeratorCost,
      soundSystemCost: details.soundSystemCost,
      tvCost: details.tvCost,
      washingMachineCost: details.washingMachineCost,
      portableAcCost: details.portableAcCost,
      isActive: details.isActive,
      effectiveDate: details.effectiveDate,
      createdAt: details.createdAt,
      updatedAt: details.updatedAt,
      createdBy: details.createdBy,
      updatedBy: details.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): DCExpenseDetails => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dailyContractorId: data.dailyContractorId,
      accommodationCost: data.accommodationCost || 0,
      followerCount: data.followerCount || 0,
      followerAccommodation: data.followerAccommodation || 0,
      refrigeratorCost: data.refrigeratorCost || 0,
      soundSystemCost: data.soundSystemCost || 0,
      tvCost: data.tvCost || 0,
      washingMachineCost: data.washingMachineCost || 0,
      portableAcCost: data.portableAcCost || 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
      effectiveDate: data.effectiveDate.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
