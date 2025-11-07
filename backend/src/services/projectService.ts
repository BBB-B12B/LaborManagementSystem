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
  projectCode?: string;
  name: string;
  projectName?: string;
  location?: string;
  department: string;
  projectManager?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'completed' | 'suspended';
  statusLabel?: string;
  description?: string;
  isActive?: boolean;
}

const PROJECT_COLLECTION = 'Project';
const PROJECT_CODE_PREFIX = 'P';
const PROJECT_CODE_PAD_LENGTH = 3;

const getProjectCollection = () => db.collection(PROJECT_COLLECTION);
const formatProjectCode = (num: number) =>
  `${PROJECT_CODE_PREFIX}${num.toString().padStart(PROJECT_CODE_PAD_LENGTH, '0')}`;

const extractNumericSuffix = (value?: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const incrementProjectCode = (currentCode: string): string => {
  const currentNumber = extractNumericSuffix(currentCode) ?? 0;
  return formatProjectCode(currentNumber + 1);
};

const PROJECT_CACHE_TTL_MS =
  Number(process.env.PROJECT_CACHE_TTL_MS ?? process.env.PROJECT_CACHE_TTL ?? 5 * 60 * 1000);
const isCacheEnabled = PROJECT_CACHE_TTL_MS > 0;
type CacheEntry<T> = { data: T; expires: number };
const projectCache = new Map<string, CacheEntry<any>>();

const getCacheKey = (prefix: string, payload?: unknown): string =>
  `${prefix}:${JSON.stringify(payload ?? {})}`;

const getCachedValue = <T>(key: string): T | null => {
  if (!isCacheEnabled) return null;
  const entry = projectCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    projectCache.delete(key);
    return null;
  }
  return entry.data as T;
};

const setCachedValue = <T>(key: string, value: T): void => {
  if (!isCacheEnabled) return;
  projectCache.set(key, { data: value, expires: Date.now() + PROJECT_CACHE_TTL_MS });
};

const clearProjectCache = (): void => {
  projectCache.clear();
};

const detailCacheKey = (id: string) => getCacheKey('detail', id);

const isCodeTaken = async (code: string): Promise<boolean> => {
  const docSnapshot = await getProjectCollection().doc(code).get();
  if (docSnapshot.exists) {
    return true;
  }

  const existing = await getProjectCollection()
    .where('code', '==', code)
    .limit(1)
    .get();
  return !existing.empty;
};

const resolveProjectCode = async (preferred?: string): Promise<string> => {
  let candidate = preferred?.trim()?.toUpperCase();
  if (!candidate) {
    candidate = await getNextProjectCode();
  }

  while (await isCodeTaken(candidate)) {
    candidate = incrementProjectCode(candidate);
  }

  return candidate;
};

/**
 * Create a new project
 */
export async function createProject(
  data: ProjectData,
  createdBy: string
): Promise<any> {
  const codeUpper = await resolveProjectCode(data.code);
  const projectCodeValue = data.projectCode ? data.projectCode.trim() : '';

  if (!projectCodeValue) {
    throw new Error('Project code is required');
  }

  if (!data.department || !data.department.trim()) {
    throw new Error('กรุณาระบุสังกัดโครงการ');
  }

  const projectRef = getProjectCollection().doc(codeUpper);

  const projectData = {
    code: codeUpper,
    projectCode: projectCodeValue,
    name: data.name,
    projectName: data.projectName ?? data.name,
    location: typeof data.location === 'string' ? data.location.trim() : '',
    department: data.department.trim(),
    projectManager: data.projectManager ? data.projectManager.trim() : null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    status: data.status || 'active',
    statusLabel: data.statusLabel || null,
    description: data.description || null,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdBy,
    updatedBy: createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await projectRef.set(projectData);
  clearProjectCache();
  setCachedValue(detailCacheKey(projectRef.id), { id: projectRef.id, ...projectData });

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
  const projectRef = getProjectCollection().doc(id);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('ไม่พบโครงการ');
  }

  // Prevent changing primary project code (doc id)
  if (data.code && data.code.toUpperCase() !== id.toUpperCase()) {
    throw new Error('ไม่สามารถเปลี่ยนลำดับโครงการได้ กรุณาสร้างโครงการใหม่');
  }

  let projectCodeValue: string | undefined;
  if (data.projectCode !== undefined) {
    const trimmed = typeof data.projectCode === 'string' ? data.projectCode.trim() : '';
    if (!trimmed) {
      throw new Error('Project code is required');
    }
    projectCodeValue = trimmed;
  }

  if (data.department !== undefined && !String(data.department).trim()) {
    throw new Error('กรุณาระบุสังกัดโครงการ');
  }

  const updateData: any = {
    ...data,
    code: data.code ? data.code.toUpperCase() : undefined,
    projectName: data.projectName ?? data.name,
    projectCode: projectCodeValue,
    projectManager:
      data.projectManager !== undefined
        ? data.projectManager
          ? data.projectManager.trim()
          : null
        : undefined,
    statusLabel: data.statusLabel ?? undefined,
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
  const updatedData = { id: updatedDoc.id, ...updatedDoc.data() };
  clearProjectCache();
  setCachedValue(detailCacheKey(updatedDoc.id), updatedData);
  return updatedData;
}

/**
 * Delete a project (soft delete)
 */
export async function deleteProject(id: string): Promise<void> {
  const projectRef = getProjectCollection().doc(id);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('ไม่พบโครงการ');
  }

  // Soft delete: set isActive to false
  await projectRef.update({
    isActive: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  clearProjectCache();
  projectCache.delete(detailCacheKey(id));
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<any> {
  const cachedDetail = getCachedValue<any>(detailCacheKey(id));
  if (cachedDetail) {
    return cachedDetail;
  }

  const projectDoc = await getProjectCollection().doc(id).get();

  if (!projectDoc.exists) {
    throw new Error('ไม่พบโครงการ');
  }

  const project = { id: projectDoc.id, ...projectDoc.data() };
  setCachedValue(detailCacheKey(id), project);
  return project;
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
  const cacheKey = getCacheKey('list', filters);
  const cached = getCachedValue<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  let query: any = getProjectCollection();

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

  setCachedValue(cacheKey, projects);
  return projects;
}

export async function getNextProjectCode(): Promise<string> {
  const snapshot = await getProjectCollection().get();
  let maxNumber = 0;

  snapshot.forEach((doc) => {
    const data = doc.data() as { code?: string; projectCode?: string } | undefined;
    const updateMax = (value?: string) => {
      const parsed = extractNumericSuffix(value);
      if (parsed !== null && parsed > maxNumber) {
        maxNumber = parsed;
      }
    };

    updateMax(data?.code);
    updateMax(data?.projectCode);
    updateMax(doc.id);
  });

  const nextNumber = maxNumber + 1;
  return formatProjectCode(Math.max(nextNumber, 1));
}

/**
 * Get active projects only
 */
export async function getActiveProjects(): Promise<any[]> {
  return getAllProjects({ isActive: true, status: 'active' });
}

export async function getDepartments(): Promise<string[]> {
  const snapshot = await getProjectCollection().get();
  const departments = new Set<string>();
  snapshot.forEach((doc) => {
    const data = doc.data() as any;
    if (data.department) {
      departments.add(String(data.department));
    }
  });
  return Array.from(departments).sort((a, b) => a.localeCompare(b));
}
