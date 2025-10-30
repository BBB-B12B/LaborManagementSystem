/**
 * Authentication & Authorization Middleware
 * ตรวจสอบ authentication และ role-based access control (RBAC)
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { logger } from '../../utils/logger';

/**
 * Role types ตาม data-model.md
 */
export type UserRole = 'AM' | 'FM' | 'SE' | 'OE' | 'PE' | 'PM' | 'PD' | 'MD';

/**
 * Department types
 */
export type Department = 'PD01' | 'PD02' | 'PD03' | 'PD04' | 'PD05';

/**
 * Extended Request with user info
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    employeeId: string;
    username: string;
    name: string;
    roleId: string;
    roleCode: UserRole;
    department: Department;
    projectLocationIds: string[];
    isActive: boolean;
  };
}

/**
 * Authenticate user middleware
 * ตรวจสอบว่า user login แล้วหรือยัง
 *
 * Note: Implementation depends on authentication strategy
 * - Option 1: Session-based (req.session.user)
 * - Option 2: JWT token (req.headers.authorization)
 * - Option 3: Firebase Auth (req.headers.authorization with Firebase token)
 */
export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    // TODO: Implement authentication logic based on chosen strategy
    // For now, assume user is attached to request by previous middleware

    // Example for session-based:
    // if (!req.session?.user) {
    //   throw new AppError('Unauthorized - Please login', 401);
    // }
    // req.user = req.session.user;

    // Example for JWT:
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // if (!token) {
    //   throw new AppError('Unauthorized - No token provided', 401);
    // }
    // const decoded = verifyJWT(token);
    // req.user = decoded;

    // Temporary: Check if user exists in request
    if (!req.user) {
      const mockUserHeader = req.headers['x-mock-user'];
      if (typeof mockUserHeader === 'string') {
        try {
          req.user = JSON.parse(mockUserHeader);
        } catch (error) {
          logger.warn('Failed to parse X-Mock-User header', { error });
        }
      }
    }

    if (!req.user) {
      throw new AppError('Unauthorized - Please login', 401);
    }

    // Check if user is active
    if (!req.user.isActive) {
      throw new AppError('Account is inactive', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * ตรวจสอบว่า user มี role ที่อนุญาตหรือไม่
 *
 * @param allowedRoles - Array of role codes that are allowed
 *
 * @example
 * // Only Admin and FM can access
 * router.post('/daily-contractors', checkRole(['AM', 'FM']), createDC);
 *
 * // Only management roles
 * router.get('/wage-calculation', checkRole(['AM', 'PM', 'PD', 'MD']), getWages);
 */
export function checkRole(allowedRoles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized - Please login', 401);
      }

      const userRole = req.user.roleCode;

      if (userRole === 'GOD') {
        next();
        return;
      }

      if (!allowedRoles.includes(userRole)) {
        logger.warn(
          `Access denied: User ${req.user.username} (${userRole}) attempted to access resource requiring roles: ${allowedRoles.join(', ')}`
        );
        throw new AppError(
          `Access denied - Required roles: ${allowedRoles.join(', ')}`,
          403
        );
      }

      logger.debug(
        `Access granted: User ${req.user.username} (${userRole}) accessing ${req.method} ${req.path}`
      );

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Department Isolation Middleware
 * PD (Project Director) สามารถเห็นเฉพาะข้อมูลใน department ของตัวเอง (FR-A-007)
 * MD (Managing Director) สามารถเห็นทุก department (FR-A-008)
 *
 * @example
 * router.get('/projects', authenticate, checkDepartmentAccess, getProjects);
 */
export function checkDepartmentAccess(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized - Please login', 401);
    }

    const userRole = req.user.roleCode;
    const userDepartment = req.user.department;

    // MD can access all departments (FR-A-008)
    if (userRole === 'MD') {
      logger.debug(`MD ${req.user.username} granted access to all departments`);
      next();
      return;
    }

    // PD can only access their own department (FR-A-007)
    if (userRole === 'PD') {
      // Add department filter to query params
      req.query.department = userDepartment;

      logger.debug(
        `PD ${req.user.username} restricted to department ${userDepartment}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Project Access Control Middleware
 * ตรวจสอบว่า user มีสิทธิ์เข้าถึง project นั้นหรือไม่
 *
 * @example
 * router.get('/projects/:id', authenticate, checkProjectAccess, getProjectById);
 */
export function checkProjectAccess(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized - Please login', 401);
    }

    const projectId = req.params.projectId || req.params.id;
    const userRole = req.user.roleCode;
    const userProjectIds = req.user.projectLocationIds || [];

    // MD can access all projects (FR-A-008)
    if (userRole === 'MD') {
      next();
      return;
    }

    // Check if user has access to this project
    if (!projectId) {
      // If no specific project ID, continue (list endpoints will filter later)
      next();
      return;
    }

    if (!userProjectIds.includes(projectId)) {
      logger.warn(
        `Access denied: User ${req.user.username} attempted to access project ${projectId}`
      );
      throw new AppError('Access denied - No permission for this project', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Permission helper functions
 */
export const Permissions = {
  /**
   * Check if user can create daily reports
   * Allowed: SE, OE, PE, PM, PD, AM
   */
  canCreateDailyReport(role: UserRole): boolean {
    return ['SE', 'OE', 'PE', 'PM', 'PD', 'AM'].includes(role);
  },

  /**
   * Check if user can access new project creation
   * Allowed: Admin, OE, PE, PM, PD (FR-A-003)
   */
  canAccessNewProject(role: UserRole): boolean {
    return ['AM', 'OE', 'PE', 'PM', 'PD'].includes(role);
  },

  /**
   * Check if user can access member management
   * Allowed: Admin only (FR-A-004)
   */
  canAccessMemberManagement(role: UserRole): boolean {
    return role === 'AM';
  },

  /**
   * Check if user can access DC management
   * Allowed: Admin, Foreman (FR-A-005)
   */
  canAccessDCManagement(role: UserRole): boolean {
    return ['AM', 'FM'].includes(role);
  },

  /**
   * Check if user can access wage calculation
   * Allowed: Admin, PM, PD, MD (FR-A-006)
   */
  canAccessWageCalculation(role: UserRole): boolean {
    return ['AM', 'PM', 'PD', 'MD'].includes(role);
  },

  /**
   * Check if user can upload scan data
   * Allowed: Admin only
   */
  canUploadScanData(role: UserRole): boolean {
    return role === 'AM';
  },

  /**
   * Check if user can access dashboard
   * Allowed: All authenticated users
   */
  canAccessDashboard(_role: UserRole): boolean {
    return true;
  },

  /**
   * Check if user can access all projects
   * Allowed: MD only (FR-A-008)
   */
  canAccessAllProjects(role: UserRole): boolean {
    return role === 'MD';
  },

  /**
   * Check if user can only access department projects
   * Allowed: PD only (FR-A-007)
   */
  canAccessDepartmentProjects(role: UserRole): boolean {
    return role === 'PD';
  },
};

/**
 * Export middleware for easy use
 */
export const auth = {
  authenticate,
  checkRole,
  checkDepartmentAccess,
  checkProjectAccess,
  Permissions,
};

export default auth;
