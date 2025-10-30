/**
 * ProjectLocation Model
 * โครงการ
 *
 * Description: Construction sites or project locations where daily contractors work.
 * Firestore Collection: projectLocations
 */

export type ProjectStatus = 'active' | 'completed' | 'suspended';

export interface ProjectLocation {
  id: string;
  code: string;
  name: string;
  location: string;
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
  name: string;
  location: string;
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
  name?: string;
  location?: string;
  department?: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ProjectStatus;
  description?: string;
  isActive?: boolean;
}

/**
 * Firestore document converter for ProjectLocation
 */
export const projectLocationConverter = {
  toFirestore: (project: Omit<ProjectLocation, 'id'>): any => {
    return {
      code: project.code.toUpperCase(),
      name: project.name,
      location: project.location,
      department: project.department,
      projectManager: project.projectManager || null,
      startDate: project.startDate || null,
      endDate: project.endDate || null,
      status: project.status,
      description: project.description || null,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      createdBy: project.createdBy,
      updatedBy: project.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): ProjectLocation => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      code: data.code,
      name: data.name,
      location: data.location,
      department: data.department,
      projectManager: data.projectManager,
      startDate: data.startDate?.toDate(),
      endDate: data.endDate?.toDate(),
      status: data.status,
      description: data.description,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
