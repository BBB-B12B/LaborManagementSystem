/**
 * User Service
 * บริการจัดการผู้ใช้งาน
 *
 * Service for managing users with authentication
 */

import bcrypt from 'bcrypt';
import { collections } from '../../config/collections';
import { BaseCrudService } from '../base/BaseCrudService';
import { User, CreateUserInput, UpdateUserInput } from '../../models/User';
import type { PaginatedResult, PaginationOptions } from '../base/BaseCrudService';

import { AppError } from '../../api/middleware/errorHandler';

export class UserService extends BaseCrudService<User> {
  constructor() {
    super(collections.users as any, 'users');
  }

  /**
   * Find user by username (Case Insensitive)
   */
  async findByUsername(username: string): Promise<User | null> {
    const normalizedUsername = username.trim().toLowerCase();
    
    // 1. Try modern username field
    let users = await this.query([
      { field: 'username', operator: '==', value: normalizedUsername }
    ]);
    
    // 2. Fallback to legacy UsernameLower field
    if (users.length === 0) {
      users = await this.query([
        { field: 'UsernameLower', operator: '==', value: normalizedUsername }
      ]);
    }
    
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find user by employeeId
   */
  async findByEmployeeId(employeeId: string): Promise<User | null> {
    // If we enforce ID=EmployeeID, we could just use getById.
    // But to be safe and support query by field:
    const users = await this.query([
      { field: 'employeeId', operator: '==', value: employeeId }
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Verify password for a user
   */
  async verifyPassword(userId: string, plainPassword: string): Promise<boolean> {
    const user = await this.getById(userId);
    if (!user) return false;

    // Check with modern bcrypt hash
    if (user.passwordHash) {
      return bcrypt.compare(plainPassword, user.passwordHash);
    }
    
    // Legacy support: plain text password comparison
    if ((user as any).Password) {
      return (user as any).Password === plainPassword;
    }

    return false;
  }

  /**
   * Create a new user with password hashing
   */
  async createUser(input: CreateUserInput, createdBy: string): Promise<User> {
    const normalizedUsername = input.username.trim().toLowerCase();

    const existingUser = await this.findByUsername(normalizedUsername);
    if (existingUser) {
      throw new AppError('Username already exists', 400);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const now = new Date();

    const userData = {
      ...input,
      username: normalizedUsername, // Save as lowercase
      passwordHash,
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
      isActive: input.isActive ?? true,
    };

    // Remove plain password from storage object if it exists (though CreateUserInput shouldn't have it generally if separated, but strictly cleaning)
    delete (userData as any).password;

    // Use employeeId as the Firestore Document ID
    return this.createWithId(input.employeeId, userData as any);
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput, updatedBy: string): Promise<User | null> {
    const user = await this.getById(id);
    if (!user) return null;

    const updates: any = {
      ...input,
      updatedAt: new Date(),
      updatedBy,
    };

    // Normalize username if being updated
    if (input.username) {
      const normalizedUsername = input.username.trim().toLowerCase();

      // Check for duplicate only if username is changing
      if (normalizedUsername !== user.username) {
        const existing = await this.findByUsername(normalizedUsername);
        if (existing) {
          throw new AppError('Username already exists', 400);
        }
      }
      updates.username = normalizedUsername;
    }

    if (input.password) {
      updates.passwordHash = await bcrypt.hash(input.password, 10);
      delete updates.password;
    }

    return this.update(id, updates);
  }
  /**
   * Get all users with pagination
   */
  async getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<User>> {
    const result = await this.getAll(options);

    // Remove passwordHash from results
    const items = result.items.map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });

    return {
      ...result,
      items
    };
  }
}

export const userService = new UserService();
