import { Router, Request, Response, NextFunction } from 'express';
import { taskService } from '../../services/TaskService';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../../config/firebase';
import { afterSaleDb } from '../../config/firebaseProjectB';
import admin from 'firebase-admin';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/tasks/backlog
router.get('/backlog', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const { startDate, endDate } = req.query;
    const userRole = authReq.user?.roleCode;
    const userEmployeeId = authReq.user?.employeeId;

    if (!startDate || !endDate) {
      throw new AppError('ต้องระบุวันที่เริ่มต้น (startDate) และวันที่สิ้นสุด (endDate) (startDate and endDate are required)', 400);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('รูปแบบวันที่ไม่ถูกต้อง (Invalid date format)', 400);
    }

    // 1. Fetch all projects to build projectCode map
    const projectsSnapshot = await db.collection('Project').get();
    const projectsMap = new Map<string, string>(); // projectId -> projectCode
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      projectsMap.set(doc.id, data.projectCode || data.code || '');
    });

    // 2. Fetch locked wage periods for all projects
    const periodsSnapshot = await db.collection('wagePeriods').get();
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

    // 3. Fetch all active daily contractors
    let dcQuery = db.collection('dailyContractors').where('isActive', '==', true);
    const contractorsSnapshot = await dcQuery.get();
    let contractors = contractorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    if (userRole === 'FM' && userEmployeeId) {
      // Filter strictly to contractors recorded by this foreman
      contractors = contractors.filter(dc => {
        const usage = dc.foremanUsage || {};
        return usage[userEmployeeId] && usage[userEmployeeId].count > 0;
      });
    }

    // 4. Fetch all tasks from afterSaleDb
    const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
    let tasks = tasksSnapshot.docs.map(doc => {
      const data = doc.data();
      const pathParts = doc.ref.path.split('/');
      // Format: workOrders/{woId}/categories/{catId}/tasks/{taskId}
      const compositeId = pathParts.length >= 6 ? `${pathParts[1]}__${pathParts[3]}__${pathParts[5]}` : data.taskId || doc.id;
      return {
        ...data,
        id: compositeId,
        taskId: compositeId,
        path: doc.ref.path
      };
    }) as any;

    // Filter tasks if role is FM
    const userProjectIds = authReq.user?.projectLocationIds || [];
    if (userRole === 'FM') {
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

    // Fetch all users to map uid/employeeId -> name
    const usersSnapshot = await db.collection('users').get();
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
        const normalReportsPromise = taskRef.collection('revisions').doc(currentRev).collection('dailyReports')
          .where(admin.firestore.FieldPath.documentId(), '>=', dates[0])
          .where(admin.firestore.FieldPath.documentId(), '<=', dates[dates.length - 1])
          .get();

        // Support reports (help)
        const helpId = currentRev.replace('rev', 'help');
        const supportReportsPromise = taskRef.collection('help').doc(helpId).collection('dailyReports')
          .where(admin.firestore.FieldPath.documentId(), '>=', dates[0])
          .where(admin.firestore.FieldPath.documentId(), '<=', dates[dates.length - 1])
          .get();

        const [normalSnap, supportSnap] = await Promise.all([normalReportsPromise, supportReportsPromise]);

        normalSnap.forEach(doc => {
          allReports.push({
            taskId: task.taskId,
            taskName: task.taskName,
            taskPath: task.path,
            isSupport: false,
            dateStr: doc.id,
            unlockedDates: task.unlockedDates || {},
            ...doc.data()
          });
        });

        supportSnap.forEach(doc => {
          allReports.push({
            taskId: task.taskId,
            taskName: task.taskName,
            taskPath: task.path,
            isSupport: true,
            dateStr: doc.id,
            unlockedDates: task.supportUnlockedDates || {},
            ...doc.data()
          });
        });

        // Now compute startDate for this task using allReports and task creation fields
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

        let startDate: string | null = null;
        if (task.revisionCreatedAt && task.currentRevision && task.currentRevision !== 'rev00') {
          startDate = getTaskDateStr(task.revisionCreatedAt);
        } else if (task.isSupportRequest && task.supportCreatedAt) {
          startDate = getTaskDateStr(task.supportCreatedAt);
        } else {
          startDate = getTaskDateStr(task.createdAt);
        }

        // Check if there are any reports for this task (inside allReports) that are earlier than startDate
        const taskReports = allReports.filter(r => r.taskId === task.taskId);
        if (taskReports.length > 0) {
          const reportDates = taskReports.map(r => r.dateStr).sort();
          const earliestReportDate = reportDates[0];
          if (startDate && earliestReportDate < startDate) {
            startDate = earliestReportDate;
          }
        }
        task.startDate = startDate;
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
        tasks: tasks.map((t: any) => ({
          taskId: t.taskId,
          taskName: t.taskName,
          isSupportRequest: t.isSupportRequest || false,
          currentRevision: t.currentRevision || 'rev00',
          completionDate: t.completionDate || null,
          startDate: t.startDate || null
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});


// GET /api/tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.uid;
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
    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskName, projectId, projectName, workOrderId, workOrderCode, workOrderName, categoryId, categoryName, subtasks, dueDate, status } = req.body;
    
    if (!taskName || !projectId || !workOrderCode || !categoryName || !dueDate || !subtasks || subtasks.length === 0) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (TaskName, ProjectId, WorkOrderCode, CategoryName, Subtasks, DueDate are required)', 400);
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
      subtasks,
      dueDate: new Date(dueDate),
      status,
    };

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

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

    const { dateStr, daysToUnlock, isSupportReport } = req.body;
    if (!dateStr || !daysToUnlock) {
      throw new AppError('dateStr and daysToUnlock are required', 400);
    }

    await taskService.unlockDailyReport(id, dateStr, daysToUnlock, userId, isSupportReport === true);

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
    const { supportTaskName, assignees } = req.body;
    
    if (!supportTaskName || !assignees || !Array.isArray(assignees) || assignees.length === 0) {
      throw new AppError('ข้อมูลไม่ครบถ้วน (supportTaskName และ assignees เป็นข้อมูลจำเป็น)', 400);
    }

    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    await taskService.joinSupportTask(id, supportTaskName, assignees, userId);

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

    const subtask = await taskService.createSubtask(id, req.body, userId);
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

export default router;
