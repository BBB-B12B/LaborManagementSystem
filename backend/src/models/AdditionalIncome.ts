/**
 * AdditionalIncome Model
 * รายได้อื่น ๆ ประจำงวด
 *
 * Description: Additional income items for specific DC in a wage period.
 * Firestore Collection: additionalIncome
 */

export interface AdditionalIncome {
  id: string;
  wagePeriodId: string;
  dailyContractorId: string;
  incomeType: string; // เช่น "โบนัส", "ค่าล่วงเวลาพิเศษ", "ค่าเดินทาง"
  description: string;
  amount: number;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface CreateAdditionalIncomeInput {
  wagePeriodId: string;
  dailyContractorId: string;
  incomeType: string;
  description: string;
  amount: number;
  notes?: string;
}

export interface UpdateAdditionalIncomeInput {
  incomeType?: string;
  description?: string;
  amount?: number;
  notes?: string;
}

/**
 * Firestore document converter for AdditionalIncome
 */
export const additionalIncomeConverter = {
  toFirestore: (income: Omit<AdditionalIncome, 'id'>): any => {
    return {
      wagePeriodId: income.wagePeriodId,
      dailyContractorId: income.dailyContractorId,
      incomeType: income.incomeType,
      description: income.description,
      amount: income.amount,
      notes: income.notes || null,
      createdAt: income.createdAt,
      createdBy: income.createdBy,
    };
  },
  fromFirestore: (snapshot: any): AdditionalIncome => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      wagePeriodId: data.wagePeriodId,
      dailyContractorId: data.dailyContractorId,
      incomeType: data.incomeType,
      description: data.description,
      amount: data.amount,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
      createdBy: data.createdBy,
    };
  },
};
