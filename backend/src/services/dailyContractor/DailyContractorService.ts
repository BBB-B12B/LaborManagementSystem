/**
 * DailyContractorService
 * บริการจัดการแรงงานรายวัน (DC)
 *
 * Manages daily contractors with CRUD operations, password hashing, and additional queries.
 */

import bcrypt from 'bcrypt';
import { BaseCrudService, PaginationOptions } from '../base/BaseCrudService';
import {
  DailyContractor,
  DailyContractorDTO,
  CreateDailyContractorInput,
  UpdateDailyContractorInput,
  DCIncomeDetails,
  DCExpenseDetails,
  dcIncomeDetailsConverter,
  dcExpenseDetailsConverter,
  calculateFollowerAccommodation,
} from '../../models';
import { collections } from '../../config/collections';
import { db } from '../../config/firebase';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { projectLocationService } from '../project/ProjectLocationService';

/**
 * DailyContractorService
 * Extends CrudService with DC-specific operations
 */
class DailyContractorService extends BaseCrudService<DailyContractor> {
  constructor() {
    super(collections.dailyContractors as any);
  }

  /**
   * Create new daily contractor
   */
  async createDC(
    input: CreateDailyContractorInput,
    createdBy: string
  ): Promise<DailyContractorDTO> {
    try {
      const employeeId = (input.employeeId ?? '').trim();
      const name = (input.name ?? '').trim();
      const skillId = (input.skillId ?? '').trim();
      // Normalize username to lowercase
      const username = input.username ? input.username.trim().toLowerCase() : undefined;

      // Check for duplicate employeeId when provided
      if (employeeId) {
        const existingById = await this.findByEmployeeId(employeeId);
        if (existingById) {
          throw new AppError('Employee ID already exists', 409);
        }
      }

      // Check for duplicate username if provided
      if (username) {
        const existingByUsername = await this.findByUsername(username);
        if (existingByUsername) {
          throw new AppError('Username already exists', 409);
        }
      }

      // Hash password if provided
      let passwordHash: string | undefined = undefined;
      if (input.password) {
        passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
      }

      // Fetch department from ProjectLocation
      let department = '';
      if (input.projectLocationId) {
        const project = await projectLocationService.getById(input.projectLocationId);
        if (project && project.department) {
          department = project.department;
        }
      }
      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const hasAttendanceStats =
        input.paidLeave !== undefined ||
        input.unpaidLeave !== undefined ||
        input.lateMinutes !== undefined ||
        input.earlyLeaveMinutes !== undefined ||
        input.absentDays !== undefined;

      const attendanceStats = hasAttendanceStats
        ? {
            yearly: {
              [currentYear]: {
                paidLeave: input.paidLeave || 0,
                unpaidLeave: input.unpaidLeave || 0,
                lateMinutes: input.lateMinutes || 0,
                earlyLeaveMinutes: input.earlyLeaveMinutes || 0,
                absentDays: input.absentDays || 0,
              },
            },
            periods: {},
          }
        : undefined;

      const dcData: Omit<DailyContractor, 'id'> = {
        employeeId,
        username,
        passwordHash,
        name,
        skillId,
        projectLocationId: input.projectLocationId || '',
        department,
        dateOfBirth: input.dateOfBirth || null,
        isActive: input.isActive !== undefined ? input.isActive : true,
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
        dailyWageRate: input.dailyWageRate || 0,
        professionalRate: input.professionalRate || 0,
        phoneAllowance: input.phoneAllowance || 0,
        mouDeductionRate: input.mouDeductionRate || 0,
        nationality: input.nationality || 'ไทย',
        otherIncome: input.otherIncome || 0,
        housingFee: input.housingFee || 0,
        followerCount: input.followerCount || 0,
        refrigeratorFee: input.refrigeratorFee || 0,
        soundSystemFee: input.soundSystemFee || 0,
        tvFee: input.tvFee || 0,
        laundryFee: input.laundryFee || 0,
        airConFee: input.airConFee || 0,
        otherDeduction: input.otherDeduction || 0,
        attendanceStats,
      };
      // Enforce DocumentID = DC-EmployeeID (F-006 & T-230)
      if (!employeeId) {
        throw new AppError('Employee ID is required', 400);
      }

      // T-230: Changed ID format to DC-[employeeId]
      const docId = `DC-${employeeId}`;
      const existingDoc = await this.getById(docId);
      if (existingDoc) {
        throw new AppError('Daily Contractor ID already exists (Duplicate Employee ID)', 409);
      }

      const dc = await this.createWithId(docId, dcData);
      logger.info(`Daily contractor created: ${dc.employeeId} (ID: ${dc.id})`, { dcId: dc.id });

      return this.toDTO(dc);
    } catch (error: any) {
      logger.error('Error creating daily contractor:', error);
      throw error;
    }
  }

  /**
   * Update daily contractor
   */
  async updateDC(
    id: string,
    input: UpdateDailyContractorInput,
    updatedBy: string
  ): Promise<DailyContractorDTO | null> {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        return null;
      }

      // Check for duplicate employeeId if being changed
      const employeeId = input.employeeId ? input.employeeId.trim() : undefined;
      if (employeeId && employeeId !== existing.employeeId) {
        const duplicate = await this.findByEmployeeId(employeeId);
        if (duplicate) {
          throw new AppError('Employee ID already exists', 409);
        }
      }

      // Check for duplicate username if being changed
      const username = input.username ? input.username.trim().toLowerCase() : undefined;
      if (username && username !== existing.username) {
        const duplicate = await this.findByUsername(username);
        if (duplicate) {
          throw new AppError('Username already exists', 409);
        }
      }

      // Re-hash password if being changed
      let passwordHash: string | undefined;
      if (input.password) {
        passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
      }

      const updateData: Partial<DailyContractor> = {
        updatedAt: new Date(),
        updatedBy,
      };

      if (passwordHash !== undefined) {
        updateData.passwordHash = passwordHash;
      }

      if (employeeId !== undefined) {
        updateData.employeeId = employeeId;
      }

      if (username !== undefined) {
        updateData.username = username;
      }

      if (input.name !== undefined) {
        updateData.name = input.name.trim();
      }

      if (input.skillId !== undefined) {
        updateData.skillId = input.skillId.trim();
      }

      if (input.projectLocationId !== undefined) {
        updateData.projectLocationId = input.projectLocationId;

        // Update department if project changes
        if (!input.projectLocationId) {
          updateData.department = '';
        } else if (input.projectLocationId !== existing.projectLocationId) {
          const project = await projectLocationService.getById(input.projectLocationId);
          if (project && project.department) {
            updateData.department = project.department;
          } else {
            updateData.department = '';
          }
        }
      }

      if (input.dateOfBirth !== undefined) {
        updateData.dateOfBirth = input.dateOfBirth || null;
      }

      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      if (input.startDate !== undefined) {
        updateData.startDate = input.startDate || null;
      }

      if (input.endDate !== undefined) {
        updateData.endDate = input.endDate || null;
      }

      if (input.dailyWageRate !== undefined) updateData.dailyWageRate = input.dailyWageRate;
      if (input.professionalRate !== undefined)
        updateData.professionalRate = input.professionalRate;
      if (input.phoneAllowance !== undefined) updateData.phoneAllowance = input.phoneAllowance;
      if (input.mouDeductionRate !== undefined)
        updateData.mouDeductionRate = input.mouDeductionRate;
      if (input.nationality !== undefined) updateData.nationality = input.nationality;
      if (input.otherIncome !== undefined) updateData.otherIncome = input.otherIncome;
      if (input.housingFee !== undefined) updateData.housingFee = input.housingFee;
      if (input.followerCount !== undefined) updateData.followerCount = input.followerCount;
      if (input.refrigeratorFee !== undefined) updateData.refrigeratorFee = input.refrigeratorFee;
      if (input.soundSystemFee !== undefined) updateData.soundSystemFee = input.soundSystemFee;
      if (input.tvFee !== undefined) updateData.tvFee = input.tvFee;
      if (input.laundryFee !== undefined) updateData.laundryFee = input.laundryFee;
      if (input.airConFee !== undefined) updateData.airConFee = input.airConFee;
      if (input.otherDeduction !== undefined) updateData.otherDeduction = input.otherDeduction;

      if (
        input.paidLeave !== undefined ||
        input.unpaidLeave !== undefined ||
        input.lateMinutes !== undefined ||
        input.earlyLeaveMinutes !== undefined ||
        input.absentDays !== undefined
      ) {
        const currentYear = new Date().getFullYear().toString();
        const existingStats = existing.attendanceStats || { yearly: {}, periods: {} };
        const yearlyStats = existingStats.yearly || {};
        const currentYearStats = yearlyStats[currentYear] || {
          paidLeave: 0,
          unpaidLeave: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          absentDays: 0,
        };

        updateData.attendanceStats = {
          ...existingStats,
          yearly: {
            ...yearlyStats,
            [currentYear]: {
              paidLeave: input.paidLeave !== undefined ? input.paidLeave : currentYearStats.paidLeave,
              unpaidLeave: input.unpaidLeave !== undefined ? input.unpaidLeave : currentYearStats.unpaidLeave,
              lateMinutes: input.lateMinutes !== undefined ? input.lateMinutes : currentYearStats.lateMinutes,
              earlyLeaveMinutes: input.earlyLeaveMinutes !== undefined ? input.earlyLeaveMinutes : currentYearStats.earlyLeaveMinutes,
              absentDays: input.absentDays !== undefined ? input.absentDays : currentYearStats.absentDays,
            },
          },
        };
      }

      // Remove password from update data (we use passwordHash)
      delete (updateData as any).password;

      const dc = await this.update(id, updateData);
      if (dc) {
        logger.info(`Daily contractor updated: ${dc.employeeId}`, { dcId: id });
        return this.toDTO(dc);
      }

      return null;
    } catch (error: any) {
      logger.error('Error updating daily contractor:', error);
      throw error;
    }
  }

  /**
   * Find DC by employeeId
   */
  async findByEmployeeId(employeeId: string): Promise<DailyContractor | null> {
    try {
      const results = await this.query([
        {
          field: 'employeeId',
          operator: '==',
          value: employeeId,
        },
      ]);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      logger.error('Error finding DC by employeeId:', error);
      throw error;
    }
  }

  /**
   * Find DC by employeeId or idHistory
   */
  async findByEmployeeIdOrHistory(employeeId: string): Promise<DailyContractor | null> {
    try {
      // 1. Check current ID
      const byCurrentId = await this.findByEmployeeId(employeeId);
      if (byCurrentId) return byCurrentId;

      // 2. Check history
      const results = await this.query([
        {
          field: 'idHistory',
          operator: 'array-contains',
          value: employeeId,
        },
      ]);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      logger.error('Error finding DC by employeeId or history:', error);
      throw error;
    }
  }

  /**
   * Find DC by username
   */
  async findByUsername(username: string): Promise<DailyContractor | null> {
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const results = await this.query([
        {
          field: 'username',
          operator: '==',
          value: normalizedUsername,
        },
      ]);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      logger.error('Error finding DC by username:', error);
      throw error;
    }
  }

  /**
   * Get DCs by skill
   */
  async getBySkill(skillId: string): Promise<DailyContractorDTO[]> {
    try {
      const results = await this.query([
        {
          field: 'skillId',
          operator: '==',
          value: skillId,
        },
      ]);

      return results.map((dc) => this.toDTO(dc));
    } catch (error: any) {
      logger.error('Error getting DCs by skill:', error);
      throw error;
    }
  }

  /**
   * Get DCs by project
   */
  async getByProject(projectLocationId: string): Promise<DailyContractorDTO[]> {
    try {
      const results = await this.query([
        {
          field: 'projectLocationId',
          operator: '==',
          value: projectLocationId,
        },
      ]);

      return results.map((dc) => this.toDTO(dc));
    } catch (error: any) {
      logger.error('Error getting DCs by project:', error);
      throw error;
    }
  }

  async searchByKeyword(
    keyword: string,
    options?: PaginationOptions
  ): Promise<{
    items: DailyContractor[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const trimmed = keyword.trim();
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 200;

    // 1. If keyword is empty, just use the standard paginated getAll
    if (!trimmed) {
      const result = await this.getAll(options);
      return {
        items: result.items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
    }

    // 2. If it is an exact document lookup, try that first (Document ID is DC-[employeeId])
    const directDoc = await this.getById(`DC-${trimmed}`);
    if (directDoc) {
      return {
        items: [directDoc],
        total: 1,
        page: 1,
        pageSize,
        totalPages: 1,
      };
    }

    // 3. Fallback to in-memory filtering over a larger batch (limit 2000).
    // Since we optimized dailyContractors.routes.ts to skip N+1 subcollection gets (hasCompensation: false),
    // querying all contractors in one batch takes only ~70-150ms.
    // This allows full case-insensitive substring matching (includes) anywhere in the name/employeeId.
    const snapshot = await this.collection.limit(2000).get();
    const allItems = snapshot.docs.map((doc) => doc.data() as DailyContractor);

    const lowerKeyword = trimmed.toLowerCase();
    const filtered = allItems.filter((dc) => {
      const idMatch = dc.employeeId?.toLowerCase().includes(lowerKeyword);
      const nameMatch = dc.name?.toLowerCase().includes(lowerKeyword);
      return Boolean(idMatch || nameMatch);
    });

    // Sort alphabetically by name
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const total = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }


  private sortByEffectiveDate<T extends { effectiveDate: Date; updatedAt: Date }>(
    records: T[]
  ): T[] {
    return [...records].sort(
      (a, b) =>
        (b.effectiveDate?.getTime?.() || 0) - (a.effectiveDate?.getTime?.() || 0) ||
        (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0)
    );
  }

  private async getIncomeDetailsRecord(dailyContractorId: string): Promise<DCIncomeDetails | null> {
    // T-DB-001: Sub-collection Logic
    const snapshot = await collections.dailyContractors
      .doc(dailyContractorId)
      .collection('dcIncomeDetails')
      .withConverter(dcIncomeDetailsConverter)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const records = snapshot.docs.map((doc) => doc.data() as DCIncomeDetails);
    return this.sortByEffectiveDate(records)[0] || null;
  }

  private async getExpenseDetailsRecord(
    dailyContractorId: string
  ): Promise<DCExpenseDetails | null> {
    // T-DB-001: Sub-collection Logic
    const snapshot = await collections.dailyContractors
      .doc(dailyContractorId)
      .collection('dcExpenseDetails')
      .withConverter(dcExpenseDetailsConverter)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const records = snapshot.docs.map((doc) => doc.data() as DCExpenseDetails);
    return this.sortByEffectiveDate(records)[0] || null;
  }

  async getCompensationDetails(dailyContractorId: string): Promise<{
    income: DCIncomeDetails | null;
    expense: DCExpenseDetails | null;
  }> {
    const [income, expense] = await Promise.all([
      this.getIncomeDetailsRecord(dailyContractorId),
      this.getExpenseDetailsRecord(dailyContractorId),
    ]);

    return {
      income,
      expense,
    };
  }

  async getCompensationDetailsBulk(
    dailyContractorIds: string[]
  ): Promise<Map<string, { income: DCIncomeDetails | null; expense: DCExpenseDetails | null }>> {
    const map = new Map<string, { income: DCIncomeDetails | null; expense: DCExpenseDetails | null }>();
    if (dailyContractorIds.length === 0) return map;

    // Initialize map entries with null
    for (const id of dailyContractorIds) {
      map.set(id, { income: null, expense: null });
    }

    // Helper to chunk array
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const chunks = chunkArray(dailyContractorIds, 30);

    // Fetch incomes and expenses in parallel batches
    const incomeRecords: DCIncomeDetails[] = [];
    const expenseRecords: DCExpenseDetails[] = [];

    await Promise.all([
      // Fetch all active/matching incomes
      Promise.all(
        chunks.map(async (chunk) => {
          const snap = await db
            .collectionGroup('dcIncomeDetails')
            .where('dailyContractorId', 'in', chunk)
            .get();
          snap.docs.forEach((doc) => {
            const converted = dcIncomeDetailsConverter.fromFirestore(doc);
            incomeRecords.push(converted);
          });
        })
      ),
      // Fetch all active/matching expenses
      Promise.all(
        chunks.map(async (chunk) => {
          const snap = await db
            .collectionGroup('dcExpenseDetails')
            .where('dailyContractorId', 'in', chunk)
            .get();
          snap.docs.forEach((doc) => {
            const converted = dcExpenseDetailsConverter.fromFirestore(doc);
            expenseRecords.push(converted);
          });
        })
      ),
    ]);

    // Group records by contractor ID
    const incomeByDC = new Map<string, DCIncomeDetails[]>();
    const expenseByDC = new Map<string, DCExpenseDetails[]>();

    for (const inc of incomeRecords) {
      if (!incomeByDC.has(inc.dailyContractorId)) {
        incomeByDC.set(inc.dailyContractorId, []);
      }
      incomeByDC.get(inc.dailyContractorId)!.push(inc);
    }

    for (const exp of expenseRecords) {
      if (!expenseByDC.has(exp.dailyContractorId)) {
        expenseByDC.set(exp.dailyContractorId, []);
      }
      expenseByDC.get(exp.dailyContractorId)!.push(exp);
    }

    // Find the latest record per contractor using sortByEffectiveDate
    for (const id of dailyContractorIds) {
      const incList = incomeByDC.get(id) || [];
      const expList = expenseByDC.get(id) || [];

      const income = incList.length > 0 ? this.sortByEffectiveDate(incList)[0] : null;
      const expense = expList.length > 0 ? this.sortByEffectiveDate(expList)[0] : null;

      map.set(id, { income, expense });
    }

    return map;
  }


  async upsertCompensationDetails(
    dailyContractorId: string,
    data: {
      income?: {
        dailyWageRate: number;
        professionalRate: number;
        phoneAllowancePerPeriod: number;
        allowance?: number;
        otherIncome?: number;
        mouDeductionRate?: number;
      };
      expense?: {
        accommodationCostPerPeriod: number;
        followerCount: number;
        refrigeratorCostPerPeriod: number;
        soundSystemCostPerPeriod: number;
        tvCostPerPeriod: number;
        washingMachineCostPerPeriod: number;
        portableAcCostPerPeriod: number;
        otherDeduction?: number;
      };
    },
    updatedBy: string
  ): Promise<{
    income: DCIncomeDetails | null;
    expense: DCExpenseDetails | null;
  }> {
    const now = new Date();
    const dcRef = collections.dailyContractors.doc(dailyContractorId);

    if (data.income) {
      const existingIncome = await this.getIncomeDetailsRecord(dailyContractorId);
      const payload = {
        dailyWageRate: data.income.dailyWageRate,
        professionalRate: data.income.professionalRate,
        phoneAllowance: data.income.phoneAllowancePerPeriod,
        allowance: data.income.allowance ?? 0,
        otherIncome: data.income.otherIncome ?? 0,
        mouDeductionRate: data.income.mouDeductionRate ?? 0,
        effectiveDate: now,
      };

      if (existingIncome) {
        await dcRef
          .collection('dcIncomeDetails')
          .doc(existingIncome.id)
          .update({
            ...payload,
            updatedAt: now,
            updatedBy,
          });
      } else {
        const docData: Omit<DCIncomeDetails, 'id'> = {
          dailyContractorId,
          dailyWageRate: payload.dailyWageRate,
          professionalRate: payload.professionalRate,
          phoneAllowance: payload.phoneAllowance,
          allowance: payload.allowance,
          otherIncome: payload.otherIncome,
          mouDeductionRate: payload.mouDeductionRate,
          isActive: true,
          effectiveDate: now,
          createdAt: now,
          updatedAt: now,
          createdBy: updatedBy,
          updatedBy,
        };
        await dcRef
          .collection('dcIncomeDetails')
          .withConverter(dcIncomeDetailsConverter)
          .add(docData as any);
      }
    }

    if (data.expense) {
      const existingExpense = await this.getExpenseDetailsRecord(dailyContractorId);
      const followerAccommodation = calculateFollowerAccommodation(data.expense.followerCount);
      const payload = {
        accommodationCost: data.expense.accommodationCostPerPeriod,
        followerCount: data.expense.followerCount,
        refrigeratorCost: data.expense.refrigeratorCostPerPeriod,
        soundSystemCost: data.expense.soundSystemCostPerPeriod,
        tvCost: data.expense.tvCostPerPeriod,
        washingMachineCost: data.expense.washingMachineCostPerPeriod,
        portableAcCost: data.expense.portableAcCostPerPeriod,
        otherDeduction: data.expense.otherDeduction ?? 0,
        effectiveDate: now,
      };

      if (existingExpense) {
        await dcRef
          .collection('dcExpenseDetails')
          .doc(existingExpense.id)
          .update({
            ...payload,
            followerAccommodation,
            updatedAt: now,
            updatedBy,
          });
      } else {
        const docData: Omit<DCExpenseDetails, 'id'> = {
          dailyContractorId,
          accommodationCost: payload.accommodationCost,
          followerCount: payload.followerCount,
          followerAccommodation,
          refrigeratorCost: payload.refrigeratorCost ?? 0,
          soundSystemCost: payload.soundSystemCost ?? 0,
          tvCost: payload.tvCost ?? 0,
          washingMachineCost: payload.washingMachineCost ?? 0,
          portableAcCost: payload.portableAcCost ?? 0,
          otherDeduction: payload.otherDeduction ?? 0,
          isActive: true,
          effectiveDate: now,
          createdAt: now,
          updatedAt: now,
          createdBy: updatedBy,
          updatedBy,
        };
        await dcRef
          .collection('dcExpenseDetails')
          .withConverter(dcExpenseDetailsConverter)
          .add(docData as any);
      }
    }

    return this.getCompensationDetails(dailyContractorId);
  }

  /**
   * Get active DCs only
   */
  async getActiveDCs(): Promise<DailyContractorDTO[]> {
    try {
      const results = await this.query([
        {
          field: 'isActive',
          operator: '==',
          value: true,
        },
      ]);

      return results.map((dc) => this.toDTO(dc));
    } catch (error: any) {
      logger.error('Error getting active DCs:', error);
      throw error;
    }
  }

  /**
   * Verify password for DC login
   */
  async verifyPassword(username: string, password: string): Promise<boolean> {
    try {
      const dc = await this.findByUsername(username);
      if (!dc || !dc.passwordHash) {
        return false;
      }

      return await bcrypt.compare(password, dc.passwordHash);
    } catch (error: any) {
      logger.error('Error verifying DC password:', error);
      return false;
    }
  }

  /**
   * Convert DailyContractor to DTO (remove sensitive fields)
   */
  toDTO(dc: DailyContractor): DailyContractorDTO {
    const { passwordHash, username, ...dto } = dc;
    return dto;
  }

  /**
   * Get DC with DTO by ID
   */
  async getByIdDTO(id: string): Promise<DailyContractorDTO | null> {
    const dc = await this.getById(id);
    return dc ? this.toDTO(dc) : null;
  }
  /**
   * Soft delete DC (set isActive = false)
   * Override BaseCrudService to use isActive instead of isDeleted
   */
  async softDelete(id: string, updatedBy?: string): Promise<boolean> {
    try {
      logger.info(`Attempting to soft delete DC with ID: ${id}`);
      const docRef = this.collection.doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        logger.warn(`Soft delete failed: DC not found (ID: ${id})`);
        return false;
      }

      await docRef.update({
        isActive: false,
        updatedAt: new Date(),
        updatedBy: updatedBy || 'system',
      } as any);

      logger.info(`Soft deleted DC successfully: ${id}`);
      return true;
    } catch (error: any) {
      logger.error(`Error soft deleting DC (ID: ${id}):`, error);
      throw error;
    }
  }
}

// Singleton instance
export const dailyContractorService = new DailyContractorService();
