import { db } from '../config/firebase';
import { Task, CreateTaskInput, UpdateTaskInput, taskConverter } from '../models/Task';
import { AppError } from '../api/middleware/errorHandler';

const TASKS_COLLECTION = 'Tasks';
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
      
      // 2. หาวันที่และปีปัจจุบัน
      const currentYear = new Date().getFullYear().toString();
      
      const prefix = `${projectCode}-${currentYear}`;

      // 3. หา Running Number ล่าสุดของโปรเจกต์นี้และปีนี้
      // หมายเหตุ: การ query ใน transaction มีข้อจำกัด Firestore ไม่ให้ query มากกว่า 1 อัน
      // แต่เราสามารถดึงข้อมูล task ล่าสุดได้
      const snapshot = await transaction.get(
        db.collection(TASKS_COLLECTION)
          .where('taskCode', '>=', `${prefix}-`)
          .where('taskCode', '<=', `${prefix}-\uf8ff`)
          .orderBy('taskCode', 'desc')
          .limit(1)
      );

      let nextRunningNo = 1;
      if (!snapshot.empty) {
        const lastTaskCode = snapshot.docs[0].data().taskCode;
        // รูปแบบ WH-2026-0001
        const parts = lastTaskCode.split('-');
        if (parts.length >= 3) {
          const lastNum = parseInt(parts[2], 10);
          if (!isNaN(lastNum)) {
            nextRunningNo = lastNum + 1;
          }
        }
      }

      const runningStr = nextRunningNo.toString().padStart(4, '0');
      const newTaskCode = `${prefix}-${runningStr}`;

      // 4. สร้าง Document ใหม่โดยใช้ Running Number เป็น ID หลัก
      const taskRef = db.collection(TASKS_COLLECTION).doc(newTaskCode);
      const now = new Date();

      const newTaskData: Omit<Task, 'id'> = {
        taskCode: newTaskCode,
        title: input.title,
        description: input.description,
        projectId: input.projectId,
        projectCode: projectCode,
        assignees: input.assignees,
        dueDate: input.dueDate,
        status: input.status || 'upcoming',
        attachmentsCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
      };

      transaction.set(taskRef.withConverter(taskConverter), newTaskData as any);

      return {
        id: taskRef.id,
        ...newTaskData,
      };
    });
  }

  /**
   * ดึงรายการ Tasks ทั้งหมด (กรองตาม Role)
   */
  async getTasks(filters?: { projectId?: string; assigneeId?: string }): Promise<Task[]> {
    let query: FirebaseFirestore.Query = db.collection(TASKS_COLLECTION).withConverter(taskConverter);

    query = query.where('isActive', '==', true);

    if (filters?.projectId) {
      query = query.where('projectId', '==', filters.projectId);
    }

    if (filters?.assigneeId) {
      // ค้นหาใน Array ของ objects ไม่ได้โดยตรงใน Firestore ต้องหาผ่าน Array-contains ไม่ได้ถ้าเป็น object
      // ทางแก้คือ ดึงมาทั้งหมดของ project หรือไม่ก็เก็บ assigneeIds แยกไว้เป็น array ของ string
      // สำหรับโปรเจกต์นี้ ควรดึงทั้งหมดแล้ว filter ใน memory หรือใช้ where in 
    }

    const snapshot = await query.get();
    let tasks = snapshot.docs.map(doc => doc.data() as Task);
    
    // Sort by createdAt desc in memory to avoid Firestore composite index requirement
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // ถ้ามีการกรอง assigneeId ให้ทำการกรองใน Memory เนื่องจาก Firestore ไม่รองรับ array-contains object
    if (filters?.assigneeId) {
      tasks = tasks.filter(task => 
        task.assignees.some(assignee => assignee.id === filters.assigneeId)
      );
    }

    return tasks;
  }

  /**
   * อัปเดต Task
   */
  async updateTask(id: string, input: UpdateTaskInput, updatedBy: string): Promise<void> {
    const taskRef = db.collection(TASKS_COLLECTION).doc(id);
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
    const taskRef = db.collection(TASKS_COLLECTION).doc(id);
    await taskRef.update({
      status,
      updatedAt: new Date(),
      updatedBy,
    });
  }
}

export const taskService = new TaskService();
