import { db } from '../../config/firebase';
import admin from 'firebase-admin';

class ActivityService {
  async recordLogin(
    userId: string,
    userName: string,
    roleCode: string,
    department: string,
    ipAddress?: string,
  ): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    batch.set(db.collection('activityLogs').doc(), {
      userId,
      userName,
      roleCode,
      department,
      action: 'login',
      timestamp: now,
      ipAddress: ipAddress || null,
    });

    batch.set(db.collection('presence').doc(userId), {
      userId,
      name: userName,
      roleCode,
      department,
      isOnline: true,
      lastSeen: now,
      loginAt: now,
    });

    await batch.commit();
  }

  async recordLogout(userId: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const presenceRef = db.collection('presence').doc(userId);
    const presenceDoc = await presenceRef.get();
    const presence = presenceDoc.data();

    const batch = db.batch();

    batch.set(db.collection('activityLogs').doc(), {
      userId,
      userName: presence?.name || userId,
      roleCode: presence?.roleCode || '',
      department: presence?.department || '',
      action: 'logout',
      timestamp: now,
    });

    if (presenceDoc.exists) {
      batch.update(presenceRef, { isOnline: false, lastSeen: now });
    }

    await batch.commit();
  }

  async updateHeartbeat(userId: string): Promise<void> {
    const ref = db.collection('presence').doc(userId);
    const doc = await ref.get();
    if (doc.exists) {
      await ref.update({
        lastSeen: admin.firestore.Timestamp.now(),
        isOnline: true,
      });
    }
  }

  /** ดึง users ที่ isOnline=true และ lastSeen ภายใน 3 นาที */
  async getPresence(): Promise<any[]> {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const snapshot = await db.collection('presence').get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => {
        if (!p.isOnline) return false;
        const lastSeen = p.lastSeen?.toDate?.();
        return lastSeen && lastSeen >= threeMinutesAgo;
      })
      .map((p: any) => ({
        ...p,
        lastSeen: p.lastSeen?.toDate?.()?.toISOString?.() ?? null,
        loginAt: p.loginAt?.toDate?.()?.toISOString?.() ?? null,
      }));
  }

  /** ดึง login/logout history ล่าสุด */
  async getActivityLogs(limitCount = 200): Promise<any[]> {
    const snapshot = await db
      .collection('activityLogs')
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString?.() ?? null,
    }));
  }
}

export const activityService = new ActivityService();
