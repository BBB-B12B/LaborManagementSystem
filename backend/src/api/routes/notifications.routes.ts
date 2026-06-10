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
    const userProjectIds = authReq.user?.projectLocationIds || [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await afterSaleDb
      .collection('notifications')
      .where('createdAt', '>=', sevenDaysAgo)
      .orderBy('createdAt', 'desc')
      .get();

    let notifications = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt
          ? data.createdAt.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date(data.createdAt).toISOString()
          : '',
      };
    });

    // -------------------------------------------
    // Role-based scoping:
    //   FM → only see 'unlock_granted' targeted at their own uid
    //   AM/WH/GOD/etc. → only see 'daily_report_submit' for projects they manage
    // -------------------------------------------
    if ((userRole as string) === 'FM') {
      notifications = notifications.filter(
        (n: any) => n.type === 'unlock_granted' && n.targetUserId === userUid
      );
    } else if ((userRole as string) !== 'GOD') {
      notifications = notifications.filter((n: any) => {
        if (n.type !== 'daily_report_submit') return false;

        // Allow WH department to see all support notifications
        if (n.isSupportReport === true && authReq.user?.department === 'WH') {
          return true;
        }

        return userProjectIds.includes(n.projectId);
      });
    }
    // GOD: sees everything (no additional filter)

    res.status(200).json({
      success: true,
      data: notifications,
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

    const notiRef = afterSaleDb.collection('notifications').doc(id);
    const notiDoc = await notiRef.get();

    if (!notiDoc.exists) {
      throw new AppError('ไม่พบการแจ้งเตือน', 404);
    }

    await notiRef.update({
      readBy: admin.firestore.FieldValue.arrayUnion(userId),
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
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

    const snapshot = await afterSaleDb
      .collection('notifications')
      .where('createdAt', '>=', sevenDaysAgo)
      .get();

    const batch = afterSaleDb.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const belongsToProject =
        (userRole as string) === 'GOD' ||
        userProjectIds.includes(data.projectId) ||
        (data.isSupportReport === true && authReq.user?.department === 'WH');
      const alreadyRead = Array.isArray(data.readBy) && data.readBy.includes(userId);

      if (belongsToProject && !alreadyRead) {
        batch.update(doc.ref, {
          readBy: admin.firestore.FieldValue.arrayUnion(userId),
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    res.status(200).json({
      success: true,
      message: `Marked ${count} notifications as read`,
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

    const snapshot = await afterSaleDb
      .collection('notifications')
      .where('subtaskId', '==', targetSubtaskId)
      .get();

    const batch = afterSaleDb.batch();
    let count = 0;

    const filteredDocs = snapshot.docs.filter((doc) => {
      const data = doc.data();
      if (!data.createdAt) return false;
      const cDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      return cDate >= sevenDaysAgo;
    });

    filteredDocs.forEach((doc) => {
      const data = doc.data();
      const alreadyRead = Array.isArray(data.readBy) && data.readBy.includes(userId);

      if (!alreadyRead) {
        batch.update(doc.ref, {
          readBy: admin.firestore.FieldValue.arrayUnion(userId),
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    res.status(200).json({
      success: true,
      message: `Marked ${count} subtask notifications as read`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
