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
  PeriodStatus,
} from '../../models/WagePeriod';
import { AdditionalIncome } from '../../models/AdditionalIncome';
import { AdditionalExpense } from '../../models/AdditionalExpense';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { scanDataService } from '../scanData/ScanDataService';
import { lateRecordService } from '../scanData/LateRecordService';

/**
 * WagePeriodService
 * Extends CrudService with wage calculation operations
 */
class WagePeriodService extends BaseCrudService<WagePeriod> {
  constructor() {
    super(collections.wagePeriods as any);
  }

  /**
   * Create new wage period
   */
  async createWagePeriod(
    input: CreateWagePeriodInput,
    createdBy: string
  ): Promise<WagePeriod> {
    try {
      const diffTime = Math.abs(input.endDate.getTime() - input.startDate.getTime());
      const periodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

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
        periodDays,
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
   * TODO: Implement full wage calculation logic
   */
  async calculateWages(
    periodId: string,
    calculatedBy: string
  ): Promise<WagePeriod | null> {
    try {
      const period = await this.getById(periodId);
      if (!period) {
        return null;
      }

      // 1. Fetch all daily reports for the period and project
      const reports = await collections.dailyReports
        .where('projectLocationId', '==', period.projectLocationId)
        .where('date', '>=', period.startDate)
        .where('date', '<=', period.endDate)
        // .where('isDeleted', '==', false) // status check handles deletion logic if needed, or if we use status field
        .get()
        .then(s => s.docs.map(doc => doc.data()));

      // Flatten all entries from all reports
      const allEntries = reports.flatMap(report => (report.entries || []));

      // 2. Fetch all daily contractors active in this project
      const { dailyContractorService } = await import('../dailyContractor/DailyContractorService');
      const dcs = await dailyContractorService.getByProject(period.projectLocationId);

      // 3. Fetch skills for names
      const { skillService } = await import('../skill/SkillService');
      const skills = await skillService.getAll();
      const skillMap = new Map(skills.items.map(s => [s.id, s.name]));

      // 4. Fetch additional income/expenses for this period
      const additionalIncomes = (await collections.additionalIncome
        .where('wagePeriodId', '==', periodId)
        .get()
        .then(s => s.docs.map(doc => doc.data()))) as AdditionalIncome[];

      const additionalExpenses = (await collections.additionalExpense
        .where('wagePeriodId', '==', periodId)
        .get()
        .then(s => s.docs.map(doc => doc.data()))) as AdditionalExpense[];

      // 5. Fetch other periods in the same month for social security calculation
      const monthPrefix = period.periodCode.split('-')[0]; // e.g. "202401"
      const otherPeriodsInMonth = await this.query([
        { field: 'periodCode', operator: '>=', value: `${monthPrefix}-P1` },
        { field: 'periodCode', operator: '<=', value: `${monthPrefix}-P2` }
      ]);
      const pastPeriodsInMonth = otherPeriodsInMonth.filter(p => p.id !== periodId && p.status === 'paid' || p.status === 'approved');

      // 5.5 Detect discrepancies and generate late records before calculation
      await scanDataService.detectDiscrepancies(
        period.projectLocationId,
        period.startDate,
        period.endDate,
        calculatedBy
      );



      const dcSummaries: DCWageSummary[] = [];
      let totalRegularHours = 0;
      let totalOtHours = 0;
      let totalGrossWages = 0;
      let totalDeductions = 0;
      let totalNetWages = 0;

      // 6. Calculate for each DC
      for (const dc of dcs) {
        // Filter entries for this DC
        const dcEntries = allEntries.filter((e: any) => e.dailyContractorId === dc.id);

        // Aggregate hours
        const regHours = dcEntries.filter((e: any) => e.workType === 'regular').reduce((sum: number, e: any) => sum + e.netHours, 0);
        const otMorning = dcEntries.filter((e: any) => e.workType === 'ot_morning').reduce((sum: number, e: any) => sum + e.totalHours, 0);
        const otNoon = dcEntries.filter((e: any) => e.workType === 'ot_noon').reduce((sum: number, e: any) => sum + e.totalHours, 0);
        const otEvening = dcEntries.filter((e: any) => e.workType === 'ot_evening').reduce((sum: number, e: any) => sum + e.totalHours, 0);
        const dcTotalOtHours = otMorning + otNoon + otEvening;

        // Fetch income/expense details
        const compensation = await dailyContractorService.getCompensationDetails(dc.id);
        const income = compensation.income;
        const expense = compensation.expense;

        if (!income) {
          logger.warn(`No income details found for DC: ${dc.employeeId}`);
          continue;
        }

        // Calculate wages
        const regularWages = regHours * income.hourlyRate;
        const otWages = dcTotalOtHours * income.hourlyRate * 1.5;
        const professionalFees = regHours * income.professionalRate;

        // Sum additional income for this DC
        const dcAddIncomeList = additionalIncomes.filter(i => i.dailyContractorId === dc.id);
        const totalAddIncome = dcAddIncomeList.reduce((sum, i) => sum + i.amount, 0);

        const totalIncome = regularWages + otWages + professionalFees + (income.phoneAllowance || 0) + totalAddIncome;

        // Sum additional expenses
        const dcAddExpenseList = additionalExpenses.filter(e => e.dailyContractorId === dc.id);
        const totalAddExpense = dcAddExpenseList.reduce((sum, e) => sum + e.amount, 0);

        // Fetch late deductions (already generated by detectDiscrepancies)
        const dcLateRecords = await lateRecordService.getByPeriod(periodId);
        const dcSpecificLateRecords = dcLateRecords.filter(r => r.dailyContractorId === dc.id);
        const lateDeductions = dcSpecificLateRecords.reduce((sum, r) => sum + r.lateDeduction, 0);

        // Calculate Social Security (SS)
        // ... (existing SS calculation) ...
        const ssShould = regularWages * 0.05;
        let ssPaidInMonth = 0;
        for (const pastPeriod of pastPeriodsInMonth) {
          const pastSummary = pastPeriod.dcSummaries.find(s => s.dailyContractorId === dc.id);
          if (pastSummary) {
            ssPaidInMonth += pastSummary.socialSecurityDeduction;
          }
        }

        let ssDeduction = 0;
        if (!dc.employeeId.startsWith('9')) {
          if (ssShould + ssPaidInMonth > 750) {
            ssDeduction = Math.max(0, 750 - ssPaidInMonth);
          } else {
            ssDeduction = ssShould > 0 ? Math.max(ssShould, 83) : 0;
          }
        }

        const totalExpense = (expense?.accommodationCost || 0) +
          (expense?.followerAccommodation || 0) +
          (expense?.refrigeratorCost || 0) +
          (expense?.soundSystemCost || 0) +
          (expense?.tvCost || 0) +
          (expense?.washingMachineCost || 0) +
          (expense?.portableAcCost || 0) +
          totalAddExpense +
          lateDeductions +
          ssDeduction;

        const netWages = totalIncome - totalExpense;

        dcSummaries.push({
          dailyContractorId: dc.id,
          employeeId: dc.employeeId,
          name: dc.name,
          skillName: skillMap.get(dc.skillId) || 'N/A',
          regularHours: regHours,
          otMorningHours: otMorning,
          otNoonHours: otNoon,
          otEveningHours: otEvening,
          totalOtHours: dcTotalOtHours,
          totalHours: regHours + dcTotalOtHours,
          hourlyRate: income.hourlyRate,
          professionalRate: income.professionalRate,
          phoneAllowance: income.phoneAllowance || 0,
          regularWages,
          otWages,
          professionalFees,
          additionalIncome: totalAddIncome,
          totalIncome,
          accommodationCost: expense?.accommodationCost || 0,
          followerCount: expense?.followerCount || 0,
          followerAccommodation: expense?.followerAccommodation || 0,
          refrigeratorCost: expense?.refrigeratorCost || 0,
          soundSystemCost: expense?.soundSystemCost || 0,
          tvCost: expense?.tvCost || 0,
          washingMachineCost: expense?.washingMachineCost || 0,
          portableAcCost: expense?.portableAcCost || 0,
          additionalExpenses: totalAddExpense,
          socialSecurityDeduction: ssDeduction,
          lateDeductions,
          totalExpenses: totalExpense,
          netWages,
          additionalIncomeIds: dcAddIncomeList.map(i => i.id),
          additionalExpenseIds: dcAddExpenseList.map(e => e.id)
        });

        // Global totals
        totalRegularHours += regHours;
        totalOtHours += dcTotalOtHours;
        totalGrossWages += totalIncome;
        totalDeductions += totalExpense;
        totalNetWages += netWages;
      }

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
        logger.info(`Wages calculated for period: ${period.periodCode}`, { periodId });
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
  async getByStatus(status: PeriodStatus): Promise<WagePeriod[]> {
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
