/**
 * DailyContractor Model
 * แรงงานรายวัน (DC)
 *
 * Description: Daily laborers who work on projects. Each DC has specific skill (ตำแหน่ง)
 * and can be assigned to multiple projects.
 * Firestore Collection: dailyContractors
 *
 * NOTE: Financial data (income/expense) is stored in sub-collections:
 *   - dcIncomeDetails
 *   - dcExpenseDetails
 */

export interface DailyContractor {
  id: string;
  employeeId: string;
  username?: string;
  passwordHash?: string;
  name: string;
  skillId: string;
  projectLocationId?: string;
  dateOfBirth?: Date | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  idHistory?: string[]; // History of previous employeeIds
  foremanUsage?: Record<string, {
    count: number;
    name: string;
  }>;
}

export interface DailyContractorDTO {
  id: string;
  employeeId: string;
  name: string;
  skillId: string;
  projectLocationId?: string;
  dateOfBirth?: Date | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  foremanUsage?: Record<string, {
    count: number;
    name: string;
  }>;
}

export interface CreateDailyContractorInput {
  employeeId?: string;
  username?: string;
  password?: string;
  name?: string;
  skillId?: string;
  projectLocationId?: string;
  dateOfBirth?: Date;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateDailyContractorInput {
  employeeId?: string;
  username?: string;
  password?: string;
  name?: string;
  skillId?: string;
  projectLocationId?: string;
  dateOfBirth?: Date;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

const parseDate = (val: any) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Firestore document converter for DailyContractor
 */
export const dailyContractorConverter = {
  toFirestore: (dc: DailyContractor): any => {
    return {
      employeeId: dc.employeeId,
      username: dc.username || null,
      passwordHash: dc.passwordHash || null,
      name: dc.name,
      skillId: dc.skillId,
      projectLocationId: dc.projectLocationId || null,
      dateOfBirth: dc.dateOfBirth || null,
      isActive: dc.isActive,
      startDate: dc.startDate || null,
      endDate: dc.endDate || null,
      createdAt: dc.createdAt,
      updatedAt: dc.updatedAt,
      createdBy: dc.createdBy,
      updatedBy: dc.updatedBy,
      foremanUsage: dc.foremanUsage || null,
    };
  },
  fromFirestore: (snapshot: any): DailyContractor => {
    const data = snapshot.data();
    
    // Support for legacy data: if projectLocationIds exists and is an array with at least one element, use its first element
    let projectLocationId = data.projectLocationId;
    if (!projectLocationId && Array.isArray(data.projectLocationIds) && data.projectLocationIds.length > 0) {
      projectLocationId = data.projectLocationIds[0];
    }

    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      skillId: data.skillId || '',
      projectLocationId: projectLocationId || '',
      dateOfBirth: parseDate(data.dateOfBirth),
      isActive: data.isActive !== undefined ? data.isActive : true,
      startDate: parseDate(data.startDate),
      endDate: parseDate(data.endDate),
      createdAt: parseDate(data.createdAt) || new Date(),
      updatedAt: parseDate(data.updatedAt) || new Date(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      foremanUsage: data.foremanUsage,
    };
  },
};
