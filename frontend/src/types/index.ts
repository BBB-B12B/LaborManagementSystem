// ประเภทข้อมูลหลักสำหรับระบบจัดการแรงงาน
// (จะเพิ่มเติมตาม data-model.md ในภายหลัง)

export interface User {
  id: string;
  username: string;
  name: string;
  employeeId: string;
  roleId: string;
  department: string;
  projectLocationIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyContractor {
  id: string;
  employeeNumber: string;
  name: string;
  skillId: string;
  regularRate: number;
  projectLocationIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyReport {
  id: string;
  projectLocationId: string;
  date: Date;
  dailyContractorId: string;
  task: string;
  taskDetails: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  wage: number;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectLocation {
  id: string;
  name: string;
  code: string;
  department: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
