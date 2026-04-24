import { db } from '../config/firebase';
import { Task, CreateTaskInput, UpdateTaskInput, taskConverter } from '../models/Task';
import { AppError } from '../api/middleware/errorHandler';

const WORK_ORDERS_COLLECTION = 'workOrders';
const PROJECTS_COLLECTION = 'Project';

export class TaskService {
  /**
   * สร้าง Task ใหม่ พร้อม Running Number (เช่น WH-2026-0001)
   */
  async createTask(input: CreateTaskInput, createdBy: string): Promise<Task> {
    const projectRef = db.collection(PROJECTS_COLLECTION).doc(input.projectId);

    return await db.runTransaction(async (transaction) => {
      // 1. ตรวจสอบ Project
      const projectDoc = await transaction.get(projectRef);
      if (!projectDoc.exists) {
        throw new AppError('ไม่พบโครงการที่ระบุ', 404);
      }
      const projectData = projectDoc.data();
      const projectCode = projectData?.projectCode || projectData?.code || 'XX';
      const projectName = projectData?.name || projectData?.projectName || 'Unknown Project';

      // 2. ระดับ WorkOrder: Query หาซ้ำ
      const woQuery = await transaction.get(
        db.collection(WORK_ORDERS_COLLECTION)
          .where('projectId', '==', input.projectId)
          .where('workOrderCode', '==', input.workOrderCode || 'GEN')
          .limit(1)
      );

      let woId = '';
      if (!woQuery.empty) {
        woId = woQuery.docs[0].id;
      } else {
        woId = `${input.projectId}-${input.workOrderCode || 'GEN'}`;
      }
      const workOrderRef = db.collection(WORK_ORDERS_COLLECTION).doc(woId);

      // 3. ระดับ Category: Query หาซ้ำตามชื่อ
      const catQuery = await transaction.get(
        workOrderRef.collection('categories')
          .where('catName', '==', input.categoryName || 'General')
          .limit(1)
      );

      let catId = '';
      if (!catQuery.empty) {
        catId = catQuery.docs[0].id;
      } else {
        // อ่าน Counter
        const catCounterId = `cat_counter_${woId}`;
        const catCounterRef = db.collection('system_counters').doc(catCounterId);
        const catCounterDoc = await transaction.get(catCounterRef);
        let catNextRun = 1;
        if (catCounterDoc.exists) {
          catNextRun = (catCounterDoc.data()?.count || 0) + 1;
        }
        transaction.set(catCounterRef, { count: catNextRun, updatedAt: new Date() }, { merge: true });
        catId = `CAT-${catNextRun.toString().padStart(4, '0')}`;
      }
      const categoryRef = workOrderRef.collection('categories').doc(catId);

      // 4. ระดับ Task: Query หาซ้ำตามชื่อ
      const taskQuery = await transaction.get(
        categoryRef.collection('tasks')
          .where('taskName', '==', input.taskName)
          .limit(1)
      );

      let taskId = '';
      let isNewTask = false;
      let existingTaskData: any = null;

      if (!taskQuery.empty) {
        taskId = taskQuery.docs[0].id;
        existingTaskData = taskQuery.docs[0].data();
      } else {
        isNewTask = true;
        // อ่าน Counter
        const taskCounterId = `task_${projectCode}_${input.workOrderCode || 'GEN'}`;
        const taskCounterRef = db.collection('system_counters').doc(taskCounterId);
        const taskCounterDoc = await transaction.get(taskCounterRef);
        let taskNextRun = 1;
        if (taskCounterDoc.exists) {
          taskNextRun = (taskCounterDoc.data()?.count || 0) + 1;
        }
        transaction.set(taskCounterRef, { count: taskNextRun, updatedAt: new Date() }, { merge: true });
        taskId = `TASK-${taskNextRun.toString().padStart(7, '0')}`;
      }
      const taskRef = categoryRef.collection('tasks').doc(taskId);

      // 5. เขียนข้อมูลทั้งหมดแบบ Upsert
      const now = new Date();
      let createdAtDate = now;
      if (!isNewTask && existingTaskData?.createdAt) {
         createdAtDate = existingTaskData.createdAt.toDate ? existingTaskData.createdAt.toDate() : existingTaskData.createdAt;
      }

      transaction.set(workOrderRef, {
        id: woId,
        projectId: input.projectId,
        workOrderCode: input.workOrderCode || 'GEN',
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
        categoryId: catId,
        categoryName: input.categoryName || 'General',
        assignees: input.assignees,
        dueDate: input.dueDate,
        status: input.status || 'upcoming',
        dailyProgress: isNewTask ? 0 : (existingTaskData?.dailyProgress || 0),
        attachmentsCount: isNewTask ? 0 : (existingTaskData?.attachmentsCount || 0),
        isActive: true,
        createdAt: createdAtDate,
        updatedAt: now,
        createdBy: isNewTask ? createdBy : (existingTaskData?.createdBy || createdBy),
        updatedBy: createdBy,
      };

      transaction.set(taskRef.withConverter(taskConverter), newTaskData as any, { merge: true });

      return {
        id: `${woId}__${catId}__${taskId}`,
        ...newTaskData,
      };
    });
  }

  /**
   * ดึงรายการ Tasks ทั้งหมด (กรองตาม Role)
   */
  async getTasks(filters?: { projectId?: string; assigneeId?: string }): Promise<Task[]> {
    // [TEMPORARY REVERT - Phase 1: Performance Fix] 
    // ใช้การกรองใน Memory ชั่วคราวเพื่อเลี่ยง Error 500 (FAILED_PRECONDITION) เนื่องจากยังไม่ได้สร้าง Index ใน Firebase Console
    // สำหรับระบบที่มีข้อมูลเยอะ ควรไปสร้าง Index ใน Firebase Console แล้วเปลี่ยนกลับไปใช้ .where()
    const snapshot = await db.collectionGroup('tasks').withConverter(taskConverter).get();
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
      tasks = tasks.filter(task => 
        task.assignees.some(assignee => assignee.employeeId === filters.assigneeId)
      );
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
      taskRef = db.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories').doc(oldCatId).collection('tasks').doc(oldTaskId);
    } else {
      const querySnapshot = await db.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
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
      const newCategoryRef = db.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories');
      
      // ค้นหาว่ามีหมวดหมู่นี้อยู่แล้วหรือยัง
      const catQuery = await newCategoryRef.where('catName', '==', input.categoryName).limit(1).get();
      let targetCatId = '';
      
      if (!catQuery.empty) {
        targetCatId = catQuery.docs[0].id;
      } else {
        // สร้างหมวดหมู่ใหม่
        const catCounterRef = db.collection('system_counters').doc(newCatId);
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
      taskRef = db.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await db.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
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
   */
  private recordHistory = async (taskRef: FirebaseFirestore.DocumentReference, type: string, oldData: any, newData: any, userId: string) => {
    try {
    const historyRef = taskRef.collection('editHistory').doc();
    
    // กรองเฉพาะฟิลด์ที่เปลี่ยนจริง (ใช้การเทียบค่าที่ปลอดภัยขึ้น)
    const changedFields = Object.keys(newData).filter(key => {
      if (key === 'updatedAt' || key === 'updatedBy') return false;
      
      const oldVal = oldData[key];
      const newVal = newData[key];

      // เทียบ Date
      if (oldVal instanceof Date && newVal instanceof Date) {
        return oldVal.getTime() !== newVal.getTime();
      }

      // เทียบ Firestore Timestamp กับ Date
      if (oldVal && typeof oldVal.toDate === 'function' && newVal instanceof Date) {
        return oldVal.toDate().getTime() !== newVal.getTime();
      }

      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });

    if (changedFields.length === 0 && type === 'update') return;

    await historyRef.set({
      changeType: type,
      changedFields,
      oldValues: changedFields.reduce((obj: any, key) => ({ ...obj, [key]: oldData[key] ?? null }), {}),
      newValues: changedFields.reduce((obj: any, key) => ({ ...obj, [key]: newData[key] ?? null }), {}),
      createdAt: new Date(),
      createdBy: userId,
    });
    } catch (err: any) {
      console.error('[TaskService] Failed to record history:', err);
    }
  };

  /**
   * อัปเดตสถานะ (Status) แบบด่วน (เช่น Drag & Drop)
   */
  async updateTaskStatus(id: string, status: string, updatedBy: string): Promise<void> {
    let taskRef;

    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = db.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await db.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      
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
  async submitDailyReport(id: string, reportData: any, updatedBy: string): Promise<void> {
    console.log(`[TaskService] Submitting daily report for task: ${id}`, reportData);
    
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = db.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await db.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    const reportDate = new Date(reportData.reportDate);
    const year = reportDate.getFullYear();
    const month = String(reportDate.getMonth() + 1).padStart(2, '0');
    const day = String(reportDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dailyReportRef = taskRef.collection('dailyReports').doc(dateStr);

    await db.runTransaction(async (transaction) => {
      // 1. ALL READS
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) throw new AppError('Task not found', 404);

      // 2. ALL WRITES
      const now = new Date();
      
      // บันทึกลง Sub-collection
      transaction.set(dailyReportRef, {
        ...reportData,
        reportDate: reportDate,
        createdAt: now,
        createdBy: updatedBy,
        updatedAt: now,
        updatedBy: updatedBy
      });

      // อัปเดต Task หลัก
      transaction.update(taskRef, {
        dailyProgress: reportData.progress || 0,
        status: reportData.progress >= 100 ? 'completed' : 'in-progress',
        updatedAt: now,
        updatedBy: updatedBy
      });

      // บันทึก History
      const oldData = taskDoc.data();
      await this.recordHistory(taskRef, 'daily_report_submit', oldData, {
        dailyProgress: reportData.progress,
        updatedAt: now
      }, updatedBy);
    });
  }

  /**
   * ดึงข้อมูลรายงานประจำวันของ Task ตามวันที่ระบุ
   */
  async getDailyReport(id: string, dateStr: string): Promise<any> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = db.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await db.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) return null;
      taskRef = querySnapshot.docs[0].ref;
    }

    const reportDoc = await taskRef.collection('dailyReports').doc(dateStr).get();
    if (!reportDoc.exists) return null;

    return reportDoc.data();
  }
}

export const taskService = new TaskService();
