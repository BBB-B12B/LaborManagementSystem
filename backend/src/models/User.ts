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
  fullNameEn?: string;
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
  rawPassword?: string;
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
  startDate?: Date;
  projectLocationIds?: string[];
  isActive?: boolean;
}

/**
 * Firestore document converter for User
 */
export const userConverter = {
  toFirestore: (user: Omit<User, 'id'>): any => {
    const timestampOrDate = (value: Date): any =>
      value instanceof Date ? value : new Date(value);

    const usernameValue = (user.username || '').trim();
    const usernameLower = usernameValue.toLowerCase();
    const projectLocations = Array.isArray(user.projectLocationIds)
      ? user.projectLocationIds
      : [];

    return {
      employeeId: user.employeeId,
      username: usernameLower,
      passwordHash: user.passwordHash,
      name: user.name,
      roleId: user.roleId,
      department: user.department,
      startDate: timestampOrDate(user.startDate),
      projectLocationIds: projectLocations,
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

    const parseDepartment = (value?: string): Department => {
      const dept = (value || 'PD01').toUpperCase();
      const allowed: Department[] = ['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'HO', 'WH'];
      return (allowed.includes(dept as Department) ? dept : 'PD01') as Department;
    };

    const parseActive = (value: any): boolean => {
      if (typeof value === 'string') {
        return value.toLowerCase() === 'on';
      }
      if (typeof value === 'boolean') {
        return value;
      }
      return true;
    };

    const startDateValue = data.startDate || data.StartDate || new Date();
    const createdAtValue = data.createdAt || data.CreatedAt || new Date();
    const updatedAtValue = data.updatedAt || data.UpdatedAt || new Date();

    let projectIds: string[] = [];
    const rawProjectIds = data.projectLocation || data.projectLocationIds || data.ProjectLocationIds || data.projectIds || data.projectId;
    
    if (Array.isArray(rawProjectIds)) {
      projectIds = rawProjectIds;
    } else if (typeof rawProjectIds === 'string') {
      projectIds = rawProjectIds.split(/[|,]/).map(item => item.trim()).filter(Boolean);
    }

    return {
      id: snapshot.id,
      employeeId: data.employeeId || data.Employeeid || snapshot.id,
      username: (data.username || data.Username || '').toString(),
      passwordHash: data.passwordHash || data.Password || '',
      name: data.name || data.Fullname || '',
      fullNameEn: data.fullNameEn || data.Fullnameen || data.Fullname || data.name,
      roleId: data.roleId || data.Role || 'AM',
      department: parseDepartment(data.department || data.Department),
      dateOfBirth: data.dateOfBirth ? parseDate(data.dateOfBirth) : undefined,
      startDate: parseDate(startDateValue),
      projectLocationIds: projectIds,
      isActive:
        data.isActive !== undefined ? Boolean(data.isActive) : parseActive(data.Active),
      createdAt: parseDate(createdAtValue),
      updatedAt: parseDate(updatedAtValue),
      createdBy: data.createdBy || data.CreatedBy || 'system',
      updatedBy: data.updatedBy || data.UpdatedBy || 'system',
    };
  },
};
