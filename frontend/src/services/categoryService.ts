import { api } from './api/client';

export interface WorkOrderCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export const categoryService = {
  /**
   * Fetch active categories for dropdowns
   */
  getActiveCategories: async (): Promise<WorkOrderCategory[]> => {
    try {
      const response = await api.get<WorkOrderCategory[]>('/categories');
      return response;
    } catch (error) {
      console.warn('Failed to fetch categories, using fallbacks for PoC', error);
      // Fallback for PoC if backend route is not ready
      return [
        { id: 'cat-str', code: 'STR', name: 'โครงสร้าง (Structure)', isActive: true },
        { id: 'cat-arc', code: 'ARC', name: 'สถาปัตยกรรม (Architecture)', isActive: true },
        { id: 'cat-ele', code: 'ELE', name: 'ระบบไฟฟ้า (Electrical)', isActive: true },
        { id: 'cat-san', code: 'SAN', name: 'ระบบสุขาภิบาล (Sanitary)', isActive: true },
      ];
    }
  },
};
