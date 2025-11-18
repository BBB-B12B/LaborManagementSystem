/**
 * User Model
 * ผู้ใช้งานระบบ
 *
 * Description: System users with authenticated access and role-based permissions.
 * Firestore Collection: users
 */

export type Department = 'PD01' | 'PD02' | 'PD03' | 'PD04' | 'PD05' | 'HO' | 'WH';

export interface User {
  id: string;
  employeeId: string;
  username: string;
  passwordHash: string;
  name: string;
  roleId: string;
  department: Department;
  dateOfBirth?: Date;
  startDate: Date;
  projectLocationIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/**
 * User data transfer object (without sensitive fields)
 */
export interface UserDTO {
  id: string;
  employeeId: string;
  username: string;
  name: string;
  roleId: string;
  department: Department;
  dateOfBirth?: Date;
  startDate: Date;
  projectLocationIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation input
 */
export interface CreateUserInput {
  employeeId: string;
  username: string;
  password: string; // Plain text, will be hashed
  name: string;
  roleId: string;
  department: Department;
  dateOfBirth?: Date;
  startDate: Date;
  projectLocationIds: string[];
  isActive?: boolean;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  employeeId?: string;
  username?: string;
  password?: string; // Plain text, will be hashed if provided
  name?: string;
  roleId?: string;
  department?: Department;
  dateOfBirth?: Date;
  startDate?: Date;
  projectLocationIds?: string[];
  isActive?: boolean;
}

/**
 * Firestore document converter for User
 */
export const userConverter = {
  toFirestore: (user: Omit<User, 'id'>): any => {
    const serializeDate = (value?: Date): any => {
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    };

    const timestampOrDate = (value: Date): any =>
      value instanceof Date ? value : new Date(value);

    return {
      employeeId: user.employeeId,
      username: user.username,
      passwordHash: user.passwordHash,
      name: user.name,
      roleId: user.roleId,
      department: user.department,
      dateOfBirth: serializeDate(user.dateOfBirth),
      startDate: timestampOrDate(user.startDate),
      projectLocationIds: user.projectLocationIds,
      isActive: user.isActive,
      createdAt: timestampOrDate(user.createdAt),
      updatedAt: timestampOrDate(user.updatedAt),
      createdBy: user.createdBy,
      updatedBy: user.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): User => {
    const data = snapshot.data();
    const parseDate = (value: any): Date => {
      if (!value) {
        return value;
      }
      if (typeof value.toDate === 'function') {
        return value.toDate();
      }
      return new Date(value);
    };

    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      roleId: data.roleId,
      department: data.department,
      dateOfBirth: data.dateOfBirth ? parseDate(data.dateOfBirth) : undefined,
      startDate: parseDate(data.startDate),
      projectLocationIds: data.projectLocationIds || [],
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: parseDate(data.createdAt),
      updatedAt: parseDate(data.updatedAt),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
