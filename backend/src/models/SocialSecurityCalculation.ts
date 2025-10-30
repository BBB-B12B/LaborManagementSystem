/**
 * SocialSecurityCalculation Model
 * การคำนวณประกันสังคม
 *
 * Description: Social security contribution calculations for each DC in a wage period.
 * Firestore Collection: socialSecurityCalculations
 */

export interface SocialSecurityCalculation {
  id: string;
  wagePeriodId: string;
  dailyContractorId: string;
  employeeId: string;
  isExempt: boolean; // true if employeeId starts with "9"
  grossWages: number;
  contributionRate: number; // 0.05 (5%)
  calculatedAmount: number; // grossWages × contributionRate
  cappedAmount: number; // min(max(calculatedAmount, 83), 750)
  finalAmount: number; // 0 if exempt, otherwise cappedAmount
  periodMonth: string; // YYYY-MM
  notes?: string;
  createdAt: Date;
  calculatedBy: string;
}

export interface CreateSocialSecurityCalculationInput {
  wagePeriodId: string;
  dailyContractorId: string;
  employeeId: string;
  grossWages: number;
}

/**
 * คำนวณประกันสังคม
 * Calculate social security contribution
 *
 * Rules:
 * - 5% of gross wages
 * - Min: 83 baht
 * - Max: 750 baht/month
 * - Exempt if employeeId starts with "9"
 */
export function calculateSocialSecurity(grossWages: number, employeeId: string): number {
  // ตรวจสอบการยกเว้น
  if (employeeId.startsWith('9')) {
    return 0;
  }

  // คำนวณ 5%
  const calculatedAmount = grossWages * 0.05;

  // ใช้ min/max
  const cappedAmount = Math.min(Math.max(calculatedAmount, 83), 750);

  return cappedAmount;
}

/**
 * Firestore document converter for SocialSecurityCalculation
 */
export const socialSecurityCalculationConverter = {
  toFirestore: (calc: Omit<SocialSecurityCalculation, 'id'>): any => {
    return {
      wagePeriodId: calc.wagePeriodId,
      dailyContractorId: calc.dailyContractorId,
      employeeId: calc.employeeId,
      isExempt: calc.isExempt,
      grossWages: calc.grossWages,
      contributionRate: calc.contributionRate,
      calculatedAmount: calc.calculatedAmount,
      cappedAmount: calc.cappedAmount,
      finalAmount: calc.finalAmount,
      periodMonth: calc.periodMonth,
      notes: calc.notes || null,
      createdAt: calc.createdAt,
      calculatedBy: calc.calculatedBy,
    };
  },
  fromFirestore: (snapshot: any): SocialSecurityCalculation => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      wagePeriodId: data.wagePeriodId,
      dailyContractorId: data.dailyContractorId,
      employeeId: data.employeeId,
      isExempt: data.isExempt || false,
      grossWages: data.grossWages,
      contributionRate: data.contributionRate,
      calculatedAmount: data.calculatedAmount,
      cappedAmount: data.cappedAmount,
      finalAmount: data.finalAmount,
      periodMonth: data.periodMonth,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
      calculatedBy: data.calculatedBy,
    };
  },
};
