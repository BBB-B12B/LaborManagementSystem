/**
 * Role Model
 * บทบาทผู้ใช้งาน
 *
 * Description: User roles defining permissions and access levels within the system.
 * Firestore Collection: roles
 */

export type RoleCode = 'AM' | 'FM' | 'SE' | 'OE' | 'PE' | 'PM' | 'PD' | 'MD';

export interface RolePermissions {
  canAccessDashboard: boolean;
  canCreateDailyReport: boolean;
  canEditDailyReport: boolean;
  canDeleteDailyReport: boolean;
  canAccessNewProject: boolean;
  canAccessMemberManagement: boolean;
  canAccessDCManagement: boolean;
  canAccessWageCalculation: boolean;
  canUploadScanData: boolean;
  canAccessAllProjects: boolean; // MD only
  canAccessDepartmentProjects: boolean; // PD only
}

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  nameEnglish: string;
  description?: string;
  permissions: RolePermissions;
  level: number; // 1=MD (highest), 8=AM (admin)
  createdAt: Date;
}

/**
 * Predefined roles data
 */
export const PREDEFINED_ROLES: Omit<Role, 'id' | 'createdAt'>[] = [
  {
    code: 'MD',
    name: 'กรรมการผู้จัดการ',
    nameEnglish: 'Managing Director',
    description: 'มีสิทธิ์เข้าถึงทุกโครงการในระบบ',
    level: 1,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: true,
      canAccessNewProject: true,
      canAccessMemberManagement: false,
      canAccessDCManagement: false,
      canAccessWageCalculation: true,
      canUploadScanData: false,
      canAccessAllProjects: true,
      canAccessDepartmentProjects: false,
    },
  },
  {
    code: 'PD',
    name: 'ผู้อำนวยการโครงการ',
    nameEnglish: 'Project Director',
    description: 'เข้าถึงเฉพาะโครงการในสังกัดของตนเอง (PD01-PD05)',
    level: 2,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: true,
      canAccessNewProject: true,
      canAccessMemberManagement: false,
      canAccessDCManagement: false,
      canAccessWageCalculation: true,
      canUploadScanData: false,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: true,
    },
  },
  {
    code: 'PM',
    name: 'ผู้จัดการโครงการ',
    nameEnglish: 'Project Manager',
    description: 'จัดการโครงการและคำนวณค่าแรง',
    level: 3,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: true,
      canAccessNewProject: true,
      canAccessMemberManagement: false,
      canAccessDCManagement: false,
      canAccessWageCalculation: true,
      canUploadScanData: false,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: false,
    },
  },
  {
    code: 'PE',
    name: 'วิศวกรโครงการ',
    nameEnglish: 'Project Engineer',
    description: 'สร้างโครงการใหม่',
    level: 4,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: false,
      canAccessNewProject: true,
      canAccessMemberManagement: false,
      canAccessDCManagement: false,
      canAccessWageCalculation: false,
      canUploadScanData: false,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: false,
    },
  },
  {
    code: 'OE',
    name: 'วิศวกรสำนักงาน',
    nameEnglish: 'Office Engineer',
    description: 'สร้างโครงการใหม่',
    level: 5,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: false,
      canAccessNewProject: true,
      canAccessMemberManagement: false,
      canAccessDCManagement: false,
      canAccessWageCalculation: false,
      canUploadScanData: false,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: false,
    },
  },
  {
    code: 'SE',
    name: 'วิศวกรประจำไซต์',
    nameEnglish: 'Site Engineer',
    description: 'บันทึก Daily Report และจัดการ DC',
    level: 6,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: false,
      canAccessNewProject: false,
      canAccessMemberManagement: false,
      canAccessDCManagement: true,
      canAccessWageCalculation: false,
      canUploadScanData: false,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: false,
    },
  },
  {
    code: 'FM',
    name: 'หัวหน้าคนงาน',
    nameEnglish: 'Foreman',
    description: 'บันทึก Daily Report และจัดการ DC',
    level: 7,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: false,
      canAccessNewProject: false,
      canAccessMemberManagement: false,
      canAccessDCManagement: true,
      canAccessWageCalculation: false,
      canUploadScanData: false,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: false,
    },
  },
  {
    code: 'AM',
    name: 'ผู้ดูแลระบบ',
    nameEnglish: 'Admin',
    description: 'จัดการผู้ใช้งานและมีสิทธิ์เต็มในระบบ',
    level: 8,
    permissions: {
      canAccessDashboard: true,
      canCreateDailyReport: true,
      canEditDailyReport: true,
      canDeleteDailyReport: true,
      canAccessNewProject: true,
      canAccessMemberManagement: true,
      canAccessDCManagement: true,
      canAccessWageCalculation: true,
      canUploadScanData: true,
      canAccessAllProjects: false,
      canAccessDepartmentProjects: false,
    },
  },
];

/**
 * Firestore document converter for Role
 */
export const roleConverter = {
  toFirestore: (role: Omit<Role, 'id'>): any => {
    return {
      code: role.code,
      name: role.name,
      nameEnglish: role.nameEnglish,
      description: role.description || null,
      permissions: role.permissions,
      level: role.level,
      createdAt: role.createdAt,
    };
  },
  fromFirestore: (snapshot: any): Role => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      code: data.code,
      name: data.name,
      nameEnglish: data.nameEnglish,
      description: data.description,
      permissions: data.permissions,
      level: data.level,
      createdAt: data.createdAt.toDate(),
    };
  },
};
