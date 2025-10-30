/**
 * API Client Configuration
 * การตั้งค่า HTTP client สำหรับเรียก Backend API
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * API Response type
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated Response type
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // สำหรับ cookies/sessions
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // เพิ่ม auth token ถ้ามี
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ส่งข้อมูล user mock สำหรับ backend dev
    const storedUser = localStorage.getItem('user');
    if (storedUser && config.headers) {
      config.headers['X-Mock-User'] = storedUser;
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          break;
        case 403:
          // Forbidden
          console.error('Access denied');
          break;
        case 500:
          // Server error
          console.error('Server error');
          break;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Typed API wrapper
 */
export const api = {
  get: async <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
    const response = await apiClient.get<APIResponse<T>>(url, { params });
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Request failed');
  },

  post: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await apiClient.post<APIResponse<T>>(url, data);
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Request failed');
  },

  put: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await apiClient.put<APIResponse<T>>(url, data);
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Request failed');
  },

  delete: async <T = any>(url: string): Promise<T> => {
    const response = await apiClient.delete<APIResponse<T>>(url);
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Request failed');
  },

  upload: async <T = any>(url: string, formData: FormData): Promise<T> => {
    const response = await apiClient.post<APIResponse<T>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Upload failed');
  },
};

export { apiClient };
export default apiClient;
