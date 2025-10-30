/**
 * ProjectLocationService
 * บริการจัดการโครงการ
 *
 * Manages project locations with CRUD operations and additional queries.
 */

import { CrudService } from '../base/CrudService';
import {
  ProjectLocation,
  CreateProjectLocationInput,
  UpdateProjectLocationInput,
  ProjectStatus,
} from '../../models/ProjectLocation';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';

/**
 * ProjectLocationService
 * Extends CrudService with project-specific operations
 */
class ProjectLocationService extends CrudService<ProjectLocation> {
  constructor() {
    super(collections.projectLocations);
  }

  /**
   * Create new project location
   */
  async createProject(
    input: CreateProjectLocationInput,
    createdBy: string
  ): Promise<ProjectLocation> {
    try {
      // Check for duplicate code
      const existing = await this.findByCode(input.code);
      if (existing) {
        throw new AppError('Project code already exists', 409);
      }

      const now = new Date();
      const projectData: Omit<ProjectLocation, 'id'> = {
        code: input.code.toUpperCase(),
        name: input.name,
        location: input.location,
        department: input.department.trim(),
        projectManager: input.projectManager,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status || 'active',
        description: input.description,
        isActive: input.isActive !== undefined ? input.isActive : true,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
      };

      const project = await this.create(projectData);
      logger.info(`Project created: ${project.code}`, { projectId: project.id });

      return project;
    } catch (error: any) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Update project location
   */
  async updateProject(
    id: string,
    input: UpdateProjectLocationInput,
    updatedBy: string
  ): Promise<ProjectLocation | null> {
    try {
      // If code is being changed, check for duplicates
      if (input.code) {
        const existing = await this.findByCode(input.code);
        if (existing && existing.id !== id) {
          throw new AppError('Project code already exists', 409);
        }
      }

      const updateData: Partial<ProjectLocation> = {
        ...input,
        department: input.department ? input.department.trim() : undefined,
        code: input.code ? input.code.toUpperCase() : undefined,
        updatedAt: new Date(),
        updatedBy,
      };

      const project = await this.update(id, updateData);
      if (project) {
        logger.info(`Project updated: ${project.code}`, { projectId: id });
      }

      return project;
    } catch (error: any) {
      logger.error('Error updating project:', error);
      throw error;
    }
  }

  /**
   * Find project by code
   */
  async findByCode(code: string): Promise<ProjectLocation | null> {
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
      logger.error('Error finding project by code:', error);
      throw error;
    }
  }

  /**
   * Get projects by department
   */
  async getByDepartment(department: string): Promise<ProjectLocation[]> {
    try {
      return await this.query([
        {
          field: 'department',
          operator: '==',
          value: department,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting projects by department:', error);
      throw error;
    }
  }

  /**
   * Get projects by status
   */
  async getByStatus(status: ProjectStatus): Promise<ProjectLocation[]> {
    try {
      return await this.query([
        {
          field: 'status',
          operator: '==',
          value: status,
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting projects by status:', error);
      throw error;
    }
  }

  /**
   * Get active projects only
   */
  async getActiveProjects(): Promise<ProjectLocation[]> {
    try {
      return await this.query([
        {
          field: 'isActive',
          operator: '==',
          value: true,
        },
        {
          field: 'status',
          operator: '==',
          value: 'active',
        },
      ]);
    } catch (error: any) {
      logger.error('Error getting active projects:', error);
      throw error;
    }
  }

  async getUniqueDepartments(): Promise<string[]> {
    try {
      const snapshot = await this.collection.get();
      const departments = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.department) {
          departments.add(String(data.department));
        }
      });
      return Array.from(departments).sort((a, b) => a.localeCompare(b));
    } catch (error: any) {
      logger.error('Error getting unique departments:', error);
      throw error;
    }
  }
}

// Singleton instance
export const projectLocationService = new ProjectLocationService();
