/**
 * User Service
 * บริการจัดการผู้ใช้งาน
 *
 * Service for managing users with authentication
 */

import bcrypt from 'bcrypt';
import { collections } from '../../config/collections';
import { CrudService } from '../base/CrudService';
import { User, UserDTO, CreateUserInput, UpdateUserInput } from '../../models/User';
import type { PaginatedResult, PaginationOptions } from '../base/CrudService';
import { config } from '../../config';

export class UserService extends CrudService<User> {
  constructor() {
    super(collections.users as any, 'users');
  }

  /**
   * ดึงผู้ใช้ทั้งหมด (พร้อม DTO) แบบแบ่งหน้า
   */
  async getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<UserDTO>> {
    const result = await super.getAll(options);
    return {
      ...result,
      items: result.items.map((user) => this.toDTO(user)),
    };
  }

  /**
   * สร้างผู้ใช้ใหม่ (พร้อม hash password)
   * Create new user with hashed password
   */
  async createUser(input: CreateUserInput, createdBy: string): Promise<UserDTO> {
    // ตรวจสอบ username ซ้ำ
    const existingUser = await this.findByUsername(input.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // ตรวจสอบ employeeId ซ้ำ
    const existingEmployee = await this.findByEmployeeId(input.employeeId);
    if (existingEmployee) {
      throw new Error('Employee ID already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

    const now = new Date();
    const docId = input.employeeId.toString();
    const userData: Omit<User, 'id'> = {
      employeeId: docId,
      username: input.username,
      passwordHash,
      name: input.name,
      roleId: input.roleId,
      department: input.department,
      dateOfBirth: input.dateOfBirth,
      startDate: input.startDate,
      projectLocationIds: input.projectLocationIds,
      isActive: input.isActive !== undefined ? input.isActive : true,
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
    };

    const user = await this.createWithId(docId, userData);
    return this.toDTO(user);
  }

  /**
   * อัปเดทผู้ใช้
   * Update user
   */
  async updateUser(
    id: string,
    input: UpdateUserInput,
    updatedBy: string
  ): Promise<UserDTO | null> {
    const user = await this.getById(id);
    if (!user) {
      return null;
    }

    // ถ้ามีการเปลี่ยน username ให้ตรวจสอบซ้ำ
    if (input.username && input.username !== user.username) {
      const existingUser = await this.findByUsername(input.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }
    }

    const updateData: any = {
      ...input,
      updatedAt: new Date(),
      updatedBy,
    };

    // ถ้ามีการเปลี่ยนรหัสผ่าน ให้ hash ใหม่
    if (input.password) {
      updateData.passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
      delete updateData.password;
    }

    const updated = await this.update(id, updateData);
    return updated ? this.toDTO(updated) : null;
  }

  /**
   * ค้นหาผู้ใช้จาก username
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const results = await this.query([{ field: 'username', operator: '==', value: username }]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * ค้นหาผู้ใช้จาก employeeId
   * Find user by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<User | null> {
    const results = await this.query([
      { field: 'employeeId', operator: '==', value: employeeId },
    ]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * ตรวจสอบรหัสผ่าน
   * Verify password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false;
    }

    // Handle legacy/plaintext passwords (for development/bootstrap data)
    if (!user.passwordHash.startsWith('$2')) {
      return user.passwordHash === password;
    }

    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * ดึงผู้ใช้ทั้งหมดในแผนก
   * Get all users in department
   */
  async getUsersByDepartment(department: string): Promise<UserDTO[]> {
    const users = await this.query([{ field: 'department', operator: '==', value: department }]);
    return users.map(this.toDTO);
  }

  /**
   * ดึงผู้ใช้ที่มีสิทธิ์เข้าถึงโครงการ
   * Get users with access to project
   */
  async getUsersByProject(projectId: string): Promise<UserDTO[]> {
    const users = await this.query([
      { field: 'projectLocationIds', operator: 'array-contains', value: projectId },
    ]);
    return users.map(this.toDTO);
  }

  /**
   * แปลง User เป็น UserDTO (ไม่มี sensitive data)
   * Convert User to UserDTO (without sensitive data)
   */
  private toDTO(user: User): UserDTO {
    return {
      id: user.id,
      employeeId: user.employeeId,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      department: user.department,
      dateOfBirth: user.dateOfBirth,
      startDate: user.startDate,
      projectLocationIds: user.projectLocationIds,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

// Export singleton instance
export const userService = new UserService();
