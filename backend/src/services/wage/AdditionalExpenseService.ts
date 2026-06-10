/**
 * AdditionalExpenseService
 * บริการจัดการรายจ่ายอื่น ๆ
 */

import { BaseCrudService } from '../base/BaseCrudService';
import { AdditionalExpense } from '../../models/AdditionalExpense';
import { collections } from '../../config/collections';
import { logger } from '../../utils/logger';

class AdditionalExpenseService extends BaseCrudService<AdditionalExpense> {
  constructor() {
    super(collections.additionalExpense as any);
  }

  /**
   * Get additional expense items by wage period
   */
  async getByWagePeriod(wagePeriodId: string): Promise<AdditionalExpense[]> {
    try {
      return await this.query([
        {
          field: 'wagePeriodId',
          operator: '==',
          value: wagePeriodId,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting additional expense by wage period:', error);
      throw error;
    }
  }

  /**
   * Get additional expense items by DC
   */
  async getByDC(dailyContractorId: string): Promise<AdditionalExpense[]> {
    try {
      return await this.query([
        {
          field: 'dailyContractorId',
          operator: '==',
          value: dailyContractorId,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting additional expense by DC:', error);
      throw error;
    }
  }
}

export const additionalExpenseService = new AdditionalExpenseService();
