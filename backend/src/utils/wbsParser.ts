import * as xlsx from 'xlsx';
import { TaskAssignee } from '../models/Task';

export interface ParsedWbsRow {
  workOrderCode: string;
  workOrderName: string;
  categoryName: string;
  taskName: string;
  taskDescription?: string;
  taskDueDate?: Date | null;
  subtaskName?: string;
  subtaskDueDate?: Date | null;
  assigneeIds?: string[];
}

export interface WbsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rowNumber: number;
  data: ParsedWbsRow;
}

export interface GroupedWbsTask {
  workOrderCode: string;
  workOrderName: string;
  categoryName: string;
  taskName: string;
  description?: string;
  dueDate?: Date | null;
  taskType: 'standalone' | 'pending' | 'hasSubtasks';
  subtasks: {
    subtaskName: string;
    dueDate: Date;
    assignees: TaskAssignee[];
    rawAssigneeIds: string[];
  }[];
}

// Flexible header detection mapping
const HEADER_MAPS: Record<string, string[]> = {
  workOrderCode: ['work order code', 'รหัสหมวดหมู่งานหลัก (ตัวย่อ)', 'รหัสหมวดหมู่งานหลัก', 'รหัสสั่งงาน', 'wo code', 'รหัส wo', 'workordercode', 'wocode', 'ตัวย่อ'],
  workOrderName: ['work order name', 'ชื่อหมวดหมู่งานหลัก (ชื่อเต็ม)', 'ชื่อหมวดหมู่งานหลัก', 'ชื่องานหลัก', 'wo name', 'ชื่อ wo', 'workordername', 'woname', 'ชื่อเต็ม'],
  categoryName: ['category name', 'ชื่อหมวดหมู่งานย่อย', 'หมวดหมู่งานย่อย', 'category', 'หมวดหมู่', 'categoryname'],
  taskName: ['task name', 'ชื่องานหลัก', 'ชื่องาน', 'task', 'taskname'],
  taskDescription: ['task description', 'รายละเอียดงานหลัก', 'รายละเอียด', 'description', 'taskdescription', 'หมายเหตุ'],
  taskDueDate: ['task due date', 'วันส่งมอบงานหลัก', 'due date งานหลัก', 'กำหนดส่งงานหลัก', 'taskduedate', 'วันครบกำหนด (งาน)', 'วันครบกำหนดงาน'],
  subtaskName: ['subtask name', 'ชื่องานย่อย', 'subtask', 'subtaskname'],
  // 'วันครบกำหนด' (bare, no qualifier) is the CURRENT template's column — one column serves as
  // both the subtask's due date (row has a subtask name) and the task's own due date (row has
  // none). The older '(งานย่อย)'-qualified aliases stay recognized for already-downloaded files.
  subtaskDueDate: ['subtask due date', 'วันส่งมอบงานย่อย', 'due date งานย่อย', 'กำหนดส่งงานย่อย', 'subtaskduedate', 'วันครบกำหนด (งานย่อย)', 'วันครบกำหนดงานย่อย', 'วันครบกำหนด', 'due date', 'duedate'],
  subtaskAssignees: ['subtask assignee ids', 'รหัสผู้รับผิดชอบงานย่อย', 'ผู้รับผิดชอบ', 'assignees', 'assignee', 'subtaskassignees', 'รหัสผู้รับผิดชอบ (งานย่อย)', 'รหัสผู้รับผิดชอบ', 'รหัสพนักงานผู้รับผิดชอบ FM (งานย่อย)', 'รหัสพนักงานผู้รับผิดชอบ'],
};

function normalizeHeader(header: string): string | null {
  const clean = header.toString().trim().toLowerCase().replace(/[\s_\-()]/g, '');
  
  // Tier 1: Exact Match (after removing whitespace/symbols)
  for (const [key, aliases] of Object.entries(HEADER_MAPS)) {
    for (const alias of aliases) {
      const cleanAlias = alias.replace(/[\s_\-()]/g, '').toLowerCase();
      if (clean === cleanAlias) {
        return key;
      }
    }
  }
  
  // Tier 2: Substring Match (more specific keys checked first to prevent false matches)
  const orderedKeys = [
    'subtaskAssignees',
    'subtaskDueDate',
    'subtaskName',
    'taskDescription',
    'taskDueDate',
    'taskName',
    'workOrderName',
    'workOrderCode',
    'categoryName',
  ];
  
  const headerLower = header.toString().trim().toLowerCase();
  for (const key of orderedKeys) {
    const aliases = HEADER_MAPS[key];
    for (const alias of aliases) {
      if (headerLower.includes(alias.toLowerCase())) {
        return key;
      }
    }
  }
  return null;
}

function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Handle Excel serial date format
    const utcDays = val - 25569;
    const utcValue = utcDays * 86400;
    const date = new Date(utcValue * 1000);
    // Adjust timezone offset (Excel serial date is usually local time)
    const tzOffset = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() + tzOffset);
  }
  const dateObj = new Date(val);
  if (!isNaN(dateObj.getTime())) return dateObj;
  return null;
}

export function parseWbsExcel(fileBuffer: Buffer, usersMap: Map<string, { name: string; roleId: string }>): {
  rows: WbsValidationResult[];
  groupedTasks: GroupedWbsTask[];
  isValid: boolean;
} {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert sheet to JSON array with header names
  const jsonRows = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });
  if (jsonRows.length === 0) {
    throw new Error('ไม่พบข้อมูลในไฟล์ Excel');
  }

  // Detect header row and column mapping
  let headerRowIndex = -1;
  const colMappings: Record<number, string> = {};

  for (let i = 0; i < Math.min(jsonRows.length, 10); i++) {
    const row = jsonRows[i];
    if (!row || !Array.isArray(row)) continue;
    
    let matchesCount = 0;
    row.forEach((cell: any, colIdx: number) => {
      if (cell) {
        const norm = normalizeHeader(cell);
        if (norm) {
          colMappings[colIdx] = norm;
          matchesCount++;
        }
      }
    });

    // If we matched at least 3 main columns, we treat this as the header row
    if (matchesCount >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('ไม่พบแถวหัวตาราง (Header row) ที่สอดคล้องกับคอลัมน์ระบบสร้างงานหลัก/งานย่อย');
  }

  const validatedRows: WbsValidationResult[] = [];
  let fileIsValid = true;

  // Process data rows
  for (let i = headerRowIndex + 1; i < jsonRows.length; i++) {
    const rawRow = jsonRows[i];
    if (!rawRow || !Array.isArray(rawRow) || rawRow.every(cell => cell === undefined || cell === null || cell === '')) {
      continue; // Skip empty rows
    }

    const rowNum = i + 1;
    const errors: string[] = [];
    const warnings: string[] = [];
    const mappedRow: any = {};

    rawRow.forEach((cell: any, colIdx: number) => {
      const fieldName = colMappings[colIdx];
      if (fieldName) {
        mappedRow[fieldName] = cell;
      }
    });

    // Raw fields
    const workOrderCode = String(mappedRow.workOrderCode || '').trim();
    const workOrderName = String(mappedRow.workOrderName || '').trim();
    const categoryName = String(mappedRow.categoryName || '').trim();
    const taskName = String(mappedRow.taskName || '').trim();
    const taskDescription = mappedRow.taskDescription ? String(mappedRow.taskDescription).trim() : '';
    const subtaskName = mappedRow.subtaskName ? String(mappedRow.subtaskName).trim() : '';
    
    // Parse Dates — ONE "วันครบกำหนด" column serves double duty: it's the SUBTASK's due date
    // when the row has a subtask name, or the TASK's own due date when the row has none (the
    // mirror-subtask / standalone case) — no separate "task due date" column required.
    const rawDueDateCell = mappedRow.subtaskDueDate ?? mappedRow.taskDueDate;
    const rowDueDate = parseExcelDate(rawDueDateCell);
    const subtaskDueDate = subtaskName ? rowDueDate : null;
    const taskDueDate = !subtaskName ? rowDueDate : null;

    // Parse Assignees
    let assigneeIds: string[] = [];
    if (mappedRow.subtaskAssignees) {
      assigneeIds = String(mappedRow.subtaskAssignees)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
    }

    // Required Validations
    if (!workOrderCode) errors.push('ไม่พบข้อมูล "รหัสหมวดหมู่งานหลัก (ตัวย่อ)" (Work Order Code)');
    if (!workOrderName) errors.push('ไม่พบข้อมูล "ชื่อหมวดหมู่งานหลัก (ชื่อเต็ม)" (Work Order Name)');
    if (!categoryName) errors.push('ไม่พบข้อมูล "ชื่อหมวดหมู่งานย่อย" (Category Name)');
    if (!taskName) errors.push('ไม่พบข้อมูล "ชื่องาน" (Task Name)');

    // Conditional Subtask validation
    if (subtaskName) {
      if (!subtaskDueDate) {
        errors.push('งานย่อยจำเป็นต้องระบุ "วันครบกำหนด" (Due Date)');
      }
    } else {
      // If no subtask, check if the (same) due-date column was filled but failed to parse
      if (rawDueDateCell && !taskDueDate) {
        errors.push('รูปแบบ "วันครบกำหนด" (Due Date) ไม่ถูกต้อง');
      }
      // No subtask row, but assignees were given for this task-level row: this becomes a
      // standalone task (mirror subtask carries the assignees) and MUST have a due date,
      // same requirement as the manual "งานเดี่ยว" flow (T-040 — due date always mandatory).
      if (mappedRow.subtaskAssignees && !taskDueDate) {
        errors.push('ระบุผู้รับผิดชอบไว้แล้ว กรุณาระบุ "วันครบกำหนด" (Due Date) ด้วย สำหรับงานที่ไม่มีงานย่อย');
      }
    }

    // Check Assignees
    const resolvedAssignees: TaskAssignee[] = [];
    assigneeIds.forEach(id => {
      const match = usersMap.get(id);
      if (match) {
        resolvedAssignees.push({
          employeeId: id,
          name: match.name,
          roleId: match.roleId,
        });
      } else {
        warnings.push(`ไม่พบพนักงานรหัส "${id}" ในระบบ`);
      }
    });

    const parsedData: ParsedWbsRow = {
      workOrderCode,
      workOrderName,
      categoryName,
      taskName,
      taskDescription: taskDescription || undefined,
      taskDueDate: taskDueDate || undefined,
      subtaskName: subtaskName || undefined,
      subtaskDueDate: subtaskDueDate || undefined,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
    };

    const rowIsValid = errors.length === 0;
    if (!rowIsValid) fileIsValid = false;

    validatedRows.push({
      isValid: rowIsValid,
      errors,
      warnings,
      rowNumber: rowNum,
      data: parsedData,
    });
  }

  // Group valid rows by Work Order + Category + Task
  const groupedTasks: GroupedWbsTask[] = [];

  const validRows = validatedRows.filter(r => r.isValid);
  
  // Helper keys
  const groups: Record<string, {
    workOrderCode: string;
    workOrderName: string;
    categoryName: string;
    taskName: string;
    description?: string;
    dueDate?: Date | null;
    taskType: 'standalone' | 'pending' | 'hasSubtasks';
    taskLevelAssigneeIds: string[];
    subtasks: {
      subtaskName: string;
      dueDate: Date;
      assignees: TaskAssignee[];
      rawAssigneeIds: string[];
    }[];
  }> = {};

  const resolveAssignees = (ids: string[]): TaskAssignee[] => {
    const resolved: TaskAssignee[] = [];
    ids.forEach(id => {
      const match = usersMap.get(id);
      if (match) {
        resolved.push({ employeeId: id, name: match.name, roleId: match.roleId });
      }
    });
    return resolved;
  };

  validRows.forEach(vr => {
    const d = vr.data;
    const key = `${d.workOrderCode}__${d.categoryName}__${d.taskName}`.toLowerCase().trim();

    if (!groups[key]) {
      groups[key] = {
        workOrderCode: d.workOrderCode,
        workOrderName: d.workOrderName,
        categoryName: d.categoryName,
        taskName: d.taskName,
        description: d.taskDescription,
        dueDate: d.taskDueDate,
        taskType: 'pending',
        taskLevelAssigneeIds: [],
        subtasks: [],
      };
    }

    if (d.subtaskName && d.subtaskDueDate) {
      groups[key].subtasks.push({
        subtaskName: d.subtaskName,
        dueDate: d.subtaskDueDate,
        assignees: resolveAssignees(d.assigneeIds || []),
        rawAssigneeIds: d.assigneeIds || [],
      });
    } else {
      // No subtask on this row (allowed — "ปล่อยว่างได้ หากไม่ต้องการสร้างงานย่อย"). Carry
      // forward whatever task-level due date / assignees it gave us so the finalize step below
      // can turn this into a standalone task instead of silently dropping the data (T-048 fix —
      // previously these rows produced a task with zero subtasks and zero assignees).
      if (d.taskDueDate) {
        groups[key].dueDate = d.taskDueDate;
      }
      if (d.assigneeIds) {
        const seen = new Set(groups[key].taskLevelAssigneeIds);
        d.assigneeIds.forEach(id => seen.add(id));
        groups[key].taskLevelAssigneeIds = Array.from(seen);
      }
    }
  });

  // Convert groups object to array, resolve dueDate/taskType, and — for a task that never got a
  // real subtask row — synthesize a single mirror subtask (mirrors the manual "งานเดี่ยว" create
  // flow's behavior) so the task stays assignable/reportable instead of landing with nobody
  // responsible and no subtask to log progress against.
  Object.values(groups).forEach(group => {
    if (group.subtasks.length > 0) {
      // Find max subtask dueDate
      let maxDate = group.subtasks[0].dueDate;
      group.subtasks.forEach(st => {
        if (st.dueDate.getTime() > maxDate.getTime()) {
          maxDate = st.dueDate;
        }
      });
      group.dueDate = maxDate;
      group.taskType = 'hasSubtasks';
    } else if (group.dueDate || group.taskLevelAssigneeIds.length > 0) {
      group.subtasks.push({
        subtaskName: group.taskName,
        dueDate: group.dueDate as Date,
        assignees: resolveAssignees(group.taskLevelAssigneeIds),
        rawAssigneeIds: group.taskLevelAssigneeIds,
      });
      group.taskType = 'standalone';
    } else {
      group.taskType = 'pending';
    }
    groupedTasks.push(group);
  });

  return {
    rows: validatedRows,
    groupedTasks,
    isValid: fileIsValid && validatedRows.length > 0,
  };
}
