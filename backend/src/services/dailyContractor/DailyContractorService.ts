/**
 * DailyContractorService
 * บริการจัดการแรงงานรายวัน (DC)
 *
 * Manages daily contractors with CRUD operations, password hashing, and additional queries.
 */

import bcrypt from 'bcrypt';
import { CrudService, PaginationOptions } from '../base/CrudService';
import {
  DailyContractor,
  DailyContractorDTO,
  CreateDailyContractorInput,
  UpdateDailyContractorInput,
} from '../../models/DailyContractor';
import {
  DCIncomeDetails,
  CreateDCIncomeDetailsInput,
  UpdateDCIncomeDetailsInput,
} from '../../models/DCIncomeDetails';
import {
  DCExpenseDetails,
  CreateDCExpenseDetailsInput,
  UpdateDCExpenseDetailsInput,
  calculateFollowerAccommodation,
} from '../../models/DCExpenseDetails';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * DailyContractorService
 * Extends CrudService with DC-specific operations
 */
class DailyContractorService extends CrudService<DailyContractor> {
  constructor() {
    super(collections.dailyContractors);
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
      const username = input.username ? input.username.trim() : undefined;

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

      const now = new Date();
      const dcData: Omit<DailyContractor, 'id'> = {
        employeeId,
        username,
        passwordHash,
        name,
        skillId,
        projectLocationIds: input.projectLocationIds || [],
        phoneNumber: input.phoneNumber || undefined,
        idCardNumber: input.idCardNumber || undefined,
        address: input.address || undefined,
        emergencyContact: input.emergencyContact || undefined,
        emergencyPhone: input.emergencyPhone || undefined,
        isActive: input.isActive !== undefined ? input.isActive : true,
        startDate: input.startDate,
        endDate: input.endDate,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
      };

      const dc = await this.create(dcData);
      logger.info(`Daily contractor created: ${dc.employeeId}`, { dcId: dc.id });

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
    const normalizeOptionalString = (
      value?: string | null
    ): string | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    };

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
      const username = input.username ? input.username.trim() : undefined;
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

      if (input.projectLocationIds !== undefined) {
        updateData.projectLocationIds = input.projectLocationIds;
      }

      const phoneNumber = normalizeOptionalString(input.phoneNumber);
      if (phoneNumber !== undefined) {
        updateData.phoneNumber = phoneNumber || null;
      }

      const idCardNumber = normalizeOptionalString(input.idCardNumber);
      if (idCardNumber !== undefined) {
        updateData.idCardNumber = idCardNumber || null;
      }

      const address = normalizeOptionalString(input.address);
      if (address !== undefined) {
        updateData.address = address;
      }

      const emergencyContact = normalizeOptionalString(input.emergencyContact);
      if (emergencyContact !== undefined) {
        updateData.emergencyContact = emergencyContact;
      }

      const emergencyPhone = normalizeOptionalString(input.emergencyPhone);
      if (emergencyPhone !== undefined) {
        updateData.emergencyPhone = emergencyPhone || null;
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
   * Find DC by username
   */
  async findByUsername(username: string): Promise<DailyContractor | null> {
    try {
      const results = await this.query([
        {
          field: 'username',
          operator: '==',
          value: username,
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
          field: 'projectLocationIds',
          operator: 'array-contains',
          value: projectLocationId,
        },
      ]);

      return results.map((dc) => this.toDTO(dc));
    } catch (error: any) {
      logger.error('Error getting DCs by project:', error);
      throw error;
    }
  }

  /**
   * Search DCs by keyword (employeeId or name)
   */
  async searchByKeyword(
    keyword: string,
    options?: PaginationOptions
  ): Promise<DailyContractor[]> {
    const trimmed = keyword.trim().toLowerCase();

    const result = await this.getAll({
      page: options?.page || 1,
      pageSize: options?.pageSize || 200,
    });

    if (!trimmed) {
      return result.items;
    }

    return result.items.filter((dc) => {
      const idMatch = dc.employeeId?.toLowerCase().includes(trimmed);
      const nameMatch = dc.name?.toLowerCase().includes(trimmed);
      return Boolean(idMatch || nameMatch);
    });
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

  private async getIncomeDetailsRecord(
    dailyContractorId: string
  ): Promise<DCIncomeDetails | null> {
    const snapshot = await collections.dcIncomeDetails
      .where('dailyContractorId', '==', dailyContractorId)
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
    const snapshot = await collections.dcExpenseDetails
      .where('dailyContractorId', '==', dailyContractorId)
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

  async upsertCompensationDetails(
    dailyContractorId: string,
    data: {
      income?: {
        hourlyRate: number;
        professionalRate: number;
        phoneAllowancePerPeriod: number;
      };
      expense?: {
        accommodationCostPerPeriod: number;
        followerCount: number;
        refrigeratorCostPerPeriod: number;
        soundSystemCostPerPeriod: number;
        tvCostPerPeriod: number;
        washingMachineCostPerPeriod: number;
        portableAcCostPerPeriod: number;
      };
    },
    updatedBy: string
  ): Promise<{
    income: DCIncomeDetails | null;
    expense: DCExpenseDetails | null;
  }> {
    const now = new Date();

    if (data.income) {
      const existingIncome = await this.getIncomeDetailsRecord(dailyContractorId);
      const payload: CreateDCIncomeDetailsInput | UpdateDCIncomeDetailsInput = {
        hourlyRate: data.income.hourlyRate,
        professionalRate: data.income.professionalRate,
        phoneAllowance: data.income.phoneAllowancePerPeriod,
        effectiveDate: now,
      };

      if (existingIncome) {
        await collections.dcIncomeDetails.doc(existingIncome.id).update({
          ...payload,
          updatedAt: now,
          updatedBy,
        });
      } else {
        const docData: Omit<DCIncomeDetails, 'id'> = {
          dailyContractorId,
          hourlyRate: payload.hourlyRate as number,
          professionalRate: payload.professionalRate as number,
          phoneAllowance: payload.phoneAllowance as number,
          isActive: true,
          effectiveDate: now,
          createdAt: now,
          updatedAt: now,
          createdBy: updatedBy,
          updatedBy,
        };
        await collections.dcIncomeDetails.add(docData as any);
      }
    }

    if (data.expense) {
      const existingExpense = await this.getExpenseDetailsRecord(dailyContractorId);
      const followerAccommodation = calculateFollowerAccommodation(data.expense.followerCount);
      const payload: CreateDCExpenseDetailsInput | UpdateDCExpenseDetailsInput = {
        accommodationCost: data.expense.accommodationCostPerPeriod,
        followerCount: data.expense.followerCount,
        refrigeratorCost: data.expense.refrigeratorCostPerPeriod,
        soundSystemCost: data.expense.soundSystemCostPerPeriod,
        tvCost: data.expense.tvCostPerPeriod,
        washingMachineCost: data.expense.washingMachineCostPerPeriod,
        portableAcCost: data.expense.portableAcCostPerPeriod,
        effectiveDate: now,
      };

      if (existingExpense) {
        await collections.dcExpenseDetails.doc(existingExpense.id).update({
          ...payload,
          followerAccommodation,
          updatedAt: now,
          updatedBy,
        });
      } else {
        const docData: Omit<DCExpenseDetails, 'id'> = {
          dailyContractorId,
          accommodationCost: payload.accommodationCost as number,
          followerCount: payload.followerCount as number,
          followerAccommodation,
          refrigeratorCost: payload.refrigeratorCost ?? 0,
          soundSystemCost: payload.soundSystemCost ?? 0,
          tvCost: payload.tvCost ?? 0,
          washingMachineCost: payload.washingMachineCost ?? 0,
          portableAcCost: payload.portableAcCost ?? 0,
          isActive: true,
          effectiveDate: now,
          createdAt: now,
          updatedAt: now,
          createdBy: updatedBy,
          updatedBy,
        };
        await collections.dcExpenseDetails.add(docData as any);
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
  async verifyPassword(
    username: string,
    password: string
  ): Promise<boolean> {
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
}

// Singleton instance
export const dailyContractorService = new DailyContractorService();
