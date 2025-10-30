/**
 * Project Service (Frontend)
 *
 * Handles CRUD operations for projects:
 * - Create
 * - Read (list/single)
 * - Update
 * - Delete (soft delete)
 */

import { api, apiClient } from './api/client';
import { type ProjectFormData, type ProjectStatus } from '@/validation/projectSchema';

export interface Project {
  id: string;
  code: string;
  name: string;
  location: string;
  department: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status: ProjectStatus;
  description?: string;
  isActive: boolean;
  createdBy: string;
  createdByName?: string;
  updatedBy: string;
  updatedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFilters {
  department?: string;
  status?: ProjectStatus;
  isActive?: boolean;
  search?: string;
}

/**
 * Project Service
 */
class ProjectService {
  private normalize(project: any): Project {
    return {
      ...project,
      department: project.department ?? '',
      startDate: project.startDate ? new Date(project.startDate) : undefined,
      endDate: project.endDate ? new Date(project.endDate) : undefined,
      createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
      updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    };
  }

  /**
   * Get all projects with optional filters
   */
  async getAll(filters?: ProjectFilters): Promise<Project[]> {
    const params: Record<string, any> = {};
    if (filters?.department) params.department = filters.department;
    if (filters?.status) params.status = filters.status;
    if (filters?.isActive !== undefined) params.isActive = filters.isActive;
    if (filters?.search) params.search = filters.search;

    const result = await api.get<Project[] | { items: Project[] }>('/projects', params);
    const items = Array.isArray(result)
      ? result
      : Array.isArray(result?.items)
      ? result.items
      : [];
    return items.map((project) => this.normalize(project));
  }

  /**
   * Get active projects only
   */
  async getActive(): Promise<Project[]> {
    return this.getAll({ isActive: true, status: 'active' });
  }

  /**
   * Get a single project by ID
   */
  async getById(id: string): Promise<Project> {
    const project = await api.get<Project>(`/projects/${id}`);
    return this.normalize(project);
  }

  /**
   * Create a new project
   */
  async create(data: ProjectFormData): Promise<Project> {
    const project = await api.post<Project>('/projects', data);
    return this.normalize(project);
  }

  async getNextCode(): Promise<string> {
    try {
      const result = await api.get<{ code?: string; lastCode?: string }>(
        '/projects/next-code'
      );
      const code = result.code || result.lastCode || '';
      return code || 'P001';
    } catch (error) {
      console.error('Failed to fetch next project code', error);
      return 'P001';
    }
  }

  /**
   * Update an existing project
   */
  async update(id: string, data: Partial<ProjectFormData>): Promise<Project> {
    const project = await api.put<Project>(`/projects/${id}`, data);
    return this.normalize(project);
  }

  /**
   * Delete a project (soft delete)
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/projects/${id}`);
  }

  /**
   * Get projects by department
   */
  async getByDepartment(department: string): Promise<Project[]> {
    return this.getAll({ department });
  }

  /**
   * Get projects by status
   */
  async getByStatus(status: ProjectStatus): Promise<Project[]> {
    return this.getAll({ status });
  }

  /**
   * Search projects by name or code
   */
  async search(query: string): Promise<Project[]> {
    return this.getAll({ search: query });
  }

  /**
    * Get unique department list from projects
    */
  async getDepartments(): Promise<string[]> {
    const departments = await api.get<string[]>('/projects/departments');
    return departments;
  }
}

export const projectService = new ProjectService();
export default projectService;
