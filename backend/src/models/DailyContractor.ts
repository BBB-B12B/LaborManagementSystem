/**
 * DailyContractor Model
 * แรงงานรายวัน (DC)
 *
 * Description: Daily laborers who work on projects. Each DC has specific skills and can be assigned to multiple projects.
 * Firestore Collection: dailyContractors
 */

export interface DailyContractor {
  id: string;
  employeeId: string;
  username?: string;
  passwordHash?: string;
  name: string;
  skillId: string;
  projectLocationIds: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface DailyContractorDTO {
  id: string;
  employeeId: string;
  name: string;
  skillId: string;
  projectLocationIds: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDailyContractorInput {
  employeeId?: string;
  username?: string;
  password?: string;
  name?: string;
  skillId?: string;
  projectLocationIds?: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
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
  projectLocationIds?: string[];
  phoneNumber?: string;
  idCardNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Firestore document converter for DailyContractor
 */
export const dailyContractorConverter = {
  toFirestore: (dc: Omit<DailyContractor, 'id'>): any => {
    return {
      employeeId: dc.employeeId,
      username: dc.username || null,
      passwordHash: dc.passwordHash || null,
      name: dc.name,
      skillId: dc.skillId,
      projectLocationIds: dc.projectLocationIds,
      phoneNumber: dc.phoneNumber || null,
      idCardNumber: dc.idCardNumber || null,
      address: dc.address || null,
      emergencyContact: dc.emergencyContact || null,
      emergencyPhone: dc.emergencyPhone || null,
      isActive: dc.isActive,
      startDate: dc.startDate || null,
      endDate: dc.endDate || null,
      createdAt: dc.createdAt,
      updatedAt: dc.updatedAt,
      createdBy: dc.createdBy,
      updatedBy: dc.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): DailyContractor => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      username: data.username,
      passwordHash: data.passwordHash,
      name: data.name,
      skillId: data.skillId,
      projectLocationIds: data.projectLocationIds || [],
      phoneNumber: data.phoneNumber,
      idCardNumber: data.idCardNumber,
      address: data.address,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      isActive: data.isActive !== undefined ? data.isActive : true,
      startDate: data.startDate?.toDate(),
      endDate: data.endDate?.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
