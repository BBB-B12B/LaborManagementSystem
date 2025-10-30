/**
 * Authentication Service
 * บริการยืนยันตัวตน
 *
 * Service for handling authentication (login, logout, token generation)
 */

import { userService } from './UserService';
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
  token?: string; // Optional: JWT token (can be implemented later)
}

export class AuthService {
  /**
   * เข้าสู่ระบบ
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    // ค้นหาผู้ใช้จาก username
    const user = await userService.findByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    // ตรวจสอบว่าผู้ใช้ active หรือไม่
    if (!user.isActive) {
      throw new Error('User account is inactive');
    }

    // ตรวจสอบรหัสผ่าน
    const isValidPassword = await userService.verifyPassword(user, password);
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // สร้าง response (ไม่รวม sensitive data)
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
   * ออกจากระบบ
   * Logout (clear session/token)
   */
  async logout(_userId: string): Promise<void> {
    // TODO: Implement token revocation if using JWT
    // For now, this is handled client-side by clearing the token
    return;
  }

  /**
   * รีเฟรช token
   * Refresh authentication token
   */
  async refreshToken(_userId: string): Promise<string> {
    // TODO: Implement JWT token refresh
    throw new Error('Not implemented');
  }

  /**
   * ตรวจสอบ token
   * Verify authentication token
   */
  async verifyToken(_token: string): Promise<User | null> {
    // TODO: Implement JWT token verification
    throw new Error('Not implemented');
  }

}

// Export singleton instance
export const authService = new AuthService();
