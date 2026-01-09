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
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const users = await this.query([
      { field: 'username', operator: '==', value: username }
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Verify password for a user
   */
  async verifyPassword(userId: string, plainPassword: string): Promise<boolean> {
    const user = await this.getById(userId);
    if (!user || !user.passwordHash) {
      return false;
    }
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  /**
   * Create a new user with password hashing
   */
  async createUser(input: CreateUserInput, createdBy: string): Promise<User> {
    const existingUser = await this.findByUsername(input.username);
    if (existingUser) {
      throw new AppError('Username already exists', 400);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const now = new Date();

    const userData = {
      ...input,
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
