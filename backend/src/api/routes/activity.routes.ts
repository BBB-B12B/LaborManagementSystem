import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { activityService } from '../../services/activity/ActivityService';

const router = Router();

router.use(authenticate);

// POST /api/activity/heartbeat — อัปเดต lastSeen (ทุก 60 วินาที จาก frontend)
router.post('/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    await activityService.updateHeartbeat(user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity/presence — ใครออนไลน์อยู่ตอนนี้ (GOD only)
router.get('/presence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user || (user.roleCode as string) !== 'GOD') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const data = await activityService.getPresence();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity — login/logout history (GOD only)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user || (user.roleCode as string) !== 'GOD') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const dateFilter = req.query.dateFilter as string || 'today';
    const data = await activityService.getActivityLogs(dateFilter);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
