import { Router, Request, Response, NextFunction } from 'express';
import { projectConfigService } from '../../services/ProjectConfigService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { db } from '../../config/firebase';

const router = Router({ mergeParams: true });

// Require authentication for all config routes
router.use(authenticate);

async function validateLeaderAccess(userId: string, projectId: string, workOrderCode: string): Promise<boolean> {
  if (!projectId || !workOrderCode) return false;
  const doc = await db
    .collection('Project')
    .doc(projectId)
    .collection('workOrderConfigs')
    .doc(workOrderCode.trim().toUpperCase())
    .get();
  
  if (!doc.exists) return false;
  const data = doc.data();
  if (!data) return false;
  return data.leaderId === userId || 
         (data.leaderIds && Array.isArray(data.leaderIds) && data.leaderIds.includes(userId)) ||
         (data.AssignLD && Array.isArray(data.AssignLD) && data.AssignLD.includes(userId));
}

async function checkCategoryLeaderAccess(userId: string, projectId: string, categoryId: string): Promise<void> {
  const catDoc = await db
    .collection('Project')
    .doc(projectId)
    .collection('categoryConfigs')
    .doc(categoryId)
    .get();
  
  if (!catDoc.exists) {
    throw new AppError('ไม่พบหมวดหมู่ย่อยที่ต้องการเข้าถึง', 404);
  }

  const workOrderCode = catDoc.data()?.workOrderCode;
  const isAssigned = await validateLeaderAccess(userId, projectId, workOrderCode);
  if (!isAssigned) {
    throw new AppError('คุณไม่มีสิทธิ์เข้าถึงหรือจัดการหมวดหมู่ย่อยในหมวดงานนี้ (Access denied for this Work Order)', 403);
  }
}

// --- Work Order Configs ---

router.get('/work-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;
    let data = await projectConfigService.getWorkOrders(projectId);

    if (userRole === 'LD' && authReq.user) {
      data = data.filter(wo => 
        wo.leaderId === authReq.user!.id || 
        (wo.leaderIds && Array.isArray(wo.leaderIds) && wo.leaderIds.includes(authReq.user!.id)) ||
        (wo.AssignLD && Array.isArray(wo.AssignLD) && wo.AssignLD.includes(authReq.user!.id))
      );
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/work-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;
    if (userRole === 'LD') {
      throw new AppError('คุณไม่มีสิทธิ์สร้างหมวดงานหลัก (Only Admin/PM/Engineers can manage Work Orders)', 403);
    }

    const data = await projectConfigService.createWorkOrder(projectId, req.body, authReq.user?.id || 'system');
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/work-orders/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, code } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;
    if (userRole === 'LD') {
      throw new AppError('คุณไม่มีสิทธิ์แก้ไขหมวดงานหลัก (Only Admin/PM/Engineers can manage Work Orders)', 403);
    }

    await projectConfigService.updateWorkOrder(projectId, code, req.body, authReq.user?.id || 'system');
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/work-orders/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, code } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;
    if (userRole === 'LD') {
      throw new AppError('คุณไม่มีสิทธิ์ลบหมวดงานหลัก (Only Admin/PM/Engineers can manage Work Orders)', 403);
    }

    await projectConfigService.deleteWorkOrder(projectId, code);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// --- Category Configs ---

router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { workOrderCode } = req.query;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;

    if (userRole === 'LD' && authReq.user) {
      // Leader can only see categories under their assigned work orders
      const workOrders = await projectConfigService.getWorkOrders(projectId);
      const leaderWoCodes = workOrders
        .filter(wo => 
          wo.leaderId === authReq.user!.id || 
          (wo.leaderIds && Array.isArray(wo.leaderIds) && wo.leaderIds.includes(authReq.user!.id)) ||
          (wo.AssignLD && Array.isArray(wo.AssignLD) && wo.AssignLD.includes(authReq.user!.id))
        )
        .map(wo => wo.code.toUpperCase());

      if (workOrderCode) {
        if (!leaderWoCodes.includes((workOrderCode as string).toUpperCase())) {
          res.json({ success: true, data: [] });
          return;
        }
      } else {
        let data = await projectConfigService.getCategories(projectId);
        data = data.filter(cat => leaderWoCodes.includes(cat.workOrderCode.toUpperCase()));
        res.json({ success: true, data });
        return;
      }
    }

    const data = await projectConfigService.getCategories(projectId, workOrderCode as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;

    if (userRole === 'LD' && authReq.user) {
      const { workOrderCode } = req.body;
      if (!workOrderCode) throw new AppError('workOrderCode is required', 400);
      const isAssigned = await validateLeaderAccess(authReq.user.id, projectId, workOrderCode);
      if (!isAssigned) {
        throw new AppError('คุณไม่มีสิทธิ์สร้างหมวดหมู่ย่อยในหมวดงานนี้ (Access denied for this Work Order)', 403);
      }
    }

    const data = await projectConfigService.createCategory(projectId, req.body, authReq.user?.id || 'system');
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, id } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;

    if (userRole === 'LD' && authReq.user) {
      await checkCategoryLeaderAccess(authReq.user.id, projectId, id);
    }

    await projectConfigService.updateCategory(projectId, id, req.body, authReq.user?.id || 'system');
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, id } = req.params;
    if (!projectId) throw new AppError('projectId is required', 400);

    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;

    if (userRole === 'LD' && authReq.user) {
      await checkCategoryLeaderAccess(authReq.user.id, projectId, id);
    }

    await projectConfigService.deleteCategory(projectId, id);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
