/**
 * Project Configuration Service (Backend)
 * บริการจัดการ Work Orders และ Categories ประจำโครงการ
 */

import { db } from '../config/firebase';
import { afterSaleDb } from '../config/firebaseProjectB';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../api/middleware/errorHandler';
import { taskService } from './TaskService';

export interface WorkOrderConfig {
  id?: string;
  code: string;
  name: string;
  createdAt?: Date;
  createdBy?: string;
  leaderId?: string | null;
  leaderName?: string | null;
  leaderIds?: string[];
  leaderNames?: string[];
  AssignLD?: string[];
}

export interface CategoryConfig {
  id?: string;
  workOrderCode: string;
  name: string;
  createdAt?: Date;
  createdBy?: string;
}

const PROJECT_COLLECTION = 'Project';

export class ProjectConfigService {

  // --- Work Order Configs ---

  async getWorkOrders(projectId: string): Promise<WorkOrderConfig[]> {
    const snapshot = await db
      .collection(PROJECT_COLLECTION)
      .doc(projectId)
      .collection('workOrderConfigs')
      .orderBy('code', 'asc')
      .get();
      
    const configs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrderConfig));
    return configs.filter(wo => {
      const code = wo.code?.toUpperCase().trim();
      return code !== 'WOA' && code !== 'WOP';
    });
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
      leaderId: data.leaderId || null,
      leaderName: data.leaderName || null,
      leaderIds: data.leaderIds || [],
      leaderNames: data.leaderNames || [],
      AssignLD: data.AssignLD || [],
    };

    await ref.set(payload);
    return { id: codeUpper, ...payload } as any;
  }

  async updateWorkOrder(projectId: string, code: string, data: Partial<WorkOrderConfig>, userId: string): Promise<void> {
    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('workOrderConfigs').doc(code);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('ไม่พบ Work Order ที่ต้องการแก้ไข', 404);

    const updatePayload: any = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    };
    if (data.name) updatePayload.name = data.name.trim();
    if (data.leaderId !== undefined) updatePayload.leaderId = data.leaderId;
    if (data.leaderName !== undefined) updatePayload.leaderName = data.leaderName;
    if (data.leaderIds !== undefined) updatePayload.leaderIds = data.leaderIds;
    if (data.leaderNames !== undefined) updatePayload.leaderNames = data.leaderNames;
    if (data.AssignLD !== undefined) updatePayload.AssignLD = data.AssignLD;

    await ref.update(updatePayload);

    // Cascade update workOrderName and AssignLD in B-database (afterSaleDb)
    if (data.name || data.AssignLD !== undefined) {
      const woSnapshot = await afterSaleDb.collection('workOrders').where('projectId', '==', projectId).get();
      const matchingWoDocs = woSnapshot.docs.filter(d => d.data().workOrderCode === code);
      const batch = afterSaleDb.batch();
      let updateNeeded = false;

      for (const woDoc of matchingWoDocs) {
        const woUpdate: any = {
          updatedAt: new Date(),
          updatedBy: userId,
        };
        if (data.name) {
          woUpdate.workOrderName = data.name.trim();
        }
        if (data.AssignLD !== undefined) {
          woUpdate.AssignLD = data.AssignLD;
        }

        batch.update(woDoc.ref, woUpdate);
        updateNeeded = true;

        if (data.name) {
          const nameTrimmed = data.name.trim();
          const catsSnapshot = await woDoc.ref.collection('categories').get();
          for (const catDoc of catsSnapshot.docs) {
            const tasksSnapshot = await catDoc.ref.collection('tasks').get();
            for (const taskDoc of tasksSnapshot.docs) {
              batch.update(taskDoc.ref, { workOrderName: nameTrimmed, updatedAt: new Date(), updatedBy: userId });
            }
          }
        }
      }

      if (updateNeeded) {
        await batch.commit();
      }
    }
  }

  async deleteWorkOrder(projectId: string, code: string): Promise<void> {
    const ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('workOrderConfigs').doc(code);
    const doc = await ref.get();
    const configExists = doc.exists;

    const woSnapshot = await afterSaleDb
      .collection('workOrders')
      .where('projectId', '==', projectId)
      .get();
      
    const matchingWoDocs = woSnapshot.docs.filter(doc => doc.data().workOrderCode === code);

    if (!configExists && matchingWoDocs.length === 0) {
      throw new AppError('ไม่พบ Work Order ที่ต้องการลบ', 404);
    }

    const tasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const subtasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const nestedDocsToDelete: FirebaseFirestore.DocumentReference[] = [];
    const categoriesToDelete: FirebaseFirestore.DocumentReference[] = [];

    for (const woDoc of matchingWoDocs) {
      const catsSnapshot = await woDoc.ref.collection('categories').get();
      for (const catDoc of catsSnapshot.docs) {
        categoriesToDelete.push(catDoc.ref);
        const tasksSnapshot = await catDoc.ref.collection('tasks').get();
        for (const taskDoc of tasksSnapshot.docs) {
          // Get subtasks under this task
          const subtasksSnapshot = await taskDoc.ref.collection('subtasks').get();
          for (const subtaskDoc of subtasksSnapshot.docs) {
            const subtaskData = subtaskDoc.data();
            
            // Check deletability using taskService
            const isDeletable = await taskService.updateSubtaskDeletability(subtaskDoc.ref, subtaskData.subtaskId || subtaskDoc.id);
            if (!isDeletable) {
              throw new AppError(`ไม่สามารถลบได้ เนื่องจากมีชั่วโมงการทำงาน/OT บันทึกอยู่ หรือเริ่มงานไปแล้วในงานย่อย "${subtaskData.subtaskName}"`, 400);
            }
            
            // Collect nested docs to delete (revisions dailyReports and help dailyReports)
            const revisionsSnap = await subtaskDoc.ref.collection('revisions').get();
            for (const revDoc of revisionsSnap.docs) {
              const reportsSnap = await revDoc.ref.collection('dailyReports').get();
              reportsSnap.docs.forEach(rDoc => nestedDocsToDelete.push(rDoc.ref));
              nestedDocsToDelete.push(revDoc.ref);
            }

            const helpSnap = await subtaskDoc.ref.collection('help').get();
            for (const helpDoc of helpSnap.docs) {
              const reportsSnap = await helpDoc.ref.collection('dailyReports').get();
              reportsSnap.docs.forEach(rDoc => nestedDocsToDelete.push(rDoc.ref));
              nestedDocsToDelete.push(helpDoc.ref);
            }

            subtasksToDelete.push(subtaskDoc.ref);
          }
          
          tasksToDelete.push(taskDoc.ref);
        }
      }
    }

    // Delete allowed: Delete empty subtasks first, then tasks, categories and work orders
    const batch = afterSaleDb.batch();
    nestedDocsToDelete.forEach(ref => batch.delete(ref));
    subtasksToDelete.forEach(ref => batch.delete(ref));
    tasksToDelete.forEach(taskRef => batch.delete(taskRef));
    categoriesToDelete.forEach(catRef => batch.delete(catRef));
    matchingWoDocs.forEach(woDoc => batch.delete(woDoc.ref));
    
    // Check categories under this Work Order in Labor DB
    const laborBatch = db.batch();
    if (configExists) {
      const catsSnapshot = await db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs')
        .where('workOrderCode', '==', code).get();
      
      catsSnapshot.docs.forEach(catDoc => laborBatch.delete(catDoc.ref));
      laborBatch.delete(ref);
    }

    await Promise.all([
      (tasksToDelete.length > 0 || subtasksToDelete.length > 0 || categoriesToDelete.length > 0 || matchingWoDocs.length > 0) ? batch.commit() : Promise.resolve(),
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
    const { ref, doc } = await this.resolveCategoryConfig(projectId, id);
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
    const { ref, doc } = await this.resolveCategoryConfig(projectId, id);
    let catData: { name: string; workOrderCode: string } | null = null;
    let configExists = doc.exists;

    if (configExists) {
      const data = doc.data() as CategoryConfig;
      catData = { name: data.name, workOrderCode: data.workOrderCode };
    } else {
      // Look up in B-database (afterSaleDb) to resolve name and workOrderCode
      const catQuery = await afterSaleDb.collectionGroup('categories').get();
      const matchingCatDoc = catQuery.docs.find(d => d.id === id);
      if (matchingCatDoc) {
        const catName = matchingCatDoc.data()?.catName;
        const woDocRef = matchingCatDoc.ref.parent.parent;
        if (woDocRef) {
          const woSnap = await woDocRef.get();
          const workOrderCode = woSnap.data()?.workOrderCode;
          if (catName && workOrderCode) {
            catData = { name: catName, workOrderCode };
          }
        }
      }
    }

    if (!catData) {
      throw new AppError('ไม่พบ Category ที่ต้องการลบ', 404);
    }

    // Safety check
    const woSnapshot = await afterSaleDb
      .collection('workOrders')
      .where('projectId', '==', projectId)
      .get();
      
    const matchingWoDocs = woSnapshot.docs.filter(doc => doc.data().workOrderCode === catData!.workOrderCode);
    const tasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const subtasksToDelete: FirebaseFirestore.DocumentReference[] = [];
    const nestedDocsToDelete: FirebaseFirestore.DocumentReference[] = [];
    const categoriesToDelete: FirebaseFirestore.DocumentReference[] = [];

    for (const woDoc of matchingWoDocs) {
      const catsSnapshot = await woDoc.ref.collection('categories').get();
      const matchingCatDocs = catsSnapshot.docs.filter(doc => doc.data().catName === catData!.name);
      
      for (const catDoc of matchingCatDocs) {
        const tasksSnapshot = await catDoc.ref.collection('tasks').get();
        for (const taskDoc of tasksSnapshot.docs) {
          // Get subtasks under this task
          const subtasksSnapshot = await taskDoc.ref.collection('subtasks').get();
          for (const subtaskDoc of subtasksSnapshot.docs) {
            const subtaskData = subtaskDoc.data();
            
            // Check deletability using taskService
            const isDeletable = await taskService.updateSubtaskDeletability(subtaskDoc.ref, subtaskData.subtaskId || subtaskDoc.id);
            if (!isDeletable) {
              throw new AppError(`ไม่สามารถลบได้ เนื่องจากมีชั่วโมงการทำงาน/OT บันทึกอยู่ หรือเริ่มงานไปแล้วในงานย่อย "${subtaskData.subtaskName}"`, 400);
            }
            
            // Collect nested docs to delete
            const revisionsSnap = await subtaskDoc.ref.collection('revisions').get();
            for (const revDoc of revisionsSnap.docs) {
              const reportsSnap = await revDoc.ref.collection('dailyReports').get();
              reportsSnap.docs.forEach(rDoc => nestedDocsToDelete.push(rDoc.ref));
              nestedDocsToDelete.push(revDoc.ref);
            }

            const helpSnap = await subtaskDoc.ref.collection('help').get();
            for (const helpDoc of helpSnap.docs) {
              const reportsSnap = await helpDoc.ref.collection('dailyReports').get();
              reportsSnap.docs.forEach(rDoc => nestedDocsToDelete.push(rDoc.ref));
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
      configExists ? ref.delete() : Promise.resolve()
    ]);
  }

  private async resolveCategoryConfig(projectId: string, id: string): Promise<{ ref: FirebaseFirestore.DocumentReference; doc: FirebaseFirestore.DocumentSnapshot }> {
    let ref = db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs').doc(id);
    let doc = await ref.get();

    if (!doc.exists) {
      // Look up category in afterSaleDb categories subcollection (Firebase B)
      const catQuery = await afterSaleDb.collectionGroup('categories').get();
      const matchingCatDoc = catQuery.docs.find(d => d.id === id);
      
      if (matchingCatDoc) {
        const catName = matchingCatDoc.data()?.catName;
        const woDocRef = matchingCatDoc.ref.parent.parent;
        if (woDocRef) {
          const woSnap = await woDocRef.get();
          const workOrderCode = woSnap.data()?.workOrderCode;
          
          if (workOrderCode && catName) {
            const configSnap = await db.collection(PROJECT_COLLECTION).doc(projectId).collection('categoryConfigs')
              .where('workOrderCode', '==', workOrderCode)
              .where('name', '==', catName)
              .limit(1)
              .get();
              
            if (!configSnap.empty) {
              ref = configSnap.docs[0].ref;
              doc = configSnap.docs[0];
            }
          }
        }
      }
    }
    
    return { ref, doc };
  }
}

export const projectConfigService = new ProjectConfigService();
