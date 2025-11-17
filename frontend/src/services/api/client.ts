/**
 * API Client Configuration
 * การตั้งค่า HTTP client สำหรับเรียก Backend API
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Convert mock user JSON into an ASCII-safe header value.
 * Uses base64 encoding in the browser, with a Node-compatible fallback for tests.
 */
const encodeMockUserHeader = (value: string): string => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window
      .btoa(
        encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_match, hex) =>
          String.fromCharCode(Number.parseInt(hex, 16))
        )
      );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeBuffer = (globalThis as any)?.Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(value, 'utf8').toString('base64');
  }

  return value;
};

const DEFAULT_DEV_USER: Record<string, unknown> = {
  id: 'dev-admin',
  employeeId: '101527',
  username: 'thiti.m',
  name: 'Dev Admin',
  fullNameEn: 'Dev Admin',
  roleId: 'AM',
  roleCode: 'AM',
  department: 'PD01',
  projectLocationIds: ['P001', 'P002', 'P003', 'P004'],
  isActive: true,
};

const ensureMockUser = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const existing = localStorage.getItem('user');
  if (existing) {
    return existing;
  }

  if (process.env.NODE_ENV !== 'production') {
    const override = process.env.NEXT_PUBLIC_DEV_MOCK_USER;
    const payload =
      override && override.trim().length > 0 ? override : JSON.stringify(DEFAULT_DEV_USER);
    localStorage.setItem('user', payload);
    return payload;
  }

  return null;
};

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ส่งข้อมูล user mock สำหรับ backend dev
    const storedUser = ensureMockUser();
    if (storedUser && config.headers) {
      // Encode mock user JSON to keep header ASCII-safe during dev
      config.headers['X-Mock-User'] = encodeMockUserHeader(storedUser);
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
