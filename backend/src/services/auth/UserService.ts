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
    const users = await this.query([
      { field: 'username', operator: '==', value: normalizedUsername }
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find user by employeeId
   */
<<<<<<< Updated upstream
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
    if (!user || !user.passwordHash) {
      return false;
    }
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  /**
   * Create a new user with password hashing
   */
  async createUser(input: CreateUserInput, createdBy: string): Promise<User> {
    const normalizedUsername = input.username.trim().toLowerCase();

=======
  async createUser(input: CreateUserInput, createdBy: string): Promise<UserDTO> {
    // ตรวจสอบ username ซ้ำ
    const normalizedUsername = input.username.trim().toLowerCase();
>>>>>>> Stashed changes
    const existingUser = await this.findByUsername(normalizedUsername);
    if (existingUser) {
      throw new AppError('Username already exists', 400);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const now = new Date();
<<<<<<< Updated upstream

    const userData = {
      ...input,
      username: normalizedUsername, // Save as lowercase
      passwordHash,
=======
    const englishName = input.fullNameEn?.trim() || input.name;

    const userData: Omit<User, 'id'> = {
      employeeId: input.employeeId,
      username: normalizedUsername,
      passwordHash,
      name: input.name,
      fullNameEn: englishName,
      roleId: input.roleId,
      department: input.department,
      dateOfBirth: input.dateOfBirth,
      startDate: input.startDate,
      projectLocationIds: input.projectLocationIds || [],
      isActive: input.isActive !== undefined ? input.isActive : true,
>>>>>>> Stashed changes
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
<<<<<<< Updated upstream
      isActive: input.isActive ?? true,
    };

    // Remove plain password from storage object if it exists (though CreateUserInput shouldn't have it generally if separated, but strictly cleaning)
    delete (userData as any).password;

    // Use employeeId as the Firestore Document ID
    return this.createWithId(input.employeeId, userData as any);
=======
      rawPassword: input.password,
    };

    const user = await this.create(userData, input.employeeId);
    return this.toDTO(user);
>>>>>>> Stashed changes
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput, updatedBy: string): Promise<User | null> {
    const user = await this.getById(id);
    if (!user) return null;

<<<<<<< Updated upstream
    const updates: any = {
=======
    // ถ้ามีการเปลี่ยน username ให้ตรวจสอบซ้ำ
    if (input.username) {
      const normalizedCandidate = input.username.trim().toLowerCase();
      if (normalizedCandidate !== user.username) {
        const existingUser = await this.findByUsername(normalizedCandidate);
        if (existingUser) {
          throw new Error('Username already exists');
        }
      }
    }

    const updateData: any = {
>>>>>>> Stashed changes
      ...input,
      updatedAt: new Date(),
      updatedBy,
    };

<<<<<<< Updated upstream
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
=======
    if (input.username) {
      const normalized = input.username.trim().toLowerCase();
      updateData.username = normalized;
      updateData.Username = normalized;
      updateData.UsernameLower = normalized;
    }

    if (input.name) {
      updateData.Fullname = input.name;
    }

    if (input.fullNameEn || input.name) {
      const englishName = input.fullNameEn ?? input.name;
      if (englishName) {
        updateData.fullNameEn = englishName;
        updateData.Fullnameen = englishName;
      }
    }

    if (input.roleId) {
      updateData.Role = input.roleId;
    }

    if (input.department) {
      updateData.Department = input.department;
    }

    if (input.projectLocationIds) {
      updateData.projectLocationIds = input.projectLocationIds;
      updateData.ProjectLocationIds = input.projectLocationIds;
      updateData.projectLocation = input.projectLocationIds;
    }

    if (input.isActive !== undefined) {
      updateData.Active = input.isActive ? 'On' : 'Off';
    }

    // ถ้ามีการเปลี่ยนรหัสผ่าน ให้ hash ใหม่
    if (input.password) {
      updateData.passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
      updateData.Password = input.password;
      delete updateData.password;
>>>>>>> Stashed changes
    }

    return this.update(id, updates);
  }
  /**
   * Get all users with pagination
   */
<<<<<<< Updated upstream
  async getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<User>> {
    const result = await this.getAll(options);

    // Remove passwordHash from results
    const items = result.items.map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
=======
  async findByUsername(username: string): Promise<User | null> {
    const normalized = username.trim().toLowerCase();
    const results = await this.query([{ field: 'username', operator: '==', value: normalized }]);
    if (results.length > 0) {
      return results[0];
    }

    const legacyResults = await this.query([
      { field: 'UsernameLower', operator: '==', value: normalized },
    ]);
    return legacyResults.length > 0 ? legacyResults[0] : null;
  }

  /**
   * ค้นหาผู้ใช้จาก employeeId
   * Find user by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<User | null> {
    const direct = await this.getById(employeeId);
    if (direct) {
      return direct;
    }

    const results = await this.query([
      { field: 'employeeId', operator: '==', value: employeeId },
    ]);
    if (results.length > 0) {
      return results[0];
    }

    const legacyResults = await this.query([
      { field: 'Employeeid', operator: '==', value: employeeId },
    ]);
    return legacyResults.length > 0 ? legacyResults[0] : null;
  }
>>>>>>> Stashed changes

    return {
<<<<<<< Updated upstream
      ...result,
      items
=======
      id: user.id,
      employeeId: user.employeeId,
      username: user.username,
      name: user.name,
      fullNameEn: user.fullNameEn,
      roleId: user.roleId,
      department: user.department,
      dateOfBirth: user.dateOfBirth,
      startDate: user.startDate,
      projectLocationIds: user.projectLocationIds,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
>>>>>>> Stashed changes
    };
  }
}

export const userService = new UserService();
