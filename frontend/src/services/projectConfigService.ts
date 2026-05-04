import { api } from './api/client';

export interface WorkOrderConfig {
  id: string;
  code: string;
  name: string;
}

export interface CategoryConfig {
  id: string;
  workOrderCode: string;
  name: string;
}

export const projectConfigService = {
  // --- Work Orders ---
  getWorkOrders: async (projectId: string): Promise<WorkOrderConfig[]> => {
    if (!projectId) return [];
    return await api.get(`/projects/${projectId}/configs/work-orders`);
  },

  createWorkOrder: async (projectId: string, data: { code: string; name: string }): Promise<WorkOrderConfig> => {
    return await api.post(`/projects/${projectId}/configs/work-orders`, data);
  },

  updateWorkOrder: async (projectId: string, code: string, data: { name: string }): Promise<void> => {
    return await api.put(`/projects/${projectId}/configs/work-orders/${code}`, data);
  },

  deleteWorkOrder: async (projectId: string, code: string): Promise<void> => {
    return await api.delete(`/projects/${projectId}/configs/work-orders/${code}`);
  },

  // --- Categories ---
  getCategories: async (projectId: string, workOrderCode?: string): Promise<CategoryConfig[]> => {
    if (!projectId) return [];
    const url = workOrderCode 
      ? `/projects/${projectId}/configs/categories?workOrderCode=${workOrderCode}`
      : `/projects/${projectId}/configs/categories`;
    return await api.get(url);
  },

  createCategory: async (projectId: string, data: { workOrderCode: string; name: string }): Promise<CategoryConfig> => {
    return await api.post(`/projects/${projectId}/configs/categories`, data);
  },

  updateCategory: async (projectId: string, id: string, data: { name: string }): Promise<void> => {
    return await api.put(`/projects/${projectId}/configs/categories/${id}`, data);
  },

  deleteCategory: async (projectId: string, id: string): Promise<void> => {
    return await api.delete(`/projects/${projectId}/configs/categories/${id}`);
  },
};
