import React from 'react';

/**
 * Frontend Permission Utilities
 * Helper functions สำหรับตรวจสอบ permissions ตาม role
 *
 * Role hierarchy (from data-model.md):
 * 1. MD (Managing Director) - Level 1 - All access
 * 2. PD (Project Director) - Level 2 - Department projects, wage calculation
 * 3. PM (Project Manager) - Level 3 - Project creation, wage calculation
 * 4. PE (Project Engineer) - Level 4 - Project creation
 * 5. OE (Office Engineer) - Level 5 - Project creation
 * 6. SE (Site Engineer) - Level 6 - Daily report, DC management
 * 7. FM (Foreman) - Level 7 - Daily report, DC management
 * 8. AM (Admin) - Level 8 - All management features
 */

export type UserRole = 'AM' | 'FM' | 'SE' | 'OE' | 'PE' | 'PM' | 'PD' | 'MD' | 'GOD';

export interface User {
  id: string;
  employeeId: string;
  username: string;
  name: string;
  roleId: string;
  roleCode?: UserRole;
  department: string;
  projectLocationIds: string[];
  isActive: boolean;
}

/**
 * Permission checker class
 */
export class Permissions {
  /**
   * Check if user can access dashboard
   * Allowed: All authenticated users
   */
  static canAccessDashboard(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    return !!role;
  }

  /**
   * Check if user can create daily reports
   * Allowed: SE, OE, PE, PM, PD, AM
   */
  static canCreateDailyReport(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    if (!role) return false;
    return ['SE', 'OE', 'PE', 'PM', 'PD', 'AM'].includes(role);
  }

  /**
   * Check if user can edit daily reports
   * Allowed: SE, OE, PE, PM, PD, AM
   */
  static canEditDailyReport(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    return this.canCreateDailyReport(role);
  }

  /**
   * Check if user can delete daily reports
   * Allowed: SE, OE, PE, PM, PD, AM
   */
  static canDeleteDailyReport(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    return this.canCreateDailyReport(role);
  }

  /**
   * Check if user can access new project creation
   * Allowed: Admin, OE, PE, PM, PD (FR-A-003)
   */
  static canAccessNewProject(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    if (!role) return false;
    return ['AM', 'OE', 'PE', 'PM', 'PD'].includes(role);
  }

  /**
   * Check if user can access member management
   * Allowed: Admin only (FR-A-004)
   */
  static canAccessMemberManagement(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    return role === 'AM';
  }

  /**
   * Check if user can access DC management
   * Allowed: Admin, Foreman (FR-A-005)
   */
  static canAccessDCManagement(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    if (!role) return false;
    return ['AM', 'FM'].includes(role);
  }

  /**
   * Check if user can access wage calculation
   * Allowed: Admin, PM, PD, MD (FR-A-006)
   */
  static canAccessWageCalculation(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    if (!role) return false;
    return ['AM', 'PM', 'PD', 'MD'].includes(role);
  }

  /**
   * Check if user can upload scan data
   * Allowed: Admin only
   */
  static canUploadScanData(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    return role === 'AM';
  }

  /**
   * Check if user can access scan data monitoring
   * Allowed: Admin, PM, PD, MD
   */
  static canAccessScanDataMonitoring(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    if (!role) return false;
    return ['AM', 'PM', 'PD', 'MD'].includes(role);
  }

  /**
   * Check if user can access all projects
   * Allowed: MD only (FR-A-008)
   */
  static canAccessAllProjects(role?: UserRole): boolean {
    if (role === 'GOD') return true;
    return role === 'MD';
  }

  /**
   * Check if user is restricted to department projects
   * Allowed: PD only (FR-A-007)
   */
  static isDepartmentRestricted(role?: UserRole): boolean {
    if (role === 'GOD') return false;
    return role === 'PD';
  }

  /**
   * Check if user has access to specific project
   */
  static canAccessProject(
    user: User | null | undefined,
    projectId: string
  ): boolean {
    if (!user) return false;

    // MD can access all projects
    if (user.roleCode === 'MD' || user.roleCode === 'GOD') return true;

    // Check if project is in user's accessible projects
    return user.projectLocationIds?.includes(projectId) || false;
  }

  /**
   * Get accessible menu items based on role
   */
  static getAccessibleMenuItems(role?: UserRole): string[] {
    if (!role) return [];

    if (role === 'GOD') {
      return [
        'dashboard',
        'daily-reports',
        'overtime',
        'projects',
        'members',
        'daily-contractors',
        'wage-calculation',
        'scan-data-monitoring',
      ];
    }

    const menuItems: string[] = ['dashboard'];

    // Daily Report access
    if (this.canCreateDailyReport(role)) {
      menuItems.push('daily-reports', 'overtime');
    }

    // Project Management
    if (this.canAccessNewProject(role)) {
      menuItems.push('projects');
    }

    // Member Management
    if (this.canAccessMemberManagement(role)) {
      menuItems.push('members');
    }

    // DC Management
    if (this.canAccessDCManagement(role)) {
      menuItems.push('daily-contractors');
    }

    // Wage Calculation
    if (this.canAccessWageCalculation(role)) {
      menuItems.push('wage-calculation');
    }

    // ScanData Monitoring
    if (this.canAccessScanDataMonitoring(role)) {
      menuItems.push('scan-data-monitoring');
    }

    return menuItems;
  }

  /**
   * Get role display name (Thai)
   */
  static getRoleName(roleCode: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      GOD: 'ผู้ดูแลสูงสุด',
      MD: 'กรรมการผู้จัดการ',
      PD: 'ผู้อำนวยการโครงการ',
      PM: 'ผู้จัดการโครงการ',
      PE: 'วิศวกรโครงการ',
      OE: 'วิศวกรสำนักงาน',
      SE: 'วิศวกรประจำหน้างาน',
      FM: 'หัวหน้างาน',
      AM: 'ผู้ดูแลระบบ',
    };
    return roleNames[roleCode] || roleCode;
  }

  /**
   * Get role level (1-8)
   */
  static getRoleLevel(roleCode: UserRole): number {
    const roleLevels: Record<UserRole, number> = {
      GOD: 0,
      MD: 1,
      PD: 2,
      PM: 3,
      PE: 4,
      OE: 5,
      SE: 6,
      FM: 7,
      AM: 8,
    };
    return roleLevels[roleCode] || 99;
  }

  /**
   * Check if user has higher or equal authority
   */
  static hasAuthority(userRole: UserRole, requiredRole: UserRole): boolean {
    if (userRole === 'GOD') return true;
    const userLevel = this.getRoleLevel(userRole);
    const requiredLevel = this.getRoleLevel(requiredRole);
    return userLevel <= requiredLevel;
  }
}

/**
 * React Hook for checking permissions
 */
export function usePermissions(user: User | null | undefined) {
  const role = user?.roleCode;

  return {
    canAccessDashboard: Permissions.canAccessDashboard(role),
    canCreateDailyReport: Permissions.canCreateDailyReport(role),
    canEditDailyReport: Permissions.canEditDailyReport(role),
    canDeleteDailyReport: Permissions.canDeleteDailyReport(role),
    canAccessNewProject: Permissions.canAccessNewProject(role),
    canAccessMemberManagement: Permissions.canAccessMemberManagement(role),
    canAccessDCManagement: Permissions.canAccessDCManagement(role),
    canAccessWageCalculation: Permissions.canAccessWageCalculation(role),
    canUploadScanData: Permissions.canUploadScanData(role),
    canAccessScanDataMonitoring: Permissions.canAccessScanDataMonitoring(role),
    canAccessAllProjects: Permissions.canAccessAllProjects(role),
    isDepartmentRestricted: Permissions.isDepartmentRestricted(role),
    canAccessProject: (projectId: string) =>
      Permissions.canAccessProject(user, projectId),
    accessibleMenuItems: Permissions.getAccessibleMenuItems(role),
    roleName: role ? Permissions.getRoleName(role) : '',
    roleLevel: role ? Permissions.getRoleLevel(role) : 99,
  };
}

/**
 * Higher-Order Component for protected routes
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission: (role?: UserRole) => boolean
): React.FC<P> {
  return function ProtectedComponent(props: P) {
    // This would typically get user from auth context/store
    // For now, just return the component
    // In real implementation:
    // const { user } = useAuth();
    // if (!requiredPermission(user?.roleCode)) {
    //   return <Redirect to="/unauthorized" />;
    // }
    return React.createElement(Component, props);
  };
}

export default Permissions;
