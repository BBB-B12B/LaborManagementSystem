/**
 * Portal User Service
 * ไปยังคอลเลกชัน Firestore `User` (ตัว U ใหญ่) สำหรับข้อมูลล็อกอินแบบ legacy
 */

import { db } from '../../config/firebase';
import { AuthResponse } from './AuthService';

export interface PortalUserDoc {
  Employeeid?: string;
  Fullname?: string;
  Fullnameen?: string;
  Password?: string;
  Role?: string;
  Username?: string;
  UsernameLower?: string;
  [key: string]: unknown;
}

interface PortalUserRecord {
  id: string;
  data: PortalUserDoc;
}

class PortalUserService {
  private collection = db.collection('User');

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  /**
   * ค้นหาผู้ใช้ตามชื่อผู้ใช้แบบไม่สนตัวพิมพ์เล็กใหญ่
   */
  async findByUsernameInsensitive(username: string): Promise<PortalUserRecord | null> {
    const normalized = this.normalizeUsername(username);

    // ลองค้นหาโดยใช้ฟิลด์ normalized ก่อน
    let snapshot = await this.collection
      .where('UsernameLower', '==', normalized)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data() as PortalUserDoc;
      await this.ensureNormalizedField(doc.id, data);
      return { id: doc.id, data };
    }

    // สำรอง: ค้นหาแบบเดิมที่ยังไม่มี UsernameLower
    snapshot = await this.collection.where('Username', '==', username).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data() as PortalUserDoc;
      if (
        typeof data.Username === 'string' &&
        this.normalizeUsername(data.Username) === normalized
      ) {
        await this.ensureNormalizedField(doc.id, data);
        return { id: doc.id, data };
      }
    }

    // สำรองสุดท้าย: ดึงเอกสารทั้งหมดที่ Username ตรงตามสระผสม (จำนวนผู้ใช้ไม่น่ามาก)
    const manualSnapshot = await this.collection
      .where('Username', '>=', username)
      .where('Username', '<=', username + '\uf8ff')
      .limit(10)
      .get()
      .catch(() => null);

    if (manualSnapshot && !manualSnapshot.empty) {
      for (const doc of manualSnapshot.docs) {
        const data = doc.data() as PortalUserDoc;
        if (
          typeof data.Username === 'string' &&
          this.normalizeUsername(data.Username) === normalized
        ) {
          await this.ensureNormalizedField(doc.id, data);
          return { id: doc.id, data };
        }
      }
    }

    return null;
  }

  /**
   * บังคับให้มีฟิลด์ UsernameLower เพื่อรองรับการค้นหาในอนาคต
   */
  private async ensureNormalizedField(docId: string, data: PortalUserDoc): Promise<void> {
    const username = data.Username;
    const storedLower = data.UsernameLower;
    if (typeof username !== 'string') {
      return;
    }

    const normalized = this.normalizeUsername(username);
    if (storedLower === normalized) {
      return;
    }

    try {
      await this.collection.doc(docId).set({ UsernameLower: normalized }, { merge: true });
    } catch (error) {
      console.warn('[PortalUserService] Failed to update UsernameLower:', error);
    }
  }

  /**
   * ตรวจสอบรหัสผ่านแบบตัวอักษรตรง ๆ (legacy)
   */
  verifyPassword(user: PortalUserDoc, password: string): boolean {
    return (user.Password || '') === password;
  }

  /**
   * แปลงข้อมูลผู้ใช้เป็น AuthResponse
   */
  toAuthResponse(record: PortalUserRecord): AuthResponse {
    const data = record.data;
    const fullName = (data.Fullname || '').toString();

    return {
      user: {
        id: record.id,
        employeeId: (data.Employeeid || '').toString(),
        username: (data.Username || '').toString(),
        name: fullName || (data.Fullnameen || '').toString(),
        fullNameEn: (data.Fullnameen || '').toString(),
        roleId: (data.Role || '').toString(),
        roleCode: (data.Role || '').toString(),
        department: '',
        projectLocationIds: [],
        isActive: true,
      },
      token: 'mock-token',
    };
  }
}

export const portalUserService = new PortalUserService();
