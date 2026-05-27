import { db } from '../config/firebase';
import admin from 'firebase-admin';
import { afterSaleDb } from '../config/firebaseProjectB';
import { Task, CreateTaskInput, UpdateTaskInput, taskConverter, TaskAssignee, TaskStatus } from '../models/Task';
import { Notification } from '../models/Notification';
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
        taskId = `${catId}-${taskNextRun.toString().padStart(3, '0')}`;
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

      
      // Aggregate assignees from subtasks
      const allAssigneesMap = new Map<string, any>();
      let hasSupportRequest = false;
      if (input.subtasks) {
        input.subtasks.forEach(st => {
          if (st.isSupportRequest) hasSupportRequest = true;
          st.assignees.forEach(a => {
            allAssigneesMap.set(a.employeeId, a);
          });
        });
      }
      const allAssignees = Array.from(allAssigneesMap.values());

      // Calculate max dueDate from subtasks, fallback to input.dueDate or now
      const maxDueDate = this.calculateMaxDueDate(input.subtasks) || (input.dueDate ? new Date(input.dueDate) : now);

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
        assignees: allAssignees,
        dueDate: maxDueDate,
        status: input.status || 'upcoming',
        currentRevision: isNewTask ? 'rev00' : (existingTaskData?.currentRevision || 'rev00'),
        revisionId: isNewTask ? 'rev00' : (existingTaskData?.revisionId || 'rev00'),
        revisionName: isNewTask ? input.taskName : (existingTaskData?.revisionName || input.taskName),
        dailyProgress: isNewTask ? 0 : (existingTaskData?.dailyProgress || 0),
        attachmentsCount: isNewTask ? 0 : (existingTaskData?.attachmentsCount || 0),
        isActive: true,
        isSupportRequest: hasSupportRequest,
        createdAt: createdAtDate,
        updatedAt: now,
        createdBy: isNewTask ? createdBy : (existingTaskData?.createdBy || createdBy),
        updatedBy: createdBy,
        supportedRevisionIds: [],
        historicalAssigneeIds: Array.from(new Set([
          ...(existingTaskData?.historicalAssigneeIds || []),
          ...allAssignees.map(a => a.employeeId),
          createdBy
        ]))
      };
      transaction.set(taskRef.withConverter(taskConverter), newTaskData as any, { merge: true });

      if (isNewTask && input.subtasks && input.subtasks.length > 0) {
        input.subtasks.forEach((st, index) => {
          const subtaskNum = (index + 1).toString().padStart(4, '0');
          const subtaskId = `${taskId}-${subtaskNum}`;
          const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);
          
          const subtaskData = {
            id: `${woId}__${catId}__${taskId}__${subtaskId}`,
            subtaskId: subtaskId,
            subtaskName: st.subtaskName,
            status: input.status || 'upcoming',
            assignees: st.assignees,
            dailyProgress: 0,
            currentRevision: 'rev00',
            isSupportRequest: st.isSupportRequest || false,
            dueDate: st.dueDate ? new Date(st.dueDate) : null,
            editHistory: [],
            createdAt: createdAtDate,
            updatedAt: now,
            createdBy: createdBy,
            updatedBy: createdBy,
            historicalAssigneeIds: Array.from(new Set([
              ...st.assignees.map(a => a.employeeId),
              createdBy
            ]))
          };
          
          transaction.set(subtaskRef, subtaskData);
          
          const rev00Ref = subtaskRef.collection('revisions').doc('rev00');
          transaction.set(rev00Ref, {
            revisionId: 'rev00',
            revisionName: st.subtaskName,
            taskName: st.subtaskName,
            assignees: st.assignees,
            createdAt: createdAtDate,
            createdBy: createdBy,
          });
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
    const { taskRef, subtaskRef } = await this.resolveRefs(id);
    const admin = require('firebase-admin');

    await afterSaleDb.runTransaction(async (transaction) => {
      // 1. อ่านข้อมูล Task ปัจจุบัน
      const doc = await transaction.get(taskRef);
      if (!doc.exists) throw new AppError('Task not found', 404);
      const taskData = doc.data() as Task;

      // 2. คำนวณ Revision ใหม่
      const currentRev = taskData.currentRevision || 'rev00';
      const revNum = parseInt(currentRev.replace('rev', ''), 10);
      const nextRevId = `rev${String(revNum + 1).padStart(2, '0')}`;
      const now = new Date();

      // 3. สะสม (Union) Assignees
      const existingAssignees = taskData.assignees || [];
      const mergedAssignees = [...existingAssignees];
      for (const newAssignee of newAssignees) {
        if (!mergedAssignees.find(a => a.employeeId === newAssignee.employeeId)) {
          mergedAssignees.push(newAssignee);
        }
      }

      if (subtaskRef) {
        // Reject specific subtask
        const subtaskDoc = await transaction.get(subtaskRef);
        if (!subtaskDoc.exists) throw new AppError('Subtask not found', 404);
        const subtaskData = subtaskDoc.data();
        if (!subtaskData) throw new AppError('Subtask data is empty', 404);

        // 1. Create next revision for this subtask only
        const nextRevRef = subtaskRef.collection('revisions').doc(nextRevId);
        transaction.set(nextRevRef, {
          revisionId: nextRevId,
          revisionName: revisionName,
          taskName: subtaskData.subtaskName,
          assignees: newAssignees, 
          createdAt: now,
          createdBy: updatedBy,
        });

        // 2. Update subtask document (reset progress, bump revision, set status rework)
        transaction.update(subtaskRef, {
          currentRevision: nextRevId,
          dailyProgress: 0,
          status: 'rework',
          assignees: newAssignees,
          updatedAt: now,
          updatedBy: updatedBy
        });

        // 3. Recalculate average progress for parent task
        const subtasksQuery = await transaction.get(taskRef.collection('subtasks'));
        const allSubtasks = subtasksQuery.docs.map(d => {
          if (d.id === subtaskRef.id) {
            return { ...d.data(), dailyProgress: 0, status: 'rework' };
          }
          return d.data();
        });
        const totalProgress = allSubtasks.reduce((sum, st) => sum + (st.dailyProgress || 0), 0);
        const averageProgress = Math.round(totalProgress / allSubtasks.length);

        // Update parent task revision and status
        const taskUpdates = {
          currentRevision: nextRevId,
          revisionId: nextRevId,
          revisionName: revisionName,
          dailyProgress: averageProgress,
          status: 'in-progress' as any,
          assignees: mergedAssignees,
          updatedAt: now,
          updatedBy: updatedBy,
          revisionCreatedAt: now,
          historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...newAssignees.map(a => a.employeeId), updatedBy) as any
        };
        transaction.update(taskRef, taskUpdates);
        await this.recordHistory(taskRef, 'reject_subtask', taskData, { subtaskId: subtaskRef.id, ...taskUpdates }, updatedBy);
      } else {
        // Reject parent task directly
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
          revisionCreatedAt: now,
          historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...newAssignees.map(a => a.employeeId), updatedBy) as any
        };
        transaction.update(taskRef, taskUpdates);

        // สร้างเอกสาร Revision ใหม่ ภายใต้ "ทุก Subtasks" ของงานนี้
        const subtasksSnap = await transaction.get(taskRef.collection('subtasks'));
        subtasksSnap.docs.forEach(doc => {
          const nextRevRef = doc.ref.collection('revisions').doc(nextRevId);
          transaction.set(nextRevRef, {
            revisionId: nextRevId,
            revisionName: revisionName,
            taskName: doc.data().subtaskName || taskData.taskName,
            assignees: doc.data().assignees || newAssignees, 
            createdAt: now,
            createdBy: updatedBy,
          });

          transaction.update(doc.ref, {
            currentRevision: nextRevId,
            dailyProgress: 0,
            status: 'upcoming',
            updatedAt: now,
            updatedBy: updatedBy
          });
        });

        await this.recordHistory(taskRef, 'reject_task', taskData, taskUpdates, updatedBy);
      }
    });
  }

  /**
   * Approve งานที่ For Checking
   * เปลี่ยนสถานะเป็น completed
   */
  async approveTask(id: string, updatedBy: string): Promise<void> {
    const { taskRef, subtaskRef } = await this.resolveRefs(id);

    await afterSaleDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(taskRef);
      if (!doc.exists) throw new AppError('Task not found', 404);
      
      const now = new Date();
      const updates = {
        status: 'completed' as any,
        updatedAt: now,
        updatedBy: updatedBy,
      };

      if (subtaskRef) {
        // Approve specific subtask
        const subtaskDoc = await transaction.get(subtaskRef);
        if (!subtaskDoc.exists) throw new AppError('Subtask not found', 404);
        
        transaction.update(subtaskRef, {
          status: 'completed',
          updatedAt: now,
          updatedBy: updatedBy
        });

        // Recalculate parent task progress & status
        const subtasksQuery = await transaction.get(taskRef.collection('subtasks'));
        const allSubtasks = subtasksQuery.docs.map(d => {
          if (d.id === subtaskRef.id) {
            return { ...d.data(), status: 'completed' };
          }
          return d.data();
        });

        const totalProgress = allSubtasks.reduce((sum, st) => sum + (st.dailyProgress || 0), 0);
        const averageProgress = Math.round(totalProgress / allSubtasks.length);
        
        const allCompleted = allSubtasks.every(st => st.status === 'completed');
        const hasInProgress = allSubtasks.some(st => st.status === 'in-progress' || st.status === 'rework' || st.status === 'for-checking');
        
        let parentStatus = doc.data()?.status || 'upcoming';
        if (allCompleted) {
          parentStatus = 'completed';
        } else if (hasInProgress) {
          parentStatus = 'in-progress';
        }

        const taskUpdates = {
          dailyProgress: averageProgress,
          status: parentStatus,
          updatedAt: now,
          updatedBy: updatedBy
        };
        transaction.update(taskRef, taskUpdates);
        await this.recordHistory(taskRef, 'approve_subtask', doc.data(), { subtaskId: subtaskRef.id, ...taskUpdates }, updatedBy);
      } else {
        // Approve parent task directly
        transaction.update(taskRef, updates);
        await this.recordHistory(taskRef, 'approve_task', doc.data(), updates, updatedBy);
      }
    });
  }

  /**
   * ทีม Support เข้าร่วม Task เดิมของ Site
   * - สะสม Assignee ใน Task หลัก
   * - สร้าง collection `held` และ document `held00`
   */
  async joinSupportTask(id: string, supportTaskName: string, supportAssignees: any[], updatedBy: string, subtaskId?: string): Promise<void> {
    console.log(`[TaskService] joinSupportTask called for id: ${id}, subtaskId: ${subtaskId}`);
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
        const now = new Date();

        if (subtaskId) {
          // --- CASE A: SUBTASK-SPECIFIC SUPPORT JOIN ---
          const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);
          const subtaskDoc = await transaction.get(subtaskRef);
          if (!subtaskDoc.exists) {
            throw new AppError('ไม่พบงานย่อยที่ระบุ (Subtask not found)', 404);
          }
          const subtaskData = subtaskDoc.data() as any;
          if (subtaskData.isPickedUpBySupport) {
            throw new AppError('งานย่อยนี้มีทีม Support รับไปแล้ว', 400);
          }

          const subtaskRev = subtaskData.currentRevision || 'rev00';
          const subtaskRevNum = subtaskRev.replace('rev', '');
          const helpId = `help${subtaskRevNum}`;

          // อัปเดตข้อมูลระดับ Subtask
          const subtaskUpdates = {
            isPickedUpBySupport: true,
            supportTaskName: supportTaskName,
            supportAssignees: supportAssignees,
            supportDailyProgress: 0,
            supportCreatedAt: now,
            updatedAt: now,
            updatedBy: updatedBy,
            supportedRevisionIds: admin.firestore.FieldValue.arrayUnion(subtaskRev) as any,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...supportAssignees.map(a => a.employeeId), updatedBy) as any
          };
          transaction.update(subtaskRef, subtaskUpdates);

          // สร้าง helpXX ในระดับ Subtask ที่เลือก
          const helpRef = subtaskRef.collection('help').doc(helpId);
          transaction.set(helpRef, {
            revisionId: helpId,
            revisionName: supportTaskName,
            taskName: supportTaskName, 
            assignees: supportAssignees, 
            createdAt: now,
            createdBy: updatedBy,
          });

          // อัปเดต Task แม่: สะสม supportAssignees และตั้งค่าสถานะ
          const existingSupportAssignees = taskData.supportAssignees || [];
          const supportAssigneesMap = new Map<string, any>();
          existingSupportAssignees.forEach(a => supportAssigneesMap.set(a.employeeId, a));
          supportAssignees.forEach(a => supportAssigneesMap.set(a.employeeId, a));
          const accumulatedSupportAssignees = Array.from(supportAssigneesMap.values());

          const taskUpdates = {
            isPickedUpBySupport: true,
            supportAssignees: accumulatedSupportAssignees,
            updatedAt: now,
            updatedBy: updatedBy,
            supportedRevisionIds: admin.firestore.FieldValue.arrayUnion(taskData.currentRevision || 'rev00') as any,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...supportAssignees.map(a => a.employeeId), updatedBy) as any
          };
          transaction.update(taskRef, taskUpdates);

          // เก็บ Audit Trail
          await this.recordHistory(taskRef, 'support_join', taskData, taskUpdates, updatedBy);

        } else {
          // --- CASE B: BACKWARD COMPATIBILITY / TASK-LEVEL JOIN ---
          if (taskData.isPickedUpBySupport) {
            throw new AppError('Task นี้มีทีม Support รับไปแล้ว', 400);
          }

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
            supportCreatedAt: now,
            supportedRevisionIds: admin.firestore.FieldValue.arrayUnion(currentRev) as any,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...supportAssignees.map(a => a.employeeId), updatedBy) as any
          };
          transaction.update(taskRef, taskUpdates);

          // สร้าง helpXX ภายใต้ "ทุก Subtasks"
          const subtasksSnap = await transaction.get(taskRef.collection('subtasks'));
          subtasksSnap.docs.forEach(stDoc => {
            const helpRef = stDoc.ref.collection('help').doc(helpId);
            transaction.set(helpRef, {
              revisionId: helpId,
              revisionName: supportTaskName,
              taskName: supportTaskName, 
              assignees: supportAssignees, 
              createdAt: now,
              createdBy: updatedBy,
            });
          });

          // เก็บ Audit Trail
          await this.recordHistory(taskRef, 'support_join', taskData, taskUpdates, updatedBy);
        }

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

  /**
   * ดึงรายการงานย่อยของ Task (Subtasks)
   */
  async getSubtasks(taskId: string): Promise<any[]> {
    let taskRef: FirebaseFirestore.DocumentReference;
    if (taskId.includes('__')) {
      const [woId, catId, id] = taskId.split('__');
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(id);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', taskId).limit(1).get();
      if (querySnapshot.empty) return [];
      taskRef = querySnapshot.docs[0].ref;
    }
    
    const snapshot = await taskRef.collection('subtasks').get();
    return snapshot.docs.map(doc => {
      const subData = doc.data();
      const safeDate = (val: any): Date => {
        if (!val) return new Date();
        if (typeof val.toDate === 'function') return val.toDate();
        if (typeof val === 'string') return new Date(val);
        return val;
      };
      return {
        ...subData,
        dueDate: subData.dueDate ? safeDate(subData.dueDate) : safeDate(subData.createdAt || new Date()),
        editHistory: subData.editHistory ? subData.editHistory.map((h: any) => ({
          ...h,
          updatedAt: safeDate(h.updatedAt),
          changes: Array.isArray(h.changes) ? h.changes.map((c: any) => ({
            ...c,
            oldValue: c.field === 'dueDate' && c.oldValue ? safeDate(c.oldValue) : c.oldValue,
            newValue: c.field === 'dueDate' && c.newValue ? safeDate(c.newValue) : c.newValue,
          })) : []
        })) : [],
        createdAt: safeDate(subData.createdAt),
        updatedAt: safeDate(subData.updatedAt),
      };
    });
  }

  /**
   * สร้าง Subtask ย่อยแบบเดี่ยว (Quick Create) ภายใต้ Task หลัก
   */
  async createSubtask(
    taskId: string,
    input: { subtaskName: string; assignees: TaskAssignee[]; dueDate?: Date | string },
    createdBy: string
  ): Promise<any> {
    const { subtaskName, assignees, dueDate } = input;
    let taskRef: FirebaseFirestore.DocumentReference;
    let woId = '';
    let catId = '';
    let tId = '';
    
    if (taskId.includes('__')) {
      const parts = taskId.split('__');
      woId = parts[0];
      catId = parts[1];
      tId = parts[2];
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(tId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', taskId).limit(1).get();
      if (querySnapshot.empty) {
        throw new AppError('ไม่พบ Task ที่ระบุ', 404);
      }
      taskRef = querySnapshot.docs[0].ref;
      tId = querySnapshot.docs[0].id;
      const pathParts = taskRef.path.split('/');
      woId = pathParts[1];
      catId = pathParts[3];
    }

    return await afterSaleDb.runTransaction(async (transaction) => {
      // 1. Get task doc (READ)
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) {
        throw new AppError('ไม่พบ Task ที่ระบุ', 404);
      }
      const taskData = taskDoc.data();

      // 2. Query existing subtasks to count and determine subtask suffix (READ)
      const subtasksQuery = await transaction.get(taskRef.collection('subtasks'));
      const count = subtasksQuery.size;
      const subtaskNum = (count + 1).toString().padStart(4, '0');
      const subtaskId = `${tId}-${subtaskNum}`;
      const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);

      // 3. Prepare subtask data
      const now = new Date();
      const subtaskData = {
        id: `${woId}__${catId}__${tId}__${subtaskId}`,
        subtaskId: subtaskId,
        subtaskName: subtaskName,
        status: 'upcoming' as TaskStatus,
        assignees: assignees,
        dailyProgress: 0,
        currentRevision: 'rev00',
        isSupportRequest: false,
        dueDate: dueDate ? new Date(dueDate) : null,
        editHistory: [],
        createdAt: now,
        updatedAt: now,
        createdBy: createdBy,
        updatedBy: createdBy,
        historicalAssigneeIds: Array.from(new Set([
          ...assignees.map(a => a.employeeId),
          createdBy
        ]))
      };

      // 4. Write subtask and rev00 (WRITE)
      transaction.set(subtaskRef, subtaskData);

      const rev00Ref = subtaskRef.collection('revisions').doc('rev00');
      transaction.set(rev00Ref, {
        revisionId: 'rev00',
        revisionName: subtaskName,
        taskName: subtaskName,
        assignees: assignees,
        createdAt: now,
        createdBy: createdBy,
      });

      // 5. Update Task's historicalAssignees and assignees list if needed
      const currentAssigneesMap = new Map<string, any>();
      taskData?.assignees?.forEach((a: any) => currentAssigneesMap.set(a.employeeId, a));
      assignees.forEach((a: any) => currentAssigneesMap.set(a.employeeId, a));
      
      const updatedAssignees = Array.from(currentAssigneesMap.values());
      const historicalIds = Array.from(new Set([
        ...(taskData?.historicalAssigneeIds || []),
        ...assignees.map(a => a.employeeId),
      ]));

      // 6. Recalculate average progress for parent task and compute max dueDate
      const allSubtasks = subtasksQuery.docs.map(d => d.data());
      // Add the new subtask to the calculation
      allSubtasks.push(subtaskData);
      const totalProgress = allSubtasks.reduce((sum, st) => sum + (st.dailyProgress || 0), 0);
      const averageProgress = Math.round(totalProgress / allSubtasks.length);
      const maxDueDate = this.calculateMaxDueDate(allSubtasks);

      // Determine parent status
      let parentStatus = taskData?.status || 'upcoming';
      const hasInProgress = allSubtasks.some(st => st.status === 'in-progress' || st.status === 'rework' || st.status === 'for-checking');
      const allCompleted = allSubtasks.every(st => st.status === 'completed');
      
      if (allCompleted) {
        parentStatus = 'completed';
      } else if (hasInProgress) {
        parentStatus = 'in-progress';
      }

      const taskUpdates: any = {
        assignees: updatedAssignees,
        historicalAssigneeIds: historicalIds,
        dailyProgress: averageProgress,
        status: parentStatus,
        updatedAt: now,
        updatedBy: createdBy
      };
      if (maxDueDate) {
        taskUpdates.dueDate = maxDueDate;
      }

      transaction.update(taskRef, taskUpdates);

      return subtaskData;
    });
  }

  async getTasks(filters?: { projectId?: string; assigneeId?: string }): Promise<Task[]> {
    // [TEMPORARY REVERT - Phase 1: Performance Fix] 
    // ใช้การกรองใน Memory ชั่วคราวเพื่อเลี่ยง Error 500 (FAILED_PRECONDITION) เนื่องจากยังไม่ได้สร้าง Index ใน Firebase Console
    // สำหรับระบบที่มีข้อมูลเยอะ ควรไปสร้าง Index ใน Firebase Console แล้วเปลี่ยนกลับไปใช้ .where()
    const snapshot = await afterSaleDb.collectionGroup('tasks').withConverter(taskConverter).get();
    
    // [NEW] Populate supportedRevisionIds for old tasks on-the-fly and fetch subtasks
    let tasks = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data() as Task;
      if (!data.supportedRevisionIds) {
        // If the array is missing, try to detect it from the 'help' subcollection
        const helpSnapshot = await doc.ref.collection('help').get();
        // Convert 'help00' -> 'rev00'
        data.supportedRevisionIds = helpSnapshot.docs.map(h => h.id.replace('help', 'rev'));
      }

      // Fetch all subtasks for this task
      const pathParts = doc.ref.path.split('/');
      const woId = pathParts[1];
      const catId = pathParts[3];
      const taskId = pathParts[5];

      const subtasksSnapshot = await doc.ref.collection('subtasks').get();
      data.subtasks = subtasksSnapshot.docs.map(subDoc => {
        const subData = subDoc.data();
        const safeDate = (val: any): Date => {
          if (!val) return new Date();
          if (typeof val.toDate === 'function') return val.toDate();
          if (typeof val === 'string') return new Date(val);
          return val;
        };
        return {
          id: subData.id || `${woId}__${catId}__${taskId}__${subDoc.id}`,
          subtaskId: subData.subtaskId || '',
          subtaskName: subData.subtaskName || '',
          status: subData.status || 'upcoming',
          assignees: subData.assignees || [],
          dailyProgress: subData.dailyProgress || 0,
          currentRevision: subData.currentRevision || 'rev00',
          revisionId: subData.revisionId || subData.currentRevision || 'rev00',
          revisionName: subData.revisionName || '',
          revisionCreatedAt: subData.revisionCreatedAt ? safeDate(subData.revisionCreatedAt) : safeDate(subData.createdAt),
          isSupportRequest: subData.isSupportRequest || false,
          isPickedUpBySupport: subData.isPickedUpBySupport || false,
          supportTaskName: subData.supportTaskName || '',
          supportDailyProgress: subData.supportDailyProgress || 0,
          supportAssignees: subData.supportAssignees || [],
          supportCreatedAt: subData.supportCreatedAt ? safeDate(subData.supportCreatedAt) : safeDate(subData.createdAt),
          supportedRevisionIds: subData.supportedRevisionIds || [],
          unlockedDates: subData.unlockedDates ? Object.keys(subData.unlockedDates).reduce((acc, key) => {
            acc[key] = {
              ...subData.unlockedDates[key],
              unlockedUntil: safeDate(subData.unlockedDates[key].unlockedUntil),
            };
            return acc;
          }, {} as Record<string, any>) : {},
          unlockRequests: subData.unlockRequests ? Object.keys(subData.unlockRequests).reduce((acc, key) => {
            acc[key] = {
              ...subData.unlockRequests[key],
              requestedAt: safeDate(subData.unlockRequests[key].requestedAt),
            };
            return acc;
          }, {} as Record<string, any>) : {},
          supportUnlockedDates: subData.supportUnlockedDates ? Object.keys(subData.supportUnlockedDates).reduce((acc, key) => {
            acc[key] = {
              ...subData.supportUnlockedDates[key],
              unlockedUntil: safeDate(subData.supportUnlockedDates[key].unlockedUntil),
            };
            return acc;
          }, {} as Record<string, any>) : {},
          supportUnlockRequests: subData.supportUnlockRequests ? Object.keys(subData.supportUnlockRequests).reduce((acc, key) => {
            acc[key] = {
              ...subData.supportUnlockRequests[key],
              requestedAt: safeDate(subData.supportUnlockRequests[key].requestedAt),
            };
            return acc;
          }, {} as Record<string, any>) : {},
          dueDate: subData.dueDate ? safeDate(subData.dueDate) : safeDate(data.dueDate || new Date()),
          editHistory: subData.editHistory ? subData.editHistory.map((h: any) => ({
            ...h,
            updatedAt: safeDate(h.updatedAt),
            changes: Array.isArray(h.changes) ? h.changes.map((c: any) => ({
              ...c,
              oldValue: c.field === 'dueDate' && c.oldValue ? safeDate(c.oldValue) : c.oldValue,
              newValue: c.field === 'dueDate' && c.newValue ? safeDate(c.newValue) : c.newValue,
            })) : []
          })) : [],
          createdAt: safeDate(subData.createdAt),
          updatedAt: safeDate(subData.updatedAt),
          createdBy: subData.createdBy || '',
          updatedBy: subData.updatedBy || '',
          historicalAssigneeIds: subData.historicalAssigneeIds || [],
        };
      });

      return data;
    }));
    
    // กรอง isActive ใน Memory
    tasks = tasks.filter(task => task.isActive === true);

    // กรองไม่แสดงงานของ After-Sale (workOrderCode == 'WOA' หรือ 'WOP') ออกจากระบบ
    tasks = tasks.filter(task => {
      const woCode = String(task.workOrderCode || '').toUpperCase().trim();
      return woCode !== 'WOA' && woCode !== 'WOP';
    });

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
      // 1. Resolve task reference outside transaction to avoid query inside transaction
      let taskRef: FirebaseFirestore.DocumentReference;
      let oldWoId: string = '', oldCatId: string = '', oldTaskId: string = '';

      if (id.includes('__')) {
        [oldWoId, oldCatId, oldTaskId] = id.split('__');
        taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories').doc(oldCatId).collection('tasks').doc(oldTaskId);
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) throw new AppError('Task not found', 404);
        taskRef = querySnapshot.docs[0].ref;
        oldTaskId = id;
        const pathParts = taskRef.path.split('/');
        oldWoId = pathParts[1];
        oldCatId = pathParts[3];
      }

      await afterSaleDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(taskRef);
        if (!doc.exists) throw new AppError('ไม่พบข้อมูลงานที่ต้องการแก้ไข (Task not found)', 404);
        
        const oldData = doc.data() as any;
        const now = new Date();

        // Process Subtasks (Aggregate assignees)
        const allAssigneesMap = new Map<string, any>();
        let hasSupportRequest = false;

        const subtasksRef = taskRef.collection('subtasks');
        const existingSubtasksSnap = await transaction.get(subtasksRef);
        const existingSubtasks = existingSubtasksSnap.docs.map(d => d.data());
        
        let currentSubtaskRun = existingSubtasks.length + 1;

        if (input.subtasks) {
          hasSupportRequest = input.subtasks.some(st => st.isSupportRequest) || false;
          input.subtasks.forEach(st => {
            st.assignees.forEach(a => {
              allAssigneesMap.set(a.employeeId, a);
            });
          });
        }
        const allAssignees = Array.from(allAssigneesMap.values());

        // Calculate final subtask list for dueDate aggregation
        let maxDueDate = oldData.dueDate ? (oldData.dueDate.toDate ? oldData.dueDate.toDate() : new Date(oldData.dueDate)) : null;
        if (input.subtasks) {
          const finalSubtasks: any[] = [];
          existingSubtasks.forEach(oldSt => {
            const updatedSt = input.subtasks!.find(x => x.subtaskId === oldSt.subtaskId);
            if (updatedSt) {
              finalSubtasks.push({
                ...oldSt,
                dueDate: updatedSt.dueDate ? new Date(updatedSt.dueDate) : null
              });
            } else {
              finalSubtasks.push(oldSt);
            }
          });
          // Add new subtasks
          input.subtasks.forEach(stInput => {
            if (!stInput.subtaskId) {
              finalSubtasks.push({
                dueDate: stInput.dueDate ? new Date(stInput.dueDate) : null
              });
            }
          });
          
          const calculatedMaxDueDate = this.calculateMaxDueDate(finalSubtasks);
          if (calculatedMaxDueDate) {
            maxDueDate = calculatedMaxDueDate;
          }
        }

        // Sanitize input: Remove undefined values and subtasks
        const sanitizedInput = Object.keys(input).reduce((obj: any, key) => {
          const val = (input as any)[key];
          if (val !== undefined && key !== 'subtasks') obj[key] = val;
          return obj;
        }, {});

        // Category Migration
        let activeTaskRef = taskRef;
        if (input.categoryName && input.categoryName !== oldData.categoryName) {
          const newCategoryRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories');
          const catQuery = await newCategoryRef.where('catName', '==', input.categoryName).limit(1).get();
          let targetCatId = '';
          
          if (!catQuery.empty) {
            targetCatId = catQuery.docs[0].id;
          } else {
            // Note: Cannot easily create counters safely inside this transaction if we don't read them first.
            // For simplicity in this fix, we assume we just reuse a generic fallback or generate a random ID if not found.
            // To be safe, we'll just throw an error or use a timestamp for category ID if it's new.
            targetCatId = `CAT-${now.getTime()}`;
            transaction.set(newCategoryRef.doc(targetCatId), { catId: targetCatId, catName: input.categoryName }, { merge: true });
          }

          activeTaskRef = newCategoryRef.doc(targetCatId).collection('tasks').doc(oldTaskId);
          const newData = { ...oldData, ...sanitizedInput, categoryId: targetCatId, updatedAt: now, updatedBy };
          if (input.subtasks) {
            newData.assignees = allAssignees;
            newData.historicalAssigneeIds = Array.from(new Set([...(oldData.historicalAssigneeIds || []), ...allAssignees.map(a => a.employeeId)]));
            newData.isSupportRequest = hasSupportRequest;
            newData.dueDate = maxDueDate;
          }
          transaction.set(activeTaskRef, newData);
          transaction.delete(taskRef);
          
          // Move existing subtasks to new path (simplified for migration)
          existingSubtasks.forEach(st => {
            transaction.set(activeTaskRef.collection('subtasks').doc(st.subtaskId), st);
          });
        } else {
          const updates: any = { ...sanitizedInput, updatedAt: now, updatedBy };
          if (input.subtasks) {
            updates.assignees = allAssignees;
            updates.historicalAssigneeIds = admin.firestore.FieldValue.arrayUnion(...allAssignees.map(a => a.employeeId));
            updates.isSupportRequest = hasSupportRequest;
            updates.dueDate = maxDueDate;
          }
          transaction.update(activeTaskRef, updates);
        }
        
        // Update Subtasks
        if (input.subtasks) {
          input.subtasks.forEach(stInput => {
            if (stInput.subtaskId) {
              const stRef = activeTaskRef.collection('subtasks').doc(stInput.subtaskId);
              const oldSt = existingSubtasks.find(x => x.subtaskId === stInput.subtaskId) || {};
              const changes: any[] = [];

              if (stInput.subtaskName !== undefined && oldSt.subtaskName !== stInput.subtaskName) {
                changes.push({
                  field: 'subtaskName',
                  oldValue: oldSt.subtaskName || '',
                  newValue: stInput.subtaskName
                });
              }

              if (stInput.assignees !== undefined && !this.compareAssignees(oldSt.assignees, stInput.assignees)) {
                changes.push({
                  field: 'assignees',
                  oldValue: oldSt.assignees || [],
                  newValue: stInput.assignees
                });
              }

              if (stInput.dueDate !== undefined && !this.compareDates(oldSt.dueDate, stInput.dueDate)) {
                changes.push({
                  field: 'dueDate',
                  oldValue: oldSt.dueDate ? (oldSt.dueDate.toDate ? oldSt.dueDate.toDate() : new Date(oldSt.dueDate)) : null,
                  newValue: stInput.dueDate ? new Date(stInput.dueDate) : null
                });
              }

              const newIsSupport = stInput.isSupportRequest || false;
              const oldIsSupport = oldSt.isSupportRequest || false;
              if (newIsSupport !== oldIsSupport) {
                changes.push({
                  field: 'isSupportRequest',
                  oldValue: oldIsSupport,
                  newValue: newIsSupport
                });
              }

              const subtaskUpdates: any = {
                subtaskName: stInput.subtaskName,
                assignees: stInput.assignees,
                isSupportRequest: newIsSupport,
                updatedAt: now,
                updatedBy: updatedBy,
                historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...stInput.assignees.map(a => a.employeeId))
              };

              if (stInput.dueDate !== undefined) {
                subtaskUpdates.dueDate = stInput.dueDate ? new Date(stInput.dueDate) : null;
              }

              if (changes.length > 0) {
                const historyRecord = {
                  updatedAt: now,
                  updatedBy: updatedBy,
                  changes: changes
                };
                subtaskUpdates.editHistory = admin.firestore.FieldValue.arrayUnion(historyRecord);
              }

              transaction.update(stRef, subtaskUpdates);
            } else {
              const subtaskNum = (currentSubtaskRun++).toString().padStart(4, '0');
              const subtaskId = `${oldTaskId}-${subtaskNum}`;
              const stRef = activeTaskRef.collection('subtasks').doc(subtaskId);
              transaction.set(stRef, {
                id: `${oldWoId}__${activeTaskRef.parent.parent?.id}__${oldTaskId}__${subtaskId}`,
                subtaskId: subtaskId,
                subtaskName: stInput.subtaskName,
                status: 'upcoming',
                assignees: stInput.assignees,
                dailyProgress: 0,
                currentRevision: 'rev00',
                isSupportRequest: stInput.isSupportRequest || false,
                dueDate: stInput.dueDate ? new Date(stInput.dueDate) : null,
                editHistory: [],
                createdAt: now,
                updatedAt: now,
                createdBy: updatedBy,
                updatedBy: updatedBy,
                historicalAssigneeIds: Array.from(new Set([...stInput.assignees.map(a => a.employeeId), updatedBy]))
              });
              const rev00Ref = stRef.collection('revisions').doc('rev00');
              transaction.set(rev00Ref, {
                revisionId: 'rev00',
                revisionName: stInput.subtaskName,
                taskName: stInput.subtaskName,
                assignees: stInput.assignees,
                createdAt: now,
                createdBy: updatedBy,
              });
            }
          });
        }
      });
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

  private compareDates = (d1: any, d2: any): boolean => {
    if (!d1 && !d2) return true;
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = d2.toDate ? d2.toDate() : new Date(d2);
    return date1.getTime() === date2.getTime();
  };

  private calculateMaxDueDate = (subtasks: any[]): Date | null => {
    let maxDate: Date | null = null;
    (subtasks || []).forEach(st => {
      if (st.dueDate) {
        const date = st.dueDate.toDate ? st.dueDate.toDate() : new Date(st.dueDate);
        if (!isNaN(date.getTime())) {
          if (!maxDate || date.getTime() > maxDate.getTime()) {
            maxDate = date;
          }
        }
      }
    });
    return maxDate;
  };

  private compareAssignees = (a1: any[], a2: any[]): boolean => {
    const list1 = (a1 || []).map(a => String(a.employeeId || a.id || '').trim().toLowerCase()).sort();
    const list2 = (a2 || []).map(a => String(a.employeeId || a.id || '').trim().toLowerCase()).sort();
    if (list1.length !== list2.length) return false;
    return list1.every((val, index) => val === list2[index]);
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
    console.log(`[TaskService] Submitting daily report for subtask: ${id}`, reportData);
    
    const { taskRef, subtaskRef } = await this.resolveRefs(id);

    const reportDate = new Date(reportData.reportDate);
    const year = reportDate.getFullYear();
    const month = String(reportDate.getMonth() + 1).padStart(2, '0');
    const day = String(reportDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Get current revision first
    const docForRev = await (subtaskRef || taskRef).get();
    if (!docForRev.exists) throw new AppError('Task/Subtask not found', 404);
    const dataForRev = docForRev.data() || {};
    const currentRev = dataForRev.currentRevision || 'rev00';
    // บันทึกรายงานภายใต้ Revision หรือ Help
    let dailyReportRef: FirebaseFirestore.DocumentReference;
    const targetRefForReport = subtaskRef || taskRef;
    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      dailyReportRef = targetRefForReport.collection('help').doc(helpId).collection('dailyReports').doc(dateStr);
    } else {
      dailyReportRef = targetRefForReport.collection('revisions').doc(currentRev).collection('dailyReports').doc(dateStr);
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
    const unlockedDates = dataForRev[unlockedDatesField] || {};
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
      if (dataForRev.revisionCreatedAt && currentRev !== 'rev00') {
        const revisionCreatedAt = dataForRev.revisionCreatedAt.toDate ? dataForRev.revisionCreatedAt.toDate() : new Date(dataForRev.revisionCreatedAt);
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

    // --- [NEW] Global Cross-Task Overlap Validation ---
    if (reportData.labor && Array.isArray(reportData.labor) && reportData.labor.length > 0) {
      const startOfDay = new Date(reportDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(reportDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // [TEMPORARY REVERT] ใช้การกรองใน Memory ชั่วคราวเพื่อเลี่ยง Error 500 (FAILED_PRECONDITION)
      // เนื่องจาก Firebase ต้องการ COLLECTION_GROUP_ASC index สำหรับ dailyReports (reportDate)
      // เมื่อสร้าง Index แล้ว ควรเปลี่ยนกลับมาใช้ .where('reportDate', '>=', startOfDay) เพื่อลด Read Cost
      const allReportsQuerySnapshot = await afterSaleDb.collectionGroup('dailyReports').get();
      const allReportsDocs = allReportsQuerySnapshot.docs.filter(doc => {
        const data = doc.data();
        if (!data.reportDate) return false;
        const dDate = data.reportDate.toDate ? data.reportDate.toDate() : new Date(data.reportDate);
        return dDate.getTime() >= startOfDay.getTime() && dDate.getTime() <= endOfDay.getTime();
      });

      const parseTimeToMinutes = (tStr: string | null | undefined): {start: number, end: number} | null => {
        if (!tStr) return null;
        const parts = tStr.split('-');
        if (parts.length !== 2) return null;
        const parseTime = (timeStr: string) => {
          const [h, m] = timeStr.trim().split(':').map(Number);
          if (isNaN(h) || isNaN(m)) return null;
          return (h * 60) + m;
        };
        const start = parseTime(parts[0]);
        let end = parseTime(parts[1]);
        if (start === null || end === null) return null;
        if (end < start) end += 24 * 60;
        return { start, end };
      };

      const isTimeOverlap = (timeA: string | null | undefined, timeB: string | null | undefined): boolean => {
        const a = parseTimeToMinutes(timeA);
        const b = parseTimeToMinutes(timeB);
        if (!a || !b) return false;
        return Math.max(a.start, b.start) < Math.min(a.end, b.end);
      };

      for (const laborInput of reportData.labor) {
        if (!laborInput.workerId || !laborInput.shiftTimes) continue;
        const shiftsA = [
          laborInput.shiftTimes.day,
          laborInput.shiftTimes.otMorning,
          laborInput.shiftTimes.otNoon,
          laborInput.shiftTimes.otEvening
        ].filter(Boolean);
        
        if (shiftsA.length === 0) continue;

        for (const doc of allReportsDocs) {
          if (doc.ref.path === dailyReportRef.path) continue;
          
          const otherData = doc.data();
          if (!otherData.labor || !Array.isArray(otherData.labor)) continue;
          
          const matchingLabor = otherData.labor.find((l: any) => l.workerId === laborInput.workerId);
          if (!matchingLabor || !matchingLabor.shiftTimes) continue;
          
          const shiftsB = [
            matchingLabor.shiftTimes.day,
            matchingLabor.shiftTimes.otMorning,
            matchingLabor.shiftTimes.otNoon,
            matchingLabor.shiftTimes.otEvening
          ].filter(Boolean);
          
          for (const sA of shiftsA) {
            for (const sB of shiftsB) {
              if (isTimeOverlap(sA as string, sB as string)) {
                throw new AppError(`ไม่อนุญาตให้บันทึก: พบแรงงาน (รหัส ${laborInput.employeeId || laborInput.workerId}) ลงเวลาซ้อนทับกับงานอื่น (${sA} ทับซ้อนกับ ${sB})`, 400);
              }
            }
          }
        }
      }
    }
    // --- [NEW] Cross-Revision Conflict Validation ---
    if (!isSupportReport) {
      // Check if any revision (other than current) has a report for this date
      const revisionsSnapshot = await targetRefForReport.collection('revisions').get();
      const allRevIds = revisionsSnapshot.docs.map(d => d.id);
      
      for (const revId of allRevIds) {
        if (revId === currentRev) continue; // Skip current
        
        const otherReportRef = targetRefForReport.collection('revisions').doc(revId).collection('dailyReports').doc(dateStr);
        const otherReportDoc = await otherReportRef.get();
        if (otherReportDoc.exists) {
          throw new AppError(`มีข้อมูลรายงานในวันที่ ${dateStr} อยู่ใน ${revId} แล้ว ไม่สามารถลงข้อมูลทับซ้อนกันได้`, 400);
        }
      }
    } else {
      // Check help/support reports as well
      const helpSnapshot = await targetRefForReport.collection('help').get();
      const allHelpIds = helpSnapshot.docs.map(d => d.id);
      const helpIdToMatch = currentRev.replace('rev', 'help');
      
      for (const hId of allHelpIds) {
        if (hId === helpIdToMatch) continue; // Skip current

        const otherHelpReportRef = targetRefForReport.collection('help').doc(hId).collection('dailyReports').doc(dateStr);
        const otherHelpReportDoc = await otherHelpReportRef.get();
        if (otherHelpReportDoc.exists) {
          throw new AppError(`มีข้อมูลรายงาน Support ในวันที่ ${dateStr} อยู่ใน ${hId} แล้ว`, 400);
        }
      }
    }


    let taskData: any = null;
    await afterSaleDb.runTransaction(async (transaction) => {
      // 1. ALL READS
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) throw new AppError('Task not found', 404);
      taskData = taskDoc.data();

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

      // Check if this is the latest report chronologically
      const reportsCollectionRef = isSupportReport 
        ? targetRefForReport.collection('help').doc(currentRev.replace('rev', 'help')).collection('dailyReports')
        : targetRefForReport.collection('revisions').doc(currentRev).collection('dailyReports');

      const newerReportsSnapshot = await transaction.get(
        reportsCollectionRef.where(admin.firestore.FieldPath.documentId(), '>', dateStr).limit(1)
      );
      const isLatestDate = newerReportsSnapshot.empty;

      // Fetch sibling subtasks before any writes if subtaskRef is defined
      let subtasksSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
      if (subtaskRef) {
        subtasksSnapshot = await transaction.get(taskRef.collection('subtasks'));
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

      // Enforce leaveType logic
      if (finalReportData.leave && Array.isArray(finalReportData.leave)) {
        finalReportData.leave = finalReportData.leave.map((l: any) => ({
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

      // อัปเดตความก้าวหน้า เฉพาะเมื่อเป็นรายงานของวันล่าสุดเท่านั้น
      if (isLatestDate) {
        if (!isSupportReport) {
          let newStatus = 'upcoming';
          const progress = reportData.progress || 0;
          if (progress > 0 && progress < 100) newStatus = 'in-progress';
          if (progress >= 100) newStatus = 'for-checking';

          if (subtaskRef) {
            // 1. อัปเดตความก้าวหน้าบน Subtask
            transaction.update(subtaskRef, {
              dailyProgress: progress,
              status: newStatus,
              updatedAt: now,
              updatedBy: updatedBy,
              historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
            });

            // 2. คำนวณและอัปเดต Task หลักจาก sibling subtasks
            const subtasksDocs = subtasksSnapshot ? subtasksSnapshot.docs : [];
            let totalProgress = 0;
            let subtaskCount = 0;

            subtasksDocs.forEach(doc => {
              const stData = doc.data();
              const stId = doc.id;
              const stProgress = stId === subtaskRef.id ? progress : (stData.dailyProgress || 0);
              totalProgress += stProgress;
              subtaskCount++;
            });

            const averageProgress = subtaskCount > 0 ? Math.round(totalProgress / subtaskCount) : progress;
            let parentStatus = 'upcoming';
            if (averageProgress > 0 && averageProgress < 100) parentStatus = 'in-progress';
            if (averageProgress >= 100) parentStatus = 'for-checking';

            transaction.update(taskRef, {
              dailyProgress: averageProgress,
              status: parentStatus,
              updatedAt: now,
              updatedBy: updatedBy,
              historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
            });
            historyUpdateData.dailyProgress = averageProgress;
          } else {
            // อัปเดต Task หลักโดยตรง (สำหรับงานธรรมดาที่ไม่มี subtask)
            transaction.update(taskRef, {
              dailyProgress: progress,
              status: newStatus,
              updatedAt: now,
              updatedBy: updatedBy,
              historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
            });
            historyUpdateData.dailyProgress = progress;
          }
        } else {
          // Support Report (no progress updates)
          if (subtaskRef) {
            transaction.update(subtaskRef, {
              updatedAt: now,
              updatedBy: updatedBy,
              historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
            });
          }
          transaction.update(taskRef, {
            updatedAt: now,
            updatedBy: updatedBy,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
          });
        }
      } else {
        // อัปเดตแค่วันที่แก้ไขล่าสุด
        if (subtaskRef) {
          transaction.update(subtaskRef, {
            updatedAt: now,
            updatedBy: updatedBy,
            historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(updatedBy) as any
          });
        }
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
    // Create notification in Firestore
    // -------------------------------------------------------------
    try {
      if (taskData) {
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

        const notificationData: Notification = {
          type: 'daily_report_submit',
          projectId: taskData.projectId || '',
          projectName: taskData.projectName || '',
          workOrderId: taskData.workOrderId || '',
          workOrderName: taskData.workOrderName || '',
          categoryId: taskData.categoryId || '',
          categoryName: taskData.categoryName || '',
          taskId: taskData.taskId || '',
          taskName: taskData.taskName || '',
          subtaskId: subtaskRef ? subtaskRef.id : '',
          subtaskName: subtaskRef ? (dataForRev.subtaskName || '') : '',
          reportDate: dateStr,
          message: `${userFullName} ได้ลงรายงานประจำวันของงาน "${taskData.taskName}"${subtaskRef ? ` > "${dataForRev.subtaskName}"` : ''} สำหรับวันที่ ${dateStr}`,
          createdAt: new Date(),
          createdBy: userEmployeeId,
          createdByName: userFullName,
          readBy: []
        };
        await afterSaleDb.collection('notifications').add(notificationData);
        console.log(`[TaskService] Created notification for daily report submission: ${notificationData.message}`);
      }
    } catch (notiError: any) {
      console.error('Failed to create notification for daily report submission:', notiError.message);
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
    const { taskRef, subtaskRef } = await this.resolveRefs(id);
    const targetRef = subtaskRef || taskRef;

    const docForRev = await targetRef.get();
    if (!docForRev.exists) return null;
    const currentRev = docForRev.data()?.currentRevision || 'rev00';

    if (isSupportReport) {
      const helpId = currentRev.replace('rev', 'help');
      const reportDoc = await targetRef.collection('help').doc(helpId).collection('dailyReports').doc(dateStr).get();
      if (reportDoc.exists) return reportDoc.data();
    } else {
      const reportDoc = await targetRef.collection('revisions').doc(currentRev).collection('dailyReports').doc(dateStr).get();
      if (reportDoc.exists) return reportDoc.data();
    }

    return null;
  }

  /**
   * ดึงข้อมูลรายงานประจำวันทั้งหมดของ Task
   */
  async getAllDailyReports(id: string, isSupportReport?: boolean): Promise<any[]> {
    let targetRef: FirebaseFirestore.DocumentReference;
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length >= 4) {
        const [woId, catId, taskId, subtaskId] = parts;
        targetRef = afterSaleDb.collection('workOrders').doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId).collection('subtasks').doc(subtaskId);
      } else if (parts.length === 3) {
        const [woId, catId, taskId] = parts;
        targetRef = afterSaleDb.collection('workOrders').doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) return [];
        targetRef = querySnapshot.docs[0].ref;
      }
    } else {
      // Check if it's a subtask ID first
      const subtaskQuery = await afterSaleDb.collectionGroup('subtasks').where('subtaskId', '==', id).limit(1).get();
      if (!subtaskQuery.empty) {
        targetRef = subtaskQuery.docs[0].ref;
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) return [];
        targetRef = querySnapshot.docs[0].ref;
      }
    }

    const docSnapshot = await targetRef.get();
    if (!docSnapshot.exists) return [];
    
    const allReports: any[] = [];
    const dateMap = new Map<string, boolean>();

    // 1. Fetch from all revisions (Site Reports)
    if (isSupportReport === false || isSupportReport === undefined) {
      const revisionsSnapshot = await targetRef.collection('revisions').get();
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
      const helpSnapshot = await targetRef.collection('help').get();
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
    const { taskRef, subtaskRef } = await this.resolveRefs(id);
    const targetRef = subtaskRef || taskRef;

    const until = new Date();
    until.setDate(until.getDate() + days);

    const doc = await targetRef.get();
    if (!doc.exists) throw new AppError('Task/Subtask not found', 404);
    
    const docData = doc.data();
    const unlockedDatesField = isSupportReport ? 'supportUnlockedDates' : 'unlockedDates';
    const unlockRequestsField = isSupportReport ? 'supportUnlockRequests' : 'unlockRequests';

    const unlockedDates = docData?.[unlockedDatesField] || {};
    unlockedDates[dateStr] = {
      unlockedUntil: until,
      unlockedBy: updatedBy
    };

    const unlockRequests = docData?.[unlockRequestsField] || {};
    if (unlockRequests[dateStr]) {
      delete unlockRequests[dateStr];
    }

    await targetRef.update({
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
    const { taskRef, subtaskRef } = await this.resolveRefs(id);
    const targetRef = subtaskRef || taskRef;

    const doc = await targetRef.get();
    if (!doc.exists) throw new AppError('Task/Subtask not found', 404);

    const docData = doc.data();
    const unlockRequestsField = isSupportReport ? 'supportUnlockRequests' : 'unlockRequests';
    const unlockRequests = docData?.[unlockRequestsField] || {};
    unlockRequests[dateStr] = {
      requestedAt: new Date(),
      requestedBy
    };

    await targetRef.update({
      [unlockRequestsField]: unlockRequests,
      updatedAt: new Date()
    });
  }

  async submitAdvanceRequest(id: string, requestData: any, createdBy: string, isSupportRequest: boolean = false): Promise<void> {
    const { subtaskRef, taskRef } = await this.resolveRefs(id);
    const targetRef = subtaskRef || taskRef;
    const requestDate = new Date(requestData.reportDate);
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const requestDateStart = new Date(requestDate);
    requestDateStart.setHours(0, 0, 0, 0);

    if (requestDateStart < tomorrow) {
       throw new AppError('สามารถวางแผนงานล่วงหน้าได้อย่างน้อย 1 วัน (ไม่สามารถลงสำหรับวันนี้หรือย้อนหลังได้)', 400);
    }

    const year = requestDate.getFullYear();
    const month = String(requestDate.getMonth() + 1).padStart(2, '0');
    const day = String(requestDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const docSnap = await targetRef.get();
    if (!docSnap.exists) throw new AppError('Task/Subtask not found', 404);
    const docData = docSnap.data() as any;
    const currentRev = docData.currentRevision || 'rev00';

    let requestRef: FirebaseFirestore.DocumentReference;
    if (isSupportRequest) {
      const helpId = currentRev.replace('rev', 'help');
      requestRef = targetRef.collection('help').doc(helpId).collection('requests').doc(dateStr);
    } else {
      requestRef = targetRef.collection('revisions').doc(currentRev).collection('requests').doc(dateStr);
    }

    const existingSnap = await requestRef.get();
    if (existingSnap.exists) {
      const existingData = existingSnap.data();
      if (existingData?.status && existingData.status !== 'pending') {
        throw new AppError('ไม่สามารถแก้ไขแผนงานล่วงหน้าที่ถูกส่งออกหรือตรวจสอบแล้วได้ (Locked by Supervisor)', 403);
      }
    }

    const payload = {
        requestId: dateStr,
        ...requestData,
        reportDate: requestDate,
        createdAt: now,
        updatedAt: now,
        createdBy,
        updatedBy: createdBy,
        status: 'pending' 
    };
    
    delete payload.photos;

    await requestRef.set(payload, { merge: true });
  }

  async getAdvanceRequests(id: string, isSupportRequest?: boolean): Promise<any[]> {
    const { subtaskRef, taskRef } = await this.resolveRefs(id);
    const targetRef = subtaskRef || taskRef;
    const docSnap = await targetRef.get();
    if (!docSnap.exists) return [];
    
    const allRequests: any[] = [];
    
    if (isSupportRequest === false || isSupportRequest === undefined) {
      const revisionsSnapshot = await targetRef.collection('revisions').get();
      for (const revDoc of revisionsSnapshot.docs) {
        const requests = await revDoc.ref.collection('requests').get();
        requests.docs.forEach((d: any) => {
          allRequests.push({ ...d.data(), _revisionId: revDoc.id });
        });
      }
    }

    if (isSupportRequest === true || isSupportRequest === undefined) {
      const helpSnapshot = await targetRef.collection('help').get();
      for (const hDoc of helpSnapshot.docs) {
        const requests = await hDoc.ref.collection('requests').get();
        requests.docs.forEach((d: any) => {
          allRequests.push({ ...d.data(), _revisionId: hDoc.id });
        });
      }
    }
    return allRequests;
  }

  async updateAdvanceRequestStatus(id: string, dateStr: string, status: string, updatedBy: string, isSupportRequest: boolean = false): Promise<void> {
    const { subtaskRef, taskRef } = await this.resolveRefs(id);
    const targetRef = subtaskRef || taskRef;

    const docSnap = await targetRef.get();
    if (!docSnap.exists) throw new AppError('Task/Subtask not found', 404);
    const docData = docSnap.data() as any;
    const currentRev = docData.currentRevision || 'rev00';

    let requestRef: FirebaseFirestore.DocumentReference;
    if (isSupportRequest) {
      const helpId = currentRev.replace('rev', 'help');
      requestRef = targetRef.collection('help').doc(helpId).collection('requests').doc(dateStr);
    } else {
      requestRef = targetRef.collection('revisions').doc(currentRev).collection('requests').doc(dateStr);
    }

    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) throw new AppError('Request not found', 404);

    await requestRef.update({
      status,
      updatedAt: new Date(),
      updatedBy
    });
  }

  private async resolveRefs(id: string) {
    let taskRef: FirebaseFirestore.DocumentReference;
    let subtaskRef: FirebaseFirestore.DocumentReference | undefined = undefined;
    if (id.includes('__')) {
      const parts = id.split('__');
      if (parts.length >= 4) {
        const [woId, catId, taskId, subtaskId] = parts;
        taskRef = afterSaleDb.collection('workOrders').doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
        subtaskRef = taskRef.collection('subtasks').doc(subtaskId);
      } else if (parts.length === 3) {
        const [woId, catId, taskId] = parts;
        taskRef = afterSaleDb.collection('workOrders').doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
      } else {
        throw new AppError('Invalid ID format', 400);
      }
    } else {
      // Try querying subtasks first
      const subtaskQuery = await afterSaleDb.collectionGroup('subtasks').where('subtaskId', '==', id).limit(1).get();
      if (!subtaskQuery.empty) {
        subtaskRef = subtaskQuery.docs[0].ref;
        taskRef = subtaskRef.parent.parent as FirebaseFirestore.DocumentReference;
      } else {
        const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
        if (querySnapshot.empty) throw new AppError('Task not found', 404);
        taskRef = querySnapshot.docs[0].ref;
      }
    }
    return { taskRef, subtaskRef };
  }




}

export const taskService = new TaskService();
