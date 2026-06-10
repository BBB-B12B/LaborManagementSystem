/**
 * AdditionalIncomeService
 * บริการจัดการรายได้อื่น ๆ
 */

import { BaseCrudService } from '../base/BaseCrudService';
import { AdditionalIncome } from '../../models/AdditionalIncome';
import { collections } from '../../config/collections';
import { logger } from '../../utils/logger';

class AdditionalIncomeService extends BaseCrudService<AdditionalIncome> {
  constructor() {
    super(collections.additionalIncome as any);
  }

  /**
   * Get additional income items by wage period
   */
  async getByWagePeriod(wagePeriodId: string): Promise<AdditionalIncome[]> {
    try {
      return await this.query([
        {
          field: 'wagePeriodId',
          operator: '==',
          value: wagePeriodId,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting additional income by wage period:', error);
      throw error;
    }
  }

  /**
   * Get additional income items by DC
   */
  async getByDC(dailyContractorId: string): Promise<AdditionalIncome[]> {
    try {
      return await this.query([
        {
          field: 'dailyContractorId',
          operator: '==',
          value: dailyContractorId,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting additional income by DC:', error);
      throw error;
    }
  }
}

export const additionalIncomeService = new AdditionalIncomeService();
