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
} from '../../models/WagePeriod';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { lateRecordService } from '../scanData/LateRecordService';

/**
 * WagePeriodService
 * Extends CrudService with wage calculation operations
 */
class WagePeriodService extends BaseCrudService<WagePeriod> {
  constructor() {
    super(collections.wagePeriods);
  }

  /**
   * Get all wage periods (filtered by isDeleted)
   */
  async getAll(options?: any): Promise<any> {
    try {
      // To support legacy data (missing isDeleted field), we fetch all records
      // and filter in memory. Since WagePeriods are relatively few, this is safe.
      const items = await this.query([], {
        orderBy: options?.orderBy || 'createdAt',
        orderDirection: options?.orderDirection || 'desc',
      });

      // Filter active records
      const activeItems = items.filter((item) => item.isDeleted !== true);

      // Manual pagination
      const total = activeItems.length;
      const pageSize = options?.pageSize || 50;
      const page = options?.page || 1;
      const start = (page - 1) * pageSize;
      const paginatedItems = activeItems.slice(start, start + pageSize);

      return {
        items: paginatedItems,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      logger.error('Error getting all wage periods:', error);
      throw error;
    }
  }

  /**
   * Get wage period by ID (filtered by isDeleted)
   */
  async getById(id: string): Promise<WagePeriod | null> {
    const period = await super.getById(id);
    if (!period || period.isDeleted) {
      return null;
    }
    return period;
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
        projectCode: input.projectCode,
        projectName: input.projectName,
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

      // [T-360] Get project UUID for querying related collections
      const projects = await collections.projectLocations.where('projectCode', '==', period.projectCode).get();
      if (projects.empty) {
        throw new AppError(`Project not found for code: ${period.projectCode}`, 404);
      }
      const projectLocationId = projects.docs[0].id;

      // 1. Fetch all daily reports for the period and project
      const reports = await collections.dailyReports
        .where('projectLocationId', '==', projectLocationId)
        .where('date', '>=', period.startDate)
        .where('date', '<=', period.endDate)
        .get()
        .then((s: any) => s.docs.map((doc: any) => doc.data()));

      // Flatten all entries from all reports
      const allEntries = reports.flatMap((report: any) => (report.entries || []));

      // 2. Fetch all daily contractors active in this project
      const { dailyContractorService } = await import('../dailyContractor/DailyContractorService');
      const dcs = await dailyContractorService.getByProject(projectLocationId);

      // 3. (Deprecated) Fetch skills for names - now using dc.skillId directly

      // 4. Fetch additional income/expenses for this period
      const additionalIncomes = (await collections.additionalIncome
        .where('wagePeriodId', '==', periodId)
        .get()
        .then((s: any) => s.docs.map((doc: any) => doc.data()))) as any[];

      const additionalExpenses = (await collections.additionalExpense
        .where('wagePeriodId', '==', periodId)
        .get()
        .then((s: any) => s.docs.map((doc: any) => doc.data()))) as any[];

      // 5. Fetch other periods in the same month for social security calculation
      const monthPrefix = period.periodCode.split('-')[0]; // e.g. "202401"
      const otherPeriodsInMonth = await this.query([
        { field: 'periodCode', operator: '>=', value: `${monthPrefix}-P1` },
        { field: 'periodCode', operator: '<=', value: `${monthPrefix}-P2` }
      ]);
      const pastPeriodsInMonth = otherPeriodsInMonth.filter(p => p.id !== periodId && p.status === 'paid' || p.status === 'approved');

      // [T-401] Trigger Work Verification Sync
      const { workVerificationService } = await import('./WorkVerificationService');
      await workVerificationService.syncVerification(
        projectLocationId,
        period.startDate,
        period.endDate
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
        // [T-401] In the future, we could filter here: e.g., e.verificationStatus === 'auto_verified'
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

        // Calculate wages (hourlyRate is derived from dailyWageRate)
        const hourlyRate = income.dailyWageRate / 8;
        const regularWages = regHours * hourlyRate;
        const otWages = dcTotalOtHours * hourlyRate * 1.5;
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

        // Calculate Social Security (SS) dynamically using the new Rules engine
        let ssDeduction = 0;
        
        // 1) First check: is the employee exempt? We still respect the "9" rule inside the service or we can check it upfront.
        // But the Rules engine handles the employeeId exemption natively
        
        // 2) Deduct what was already paid this month
        let ssPaidInMonth = 0;
        for (const pastPeriod of pastPeriodsInMonth) {
          const pastSummary = pastPeriod.dcSummaries.find(s => s.dailyContractorId === dc.id);
          if (pastSummary) {
            ssPaidInMonth += pastSummary.socialSecurityDeduction;
          }
        }

        // 3) Evaluate current period's raw deduction based on Admin rules (Using Total Income per User Request)
        const { socialSecurityRuleService } = await import('./SocialSecurityRuleService');
        const rawSSDeduction = await socialSecurityRuleService.calculateDeduction(totalIncome, dc.employeeId);
        
        // 4) Apply logic: max SS per month is typically 750 combined
        if (rawSSDeduction > 0) {
            if (rawSSDeduction + ssPaidInMonth > 750) {
                ssDeduction = Math.max(0, 750 - ssPaidInMonth);
            } else {
                ssDeduction = rawSSDeduction;
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
          skillName: dc.skillId || 'ไม่ระบุ',
          regularHours: regHours,
          otMorningHours: otMorning,
          otNoonHours: otNoon,
          otEveningHours: otEvening,
          totalOtHours: dcTotalOtHours,
          totalHours: regHours + dcTotalOtHours,
          hourlyRate: income.dailyWageRate / 8,
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
      // Query by periodCode only
      const results = await this.query([
        {
          field: 'periodCode',
          operator: '==',
          value: periodCode,
        },
      ]);

      // Filter in memory to handle legacy data (where isDeleted is missing)
      // and soft-deleted data (where isDeleted is true)
      const active = results.find((p) => p.isDeleted !== true);

      return active || null;
    } catch (error: any) {
      logger.error('Error finding wage period by code:', error);
      throw error;
    }
  }

  /**
   * Get wage periods by project
   */
  async getByProject(projectCode: string): Promise<WagePeriod[]> {
    try {
      const results = await this.query([
        {
          field: 'projectCode',
          operator: '==',
          value: projectCode,
        },
      ]);

      // Filter in memory to handle legacy data
      return results.filter((p) => p.isDeleted !== true);
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
      const results = await this.query([
        {
          field: 'status',
          operator: '==',
          value: status,
        },
      ]);

      // Filter in memory to handle legacy data
      return results.filter((p) => p.isDeleted !== true);
    } catch (error: any) {
      logger.error('Error getting wage periods by status:', error);
      throw error;
    }
  }

  /**
   * [P2] Check if a date is locked for editing
   * Checks if any Approved or Paid wage period covers this date and project
   */
  async isDateLocked(date: Date, projectCode: string): Promise<boolean> {
    try {
      const results = await this.query([
        { field: 'projectCode', operator: '==', value: projectCode },
        { field: 'startDate', operator: '<=', value: date }
      ]);

      // Filter in memory: endDate >= date AND status is approved/paid
      const lockedPeriod = results.find(p => 
        p.isDeleted !== true &&
        p.endDate >= date &&
        (p.status === 'approved' || p.status === 'paid' || p.status === 'locked')
      );

      return !!lockedPeriod;
    } catch (error: any) {
      logger.error('Error checking if date is locked:', error);
      return false; // Default to unlocked if check fails to avoid blocking UI
    }
  }
}

// Singleton instance
export const wagePeriodService = new WagePeriodService();
