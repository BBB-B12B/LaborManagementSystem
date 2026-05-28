/**
 * Project Configuration Service (Backend)
 * บริการจัดการ Work Orders และ Categories ประจำโครงการ
 */

import { db } from '../config/firebase';
import { afterSaleDb } from '../config/firebaseProjectB';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../api/middleware/errorHandler';

export interface WorkOrderConfig {
  id?: string;
  code: string;
  name: string;
  createdAt?: Date;
  createdBy?: string;
}

export interface CategoryConfig {
  id?: string;
  workOrderCode: string;
  name: string;
  createdAt?: Date;
  createdBy?: string;
}

const PROJECT_COLLECTION = 'Project';
const TASKS_GROUP = 'tasks';

export class ProjectConfigService {

  // --- Work Order Configs ---

  async getWorkOrders(projectId: string): Promise<WorkOrderConfig[]> {
    const snapshot = await db
      .collection(PROJECT_COLLECTION)
      .doc(projectId)
      .collection('workOrderConfigs')
      .orderBy('code', 'asc')
      .get();
      
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrderConfig));
  }

  async createWorkOrder(projectId: string, data: Omit<WorkOrderConfig, 'id'>, userId: string): Promise<WorkOrderConfig> {
    const codeUpper = data.code.trim().toUpperCase();
    if (!codeUpper) throw new AppError('กรุณาระบุรหัส Work Order', 400);
    if (!data.name.trim()) throw new AppError('กรุณาระบุชื่อ Work Order', 400);

    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('workOrderConfigs').doc(codeUpper);
    const doc = await ref.get();
    if (doc.exists) {
      throw new AppError('รหัส Work Order นี้มีอยู่แล้วในระบบ', 400);
    }

    const payload = {
      code: codeUpper,
      name: data.name.trim(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    await ref.set(payload);
    return { id: codeUpper, ...payload } as any;
  }

  async updateWorkOrder(projectId: string, code: string, data: Partial<WorkOrderConfig>, userId: string): Promise<void> {
    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('workOrderConfigs').doc(code);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('ไม่พบ Work Order ที่ต้องการแก้ไข', 404);

    if (data.name && !data.name.trim()) {
      throw new AppError('ชื่อไม่สามารถเป็นค่าว่างได้', 400);
    }

    await ref.update({
      ...(data.name ? { name: data.name.trim() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    });

    // Cascade update workOrderName in tasks
    if (data.name) {
      const nameTrimmed = data.name.trim();
      const woSnapshot = await afterSaleDb.collection('workOrders').where('projectId', '==', projectId).get();
      const matchingWoDocs = woSnapshot.docs.filter(d => d.data().workOrderCode === code);
      const batch = afterSaleDb.batch();
      let updateNeeded = false;

      for (const woDoc of matchingWoDocs) {
        batch.update(woDoc.ref, { workOrderName: nameTrimmed, updatedAt: new Date(), updatedBy: userId });
        
        const catsSnapshot = await woDoc.ref.collection('categories').get();
        for (const catDoc of catsSnapshot.docs) {
          const tasksSnapshot = await catDoc.ref.collection('tasks').get();
          for (const taskDoc of tasksSnapshot.docs) {
            batch.update(taskDoc.ref, { workOrderName: nameTrimmed, updatedAt: new Date(), updatedBy: userId });
            updateNeeded = true;
          }
        }
      }

      if (updateNeeded || matchingWoDocs.length > 0) {
        await batch.commit();
      }
    }
  }

  async deleteWorkOrder(projectId: string, code: string): Promise<void> {
    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('workOrderConfigs').doc(code);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('ไม่พบ Work Order ที่ต้องการลบ', 404);

    const woSnapshot = await afterSaleDb
      .collection('workOrders')
      .where('projectId', '==', projectId)
      .get();
      
    const matchingWoDocs = woSnapshot.docs.filter(doc => doc.data().workOrderCode === code);
    const tasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const subtasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const nestedDocsToDelete: FirebaseFirestore.DocumentReference[] = [];

    for (const woDoc of matchingWoDocs) {
      const catsSnapshot = await woDoc.ref.collection('categories').get();
      for (const catDoc of catsSnapshot.docs) {
        const tasksSnapshot = await catDoc.ref.collection('tasks').get();
        for (const taskDoc of tasksSnapshot.docs) {
          const taskData = taskDoc.data();
          if ((taskData.dailyProgress || 0) > 0) {
             throw new AppError(`ไม่สามารถลบได้ เนื่องจากมีงานหลักที่เริ่มงานไปแล้ว (Progress > 0)`, 400);
          }
          
          // Get subtasks under this task
          const subtasksSnapshot = await taskDoc.ref.collection('subtasks').get();
          for (const subtaskDoc of subtasksSnapshot.docs) {
            const subtaskData = subtaskDoc.data();
            if ((subtaskData.dailyProgress || 0) > 0) {
              throw new AppError(`ไม่สามารถลบได้ เนื่องจากมีงานย่อย "${subtaskData.subtaskName}" เริ่มงานไปแล้ว`, 400);
            }
            
            // Check dailyReports under subtask revisions
            const revisionsSnap = await subtaskDoc.ref.collection('revisions').get();
            for (const revDoc of revisionsSnap.docs) {
              const reportsSnap = await revDoc.ref.collection('dailyReports').limit(1).get();
              if (!reportsSnap.empty) {
                throw new AppError(`ไม่สามารถลบได้ เนื่องจากงานย่อย "${subtaskData.subtaskName}" ถูกบันทึก Daily Report ไปแล้ว`, 400);
              }
              nestedDocsToDelete.push(revDoc.ref);
            }

            // Check dailyReports under subtask help
            const helpSnap = await subtaskDoc.ref.collection('help').get();
            for (const helpDoc of helpSnap.docs) {
              const reportsSnap = await helpDoc.ref.collection('dailyReports').limit(1).get();
              if (!reportsSnap.empty) {
                throw new AppError(`ไม่สามารถลบได้ เนื่องจากงานย่อย "${subtaskData.subtaskName}" มีรายงานขอความช่วยเหลือไปแล้ว`, 400);
              }
              nestedDocsToDelete.push(helpDoc.ref);
            }

            subtasksToDelete.push(subtaskDoc.ref);
          }
          
          tasksToDelete.push(taskDoc.ref);
        }
      }
    }

    // Delete allowed: Delete empty subtasks first, then tasks
    const batch = afterSaleDb.batch();
    nestedDocsToDelete.forEach(ref => batch.delete(ref));
    subtasksToDelete.forEach(ref => batch.delete(ref));
    tasksToDelete.forEach(taskRef => batch.delete(taskRef));
    matchingWoDocs.forEach(woDoc => batch.delete(woDoc.ref));
    
    // Check categories under this Work Order in Labor DB
    const catsSnapshot = await db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs')
      .where('workOrderCode', '==', code).get();
    
    const laborBatch = db.batch();
    catsSnapshot.docs.forEach(catDoc => laborBatch.delete(catDoc.ref));
    laborBatch.delete(ref);

    await Promise.all([
      tasksToDelete.length > 0 ? batch.commit() : Promise.resolve(),
      laborBatch.commit()
    ]);
  }

  // --- Category Configs ---

  async getCategories(projectId: string, workOrderCode?: string): Promise<CategoryConfig[]> {
    let query: FirebaseFirestore.Query = db
      .collection(PROJECT_COLLECTION)
      .doc(projectId)
      .collection('categoryConfigs');

    if (workOrderCode) {
      query = query.where('workOrderCode', '==', workOrderCode);
    }

    const snapshot = await query.get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryConfig));
    
    // Sort in memory to avoid Firestore composite index requirement
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(projectId: string, data: Omit<CategoryConfig, 'id'>, userId: string): Promise<CategoryConfig> {
    const woCode = data.workOrderCode.trim().toUpperCase();
    const catName = data.name.trim();

    if (!woCode) throw new AppError('กรุณาระบุรหัส Work Order', 400);
    if (!catName) throw new AppError('กรุณาระบุชื่อ Category', 400);

    const woRef = db.collection(PROJECT_COLLECTION).doc(projectId).collection('workOrderConfigs').doc(woCode);
    if (!(await woRef.get()).exists) {
      throw new AppError('ไม่พบ Work Order อ้างอิง', 404);
    }

    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs').doc();
    const payload = {
      workOrderCode: woCode,
      name: catName,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    await ref.set(payload);
    return { id: ref.id, ...payload } as any;
  }

  async updateCategory(projectId: string, id: string, data: Partial<CategoryConfig>, userId: string): Promise<void> {
    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('ไม่พบ Category ที่ต้องการแก้ไข', 404);

    if (data.name && !data.name.trim()) {
      throw new AppError('ชื่อไม่สามารถเป็นค่าว่างได้', 400);
    }

    const oldName = doc.data()?.name;
    const woCode = doc.data()?.workOrderCode;

    await ref.update({
      ...(data.name ? { name: data.name.trim() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    });

    // Cascade update categoryName in tasks
    if (data.name && oldName && woCode) {
      const nameTrimmed = data.name.trim();
      const woSnapshot = await afterSaleDb.collection('workOrders').where('projectId', '==', projectId).get();
      const matchingWoDocs = woSnapshot.docs.filter(d => d.data().workOrderCode === woCode);
      const batch = afterSaleDb.batch();
      let updateNeeded = false;

      for (const woDoc of matchingWoDocs) {
        const catsSnapshot = await woDoc.ref.collection('categories').get();
        const matchingCatDocs = catsSnapshot.docs.filter(d => d.data().catName === oldName);
        for (const catDoc of matchingCatDocs) {
          batch.update(catDoc.ref, { catName: nameTrimmed, updatedAt: new Date(), updatedBy: userId });
          
          const tasksSnapshot = await catDoc.ref.collection('tasks').get();
          for (const taskDoc of tasksSnapshot.docs) {
            batch.update(taskDoc.ref, { categoryName: nameTrimmed, updatedAt: new Date(), updatedBy: userId });
            updateNeeded = true;
          }
        }
      }

      if (updateNeeded || matchingWoDocs.length > 0) {
        await batch.commit();
      }
    }
  }

  async deleteCategory(projectId: string, id: string): Promise<void> {
    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('ไม่พบ Category ที่ต้องการลบ', 404);
    const catData = doc.data() as CategoryConfig;

    // Safety check
    const woSnapshot = await afterSaleDb
      .collection('workOrders')
      .where('projectId', '==', projectId)
      .get();
      
    const matchingWoDocs = woSnapshot.docs.filter(doc => doc.data().workOrderCode === catData.workOrderCode);
    const tasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const subtasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const nestedDocsToDelete: FirebaseFirestore.DocumentReference[] = [];
    const categoriesToDelete: FirebaseFirestore.DocumentReference[] = [];

    for (const woDoc of matchingWoDocs) {
      const catsSnapshot = await woDoc.ref.collection('categories').get();
      const matchingCatDocs = catsSnapshot.docs.filter(doc => doc.data().catName === catData.name);
      
      for (const catDoc of matchingCatDocs) {
        const tasksSnapshot = await catDoc.ref.collection('tasks').get();
        for (const taskDoc of tasksSnapshot.docs) {
          const taskData = taskDoc.data();
          if ((taskData.dailyProgress || 0) > 0) {
             throw new AppError(`ไม่สามารถลบได้ เนื่องจากมีงานหลักที่เริ่มงานไปแล้ว (Progress > 0)`, 400);
          }
          
          // Get subtasks under this task
          const subtasksSnapshot = await taskDoc.ref.collection('subtasks').get();
          for (const subtaskDoc of subtasksSnapshot.docs) {
            const subtaskData = subtaskDoc.data();
            if ((subtaskData.dailyProgress || 0) > 0) {
              throw new AppError(`ไม่สามารถลบได้ เนื่องจากมีงานย่อย "${subtaskData.subtaskName}" เริ่มงานไปแล้ว`, 400);
            }
            
            // Check dailyReports under subtask revisions
            const revisionsSnap = await subtaskDoc.ref.collection('revisions').get();
            for (const revDoc of revisionsSnap.docs) {
              const reportsSnap = await revDoc.ref.collection('dailyReports').limit(1).get();
              if (!reportsSnap.empty) {
                throw new AppError(`ไม่สามารถลบได้ เนื่องจากงานย่อย "${subtaskData.subtaskName}" ถูกบันทึก Daily Report ไปแล้ว`, 400);
              }
              nestedDocsToDelete.push(revDoc.ref);
            }

            // Check dailyReports under subtask help
            const helpSnap = await subtaskDoc.ref.collection('help').get();
            for (const helpDoc of helpSnap.docs) {
              const reportsSnap = await helpDoc.ref.collection('dailyReports').limit(1).get();
              if (!reportsSnap.empty) {
                throw new AppError(`ไม่สามารถลบได้ เนื่องจากงานย่อย "${subtaskData.subtaskName}" มีรายงานขอความช่วยเหลือไปแล้ว`, 400);
              }
              nestedDocsToDelete.push(helpDoc.ref);
            }

            subtasksToDelete.push(subtaskDoc.ref);
          }
          
          tasksToDelete.push(taskDoc.ref);
        }
        categoriesToDelete.push(catDoc.ref);
      }
    }

    const batch = afterSaleDb.batch();
    nestedDocsToDelete.forEach(ref => batch.delete(ref));
    subtasksToDelete.forEach(ref => batch.delete(ref));
    tasksToDelete.forEach(taskRef => batch.delete(taskRef));
    categoriesToDelete.forEach(catRef => batch.delete(catRef));

    await Promise.all([
      (tasksToDelete.length > 0 || subtasksToDelete.length > 0 || categoriesToDelete.length > 0) ? batch.commit() : Promise.resolve(),
      ref.delete()
    ]);
  }
}

export const projectConfigService = new ProjectConfigService();
