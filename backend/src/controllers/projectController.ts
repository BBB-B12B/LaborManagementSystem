/**
 * Project Controller
 * จัดการ HTTP requests สำหรับโครงการ
 *
 * Endpoints:
 * - GET /api/projects - Get all projects with filters
 * - GET /api/projects/active - Get active projects
 * - GET /api/projects/:id - Get single project
 * - POST /api/projects - Create new project
 * - PUT /api/projects/:id - Update project
 * - DELETE /api/projects/:id - Delete project (soft delete)
 */

import { Request, Response } from 'express';
import {
  createProject,
  updateProject,
  deleteProject,
  getProjectById,
  getAllProjects,
  getActiveProjects,
  getDepartments,
  getNextProjectCode,
} from '../services/projectService';

/**
 * GET /api/projects
 * Get all projects with optional filters
 */
export async function getAllProjectsHandler(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const filters: any = {};

    if (req.query.department) filters.department = String(req.query.department);
    if (req.query.status) filters.status = String(req.query.status);
    if (req.query.isActive !== undefined)
      filters.isActive = String(req.query.isActive) === 'true';
    if (req.query.search) filters.search = String(req.query.search);

    const projects = await getAllProjects(filters);

    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโครงการ',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/projects/active
 * Get active projects only
 */
export async function getActiveProjectsHandler(
  _req: Request,
  res: Response
): Promise<Response> {
  try {
    const projects = await getActiveProjects();
    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Error fetching active projects:', error);
    return res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโครงการที่ใช้งาน',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/projects/next-code
 * Get next available project code
 */
export async function getNextProjectCodeHandler(
  _req: Request,
  res: Response
): Promise<Response> {
  try {
    const code = await getNextProjectCode();
    return res.status(200).json({
      success: true,
      data: { code },
    });
  } catch (error) {
    console.error('Error generating next project code:', error);
    return res.status(500).json({
      success: false,
      error: 'ไม่สามารถสร้างรหัสโครงการถัดไปได้',
      message: (error as Error).message,
    });
  }
}

/**
 * GET /api/projects/:id
 * Get a single project by ID
 */
export async function getProjectByIdHandler(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(404).json({
      success: false,
      error: 'ไม่พบโครงการ',
      message: (error as Error).message,
    });
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function createProjectHandler(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต' });
    }

    const userId = authUser.uid || authUser.id || authUser.employeeId || 'system';

    const data = {
      code: req.body.code ? String(req.body.code).trim().toUpperCase() : undefined,
      projectCode:
        req.body.projectCode !== undefined
          ? String(req.body.projectCode).trim()
          : '',
      projectName: req.body.projectName ? String(req.body.projectName).trim() : '',
      department: req.body.department ? String(req.body.department).trim() : '',
      projectManager:
        req.body.projectManager !== undefined && req.body.projectManager !== null
          ? String(req.body.projectManager).trim()
          : undefined,
      status: req.body.status ? String(req.body.status).trim() : undefined,
    };

    const project = await createProject(data, userId);

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(400).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการสร้างโครงการ',
      message: (error as Error).message,
    });
  }
}

/**
 * PUT /api/projects/:id
 * Update an existing project
 */
export async function updateProjectHandler(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const { id } = req.params;
    const authUser = (req as any).user;
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต' });
    }

    const userId = authUser.uid || authUser.id || authUser.employeeId || 'system';

    const data = {
      code: req.body.code ? String(req.body.code).trim().toUpperCase() : undefined,
      projectCode:
        req.body.projectCode !== undefined
          ? String(req.body.projectCode).trim()
          : undefined,
      projectName:
        req.body.projectName !== undefined
          ? String(req.body.projectName).trim()
          : undefined,
      department:
        req.body.department !== undefined
          ? String(req.body.department).trim()
          : undefined,
      projectManager:
        req.body.projectManager !== undefined
          ? String(req.body.projectManager ?? '').trim()
          : undefined,
      status: req.body.status ? String(req.body.status).trim() : undefined,
    };

    Object.keys(data).forEach((key) => {
      if (data[key as keyof typeof data] === undefined) {
        delete data[key as keyof typeof data];
      }
    });

    const project = await updateProject(id, data, userId);

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(400).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการอัปเดตโครงการ',
      message: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/projects/:id
 * Delete a project (soft delete)
 */
export async function deleteProjectHandler(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const { id } = req.params;
    await deleteProject(id);
    return res.status(200).json({
      success: true,
      message: 'ลบโครงการสำเร็จ',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(400).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการลบโครงการ',
      message: (error as Error).message,
    });
  }
}

export async function getDepartmentsHandler(
  _req: Request,
  res: Response
): Promise<Response> {
  try {
    const departments = await getDepartments();
    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสังกัด',
      message: (error as Error).message,
    });
  }
}
