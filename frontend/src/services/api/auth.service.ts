/**
 * Authentication Service
 * บริการจัดการการ Authentication
 * 
 * Handles login, logout, token management
 */

import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { api } from './client';

/**
 * User type
 */
export interface User {
  id: string;
  employeeId: string;
  username: string;
  name: string;
  fullNameEn?: string;
  roleId: string;
  roleCode: string;
  department: string;
  projectLocationIds: string[];
  isActive: boolean;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials);

    // Exchange Custom Token for ID Token (Required for Real Firebase)
    if (response.token) {
      try {
        const userCredential = await signInWithCustomToken(auth, response.token);
        const idToken = await userCredential.user.getIdToken();

        // Store ID Token (not Custom Token)
        localStorage.setItem('authToken', idToken);

        // Update response token to be ID Token (for immediate use if any)
        response.token = idToken;
      } catch (error) {
        console.error('Token exchange failed:', error);
        // Fallback or re-throw? 
        // If exchange fails, we can't authenticate.
        throw error;
      }
    }

    // Store user info
    if (response.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    return response;
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  },

  /**
   * Refresh token
   */
  async refreshToken(): Promise<{ token: string }> {
    const response = await api.post<{ token: string }>('/auth/refresh');

    if (response.token) {
      localStorage.setItem('authToken', response.token);
    }

    return response;
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  },

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  },
};

export default authService;
