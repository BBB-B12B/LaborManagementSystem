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
      const woCounterId = `wo_counter_${projectCode}_${currentYear}`;
      const woCounterRef = afterSaleDb.collection('system_counters').doc(woCounterId);

      if (!woQuery.empty) {
        woId = woQuery.docs[0].id;
      } else {
        isNewWo = true;
        const woCounterDoc = await transaction.get(woCounterRef);
        if (woCounterDoc.exists) {
          woNextRun = (woCounterDoc.data()?.count || 0) + 1;
        }
        woId = `${projectCode}-${currentYear}-${woNextRun.toString().padStart(4, '0')}-${input.workOrderCode || 'GEN'}`;
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
      // Wait, let's just let the frontend send it, OR we don't need it if we check employeeId!
      
      const now = new Date();
      
      const taskUpdates = {
        supportAssignees: supportAssignees,
        isPickedUpBySupport: true,
        supportTaskName: supportTaskName,
        supportDailyProgress: 0,
        updatedAt: now,
        updatedBy: updatedBy,
      };
      transaction.update(taskRef, taskUpdates);

      // 5. สร้างเอกสาร helpXX ให้ตรงกับ currentRevision
      const currentRev = taskData.currentRevision || 'rev00';
      const revNum = currentRev.replace('rev', '');
      const helpId = `help${revNum}`;
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
    let tasks = snapshot.docs.map(doc => doc.data() as Task);
    
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
      tasks = tasks.filter(task => {
        const matchAssignee = task.assignees?.some((a: any) => a.employeeId === filters.assigneeId || a.id === filters.assigneeId);
        const matchSupport = task.supportAssignees?.some((a: any) => a.employeeId === filters.assigneeId || a.id === filters.assigneeId);
        return matchAssignee || matchSupport || task.isSupportRequest === true;
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
      const updates = { ...sanitizedInput, updatedAt: now, updatedBy };
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
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
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
    const currentRev = taskDataForRev.currentRevision || 'rev00';

    // 3-day retroactive validation
    const nowForValidation = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    if (reportDate < threeDaysAgo) {
      const unlockedDates = taskDataForRev.unlockedDates || {};
      const unlockInfo = unlockedDates[dateStr];
      if (!unlockInfo || (unlockInfo.unlockedUntil.toDate ? unlockInfo.unlockedUntil.toDate() : new Date(unlockInfo.unlockedUntil)) < nowForValidation) {
         throw new AppError(`Cannot submit report for date older than 3 days unless unlocked (date: ${dateStr})`, 403);
      }
    }

    // บันทึกรายงานภายใต้ Revision หรือ Help
    let dailyReportRef: FirebaseFirestore.DocumentReference;
    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      dailyReportRef = taskRef.collection('help').doc(helpId).collection('dailyReports').doc(dateStr);
    } else {
      dailyReportRef = taskRef.collection('revisions').doc(currentRev).collection('dailyReports').doc(dateStr);
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
        ...reportData,
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
            updatedBy: updatedBy
          });
          historyUpdateData.dailyProgress = progress;
        } else {
          transaction.update(taskRef, {
            updatedAt: now,
            updatedBy: updatedBy
          });
        }
      } else {
        // อัปเดตแค่วันที่แก้ไขล่าสุด
        transaction.update(taskRef, {
          updatedAt: now,
          updatedBy: updatedBy
        });
      }

      // บันทึก History
      
      await this.recordHistory(taskRef, 'daily_report_submit', oldData, historyUpdateData, updatedBy);
    });

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
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) return null;
      taskRef = querySnapshot.docs[0].ref;
    }

    const taskDocForRev = await taskRef.get();
    if (!taskDocForRev.exists) return null;
    const currentRev = taskDocForRev.data()?.currentRevision || 'rev00';

    let reportDoc;
    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      reportDoc = await taskRef.collection('help').doc(helpId).collection('dailyReports').doc(dateStr).get();
    } else {
      reportDoc = await taskRef.collection('revisions').doc(currentRev).collection('dailyReports').doc(dateStr).get();
    }
    
    if (!reportDoc.exists) return null;

    return reportDoc.data();
  }
  /**
   * ดึงข้อมูลรายงานประจำวันทั้งหมดของ Task
   */
  async getAllDailyReports(id: string, isSupportReport: boolean = false): Promise<any[]> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) return [];
      taskRef = querySnapshot.docs[0].ref;
    }

    const taskDocForRev = await taskRef.get();
    if (!taskDocForRev.exists) return [];
    const currentRev = taskDocForRev.data()?.currentRevision || 'rev00';

    let reportsSnapshot;
    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      reportsSnapshot = await taskRef.collection('help').doc(helpId).collection('dailyReports').get();
    } else {
      reportsSnapshot = await taskRef.collection('revisions').doc(currentRev).collection('dailyReports').get();
    }
    
    if (reportsSnapshot.empty) return [];

    return reportsSnapshot.docs.map(doc => doc.data());
  }

  /**
   * Unlock daily report for a specific date
   */
  async unlockDailyReport(id: string, dateStr: string, days: number, updatedBy: string): Promise<void> {
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
    const unlockedDates = taskData?.unlockedDates || {};
    unlockedDates[dateStr] = {
      unlockedUntil: until,
      unlockedBy: updatedBy
    };

    await taskRef.update({
      unlockedDates,
      updatedAt: new Date(),
      updatedBy
    });
  }
}

export const taskService = new TaskService();
