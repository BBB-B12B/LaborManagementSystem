/**
 * SkillService
 * บริการจัดการทักษะ
 *
 * Manages labor skills with CRUD operations and additional queries.
 */

import { CrudService } from '../base/CrudService';
import { Skill, CreateSkillInput, UpdateSkillInput } from '../../models/Skill';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';

/**
 * SkillService
 * Extends CrudService with skill-specific operations
 */
class SkillService extends CrudService<Skill> {
  constructor() {
    super(collections.skills);
  }

  /**
   * Create new skill
   */
  async createSkill(input: CreateSkillInput): Promise<Skill> {
    try {
      // Check for duplicate code
      const existing = await this.findByCode(input.code);
      if (existing) {
        throw new AppError('Skill code already exists', 409);
      }

      const now = new Date();
      const skillData: Omit<Skill, 'id'> = {
        code: input.code.toUpperCase(),
        name: input.name,
        nameEnglish: input.nameEnglish,
        description: input.description,
        baseHourlyRate: input.baseHourlyRate,
        isActive: input.isActive !== undefined ? input.isActive : true,
        createdAt: now,
      };

      const skill = await this.create(skillData);
      logger.info(`Skill created: ${skill.code}`, { skillId: skill.id });

      return skill;
    } catch (error: any) {
      logger.error('Error creating skill:', error);
      throw error;
    }
  }

  /**
   * Update skill
   */
  async updateSkill(
    id: string,
    input: UpdateSkillInput
  ): Promise<Skill | null> {
    try {
      // If code is being changed, check for duplicates
      if (input.code) {
        const existing = await this.findByCode(input.code);
        if (existing && existing.id !== id) {
          throw new AppError('Skill code already exists', 409);
        }
      }

      const updateData: Partial<Skill> = {
        ...input,
        code: input.code ? input.code.toUpperCase() : undefined,
      };

      const skill = await this.update(id, updateData);
      if (skill) {
        logger.info(`Skill updated: ${skill.code}`, { skillId: id });
      }

      return skill;
    } catch (error: any) {
      logger.error('Error updating skill:', error);
      throw error;
    }
  }

  /**
   * Find skill by code
   */
  async findByCode(code: string): Promise<Skill | null> {
    try {
      const results = await this.query([
        {
          field: 'code',
          operator: '==',
          value: code.toUpperCase(),
        },
      ]);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      logger.error('Error finding skill by code:', error);
      throw error;
    }
  }

  /**
   * Get active skills only
   */
  async getActiveSkills(): Promise<Skill[]> {
    try {
      return await this.query([
        {
          field: 'isActive',
          operator: '==',
          value: true,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting active skills:', error);
      throw error;
    }
  }

  /**
   * Get skills with hourly rate defined
   */
  async getSkillsWithRate(): Promise<Skill[]> {
    try {
      const allSkills = await this.getAll();
      return allSkills.items.filter((skill) => skill.baseHourlyRate !== undefined && skill.baseHourlyRate > 0);
    } catch (error: any) {
      logger.error('Error getting skills with rate:', error);
      throw error;
    }
  }
}

// Singleton instance
export const skillService = new SkillService();
