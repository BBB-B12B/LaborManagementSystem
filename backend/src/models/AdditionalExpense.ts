/**
 * AdditionalExpense Model
 * รายจ่ายอื่น ๆ ประจำงวด
 *
 * Description: Additional expense items for specific DC in a wage period.
 * Firestore Collection: additionalExpense
 */

export interface AdditionalExpense {
  id: string;
  wagePeriodId: string;
  dailyContractorId: string;
  expenseType: string; // เช่น "หักค่าเครื่องมือ", "หักค่าวัสดุ", "หักค่าปรับ"
  description: string;
  amount: number;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface CreateAdditionalExpenseInput {
  wagePeriodId: string;
  dailyContractorId: string;
  expenseType: string;
  description: string;
  amount: number;
  notes?: string;
}

export interface UpdateAdditionalExpenseInput {
  expenseType?: string;
  description?: string;
  amount?: number;
  notes?: string;
}

/**
 * Firestore document converter for AdditionalExpense
 */
export const additionalExpenseConverter = {
  toFirestore: (expense: Omit<AdditionalExpense, 'id'>): any => {
    return {
      wagePeriodId: expense.wagePeriodId,
      dailyContractorId: expense.dailyContractorId,
      expenseType: expense.expenseType,
      description: expense.description,
      amount: expense.amount,
      notes: expense.notes || null,
      createdAt: expense.createdAt,
      createdBy: expense.createdBy,
    };
  },
  fromFirestore: (snapshot: any): AdditionalExpense => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      wagePeriodId: data.wagePeriodId,
      dailyContractorId: data.dailyContractorId,
      expenseType: data.expenseType,
      description: data.description,
      amount: data.amount,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
      createdBy: data.createdBy,
    };
  },
};
