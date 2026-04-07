
export type ProjectStatus = 'active' | 'completed' | 'suspended';

export interface ProjectLocation {
  id: string;
  code: string;
  projectCode: string; // Added field as requested
  projectName: string;
  location?: string;
  department: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status: ProjectStatus;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateProjectLocationInput {
  code: string;
  projectCode?: string;
  projectName: string;
  location?: string;
  department: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ProjectStatus;
  description?: string;
  isActive?: boolean;
}

export interface UpdateProjectLocationInput {
  code?: string;
  projectCode?: string;
  projectName?: string;
  location?: string;
  department?: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ProjectStatus;
  description?: string;
  isActive?: boolean;
}

export const projectLocationConverter = {
  toFirestore: (project: any): any => {
    return {
      code: project.code,
      projectCode: project.projectCode,
      projectName: project.projectName,
      location: project.location,
      department: project.department,
      projectManager: project.projectManager,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
      description: project.description,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      createdBy: project.createdBy,
      updatedBy: project.updatedBy
    };
  },
  fromFirestore: (snapshot: any): ProjectLocation => {
    const data = snapshot.data();

    // Safely handle dates
    const safeDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      if (typeof val.toDate === 'function') return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return val;
    };

    return {
      id: snapshot.id,
      code: data.code,
      projectCode: data.projectCode || '', // Fallback to empty string if missing
      projectName: data.projectName || data.name || '',
      location: data.location,
      department: data.department,
      projectManager: data.projectManager,
      startDate: safeDate(data.startDate),
      endDate: safeDate(data.endDate),
      status: data.status,
      description: data.description,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: safeDate(data.createdAt) || new Date(),
      updatedAt: safeDate(data.updatedAt) || new Date(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy
    };
  }
};
