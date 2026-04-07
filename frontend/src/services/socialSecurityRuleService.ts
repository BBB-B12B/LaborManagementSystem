import apiClient from './api/client';

export interface SocialSecurityRule {
  id: string;
  name: string;
  conditionOperator: '<=' | '<' | '>=' | '>' | '==';
  conditionValue: number;
  deductionType: 'percentage' | 'fixed';
  deductionValue: number;
  minDeduction?: number;
  maxDeduction?: number;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CreateSocialSecurityRuleInput {
  name: string;
  conditionOperator: '<=' | '<' | '>=' | '>' | '==';
  conditionValue: number;
  deductionType: 'percentage' | 'fixed';
  deductionValue: number;
  minDeduction?: number;
  maxDeduction?: number;
  order: number;
  isActive?: boolean;
}

export interface UpdateSocialSecurityRuleInput extends Partial<CreateSocialSecurityRuleInput> {}

export const socialSecurityRuleService = {
  getAll: async (page = 1, pageSize = 100) => {
    const response = await apiClient.get<{
      success: boolean;
      data: SocialSecurityRule[];
      pagination: { total: number; page: number; pageSize: number };
    }>(`/social-security-rules`, { params: { page, pageSize } });
    return response.data;
  },

  create: async (data: CreateSocialSecurityRuleInput) => {
    const response = await apiClient.post<{ success: boolean; data: SocialSecurityRule }>(
      '/social-security-rules',
      data
    );
    return response.data.data;
  },

  update: async (id: string, data: UpdateSocialSecurityRuleInput) => {
    const response = await apiClient.put<{ success: boolean; data: SocialSecurityRule }>(
      `/social-security-rules/${id}`,
      data
    );
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/social-security-rules/${id}`
    );
    return response.data;
  },
};
