import { Router, Request, Response, NextFunction } from 'express';
import { taskService } from '../../services/TaskService';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.uid;
    const { projectId } = req.query;

    const filters: any = {};
    if (projectId) {
      filters.projectId = projectId as string;
    }

    // If role is FM, SE, OE, they should only see assigned tasks
    // Let's assume FM can only see tasks assigned to them
    if (userRole === 'FM' || userRole === 'SE') {
      filters.assigneeId = userId;
    }

    const tasks = await taskService.getTasks(filters);
    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskName, projectId, projectName, workOrderId, workOrderCode, workOrderName, categoryId, categoryName, assignees, dueDate, status, isSupportRequest } = req.body;
    
    const isSupport = isSupportRequest === true;
    const hasAssignees = Array.isArray(assignees) && assignees.length > 0;

    if (!taskName || !projectId || !workOrderCode || !categoryName || !dueDate || (!isSupport && !hasAssignees)) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (TaskName, ProjectId, WorkOrderCode, CategoryName, Assignees, DueDate are required)', 400);
    }

    const validatedData = {
      taskName,
      description: req.body.description,
      projectId,
      projectName: projectName || 'Unknown Project',
      workOrderId,
      workOrderCode,
      workOrderName,
      categoryId,
      categoryName,
      assignees: assignees || [],
      dueDate: new Date(dueDate),
      status,
      isSupportRequest: isSupport,
    };

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    const newTask = await taskService.createTask(validatedData, userId);
    
    res.status(201).json({
      success: true,
      data: newTask,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    if (!['upcoming', 'in-progress', 'completed'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    await taskService.updateTaskStatus(id, status, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      data: { id, status },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const input = { ...req.body };
    if (input.dueDate) {
      const date = new Date(input.dueDate);
      if (isNaN(date.getTime())) {
        throw new AppError('รูปแบบวันที่ไม่ถูกต้อง', 400);
      }
      input.dueDate = date;
    }

    await taskService.updateTask(id, input, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: { id }, // ส่ง data กลับไปเพื่อให้ API Client ไม่ Error
    });
  } catch (error: any) {
    console.error('[Route Error] PATCH /tasks/:id failed:', error);
    next(error);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    await taskService.softDeleteTask(id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully (Soft Delete)',
      data: { id }, // ส่ง data กลับไปเพื่อให้ API Client ไม่ Error
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/reports
router.post('/:id/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const reportData = req.body;
    const isSupportReport = req.body.isSupportReport === true;
    await taskService.submitDailyReport(id, reportData, userId, isSupportReport);

    res.status(201).json({
      success: true,
      message: 'Daily report submitted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/unlock-report
router.post('/:id/unlock-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { dateStr, daysToUnlock, isSupportReport } = req.body;
    if (!dateStr || !daysToUnlock) {
      throw new AppError('dateStr and daysToUnlock are required', 400);
    }

    await taskService.unlockDailyReport(id, dateStr, daysToUnlock, userId, isSupportReport === true);

    res.status(200).json({
      success: true,
      message: 'Daily report unlocked successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/request-unlock
router.post('/:id/request-unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { dateStr, isSupportReport } = req.body;
    if (!dateStr) {
      throw new AppError('dateStr is required', 400);
    }

    await taskService.requestDailyReportUnlock(id, dateStr, userId, isSupportReport === true);

    res.status(200).json({
      success: true,
      message: 'Daily report unlock requested successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/reports
router.get('/:id/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let isSupportReport: boolean | undefined = undefined;
    if (req.query.isSupportReport === 'true') isSupportReport = true;
    if (req.query.isSupportReport === 'false') isSupportReport = false;
    
    const reports = await taskService.getAllDailyReports(id, isSupportReport);

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/reports/:date
router.get('/:id/reports/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, date } = req.params;
    const isSupportReport = req.query.isSupportReport === 'true';
    const report = await taskService.getDailyReport(id, date, isSupportReport);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/reject
router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { revisionName, assignees } = req.body;
    
    if (!revisionName || !assignees || !Array.isArray(assignees) || assignees.length === 0) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (revisionName และ assignees เป็นข้อมูลจำเป็น)', 400);
    }

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.rejectTask(id, revisionName, assignees, userId);

    res.status(200).json({
      success: true,
      message: 'ตีกลับงานสำเร็จ (Task rejected successfully)',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/approve
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.approveTask(id, userId);

    res.status(200).json({
      success: true,
      message: 'อนุมัติงานสำเร็จ (Task approved successfully)',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/support
router.post('/:id/support', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { supportTaskName, assignees } = req.body;
    
    if (!supportTaskName || !assignees || !Array.isArray(assignees) || assignees.length === 0) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (supportTaskName และ assignees เป็นข้อมูลจำเป็น)', 400);
    }

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.joinSupportTask(id, supportTaskName, assignees, userId);

    res.status(200).json({
      success: true,
      message: 'เข้าร่วมงาน Support สำเร็จ (Support task joined successfully)',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
