/**
 * Authentication Service
 * จัดการการล็อกอิน/ออก และโทเคน
 */

import { userService } from './UserService';
import { portalUserService } from './PortalUserService';
import { User } from '../../models/User';

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
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    // Primary: portal users stored in Firestore collection `User`
    const portalRecord = await portalUserService.findByUsernameInsensitive(username);
    if (portalRecord) {
      const passwordMatches = portalUserService.verifyPassword(portalRecord.data, password);
      if (!passwordMatches) {
        throw new Error('Invalid username or password');
      }
      return portalUserService.toAuthResponse(portalRecord);
    }

    // Fallback: application users stored in `users` collection
    const user = await userService.findByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    if (!user.isActive) {
      throw new Error('User account is inactive');
    }

    const isValidPassword = await userService.verifyPassword(user, password);
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    return {
      user: {
        id: user.id,
        employeeId: user.employeeId,
        username: user.username,
        name: user.name,
        roleId: user.roleId,
        roleCode: user.roleId,
        department: user.department,
        projectLocationIds: user.projectLocationIds || [],
        isActive: user.isActive,
      },
      token: 'mock-token',
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
