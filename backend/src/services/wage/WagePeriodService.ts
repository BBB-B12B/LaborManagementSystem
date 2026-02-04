/**
 * WagePeriodService
 * บริการจัดการงวดค่าแรง
 *
 * Manages wage periods with CRUD operations and wage calculations.
 */

import { BaseCrudService } from '../base/BaseCrudService';
import {
  WagePeriod,
  DCWageSummary,
  CreateWagePeriodInput,
  generatePeriodCode,
  validatePeriodDays,
} from '../../models/WagePeriod';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { dailyReportService } from '../dailyReport/DailyReportService';

/**
 * WagePeriodService
 * Extends CrudService with wage calculation operations
 */
class WagePeriodService extends BaseCrudService<WagePeriod> {
  constructor() {
    super(collections.wagePeriods);
  }

  /**
   * Create new wage period
   */
  async createWagePeriod(
    input: CreateWagePeriodInput,
    createdBy: string
  ): Promise<WagePeriod> {
    try {
      // Validate period is 15 days
      if (!validatePeriodDays(input.startDate, input.endDate)) {
        throw new AppError('Wage period must be exactly 15 days', 400);
      }

      // Generate period code
      const periodCode = generatePeriodCode(input.startDate);

      // Check for duplicate period
      const existing = await this.findByPeriodCode(periodCode);
      if (existing) {
        throw new AppError('Wage period already exists', 409);
      }

      const now = new Date();
      const periodData: Omit<WagePeriod, 'id'> = {
        periodCode,
        projectLocationId: input.projectLocationId,
        startDate: input.startDate,
        endDate: input.endDate,
        periodDays: 15,
        status: 'draft',
        dcSummaries: [],
        totalRegularHours: 0,
        totalOtHours: 0,
        totalGrossWages: 0,
        totalDeductions: 0,
        totalNetWages: 0,
        hasUnresolvedDiscrepancies: false,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
      };

      const period = await this.create(periodData);
      logger.info(`Wage period created: ${period.periodCode}`, { periodId: period.id });

      return period;
    } catch (error: any) {
      logger.error('Error creating wage period:', error);
      throw error;
    }
  }

  /**
   * Calculate wages for a period
   */
  async calculateWages(
    periodId: string,
    calculatedBy: string
  ): Promise<WagePeriod | null> {
    try {
      const period = await this.getById(periodId);
      if (!period) {
        throw new AppError('Wage period not found', 404);
      }

      // 1. Fetch all daily reports for the period and project
      const reports = await dailyReportService.getByProjectAndDate(
        period.projectLocationId,
        period.startDate,
        period.endDate
      );

      if (reports.length === 0) {
        // Even if no reports, we should still clear and update status
        const updateData: Partial<WagePeriod> = {
          dcSummaries: [],
          totalRegularHours: 0,
          totalOtHours: 0,
          totalGrossWages: 0,
          totalDeductions: 0,
          totalNetWages: 0,
          status: 'calculated',
          calculatedAt: new Date(),
          calculatedBy,
          updatedAt: new Date(),
          updatedBy: calculatedBy,
        };
        return await this.update(periodId, updateData);
      }

      // TODO: Implement wage calculation logic
      // 1. Fetch all daily reports for the period
      // 2. Group by dailyContractorId
      // 3. Calculate hours (regular, OT morning, noon, evening)
      // 4. Fetch DC rates and calculate wages
      // 5. Fetch additional income/expenses
      // 6. Calculate social security
      // 7. Calculate late deductions
      // 8. Build DCWageSummary array

      const dcSummaries: DCWageSummary[] = [];
      const totalRegularHours = 0;
      const totalOtHours = 0;
      const totalGrossWages = 0;
      const totalDeductions = 0;
      const totalNetWages = 0;

      const updateData: Partial<WagePeriod> = {
        dcSummaries,
        totalRegularHours,
        totalOtHours,
        totalGrossWages,
        totalDeductions,
        totalNetWages,
        status: 'calculated',
        calculatedAt: new Date(),
        calculatedBy,
        updatedAt: new Date(),
        updatedBy: calculatedBy,
      };

      const updated = await this.update(periodId, updateData);
      if (updated) {
        logger.info(`Wages calculated for period: ${period.periodCode}`, {
          periodId,
          workerCount: dcSummaries.length,
          totalNetWages
        });
      }

      return updated;
    } catch (error: any) {
      logger.error('Error calculating wages:', error);
      throw error;
    }
  }

  /**
   * Approve wage period
   */
  async approvePeriod(
    periodId: string,
    approvedBy: string
  ): Promise<WagePeriod | null> {
    try {
      const period = await this.getById(periodId);
      if (!period) {
        return null;
      }

      if (period.status !== 'calculated') {
        throw new AppError('Can only approve calculated periods', 400);
      }

      const updateData: Partial<WagePeriod> = {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy,
        updatedAt: new Date(),
        updatedBy: approvedBy,
      };

      const updated = await this.update(periodId, updateData);
      if (updated) {
        logger.info(`Wage period approved: ${period.periodCode}`, { periodId });
      }

      return updated;
    } catch (error: any) {
      logger.error('Error approving wage period:', error);
      throw error;
    }
  }

  /**
   * Mark period as paid
   */
  async markAsPaid(
    periodId: string,
    paidBy: string
  ): Promise<WagePeriod | null> {
    try {
      const period = await this.getById(periodId);
      if (!period) {
        return null;
      }

      if (period.status !== 'approved') {
        throw new AppError('Can only mark approved periods as paid', 400);
      }

      const updateData: Partial<WagePeriod> = {
        status: 'paid',
        updatedAt: new Date(),
        updatedBy: paidBy,
      };

      const updated = await this.update(periodId, updateData);
      if (updated) {
        logger.info(`Wage period marked as paid: ${period.periodCode}`, { periodId });
      }

      return updated;
    } catch (error: any) {
      logger.error('Error marking period as paid:', error);
      throw error;
    }
  }

  /**
   * Find wage period by period code
   */
  async findByPeriodCode(periodCode: string): Promise<WagePeriod | null> {
    try {
      const results = await this.query([
        {
          field: 'periodCode',
          operator: '==',
          value: periodCode,
        },
      ]);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      logger.error('Error finding wage period by code:', error);
      throw error;
    }
  }

  /**
   * Get wage periods by project
   */
  async getByProject(projectLocationId: string): Promise<WagePeriod[]> {
    try {
      return await this.query([
        {
          field: 'projectLocationId',
          operator: '==',
          value: projectLocationId,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting wage periods by project:', error);
      throw error;
    }
  }

  /**
   * Get wage periods by status
   */
  async getByStatus(status: any): Promise<WagePeriod[]> {
    try {
      return await this.query([
        {
          field: 'status',
          operator: '==',
          value: status,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting wage periods by status:', error);
      throw error;
    }
  }
}

// Singleton instance
export const wagePeriodService = new WagePeriodService();
