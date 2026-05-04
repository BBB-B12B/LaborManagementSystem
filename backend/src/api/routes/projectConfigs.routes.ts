import { Router } from 'express';
import { projectConfigService } from '../../services/ProjectConfigService';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router({ mergeParams: true });

// Require authentication for all config routes
router.use(authenticate);

// --- Work Order Configs ---

router.get('/work-orders', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const data = await projectConfigService.getWorkOrders(projectId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/work-orders', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const user = (req as any).user;
    const data = await projectConfigService.createWorkOrder(projectId, req.body, user.id);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/work-orders/:code', async (req, res, next) => {
  try {
    const { projectId, code } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const user = (req as any).user;
    await projectConfigService.updateWorkOrder(projectId, code, req.body, user.id);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/work-orders/:code', async (req, res, next) => {
  try {
    const { projectId, code } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    await projectConfigService.deleteWorkOrder(projectId, code);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// --- Category Configs ---

router.get('/categories', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { workOrderCode } = req.query;
    if (!projectId) throw new AppError('projectId is required', 400);

    const data = await projectConfigService.getCategories(projectId, workOrderCode as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const user = (req as any).user;
    const data = await projectConfigService.createCategory(projectId, req.body, user.id);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const user = (req as any).user;
    await projectConfigService.updateCategory(projectId, id, req.body, user.id);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    await projectConfigService.deleteCategory(projectId, id);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
