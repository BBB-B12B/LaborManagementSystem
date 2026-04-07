/**
 * SocialSecurityRuleService
 * บริการจัดการเกณฑ์และกฎของประกันสังคม
 *
 * Manages Social Security calculation rules.
 */

import { BaseCrudService } from '../base/BaseCrudService';
import { SocialSecurityRule, CreateSocialSecurityRuleInput, UpdateSocialSecurityRuleInput } from '../../models/SocialSecurityRule';
import { collections } from '../../config/collections';
import { logger } from '../../utils/logger';

class SocialSecurityRuleService extends BaseCrudService<SocialSecurityRule> {
    constructor() {
        super(collections.socialSecurityRules as any, 'socialSecurityRules');
    }

    /**
     * Create a new rule
     */
    async createRule(
        input: CreateSocialSecurityRuleInput,
        recordedBy: string
    ): Promise<SocialSecurityRule> {
        try {
            const now = new Date();
            const ruleData: Omit<SocialSecurityRule, 'id'> = {
                ...input,
                isActive: input.isActive ?? true,
                createdAt: now,
                updatedAt: now,
                updatedBy: recordedBy,
            };

            const rule = await this.create(ruleData);
            logger.info(`Social Security Rule created: ${rule.name}`, { ruleId: rule.id });

            return rule;
        } catch (error: any) {
            logger.error('Error creating social security rule:', error);
            throw error;
        }
    }

    /**
     * Update an existing rule
     */
    async updateRule(
        id: string,
        input: UpdateSocialSecurityRuleInput,
        updatedBy: string
    ): Promise<SocialSecurityRule> {
        try {
            const now = new Date();
            const updateData: Partial<SocialSecurityRule> = {
                ...input,
                updatedAt: now,
                updatedBy,
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if ((updateData as any)[key] === undefined) {
                    delete (updateData as any)[key];
                }
            });

            await collections.socialSecurityRules.doc(id).update(updateData);
            
            const doc = await collections.socialSecurityRules.doc(id).get();
            logger.info(`Social Security Rule updated: ${id}`);
            
            return { id: doc.id, ...doc.data() } as SocialSecurityRule;
        } catch (error: any) {
            logger.error(`Error updating social security rule ${id}:`, error);
            throw error;
        }
    }

    /**
     * Get all active rules, sorted by order
     */
    async getActiveRules(): Promise<SocialSecurityRule[]> {
        try {
            const snapshot = await collections.socialSecurityRules
                .where('isActive', '==', true)
                .orderBy('order', 'asc')
                .get();
                
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialSecurityRule));
        } catch (error: any) {
            logger.error('Error getting active social security rules:', error);
            throw error;
        }
    }

    /**
     * Evaluate the rules against a gross wage amount to find the deduction
     * @param grossWages The base wage amount used for checking
     * @param employeeId The employee ID (to check for exemption)
     * @returns The calculated deduction amount
     */
    async calculateDeduction(grossWages: number, employeeId: string): Promise<number> {
        // Exemption check: starts with 9
        if (employeeId.startsWith('9')) {
            return 0;
        }

        const rules = await this.getActiveRules();
        
        // If no rules exist, fallback to the old default (5% with min 83, max 750)
        if (rules.length === 0) {
            const calculatedAmount = grossWages * 0.05;
            return Math.min(Math.max(calculatedAmount, 83), 750);
        }

        // Evaluate rules in sequence (sorted by 'order' ascending)
        for (const rule of rules) {
            let matchesCondition = false;
            switch (rule.conditionOperator) {
                case '<=': matchesCondition = grossWages <= rule.conditionValue; break;
                case '<': matchesCondition = grossWages < rule.conditionValue; break;
                case '>=': matchesCondition = grossWages >= rule.conditionValue; break;
                case '>': matchesCondition = grossWages > rule.conditionValue; break;
                case '==': matchesCondition = grossWages === rule.conditionValue; break;
            }

            if (matchesCondition) {
                let deduction = 0;
                
                if (rule.deductionType === 'percentage') {
                    // Ex: 5 for 5% -> 0.05
                    const percentageRate = rule.deductionValue >= 1 ? rule.deductionValue / 100 : rule.deductionValue;
                    deduction = grossWages * percentageRate;
                } else if (rule.deductionType === 'fixed') {
                    deduction = rule.deductionValue;
                }

                // Apply min/max limits if defined
                if (rule.minDeduction !== undefined && rule.minDeduction !== null && deduction < rule.minDeduction) {
                    deduction = rule.minDeduction;
                }
                if (rule.maxDeduction !== undefined && rule.maxDeduction !== null && deduction > rule.maxDeduction) {
                    deduction = rule.maxDeduction;
                }

                return deduction;
            }
        }

        // If no rule matches, return 0 (or we could fallback to default, but 0 is safer if all rules fail)
        return 0;
    }
}

export const socialSecurityRuleService = new SocialSecurityRuleService();
