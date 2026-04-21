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
      // --- READ PHASE: ทำการอ่าน (get) ข้อมูลทั้งหมดก่อนเพื่อหลีกเลี่ยง Read-after-Write ---
      // 1. ตรวจสอบ Project
      const projectDoc = await transaction.get(projectRef);
      if (!projectDoc.exists) {
        throw new AppError('ไม่พบโครงการที่ระบุ', 404);
      }
      const projectData = projectDoc.data();
      const projectCode = projectData?.projectCode || projectData?.code || 'XX';
      const currentYear = new Date().getFullYear().toString();

      // 2. อ่าน Task Counter (แยกตาม Project และ WorkOrder)
      const taskCounterId = `task_${projectCode}_${input.workOrderCode || 'GEN'}`;
      const taskCounterRef = db.collection('system_counters').doc(taskCounterId);
      const taskCounterDoc = await transaction.get(taskCounterRef);

      // 3. อ่าน WorkOrder Counter (ถ้าจำเป็นต้อง Gen รหัสใหม่)
      let generatedWorkOrderId = input.workOrderId || '';
      let woCounterRef: FirebaseFirestore.DocumentReference | null = null;
      let woCounterDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      let woNextRun = 1;

      if (!generatedWorkOrderId && input.workOrderCode) {
         const woCounterId = `wo_${projectCode}_${currentYear}_${input.workOrderCode}`;
         woCounterRef = db.collection('system_counters').doc(woCounterId);
         woCounterDoc = await transaction.get(woCounterRef);
      }

      // 3.5 อ่าน Category Counter (เพื่อ Gen CAT-xxxx)
      let generatedCategoryId = input.categoryId || '';
      let catCounterRef: FirebaseFirestore.DocumentReference | null = null;
      let catCounterDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      let catNextRun = 1;

      if (!generatedCategoryId && input.categoryName) {
         catCounterRef = db.collection('system_counters').doc('global_categories');
         catCounterDoc = await transaction.get(catCounterRef);
      }

      // --- WRITE PHASE: ประมวลผลและเขียน (set/update) ข้อมูล ---
      // 4. คำนวณ Running Number สำหรับ Task (รันแยกตาม Project และ WorkOrder)
      let nextTaskRunningNo = 1;
      if (taskCounterDoc.exists) {
        nextTaskRunningNo = (taskCounterDoc.data()?.count || 0) + 1;
      }
      const taskRunningStr = nextTaskRunningNo.toString().padStart(7, '0');
      const newTaskCode = `TASK-${taskRunningStr}`;

      // 5. คำนวณ Running Number สำหรับ WorkOrder
      if (!generatedWorkOrderId && input.workOrderCode && woCounterRef && woCounterDoc) {
         if (woCounterDoc.exists) {
           woNextRun = (woCounterDoc.data()?.count || 0) + 1;
         }
         const woRunningNo = woNextRun.toString().padStart(4, '0');
         generatedWorkOrderId = `${projectCode}-${currentYear}-${woRunningNo}-${input.workOrderCode}`;
      }

      // 5.5 คำนวณ Running Number สำหรับ Category
      if (!generatedCategoryId && input.categoryName && catCounterRef && catCounterDoc) {
         if (catCounterDoc.exists) {
           catNextRun = (catCounterDoc.data()?.count || 0) + 1;
         }
         const catRunningNo = catNextRun.toString().padStart(4, '0');
         generatedCategoryId = `CAT-${catRunningNo}`;
      }

      // 6. ดำเนินการอัปเดต Counter ลง Database
      transaction.set(taskCounterRef, { count: nextTaskRunningNo, updatedAt: new Date() }, { merge: true });
      if (woCounterRef) {
         transaction.set(woCounterRef, { count: woNextRun, updatedAt: new Date() }, { merge: true });
      }
      if (catCounterRef) {
         transaction.set(catCounterRef, { count: catNextRun, updatedAt: new Date() }, { merge: true });
      }

      const now = new Date();

      // 7. กำหนด Path ใหม่: workOrders/{woId}/categories/{catId}/tasks/{taskId}
      const workOrderRef = db.collection(WORK_ORDERS_COLLECTION).doc(generatedWorkOrderId);
      const categoryRef = workOrderRef.collection('categories').doc(generatedCategoryId);
      const taskRef = categoryRef.collection('tasks').doc(newTaskCode);

      // (Optional) อาจจะต้อง set Doc ของ workOrder และ categories ด้วยเพื่อให้มัน query ได้ง่ายขึ้น 
      // แต่ Firestore รองรับ Subcollection โดยไม่ต้องมี Parent Doc
      transaction.set(workOrderRef, { id: generatedWorkOrderId, projectId: input.projectId, workOrderCode: input.workOrderCode }, { merge: true });
      transaction.set(categoryRef, { catId: generatedCategoryId, catName: input.categoryName }, { merge: true });

      const newTaskData: Omit<Task, 'id'> = {
        taskId: newTaskCode,
        taskName: input.taskName,
        description: input.description,
        projectId: input.projectId,
        projectCode: projectCode,
        workOrderId: generatedWorkOrderId,
        workOrderCode: input.workOrderCode,
        categoryId: generatedCategoryId,
        categoryName: input.categoryName,
        assignees: input.assignees,
        dueDate: input.dueDate,
        status: input.status || 'upcoming',
        dailyProgress: 0,
        attachmentsCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
      };

      transaction.set(taskRef.withConverter(taskConverter), newTaskData as any);

      return {
        id: `${generatedWorkOrderId}__${generatedCategoryId}__${taskRef.id}`,
        ...newTaskData,
      };
    });
  }

  /**
   * ดึงรายการ Tasks ทั้งหมด (กรองตาม Role)
   */
  async getTasks(filters?: { projectId?: string; assigneeId?: string }): Promise<Task[]> {
    // ใช้ get() ตรงๆ โดยไม่มี where() เพื่อหลีกเลี่ยงการติด Error: FAILED_PRECONDITION (Collection Group Index)
    // สำหรับระบบที่มีข้อมูลเยอะ ควรไปสร้าง Index ใน Firebase Console ก่อนเปิดใช้งานจริง
    const snapshot = await db.collectionGroup('tasks').withConverter(taskConverter).get();
    let tasks = snapshot.docs.map(doc => doc.data() as Task);
    
    // กรอง isActive
    tasks = tasks.filter(task => task.isActive === true);

    // กรอง projectId
    if (filters?.projectId) {
      tasks = tasks.filter(task => task.projectId === filters.projectId);
    }
    
    // Sort by createdAt desc in memory to avoid Firestore composite index requirement
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // ถ้ามีการกรอง assigneeId ให้ทำการกรองใน Memory เนื่องจาก Firestore ไม่รองรับ array-contains object
    if (filters?.assigneeId) {
      tasks = tasks.filter(task => 
        task.assignees.some(assignee => assignee.employeeId === filters.assigneeId)
      );
    }

    return tasks;
  }

  /**
   * อัปเดต Task
   */
  async updateTask(id: string, input: UpdateTaskInput, updatedBy: string): Promise<void> {
    let taskRef;

    // ตรวจสอบว่าเป็น Composite ID (WO__CAT__TASK) หรือไม่
    if (id.includes('__')) {
      const [woId, catId, taskId] = id.split('__');
      taskRef = db.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      // Legacy: ใช้ collectionGroup ค้นหา taskId (ไม่แนะนำเพราะอาจซ้ำกันได้ในระบบใหม่)
      const querySnapshot = await db.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      
      if (querySnapshot.empty) {
        throw new AppError('Task not found', 404);
      }
      
      taskRef = querySnapshot.docs[0].ref;
    }
    
    const doc = await taskRef.get();
    
    if (!doc.exists) {
      throw new AppError('Task not found', 404);
    }

    const updates: any = {
      ...input,
      updatedAt: new Date(),
      updatedBy,
    };

    await taskRef.update(updates);
  }

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
}

export const taskService = new TaskService();
