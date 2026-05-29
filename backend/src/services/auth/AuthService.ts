/**
 * Authentication Service
 */

import { userService } from './UserService';
import { User } from '../../models/User';
import { auth as firebaseAuth } from '../../config/firebase';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: {
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
  };
  token?: string;
}

export class AuthService {
  /**
   * Login with username and password (single source: `users` collection)
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;
    // Debug Log
    console.log(`[AuthService] Attempting login for username: '${username}'`);

    const user = await userService.findByUsername(username);
    if (!user) {
      console.warn(`[AuthService] User not found: '${username}'`);
      throw new Error('Invalid username or password');
    }

    if (!user.isActive) {
      console.warn(`[AuthService] User inactive: '${username}'`);
      throw new Error('User account is inactive');
    }

    // Debug Log
    console.log(`[AuthService] Login attempt: username=${username}, active=${user?.isActive}, userId=${user?.id}`);

    const isValidPassword = await userService.verifyPassword(user.id, password);
    console.log(`[AuthService] Password valid: ${isValidPassword}`);

    if (!isValidPassword) {
      console.warn(`[AuthService] Password mismatch for user: '${username}'`);
      throw new Error('Invalid username or password');
    }

    console.log(`[AuthService] Login successful for: '${username}'`);

    const customClaims = {
      role: user.roleId,
      department: user.department,
    };

    // Create Firebase Custom Token
    // Frontend must use signInWithCustomToken() to exchange this for an ID Token
    const token = await firebaseAuth.createCustomToken(user.id, customClaims);

    return {
      user: {
        id: user.id,
        employeeId: user.employeeId,
        username: user.username,
        name: user.name,
        fullNameEn: user.fullNameEn || user.name,
        roleId: user.roleId,
        roleCode: user.roleId,
        department: user.department,
        projectLocationIds: user.projectLocationIds || [],
        isActive: user.isActive,
      },
      token,
    };
  }

  /**
   * Logout (clear session/token)
   */
  async logout(_userId: string): Promise<void> {
    return;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(_userId: string): Promise<string> {
    throw new Error('Not implemented');
  }

  /**
   * Verify authentication token
   */
  async verifyToken(_token: string): Promise<User | null> {
    throw new Error('Not implemented');
  }
}

export const authService = new AuthService();
