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
  subtaskDueDate: ['subtask due date', 'วันส่งมอบงานย่อย', 'due date งานย่อย', 'กำหนดส่งงานย่อย', 'subtaskduedate', 'วันครบกำหนด (งานย่อย)', 'วันครบกำหนดงานย่อย'],
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
    
    // Parse Dates
    const taskDueDate = parseExcelDate(mappedRow.taskDueDate);
    const subtaskDueDate = parseExcelDate(mappedRow.subtaskDueDate);

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
        errors.push('งานย่อยจำเป็นต้องระบุ "วันครบกำหนด (งานย่อย)" (Subtask Due Date)');
      }
    } else {
      // If no subtask, check if task due date is specified
      if (mappedRow.taskDueDate && !taskDueDate) {
        errors.push('รูปแบบ "วันครบกำหนด (งาน)" (Task Due Date) ไม่ถูกต้อง');
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
    subtasks: {
      subtaskName: string;
      dueDate: Date;
      assignees: TaskAssignee[];
      rawAssigneeIds: string[];
    }[];
  }> = {};

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
        subtasks: [],
      };
    }

    if (d.subtaskName && d.subtaskDueDate) {
      const resolvedAssignees: TaskAssignee[] = [];
      if (d.assigneeIds) {
        d.assigneeIds.forEach(id => {
          const match = usersMap.get(id);
          if (match) {
            resolvedAssignees.push({
              employeeId: id,
              name: match.name,
              roleId: match.roleId,
            });
          }
        });
      }

      groups[key].subtasks.push({
        subtaskName: d.subtaskName,
        dueDate: d.subtaskDueDate,
        assignees: resolvedAssignees,
        rawAssigneeIds: d.assigneeIds || [],
      });
    }
  });

  // Convert groups object to array and calculate overall task due date if subtasks exist
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
    }
    groupedTasks.push(group);
  });

  return {
    rows: validatedRows,
    groupedTasks,
    isValid: fileIsValid && validatedRows.length > 0,
  };
}
