import { Router, Request, Response, NextFunction } from 'express';
import { taskService } from '../../services/TaskService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

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
    const { title, projectId, assignees, dueDate, status } = req.body;
    
    if (!title || !projectId || !assignees || !assignees.length || !dueDate) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (Title, ProjectId, Assignees, DueDate are required)', 400);
    }

    const validatedData = {
      title,
      description: req.body.description,
      projectId,
      assignees,
      dueDate: new Date(dueDate),
      status,
    };

    const userId = req.user?.uid || 'system';

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
    const userId = req.user?.uid || 'system';

    if (!['upcoming', 'in-progress', 'completed'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    await taskService.updateTaskStatus(id, status, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
