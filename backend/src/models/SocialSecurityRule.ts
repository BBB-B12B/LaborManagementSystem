/**
 * SocialSecurityRule Model
 * การจัดการเกณฑ์คำนวณประกันสังคม แบบปรับเปลี่ยนได้ (Dynamic Rules)
 *
 * Description: Configuration rules for social security calculation.
 * Firestore Collection: socialSecurityRules
 */

export interface SocialSecurityRule {
  id: string;
  name: string; // ชื่อเกณฑ์ เช่น "หัก 5% ของค่าแรง"
  conditionOperator: '<=' | '<' | '>=' | '>' | '=='; // ตัวดำเนินการเปรียบเทียบกับฐานรายได้
  conditionValue: number; // มูลค่าที่ใช้เปรียบเทียบ เช่น 15000
  deductionType: 'percentage' | 'fixed'; // ประเภทการหัก: เปอร์เซ็นต์ หรือ ยอดคงที่
  deductionValue: number; // มูลค่าที่จะนำไปหัก เช่น 0.05 (ถ้าเป็น percentage) หรือ 750 (ถ้าเป็น fixed)
  minDeduction?: number; // ขั้นต่ำที่ต้องหัก (ถ้ามี) เช่น 83
  maxDeduction?: number; // ขั้นสูงที่ต้องหัก (ถ้ามี) เช่น 750
  order: number; // ลำดับการประเมินกฎ (ประเมินจากน้อยไปมาก 1, 2, 3...) กฎที่ตรงข้อแรกจะถูกใช้งาน
  isActive: boolean; // สถานะการใช้งาน
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export interface CreateSocialSecurityRuleInput {
  name: string;
  conditionOperator: '<=' | '<' | '>=' | '>' | '==';
  conditionValue: number;
  deductionType: 'percentage' | 'fixed';
  deductionValue: number;
  minDeduction?: number;
  maxDeduction?: number;
  order: number;
  isActive?: boolean;
}

export interface UpdateSocialSecurityRuleInput extends Partial<CreateSocialSecurityRuleInput> {}

/**
 * Firestore document converter for SocialSecurityRule
 */
export const socialSecurityRuleConverter = {
  toFirestore: (rule: Omit<SocialSecurityRule, 'id'>): any => {
    return {
      name: rule.name,
      conditionOperator: rule.conditionOperator,
      conditionValue: rule.conditionValue,
      deductionType: rule.deductionType,
      deductionValue: rule.deductionValue,
      minDeduction: rule.minDeduction ?? null,
      maxDeduction: rule.maxDeduction ?? null,
      order: rule.order,
      isActive: rule.isActive ?? true,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      updatedBy: rule.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): SocialSecurityRule => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      name: data.name,
      conditionOperator: data.conditionOperator,
      conditionValue: data.conditionValue,
      deductionType: data.deductionType,
      deductionValue: data.deductionValue,
      minDeduction: data.minDeduction,
      maxDeduction: data.maxDeduction,
      order: data.order,
      isActive: data.isActive,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      updatedBy: data.updatedBy,
    };
  },
};
