/**
 * Project Service (Backend)
 * บริการจัดการข้อมูลโครงการ (Backend)
 *
 * Business logic for project management:
 * - CRUD operations with Firestore
 * - Soft delete
 * - Code uniqueness validation
 * - Department-based filtering
 */

import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export interface ProjectData {
  code?: string;
  name: string;
  location?: string;
  department: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'completed' | 'suspended';
  description?: string;
  isActive?: boolean;
}

const PROJECT_CODE_PREFIX = 'P';
const PROJECT_CODE_PAD_LENGTH = 3;

/**
 * Create a new project
 */
export async function createProject(
  data: ProjectData,
  createdBy: string
): Promise<any> {
  let code = data.code?.trim();
  if (!code) {
    code = await getNextProjectCode();
  }

  const codeUpper = code.toUpperCase();

  // Check code uniqueness
  const existingProject = await db
    .collection('project_locations')
    .where('code', '==', codeUpper)
    .get();

  if (!existingProject.empty) {
    throw new Error('รหัสโครงการนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น');
  }

  if (!data.department || !data.department.trim()) {
    throw new Error('กรุณาระบุสังกัดโครงการ');
  }

  const projectRef = db.collection('project_locations').doc();

  const projectData = {
    code: codeUpper,
    name: data.name,
    location: typeof data.location === 'string' ? data.location.trim() : '',
    department: data.department.trim(),
    projectManager: data.projectManager || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    status: data.status || 'active',
    description: data.description || null,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdBy,
    updatedBy: createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await projectRef.set(projectData);

  return { id: projectRef.id, ...projectData };
}

/**
 * Update an existing project
 */
export async function updateProject(
  id: string,
  data: Partial<ProjectData>,
  updatedBy: string
): Promise<any> {
  const projectRef = db.collection('project_locations').doc(id);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('ไม่พบโครงการ');
  }

  // Check code uniqueness if code is being changed
  if (data.code) {
    const codeUpper = data.code.toUpperCase();
    const existingProject = await db
      .collection('project_locations')
      .where('code', '==', codeUpper)
      .get();

    if (!existingProject.empty && existingProject.docs[0].id !== id) {
      throw new Error('รหัสโครงการนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น');
    }
  }

  if (data.department !== undefined && !String(data.department).trim()) {
    throw new Error('กรุณาระบุสังกัดโครงการ');
  }

  const updateData: any = {
    ...data,
    code: data.code ? data.code.toUpperCase() : undefined,
    updatedBy,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.department) {
    updateData.department = data.department.trim();
  }

  if (data.location !== undefined) {
    updateData.location =
      typeof data.location === 'string' ? data.location.trim() : '';
  }

  // Remove undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  await projectRef.update(updateData);

  const updatedDoc = await projectRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() };
}

/**
 * Delete a project (soft delete)
 */
export async function deleteProject(id: string): Promise<void> {
  const projectRef = db.collection('project_locations').doc(id);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('ไม่พบโครงการ');
  }

  // Soft delete: set isActive to false
  await projectRef.update({
    isActive: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<any> {
  const projectDoc = await db.collection('project_locations').doc(id).get();

  if (!projectDoc.exists) {
    throw new Error('ไม่พบโครงการ');
  }

  return { id: projectDoc.id, ...projectDoc.data() };
}

/**
 * Get all projects with filters
 */
export async function getAllProjects(filters?: {
  department?: string;
  status?: string;
  isActive?: boolean;
  search?: string;
}): Promise<any[]> {
  let query: any = db.collection('project_locations');

  // Apply filters
  if (filters?.department) {
    query = query.where('department', '==', filters.department.trim());
  }

  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }

  if (filters?.isActive !== undefined) {
    query = query.where('isActive', '==', filters.isActive);
  }

  // Order by code
  query = query.orderBy('code', 'asc');

  const snapshot = await query.get();
  let projects = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // Apply search filter (client-side for now)
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    projects = projects.filter((p: any) => 
      p.name.toLowerCase().includes(searchLower) ||
      p.code.toLowerCase().includes(searchLower) ||
      (p.location || '').toLowerCase().includes(searchLower)
    );
  }

  return projects;
}

export async function getNextProjectCode(): Promise<string> {
  const snapshot = await db.collection('project_locations').get();
  let maxNumber = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const code = typeof data.code === 'string' ? data.code : '';
    const match = code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  const nextNumber = maxNumber + 1;
  return `${PROJECT_CODE_PREFIX}${nextNumber
    .toString()
    .padStart(PROJECT_CODE_PAD_LENGTH, '0')}`;
}

/**
 * Get active projects only
 */
export async function getActiveProjects(): Promise<any[]> {
  return getAllProjects({ isActive: true, status: 'active' });
}

export async function getDepartments(): Promise<string[]> {
  const snapshot = await db.collection('project_locations').get();
  const departments = new Set<string>();
  snapshot.forEach((doc) => {
    const data = doc.data() as any;
    if (data.department) {
      departments.add(String(data.department));
    }
  });
  return Array.from(departments).sort((a, b) => a.localeCompare(b));
}
