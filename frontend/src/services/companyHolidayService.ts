import apiClient from './api/client';

export interface CompanyHoliday {
  id: string;
  date: string; // ISO string from backend
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateCompanyHolidayInput {
  date: string; // YYYY-MM-DD — year subcollection is derived from this
  name: string;
}

export interface UpdateCompanyHolidayInput {
  date?: string;
  name?: string;
}

export const companyHolidayService = {
  /** Fetch all holidays for the given year (defaults to current year on backend) */
  getAll: async (year?: number): Promise<CompanyHoliday[]> => {
    const params = year ? { year } : undefined;
    const response = await apiClient.get<{ success: boolean; data: CompanyHoliday[] }>(
      '/company-holidays',
      { params }
    );
    return response.data.data;
  },

  /** Create a new holiday — year subcollection is inferred from date on the backend */
  create: async (data: CreateCompanyHolidayInput): Promise<CompanyHoliday> => {
    const response = await apiClient.post<{ success: boolean; data: CompanyHoliday }>(
      '/company-holidays',
      data
    );
    return response.data.data;
  },

  /**
   * Update a holiday.
   * @param id     Firestore document ID
   * @param year   The year the document currently lives in (for subcollection lookup)
   * @param data   Fields to update
   */
  update: async (id: string, year: number, data: UpdateCompanyHolidayInput): Promise<CompanyHoliday> => {
    const response = await apiClient.put<{ success: boolean; data: CompanyHoliday }>(
      `/company-holidays/${year}/${id}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a holiday.
   * @param id   Firestore document ID
   * @param year The year subcollection to look up
   */
  delete: async (id: string, year: number): Promise<void> => {
    await apiClient.delete(`/company-holidays/${year}/${id}`);
  },
};
