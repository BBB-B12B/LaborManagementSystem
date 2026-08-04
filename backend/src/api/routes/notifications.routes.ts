import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { afterSaleDb } from '../../config/firebaseProjectB';
import { AppError } from '../middleware/errorHandler';
import admin from 'firebase-admin';

const router = Router();

// Apply authentication middleware
router.use(authenticate);

// GET /api/notifications
// ดึงการแจ้งเตือนงานย้อนหลัง 7 วัน สำหรับโครงการที่สังกัด
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const userRole = authReq.user?.roleCode;
    const userUid = authReq.user?.uid;
    const userId = authReq.user?.id;
    const userProjectIds = authReq.user?.projectLocationIds || [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await afterSaleDb.collection('lms_notifications')
      .where('createdAt', '>=', sevenDaysAgo)
      .orderBy('createdAt', 'desc')
      .get();

    let notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString()) : ''
      };
    });

    // -------------------------------------------
    // Role-based scoping:
    //   FM/SE → see 'unlock_granted' and 'task_assigned' targeted at their own uid
    //   LD/OE/PE/PM → see 'unlock_requested' targeted at their own uid, plus project-based types
    //   AM/WH/GOD/etc. → see 'daily_report_submit', 'management_submit', 'unlock_request' for projects they manage
    //                   and 'task_assigned' targeted at their own uid
    // -------------------------------------------
    const FM_ROLES = ['FM', 'SE'];
    if (FM_ROLES.includes(userRole as string)) {
      notifications = notifications.filter((n: any) =>
        (n.type === 'unlock_granted' || n.type === 'task_assigned') &&
        (n.targetUserId === userUid || n.targetUserId === userId)
      );
    } else if ((userRole as string) !== 'GOD') {
      notifications = notifications.filter((n: any) => {
        if (n.type === 'task_assigned') {
          return n.targetUserId === userUid || n.targetUserId === userId;
        }

        // unlock_requested: each supervisor sees only their own targeted doc
        if (n.type === 'unlock_requested') {
          return n.targetUserId === userUid || n.targetUserId === userId;
        }

        if (['daily_report_submit', 'management_submit', 'unlock_request'].includes(n.type)) {
          // Allow WH department to see all support notifications
          if (n.isSupportReport === true && authReq.user?.department === 'WH') {
            return true;
          }

          if (n.projectId && userProjectIds.includes(n.projectId)) {
            return true;
          }

          if (Array.isArray(n.projectIds) && n.projectIds.some((pId: string) => userProjectIds.includes(pId))) {
            return true;
          }
        }

        return false;
      });
    }
    // GOD: sees everything (no additional filter)

    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/:id/read
// ทำเครื่องหมายแจ้งเตือนว่าอ่านแล้ว
router.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const userId = authReq.user?.uid;

    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    const notiRef = afterSaleDb.collection('lms_notifications').doc(id);
    const notiDoc = await notiRef.get();

    if (!notiDoc.exists) {
      throw new AppError('ไม่พบการแจ้งเตือน', 404);
    }

    await notiRef.update({
      readBy: admin.firestore.FieldValue.arrayUnion(userId)
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/read-all
// ทำเครื่องหมายการแจ้งเตือนทั้งหมดว่าอ่านแล้ว
router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.uid;
    const userRole = authReq.user?.roleCode;
    const userProjectIds = authReq.user?.projectLocationIds || [];

    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await afterSaleDb.collection('lms_notifications')
      .where('createdAt', '>=', sevenDaysAgo)
      .get();

    const batch = afterSaleDb.batch();
    let count = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const belongsToProject = (userRole as string) === 'GOD' || 
                               userProjectIds.includes(data.projectId) ||
                               (data.isSupportReport === true && authReq.user?.department === 'WH');
      const alreadyRead = Array.isArray(data.readBy) && data.readBy.includes(userId);

      if (belongsToProject && !alreadyRead) {
        batch.update(doc.ref, {
          readBy: admin.firestore.FieldValue.arrayUnion(userId)
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    res.status(200).json({
      success: true,
      message: `Marked ${count} notifications as read`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/subtask/:subtaskId/read
// ทำเครื่องหมายการแจ้งเตือนทั้งหมดของงานย่อยที่เลือกว่าอ่านแล้ว
router.post('/subtask/:subtaskId/read', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const { subtaskId } = req.params;
    const userId = authReq.user?.uid;

    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    // Parse raw subtask document ID out of the composite ID if necessary
    let targetSubtaskId = subtaskId;
    if (subtaskId.includes('__')) {
      const parts = subtaskId.split('__');
      targetSubtaskId = parts[parts.length - 1];
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await afterSaleDb.collection('lms_notifications')
      .where('subtaskId', '==', targetSubtaskId)
      .get();

    const batch = afterSaleDb.batch();
    let count = 0;

    const filteredDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (!data.createdAt) return false;
      const cDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      return cDate >= sevenDaysAgo;
    });

    filteredDocs.forEach(doc => {
      const data = doc.data();
      const alreadyRead = Array.isArray(data.readBy) && data.readBy.includes(userId);

      if (!alreadyRead) {
        batch.update(doc.ref, {
          readBy: admin.firestore.FieldValue.arrayUnion(userId)
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    res.status(200).json({
      success: true,
      message: `Marked ${count} subtask notifications as read`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
