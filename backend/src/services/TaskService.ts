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

    // Read workOrderConfigs to get AssignLD
    let assignLD: string[] = [];
    if (input.workOrderCode) {
      const woConfigDoc = await projectRef
        .collection('workOrderConfigs')
        .doc(input.workOrderCode.trim().toUpperCase())
        .get();
      if (woConfigDoc.exists) {
        assignLD = woConfigDoc.data()?.AssignLD || [];
      }
    }

    // Run-number offset for appended subtasks (set inside the tx, reused by the notification block)
    let appendSubtaskOffset = 0;

    const createdTask = await afterSaleDb.runTransaction(async (transaction) => {
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

      // When appending to an existing task, read how many subtasks it already has so new
      // subtasks get continuing run numbers (must stay in the READS section — reads-before-writes).
      let existingSubtaskCount = 0;
      let existingSubtaskNames: string[] = [];
      if (!isNewTask) {
        const existingSubtasksSnap = await transaction.get(taskRef.collection('subtasks'));
        existingSubtaskCount = existingSubtasksSnap.size;
        existingSubtaskNames = existingSubtasksSnap.docs.map(
          (d) => ((d.data()?.subtaskName as string) || '').trim().toLowerCase()
        );
      }
      appendSubtaskOffset = existingSubtaskCount;

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
        AssignLD: assignLD,
        updatedAt: now
      }, { merge: true });

      transaction.set(categoryRef, {
        catId,
        catName: input.categoryName || 'General',
        updatedAt: now
      }, { merge: true });

      
      // Aggregate assignees from subtasks.
      // When appending to an existing task, seed with the parent's current assignees so the
      // aggregate is a UNION (not a replace) — otherwise existing assignees get clobbered.
      const allAssigneesMap = new Map<string, any>();
      if (!isNewTask && Array.isArray(existingTaskData?.assignees)) {
        existingTaskData.assignees.forEach((a: any) => {
          if (a?.employeeId) allAssigneesMap.set(a.employeeId, a);
        });
      }
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
      let maxDueDate = this.calculateMaxDueDate(input.subtasks || []) || (input.dueDate ? new Date(input.dueDate) : now);
      // When appending to an existing task, keep the later of the existing parent dueDate and the
      // new max — never shrink the parent dueDate just because an earlier subtask was added.
      if (!isNewTask && existingTaskData?.dueDate) {
        const existingDue = existingTaskData.dueDate.toDate
          ? existingTaskData.dueDate.toDate()
          : new Date(existingTaskData.dueDate);
        if (existingDue.getTime() > maxDueDate.getTime()) {
          maxDueDate = existingDue;
        }
      }

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
        isSupportRequest: hasSupportRequest || (!isNewTask && !!existingTaskData?.isSupportRequest),
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

      // Write subtasks for BOTH new tasks and appends to an existing task.
      // (Previously guarded by isNewTask, which silently dropped subtasks added under an
      //  existing task name — the cause of T-202.) Run numbers continue past existing subtasks.
      if (input.subtasks && input.subtasks.length > 0) {
        // T-203: reject duplicate subtask names within the same parent — both against the
        // existing subtasks and among the incoming batch. Throwing aborts the whole tx (no partial write).
        const seenSubtaskNames = new Set(existingSubtaskNames);
        for (const st of input.subtasks) {
          const n = (st.subtaskName || '').trim().toLowerCase();
          if (!n) continue;
          if (seenSubtaskNames.has(n)) {
            throw new AppError(`ชื่องานย่อย "${st.subtaskName}" ซ้ำกับงานย่อยที่มีอยู่แล้วในงานนี้`, 409);
          }
          seenSubtaskNames.add(n);
        }
        input.subtasks.forEach((st, index) => {
          const subtaskNum = (existingSubtaskCount + index + 1).toString().padStart(4, '0');
          const subtaskId = `${taskId}-${subtaskNum}`;
          const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);
          
          const subtaskData = {
            id: `${woId}__${catId}__${taskId}__${subtaskId}`,
            subtaskId: subtaskId,
            subtaskName: st.subtaskName,
            projectId: input.projectId || '',
            projectName: input.projectName || '',
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

    // Send notifications asynchronously after transaction completes
    if (input.subtasks && input.subtasks.length > 0) {
      input.subtasks.forEach((st, index) => {
        const subtaskNum = (appendSubtaskOffset + index + 1).toString().padStart(4, '0');
        const subtaskId = `${createdTask.taskId}-${subtaskNum}`;
        if (st.assignees && st.assignees.length > 0) {
          this.sendAssignmentNotifications(
            createdTask,
            st.subtaskName,
            subtaskId,
            st.assignees,
            createdBy
          ).catch(err => console.error('[TaskService] Notification error in createTask:', err));
        }
      });
    }

    return createdTask;
  }

  /**
   * Reject งานที่เสร็จแล้ว (ตีกลับงาน)
   * สร้าง Revision ใหม่ รีเซ็ต dailyProgress กลับเป็น 0 และนำ Assignees ใหม่ไปสะสมรวมใน Task หลัก
   */
  async rejectTask(id: string, revisionName: string, newAssignees: any[], updatedBy: string): Promise<void> {
    const { taskRef, subtaskRef } = await this.resolveRefs(id);
    const admin = require('firebase-admin');

    await afterSaleDb.runTransaction(async (transaction) => {
      // ─── READS FIRST (Firestore transaction rule) ───────────────────────────
      // 1. อ่านข้อมูล Task ปัจจุบัน
      const doc = await transaction.get(taskRef);
      if (!doc.exists) throw new AppError('Task not found', 404);
      const taskData = doc.data() as Task;

      // Read subtask (if rejecting a specific subtask)
      let subtaskData: any = null;
      if (subtaskRef) {
        const subtaskDoc = await transaction.get(subtaskRef);
        if (!subtaskDoc.exists) throw new AppError('Subtask not found', 404);
        subtaskData = subtaskDoc.data();
        if (!subtaskData) throw new AppError('Subtask data is empty', 404);
      }

      // Read all sibling subtasks (needed for both cases)
      const subtasksQuery = await transaction.get(taskRef.collection('subtasks'));

      // ─── COMPUTE (no Firestore calls) ───────────────────────────────────────
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

      // ─── WRITES (all reads are done above) ──────────────────────────────────
      if (subtaskRef && subtaskData) {
        // ── Case A: Reject specific subtask ──

        // A1. Create next revision for this subtask
        const nextRevRef = subtaskRef.collection('revisions').doc(nextRevId);
        transaction.set(nextRevRef, {
          revisionId: nextRevId,
          revisionName: revisionName,
          taskName: subtaskData.subtaskName,
          assignees: newAssignees,
          createdAt: now,
          createdBy: updatedBy,
        });

        // A2. Update subtask document (reset progress, bump revision, status → rework, reset support fields)
        transaction.update(subtaskRef, {
          currentRevision: nextRevId,
          dailyProgress: 0,
          status: 'rework',
          assignees: newAssignees,
          isSupportRequest: false,
          isPickedUpBySupport: false,
          supportTaskName: null,
          supportDailyProgress: 0,
          supportAssignees: [],
          updatedAt: now,
          updatedBy: updatedBy
        });

        // A3. Recalculate average progress and support status for parent task (using already-read subtasksQuery)
        const allSubtasks = subtasksQuery.docs.map(d => {
          if (d.id === subtaskRef.id) {
            return { ...d.data(), dailyProgress: 0, status: 'rework', isSupportRequest: false };
          }
          return d.data();
        });
        const totalProgress = allSubtasks.reduce((sum, st) => sum + (st.dailyProgress || 0), 0);
        const averageProgress = allSubtasks.length > 0 ? Math.round(totalProgress / allSubtasks.length) : 0;
        const hasSupportRequest = allSubtasks.some(st => st.isSupportRequest === true);

        // A4. Update parent task — status depends on averageProgress
        const parentStatus: string = averageProgress >= 100 ? 'for-checking' : averageProgress > 0 ? 'in-progress' : 'upcoming';
        const taskUpdates = {
          currentRevision: nextRevId,
          revisionId: nextRevId,
          revisionName: revisionName,
          dailyProgress: averageProgress,
          status: parentStatus as any,
          assignees: mergedAssignees,
          isSupportRequest: hasSupportRequest,
          updatedAt: now,
          updatedBy: updatedBy,
          revisionCreatedAt: now,
          historicalAssigneeIds: admin.firestore.FieldValue.arrayUnion(...newAssignees.map(a => a.employeeId), updatedBy) as any
        };
        transaction.update(taskRef, taskUpdates);
        await this.recordHistory(taskRef, 'reject_subtask', taskData, { subtaskId: subtaskRef.id, ...taskUpdates }, updatedBy);
      } else {
        // ── Case B: Reject parent task directly ──

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

        // B2. สร้างเอกสาร Revision ใหม่ ภายใต้ทุก Subtasks (using already-read subtasksQuery)
        subtasksQuery.docs.forEach(stDoc => {
          const nextRevRef = stDoc.ref.collection('revisions').doc(nextRevId);
          transaction.set(nextRevRef, {
            revisionId: nextRevId,
            revisionName: revisionName,
            taskName: stDoc.data().subtaskName || taskData.taskName,
            assignees: stDoc.data().assignees || newAssignees,
            createdAt: now,
            createdBy: updatedBy,
          });

          transaction.update(stDoc.ref, {
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
      // ─── READS FIRST (Firestore transaction rule) ───────────────────────────
      const doc = await transaction.get(taskRef);
      if (!doc.exists) throw new AppError('Task not found', 404);

      let subtaskDoc = null;
      let subtasksQuery = null;

      if (subtaskRef) {
        subtaskDoc = await transaction.get(subtaskRef);
        if (!subtaskDoc.exists) throw new AppError('Subtask not found', 404);
        subtasksQuery = await transaction.get(taskRef.collection('subtasks'));
      }

      // ─── WRITES SECOND ───────────────────────────────────────────────────────
      const now = new Date();
      const updates = {
        status: 'completed' as any,
        updatedAt: now,
        updatedBy: updatedBy,
      };

      if (subtaskRef && subtasksQuery) {
        // Approve specific subtask
        transaction.update(subtaskRef, {
          status: 'completed',
          updatedAt: now,
          updatedBy: updatedBy
        });

        // Recalculate parent task progress & status
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
    const compositeParts = this.parseCompositeId(id);
    if (compositeParts.length >= 3) {
      const [woId, catId, taskId] = compositeParts;
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

    // Captured inside the transaction so notifications can fire after it commits
    // (notifications must not run inside the transaction body).
    let notifyTaskData: any = null;
    let notifySubtaskName = supportTaskName;
    let notifySubtaskId = subtaskId || '';

    try {
      await afterSaleDb.runTransaction(async (transaction) => {
        console.log(`[TaskService] Starting transaction for ${taskRef.path}`);
        // 1. อ่านข้อมูล Task ปัจจุบัน
        const doc = await transaction.get(taskRef);
        console.log(`[TaskService] Fetched task doc, exists: ${doc.exists}`);
        if (!doc.exists) throw new AppError('Task not found', 404);
        const taskData = doc.data() as Task;
        const now = new Date();
        notifyTaskData = taskData;

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
          notifySubtaskName = supportTaskName || subtaskData.subtaskName || '';
          notifySubtaskId = subtaskId;

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

      // Notify the support assignees (fire-and-forget, after the transaction commits).
      // Mirrors createSubtask/createTask: a failure here must not fail the pickup.
      if (notifyTaskData && Array.isArray(supportAssignees) && supportAssignees.length > 0) {
        this.sendAssignmentNotifications(notifyTaskData, notifySubtaskName, notifySubtaskId, supportAssignees, updatedBy)
          .catch(err => console.error('[TaskService] Notification error in joinSupportTask:', err));
      }
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
    const compositeParts = this.parseCompositeId(taskId);
    if (compositeParts.length >= 3) {
      const [woId, catId, id] = compositeParts;
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
        isDeletable: subData.isDeletable !== undefined ? subData.isDeletable : ((subData.dailyProgress || 0) === 0),
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
    
    const compositeParts = this.parseCompositeId(taskId);
    if (compositeParts.length >= 3) {
      const parts = compositeParts;
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

    const result = await afterSaleDb.runTransaction(async (transaction) => {
      // 1. Get task doc (READ)
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) {
        throw new AppError('ไม่พบ Task ที่ระบุ', 404);
      }
      const taskData = taskDoc.data();

      // 2. Query existing subtasks to count and determine subtask suffix (READ)
      const subtasksQuery = await transaction.get(taskRef.collection('subtasks'));
      const count = subtasksQuery.size;

      // T-203: reject a duplicate subtask name within the SAME parent task
      // (no silent running-number append — surface a clear error instead).
      const incomingName = (subtaskName || '').trim().toLowerCase();
      const nameClash = subtasksQuery.docs.some(
        (d) => (((d.data()?.subtaskName as string) || '').trim().toLowerCase()) === incomingName
      );
      if (nameClash) {
        throw new AppError('ชื่องานย่อยนี้มีอยู่แล้วในงานนี้', 409);
      }

      const subtaskNum = (count + 1).toString().padStart(4, '0');
      const subtaskId = `${tId}-${subtaskNum}`;
      const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);

      // 3. Prepare subtask data
      const now = new Date();
      const subtaskData = {
        id: `${woId}__${catId}__${tId}__${subtaskId}`,
        subtaskId: subtaskId,
        subtaskName: subtaskName,
        projectId: taskData?.projectId || '',
        projectName: taskData?.projectName || '',
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

      return { subtaskData, taskData };
    });

    if (assignees && assignees.length > 0) {
      this.sendAssignmentNotifications(
        result.taskData,
        result.subtaskData.subtaskName,
        result.subtaskData.subtaskId,
        assignees,
        createdBy
      ).catch(err => console.error('[TaskService] Notification error in createSubtask:', err));
    }

    return result.subtaskData;
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
          isDeletable: subData.isDeletable !== undefined ? subData.isDeletable : ((subData.dailyProgress || 0) === 0),
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
   * คืนค่าชุดของ projectId ที่มีงานขอความช่วยเหลือ (support request) ที่ยังเปิดอยู่ >= 1 รายการ
   *
   * ใช้ collection-group query แบบเงื่อนไขเดียว (isSupportRequest == true) ซึ่งใช้
   * automatic single-field index ของ Firestore → ไม่ต้องสร้าง composite index เองใน after-sale
   * จากนั้นกรองใน memory (!isPickedUpBySupport && dailyProgress < 100) และ resolve projectId
   * จาก parent task (อ่าน task ละครั้ง โดย dedupe ref ก่อน)
   */
  async getProjectIdsWithOpenSupportRequests(): Promise<Set<string>> {
    try {
      const subSnapshot = await afterSaleDb
        .collectionGroup('subtasks')
        .where('isSupportRequest', '==', true)
        .get();

      // กรองเฉพาะงานขอความช่วยเหลือที่ยังไม่ถูกรับ และยังทำไม่เสร็จ
      const openTaskRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const subDoc of subSnapshot.docs) {
        const subData = subDoc.data();
        const isPickedUp = subData.isPickedUpBySupport === true;
        const progress = subData.dailyProgress || 0;
        if (isPickedUp || progress >= 100) continue;

        const taskRef = subDoc.ref.parent.parent; // .../tasks/{taskId}
        if (taskRef) openTaskRefs.set(taskRef.path, taskRef);
      }

      if (openTaskRefs.size === 0) return new Set<string>();

      // อ่าน task แต่ละตัว (dedupe แล้ว) เพื่อดึง projectId
      const projectIds = new Set<string>();
      const taskDocs = await Promise.all(
        Array.from(openTaskRefs.values()).map((ref) => ref.get())
      );
      for (const taskDoc of taskDocs) {
        if (!taskDoc.exists) continue;
        const taskData = taskDoc.data() as Partial<Task> | undefined;
        if (!taskData) continue;
        if (taskData.isActive === false) continue;
        if (taskData.projectId) projectIds.add(taskData.projectId);
      }

      return projectIds;
    } catch (error) {
      console.error('[TaskService] getProjectIdsWithOpenSupportRequests error:', error);
      throw error;
    }
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

      const compositeParts = this.parseCompositeId(id);
      if (compositeParts.length >= 3) {
        [oldWoId, oldCatId, oldTaskId] = compositeParts;
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

      const doc = await taskRef.get();
      if (!doc.exists) throw new AppError('ไม่พบข้อมูลงานที่ต้องการแก้ไข (Task not found)', 404);
      
      const oldData = doc.data() as any;
      const now = new Date();
      const admin = require('firebase-admin');

      // T-203: enforce unique subtask names within this parent task. updateTask receives the full
      // final subtask list, so the resulting names must all be distinct (no silent duplicate).
      if (input.subtasks && input.subtasks.length > 0) {
        const seenNames = new Set<string>();
        for (const st of input.subtasks) {
          const n = (st.subtaskName || '').trim().toLowerCase();
          if (!n) continue;
          if (seenNames.has(n)) {
            throw new AppError(`ชื่องานย่อย "${st.subtaskName}" ซ้ำกันภายในงานนี้`, 409);
          }
          seenNames.add(n);
        }
      }

      // Category Migration check
      if (input.categoryName && input.categoryName !== oldData.categoryName) {
        const newCategoryRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(oldWoId).collection('categories');
        const catQuery = await newCategoryRef.where('catName', '==', input.categoryName).limit(1).get();
        let targetCatId = '';
        
        if (!catQuery.empty) {
          targetCatId = catQuery.docs[0].id;
        } else {
          targetCatId = `CAT-${now.getTime()}`;
          await newCategoryRef.doc(targetCatId).set({ catId: targetCatId, catName: input.categoryName }, { merge: true });
        }

        const activeTaskRef = newCategoryRef.doc(targetCatId).collection('tasks').doc(oldTaskId);
        
        // Prepare subtask list and aggregate values
        const subtasksRef = taskRef.collection('subtasks');
        const existingSubtasksSnap = await subtasksRef.get();
        const existingSubtasks = existingSubtasksSnap.docs.map(d => d.data());
        
        const allAssigneesMap = new Map<string, any>();
        let hasSupportRequest = false;

        // Merge subtasks array from input
        const finalSubtasks: any[] = [];
        let currentSubtaskRun = existingSubtasks.length + 1;

        if (input.subtasks) {
          hasSupportRequest = input.subtasks.some(st => st.isSupportRequest) || false;
          input.subtasks.forEach(stInput => {
            if (stInput.subtaskId) {
              const oldSt = existingSubtasks.find(x => x.subtaskId === stInput.subtaskId) || {};
              const newAssignees = stInput.assignees || [];
              newAssignees.forEach(a => allAssigneesMap.set(a.employeeId, a));
              
              // We construct the updated subtask document
              const changes: any[] = [];
              if (stInput.subtaskName !== undefined && oldSt.subtaskName !== stInput.subtaskName) {
                changes.push({ field: 'subtaskName', oldValue: oldSt.subtaskName || '', newValue: stInput.subtaskName });
              }
              if (stInput.assignees !== undefined && !this.compareAssignees(oldSt.assignees, stInput.assignees)) {
                changes.push({ field: 'assignees', oldValue: oldSt.assignees || [], newValue: stInput.assignees });
              }
              if (stInput.dueDate !== undefined && !this.compareDates(oldSt.dueDate, stInput.dueDate)) {
                changes.push({ field: 'dueDate', oldValue: oldSt.dueDate ? (oldSt.dueDate.toDate ? oldSt.dueDate.toDate() : new Date(oldSt.dueDate)) : null, newValue: stInput.dueDate ? new Date(stInput.dueDate) : null });
              }
              const newIsSupport = stInput.isSupportRequest || false;
              const oldIsSupport = oldSt.isSupportRequest || false;
              if (newIsSupport !== oldIsSupport) {
                changes.push({ field: 'isSupportRequest', oldValue: oldIsSupport, newValue: newIsSupport });
              }

              const subtaskUpdates: any = {
                ...oldSt,
                subtaskName: stInput.subtaskName !== undefined ? stInput.subtaskName : oldSt.subtaskName,
                assignees: newAssignees,
                isSupportRequest: newIsSupport,
                updatedAt: now,
                updatedBy: updatedBy,
              };
              if (stInput.dueDate !== undefined) {
                subtaskUpdates.dueDate = stInput.dueDate ? new Date(stInput.dueDate) : null;
              }
              if (newAssignees.length > 0) {
                const histIds = new Set<string>([
                  ...(oldSt.historicalAssigneeIds || []),
                  ...newAssignees.map(a => a.employeeId)
                ]);
                subtaskUpdates.historicalAssigneeIds = Array.from(histIds);
              }
              if (changes.length > 0) {
                const historyRecord = {
                  updatedAt: now,
                  updatedBy: updatedBy,
                  changes: changes
                };
                subtaskUpdates.editHistory = [
                  ...(oldSt.editHistory || []),
                  historyRecord
                ];
              }

              finalSubtasks.push(subtaskUpdates);
            } else {
              // New Subtask
              const subtaskId = `${oldTaskId}-${(currentSubtaskRun++).toString().padStart(4, '0')}`;
              const newAssignees = stInput.assignees || [];
              newAssignees.forEach(a => allAssigneesMap.set(a.employeeId, a));

              finalSubtasks.push({
                id: `${oldWoId}__${targetCatId}__${oldTaskId}__${subtaskId}`,
                subtaskId: subtaskId,
                subtaskName: stInput.subtaskName,
                projectId: oldData.projectId || '',
                projectName: oldData.projectName || '',
                status: 'upcoming',
                assignees: newAssignees,
                dailyProgress: 0,
                currentRevision: 'rev00',
                isSupportRequest: stInput.isSupportRequest || false,
                dueDate: stInput.dueDate ? new Date(stInput.dueDate) : null,
                editHistory: [],
                createdAt: now,
                updatedAt: now,
                createdBy: updatedBy,
                updatedBy: updatedBy,
                historicalAssigneeIds: Array.from(new Set([...newAssignees.map(a => a.employeeId), updatedBy]))
              });
            }
          });
          
          // Also add subtasks that were not edited
          existingSubtasks.forEach(oldSt => {
            if (!finalSubtasks.some(x => x.subtaskId === oldSt.subtaskId)) {
              finalSubtasks.push(oldSt);
              (oldSt.assignees || []).forEach((a: any) => allAssigneesMap.set(a.employeeId, a));
              if (oldSt.isSupportRequest) hasSupportRequest = true;
            }
          });
        } else {
          // No subtasks input, just copy existing subtasks
          existingSubtasks.forEach(oldSt => {
            finalSubtasks.push(oldSt);
          });
        }

        const allAssignees = Array.from(allAssigneesMap.values());
        const calculatedMaxDueDate = this.calculateMaxDueDate(finalSubtasks);
        const maxDueDate = calculatedMaxDueDate || (input.dueDate ? new Date(input.dueDate) : (oldData.dueDate ? (oldData.dueDate.toDate ? oldData.dueDate.toDate() : new Date(oldData.dueDate)) : null));

        // Sanitize input: Remove undefined values and subtasks
        const sanitizedInput = Object.keys(input).reduce((obj: any, key) => {
          const val = (input as any)[key];
          if (val !== undefined && key !== 'subtasks') obj[key] = val;
          return obj;
        }, {});

        const newData = {
          ...oldData,
          ...sanitizedInput,
          categoryId: targetCatId,
          updatedAt: now,
          updatedBy,
          assignees: allAssignees,
          historicalAssigneeIds: Array.from(new Set([...(oldData.historicalAssigneeIds || []), ...allAssignees.map(a => a.employeeId)])),
          isSupportRequest: hasSupportRequest,
          dueDate: maxDueDate
        };

        // Run the atomic migration (writes new task, moves subtasks, deletes old task)
        await this.migrateTaskData(taskRef, activeTaskRef, newData, finalSubtasks);
        console.log(`[TaskService] updateTask Category Migration completed successfully`);
        return;
      }

      // Normal path (no Category change)
      await afterSaleDb.runTransaction(async (transaction) => {
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
            (st.assignees || []).forEach(a => {
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

        const updates: any = { ...sanitizedInput, updatedAt: now, updatedBy };
        if (input.subtasks) {
          updates.assignees = allAssignees;
          updates.historicalAssigneeIds = admin.firestore.FieldValue.arrayUnion(...allAssignees.map(a => a.employeeId));
          updates.isSupportRequest = hasSupportRequest;
          updates.dueDate = maxDueDate;
        }
        transaction.update(taskRef, updates);
        
        // Update Subtasks
        if (input.subtasks) {
          input.subtasks.forEach(stInput => {
            if (stInput.subtaskId) {
              const stRef = taskRef.collection('subtasks').doc(stInput.subtaskId);
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

              const newAssignees = stInput.assignees || [];
              const subtaskUpdates: any = {
                subtaskName: stInput.subtaskName,
                assignees: newAssignees,
                isSupportRequest: newIsSupport,
                updatedAt: now,
                updatedBy: updatedBy,
              };

              if (newAssignees.length > 0) {
                subtaskUpdates.historicalAssigneeIds = admin.firestore.FieldValue.arrayUnion(...newAssignees.map(a => a.employeeId));
              }

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
              const stRef = taskRef.collection('subtasks').doc(subtaskId);
              const newAssignees = stInput.assignees || [];
              transaction.set(stRef, {
                id: `${oldWoId}__${oldCatId}__${oldTaskId}__${subtaskId}`,
                subtaskId: subtaskId,
                subtaskName: stInput.subtaskName,
                projectId: oldData.projectId || '',
                projectName: oldData.projectName || '',
                status: 'upcoming',
                assignees: newAssignees,
                dailyProgress: 0,
                currentRevision: 'rev00',
                isSupportRequest: stInput.isSupportRequest || false,
                dueDate: stInput.dueDate ? new Date(stInput.dueDate) : null,
                editHistory: [],
                createdAt: now,
                updatedAt: now,
                createdBy: updatedBy,
                updatedBy: updatedBy,
                historicalAssigneeIds: Array.from(new Set([...newAssignees.map(a => a.employeeId), updatedBy]))
              });
              const rev00Ref = stRef.collection('revisions').doc('rev00');
              transaction.set(rev00Ref, {
                revisionId: 'rev00',
                revisionName: stInput.subtaskName,
                taskName: stInput.subtaskName,
                assignees: newAssignees,
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
    const compositeParts = this.parseCompositeId(id);
    if (compositeParts.length >= 3) {
      const [woId, catId, taskId] = compositeParts;
      taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId).collection('tasks').doc(taskId);
    } else {
      const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', id).limit(1).get();
      if (querySnapshot.empty) throw new AppError('Task not found', 404);
      taskRef = querySnapshot.docs[0].ref;
    }

    const doc = await taskRef.get();
    if (!doc.exists) throw new AppError('Task not found', 404);

    const oldData = doc.data();

    // Verify deletability of all child subtasks
    const subtasksSnap = await taskRef.collection('subtasks').get();
    for (const stDoc of subtasksSnap.docs) {
      const stData = stDoc.data();
      if (stData.isActive !== false) {
        const isDeletable = await this.updateSubtaskDeletability(stDoc.ref, stData.subtaskId || stDoc.id);
        if (!isDeletable) {
          throw new AppError(`ไม่สามารถลบงานหลักได้ เนื่องจากมีงานย่อย "${stData.subtaskName}" ที่มีบันทึกความคืบหน้าหรือชั่วโมงทำงานแล้ว`, 400);
        }
      }
    }

    const updates = { isActive: false, updatedAt: new Date(), updatedBy: userId };
    
    // Batch update to soft-delete the task and all subtasks under it
    const batch = afterSaleDb.batch();
    batch.update(taskRef, updates);

    subtasksSnap.docs.forEach((stDoc) => {
      batch.update(stDoc.ref, { isActive: false, updatedAt: new Date(), updatedBy: userId });
    });

    await batch.commit();
    await this.recordHistory(taskRef, 'delete', oldData, updates, userId);
  }

  /**
   * Update Subtask Details
   */
  async updateSubtask(id: string, subtaskId: string, subtaskData: any, userId: string): Promise<void> {
    let lookupId: string;
    const subtaskParts = this.parseCompositeId(subtaskId);
    if (subtaskParts.length >= 4) {
      lookupId = subtaskId;
    } else {
      const parentParts = this.parseCompositeId(id);
      if (parentParts.length >= 3) {
        lookupId = id.includes('__') ? `${id}__${subtaskId}` : `${id}_${subtaskId}`;
      } else {
        lookupId = subtaskId;
      }
    }
    const { taskRef, subtaskRef } = await this.resolveRefs(lookupId);
    if (!subtaskRef) throw new AppError('Subtask not found', 404);

    const doc = await subtaskRef.get();
    if (!doc.exists) throw new AppError('Subtask not found', 404);

    const oldData = doc.data() as any;
    const now = new Date();
    
    const updates: any = {
      updatedAt: now,
      updatedBy: userId
    };

    if (subtaskData.subtaskName !== undefined) {
      if (!subtaskData.subtaskName.trim()) throw new AppError('ชื่อ Subtask ไม่สามารถเป็นค่าว่างได้', 400);
      updates.subtaskName = subtaskData.subtaskName.trim();
    }
    if (subtaskData.dueDate !== undefined) {
      updates.dueDate = subtaskData.dueDate ? new Date(subtaskData.dueDate) : null;
    }
    if (subtaskData.assignees !== undefined) {
      updates.assignees = subtaskData.assignees || [];
    }
    if (subtaskData.isSupportRequest !== undefined) {
      updates.isSupportRequest = !!subtaskData.isSupportRequest;
    }

    const changes = Object.keys(updates)
      .filter(k => k !== 'updatedAt' && k !== 'updatedBy')
      .map(k => ({
        field: k,
        oldValue: oldData[k] || null,
        newValue: updates[k]
      }));

    if (changes.length > 0) {
      const editHistoryRecord = {
        updatedAt: now,
        updatedBy: userId,
        changes
      };
      updates.editHistory = admin.firestore.FieldValue.arrayUnion(editHistoryRecord);
    }

    await subtaskRef.update(updates);

    // Recalculate and update parent task's aggregates
    await this.updateParentTaskAggregates(taskRef, now, userId);

    // Send notifications to new assignees if any
    if (subtaskData.assignees !== undefined) {
      const oldAssigneeIds = new Set((oldData.assignees || []).map((a: any) => a.employeeId));
      const newAssignees = (subtaskData.assignees || []).filter((a: any) => !oldAssigneeIds.has(a.employeeId));
      
      if (newAssignees.length > 0) {
        taskRef.get().then(taskDoc => {
          if (taskDoc.exists) {
            this.sendAssignmentNotifications(
              taskDoc.data(),
              updates.subtaskName || oldData.subtaskName || '',
              oldData.subtaskId || subtaskRef.id,
              newAssignees,
              userId
            ).catch(err => console.error('[TaskService] Notification error in updateSubtask:', err));
          }
        }).catch(err => {
          console.error('[TaskService] Failed to fetch parent task for update notification:', err.message);
        });
      }
    }
  }

  /**
   * Delete Subtask (with Safety Check: Soft Delete if has reports, else Hard Delete)
   */
  async deleteSubtask(id: string, subtaskId: string, userId: string): Promise<{ type: 'hard' }> {
    let lookupId: string;
    const subtaskParts = this.parseCompositeId(subtaskId);
    if (subtaskParts.length >= 4) {
      lookupId = subtaskId;
    } else {
      const parentParts = this.parseCompositeId(id);
      if (parentParts.length >= 3) {
        lookupId = id.includes('__') ? `${id}__${subtaskId}` : `${id}_${subtaskId}`;
      } else {
        lookupId = subtaskId;
      }
    }
    const { taskRef, subtaskRef } = await this.resolveRefs(lookupId);
    if (!subtaskRef) throw new AppError('Subtask not found', 404);

    const doc = await subtaskRef.get();
    if (!doc.exists) throw new AppError('Subtask not found', 404);

    const subtaskData = doc.data() as any;
    const actualSubtaskId = subtaskData.subtaskId || subtaskId;

    // Check deletability using helper method
    const isDeletable = await this.updateSubtaskDeletability(subtaskRef, actualSubtaskId);
    if (!isDeletable) {
      throw new AppError('ไม่สามารถลบงานย่อยนี้ได้ เนื่องจากเริ่มงานไปแล้วหรือมีชั่วโมงการทำงาน/OT บันทึกอยู่', 400);
    }

    const now = new Date();

    // Perform Hard Delete (delete revisions, help, dailyReports, and the subtask document)
    const batch = afterSaleDb.batch();

    // 1. Delete revisions and their dailyReports
    const revisionsSnap = await subtaskRef.collection('revisions').get();
    for (const revDoc of revisionsSnap.docs) {
      const reportsSnap = await revDoc.ref.collection('dailyReports').get();
      reportsSnap.docs.forEach(rDoc => batch.delete(rDoc.ref));
      batch.delete(revDoc.ref);
    }

    // 2. Delete help and their dailyReports
    const helpSnap = await subtaskRef.collection('help').get();
    for (const helpDoc of helpSnap.docs) {
      const reportsSnap = await helpDoc.ref.collection('dailyReports').get();
      reportsSnap.docs.forEach(rDoc => batch.delete(rDoc.ref));
      batch.delete(helpDoc.ref);
    }

    // 3. Delete the subtask document itself
    batch.delete(subtaskRef);

    await batch.commit();
    console.log(`[TaskService] Hard deleted subtask ${actualSubtaskId} (qualified)`);

    // Recalculate and update parent task's aggregates
    await this.updateParentTaskAggregates(taskRef, now, userId);

    return { type: 'hard' };
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

  private async updateParentTaskAggregates(taskRef: FirebaseFirestore.DocumentReference, now: Date, userId: string): Promise<void> {
    const subtasksSnap = await taskRef.collection('subtasks').get();
    const activeSubtasks = subtasksSnap.docs
      .map(d => d.data())
      .filter(st => st.isActive !== false);

    const taskUpdates: any = {
      updatedAt: now,
      updatedBy: userId
    };

    if (activeSubtasks.length > 0) {
      // 1. Recalculate dailyProgress (average)
      const totalProgress = activeSubtasks.reduce((sum, st) => sum + (st.dailyProgress || 0), 0);
      const averageProgress = Math.round(totalProgress / activeSubtasks.length);
      taskUpdates.dailyProgress = averageProgress;

      // 2. Recalculate status
      const hasInProgress = activeSubtasks.some(st => st.status === 'in-progress' || st.status === 'rework' || st.status === 'for-checking');
      const allCompleted = activeSubtasks.every(st => st.status === 'completed');
      let parentStatus = 'upcoming';
      if (allCompleted) {
        parentStatus = 'completed';
      } else if (hasInProgress || averageProgress > 0) {
        parentStatus = 'in-progress';
      }
      taskUpdates.status = parentStatus;

      // 3. Recalculate max dueDate
      const maxDueDate = this.calculateMaxDueDate(activeSubtasks);
      if (maxDueDate) {
        taskUpdates.dueDate = maxDueDate;
      }

      // 4. Recalculate isSupportRequest
      taskUpdates.isSupportRequest = activeSubtasks.some(st => st.isSupportRequest === true);
    } else {
      taskUpdates.dailyProgress = 0;
      taskUpdates.status = 'upcoming';
      taskUpdates.isSupportRequest = false;
    }

    await taskRef.update(taskUpdates);
  }

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
      
      const allReportsQuerySnapshot = await afterSaleDb.collectionGroup('dailyReports')
        .where('reportDate', '>=', startOfDay)
        .where('reportDate', '<=', endOfDay)
        .get();
      const allReportsDocs = allReportsQuerySnapshot.docs;

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
                // Resolve conflicting task name from path
                let conflictLabel = 'งานอื่น';
                try {
                  const pathParts = doc.ref.path.split('/');
                  const tasksIdx = pathParts.indexOf('tasks');
                  if (tasksIdx >= 0) {
                    const taskDocRef = afterSaleDb.doc(pathParts.slice(0, tasksIdx + 2).join('/'));
                    const taskDoc = await taskDocRef.get();
                    if (taskDoc.exists) {
                      const td = taskDoc.data() as any;
                      const readableId = td.taskId || '';
                      const name = td.taskName || td.revisionName || td.subtaskName || '';
                      conflictLabel = readableId
                        ? `งาน ${readableId}${name ? ` "${name}"` : ''}`
                        : name ? `งาน "${name}"` : 'งานอื่น';
                    }
                  }
                } catch (_) { /* ใช้ default label หากหาชื่องานไม่ได้ */ }
                throw new AppError(
                  `ไม่อนุญาตให้บันทึก: พบแรงงาน (รหัส ${laborInput.employeeId || laborInput.workerId}) ลงเวลาซ้อนทับกับ${conflictLabel} (เวลางานนี้: ${sA} ทับซ้อนกับ ${sB})`,
                  400
                );
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
        projectId: taskData.projectId || '',
        projectName: taskData.projectName || '',
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

      await this.recordHistory(taskRef, 'daily_report_submit', oldData, historyUpdateData, updatedBy);
    });

    if (subtaskRef) {
      const actualSubtaskId = docForRev.data()?.subtaskId || id;
      await this.updateSubtaskDeletability(subtaskRef, actualSubtaskId);
    }

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
          readBy: [],
          isSupportReport: isSupportReport
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
   * และยิง webhook กลับไปให้ AfterSale อัปเดตข้อมูล
   */
  async rejectMedCertInDailyReport(employeeId: string, dateStr: string): Promise<void> {
    const timesheetRef = afterSaleDb
      .collection('DailyEmployeeTimesheets')
      .doc(`${employeeId}_${dateStr}`);
    const timesheetSnap = await timesheetRef.get();

    if (!timesheetSnap.exists) {
      console.warn(`[TaskService] DailyEmployeeTimesheet not found for ${employeeId}_${dateStr}`);
      return;
    }

    const sourceReportPath = timesheetSnap.data()?.sourceReport;
    if (!sourceReportPath) {
      console.warn(`[TaskService] No sourceReport found in timesheet for ${employeeId}_${dateStr}`);
      return;
    }

    const reportRef = afterSaleDb.doc(sourceReportPath);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      console.warn(`[TaskService] DailyReport not found at path ${sourceReportPath}`);
      return;
    }

    const data = reportSnap.data();
    if (!data?.leave || !Array.isArray(data.leave)) {
      return;
    }

    const workerIndex = data.leave.findIndex(
      (l: any) => l.workerId === employeeId || l.employeeId === employeeId
    );
    if (workerIndex === -1) {
      return;
    }

    const updatedLeaveArray = [...data.leave];
    updatedLeaveArray[workerIndex].leaveType = 'Unpaid';
    updatedLeaveArray[workerIndex].isMedCertRejected = true;

    await reportRef.update({ leave: updatedLeaveArray });
    const reportPath = reportRef.path;
    // Trigger After-Sale System Webhook
    try {
      await axios.post(
        'https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport',
        {
          reportPath: reportPath,
          reportDate: dateStr,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log(
        `[TaskService] Triggered After-Sale Sync Successfully for ${reportPath} after rejecting med cert`
      );
    } catch (error: any) {
      console.error(
        '[TaskService] Failed to trigger After-Sale sync after rejecting med cert:',
        error.message
      );
    }
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
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const requestDateStart = new Date(requestDate);
    requestDateStart.setHours(0, 0, 0, 0);

    if (requestDateStart.getTime() !== today.getTime() && requestDateStart.getTime() !== tomorrow.getTime()) {
      throw new AppError('สามารถวางแผนงานล่วงหน้าได้เฉพาะสำหรับวันนี้หรือวันพรุ่งนี้เท่านั้น', 400);
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
        projectId: docData.projectId || '',
        projectName: docData.projectName || '',
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

  async importWbs(
    projectId: string,
    groupedTasks: any[],
    createdBy: string
  ): Promise<{ success: boolean; importedCount: number }> {
    const projectRef = db.collection(PROJECTS_COLLECTION).doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      throw new AppError('ไม่พบโครงการที่ระบุ', 404);
    }
    const projectData = projectDoc.data();
    const projectCode = projectData?.projectCode || projectData?.code || 'XX';
    const projectName = projectData?.name || projectData?.projectName || 'Unknown Project';

    // Fetch all workOrderConfigs from Project A to copy AssignLD
    const configsSnapshot = await projectRef.collection('workOrderConfigs').get();
    const woConfigsMap = new Map<string, string[]>();
    configsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      woConfigsMap.set(doc.id.toUpperCase().trim(), data.AssignLD || []);
    });

    const now = new Date();
    const currentYear = now.getFullYear();

    const notificationsToSend: { taskData: any; subtaskName: string; subtaskId: string; assignees: any[] }[] = [];

    await afterSaleDb.runTransaction(async (transaction) => {
      notificationsToSend.length = 0; // Clear on transaction retry
      // 1. COLLECT ALL DOC REFERENCES & COUNTERS TO READ
      const woQuery = await afterSaleDb.collection(WORK_ORDERS_COLLECTION)
        .where('projectId', '==', projectId)
        .get();

      const existingWos = new Map<string, { id: string; code: string }>();
      woQuery.docs.forEach(doc => {
        const data = doc.data();
        existingWos.set(data.workOrderCode?.toUpperCase().trim(), {
          id: doc.id,
          code: data.workOrderCode
        });
      });

      const existingCats = new Map<string, { id: string; name: string }>();
      const existingTasks = new Map<string, { id: string; name: string; currentRevision: string; dailyProgress: number }>();
      const subtaskCounts = new Map<string, number>();

      for (const wo of existingWos.values()) {
        const catQuery = await afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(wo.id).collection('categories').get();
        catQuery.docs.forEach(doc => {
          const data = doc.data();
          const key = `${wo.id}__${data.catName?.trim()}`.toLowerCase();
          existingCats.set(key, { id: doc.id, name: data.catName });
        });

        for (const catDoc of catQuery.docs) {
          const taskQuery = await afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(wo.id)
            .collection('categories').doc(catDoc.id).collection('tasks').get();
          
          for (const taskDoc of taskQuery.docs) {
            const data = taskDoc.data();
            const key = `${wo.id}__${catDoc.id}__${data.taskName?.trim()}`.toLowerCase();
            existingTasks.set(key, {
              id: taskDoc.id,
              name: data.taskName,
              currentRevision: data.currentRevision || 'rev00',
              dailyProgress: data.dailyProgress || 0
            });

            const subtasksQuery = await taskDoc.ref.collection('subtasks').get();
            const countKey = `${wo.id}__${catDoc.id}__${taskDoc.id}`;
            subtaskCounts.set(countKey, subtasksQuery.size);
          }
        }
      }

      const countersSnap = await transaction.get(afterSaleDb.collection('system_counters'));
      const countersMap = new Map<string, number>();
      countersSnap.docs.forEach(doc => {
        countersMap.set(doc.id, doc.data()?.count || 0);
      });

      const tempCounters = new Map<string, number>(countersMap);

      const resolvedWos = new Map<string, string>();
      existingWos.forEach((val, key) => resolvedWos.set(key, val.id));

      const resolvedCats = new Map<string, string>();
      existingCats.forEach((val, key) => resolvedCats.set(key, val.id));

      const resolvedTasks = new Map<string, { id: string; currentRevision: string; dailyProgress: number }>();
      existingTasks.forEach((val, key) => resolvedTasks.set(key, { id: val.id, currentRevision: val.currentRevision, dailyProgress: val.dailyProgress }));

      // 2. WRITES PHASE
      for (const task of groupedTasks) {
        const woCode = (task.workOrderCode || 'GEN').toUpperCase().trim();
        const woName = task.workOrderName || 'General';
        const catName = task.categoryName || 'General';
        const taskName = task.taskName;

        let woId = resolvedWos.get(woCode) || '';
        if (!woId) {
          const woCounterId = `wo_counter_${projectCode}_${woCode}_${currentYear}`;
          const currentCount = tempCounters.get(woCounterId) || 0;
          const woNextRun = currentCount + 1;
          tempCounters.set(woCounterId, woNextRun);

          woId = `${projectCode}-${currentYear}-${woCode}-${woNextRun.toString().padStart(4, '0')}`;
          resolvedWos.set(woCode, woId);

          const woCounterRef = afterSaleDb.collection('system_counters').doc(woCounterId);
          transaction.set(woCounterRef, { count: woNextRun, updatedAt: now }, { merge: true });

          const workOrderRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId);
          transaction.set(workOrderRef, {
            workOrderId: woId,
            projectId: projectId,
            workOrderCode: woCode,
            workOrderName: woName,
            AssignLD: woConfigsMap.get(woCode) || [],
            updatedAt: now
          }, { merge: true });
        }

        const catKey = `${woId}__${catName?.trim()}`.toLowerCase();
        let catId = resolvedCats.get(catKey) || '';
        if (!catId) {
          const catCounterId = `cat_counter_${woId}`;
          const currentCount = tempCounters.get(catCounterId) || 0;
          const catNextRun = currentCount + 1;
          tempCounters.set(catCounterId, catNextRun);

          catId = `${woCode}-${catNextRun.toString().padStart(4, '0')}`;
          resolvedCats.set(catKey, catId);

          const catCounterRef = afterSaleDb.collection('system_counters').doc(catCounterId);
          transaction.set(catCounterRef, { count: catNextRun, updatedAt: now }, { merge: true });

          const categoryRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId).collection('categories').doc(catId);
          transaction.set(categoryRef, {
            catId,
            catName: catName,
            updatedAt: now
          }, { merge: true });
        }

        const taskKey = `${woId}__${catId}__${taskName?.trim()}`.toLowerCase();
        let taskInfo = resolvedTasks.get(taskKey);
        let taskId = '';
        let currentRevision = 'rev00';
        let existingProgress = 0;

        if (taskInfo) {
          taskId = taskInfo.id;
          currentRevision = taskInfo.currentRevision;
          existingProgress = taskInfo.dailyProgress;
        } else {
          const taskCounterId = `task_${woId}`;
          const currentCount = tempCounters.get(taskCounterId) || 0;
          const taskNextRun = currentCount + 1;
          tempCounters.set(taskCounterId, taskNextRun);

          taskId = `${catId}-${taskNextRun.toString().padStart(3, '0')}`;
          resolvedTasks.set(taskKey, { id: taskId, currentRevision: 'rev00', dailyProgress: 0 });

          const taskCounterRef = afterSaleDb.collection('system_counters').doc(taskCounterId);
          transaction.set(taskCounterRef, { count: taskNextRun, updatedAt: now }, { merge: true });
        }

        const taskRef = afterSaleDb.collection(WORK_ORDERS_COLLECTION).doc(woId)
          .collection('categories').doc(catId).collection('tasks').doc(taskId);

        const allAssigneesMap = new Map<string, any>();
        task.subtasks.forEach((st: any) => {
          st.assignees.forEach((a: any) => {
            allAssigneesMap.set(a.employeeId, a);
          });
        });
        const allAssignees = Array.from(allAssigneesMap.values());

        const maxDueDate = this.calculateMaxDueDate(task.subtasks || []) || (task.dueDate ? new Date(task.dueDate) : now);

        const taskDataToSet: Omit<Task, 'id'> = {
          taskId: taskId,
          taskName: taskName,
          description: task.description || '',
          projectId: projectId,
          projectCode: projectCode,
          projectName: projectName,
          workOrderId: woId,
          workOrderCode: woCode,
          workOrderName: woName,
          categoryId: catId,
          categoryName: catName,
          assignees: allAssignees,
          dueDate: maxDueDate,
          status: 'upcoming',
          currentRevision: currentRevision,
          revisionId: currentRevision,
          revisionName: taskName,
          dailyProgress: existingProgress,
          attachmentsCount: 0,
          isActive: true,
          isSupportRequest: task.subtasks.some((st: any) => st.isSupportRequest),
          createdAt: now,
          updatedAt: now,
          createdBy: createdBy,
          updatedBy: createdBy,
          supportedRevisionIds: [],
          historicalAssigneeIds: Array.from(new Set([
            ...allAssignees.map(a => a.employeeId),
            createdBy
          ]))
        };

        transaction.set(taskRef.withConverter(taskConverter), taskDataToSet as any, { merge: true });

        const countKey = `${woId}__${catId}__${taskId}`;
        let subtaskIndexOffset = subtaskCounts.get(countKey) || 0;

        task.subtasks.forEach((st: any) => {
          subtaskIndexOffset++;
          const subtaskNum = subtaskIndexOffset.toString().padStart(4, '0');
          const subtaskId = `${taskId}-${subtaskNum}`;
          const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);

          const subtaskData = {
            id: `${woId}__${catId}__${taskId}__${subtaskId}`,
            subtaskId: subtaskId,
            subtaskName: st.subtaskName,
            projectId: projectId,
            projectName: projectName,
            status: 'upcoming',
            assignees: st.assignees,
            dailyProgress: 0,
            currentRevision: 'rev00',
            isSupportRequest: false,
            dueDate: st.dueDate ? new Date(st.dueDate) : null,
            editHistory: [],
            createdAt: now,
            updatedAt: now,
            createdBy: createdBy,
            updatedBy: createdBy,
            historicalAssigneeIds: Array.from(new Set([
              ...st.assignees.map((a: any) => a.employeeId),
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
            createdAt: now,
            createdBy: createdBy,
          });

          if (st.assignees && st.assignees.length > 0) {
            notificationsToSend.push({
              taskData: {
                projectId,
                projectName,
                workOrderId: woId,
                workOrderName: woName,
                categoryId: catId,
                categoryName: catName,
                taskId: taskId,
                taskName: taskName
              },
              subtaskName: st.subtaskName,
              subtaskId,
              assignees: st.assignees
            });
          }
        });

        subtaskCounts.set(countKey, subtaskIndexOffset);
      }
    });

    // Send notifications asynchronously after transaction completes
    if (notificationsToSend.length > 0) {
      Promise.all(notificationsToSend.map(n =>
        this.sendAssignmentNotifications(n.taskData, n.subtaskName, n.subtaskId, n.assignees, createdBy)
      )).catch(err => {
        console.error('[TaskService] Error in bulk WBS assignment notifications:', err);
      });
    }

    // ─── Upsert WorkOrder & Category configs into Firebase A ──────────────────
    // This ensures the NewTask modal dropdowns (workOrderCode + categoryName)
    // reflect whatever was imported from the WBS Excel plan.
    // Strategy: createIfAbsent (merge: true on new doc, skip if doc already exists)
    // so we never overwrite existing leaderIds / leaderNames assignments.
    const PROJECT_CONFIG_COLLECTION = 'Project';

    // Collect unique (woCode, woName) and unique (woCode, catName) pairs
    const woEntries = new Map<string, string>(); // woCode → woName
    const catEntries = new Map<string, string>(); // `${woCode}||${catName}` → woCode

    for (const task of groupedTasks) {
      const woCode = (task.workOrderCode || 'GEN').toUpperCase().trim();
      const woName = task.workOrderName || 'General';
      const catName = (task.categoryName || 'General').trim();
      if (!woEntries.has(woCode)) {
        woEntries.set(woCode, woName);
      }
      const catKey = `${woCode}||${catName}`;
      if (!catEntries.has(catKey)) {
        catEntries.set(catKey, woCode);
      }
    }

    // Upsert WorkOrder Configs
    for (const [woCode, woName] of woEntries) {
      const woConfigRef = db
        .collection(PROJECT_CONFIG_COLLECTION)
        .doc(projectId)
        .collection('workOrderConfigs')
        .doc(woCode);
      const woConfigDoc = await woConfigRef.get();
      if (!woConfigDoc.exists) {
        await woConfigRef.set({
          code: woCode,
          name: woName,
          createdAt: now,
          createdBy: createdBy,
          leaderId: null,
          leaderName: null,
          leaderIds: [],
          leaderNames: [],
        });
      }
    }

    // Upsert Category Configs
    for (const [catKey, woCode] of catEntries) {
      const catName = catKey.split('||')[1];
      // Check for existing category with same workOrderCode + name
      const existingCatSnap = await db
        .collection(PROJECT_CONFIG_COLLECTION)
        .doc(projectId)
        .collection('categoryConfigs')
        .where('workOrderCode', '==', woCode)
        .where('name', '==', catName)
        .limit(1)
        .get();
      if (existingCatSnap.empty) {
        const newCatRef = db
          .collection(PROJECT_CONFIG_COLLECTION)
          .doc(projectId)
          .collection('categoryConfigs')
          .doc();
        await newCatRef.set({
          workOrderCode: woCode,
          name: catName,
          createdAt: now,
          createdBy: createdBy,
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    return { success: true, importedCount: groupedTasks.length };
  }

  private async resolveRefs(id: string) {
    let taskRef: FirebaseFirestore.DocumentReference;
    let subtaskRef: FirebaseFirestore.DocumentReference | undefined = undefined;
    const compositeParts = this.parseCompositeId(id);
    if (compositeParts.length >= 3) {
      const parts = compositeParts;
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

  private parseCompositeId(id: string): string[] {
    if (id.includes('__')) {
      return id.split('__');
    }
    if (id.includes('_')) {
      const parts = id.split('_');
      if (parts.length >= 3) {
        return parts;
      }
    }
    return [];
  }

  async updateSubtaskDeletability(subtaskRef: FirebaseFirestore.DocumentReference, subtaskId: string): Promise<boolean> {
    const doc = await subtaskRef.get();
    if (!doc.exists) return false;
    const subtaskData = doc.data() as any;

    let isDeletable = true;

    // 1. Current progress check
    if ((subtaskData.dailyProgress || 0) > 0) {
      isDeletable = false;
    }

    // 2. Query all daily reports in revisions and help collections
    if (isDeletable) {
      const revisionsSnap = await subtaskRef.collection('revisions').get();
      for (const revDoc of revisionsSnap.docs) {
        const reportsSnap = await revDoc.ref.collection('dailyReports').get();
        for (const repDoc of reportsSnap.docs) {
          const report = repDoc.data();
          const hasLabor = Array.isArray(report.labor) && report.labor.length > 0;
          const hasOt = (report.otHours || 0) > 0 || (report.otMorningHours || 0) > 0 || (report.otEveningHours || 0) > 0;
          const progress = report.progress || 0;

          if (progress > 0 || hasLabor || hasOt) {
            isDeletable = false;
            break;
          }
        }
        if (!isDeletable) break;
      }
    }

    if (isDeletable) {
      const helpSnap = await subtaskRef.collection('help').get();
      for (const helpDoc of helpSnap.docs) {
        const reportsSnap = await helpDoc.ref.collection('dailyReports').get();
        for (const repDoc of reportsSnap.docs) {
          const report = repDoc.data();
          const hasLabor = Array.isArray(report.labor) && report.labor.length > 0;
          const hasOt = (report.otHours || 0) > 0 || (report.otMorningHours || 0) > 0 || (report.otEveningHours || 0) > 0;
          const progress = report.progress || 0;

          if (progress > 0 || hasLabor || hasOt) {
            isDeletable = false;
            break;
          }
        }
        if (!isDeletable) break;
      }
    }

    // 3. Query global daily_reports collection
    if (isDeletable) {
      const globalReportsSnap = await db.collection('daily_reports')
        .where('taskId', '==', subtaskId)
        .where('isDeleted', '==', false)
        .get();
      
      if (!globalReportsSnap.empty) {
        for (const repDoc of globalReportsSnap.docs) {
          const report = repDoc.data();
          const hours = report.netHours || 0;
          if (hours > 0) {
            isDeletable = false;
            break;
          }
        }
      }
    }

    // Update the subtask document with the computed flag
    if (subtaskData.isDeletable !== isDeletable) {
      await subtaskRef.update({ isDeletable });
    }

    return isDeletable;
  }

  private async migrateTaskData(
    oldTaskRef: FirebaseFirestore.DocumentReference,
    newTaskRef: FirebaseFirestore.DocumentReference,
    taskData: any,
    finalSubtasks: any[]
  ): Promise<void> {
    console.log(`[TaskService] Migrating task data with ${finalSubtasks?.length || 0} subtasks.`);
    const batch = afterSaleDb.batch();
    
    // 1. Write the new task document
    batch.set(newTaskRef, taskData);
    
    // 2. Move subtasks, revisions, help, and dailyReports
    const subtasksSnap = await oldTaskRef.collection('subtasks').get();
    for (const subDoc of subtasksSnap.docs) {
      const stData = subDoc.data();
      const newSubtaskRef = newTaskRef.collection('subtasks').doc(subDoc.id);
      
      // Copy subtask document
      batch.set(newSubtaskRef, stData);
      batch.delete(subDoc.ref);
      
      // Copy revisions
      const revisionsSnap = await subDoc.ref.collection('revisions').get();
      for (const revDoc of revisionsSnap.docs) {
        const newRevRef = newSubtaskRef.collection('revisions').doc(revDoc.id);
        batch.set(newRevRef, revDoc.data());
        batch.delete(revDoc.ref);
        
        // Copy dailyReports under revision
        const reportsSnap = await revDoc.ref.collection('dailyReports').get();
        for (const repDoc of reportsSnap.docs) {
          const newRepRef = newRevRef.collection('dailyReports').doc(repDoc.id);
          batch.set(newRepRef, repDoc.data());
          batch.delete(repDoc.ref);
        }
      }
      
      // Copy help
      const helpSnap = await subDoc.ref.collection('help').get();
      for (const helpDoc of helpSnap.docs) {
        const newHelpRef = newSubtaskRef.collection('help').doc(helpDoc.id);
        batch.set(newHelpRef, helpDoc.data());
        batch.delete(helpDoc.ref);
        
        // Copy dailyReports under help
        const reportsSnap = await helpDoc.ref.collection('dailyReports').get();
        for (const repDoc of reportsSnap.docs) {
          const newRepRef = newHelpRef.collection('dailyReports').doc(repDoc.id);
          batch.set(newRepRef, repDoc.data());
          batch.delete(repDoc.ref);
        }
      }
    }
    
    // 3. Delete old task document
    batch.delete(oldTaskRef);
    
    await batch.commit();
  }

  /**
   * ส่งการแจ้งเตือนแบบกลุ่ม/เดี่ยวเมื่อมีการมอบหมายงาน (task_assigned) ไปยัง FM/SE
   */
  async sendAssignmentNotifications(
    taskData: any,
    subtaskName: string,
    subtaskId: string,
    assignees: TaskAssignee[],
    createdBy: string
  ): Promise<void> {
    try {
      if (!assignees || assignees.length === 0) return;

      const employeeIds = assignees.map(a => a.employeeId).filter(Boolean);
      if (employeeIds.length === 0) return;

      // 1. Resolve target uids from db (Project A) by employeeId
      const uidsMap = new Map<string, string>(); // employeeId -> uid
      for (let i = 0; i < employeeIds.length; i += 30) {
        const chunk = employeeIds.slice(i, i + 30);
        const usersSnap = await db.collection('users').where('employeeId', 'in', chunk).get();
        usersSnap.docs.forEach(doc => {
          const uData = doc.data();
          if (uData.employeeId) {
            uidsMap.set(uData.employeeId, doc.id); // doc.id is Firestore uid
          }
        });
      }

      // 2. Resolve creator details
      let createdByName = 'System';
      let createdByEmployeeId = createdBy;
      if (createdBy) {
        const userDoc = await db.collection('users').doc(createdBy).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          createdByName = uData?.name || uData?.username || 'Unknown User';
          createdByEmployeeId = uData?.employeeId || createdBy;
        } else {
          const userQuery = await db.collection('users').where('employeeId', '==', createdBy).limit(1).get();
          if (!userQuery.empty) {
            const uData = userQuery.docs[0].data();
            createdByName = uData?.name || uData?.username || 'Unknown User';
            createdByEmployeeId = uData?.employeeId || createdBy;
          }
        }
      }

      // 3. Create notification documents in Project B (afterSaleDb)
      const batch = afterSaleDb.batch();
      let hasNotification = false;

      for (const assignee of assignees) {
        const targetUid = uidsMap.get(assignee.employeeId);
        if (!targetUid) {
          console.warn(`[TaskService] Could not resolve uid for employeeId: ${assignee.employeeId}`);
          continue;
        }

        const notificationData: Notification = {
          type: 'task_assigned',
          projectId: taskData.projectId || '',
          projectName: taskData.projectName || '',
          workOrderId: taskData.workOrderId || '',
          workOrderName: taskData.workOrderName || '',
          categoryId: taskData.categoryId || '',
          categoryName: taskData.categoryName || '',
          taskId: taskData.taskId || '',
          taskName: taskData.taskName || '',
          subtaskId: subtaskId || '',
          subtaskName: subtaskName || '',
          message: subtaskName
            ? `${createdByName} ได้มอบหมายงานย่อย "${subtaskName}" ในงาน "${taskData.taskName}" ให้คุณ`
            : `${createdByName} ได้มอบหมายงาน "${taskData.taskName}" ให้คุณ`,
          createdAt: new Date(),
          createdBy: createdByEmployeeId,
          createdByName: createdByName,
          readBy: [],
          targetUserId: targetUid
        };

        const docRef = afterSaleDb.collection('notifications').doc();
        batch.set(docRef, notificationData);
        hasNotification = true;
      }

      if (hasNotification) {
        await batch.commit();
        console.log(`[TaskService] Sent task_assigned notifications to ${assignees.length} assignees`);
      }
    } catch (error: any) {
      console.error('[TaskService] Failed to send assignment notifications:', error.message);
    }
  }

}

export const taskService = new TaskService();
