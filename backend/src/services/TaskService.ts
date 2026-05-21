import { db } from '../config/firebase';
import admin from 'firebase-admin';
import { afterSaleDb } from '../config/firebaseProjectB';
import { Task, CreateTaskInput, UpdateTaskInput, taskConverter } from '../models/Task';
import { AppError } from '../api/middleware/errorHandler';
import axios from 'axios';

const WORK_ORDERS_COLLECTION = 'workOrders';
const PROJECTS_COLLECTION = 'Project';

export class TaskService {
  /**
   * สร้าง Task ใหม่ พร้อม Running Number (เช่น WH-2026-0001)
   */
  async createTask(input: CreateTaskInput, createdBy: string): Promise<Task> {
    const projectRef = db.collection(PROJECTS_COLLECTION).doc(input.projectId);

    // --- 1. READ Project OUTSIDE TRANSACTION ---
    // (Because Project is in Labor DB, and we cannot run cross-project transactions)
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      throw new AppError('ไม่พบโครงการที่ระบุ', 404);
    }
    const projectData = projectDoc.data();
    const projectCode = projectData?.projectCode || projectData?.code || 'XX';
    const projectName = projectData?.name || projectData?.projectName || 'Unknown Project';

    return await afterSaleDb.runTransaction(async (transaction) => {
      // --- 2. ALL READS IN AFTER-SALE DB ---
      
      // 2.1 ระดับ WorkOrder: Query หาซ้ำ
      const woQuery = await transaction.get(
        afterSaleDb.collection(WORK_ORDERS_COLLECTION)
          .where('projectId', '==', input.projectId)
          .where('workOrderCode', '==', input.workOrderCode || 'GEN')
          .limit(1)
      );

      let woId = '';
      let isNewWo = false;
      let woNextRun = 1;
      const currentYear = new Date().getFullYear();
      const woCounterId = `wo_counter_${projectCode}_${input.workOrderCode || 'GEN'}_${currentYear}`;
      const woCounterRef = afterSaleDb.collection('system_counters').doc(woCounterId);

      if (!woQuery.empty) {
        woId = woQuery.docs[0].id;
      } else {
        isNewWo = true;
        const woCounterDoc = await transaction.get(woCounterRef);
        if (woCounterDoc.exists) {
          woNextRun = (woCounterDoc.data()?.count || 0) + 1;
        }
        woId = `${projectCode}-${currentYear}-${input.workOrderCode || 'GEN'}-${woNextRun.toString().padStart(4, '0')}`;
      }
      const workOrderRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId);

      // 1.3 ระดับ Category: Query หาซ้ำตามชื่อ
      const catQuery = await transaction.get(
        workOrderRef.collection('categories')
          .where('catName', '==', input.categoryName || 'General')
          .limit(1)
      );

      let catId = '';
      let isNewCat = false;
      let catNextRun = 1;
      const catCounterId = `cat_counter_${woId}`;
      const catCounterRef = afterSaleDb.collection('system_counters').doc(catCounterId);

      if (!catQuery.empty) {
        catId = catQuery.docs[0].id;
      } else {
        isNewCat = true;
        const catCounterDoc = await transaction.get(catCounterRef);
        if (catCounterDoc.exists) {
          catNextRun = (catCounterDoc.data()?.count || 0) + 1;
        }
        const woCode = input.workOrderCode || 'GEN';
        catId = `${woCode}-${catNextRun.toString().padStart(4, '0')}`;
      }
      const categoryRef = workOrderRef.collection('categories').doc(catId);

      // 1.4 ระดับ Task: Query หาซ้ำตามชื่อ
      const taskQuery = await transaction.get(
        categoryRef.collection('tasks')
          .where('taskName', '==', input.taskName)
          .limit(1)
      );

      let taskId = '';
      let isNewTask = false;
      let existingTaskData: any = null;
      let taskNextRun = 1;
      const taskCounterId = `task_${woId}`;
      const taskCounterRef = afterSaleDb.collection('system_counters').doc(taskCounterId);

      if (!taskQuery.empty) {
        taskId = taskQuery.docs[0].id;
        existingTaskData = taskQuery.docs[0].data();
      } else {
        isNewTask = true;
        const taskCounterDoc = await transaction.get(taskCounterRef);
        if (taskCounterDoc.exists) {
          taskNextRun = (taskCounterDoc.data()?.count || 0) + 1;
        }
        taskId = `${catId}-${taskNextRun.toString().padStart(7, '0')}`;
      }
      const taskRef = categoryRef.collection('tasks').doc(taskId);

      // --- 2. ALL WRITES ---
      const now = new Date();
      let createdAtDate = now;
      if (!isNewTask && existingTaskData?.createdAt) {
         createdAtDate = existingTaskData.createdAt.toDate ? existingTaskData.createdAt.toDate() : existingTaskData.createdAt;
      }

      // Write Counters if needed
      if (isNewWo) {
        transaction.set(woCounterRef, { count: woNextRun, updatedAt: now }, { merge: true });
      }
      if (isNewCat) {
        transaction.set(catCounterRef, { count: catNextRun, updatedAt: now }, { merge: true });
      }
      if (isNewTask) {
        transaction.set(taskCounterRef, { count: taskNextRun, updatedAt: now }, { merge: true });
      }

      transaction.set(workOrderRef, {
        workOrderId: woId,
        projectId: input.projectId,
        workOrderCode: input.workOrderCode || 'GEN',
        workOrderName: input.workOrderName || 'General',
        updatedAt: now
      }, { merge: true });

      transaction.set(categoryRef, {
        catId,
        catName: input.categoryName || 'General',
        updatedAt: now
      }, { merge: true });

      const newTaskData: Omit<Task, 'id'> = {
        taskId: taskId,
        taskName: input.taskName,
        description: input.description,
        projectId: input.projectId,
        projectCode: projectCode,
        projectName: projectName,
        workOrderId: woId,
        workOrderCode: input.workOrderCode || 'GEN',
        workOrderName: input.workOrderName || 'General',
        categoryId: catId,
        categoryName: input.categoryName || 'General',
        assignees: input.assignees,
        dueDate: input.dueDate,
        status: input.status || 'upcoming',
        currentRevision: isNewTask ? 'rev00' : (existingTaskData?.currentRevision || 'rev00'),
        revisionId: isNewTask ? 'rev00' : (existingTaskData?.revisionId || 'rev00'),
        revisionName: isNewTask ? input.taskName : (existingTaskData?.revisionName || input.taskName),
        dailyProgress: isNewTask ? 0 : (existingTaskData?.dailyProgress || 0),
        attachmentsCount: isNewTask ? 0 : (existingTaskData?.attachmentsCount || 0),
        isActive: true,
        isSupportRequest: input.isSupportRequest || false,
        createdAt: createdAtDate,
        updatedAt: now,
        createdBy: isNewTask ? createdBy : (existingTaskData?.createdBy || createdBy),
        updatedBy: createdBy,
        supportedRevisionIds: [],
        historicalAssigneeIds: Array.from(new Set([
          ...(existingTaskData?.historicalAssigneeIds || []),
          ...input.assignees.map(a => a.employeeId),
          createdBy
        ]))
      };

      transaction.set(taskRef.withConverter(taskConverter), newTaskData as any, { merge: true });

      // [NEW] สร้าง Document `rev00` ใน `revisions` subcollection เฉพาะสำหรับงานใหม่ หรือยังไม่มี rev00
      if (isNewTask) {
        const rev00Ref = taskRef.collection('revisions').doc('rev00');
        transaction.set(rev00Ref, {
          revisionId: 'rev00',
          revisionName: input.taskName,
          taskName: input.taskName,
          assignees: input.assignees,
          createdAt: createdAtDate,
          createdBy: createdBy,
        });
      }

      return {
        id: `${woId}__${catId}__${taskId}`,
        ...newTaskData,
      };
    });
  }

  /**
   * Reject งานที่เสร็จแล้ว (ตีกลับงาน)
   * สร้าง Revision ใหม่ รีเซ็ต dailyProgress กลับเป็น 0 และนำ Assignees ใหม่ไปสะสมรวมใน Task หลัก
   */
  async rejectTask(id: string, revisionName: string, newAssignees: any[], updatedBy: string): Promise<void> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length === 3) {
        const [woId, catId, docId] = parts;
        taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(docId);
      } else {
        // Fallback: search by taskId field if parts are unusual
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', parts[parts.length - 1]).limit(1).get();
        if (querySnapshot.empty) throw new AppError('Task not found by taskId fallback', 404);
        taskRef = querySnapshot.docs[0].ref;
      }
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found by taskId field', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    await afterSaleDb.runTransaction(async (transaction) => {
      // 1. อ่านข้อมูล Task ปัจจุบัน
      const doc = await transaction.get(taskRef);
      if (!doc.exists) throw new AppError('Task not found', 404);
      const taskData = doc.data() as Task;

      // 2. คำนวณ Revision ใหม่
      const currentRev = taskData.currentRevision || 'rev00';
      const revNum = parseInt(currentRev.replace('rev', ''), 10);
      const nextRevId = `rev${String(revNum + 1).padStart(2, '0')}`;

      // 3. สะสม (Union) Assignees
      // นำ Assignees ใหม่ มาต่อท้าย Assignees เก่า โดยไม่ให้ซ้ำคนเดิม (อิงจาก employeeId)
      const existingAssignees = taskData.assignees || [];
      const mergedAssignees = [...existingAssignees];
      for (const newAssignee of newAssignees) {
        if (!mergedAssignees.find(a => a.employeeId === newAssignee.employeeId)) {
          mergedAssignees.push(newAssignee);
        }
      }

      const now = new Date();

      // 4. อัปเดต Task หลัก
      const taskUpdates = {
        currentRevision: nextRevId,
        revisionId: nextRevId,
        revisionName: revisionName,
        status: 'upcoming' as any,
        dailyProgress: 0,
        assignees: mergedAssignees,
        isSupportRequest: false,
        isPickedUpBySupport: false,
        supportTaskName: null,
        supportDailyProgress: 0,
        supportAssignees: [],
        updatedAt: now,
        updatedBy: updatedBy,
        revisionCreatedAt: now, // [NEW] Track when the revision was created
        historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...newAssignees.map(a => a.employeeId), updatedBy) as any
      };
      transaction.update(taskRef, taskUpdates);

      // 5. สร้างเอกสาร Revision ใหม่
      const nextRevRef = taskRef.collection('revisions').doc(nextRevId);
      transaction.set(nextRevRef, {
        revisionId: nextRevId,
        revisionName: revisionName,
        taskName: taskData.taskName,
        assignees: newAssignees, // เฉพาะคนที่รับผิดชอบในรอบนี้
        createdAt: now,
        createdBy: updatedBy,
      });

      // 6. เก็บ Audit Trail
      await this.recordHistory(taskRef, 'reject_task', taskData, taskUpdates, updatedBy);
    });
  }

  /**
   * Approve งานที่ For Checking
   * เปลี่ยนสถานะเป็น completed
   */
  async approveTask(id: string, updatedBy: string): Promise<void> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length === 3) {
        const [woId, catId, docId] = parts;
        taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(docId);
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', parts[parts.length - 1]).limit(1).get();
        if (querySnapshot.empty) throw new AppError('Task not found by taskId fallback', 404);
        taskRef = querySnapshot.docs[0].ref;
      }
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found by taskId field', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    await afterSaleDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(taskRef);
      if (!doc.exists) throw new AppError('Task not found', 404);
      
      const now = new Date();
      const taskUpdates = {
        status: 'completed' as any,
        updatedAt: now,
        updatedBy: updatedBy,
      };
      
      transaction.update(taskRef, taskUpdates);
      
      // เก็บ Audit Trail
      await this.recordHistory(taskRef, 'approve_task', doc.data(), taskUpdates, updatedBy);
    });
  }

  /**
   * ทีม Support เข้าร่วม Task เดิมของ Site
   * - สะสม Assignee ใน Task หลัก
   * - สร้าง collection `held` และ document `held00`
   */
  async joinSupportTask(id: string, supportTaskName: string, supportAssignees: any[], updatedBy: string): Promise<void> {
    console.log(`[TaskService] joinSupportTask called for id: ${id}`);
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
      console.log(`[TaskService] Resolved taskRef using composite ID: ${taskRef.path}`);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) {
        console.log(`[TaskService] Task not found by taskId: ${id}`);
        throw new AppError('Task not found by taskId', 404);
      }
      taskRef = querySnapshot.docs[0].ref;
      console.log(`[TaskService] Resolved taskRef using query: ${taskRef.path}`);
    }

    try {
      await afterSaleDb.runTransaction(async (transaction) => {
        console.log(`[TaskService] Starting transaction for ${taskRef.path}`);
        // 1. อ่านข้อมูล Task ปัจจุบัน
        const doc = await transaction.get(taskRef);
        console.log(`[TaskService] Fetched task doc, exists: ${doc.exists}`);
        if (!doc.exists) throw new AppError('Task not found', 404);
      const taskData = doc.data() as Task;

      if (taskData.isPickedUpBySupport) {
        throw new AppError('Task นี้มีทีม Support รับไปแล้ว', 400);
      }

      // 2. อ่านข้อมูล rev00 เพื่อคัดลอก Field
      const rev00Ref = taskRef.collection('revisions').doc('rev00');
      const rev00Doc = await transaction.get(rev00Ref);
      const rev00Data = rev00Doc.exists ? rev00Doc.data() : {};

      // 4. อัปเดต Task หลักโดยเก็บ supportAssignees แยกต่างหาก ไม่เอาไปรวมใน assignees ของ Site
      // Note: We don't have direct access to user's projectLocationIds here easily without querying, 
      // but we can pass it from the frontend or just use the first assignee's ID if we must.
      const now = new Date();
      
      const currentRev = taskData.currentRevision || 'rev00';
      const revNum = currentRev.replace('rev', '');
      const helpId = `help${revNum}`;
      
      const taskUpdates = {
        isPickedUpBySupport: true,
        supportTaskName: supportTaskName,
        supportAssignees: supportAssignees,
        supportDailyProgress: 0,
        updatedAt: now,
        updatedBy: updatedBy,
        supportCreatedAt: now, // [NEW] Track when support joined
        supportedRevisionIds: admin.firestore.FieldValue.arrayUnion(currentRev) as any,
        historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...supportAssignees.map(a => a.employeeId), updatedBy) as any
      };
      transaction.update(taskRef, taskUpdates);

      // 5. สร้างเอกสาร helpXX ให้ตรงกับ currentRevision
      const helpRef = taskRef.collection('help').doc(helpId);
      transaction.set(helpRef, {
        ...rev00Data,
        revisionId: helpId,
        revisionName: supportTaskName,
        taskName: supportTaskName, // Override original name for help document
        assignees: supportAssignees, // เฉพาะ FM ของทีม Support
        createdAt: now,
        createdBy: updatedBy,
      });

      // 6. เก็บ Audit Trail
      await this.recordHistory(taskRef, 'support_join', taskData, taskUpdates, updatedBy);
      console.log(`[TaskService] joinSupportTask transaction successfully completed`);
    });
    } catch (error: any) {
      console.error(`[TaskService] Error in joinSupportTask:`, error);
      throw new AppError(error.message, error.statusCode || 500);
    }
  }

  /**
   * ดึงรายการ Tasks ทั้งหมด (กรองตาม Role)
   */
  async getTasks(filters?: { projectId?: string; assigneeId?: string }): Promise<Task[]> {
    // [TEMPORARY REVERT - Phase 1: Performance Fix] 
    // ใช้การกรองใน Memory ชั่วคราวเพื่อเลี่ยง Error 500 (FAILED_PRECONDITION) เนื่องจากยังไม่ได้สร้าง Index ใน Firebase Console
    // สำหรับระบบที่มีข้อมูลเยอะ ควรไปสร้าง Index ใน Firebase Console แล้วเปลี่ยนกลับไปใช้ .where()
    const snapshot = await afterSaleDb.collectionGroup('tasks').withConverter(taskConverter).get();
    
    // [NEW] Populate supportedRevisionIds for old tasks on-the-fly
    let tasks = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data() as Task;
      if (!data.supportedRevisionIds) {
        // If the array is missing, try to detect it from the 'help' subcollection
        const helpSnapshot = await doc.ref.collection('help').get();
        // Convert 'help00' -> 'rev00'
        data.supportedRevisionIds = helpSnapshot.docs.map(h => h.id.replace('help', 'rev'));
      }
      return data;
    }));
    
    // กรอง isActive ใน Memory
    tasks = tasks.filter(task => task.isActive === true);

    // กรอง projectId ใน Memory
    if (filters?.projectId) {
      tasks = tasks.filter(task => task.projectId === filters.projectId);
    }
    
    // Sort by createdAt desc in memory
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // กรอง assigneeId ใน Memory
    if (filters?.assigneeId) {
      const targetId = filters.assigneeId;
      tasks = tasks.filter(task => {
        const matchAssignee = task.assignees?.some((a: any) => a.employeeId === targetId || a.id === targetId);
        const matchSupport = task.supportAssignees?.some((a: any) => a.employeeId === targetId || a.id === targetId);
        const matchHistorical = task.historicalAssigneeIds?.includes(targetId);
        return matchAssignee || matchSupport || matchHistorical || task.isSupportRequest === true;
      });
    }

    return tasks;
  }

  /**
   * อัปเดต Task พร้อมระบบ Audit Trail และ Category Migration
   */
  async updateTask(id: string, input: UpdateTaskInput, updatedBy: string): Promise<void> {
    console.log(`[TaskService] Updating task: ${id}`, input);
    try {
    let taskRef: FirebaseFirestore.DocumentReference;
    let oldWoId: string = '', oldCatId: string = '', oldTaskId: string = '';

    if (id.includes('__')) {
      [oldWoId, oldCatId, oldTaskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories').doc(oldCatId).collection('tasks').doc(oldTaskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }
    
    const doc = await taskRef.get();
    console.log(`[TaskService] Document fetched: ${doc.exists}`);
    if (!doc.exists) throw new AppError('ไม่พบข้อมูลงานที่ต้องการแก้ไข (Task not found)', 404);
    
    const oldData = doc.data() as any;
    console.log(`[TaskService] Old data:`, { taskName: oldData.taskName, categoryName: oldData.categoryName });
    const now = new Date();

    // Sanitize input: Remove undefined values
    const sanitizedInput = Object.keys(input).reduce((obj: any, key) => {
      const val = (input as any)[key];
      if (val !== undefined) obj[key] = val;
      return obj;
    }, {});

    // 1. ตรวจสอบการเปลี่ยน Category (Category Migration)
    if (input.categoryName && input.categoryName !== oldData.categoryName) {
      // ดึงหรือสร้าง Category ID ใหม่ (ใช้ Logic คล้าย CreateTask)
      // เพื่อความง่ายในจุดนี้ เราจะ Re-create task ใน Path ใหม่
      const newCatId = `cat_counter_${oldWoId}`; // ใช้ counter เดิม
      // หมายเหตุ: ในระบบจริงควรมี logic ตรวจสอบหมวดหมู่ที่มีอยู่แล้วด้วย
      // แต่ในที่นี้เราจะรัน Task ภายใต้ Category Name ใหม่ไปเลย
      
      // เราจะทำการ Re-set ข้อมูลใน Path ใหม่ และลบอันเก่า (หรือ Mark isActive: false ในที่เก่า)
      // แต่เพื่อรักษา Hierarchy เราจะย้าย Document ครับ
      const newCategoryRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories');
      
      // ค้นหาว่ามีหมวดหมู่นี้อยู่แล้วหรือยัง
      const catQuery = await newCategoryRef.where('catName', '==', input.categoryName).limit(1).get();
      let targetCatId = '';
      
      if (!catQuery.empty) {
        targetCatId = catQuery.docs[0].id;
      } else {
        // สร้างหมวดหมู่ใหม่
        const catCounterRef = afterSaleDb.collection('system_counters').doc(newCatId);
        const catCounterDoc = await catCounterRef.get();
        const nextCatRun = (catCounterDoc.data()?.count || 0) + 1;
        targetCatId = `CAT-${nextCatRun.toString().padStart(4, '0')}`;
        
        await catCounterRef.set({ count: nextCatRun, updatedAt: now }, { merge: true });
        await newCategoryRef.doc(targetCatId).set({ catId: targetCatId, catName: input.categoryName }, { merge: true });
      }

      const newTaskRef = newCategoryRef.doc(targetCatId).collection('tasks').doc(oldTaskId);
      const newData = { ...oldData, ...sanitizedInput, categoryId: targetCatId, updatedAt: now, updatedBy };
      
      await newTaskRef.set(newData);
      console.log(`[TaskService] New task document created (Migration)`);
      await taskRef.delete();
      console.log(`[TaskService] Old task document deleted (Migration)`);
      
      await this.recordHistory(newTaskRef, 'update', oldData, newData, updatedBy);
      console.log(`[TaskService] History recorded (Migration)`);
    } else {
      const updates: any = { ...sanitizedInput, updatedAt: now, updatedBy };
      if (sanitizedInput.assignees) {
        updates.historicalAssigneeIds = admin.firestore.FieldValue.arrayUnion(...sanitizedInput.assignees.map((a: any) => a.employeeId));
      }
      if (sanitizedInput.supportAssignees) {
        updates.historicalAssigneeIds = admin.firestore.FieldValue.arrayUnion(...sanitizedInput.supportAssignees.map((a: any) => a.employeeId));
      }
      await taskRef.update(updates);
      console.log(`[TaskService] Task document updated (Regular)`);
      await this.recordHistory(taskRef, 'update', oldData, updates, updatedBy);
      console.log(`[TaskService] History recorded (Regular)`);
    }
    console.log(`[TaskService] updateTask completed successfully`);
    } catch (error: any) {
      console.error(`[TaskService] CRITICAL ERROR in updateTask:`, error);
      throw new AppError(`Backend Error: ${error.message}`, 500);
    }
  }

  /**
   * Soft Delete Task
   */
  async softDeleteTask(id: string, userId: string): Promise<void> {
    let taskRef;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    const doc = await taskRef.get();
    if (!doc.exists) throw new AppError('Task not found', 404);

    const oldData = doc.data();
    const updates = { isActive: false, updatedAt: new Date(), updatedBy: userId };
    
    await taskRef.update(updates);
    await this.recordHistory(taskRef, 'delete', oldData, updates, userId);
  }

  /**
   * บันทึกประวัติการแก้ไข (Audit Trail)
   * ปิดการใช้งานชั่วคราว: ปัจจุบันระบบให้ใช้ editHistory เฉพาะใน DailyReport เท่านั้น
   */
  private recordHistory = async (_taskRef: FirebaseFirestore.DocumentReference, _type: string, _oldData: any, _newData: any, _userId: string) => {
    // No-op
  };

  /**
   * อัปเดตสถานะ (Status) แบบด่วน (เช่น Drag & Drop)
   */
  async updateTaskStatus(id: string, status: string, updatedBy: string): Promise<void> {
    let taskRef;

    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      
      if (querySnapshot.empty) {
        throw new AppError('Task not found', 404);
      }
      
      taskRef = querySnapshot.docs[0].ref;
    }

    await taskRef.update({
      status,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * บันทึกรายงานการทำงานรายวันลงในตัว Task โดยตรง (Task-Centric)
   * Path: workOrders/{woId}/categories/{catId}/tasks/{taskId}/dailyReports/{dateStr}
   */
  async submitDailyReport(id: string, reportData: any, updatedBy: string, isSupportReport: boolean = false): Promise<void> {
    console.log(`[TaskService] Submitting daily report for task: ${id}`, reportData);
    
    let taskRef: FirebaseFirestore.DocumentReference;
    let selectedRevisionId: string | null = null;
    
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length >= 3) {
        const [woId, catId, taskId] = parts;
        taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
        if (parts.length === 4) {
          selectedRevisionId = parts[3];
        }
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) throw new AppError('Task not found', 404);
        taskRef = querySnapshot.docs[0].ref;
      }
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    const reportDate = new Date(reportData.reportDate);
    const year = reportDate.getFullYear();
    const month = String(reportDate.getMonth() + 1).padStart(2, '0');
    const day = String(reportDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Get current revision first
    const taskDocForRev = await taskRef.get();
    if (!taskDocForRev.exists) throw new AppError('Task not found', 404);
    const taskDataForRev = taskDocForRev.data() || {};
    const currentRev = selectedRevisionId || taskDataForRev.currentRevision || 'rev00';

    // บันทึกรายงานภายใต้ Revision หรือ Help
    let dailyReportRef: FirebaseFirestore.DocumentReference;
    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      dailyReportRef = taskRef.collection('help').doc(helpId).collection('dailyReports').doc(dateStr);
    } else {
      dailyReportRef = taskRef.collection('revisions').doc(currentRev).collection('dailyReports').doc(dateStr);
    }

    // Check if report already exists (to allow edits even if retroactive window is closed)
    const existingReportDoc = await dailyReportRef.get();
    const isUpdate = existingReportDoc.exists;

    const nowForValidation = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    // Check if the date is explicitly unlocked
    const unlockedDatesField = isSupportReport ? 'supportUnlockedDates' : 'unlockedDates';
    const unlockedDates = taskDataForRev[unlockedDatesField] || {};
    const unlockInfo = unlockedDates[dateStr];
    const isUnlocked = unlockInfo && (
      (unlockInfo.unlockedUntil.toDate ? unlockInfo.unlockedUntil.toDate() : new Date(unlockInfo.unlockedUntil)) >= nowForValidation
    );

    if (!isUpdate && reportDate < threeDaysAgo) {
      if (!isUnlocked) {
         throw new AppError(`Cannot submit report for date older than 3 days unless unlocked (date: ${dateStr})`, 403);
      }
    }

    // [NEW] Revision Timeline Boundary Validation
    // Users cannot submit reports before the current revision was created (rejected/joined)
    if (!isUnlocked) {
      if (taskDataForRev.revisionCreatedAt && currentRev !== 'rev00') {
        const revisionCreatedAt = taskDataForRev.revisionCreatedAt.toDate ? taskDataForRev.revisionCreatedAt.toDate() : new Date(taskDataForRev.revisionCreatedAt);
        const boundaryDate = new Date(revisionCreatedAt);
        boundaryDate.setHours(0, 0, 0, 0); // Start of the day
        if (reportDate < boundaryDate) {
          if (isSupportReport) {
            throw new AppError(`ไม่สามารถลงงานย้อนหลังก่อนวันที่ปรับปรุงงานนี้ได้`, 400);
          } else {
            throw new AppError(`ไม่สามารถลงงานย้อนหลังก่อนวันที่งานถูก Reject ได้`, 400);
          }
        }
      }
    }

    // --- [NEW] Cross-Revision Conflict Validation ---
    if (!isSupportReport) {
      // Check if any revision (other than current) has a report for this date
      const revisionsSnapshot = await taskRef.collection('revisions').get();
      const allRevIds = revisionsSnapshot.docs.map(d => d.id);
      
      for (const revId of allRevIds) {
        if (revId === currentRev) continue; // Skip current
        
        const otherReportRef = taskRef.collection('revisions').doc(revId).collection('dailyReports').doc(dateStr);
        const otherReportDoc = await otherReportRef.get();
        if (otherReportDoc.exists) {
          throw new AppError(`มีข้อมูลรายงานในวันที่ ${dateStr} อยู่ใน ${revId} แล้ว ไม่สามารถลงข้อมูลทับซ้อนกันได้`, 400);
        }
      }
    } else {
      // Check help/support reports as well
      const helpSnapshot = await taskRef.collection('help').get();
      const allHelpIds = helpSnapshot.docs.map(d => d.id);
      const helpIdToMatch = currentRev.replace('rev', 'help');
      
      for (const hId of allHelpIds) {
        if (hId === helpIdToMatch) continue; // Skip current

        const otherHelpReportRef = taskRef.collection('help').doc(hId).collection('dailyReports').doc(dateStr);
        const otherHelpReportDoc = await otherHelpReportRef.get();
        if (otherHelpReportDoc.exists) {
          throw new AppError(`มีข้อมูลรายงาน Support ในวันที่ ${dateStr} อยู่ใน ${hId} แล้ว`, 400);
        }
      }
    }

    await afterSaleDb.runTransaction(async (transaction) => {
      // 1. ALL READS
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) throw new AppError('Task not found', 404);

      const dailyReportDoc = await transaction.get(dailyReportRef);
      let editHistory: any[] = [];
      let isUpdate = false;

      if (dailyReportDoc.exists) {
        const existingData = dailyReportDoc.data();
        isUpdate = true;
        editHistory = existingData?.editHistory || [];

        // สำรองข้อมูล labor และ leave เดิมเก็บไว้ใน editHistory ทุกครั้งที่มีการแก้ไข
        if (existingData?.labor || existingData?.leave) {
          editHistory.push({
            editedAt: new Date(),
            editedBy: updatedBy,
            snapshot: { 
              labor: existingData.labor || [],
              leave: existingData.leave || [] 
            }
          });
        }
      }

      // 2. ALL WRITES
      const now = new Date();

      // [RESTRICTION] หากเป็นการแก้ไขงานเก่าเกิน 3 วัน ให้แก้ได้เฉพาะแรงงาน (Labor/Leave) เท่านั้น
      let finalReportData = { ...reportData };
      if (isUpdate && reportDate < threeDaysAgo) {
        const existingData = dailyReportDoc.data() || {};
        // บังคับคืนค่า Progress, Note และ Photos เดิม (ไม่อนุญาตให้แก้)
        finalReportData.progress = existingData.progress;
        finalReportData.note = existingData.note;
        finalReportData.photos = existingData.photos;
      }

      // Check if this is the latest report chronologically
      const reportsCollectionRef = isSupportReport 
        ? taskRef.collection('help').doc(currentRev.replace('rev', 'help')).collection('dailyReports')
        : taskRef.collection('revisions').doc(currentRev).collection('dailyReports');
        
      const newerReportsSnapshot = await transaction.get(
        reportsCollectionRef.where(admin.firestore.FieldPath.documentId(), '>', dateStr).limit(1)
      );
      const isLatestDate = newerReportsSnapshot.empty;

      // Enforce leaveType logic
      if (reportData.leave && Array.isArray(reportData.leave)) {
        reportData.leave = reportData.leave.map((l: any) => ({
          ...l,
          leaveType: l.medCertFileUrl ? 'Paid' : 'Unpaid'
        }));
      }
      
      // บันทึกลง Sub-collection
      const payload: any = {
        ...finalReportData,
        reportDate: reportDate,
        updatedAt: now,
        updatedBy: updatedBy,
        editHistory: editHistory
      };

      if (!isUpdate) {
        payload.createdAt = now;
        payload.createdBy = updatedBy;
      }

      transaction.set(dailyReportRef, payload, { merge: true });

      let historyUpdateData: any = { updatedAt: now };
      const oldData = taskDoc.data();

      // อัปเดต Task หลัก เฉพาะเมื่อเป็นรายงานของวันล่าสุดเท่านั้น
      if (isLatestDate) {
        if (!isSupportReport) {
          let newStatus = 'upcoming';
          const progress = reportData.progress || 0;
          if (progress > 0 && progress < 100) newStatus = 'in-progress';
          if (progress >= 100) newStatus = 'for-checking';

          transaction.update(taskRef, {
            dailyProgress: progress,
            status: newStatus,
            updatedAt: now,
            updatedBy: updatedBy,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
          });
          historyUpdateData.dailyProgress = progress;
        } else {
          transaction.update(taskRef, {
            updatedAt: now,
            updatedBy: updatedBy,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
          });
        }
      } else {
        // อัปเดตแค่วันที่แก้ไขล่าสุด
        transaction.update(taskRef, {
          updatedAt: now,
          updatedBy: updatedBy,
          historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
        });
      }

      // บันทึก History
      
      await this.recordHistory(taskRef, 'daily_report_submit', oldData, historyUpdateData, updatedBy);
    });

    // -------------------------------------------------------------
    // Update foremanUsage count for selected workers in Labor DB
    // -------------------------------------------------------------
    try {
      let userEmployeeId = 'unknown';
      let userFullName = 'Unknown User';
      
      const userDoc = await db.collection('users').doc(updatedBy).get();
      if (userDoc.exists) {
        const uData = userDoc.data();
        userEmployeeId = uData?.employeeId || updatedBy;
        userFullName = uData?.name || uData?.username || 'Unknown User';
      } else {
        const userQuery = await db.collection('users').where('employeeId', '==', updatedBy).limit(1).get();
        if (!userQuery.empty) {
          const uData = userQuery.docs[0].data();
          userEmployeeId = uData.employeeId;
          userFullName = uData.name || uData.username || 'Unknown User';
        }
      }

      const workerIds = new Set<string>();
      if (reportData.labor && Array.isArray(reportData.labor)) {
        reportData.labor.forEach((w: any) => {
          if (w.workerId) workerIds.add(w.workerId);
        });
      }
      if (reportData.leave && Array.isArray(reportData.leave)) {
        reportData.leave.forEach((w: any) => {
          if (w.workerId) workerIds.add(w.workerId);
        });
      }

      const now = new Date();
      for (const dcId of workerIds) {
        try {
          const dcRef = db.collection('dailyContractors').doc(dcId);
          await dcRef.update({
            [`foremanUsage.${userEmployeeId}.count`]: admin.firestore.FieldValue.increment(1),
            [`foremanUsage.${userEmployeeId}.name`]: userFullName,
            lastUsedByName: userFullName,
            lastUsedById: userEmployeeId,
            lastUsedAt: now
          });
          console.log(`[TaskService] Updated foremanUsage for worker ${dcId} under foreman ${userEmployeeId} (${userFullName})`);
        } catch (err: any) {
          console.error(`Failed to update foremanUsage for worker ${dcId}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error('Failed to process foremanUsage for submitted report:', err.message);
    }

    // -------------------------------------------------------------
    // Trigger After-Sale System Webhook (F-014 Sync)
    // -------------------------------------------------------------
    try {
      const reportPath = dailyReportRef.path;

      await axios.post('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
        reportPath: reportPath,
        reportDate: dateStr
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`[TaskService] Triggered After-Sale Sync Successfully for ${reportPath}!`);
    } catch (error: any) {
      console.error("[TaskService] Failed to trigger After-Sale sync:", error.message);
    }
  }

  /**
   * ดึงข้อมูลรายงานประจำวันของ Task ตามวันที่ระบุ
   */
  async getDailyReport(id: string, dateStr: string, isSupportReport: boolean = false): Promise<any> {
    let taskRef: FirebaseFirestore.DocumentReference;
    let selectedRevisionId: string | null = null;
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length >= 3) {
        const [woId, catId, taskId] = parts;
        taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
        if (parts.length === 4) selectedRevisionId = parts[3];
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) return null;
        taskRef = querySnapshot.docs[0].ref;
      }
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) return null;
      taskRef = querySnapshot.docs[0].ref;
    }

    const taskDocForRev = await taskRef.get();
    if (!taskDocForRev.exists) return null;
    const currentRev = selectedRevisionId || taskDocForRev.data()?.currentRevision || 'rev00';

    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      const reportDoc = await taskRef.collection('help').doc(helpId).collection('dailyReports').doc(dateStr).get();
      if (reportDoc.exists) return reportDoc.data();
    } else {
      const reportDoc = await taskRef.collection('revisions').doc(currentRev).collection('dailyReports').doc(dateStr).get();
      if (reportDoc.exists) return reportDoc.data();
    }

    return null;
  }
  /**
   * ดึงข้อมูลรายงานประจำวันทั้งหมดของ Task
   */
  async getAllDailyReports(id: string, isSupportReport?: boolean): Promise<any[]> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length >= 3) {
        const [woId, catId, taskId] = parts;
        taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) return [];
        taskRef = querySnapshot.docs[0].ref;
      }
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) return [];
      taskRef = querySnapshot.docs[0].ref;
    }

    const taskDocForRev = await taskRef.get();
    if (!taskDocForRev.exists) return [];
    
    const allReports: any[] = [];
    const dateMap = new Map<string, boolean>();

    // 1. Fetch from all revisions (Site Reports)
    if (isSupportReport === false || isSupportReport === undefined) {
      const revisionsSnapshot = await taskRef.collection('revisions').get();
      for (const revDoc of revisionsSnapshot.docs) {
        const reports = await revDoc.ref.collection('dailyReports').get();
        reports.docs.forEach(d => {
          const data = d.data();
          if (data.reportDate && !dateMap.has(d.id)) {
            allReports.push({ ...data, _revisionId: revDoc.id });
            dateMap.set(d.id, true);
          }
        });
      }
    }

    // 2. Fetch from all help/support docs (Support Reports)
    if (isSupportReport === true || isSupportReport === undefined) {
      const helpSnapshot = await taskRef.collection('help').get();
      for (const hDoc of helpSnapshot.docs) {
        const reports = await hDoc.ref.collection('dailyReports').get();
        reports.docs.forEach(d => {
          const data = d.data();
          if (data.reportDate && !dateMap.has(d.id)) {
            allReports.push({ ...data, _revisionId: hDoc.id });
            dateMap.set(d.id, true);
          }
        });
      }
    }

    return allReports;
  }

  /**
   * Unlock daily report for a specific date
   */
  async unlockDailyReport(id: string, dateStr: string, days: number, updatedBy: string, isSupportReport: boolean = false): Promise<void> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    const until = new Date();
    until.setDate(until.getDate() + days);

    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) throw new AppError('Task not found', 404);
    
    const taskData = taskDoc.data();
    const unlockedDatesField = isSupportReport ? 'supportUnlockedDates' : 'unlockedDates';
    const unlockRequestsField = isSupportReport ? 'supportUnlockRequests' : 'unlockRequests';

    const unlockedDates = taskData?.[unlockedDatesField] || {};
    unlockedDates[dateStr] = {
      unlockedUntil: until,
      unlockedBy: updatedBy
    };

    const unlockRequests = taskData?.[unlockRequestsField] || {};
    if (unlockRequests[dateStr]) {
      delete unlockRequests[dateStr];
    }

    await taskRef.update({
      [unlockedDatesField]: unlockedDates,
      [unlockRequestsField]: unlockRequests,
      updatedAt: new Date(),
      updatedBy
    });
  }

  /**
   * Request daily report unlock for a specific date
   */
  async requestDailyReportUnlock(id: string, dateStr: string, requestedBy: string, isSupportReport: boolean = false): Promise<void> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) throw new AppError('Task not found', 404);

    const taskData = taskDoc.data();
    const unlockRequestsField = isSupportReport ? 'supportUnlockRequests' : 'unlockRequests';
    const unlockRequests = taskData?.[unlockRequestsField] || {};
    unlockRequests[dateStr] = {
      requestedAt: new Date(),
      requestedBy
    };

    await taskRef.update({
      [unlockRequestsField]: unlockRequests,
      updatedAt: new Date()
    });
  }
}

export const taskService = new TaskService();
