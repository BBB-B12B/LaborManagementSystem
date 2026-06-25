import { Router, Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { taskService } from '../../services/TaskService';
import { taskConverter } from '../../models/Task';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../../config/firebase';
import { afterSaleDb } from '../../config/firebaseProjectB';

import multer from 'multer';
import { parseWbsExcel } from '../../utils/wbsParser';
import * as ExcelJS from 'exceljs';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * ดึงรายการ ID ของ Work Orders ที่เป็นระบบ After-Sale (type == 'AfterSale')
 */
export async function getAfterSaleWorkOrderIds(): Promise<Set<string>> {
  try {
    const snap = await afterSaleDb.collection('workOrders').where('type', '==', 'AfterSale').get();
    return new Set(snap.docs.map(doc => doc.id));
  } catch (err) {
    console.error('[getAfterSaleWorkOrderIds] Error fetching AfterSale workOrders:', err);
    return new Set();
  }
}


// Apply authentication to all routes
router.use(authenticate);

async function validateLeaderAccess(userId: string, projectId: string, workOrderCode: string): Promise<boolean> {
  if (!projectId || !workOrderCode) return false;
  const doc = await db
    .collection('Project')
    .doc(projectId)
    .collection('workOrderConfigs')
    .doc(workOrderCode.trim().toUpperCase())
    .get();
  
  if (!doc.exists) return false;
  const data = doc.data();
  if (!data) return false;
  return data.leaderId === userId || 
         (data.leaderIds && Array.isArray(data.leaderIds) && data.leaderIds.includes(userId)) ||
         (data.AssignLD && Array.isArray(data.AssignLD) && data.AssignLD.includes(userId));
}

async function checkTaskLeaderAccess(req: Request, taskId: string): Promise<void> {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.roleCode;
  if (userRole !== 'LD') return;

  let taskDoc;
  const parts = taskId.split('__');
  if (parts.length >= 3) {
    const [woId, catId, idOnly] = parts;
    taskDoc = await afterSaleDb.collection('workOrders').doc(woId).collection('categories').doc(catId).collection('tasks').doc(idOnly).get();
  } else {
    const querySnapshot = await afterSaleDb.collectionGroup('tasks').where('taskId', '==', taskId).limit(1).get();
    if (!querySnapshot.empty) {
      taskDoc = querySnapshot.docs[0];
    }
  }

  if (!taskDoc || !taskDoc.exists) {
    throw new AppError('ไม่พบงานที่ต้องการเข้าถึง', 404);
  }

  const taskData = taskDoc.data() as any;
  const projectId = taskData.projectId;
  const workOrderCode = taskData.workOrderCode;

  const isAssigned = await validateLeaderAccess(authReq.user!.id, projectId, workOrderCode);
  if (!isAssigned) {
    throw new AppError('คุณไม่มีสิทธิ์เข้าถึงหรือจัดการงานในหมวดงานนี้ (Access denied for this Work Order)', 403);
  }
}

// GET /api/tasks/backlog
router.get('/backlog', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const { startDate, endDate } = req.query;
    const userRole = authReq.user?.roleCode;
    const userEmployeeId = authReq.user?.employeeId;
    const userProjectIds = authReq.user?.projectLocationIds || [];

    if (!startDate || !endDate) {
      throw new AppError('ต้องระบุวันที่เริ่มต้น (startDate) และวันที่สิ้นสุด (endDate) (startDate and endDate are required)', 400);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('รูปแบบวันที่ไม่ถูกต้อง (Invalid date format)', 400);
    }

    // 1. Define all queries and fetch them concurrently to minimize network roundtrip latency
    let projectsQuery = db.collection('Project');
    if ((userRole === 'FM' || userRole === 'SE') && userProjectIds.length > 0) {
      projectsQuery = projectsQuery.where(admin.firestore.FieldPath.documentId(), 'in', userProjectIds) as any;
    }

    const periodsQuery = db.collection('wagePeriods');
    const dcQuery = db.collection('dailyContractors').where('isActive', '==', true);

    let tasksQuery: admin.firestore.Query = afterSaleDb.collectionGroup('tasks');
    if ((userRole === 'FM' || userRole === 'SE') && userProjectIds.length > 0) {
      tasksQuery = tasksQuery.where('projectId', 'in', userProjectIds);
    }

    let subtasksQuery: admin.firestore.Query = afterSaleDb.collectionGroup('subtasks');
    if ((userRole === 'FM' || userRole === 'SE') && userProjectIds.length > 0) {
      subtasksQuery = subtasksQuery.where('projectId', 'in', userProjectIds);
    }

    const usersQuery = db.collection('users');

    const startOfDay = new Date(start);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    const reportsQuery = afterSaleDb.collectionGroup('dailyReports')
      .where('reportDate', '>=', startOfDay)
      .where('reportDate', '<=', endOfDay);

    const [
      projectsSnapshot,
      periodsSnapshot,
      contractorsSnapshot,
      afterSaleWoIds,
      tasksSnapshot,
      subtasksSnapshot,
      usersSnapshot,
      reportsSnapshot
    ] = await Promise.all([
      projectsQuery.get(),
      periodsQuery.get(),
      dcQuery.get(),
      getAfterSaleWorkOrderIds(),
      tasksQuery.get(),
      subtasksQuery.get(),
      usersQuery.get(),
      reportsQuery.get()
    ]);
    const projectsMap = new Map<string, string>(); // projectId -> projectCode
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      projectsMap.set(doc.id, data.projectCode || data.code || '');
    });

    // 2. Map locked wage periods for projects
    const periods = periodsSnapshot.docs.map(doc => doc.data()).filter(p => p.isDeleted !== true);

    const isProjectDateLocked = (projectCode: string, date: Date) => {
      if (!projectCode) return false;
      return periods.some(p => {
        if (p.projectCode !== projectCode) return false;
        const pStart = p.startDate.toDate ? p.startDate.toDate() : new Date(p.startDate);
        const pEnd = p.endDate.toDate ? p.endDate.toDate() : new Date(p.endDate);
        
        // Normalize to local midnight to prevent timezone shifts
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const s = new Date(pStart);
        s.setHours(0, 0, 0, 0);
        const e = new Date(pEnd);
        e.setHours(0, 0, 0, 0);
        
        return d >= s && d <= e && ['approved', 'paid', 'locked'].includes(p.status);
      });
    };

    // 3. Map active daily contractors
    let contractors = contractorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    if (userRole !== 'FM' && userRole !== 'SE') {
      throw new AppError('ไม่มีสิทธิ์เข้าถึงข้อมูลประวัติย้อนหลัง (Access denied for this role)', 403);
    }

    if (userEmployeeId) {
      // Filter strictly to contractors recorded by this User (FM or SE)
      contractors = contractors.filter(dc => {
        const usage = dc.foremanUsage || {};
        return usage[userEmployeeId] && usage[userEmployeeId].count > 0;
      });

      // Sort by the usage count of the current user (employeeId) descending (most frequently used first)
      contractors.sort((a, b) => {
        const countA = a.foremanUsage?.[userEmployeeId]?.count || 0;
        const countB = b.foremanUsage?.[userEmployeeId]?.count || 0;
        return countB - countA;
      });
    }

    // 4. Map tasks and subtasks from afterSaleDb
    
    const tasksMap = new Map<string, any>();
    tasksSnapshot.docs.forEach(doc => {
      const pathParts = doc.ref.path.split('/');
      const taskId = pathParts[5] || doc.id;
      const tData = taskConverter.fromFirestore(doc);
      tasksMap.set(taskId, {
        ...tData,
        path: doc.ref.path
      });
    });

    let tasks = subtasksSnapshot.docs.map(doc => {
      const data = doc.data() as any;
      const parentPath = doc.ref.parent.parent?.path;
      const parts = parentPath?.split('/') || [];
      const woId = parts[1];
      const catId = parts[3];
      const taskId = parts[5];
      const fullId = `${woId}__${catId}__${taskId}__${data.subtaskId}`;
      
      const parentTask = tasksMap.get(taskId);
      if (!parentTask) return null;
      
      // กรองไม่แสดงงานของ After-Sale ออกจากระบบ
      if (afterSaleWoIds.has(woId)) return null;
      
      return {
        ...parentTask,
        ...data,
        id: fullId,
        taskId: fullId,
        path: doc.ref.path,
        parentTaskId: taskId,
        taskName: parentTask.taskName ? `${parentTask.taskName} > ${data.subtaskName}` : data.subtaskName,
        dueDate: data.dueDate || parentTask.dueDate,
        revisionCreatedAt: data.revisionCreatedAt || parentTask.revisionCreatedAt,
        createdAt: data.createdAt || parentTask.createdAt,
      };
    }).filter(Boolean) as any[];

    // Filter tasks if role is FM
    if (userRole === 'FM' || userRole === 'SE') {
      if (userProjectIds.length > 0) {
        tasks = tasks.filter((t: any) => userProjectIds.includes(t.projectId));
      }
      if (userEmployeeId) {
        const uEmpId = String(userEmployeeId).toLowerCase().trim();
        const uId = String(authReq.user?.uid || '').toLowerCase().trim();
        tasks = tasks.filter((t: any) => {
          const isActive = t.isActive !== false;
          const assignees = Array.isArray(t.assignees) ? t.assignees : [];
          const supportAssignees = Array.isArray(t.supportAssignees) ? t.supportAssignees : [];
          const historicalIds = Array.isArray(t.historicalAssigneeIds) ? t.historicalAssigneeIds : [];
          const taskRelatedIds = new Set([
            ...assignees.map((a: any) => String(a.employeeId || a.id || '').toLowerCase().trim()),
            ...supportAssignees.map((a: any) => String(a.employeeId || a.id || '').toLowerCase().trim()),
            ...historicalIds.map((id: any) => String(id || '').toLowerCase().trim()),
          ]);
          return isActive && (taskRelatedIds.has(uEmpId) || taskRelatedIds.has(uId));
        });
      }
    }

    // Map users to map uid/employeeId -> name
    const usersMap = new Map<string, string>();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name || data.username || 'Unknown User';
      usersMap.set(doc.id, name);
      if (data.employeeId) {
        usersMap.set(data.employeeId, name);
      }
    });

    const getUserName = (uid: string) => {
      if (!uid) return '';
      return usersMap.get(uid) || uid;
    };

    // 5. Fetch daily reports for these tasks within date range
    const allReports: any[] = [];
    
    // Generate dates array for matching
    const dates: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    if (dates.length > 0) {
      // Build a map of tasks by path for quick lookup
      const tasksByPath = new Map<string, any>();
      tasks.forEach(t => {
        tasksByPath.set(t.path, t);
      });

      // Use pre-fetched reportsSnapshot

      reportsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const path = doc.ref.path;
        const parts = path.split('/');

        // dailyReports under subtask have length 12:
        // workOrders/{woId}/categories/{catId}/tasks/{taskId}/subtasks/{subtaskId}/revisions/{currentRev}/dailyReports/{dateStr}
        // or help:
        // workOrders/{woId}/categories/{catId}/tasks/{taskId}/subtasks/{subtaskId}/help/{helpId}/dailyReports/{dateStr}
        if (parts.length !== 12) return;

        const subtaskPath = `workOrders/${parts[1]}/categories/${parts[3]}/tasks/${parts[5]}/subtasks/${parts[7]}`;
        const task = tasksByPath.get(subtaskPath);
        if (!task) return;

        const currentRev = task.currentRevision || 'rev00';
        const helpId = currentRev.replace('rev', 'help');

        const isNormal = parts[8] === 'revisions' && parts[9] === currentRev;
        const isSupport = parts[8] === 'help' && parts[9] === helpId;

        if (!isNormal && !isSupport) return;

        allReports.push({
          taskId: task.taskId,
          taskName: task.taskName,
          taskPath: task.path,
          isSupport: isSupport,
          dateStr: doc.id,
          unlockedDates: isSupport ? (task.supportUnlockedDates || {}) : (task.unlockedDates || {}),
          ...data
        });
      });

      // Now set completionDate and startDate for each task.
      // Helper hoisted above the loop so the completionDate fallback below can reuse it
      // (updatedAt may be a Firestore Timestamp object, which a raw new Date(...) cannot parse).
      const getTaskDateStr = (timestampOrStr: any) => {
        if (!timestampOrStr) return null;
        if (typeof timestampOrStr === 'object' && ('_seconds' in timestampOrStr || 'seconds' in timestampOrStr)) {
          const secs = timestampOrStr._seconds || timestampOrStr.seconds;
          return new Date(secs * 1000).toISOString().split('T')[0];
        }
        try {
          return new Date(timestampOrStr).toISOString().split('T')[0];
        } catch (e) {
          return null;
        }
      };
      for (const task of tasks) {
        // Fetch completion date if task has reached 100% or completed
        let completionDate: string | null = null;
        if (
          task.dailyProgress >= 100 ||
          task.supportDailyProgress >= 100 ||
          task.status === 'completed'
        ) {
          // Check if we already have a 100% report in our loaded date range
          const completedReportInAll = allReports.find(r => r.taskId === task.taskId && r.progress >= 100);
          if (completedReportInAll) {
            completionDate = completedReportInAll.dateStr;
          } else {
            // updatedAt may be a Firestore Timestamp object; getTaskDateStr handles that
            // (a raw new Date(timestampObject) is an Invalid Date and throws on toISOString).
            completionDate = getTaskDateStr(task.updatedAt) || new Date().toISOString().split('T')[0];
          }
        }
        task.completionDate = completionDate;

        // Now compute startDate for this task using allReports and task creation fields
        let startDateStr: string | null = null;
        if (task.revisionCreatedAt && task.currentRevision && task.currentRevision !== 'rev00') {
          startDateStr = getTaskDateStr(task.revisionCreatedAt);
        } else if (task.isSupportRequest && task.supportCreatedAt) {
          startDateStr = getTaskDateStr(task.supportCreatedAt);
        } else {
          startDateStr = getTaskDateStr(task.createdAt);
        }

        // Check if there are any reports for this task (inside allReports) that are earlier than startDateStr
        const taskReports = allReports.filter(r => r.taskId === task.taskId);
        if (taskReports.length > 0) {
          const reportDates = taskReports.map(r => r.dateStr).sort();
          const earliestReportDate = reportDates[0];
          if (startDateStr && earliestReportDate < startDateStr) {
            startDateStr = earliestReportDate;
          }
        }
        task.startDate = startDateStr;
      }
    }

    // 6. Build the grid
    const grid = contractors.map(dc => {
      // Find contractor project code
      const contractorProjectId = dc.projectLocationIds?.[0] || '';
      const contractorProjectCode = projectsMap.get(contractorProjectId) || '';

      // Determine the last used foreman name and date
      let lastUsedByName = dc.lastUsedByName || '';
      let lastUsedDateStr = '';
      if (dc.lastUsedAt) {
        try {
          const dateObj = typeof dc.lastUsedAt.toDate === 'function' ? dc.lastUsedAt.toDate() : new Date(dc.lastUsedAt);
          lastUsedDateStr = dateObj.toISOString().split('T')[0];
        } catch (e) {
          console.error('Failed to parse lastUsedAt:', e);
        }
      }
      
      // 1. Search in the 15-day reports first (since it's the most recent real data)
      const sortedReports = [...allReports].sort((a, b) => b.dateStr.localeCompare(a.dateStr));
      for (const report of sortedReports) {
        const hasWorker = report.labor?.some((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId) ||
                          report.leave?.some((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId);
        if (hasWorker && report.createdBy) {
          lastUsedByName = getUserName(report.createdBy);
          lastUsedDateStr = report.dateStr;
          break;
        }
      }
      
      // 2. If still empty, fall back to foremanUsage
      if (!lastUsedByName && dc.foremanUsage) {
        const usages = Object.values(dc.foremanUsage) as any[];
        if (usages.length > 0) {
          // Find the foreman with the highest count
          const highestUsage = usages.reduce((prev, current) => (prev.count > current.count) ? prev : current);
          lastUsedByName = highestUsage.name || '';
        }
      }

      const workerDays = dates.map(dateStr => {
        const dateObj = new Date(dateStr);
        const isLocked = isProjectDateLocked(contractorProjectCode, dateObj);

        // Find if there is any work or leave record for this worker on this date
        const reportsForDate = allReports.filter(r => r.dateStr === dateStr);
        
        let workedEntry: any = null;
        let leaveEntry: any = null;
        let matchedReport: any = null;

        for (const report of reportsForDate) {
          const laborItem = report.labor?.find((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId);
          if (laborItem) {
            workedEntry = laborItem;
            matchedReport = report;
            break;
          }
          const leaveItem = report.leave?.find((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId);
          if (leaveItem) {
            leaveEntry = leaveItem;
            matchedReport = report;
            break;
          }
        }

        // Determine edit authorization rules
        let allowEdit = false;
        let reason = '';
        if (isLocked) {
          allowEdit = false;
          reason = 'ล็อกโดยงวดค่าแรง (Locked by wage period)';
        } else {
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          threeDaysAgo.setHours(0, 0, 0, 0);

          if (matchedReport) {
            // Already has report for this date -> edit is allowed since it's labor update
            allowEdit = true;
          } else {
            // If the date is older than 3 days:
            // But there is at least one Dailyreport submitted for one of our tasks on this date,
            // we allow editing so the user can add this worker to that reported task.
            const hasExistingReportForAnyTask = reportsForDate.length > 0;
            const isWithin3Days = dateObj >= threeDaysAgo;
            if (isWithin3Days || hasExistingReportForAnyTask) {
              allowEdit = true;
            } else {
              // Check if any task is unlocked for this date (handles Firestore Timestamps properly)
              const unlockedTask = tasks.find((t: any) => {
                const unlockedDates = t.unlockedDates || {};
                const supportUnlockedDates = t.supportUnlockedDates || {};
                const unlockInfo = unlockedDates[dateStr] || supportUnlockedDates[dateStr];
                if (!unlockInfo) return false;
                const unlockedUntilDate = unlockInfo.unlockedUntil?.toDate
                  ? unlockInfo.unlockedUntil.toDate()
                  : new Date(unlockInfo.unlockedUntil);
                return unlockedUntilDate >= new Date();
              });
              if (unlockedTask) {
                allowEdit = true;
              } else {
                allowEdit = false;
                reason = 'รายงานเกิน 3 วันและไม่ได้ปลดล็อกสิทธิ์ (Older than 3 days and not unlocked)';
              }
            }
          }
        }

        let reportUpdatedAtStr = '';
        if (matchedReport) {
          const timestamp = matchedReport.updatedAt || matchedReport.createdAt;
          if (timestamp) {
            try {
              const dateObj = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
              reportUpdatedAtStr = dateObj.toISOString().split('T')[0];
            } catch (e) {
              console.error('Failed to parse report updatedAt:', e);
            }
          }
        }

        // Calculate last used foreman relative to this date (on or before dateStr)
        let dayLastUsedByName = '';
        let dayLastUsedDateStr = '';

        // 1. Search in the 15-day reports that are on or before dateStr
        const sortedReportsBeforeOrOnDate = [...allReports]
          .filter(r => r.dateStr <= dateStr)
          .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

        for (const report of sortedReportsBeforeOrOnDate) {
          const hasWorker = report.labor?.some((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId) ||
                            report.leave?.some((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId);
          if (hasWorker && report.createdBy) {
            dayLastUsedByName = getUserName(report.createdBy);
            dayLastUsedDateStr = report.dateStr;
            break;
          }
        }

        // 2. Fallback to dc-level lastUsedByName / lastUsedDateStr if that date is on or before dateStr
        if (!dayLastUsedByName && lastUsedDateStr && lastUsedDateStr <= dateStr) {
          dayLastUsedByName = lastUsedByName;
          dayLastUsedDateStr = lastUsedDateStr;
        }

        // 3. Fallback to dc.foremanUsage if still empty
        if (!dayLastUsedByName && dc.foremanUsage) {
          const usages = Object.values(dc.foremanUsage) as any[];
          if (usages.length > 0) {
            const highestUsage = usages.reduce((prev, current) => (prev.count > current.count) ? prev : current);
            dayLastUsedByName = highestUsage.name || '';
          }
        }

        return {
          date: dateStr,
          isLocked,
          allowEdit,
          reason,
          lastUsedByName: dayLastUsedByName || null,
          lastUsedDateStr: dayLastUsedDateStr || null,
          record: workedEntry ? {
            type: 'regular',
            shifts: workedEntry.shifts,
            shiftTimes: workedEntry.shiftTimes,
            taskId: matchedReport.taskId,
            taskName: matchedReport.taskName,
            isSupport: matchedReport.isSupport,
            reportDate: matchedReport.reportDate,
            reportStatus: matchedReport.status || 'draft',
            createdBy: matchedReport.createdBy || null,
            createdByName: matchedReport.createdBy ? getUserName(matchedReport.createdBy) : null,
            updatedBy: matchedReport.updatedBy || null,
            updatedByName: matchedReport.updatedBy ? getUserName(matchedReport.updatedBy) : null,
            updatedAtStr: reportUpdatedAtStr || null
          } : leaveEntry ? {
            type: 'leave',
            leaveType: leaveEntry.leaveType,
            medCertFileUrl: leaveEntry.medCertFileUrl,
            taskId: matchedReport.taskId,
            taskName: matchedReport.taskName,
            isSupport: matchedReport.isSupport,
            reportDate: matchedReport.reportDate,
            reportStatus: matchedReport.status || 'draft',
            createdBy: matchedReport.createdBy || null,
            createdByName: matchedReport.createdBy ? getUserName(matchedReport.createdBy) : null,
            updatedBy: matchedReport.updatedBy || null,
            updatedByName: matchedReport.updatedBy ? getUserName(matchedReport.updatedBy) : null,
            updatedAtStr: reportUpdatedAtStr || null
          } : null
        };
      });

      return {
        workerId: dc.id,
        workerName: dc.name,
        employeeId: dc.employeeId,
        skillId: dc.skillId,
        lastUsedByName: lastUsedByName || null,
        lastUsedDateStr: lastUsedDateStr || null,
        days: workerDays
      };
    });

    res.status(200).json({
      success: true,
      data: {
        dates,
        grid,
        tasks: tasks.map((t: any) => {
          const taskReports = allReports.filter(r => r.taskId === t.taskId);
          const reportedDates = Array.from(new Set(taskReports.map(r => r.dateStr)));
          return {
            taskId: t.taskId,
            taskName: t.taskName,
            isSupportRequest: t.isSupportRequest || false,
            currentRevision: t.currentRevision || 'rev00',
            completionDate: t.completionDate || null,
            startDate: t.startDate || null,
            reportedDates
          };
        })
      }
    });

  } catch (error) {
    next(error);
  }
});


// GET /api/tasks/assigned-subtasks
router.get('/assigned-subtasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.uid || '').toLowerCase().trim();
    const employeeId = String((req.user as any)?.employeeId || '').toLowerCase().trim();
    const userRole = String((req.user as any)?.roleCode || req.user?.role || '').toUpperCase();
    const { projectId } = req.query;

    const parseFirestoreTimestamp = (val: any) => {
      if (!val) return val;
      if (typeof val.toDate === 'function') return val.toDate().toISOString();
      if (typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
        const secs = val._seconds || val.seconds;
        return new Date(secs * 1000).toISOString();
      }
      return val;
    };

    const parseUnlockDates = (dates: any) => {
      if (!dates) return {};
      const res: any = {};
      Object.keys(dates).forEach(key => {
        res[key] = {
          ...dates[key],
          unlockedUntil: parseFirestoreTimestamp(dates[key].unlockedUntil)
        };
      });
      return res;
    };

    const parseUnlockRequests = (reqs: any) => {
      if (!reqs) return {};
      const res: any = {};
      Object.keys(reqs).forEach(key => {
        res[key] = {
          ...reqs[key],
          requestedAt: parseFirestoreTimestamp(reqs[key].requestedAt)
        };
      });
      return res;
    };

    const afterSaleWoIds = await getAfterSaleWorkOrderIds();

    const userProjectIds = (req.user as any)?.projectLocationIds || [];
    let targetProjectIds: string[] = [];
    if (projectId) {
      targetProjectIds = [String(projectId)];
    } else if ((userRole === 'FM' || userRole === 'SE') && userProjectIds.length > 0) {
      targetProjectIds = userProjectIds;
    }

    let subtasksQuery: admin.firestore.Query = afterSaleDb.collectionGroup('subtasks');
    if (targetProjectIds.length > 0) {
      subtasksQuery = subtasksQuery.where('projectId', 'in', targetProjectIds.slice(0, 10));
    }
    const snapshot = await subtasksQuery.get();

    // Merge in cross-project support tasks this user picked up (deduped by doc path).
    // historicalAssigneeIds is a flat array of employeeIds -> array-contains works.
    // Use the raw-case employeeId (Firestore array-contains is an exact match).
    const subtaskDocsByPath = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    snapshot.docs.forEach(d => subtaskDocsByPath.set(d.ref.path, d));
    // Match against ALL of the user's identifiers: member-doc id (== frontend user.id), HR employeeId,
    // and auth uid. Support pickup stores historicalAssigneeIds using the member id (a.employeeId = v.id),
    // NOT the HR employeeId — so a single array-contains on employeeId silently missed the assignee's own
    // cross-project picked-up support tasks (the bug: noti fired but the task never appeared in "My job").
    const employeeIdRaw = String((req.user as any)?.employeeId || '').trim();
    const userIdRaw = String((req.user as any)?.id || '').trim();
    const uidRaw = String(req.user?.uid || '').trim();
    const supportMatchIds = Array.from(new Set([userIdRaw, employeeIdRaw, uidRaw].filter(Boolean)));
    if ((userRole === 'FM' || userRole === 'SE') && !projectId && supportMatchIds.length > 0) {
      try {
        const supportSnap = await afterSaleDb.collectionGroup('subtasks')
          .where('historicalAssigneeIds', 'array-contains-any', supportMatchIds)
          .get();
        supportSnap.docs.forEach(d => subtaskDocsByPath.set(d.ref.path, d));
      } catch (err: any) {
        console.error('[assigned-subtasks] cross-project support query failed (index building?):', err.message);
      }
    }
    const subtaskDocs = Array.from(subtaskDocsByPath.values());

    let subtasks = subtaskDocs.map(doc => {
      const data = doc.data() as any;
      const parentPath = doc.ref.parent.parent?.path;
      const parts = parentPath?.split('/') || [];
      const woId = parts[1];
      const catId = parts[3];
      const taskId = parts[5];
      const subtaskId = doc.id;
      const fullId = `${woId}__${catId}__${taskId}__${subtaskId}`;
      return {
        ...data,
        createdAt: parseFirestoreTimestamp(data.createdAt),
        updatedAt: parseFirestoreTimestamp(data.updatedAt),
        dueDate: parseFirestoreTimestamp(data.dueDate),
        unlockedDates: parseUnlockDates(data.unlockedDates),
        unlockRequests: parseUnlockRequests(data.unlockRequests),
        supportUnlockedDates: parseUnlockDates(data.supportUnlockedDates),
        supportUnlockRequests: parseUnlockRequests(data.supportUnlockRequests),
        id: fullId,
        woId, // สำหรับใช้กรอง After-Sale
        taskId: subtaskId, // original subtaskId (full code ARC-xxxx-xxx-xxxx)
        parentTaskId: taskId, // the parent task's id
      };
    });

    if (userRole === 'FM' || userRole === 'SE') {
       subtasks = subtasks.filter(st => {
           const stAssignees = Array.isArray(st.assignees) ? st.assignees : [];
           const stHistorical = Array.isArray(st.historicalAssigneeIds) ? st.historicalAssigneeIds : [];
           const stSupport = Array.isArray(st.supportAssignees) ? st.supportAssignees : [];

           const matchEmployee = stAssignees.some((a: any) => String(a.employeeId || '').toLowerCase() === employeeId || String(a.id || '').toLowerCase() === userId);
           const matchSupport = stSupport.some((a: any) => String(a.employeeId || '').toLowerCase() === employeeId || String(a.id || '').toLowerCase() === userId);
           const matchHistorical = stHistorical.some((id: any) => String(id || '').toLowerCase() === employeeId || String(id || '').toLowerCase() === userId);
           
           return matchEmployee || matchSupport || matchHistorical || st.isSupportRequest === true;
       });
    }

    let tasksQuery: admin.firestore.Query = afterSaleDb.collectionGroup('tasks');
    if (targetProjectIds.length > 0) {
      tasksQuery = tasksQuery.where('projectId', 'in', targetProjectIds.slice(0, 10));
    }
    const tasksSnapshot = await tasksQuery.get();
    const tasksMap = new Map();
    tasksSnapshot.docs.forEach(doc => {
       const pathParts = doc.ref.path.split('/');
       const taskId = pathParts[5] || doc.id;
       const tData = taskConverter.fromFirestore(doc);
       tasksMap.set(taskId, tData);
    });

    // Resolve parent tasks for cross-project support subtasks that the project-scoped
    // query above did not cover (fetch them directly by their parent ref).
    const missingParentRefs: admin.firestore.DocumentReference[] = [];
    const seenParentPaths = new Set<string>();
    subtaskDocs.forEach(doc => {
      const parentRef = doc.ref.parent.parent;
      if (!parentRef) return;
      const parentTaskId = parentRef.path.split('/')[5] || parentRef.id;
      if (!tasksMap.has(parentTaskId) && !seenParentPaths.has(parentRef.path)) {
        seenParentPaths.add(parentRef.path);
        missingParentRefs.push(parentRef);
      }
    });
    if (missingParentRefs.length > 0) {
      const parentDocs = await afterSaleDb.getAll(...missingParentRefs);
      parentDocs.forEach(doc => {
        if (!doc.exists) return;
        const pathParts = doc.ref.path.split('/');
        const taskId = pathParts[5] || doc.id;
        tasksMap.set(taskId, taskConverter.fromFirestore(doc as any));
      });
    }

    const enrichedSubtasks = subtasks.map(st => {
       const parentTask = tasksMap.get(st.parentTaskId);
       if (!parentTask) return null;

       // กรองไม่แสดงงานของ After-Sale (workOrderCode == 'WOA' หรือ 'WOP') ออกจากระบบ
       if (afterSaleWoIds.has(st.woId)) return null;

       if (projectId && parentTask.projectId !== projectId) return null;
       return {
         ...parentTask,
         ...st,
         dueDate: st.dueDate || parentTask.dueDate,
         taskName: parentTask.taskName || '',
       };
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      data: enrichedSubtasks,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/requests-all
router.get('/requests-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, startDate, endDate } = req.query;
    
    const afterSaleWoIds = await getAfterSaleWorkOrderIds();

    const userRole = (req.user as any)?.roleCode || req.user?.role;
    const userProjectIds = (req.user as any)?.projectLocationIds || [];

    let targetProjectIds: string[] = [];
    if (projectId) {
      targetProjectIds = [String(projectId)];
    } else if ((userRole === 'FM' || userRole === 'SE') && userProjectIds.length > 0) {
      targetProjectIds = userProjectIds;
    }

    let tasksQuery: admin.firestore.Query = afterSaleDb.collectionGroup('tasks');
    let subtasksQuery: admin.firestore.Query = afterSaleDb.collectionGroup('subtasks');
    let requestsQuery: admin.firestore.Query = afterSaleDb.collectionGroup('requests');

    if (targetProjectIds.length > 0) {
      tasksQuery = tasksQuery.where('projectId', 'in', targetProjectIds.slice(0, 10));
      subtasksQuery = subtasksQuery.where('projectId', 'in', targetProjectIds.slice(0, 10));
      requestsQuery = requestsQuery.where('projectId', 'in', targetProjectIds.slice(0, 10));
    }

    const tasksSnapshot = await tasksQuery.get();
    const tasksMap = new Map();
    tasksSnapshot.docs.forEach(doc => {
      const parts = doc.ref.path.split('/');
      const taskId = parts[5];
      const taskData = doc.data();
      tasksMap.set(taskId, {
        id: doc.id,
        taskId,
        taskName: taskData.taskName,
        projectId: taskData.projectId,
        projectName: taskData.projectName,
        workOrderCode: taskData.workOrderCode,
        createdBy: taskData.createdBy || 'ไม่ระบุ',
        createdAt: taskData.createdAt ? (typeof taskData.createdAt.toDate === 'function' ? taskData.createdAt.toDate() : taskData.createdAt) : null,
        dueDate: taskData.dueDate ? (typeof taskData.dueDate.toDate === 'function' ? taskData.dueDate.toDate() : taskData.dueDate) : null,
      });
    });

    const subtasksSnapshot = await subtasksQuery.get();
    const subtasksMap = new Map();
    subtasksSnapshot.docs.forEach(doc => {
      const sData = doc.data();
      subtasksMap.set(doc.id, {
        subtaskName: sData.subtaskName,
        dueDate: sData.dueDate ? (typeof sData.dueDate.toDate === 'function' ? sData.dueDate.toDate() : sData.dueDate) : null,
      });
    });

    // Fetch all users to map employeeId / uid / username to name
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();
    usersSnapshot.docs.forEach(doc => {
      const uData = doc.data();
      if (doc.id) usersMap.set(doc.id, uData.name);
      if (uData.employeeId) usersMap.set(uData.employeeId, uData.name);
      if (uData.username) usersMap.set(uData.username, uData.name);
    });

    const snapshot = await requestsQuery.get();
    const allRequests: any[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const path = doc.ref.path;
      const parts = path.split('/');
      
      let taskId = '';
      let subtaskId = '';
      
      if (parts.length === 10) {
        taskId = parts[5];
      } else if (parts.length === 12) {
        taskId = parts[5];
        subtaskId = parts[7];
      } else {
        return;
      }
      
      const woId = parts[1];
      const taskMeta = tasksMap.get(taskId);
      if (!taskMeta) return;

      // กรองไม่แสดงงานของ After-Sale ออกจากระบบ
      if (afterSaleWoIds.has(woId)) return;

      if (projectId && taskMeta.projectId !== projectId) return;

      const rDateStr = doc.id;
      if (startDate && rDateStr < startDate) return;
      if (endDate && rDateStr > endDate) return;

      let taskName = taskMeta.taskName;
      let dueDate = taskMeta.dueDate || null;
      if (subtaskId) {
        const subtaskMeta = subtasksMap.get(subtaskId);
        if (subtaskMeta) {
          if (subtaskMeta.subtaskName) {
            taskName = `${taskMeta.taskName} > ${subtaskMeta.subtaskName}`;
          }
          if (subtaskMeta.dueDate) {
            dueDate = subtaskMeta.dueDate;
          }
        }
      }

      let reporterName = data.createdBy || 'ไม่ระบุ';
      if (usersMap.has(data.createdBy)) {
        reporterName = usersMap.get(data.createdBy);
      } else if (usersMap.has(data.updatedBy)) {
        reporterName = usersMap.get(data.updatedBy);
      }

      let taskCreatorName = taskMeta.createdBy;
      if (usersMap.has(taskMeta.createdBy)) {
        taskCreatorName = usersMap.get(taskMeta.createdBy);
      }

      allRequests.push({
        ...data,
        id: doc.id,
        dateStr: rDateStr,
        taskId: `${parts[1]}__${parts[3]}__${parts[5]}`,
        subtaskId,
        taskName,
        dueDate,
        createdBy: reporterName,
        projectId: taskMeta.projectId,
        projectName: taskMeta.projectName,
        taskCreatedBy: taskCreatorName,
        taskCreatedAt: taskMeta.createdAt,
      });
    });

    res.status(200).json({
      success: true,
      data: allRequests,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/draft-dates — returns all draft daily-report dates grouped by composite task ID for the current user
router.get('/draft-dates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const snapshot = await afterSaleDb
      .collectionGroup('dailyReports')
      .where('createdBy', '==', userId)
      .get();

    const result: Record<string, string[]> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.status !== 'draft') return;

      const parts = doc.ref.path.split('/');
      let compositeId = '';

      if (parts.length === 12) {
        // workOrders/woId/categories/catId/tasks/taskId/subtasks/subtaskId/revisions|help/revId/dailyReports/dateStr
        const woId = parts[1];
        const catId = parts[3];
        const taskId = parts[5];
        const subtaskId = parts[7];
        compositeId = `${woId}__${catId}__${taskId}__${subtaskId}`;
      } else if (parts.length === 10) {
        // workOrders/woId/categories/catId/tasks/taskId/revisions|help/revId/dailyReports/dateStr
        compositeId = parts[5]; // task-level ID
      } else {
        return; // unexpected path structure
      }

      if (!result[compositeId]) result[compositeId] = [];
      const dateStr = doc.id; // document ID is the date string 'yyyy-MM-dd'
      if (!result[compositeId].includes(dateStr)) {
        result[compositeId].push(dateStr);
      }
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/reports-all
router.get('/reports-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, startDate, endDate } = req.query;
    
    const afterSaleWoIds = await getAfterSaleWorkOrderIds();

    // 1. Fetch dailyReports with Firestore-level filters
    let dailyReportsQuery: any = afterSaleDb.collectionGroup('dailyReports');
    
    if (projectId) {
      dailyReportsQuery = dailyReportsQuery.where('projectId', '==', projectId);
    }
    
    if (startDate) {
      const startOfDay = new Date(startDate as string);
      startOfDay.setHours(0, 0, 0, 0);
      dailyReportsQuery = dailyReportsQuery.where('reportDate', '>=', startOfDay);
    }
    
    if (endDate) {
      const endOfDay = new Date(endDate as string);
      endOfDay.setHours(23, 59, 59, 999);
      dailyReportsQuery = dailyReportsQuery.where('reportDate', '<=', endOfDay);
    }
    
    const snapshot = await dailyReportsQuery.get();
    
    // Extract unique task refs and subtask refs referenced in matching dailyReports
    const taskRefs: FirebaseFirestore.DocumentReference[] = [];
    const subtaskRefs: FirebaseFirestore.DocumentReference[] = [];
    const uniqueTaskPaths = new Set<string>();
    const uniqueSubtaskPaths = new Set<string>();

    snapshot.docs.forEach((doc: any) => {
      const path = doc.ref.path;
      const parts = path.split('/');
      
      let taskId = '';
      let subtaskId = '';
      
      if (parts.length === 10) {
        taskId = parts[5];
      } else if (parts.length === 12) {
        taskId = parts[5];
        subtaskId = parts[7];
      } else {
        return;
      }

      const taskPath = `workOrders/${parts[1]}/categories/${parts[3]}/tasks/${taskId}`;
      if (!uniqueTaskPaths.has(taskPath)) {
        uniqueTaskPaths.add(taskPath);
        taskRefs.push(afterSaleDb.doc(taskPath));
      }

      if (subtaskId) {
        const subtaskPath = `${taskPath}/subtasks/${subtaskId}`;
        if (!uniqueSubtaskPaths.has(subtaskPath)) {
          uniqueSubtaskPaths.add(subtaskPath);
          subtaskRefs.push(afterSaleDb.doc(subtaskPath));
        }
      }
    });

    // Fetch referenced tasks in batch
    const tasksMap = new Map();
    if (taskRefs.length > 0) {
      const tasksDocs = await afterSaleDb.getAll(...taskRefs);
      tasksDocs.forEach((doc: any) => {
        if (doc.exists) {
          const parts = doc.ref.path.split('/');
          const taskId = parts[5];
          const taskData = doc.data();
          if (taskData) {
            tasksMap.set(taskId, {
              id: doc.id,
              taskId,
              taskName: taskData.taskName,
              projectId: taskData.projectId,
              projectName: taskData.projectName,
              workOrderCode: taskData.workOrderCode,
              createdBy: taskData.createdBy || 'ไม่ระบุ',
              createdAt: taskData.createdAt ? (typeof taskData.createdAt.toDate === 'function' ? taskData.createdAt.toDate() : taskData.createdAt) : null,
              dueDate: taskData.dueDate ? (typeof taskData.dueDate.toDate === 'function' ? taskData.dueDate.toDate() : taskData.dueDate) : null,
            });
          }
        }
      });
    }

    // Fetch referenced subtasks in batch
    const subtasksMap = new Map();
    if (subtaskRefs.length > 0) {
      const subtasksDocs = await afterSaleDb.getAll(...subtaskRefs);
      subtasksDocs.forEach((doc: any) => {
        if (doc.exists) {
          const sData = doc.data();
          if (sData) {
            subtasksMap.set(doc.id, {
              subtaskName: sData.subtaskName,
              dueDate: sData.dueDate ? (typeof sData.dueDate.toDate === 'function' ? sData.dueDate.toDate() : sData.dueDate) : null,
            });
          }
        }
      });
    }

    // Fetch all users to map employeeId / uid / username to name
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();
    usersSnapshot.docs.forEach(doc => {
      const uData = doc.data();
      if (doc.id) usersMap.set(doc.id, uData.name);
      if (uData.employeeId) usersMap.set(uData.employeeId, uData.name);
      if (uData.username) usersMap.set(uData.username, uData.name);
    });

    const allReports: any[] = [];

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const path = doc.ref.path;
      const parts = path.split('/');
      
      let taskId = '';
      let subtaskId = '';
      
      if (parts.length === 10) {
        taskId = parts[5];
      } else if (parts.length === 12) {
        taskId = parts[5];
        subtaskId = parts[7];
      } else {
        return;
      }
      
      const woId = parts[1];
      const taskMeta = tasksMap.get(taskId);
      if (!taskMeta) return;

      // กรองไม่แสดงงานของ After-Sale ออกจากระบบ
      if (afterSaleWoIds.has(woId)) return;

      const rDateStr = doc.id;

      let taskName = taskMeta.taskName;
      let dueDate = taskMeta.dueDate || null;
      if (subtaskId) {
        const subtaskMeta = subtasksMap.get(subtaskId);
        if (subtaskMeta) {
          if (subtaskMeta.subtaskName) {
            taskName = `${taskMeta.taskName} > ${subtaskMeta.subtaskName}`;
          }
          if (subtaskMeta.dueDate) {
            dueDate = subtaskMeta.dueDate;
          }
        }
      }

      let reporterName = data.createdBy || 'ไม่ระบุ';
      if (usersMap.has(data.createdBy)) {
        reporterName = usersMap.get(data.createdBy);
      } else if (usersMap.has(data.updatedBy)) {
        reporterName = usersMap.get(data.updatedBy);
      }

      let taskCreatorName = taskMeta.createdBy;
      if (usersMap.has(taskMeta.createdBy)) {
        taskCreatorName = usersMap.get(taskMeta.createdBy);
      }

      allReports.push({
        ...data,
        id: doc.id,
        dateStr: rDateStr,
        taskId: `${parts[1]}__${parts[3]}__${parts[5]}`,
        subtaskId,
        taskName,
        dueDate,
        createdBy: reporterName,
        projectId: taskMeta.projectId,
        projectName: taskMeta.projectName,
        taskCreatedBy: taskCreatorName,
        taskCreatedAt: taskMeta.createdAt,
      });
    });

    res.status(200).json({
      success: true,
      data: allReports,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.roleCode;
    const userId = authReq.user?.uid;
    const { projectId } = req.query;

    const filters: any = {};
    if (projectId) {
      filters.projectId = projectId as string;
    }

    // Pagination params
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // If role is FM, SE, OE, they should only see assigned tasks
    // Let's assume FM can only see tasks assigned to them
    if (userRole === 'FM' || userRole === 'SE') {
      filters.assigneeId = userId;
    }

    const tasks = await taskService.getTasks(filters);
    
    let filteredTasks = tasks;
    if (userRole === 'LD' && authReq.user) {
      const userProjects = projectId ? [projectId as string] : (authReq.user.projectLocationIds || []);
      const leaderWorkOrderCodes = new Set<string>();

      for (const pId of userProjects) {
        const woSnapshot = await db
          .collection('Project')
          .doc(pId)
          .collection('workOrderConfigs')
          .get();
        
        woSnapshot.forEach((doc) => {
          const data = doc.data();
          const isLeader = data.leaderId === authReq.user!.id || 
                           (data.leaderIds && Array.isArray(data.leaderIds) && data.leaderIds.includes(authReq.user!.id)) ||
                           (data.AssignLD && Array.isArray(data.AssignLD) && data.AssignLD.includes(authReq.user!.id));
          const code = data.code;
          if (isLeader && code) {
            leaderWorkOrderCodes.add(code.trim().toUpperCase());
          }
        });
      }

      filteredTasks = tasks.filter((t) => {
        const code = (t.workOrderCode || '').trim().toUpperCase();
        return leaderWorkOrderCodes.has(code);
      });
    }

    const total = filteredTasks.length;
    let paginatedTasks = filteredTasks;
    let hasMore = false;
    
    if (page !== undefined) {
      const startIndex = (page - 1) * limit;
      paginatedTasks = filteredTasks.slice(startIndex, startIndex + limit);
      hasMore = startIndex + limit < total;
    }

    res.status(200).json({
      success: true,
      data: paginatedTasks,
      ...(page !== undefined && {
        pagination: {
          total,
          page,
          limit,
          hasMore
        }
      })
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id — fetch single parent task with its subtasks by composite ID
// Accepts 3-part (woId__catId__taskId) or 4-part (woId__catId__taskId__subtaskId) composite ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parts = req.params.id.split('__');
    if (parts.length < 3) {
      res.status(400).json({ success: false, message: 'Invalid composite task ID' });
      return;
    }
    const [woId, catId, taskId] = parts;

    const taskRef = afterSaleDb
      .collection('workOrders').doc(woId)
      .collection('categories').doc(catId)
      .collection('tasks').doc(taskId)
      .withConverter(taskConverter);

    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const data = taskSnap.data() as any;

    const safeDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return val;
    };

    const subtasksSnapshot = await taskRef.collection('subtasks').get();
    data.subtasks = subtasksSnapshot.docs.map((subDoc) => {
      const subData = subDoc.data() as any;
      return {
        id: subDoc.id,
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
        unlockedDates: subData.unlockedDates ? Object.keys(subData.unlockedDates).reduce((acc: Record<string, any>, key: string) => {
          acc[key] = { ...subData.unlockedDates[key], unlockedUntil: safeDate(subData.unlockedDates[key].unlockedUntil) };
          return acc;
        }, {}) : {},
        unlockRequests: subData.unlockRequests ? Object.keys(subData.unlockRequests).reduce((acc: Record<string, any>, key: string) => {
          acc[key] = { ...subData.unlockRequests[key], requestedAt: safeDate(subData.unlockRequests[key].requestedAt) };
          return acc;
        }, {}) : {},
        supportUnlockedDates: subData.supportUnlockedDates ? Object.keys(subData.supportUnlockedDates).reduce((acc: Record<string, any>, key: string) => {
          acc[key] = { ...subData.supportUnlockedDates[key], unlockedUntil: safeDate(subData.supportUnlockedDates[key].unlockedUntil) };
          return acc;
        }, {}) : {},
        supportUnlockRequests: subData.supportUnlockRequests ? Object.keys(subData.supportUnlockRequests).reduce((acc: Record<string, any>, key: string) => {
          acc[key] = { ...subData.supportUnlockRequests[key], requestedAt: safeDate(subData.supportUnlockRequests[key].requestedAt) };
          return acc;
        }, {}) : {},
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
        unapproveRequest: subData.unapproveRequest ? {
          requestedAt: safeDate(subData.unapproveRequest.requestedAt),
          requestedBy: subData.unapproveRequest.requestedBy || '',
        } : undefined,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/import-wbs/template
router.get('/import-wbs/template', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: WBS Template
    const wsTemplate = workbook.addWorksheet('WBS Template');
    
    // Columns definition for WBS Template
    wsTemplate.columns = [
      { header: 'รหัสหมวดหมู่งานหลัก (ตัวย่อ)', key: 'workOrderCode', width: 26 },
      { header: 'ชื่อหมวดหมู่งานหลัก (ชื่อเต็ม)', key: 'workOrderName', width: 30 },
      { header: 'ชื่อหมวดหมู่งานย่อย', key: 'categoryName', width: 22 },
      { header: 'ชื่องาน', key: 'taskName', width: 25 },
      { header: 'ชื่องานย่อย', key: 'subtaskName', width: 28 },
      { header: 'วันครบกำหนด (งานย่อย)', key: 'subtaskDueDate', width: 22 },
      { header: 'รหัสพนักงานผู้รับผิดชอบ FM (งานย่อย)', key: 'subtaskAssignees', width: 35 }
    ];

    // Data rows
    const dataRows = [
      {
        workOrderCode: 'STR',
        workOrderName: 'งานโครงสร้าง',
        categoryName: 'งานตอกเสาเข็ม',
        taskName: 'งานขุดดินฐานราก',
        subtaskName: 'ขุดดินหลุมเสาเข็มต้นที่ 1',
        subtaskDueDate: '2026-06-15',
        subtaskAssignees: '123456, 123457'
      },
      {
        workOrderCode: 'STR',
        workOrderName: 'งานโครงสร้าง',
        categoryName: 'งานตอกเสาเข็ม',
        taskName: 'งานขุดดินฐานราก',
        subtaskName: 'ขุดดินหลุมเสาเข็มต้นที่ 2',
        subtaskDueDate: '2026-06-16',
        subtaskAssignees: '123456'
      },
      {
        workOrderCode: 'ARC',
        workOrderName: 'งานสถาปัตยกรรม',
        categoryName: 'งานก่อผนัง',
        taskName: 'งานก่ออิฐมวลเบาชั้น 1',
        subtaskName: '',
        subtaskDueDate: '',
        subtaskAssignees: ''
      }
    ];

    dataRows.forEach(row => wsTemplate.addRow(row));

    // Style the header row in WBS Template to match Image 3
    const headerRow = wsTemplate.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F65D6' } // Deep blue background matching Image 3
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' } // White text
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FFF59E0B' } }, // Yellow/Gold border at top
        bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // Zebra striping and padding for data rows
    wsTemplate.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      row.height = 24;
      const isEven = rowNumber % 2 === 0;
      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF1F5F9' } // Alternating white / light-gray
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 6 ? 'center' : 'left'
        };
      });
    });

    // Sheet 2: Guide
    const wsInstructions = workbook.addWorksheet('คู่มือการกรอกข้อมูล WBS');
    
    // Columns for Instructions sheet
    wsInstructions.columns = [
      { key: 'colName', width: 28 },
      { key: 'desc', width: 70 },
      { key: 'required', width: 26 },
      { key: 'example', width: 25 }
    ];

    wsInstructions.addRow(['คู่มือการกรอกข้อมูลเทมเพลต WBS Import (WBS Upload Guide)']);
    wsInstructions.addRow([]);
    wsInstructions.addRow(['ชื่อคอลัมน์ (Column Name)', 'คำอธิบาย (Description)', 'ความจำเป็น (Required?)', 'ตัวอย่างข้อมูล (Example)']);
    
    const instructions = [
      ['รหัสหมวดหมู่งานหลัก (ตัวย่อ)', 'รหัสตัวย่อของหมวดหมู่งานหลัก เช่น STR, ARC, EE เพื่อใช้จัดกลุ่มในระบบ', 'จำเป็น (Required)', 'STR'],
      ['ชื่อหมวดหมู่งานหลัก (ชื่อเต็ม)', 'ชื่อเต็มของหมวดหมู่งานหลัก เช่น งานโครงสร้าง, งานสถาปัตยกรรม, งานระบบ', 'จำเป็น (Required)', 'งานโครงสร้าง'],
      ['ชื่อหมวดหมู่งานย่อย', 'ชื่อของหมวดหมู่ย่อยภายใต้หมวดหลัก เช่น งานตอกเสาเข็ม, งานก่อผนัง', 'จำเป็น (Required)', 'งานตอกเสาเข็ม'],
      ['ชื่องาน', 'ชื่องานหลัก (Task) ที่ต้องการสร้าง', 'จำเป็น (Required)', 'งานขุดดินฐานราก'],
      ['ชื่องานย่อย', 'ชื่องานย่อย (Subtask) ภายใต้งานหลัก (เว้นว่างได้หากไม่มีงานย่อย)', 'ไม่จำเป็น (Optional)', 'ขุดดินหลุมเสาเข็มต้นที่ 1'],
      ['วันครบกำหนด (งานย่อย)', 'วันครบกำหนดส่งมอบของงานย่อย รูปแบบ: ปี-เดือน-วัน (ค.ศ.)', 'จำเป็นเมื่อระบุงานย่อย', '2026-06-15'],
      ['รหัสพนักงานผู้รับผิดชอบ FM (งานย่อย)', 'รหัสพนักงาน FM ที่รับผิดชอบงานย่อยนี้ คั่นด้วยจุลภาค (,) ตัวอย่างการกรอกรหัสพนักงาน 6 หลัก เช่น 123456, 123457', 'ไม่จำเป็น (Optional)', '123456, 123457']
    ];

    instructions.forEach(inst => wsInstructions.addRow(inst));
    
    wsInstructions.addRow([]);
    wsInstructions.addRow(['ข้อแนะนำเพิ่มเติม:']);
    wsInstructions.addRow(['- กรุณากรอกข้อมูลในชีท "WBS Template" เพื่อทำการอัปโหลด']);
    wsInstructions.addRow(['- ระบบรันเลข ID งานหลักและงานย่อยให้อัตโนมัติโดยที่ผู้ใช้ไม่ต้องกรอกข้อมูลช่อง ID ใดๆ ทั้งสิ้น']);
    wsInstructions.addRow(['- วันที่ต้องกรอกในรูปแบบ ค.ศ. เท่านั้น เช่น 2026-06-30 (ปี-เดือน-วัน)']);
    wsInstructions.addRow(['- รหัสผู้รับผิดชอบต้องตรงกับรหัสพนักงานในระบบ (ตัวอย่างเช่น 123456, 123457) หากกรอกรหัสพนักงานที่ไม่มีในระบบ ระบบจะแสดงคำเตือนแต่ยังสามารถกดนำเข้าได้']);

    // Style the title of Guide
    wsInstructions.mergeCells('A1:D1');
    const titleCell = wsInstructions.getCell('A1');
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Style instructions header row
    const instHeader = wsInstructions.getRow(3);
    instHeader.height = 28;
    instHeader.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F65D6' }
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FFF59E0B' } },
        bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // Style guide data rows
    wsInstructions.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return; // Skip header
      if (rowNumber > 12) {
        // Tips styling
        row.eachCell(cell => {
          cell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
        });
        return;
      }
      row.height = 22;
      const isEven = rowNumber % 2 === 0;
      row.eachCell((cell, colIndex) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF1F5F9' }
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colIndex === 3 ? 'center' : 'left'
        };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=wbs_import_template.xlsx');

    await workbook.xlsx.write(res);
  } catch (error) {
    next(error);
    return;
  }
});

// POST /api/tasks/import-wbs
router.post('/import-wbs', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      throw new AppError('Unauthorized', 401);
    }
    const userId = authReq.user.id;
    const { projectId } = req.body;
    if (!projectId) {
      throw new AppError('กรุณาระบุรหัสโครงการ (projectId is required)', 400);
    }

    if (!req.file) {
      throw new AppError('กรุณาเลือกไฟล์ Excel สำหรับนำเข้า (.xlsx, .xls) (file is required)', 400);
    }

    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map<string, { name: string; roleId: string }>();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const employeeId = data.employeeId || doc.id;
      const userVal = {
        name: data.name || data.username || 'Unknown',
        roleId: data.roleId || 'FM',
      };
      usersMap.set(employeeId, userVal);
      if (doc.id) {
        usersMap.set(doc.id, userVal);
      }
    });

    const parsed = parseWbsExcel(req.file.buffer, usersMap);
    const { commit } = req.query;

    if (commit === 'true') {
      if (!parsed.isValid) {
        return res.status(400).json({
          success: false,
          error: 'ข้อมูลในไฟล์ Excel ไม่ถูกต้อง ไม่สามารถนำเข้าได้',
          data: parsed.rows
        });
      }

      const result = await taskService.importWbs(projectId, parsed.groupedTasks, userId);
      return res.status(200).json({
        success: true,
        message: `นำเข้าแผนงานสำเร็จทั้งหมด ${result.importedCount} งานหลัก`,
        importedCount: result.importedCount,
      });
    } else {
      return res.status(200).json({
        success: true,
        data: parsed.rows,
        groupedCount: parsed.groupedTasks.length,
        isValid: parsed.isValid,
      });
    }
  } catch (error) {
    next(error);
    return;
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskName, projectId, projectName, workOrderId, workOrderCode, workOrderName, categoryId, categoryName, subtasks, dueDate, status } = req.body;
    
    if (!taskName || !projectId || !workOrderCode || !categoryName) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (TaskName, ProjectId, WorkOrderCode, CategoryName are required)', 400);
    }

    const authReq = req as AuthRequest;
    if (!authReq.user) {
      throw new AppError('Unauthorized', 401);
    }
    const userRole = authReq.user.roleCode;
    if (userRole === 'LD') {
      const isAssigned = await validateLeaderAccess(authReq.user.id, projectId, workOrderCode);
      if (!isAssigned) {
        throw new AppError('คุณไม่มีสิทธิ์สร้างงานในหมวดงานนี้ (Access denied to create tasks for this Work Order)', 403);
      }
    }

    const subtasksArray = Array.isArray(subtasks) ? subtasks : [];

    // Validate that each subtask has a dueDate
    const hasInvalidSubtaskDueDate = subtasksArray.some((st: any) => !st.dueDate || isNaN(new Date(st.dueDate).getTime()));
    if (hasInvalidSubtaskDueDate) {
      throw new AppError('กรุณาระบุวันที่ครบกำหนดของทุกงานย่อยให้ถูกต้อง (Subtask due dates are required)', 400);
    }

    const validatedData = {
      taskName,
      description: req.body.description,
      projectId,
      projectName: projectName || 'Unknown Project',
      workOrderId,
      workOrderCode,
      workOrderName,
      categoryId,
      categoryName,
      subtasks: subtasksArray,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status,
    };

    const userId = authReq.user.id;
    const newTask = await taskService.createTask(validatedData, userId);
    
    res.status(201).json({
      success: true,
      data: newTask,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await checkTaskLeaderAccess(req, id);

    if (!['upcoming', 'in-progress', 'completed'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    await taskService.updateTaskStatus(id, status, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      data: { id, status },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    await checkTaskLeaderAccess(req, id);

    const input = { ...req.body };
    if (input.dueDate) {
      const date = new Date(input.dueDate);
      if (isNaN(date.getTime())) {
        throw new AppError('รูปแบบวันที่ไม่ถูกต้อง', 400);
      }
      input.dueDate = date;
    }

    await taskService.updateTask(id, input, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: { id }, // ส่ง data กลับไปเพื่อให้ API Client ไม่ Error
    });
  } catch (error: any) {
    console.error('[Route Error] PATCH /tasks/:id failed:', error);
    next(error);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    await checkTaskLeaderAccess(req, id);

    await taskService.softDeleteTask(id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully (Soft Delete)',
      data: { id }, // ส่ง data กลับไปเพื่อให้ API Client ไม่ Error
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId
router.patch('/:id/subtasks/:subtaskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, subtaskId } = req.params;
    console.log('[tasks.routes.ts] PATCH subtask - id:', id, 'subtaskId:', subtaskId);
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    await checkTaskLeaderAccess(req, id);

    await taskService.updateSubtask(id, subtaskId, req.body, userId);
    
    res.status(200).json({
      success: true,
      message: 'Subtask updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id/subtasks/:subtaskId
router.delete('/:id/subtasks/:subtaskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, subtaskId } = req.params;
    console.log('[tasks.routes.ts] DELETE subtask - id:', id, 'subtaskId:', subtaskId);
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    await checkTaskLeaderAccess(req, id);

    await taskService.deleteSubtask(id, subtaskId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Subtask deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/reports
router.post('/:id/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const reportData = req.body;
    const isSupportReport = req.body.isSupportReport === true;
    await taskService.submitDailyReport(id, reportData, userId, isSupportReport);

    res.status(201).json({
      success: true,
      message: 'Daily report submitted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/unlock-report
router.post('/:id/unlock-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { dateStr, daysToUnlock, isSupportReport, taskContext } = req.body;
    if (!dateStr || !daysToUnlock) {
      throw new AppError('dateStr and daysToUnlock are required', 400);
    }

    await taskService.unlockDailyReport(id, dateStr, daysToUnlock, userId, isSupportReport === true);

    // --- Create 'unlock_granted' notification for the FM ---
    try {
      const unlockRequestsField = isSupportReport === true ? 'supportUnlockRequests' : 'unlockRequests';
      let targetFmUid: string | undefined;
      let subtaskDocData: any = null;

      // Resolve the subtask ref to get the unlock request (who requested the unlock)
      let idParts = id.split('__');
      let subtaskRawId: string | undefined;
      if (idParts.length >= 4) {
        const [woId, catId, taskId, subtaskId] = idParts;
        const subtaskRef = afterSaleDb
          .collection('workOrders').doc(woId)
          .collection('categories').doc(catId)
          .collection('tasks').doc(taskId)
          .collection('subtasks').doc(subtaskId);
        const subtaskSnap = await subtaskRef.get();
        subtaskDocData = subtaskSnap.data();
        subtaskRawId = subtaskId;
      }

      if (subtaskDocData) {
        const unlockRequests = subtaskDocData[unlockRequestsField] || {};
        const requestInfo = unlockRequests[dateStr];
        const requestedByUid = requestInfo?.requestedBy;
        if (requestedByUid) {
          // Resolve FM user record
          const userDoc = await db.collection('users').doc(requestedByUid).get();
          if (userDoc.exists) {
            targetFmUid = requestedByUid;
            // name resolved via approverName below
          } else {
            // Try searching by uid
            const userByUid = await db.collection('users').where('uid', '==', requestedByUid).limit(1).get();
            if (!userByUid.empty) {
              targetFmUid = requestedByUid;
            }
          }
        }
      }

      // Resolve approver name
      let approverName = 'หัวหน้างาน';
      const approverDoc = await db.collection('users').doc(userId).get();
      if (approverDoc.exists) {
        const approverData = approverDoc.data();
        approverName = approverData?.name || approverData?.username || 'หัวหน้างาน';
      }

      // Fallback taskContext from request body (passed by frontend)
      const ctx = taskContext || {};

      const notificationData: any = {
        type: 'unlock_granted',
        projectId: ctx.projectId || '',
        projectName: ctx.projectName || '',
        workOrderId: ctx.workOrderId || '',
        workOrderName: ctx.workOrderName || '',
        categoryId: ctx.categoryId || '',
        categoryName: ctx.categoryName || '',
        taskId: ctx.taskId || '',
        taskName: ctx.taskName || '',
        subtaskId: subtaskRawId || '',
        subtaskName: ctx.subtaskName || subtaskDocData?.subtaskName || '',
        reportDate: dateStr,
        message: `${approverName} ได้ปลดล็อคสิทธิ์ให้คุณแก้ข้อมูลย้อนหลังวันที่ ${dateStr}`,
        createdAt: new Date(),
        createdBy: userId,
        createdByName: approverName,
        readBy: [],
        targetUserId: targetFmUid || '',
      };

      await afterSaleDb.collection('lms_notifications').add(notificationData);
      console.log(`[tasks.routes] Created unlock_granted notification for FM: ${targetFmUid}`);
    } catch (notiErr: any) {
      console.error('[tasks.routes] Failed to create unlock_granted notification:', notiErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Daily report unlocked successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/request-unlock
router.post('/:id/request-unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { dateStr, isSupportReport, taskContext } = req.body;
    if (!dateStr) {
      throw new AppError('dateStr is required', 400);
    }

    await taskService.requestDailyReportUnlock(id, dateStr, userId, isSupportReport === true);

    // --- Send 'unlock_requested' notifications to supervisors (LD, OE, PE, PM) ---
    try {
      // Resolve requester name
      let requesterName = 'พนักงาน';
      const requesterDoc = await db.collection('users').doc(userId).get();
      if (requesterDoc.exists) {
        const rd = requesterDoc.data();
        requesterName = rd?.name || rd?.username || requesterName;
      }

      // Get projectId from taskContext (passed by frontend) or parse from composite id
      const ctx = taskContext || {};
      let projectId: string = ctx.projectId || '';
      let subtaskName: string = ctx.subtaskName || '';

      // Fallback: resolve from Firestore if not provided
      if (!projectId) {
        const idParts = id.split('__');
        if (idParts.length >= 4) {
          const [woId, catId, taskId, subtaskId] = idParts;
          const subtaskRef = afterSaleDb
            .collection('workOrders').doc(woId)
            .collection('categories').doc(catId)
            .collection('tasks').doc(taskId)
            .collection('subtasks').doc(subtaskId);
          const subtaskSnap = await subtaskRef.get();
          if (subtaskSnap.exists) {
            const sd = subtaskSnap.data();
            projectId = sd?.projectId || '';
            subtaskName = subtaskName || sd?.subtaskName || '';
          }
        }
      }

      if (projectId) {
        // Query all supervisors with roles LD, OE, PE, PM in the same project
        const SUPERVISOR_ROLES = ['LD', 'OE', 'PE', 'PM'];
        const usersSnap = await db.collection('users')
          .where('projectLocationIds', 'array-contains', projectId)
          .get();

        const supervisors = usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(u => SUPERVISOR_ROLES.includes(u.roleId || u.roleCode || ''));

        const message = `${requesterName} ขอปลดล็อคสิทธิ์สำหรับวันที่ ${dateStr}${subtaskName ? ` ในงาน "${subtaskName}"` : ''}`;

        const batch = afterSaleDb.batch();
        for (const supervisor of supervisors) {
          const notifRef = afterSaleDb.collection('lms_notifications').doc();
          batch.set(notifRef, {
            type: 'unlock_requested',
            projectId: ctx.projectId || projectId,
            projectName: ctx.projectName || '',
            workOrderId: ctx.workOrderId || '',
            workOrderName: ctx.workOrderName || '',
            categoryId: ctx.categoryId || '',
            categoryName: ctx.categoryName || '',
            taskId: ctx.taskId || '',
            taskName: ctx.taskName || '',
            subtaskId: id,
            subtaskName,
            reportDate: dateStr,
            message,
            createdAt: new Date(),
            createdBy: userId,
            createdByName: requesterName,
            readBy: [],
            targetUserId: supervisor.id,
          });
        }
        await batch.commit();
        console.log(`[tasks.routes] Sent unlock_requested notifications to ${supervisors.length} supervisors`);
      }
    } catch (notiErr: any) {
      console.error('[tasks.routes] Failed to send unlock_requested notifications:', notiErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Daily report unlock requested successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/subtasks
router.get('/:id/subtasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subtasks = await taskService.getSubtasks(req.params.id);
    res.json({ success: true, data: subtasks });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/reports
router.get('/:id/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let isSupportReport: boolean | undefined = undefined;
    if (req.query.isSupportReport === 'true') isSupportReport = true;
    if (req.query.isSupportReport === 'false') isSupportReport = false;
    
    const reports = await taskService.getAllDailyReports(id, isSupportReport);

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/reports/:date
router.get('/:id/reports/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, date } = req.params;
    const isSupportReport = req.query.isSupportReport === 'true';
    
    const reportPromise = taskService.getDailyReport(id, date, isSupportReport);
    let siteReportPromise = Promise.resolve(null);
    let supportReportPromise = Promise.resolve(null);
    
    if (isSupportReport) {
      siteReportPromise = taskService.getDailyReport(id, date, false);
    } else {
      supportReportPromise = taskService.getDailyReport(id, date, true);
    }
    
    const [report, siteReport, supportReport] = await Promise.all([
      reportPromise,
      siteReportPromise,
      supportReportPromise
    ]);

    res.status(200).json({
      success: true,
      data: {
        report,
        siteReport,
        supportReport
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/reject
router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { revisionName, assignees } = req.body;
    
    if (!revisionName || !assignees || !Array.isArray(assignees) || assignees.length === 0) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (revisionName และ assignees เป็นข้อมูลจำเป็น)', 400);
    }

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.rejectTask(id, revisionName, assignees, userId);

    res.status(200).json({
      success: true,
      message: 'ตีกลับงานสำเร็จ (Task rejected successfully)',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/approve
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.approveTask(id, userId);

    res.status(200).json({
      success: true,
      message: 'อนุมัติงานสำเร็จ (Task approved successfully)',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/request-unapprove
router.post('/:id/request-unapprove', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { taskContext } = req.body;

    await taskService.requestUnapprove(id, userId);

    // Send notification to LD supervisors
    try {
      let requesterName = 'พนักงาน';
      const requesterDoc = await db.collection('users').doc(userId).get();
      if (requesterDoc.exists) {
        const rd = requesterDoc.data();
        requesterName = rd?.name || rd?.username || requesterName;
      }

      const ctx = taskContext || {};
      let projectId: string = ctx.projectId || '';
      let subtaskName: string = ctx.subtaskName || '';

      if (!projectId) {
        const idParts = id.split('__');
        if (idParts.length >= 4) {
          const [woId, catId, taskId, subtaskId] = idParts;
          const subtaskSnap = await afterSaleDb
            .collection('workOrders').doc(woId)
            .collection('categories').doc(catId)
            .collection('tasks').doc(taskId)
            .collection('subtasks').doc(subtaskId)
            .get();
          if (subtaskSnap.exists) {
            const sd = subtaskSnap.data();
            projectId = sd?.projectId || '';
            subtaskName = subtaskName || sd?.subtaskName || '';
          }
        }
      }

      if (projectId) {
        const SUPERVISOR_ROLES = ['LD', 'OE', 'PE', 'PM'];
        const usersSnap = await db.collection('users')
          .where('projectLocationIds', 'array-contains', projectId)
          .get();

        const supervisors = usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(u => SUPERVISOR_ROLES.includes(u.roleId || u.roleCode || ''));

        const message = `${requesterName} ขอแก้ไข Daily Report ของงานที่ถูก Approve แล้ว${subtaskName ? ` (${subtaskName})` : ''}`;

        const batch = afterSaleDb.batch();
        for (const supervisor of supervisors) {
          const notifRef = afterSaleDb.collection('lms_notifications').doc();
          batch.set(notifRef, {
            type: 'unapprove_requested',
            projectId: ctx.projectId || projectId,
            projectName: ctx.projectName || '',
            workOrderId: ctx.workOrderId || '',
            workOrderName: ctx.workOrderName || '',
            categoryId: ctx.categoryId || '',
            categoryName: ctx.categoryName || '',
            taskId: ctx.taskId || '',
            taskName: ctx.taskName || '',
            subtaskId: id,
            subtaskName,
            message,
            createdAt: new Date(),
            createdBy: userId,
            createdByName: requesterName,
            readBy: [],
            targetUserId: supervisor.id,
          });
        }
        await batch.commit();
        console.log(`[tasks.routes] Sent unapprove_requested notifications to ${supervisors.length} supervisors`);
      }
    } catch (notiError: any) {
      console.error('Failed to send unapprove request notification:', notiError.message);
    }

    res.status(200).json({ success: true, message: 'ส่งคำขอแก้ไขเรียบร้อยแล้ว' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/unapprove
router.post('/:id/unapprove', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    await taskService.unapproveTask(id, userId);

    res.status(200).json({ success: true, message: 'ยกเลิก Approve เรียบร้อยแล้ว งานกลับเป็น for-checking' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/support
router.post('/:id/support', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { supportTaskName, assignees, subtaskId } = req.body;
    
    if (!supportTaskName || !assignees || !Array.isArray(assignees) || assignees.length === 0) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (supportTaskName และ assignees เป็นข้อมูลจำเป็น)', 400);
    }

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.joinSupportTask(id, supportTaskName, assignees, userId, subtaskId);

    res.status(200).json({
      success: true,
      message: 'เข้าร่วมงาน Support สำเร็จ (Support task joined successfully)',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { subtaskName, assignees, dueDate } = req.body;
    if (!subtaskName || !dueDate) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (subtaskName และ dueDate เป็นฟิลด์ที่จำเป็น)', 400);
    }
    if (isNaN(new Date(dueDate).getTime())) {
      throw new AppError('รูปแบบวันที่ครบกำหนดไม่ถูกต้อง', 400);
    }

    const assigneesArray = Array.isArray(assignees) ? assignees : [];
    const subtask = await taskService.createSubtask(id, { subtaskName, assignees: assigneesArray, dueDate }, userId);
    res.status(201).json({
      success: true,
      message: 'สร้าง Subtask สำเร็จ',
      data: subtask
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/requests
router.post('/:id/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    const requestData = req.body;
    const isSupportRequest = req.body.isSupportReport === true;
    
    await taskService.submitAdvanceRequest(id, requestData, userId, isSupportRequest);

    res.status(201).json({
      success: true,
      message: 'สร้างคำขอวางแผนงานล่วงหน้าสำเร็จ',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id/requests
router.get('/:id/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let isSupportRequest: boolean | undefined = undefined;
    if (req.query.isSupportReport === 'true') isSupportRequest = true;
    if (req.query.isSupportReport === 'false') isSupportRequest = false;
    
    const requests = await taskService.getAdvanceRequests(id, isSupportRequest);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/requests/:date/status
router.patch('/:id/requests/:date/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, date } = req.params;
    const { status, isSupportReport } = req.body;
    const userId = req.user?.uid;
    if (!userId) throw new AppError('Unauthorized', 401);

    if (!status) {
      throw new AppError('status is required', 400);
    }

    await taskService.updateAdvanceRequestStatus(id, date, status, userId, isSupportReport === true);

    res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะแผนงานล่วงหน้าสำเร็จ',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
