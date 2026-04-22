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
    const { taskName, projectId, workOrderId, workOrderCode, categoryId, categoryName, assignees, dueDate, status } = req.body;
    
    if (!taskName || !projectId || !workOrderCode || !categoryName || !assignees || !assignees.length || !dueDate) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (TaskName, ProjectId, WorkOrderCode, CategoryName, Assignees, DueDate are required)', 400);
    }

    const validatedData = {
      taskName,
      description: req.body.description,
      projectId,
      workOrderId,
      workOrderCode,
      categoryId,
      categoryName,
      assignees,
      dueDate: new Date(dueDate),
      status,
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
    await taskService.submitDailyReport(id, reportData, userId);

    res.status(201).json({
      success: true,
      message: 'Daily report submitted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/reports/:date
router.get('/:id/reports/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, date } = req.params;
    const report = await taskService.getDailyReport(id, date);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
