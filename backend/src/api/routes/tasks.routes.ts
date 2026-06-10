import { Router, Request, Response, NextFunction } from 'express';
import { taskService } from '../../services/TaskService';
import { taskConverter } from '../../models/Task';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../../config/firebase';
import { afterSaleDb } from '../../config/firebaseProjectB';
import admin from 'firebase-admin';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

async function validateLeaderAccess(
  userId: string,
  projectId: string,
  workOrderCode: string
): Promise<boolean> {
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
  return (
    data.leaderId === userId ||
    (data.leaderIds && Array.isArray(data.leaderIds) && data.leaderIds.includes(userId))
  );
}

async function checkTaskLeaderAccess(req: Request, taskId: string): Promise<void> {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.roleCode;
  if (userRole !== 'LD') return;

  let taskDoc;
  const parts = taskId.split('__');
  if (parts.length >= 3) {
    const [woId, catId, idOnly] = parts;
    taskDoc = await afterSaleDb
      .collection('workOrders')
      .doc(woId)
      .collection('categories')
      .doc(catId)
      .collection('tasks')
      .doc(idOnly)
      .get();
  } else {
    const querySnapshot = await afterSaleDb
      .collectionGroup('tasks')
      .where('taskId', '==', taskId)
      .limit(1)
      .get();
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
    throw new AppError(
      'คุณไม่มีสิทธิ์เข้าถึงหรือจัดการงานในหมวดงานนี้ (Access denied for this Work Order)',
      403
    );
  }
}

// GET /api/tasks/backlog
router.get('/backlog', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const { startDate, endDate } = req.query;
    const userRole = authReq.user?.roleCode;
    const userEmployeeId = authReq.user?.employeeId;

    if (!startDate || !endDate) {
      throw new AppError(
        'ต้องระบุวันที่เริ่มต้น (startDate) และวันที่สิ้นสุด (endDate) (startDate and endDate are required)',
        400
      );
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('รูปแบบวันที่ไม่ถูกต้อง (Invalid date format)', 400);
    }

    // 1. Fetch all projects to build projectCode map
    const projectsSnapshot = await db.collection('Project').get();
    const projectsMap = new Map<string, string>(); // projectId -> projectCode
    projectsSnapshot.forEach((doc) => {
      const data = doc.data();
      projectsMap.set(doc.id, data.projectCode || data.code || '');
    });

    // 2. Fetch locked wage periods for all projects
    const periodsSnapshot = await db.collection('wagePeriods').get();
    const periods = periodsSnapshot.docs
      .map((doc) => doc.data())
      .filter((p) => p.isDeleted !== true);

    const isProjectDateLocked = (projectCode: string, date: Date) => {
      if (!projectCode) return false;
      return periods.some((p) => {
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

    // 3. Fetch all active daily contractors
    let dcQuery = db.collection('dailyContractors').where('isActive', '==', true);
    const contractorsSnapshot = await dcQuery.get();
    let contractors = contractorsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    if (userRole === 'FM' && userEmployeeId) {
      // Filter strictly to contractors recorded by this foreman
      contractors = contractors.filter((dc) => {
        const usage = dc.foremanUsage || {};
        return usage[userEmployeeId] && usage[userEmployeeId].count > 0;
      });
    }

    // 4. Fetch all tasks and subtasks from afterSaleDb to map subtasks
    const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
    const tasksMap = new Map<string, any>();
    tasksSnapshot.docs.forEach((doc) => {
      const pathParts = doc.ref.path.split('/');
      const taskId = pathParts[5] || doc.id;
      const tData = taskConverter.fromFirestore(doc);
      tasksMap.set(taskId, {
        ...tData,
        path: doc.ref.path,
      });
    });

    const subtasksSnapshot = await afterSaleDb.collectionGroup('subtasks').get();
    let tasks = subtasksSnapshot.docs
      .map((doc) => {
        const data = doc.data() as any;
        const parentPath = doc.ref.parent.parent?.path;
        const parts = parentPath?.split('/') || [];
        const woId = parts[1];
        const catId = parts[3];
        const taskId = parts[5];
        const fullId = `${woId}__${catId}__${taskId}__${data.subtaskId}`;

        const parentTask = tasksMap.get(taskId);
        if (!parentTask) return null;

        // กรองไม่แสดงงานของ After-Sale (workOrderCode == 'WOA' หรือ 'WOP') ออกจากระบบ
        const woCode = String(parentTask.workOrderCode || '')
          .toUpperCase()
          .trim();
        if (woCode === 'WOA' || woCode === 'WOP') return null;

        return {
          ...parentTask,
          ...data,
          id: fullId,
          taskId: fullId,
          path: doc.ref.path,
          parentTaskId: taskId,
          taskName: parentTask.taskName
            ? `${parentTask.taskName} > ${data.subtaskName}`
            : data.subtaskName,
          dueDate: data.dueDate || parentTask.dueDate,
          revisionCreatedAt: data.revisionCreatedAt || parentTask.revisionCreatedAt,
          createdAt: data.createdAt || parentTask.createdAt,
        };
      })
      .filter(Boolean) as any[];

    // Filter tasks if role is FM
    const userProjectIds = authReq.user?.projectLocationIds || [];
    if (userRole === 'FM') {
      if (userProjectIds.length > 0) {
        tasks = tasks.filter((t: any) => userProjectIds.includes(t.projectId));
      }
      if (userEmployeeId) {
        const uEmpId = String(userEmployeeId).toLowerCase().trim();
        const uId = String(authReq.user?.uid || '')
          .toLowerCase()
          .trim();
        tasks = tasks.filter((t: any) => {
          const isActive = t.isActive !== false;
          const assignees = Array.isArray(t.assignees) ? t.assignees : [];
          const supportAssignees = Array.isArray(t.supportAssignees) ? t.supportAssignees : [];
          const historicalIds = Array.isArray(t.historicalAssigneeIds)
            ? t.historicalAssigneeIds
            : [];
          const taskRelatedIds = new Set([
            ...assignees.map((a: any) =>
              String(a.employeeId || a.id || '')
                .toLowerCase()
                .trim()
            ),
            ...supportAssignees.map((a: any) =>
              String(a.employeeId || a.id || '')
                .toLowerCase()
                .trim()
            ),
            ...historicalIds.map((id: any) =>
              String(id || '')
                .toLowerCase()
                .trim()
            ),
          ]);
          return isActive && (taskRelatedIds.has(uEmpId) || taskRelatedIds.has(uId));
        });
      }
    }

    // Fetch all users to map uid/employeeId -> name
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map<string, string>();
    usersSnapshot.forEach((doc) => {
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
      for (const task of tasks) {
        const currentRev = task.currentRevision || 'rev00';
        const taskRef = afterSaleDb.doc(task.path);

        // Fetch completion date if task has reached 100% or completed
        let completionDate: string | null = null;
        if (
          task.dailyProgress >= 100 ||
          task.supportDailyProgress >= 100 ||
          task.status === 'completed'
        ) {
          const reportsSnap = await taskRef
            .collection('revisions')
            .doc(currentRev)
            .collection('dailyReports')
            .where('progress', '>=', 100)
            .get();

          const completedDates = reportsSnap.docs.map((doc) => doc.id);

          const helpId = currentRev.replace('rev', 'help');
          const helpReportsSnap = await taskRef
            .collection('help')
            .doc(helpId)
            .collection('dailyReports')
            .where('progress', '>=', 100)
            .get();

          completedDates.push(...helpReportsSnap.docs.map((doc) => doc.id));

          if (completedDates.length > 0) {
            completedDates.sort();
            completionDate = completedDates[0];
          } else {
            const fallbackDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
            completionDate = fallbackDate.toISOString().split('T')[0];
          }
        }
        task.completionDate = completionDate;

        // Normal reports
        const normalReportsPromise = taskRef
          .collection('revisions')
          .doc(currentRev)
          .collection('dailyReports')
          .where(admin.firestore.FieldPath.documentId(), '>=', dates[0])
          .where(admin.firestore.FieldPath.documentId(), '<=', dates[dates.length - 1])
          .get();

        // Support reports (help)
        const helpId = currentRev.replace('rev', 'help');
        const supportReportsPromise = taskRef
          .collection('help')
          .doc(helpId)
          .collection('dailyReports')
          .where(admin.firestore.FieldPath.documentId(), '>=', dates[0])
          .where(admin.firestore.FieldPath.documentId(), '<=', dates[dates.length - 1])
          .get();

        const [normalSnap, supportSnap] = await Promise.all([
          normalReportsPromise,
          supportReportsPromise,
        ]);

        normalSnap.forEach((doc) => {
          allReports.push({
            taskId: task.taskId,
            taskName: task.taskName,
            taskPath: task.path,
            isSupport: false,
            dateStr: doc.id,
            unlockedDates: task.unlockedDates || {},
            ...doc.data(),
          });
        });

        supportSnap.forEach((doc) => {
          allReports.push({
            taskId: task.taskId,
            taskName: task.taskName,
            taskPath: task.path,
            isSupport: true,
            dateStr: doc.id,
            unlockedDates: task.supportUnlockedDates || {},
            ...doc.data(),
          });
        });

        // Now compute startDate for this task using allReports and task creation fields
        const getTaskDateStr = (timestampOrStr: any) => {
          if (!timestampOrStr) return null;
          if (
            typeof timestampOrStr === 'object' &&
            ('_seconds' in timestampOrStr || 'seconds' in timestampOrStr)
          ) {
            const secs = timestampOrStr._seconds || timestampOrStr.seconds;
            return new Date(secs * 1000).toISOString().split('T')[0];
          }
          try {
            return new Date(timestampOrStr).toISOString().split('T')[0];
          } catch (e) {
            return null;
          }
        };

        let startDate: string | null = null;
        if (task.revisionCreatedAt && task.currentRevision && task.currentRevision !== 'rev00') {
          startDate = getTaskDateStr(task.revisionCreatedAt);
        } else if (task.isSupportRequest && task.supportCreatedAt) {
          startDate = getTaskDateStr(task.supportCreatedAt);
        } else {
          startDate = getTaskDateStr(task.createdAt);
        }

        // Check if there are any reports for this task (inside allReports) that are earlier than startDate
        const taskReports = allReports.filter((r) => r.taskId === task.taskId);
        if (taskReports.length > 0) {
          const reportDates = taskReports.map((r) => r.dateStr).sort();
          const earliestReportDate = reportDates[0];
          if (startDate && earliestReportDate < startDate) {
            startDate = earliestReportDate;
          }
        }
        task.startDate = startDate;
      }
    }

    // 6. Build the grid
    const grid = contractors.map((dc) => {
      // Find contractor project code
      const contractorProjectId = dc.projectLocationIds?.[0] || '';
      const contractorProjectCode = projectsMap.get(contractorProjectId) || '';

      // Determine the last used foreman name and date
      let lastUsedByName = dc.lastUsedByName || '';
      let lastUsedDateStr = '';
      if (dc.lastUsedAt) {
        try {
          const dateObj =
            typeof dc.lastUsedAt.toDate === 'function'
              ? dc.lastUsedAt.toDate()
              : new Date(dc.lastUsedAt);
          lastUsedDateStr = dateObj.toISOString().split('T')[0];
        } catch (e) {
          console.error('Failed to parse lastUsedAt:', e);
        }
      }

      // 1. Search in the 15-day reports first (since it's the most recent real data)
      const sortedReports = [...allReports].sort((a, b) => b.dateStr.localeCompare(a.dateStr));
      for (const report of sortedReports) {
        const hasWorker =
          report.labor?.some((l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId) ||
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
          const highestUsage = usages.reduce((prev, current) =>
            prev.count > current.count ? prev : current
          );
          lastUsedByName = highestUsage.name || '';
        }
      }

      const workerDays = dates.map((dateStr) => {
        const dateObj = new Date(dateStr);
        const isLocked = isProjectDateLocked(contractorProjectCode, dateObj);

        // Find if there is any work or leave record for this worker on this date
        const reportsForDate = allReports.filter((r) => r.dateStr === dateStr);

        let workedEntry: any = null;
        let leaveEntry: any = null;
        let matchedReport: any = null;

        for (const report of reportsForDate) {
          const laborItem = report.labor?.find(
            (l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId
          );
          if (laborItem) {
            workedEntry = laborItem;
            matchedReport = report;
            break;
          }
          const leaveItem = report.leave?.find(
            (l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId
          );
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
            // No report exists for any task. If user wants to add, they must pick a task.
            const isWithin3Days = dateObj >= threeDaysAgo;
            if (isWithin3Days) {
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
                reason =
                  'รายงานเกิน 3 วันและไม่ได้ปลดล็อกสิทธิ์ (Older than 3 days and not unlocked)';
              }
            }
          }
        }

        let reportUpdatedAtStr = '';
        if (matchedReport) {
          const timestamp = matchedReport.updatedAt || matchedReport.createdAt;
          if (timestamp) {
            try {
              const dateObj =
                typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
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
          .filter((r) => r.dateStr <= dateStr)
          .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

        for (const report of sortedReportsBeforeOrOnDate) {
          const hasWorker =
            report.labor?.some(
              (l: any) => l.workerId === dc.id || l.employeeId === dc.employeeId
            ) ||
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
            const highestUsage = usages.reduce((prev, current) =>
              prev.count > current.count ? prev : current
            );
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
          record: workedEntry
            ? {
                type: 'regular',
                shifts: workedEntry.shifts,
                shiftTimes: workedEntry.shiftTimes,
                taskId: matchedReport.taskId,
                taskName: matchedReport.taskName,
                isSupport: matchedReport.isSupport,
                reportDate: matchedReport.reportDate,
                reportStatus: matchedReport.status || 'draft',
                createdBy: matchedReport.createdBy || null,
                createdByName: matchedReport.createdBy
                  ? getUserName(matchedReport.createdBy)
                  : null,
                updatedBy: matchedReport.updatedBy || null,
                updatedByName: matchedReport.updatedBy
                  ? getUserName(matchedReport.updatedBy)
                  : null,
                updatedAtStr: reportUpdatedAtStr || null,
              }
            : leaveEntry
              ? {
                  type: 'leave',
                  leaveType: leaveEntry.leaveType,
                  medCertFileUrl: leaveEntry.medCertFileUrl,
                  taskId: matchedReport.taskId,
                  taskName: matchedReport.taskName,
                  isSupport: matchedReport.isSupport,
                  reportDate: matchedReport.reportDate,
                  reportStatus: matchedReport.status || 'draft',
                  createdBy: matchedReport.createdBy || null,
                  createdByName: matchedReport.createdBy
                    ? getUserName(matchedReport.createdBy)
                    : null,
                  updatedBy: matchedReport.updatedBy || null,
                  updatedByName: matchedReport.updatedBy
                    ? getUserName(matchedReport.updatedBy)
                    : null,
                  updatedAtStr: reportUpdatedAtStr || null,
                }
              : null,
        };
      });

      return {
        workerId: dc.id,
        workerName: dc.name,
        employeeId: dc.employeeId,
        skillId: dc.skillId,
        lastUsedByName: lastUsedByName || null,
        lastUsedDateStr: lastUsedDateStr || null,
        days: workerDays,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        dates,
        grid,
        tasks: tasks.map((t: any) => ({
          taskId: t.taskId,
          taskName: t.taskName,
          isSupportRequest: t.isSupportRequest || false,
          currentRevision: t.currentRevision || 'rev00',
          completionDate: t.completionDate || null,
          startDate: t.startDate || null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/assigned-subtasks
router.get('/assigned-subtasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.uid || '')
      .toLowerCase()
      .trim();
    const employeeId = String((req.user as any)?.employeeId || '')
      .toLowerCase()
      .trim();
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
      Object.keys(dates).forEach((key) => {
        res[key] = {
          ...dates[key],
          unlockedUntil: parseFirestoreTimestamp(dates[key].unlockedUntil),
        };
      });
      return res;
    };

    const parseUnlockRequests = (reqs: any) => {
      if (!reqs) return {};
      const res: any = {};
      Object.keys(reqs).forEach((key) => {
        res[key] = {
          ...reqs[key],
          requestedAt: parseFirestoreTimestamp(reqs[key].requestedAt),
        };
      });
      return res;
    };

    const snapshot = await afterSaleDb.collectionGroup('subtasks').get();
    let subtasks = snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      const parentPath = doc.ref.parent.parent?.path;
      const parts = parentPath?.split('/') || [];
      const woId = parts[1];
      const catId = parts[3];
      const taskId = parts[5];
      const fullId = `${woId}__${catId}__${taskId}__${data.subtaskId}`;
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
        taskId: data.subtaskId, // original subtaskId
        parentTaskId: taskId, // the parent task's id
      };
    });

    if (userRole === 'FM' || userRole === 'SE') {
      subtasks = subtasks.filter((st) => {
        const stAssignees = Array.isArray(st.assignees) ? st.assignees : [];
        const stHistorical = Array.isArray(st.historicalAssigneeIds)
          ? st.historicalAssigneeIds
          : [];
        const stSupport = Array.isArray(st.supportAssignees) ? st.supportAssignees : [];

        const matchEmployee = stAssignees.some(
          (a: any) =>
            String(a.employeeId || '').toLowerCase() === employeeId ||
            String(a.id || '').toLowerCase() === userId
        );
        const matchSupport = stSupport.some(
          (a: any) =>
            String(a.employeeId || '').toLowerCase() === employeeId ||
            String(a.id || '').toLowerCase() === userId
        );
        const matchHistorical = stHistorical.some(
          (id: any) =>
            String(id || '').toLowerCase() === employeeId ||
            String(id || '').toLowerCase() === userId
        );

        return matchEmployee || matchSupport || matchHistorical || st.isSupportRequest === true;
      });
    }

    const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
    const tasksMap = new Map();
    tasksSnapshot.docs.forEach((doc) => {
      const pathParts = doc.ref.path.split('/');
      const taskId = pathParts[5] || doc.id;
      const tData = taskConverter.fromFirestore(doc);
      tasksMap.set(taskId, tData);
    });

    const enrichedSubtasks = subtasks
      .map((st) => {
        const parentTask = tasksMap.get(st.parentTaskId);
        if (!parentTask) return null;

        // กรองไม่แสดงงานของ After-Sale (workOrderCode == 'WOA' หรือ 'WOP') ออกจากระบบ
        const woCode = String(parentTask.workOrderCode || '')
          .toUpperCase()
          .trim();
        if (woCode === 'WOA' || woCode === 'WOP') return null;

        if (projectId && parentTask.projectId !== projectId) return null;
        return {
          ...parentTask,
          ...st,
          dueDate: st.dueDate || parentTask.dueDate,
          taskName: `${parentTask.taskName || ''} > ${st.subtaskName}`,
        };
      })
      .filter(Boolean);

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

    // 1. Fetch all tasks to get projectId map
    const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
    const tasksMap = new Map();
    tasksSnapshot.docs.forEach((doc) => {
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
        createdAt: taskData.createdAt
          ? typeof taskData.createdAt.toDate === 'function'
            ? taskData.createdAt.toDate()
            : taskData.createdAt
          : null,
      });
    });

    // Fetch all subtasks to get subtaskName map
    const subtasksSnapshot = await afterSaleDb.collectionGroup('subtasks').get();
    const subtasksMap = new Map();
    subtasksSnapshot.docs.forEach((doc) => {
      subtasksMap.set(doc.id, doc.data().subtaskName);
    });

    // Fetch all users to map employeeId / uid / username to name
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();
    usersSnapshot.docs.forEach((doc) => {
      const uData = doc.data();
      if (doc.id) usersMap.set(doc.id, uData.name);
      if (uData.employeeId) usersMap.set(uData.employeeId, uData.name);
      if (uData.username) usersMap.set(uData.username, uData.name);
    });

    // 2. Fetch all requests
    const snapshot = await afterSaleDb.collectionGroup('requests').get();
    const allRequests: any[] = [];

    snapshot.docs.forEach((doc) => {
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

      const taskMeta = tasksMap.get(taskId);
      if (!taskMeta) return;

      // กรองไม่แสดงงานของ After-Sale (workOrderCode == 'WOA' หรือ 'WOP') ออกจากระบบ
      const woCode = String(taskMeta.workOrderCode || '')
        .toUpperCase()
        .trim();
      if (woCode === 'WOA' || woCode === 'WOP') return;

      if (projectId && taskMeta.projectId !== projectId) return;

      const rDateStr = doc.id;
      if (startDate && rDateStr < startDate) return;
      if (endDate && rDateStr > endDate) return;

      let taskName = taskMeta.taskName;
      if (subtaskId) {
        const subtaskName = subtasksMap.get(subtaskId);
        if (subtaskName) {
          taskName = `${taskMeta.taskName} > ${subtaskName}`;
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

// GET /api/tasks/reports-all
router.get('/reports-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, startDate, endDate } = req.query;

    // 1. Fetch all tasks to get projectId map
    const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
    const tasksMap = new Map();
    tasksSnapshot.docs.forEach((doc) => {
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
        createdAt: taskData.createdAt
          ? typeof taskData.createdAt.toDate === 'function'
            ? taskData.createdAt.toDate()
            : taskData.createdAt
          : null,
      });
    });

    // Fetch all subtasks to get subtaskName map
    const subtasksSnapshot = await afterSaleDb.collectionGroup('subtasks').get();
    const subtasksMap = new Map();
    subtasksSnapshot.docs.forEach((doc) => {
      subtasksMap.set(doc.id, doc.data().subtaskName);
    });

    // Fetch all users to map employeeId / uid / username to name
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();
    usersSnapshot.docs.forEach((doc) => {
      const uData = doc.data();
      if (doc.id) usersMap.set(doc.id, uData.name);
      if (uData.employeeId) usersMap.set(uData.employeeId, uData.name);
      if (uData.username) usersMap.set(uData.username, uData.name);
    });

    // 2. Fetch all dailyReports
    const snapshot = await afterSaleDb.collectionGroup('dailyReports').get();
    const allReports: any[] = [];

    snapshot.docs.forEach((doc) => {
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

      const taskMeta = tasksMap.get(taskId);
      if (!taskMeta) return;

      // กรองไม่แสดงงานของ After-Sale (workOrderCode == 'WOA' หรือ 'WOP') ออกจากระบบ
      const woCode = String(taskMeta.workOrderCode || '')
        .toUpperCase()
        .trim();
      if (woCode === 'WOA' || woCode === 'WOP') return;

      if (projectId && taskMeta.projectId !== projectId) return;

      const rDateStr = doc.id;
      if (startDate && rDateStr < startDate) return;
      if (endDate && rDateStr > endDate) return;

      let taskName = taskMeta.taskName;
      if (subtaskId) {
        const subtaskName = subtasksMap.get(subtaskId);
        if (subtaskName) {
          taskName = `${taskMeta.taskName} > ${subtaskName}`;
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

    // If role is FM, SE, OE, they should only see assigned tasks
    // Let's assume FM can only see tasks assigned to them
    if (userRole === 'FM' || userRole === 'SE') {
      filters.assigneeId = userId;
    }

    const tasks = await taskService.getTasks(filters);

    let filteredTasks = tasks;
    if (userRole === 'LD' && authReq.user) {
      const userProjects = projectId
        ? [projectId as string]
        : authReq.user.projectLocationIds || [];
      const leaderWorkOrderCodes = new Set<string>();

      for (const pId of userProjects) {
        const woSnapshot = await db
          .collection('Project')
          .doc(pId)
          .collection('workOrderConfigs')
          .get();

        woSnapshot.forEach((doc) => {
          const data = doc.data();
          const isLeader =
            data.leaderId === authReq.user!.id ||
            (data.leaderIds &&
              Array.isArray(data.leaderIds) &&
              data.leaderIds.includes(authReq.user!.id));
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

    res.status(200).json({
      success: true,
      data: filteredTasks,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      taskName,
      projectId,
      projectName,
      workOrderId,
      workOrderCode,
      workOrderName,
      categoryId,
      categoryName,
      subtasks,
      dueDate,
      status,
    } = req.body;

    if (!taskName || !projectId || !workOrderCode || !categoryName) {
      throw new AppError(
        'ข้อมูลไม่ครบถ้วน (TaskName, ProjectId, WorkOrderCode, CategoryName are required)',
        400
      );
    }

    const authReq = req as AuthRequest;
    if (!authReq.user) {
      throw new AppError('Unauthorized', 401);
    }
    const userRole = authReq.user.roleCode;
    if (userRole === 'LD') {
      const isAssigned = await validateLeaderAccess(authReq.user.id, projectId, workOrderCode);
      if (!isAssigned) {
        throw new AppError(
          'คุณไม่มีสิทธิ์สร้างงานในหมวดงานนี้ (Access denied to create tasks for this Work Order)',
          403
        );
      }
    }

    const subtasksArray = Array.isArray(subtasks) ? subtasks : [];

    // Validate that each subtask has a dueDate
    const hasInvalidSubtaskDueDate = subtasksArray.some(
      (st: any) => !st.dueDate || isNaN(new Date(st.dueDate).getTime())
    );
    if (hasInvalidSubtaskDueDate) {
      throw new AppError(
        'กรุณาระบุวันที่ครบกำหนดของทุกงานย่อยให้ถูกต้อง (Subtask due dates are required)',
        400
      );
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
router.patch(
  '/:id/subtasks/:subtaskId',
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

// DELETE /api/tasks/:id/subtasks/:subtaskId
router.delete(
  '/:id/subtasks/:subtaskId',
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

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

    await taskService.unlockDailyReport(
      id,
      dateStr,
      daysToUnlock,
      userId,
      isSupportReport === true
    );

    // --- Create 'unlock_granted' notification for the FM ---
    try {
      const unlockRequestsField =
        isSupportReport === true ? 'supportUnlockRequests' : 'unlockRequests';
      let targetFmUid: string | undefined;
      let subtaskDocData: any = null;

      // Resolve the subtask ref to get the unlock request (who requested the unlock)
      let idParts = id.split('__');
      let subtaskRawId: string | undefined;
      if (idParts.length >= 4) {
        const [woId, catId, taskId, subtaskId] = idParts;
        const subtaskRef = afterSaleDb
          .collection('workOrders')
          .doc(woId)
          .collection('categories')
          .doc(catId)
          .collection('tasks')
          .doc(taskId)
          .collection('subtasks')
          .doc(subtaskId);
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
            const userByUid = await db
              .collection('users')
              .where('uid', '==', requestedByUid)
              .limit(1)
              .get();
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

      await afterSaleDb.collection('notifications').add(notificationData);
      console.log(`[tasks.routes] Created unlock_granted notification for FM: ${targetFmUid}`);
    } catch (notiErr: any) {
      console.error(
        '[tasks.routes] Failed to create unlock_granted notification:',
        notiErr.message
      );
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

    const { dateStr, isSupportReport } = req.body;
    if (!dateStr) {
      throw new AppError('dateStr is required', 400);
    }

    await taskService.requestDailyReportUnlock(id, dateStr, userId, isSupportReport === true);

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
    const report = await taskService.getDailyReport(id, date, isSupportReport);

    res.status(200).json({
      success: true,
      data: report,
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
    const subtask = await taskService.createSubtask(
      id,
      { subtaskName, assignees: assigneesArray, dueDate },
      userId
    );
    res.status(201).json({
      success: true,
      message: 'สร้าง Subtask สำเร็จ',
      data: subtask,
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
router.patch(
  '/:id/requests/:date/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, date } = req.params;
      const { status, isSupportReport } = req.body;
      const userId = req.user?.uid;
      if (!userId) throw new AppError('Unauthorized', 401);

      if (!status) {
        throw new AppError('status is required', 400);
      }

      await taskService.updateAdvanceRequestStatus(
        id,
        date,
        status,
        userId,
        isSupportReport === true
      );

      res.status(200).json({
        success: true,
        message: 'อัปเดตสถานะแผนงานล่วงหน้าสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
