/**
 * Imported Wage System Service
 * บริการจัดการข้อมูลระบบบันทึกจำนวนเแรงงาน (จากไฟล์ CSV)
 */

import { apiClient } from './client';

export interface ImportedWageSystem {
  id: string;
  'หน่วยงาน/โครงการ': string;
  ชื่อผู้รับเหมา: string;
  ตำแหน่งงาน: string;
  data_project: any;
  logs: any[];
  summaries: any[];
  plans: any[];
  createdAt: string;
  updatedAt: string;
}

export const importedWageSystemService = {
  /**
   * Get all project-contractor groups
   */
  getAll: async (): Promise<ImportedWageSystem[]> => {
    const response = await apiClient.get<{ success: boolean; data: ImportedWageSystem[] }>(
      '/imported-wage-system'
    );
    return response.data.data;
  },

  /**
   * Get unique projects
   */
  getUniqueProjects: async (): Promise<string[]> => {
    const response = await apiClient.get<{ success: boolean; data: string[] }>(
      '/imported-wage-system/projects'
    );
    return response.data.data;
  },

  /**
   * Get all contractor-position groups for a specific project
   */
  getByProject: async (projectName: string): Promise<ImportedWageSystem[]> => {
    const encodedProject = encodeURIComponent(projectName);
    const response = await apiClient.get<{ success: boolean; data: ImportedWageSystem[] }>(
      `/imported-wage-system/by-project/${encodedProject}`
    );
    return response.data.data;
  },

  /**
   * Get specific entry by ID
   */
  getById: async (id: string): Promise<ImportedWageSystem> => {
    const response = await apiClient.get<{ success: boolean; data: ImportedWageSystem }>(
      `/imported-wage-system/${id}`
    );
    return response.data.data;
  },
};

export default importedWageSystemService;
