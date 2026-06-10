import * as XLSX from 'xlsx';

/**
 * Excel Column Headers (Thai) - v3 (15 Columns Split Format)
 */
export const DAILY_REPORT_COLUMNS = {
  DATE: 'วันที่',
  EMPLOYEE_ID: 'รหัสพนักงาน',
  WORKER_NAME: 'ชื่อพนักงาน',
  // Regular
  HOURS_REGULAR: 'เวลาทำงานปกติ',
  TASK_REGULAR: 'งานที่ทำ',
  PROJECT_REGULAR: 'โครงการที่ทำ',
  // OT Morning
  HOURS_OT_MORNING: 'โอทีเช้า',
  TASK_OT_MORNING: 'งานที่ทำโอทีเช้า',
  PROJECT_OT_MORNING: 'โครงการที่ทำโอทีเช้า',
  // OT Noon
  HOURS_OT_NOON: 'โอทีเที่ยง',
  TASK_OT_NOON: 'งานที่ทำโอทีเที่ยง',
  PROJECT_OT_NOON: 'โครงการที่ทำโอทีเที่ยง',
  // OT Evening
  HOURS_OT_EVENING: 'โอทีเย็น',
  TASK_OT_EVENING: 'งานที่ทำโอทีเย็น',
  PROJECT_OT_EVENING: 'โครงการที่ทำโอทีเย็น',
};

export interface ExcelDailyReportRowV2 {
  date: Date;
  employeeId: string;
  workerName: string;
  // Regular
  hoursRegular?: number;
  taskRegular?: string;
  projectRegular?: string;
  // OT Morning
  hoursOTMorning?: number;
  taskOTMorning?: string;
  projectOTMorning?: string;
  // OT Noon
  hoursOTNoon?: number;
  taskOTNoon?: string;
  projectOTNoon?: string;
  // OT Evening
  hoursOTEvening?: number;
  taskOTEvening?: string;
  projectOTEvening?: string;
}

/**
 * Parse Excel Row data (v3) - Robust Version
 */
export function parseExcelRowV2(row: any): ExcelDailyReportRowV2 | null {
  // Normalize row keys (Trim whitespace from headers)
  const cleanRow: any = {};
  Object.keys(row).forEach((key) => {
    cleanRow[String(key).trim()] = row[key];
  });

  const dateVal = cleanRow[DAILY_REPORT_COLUMNS.DATE];
  const employeeId = cleanRow[DAILY_REPORT_COLUMNS.EMPLOYEE_ID];

  if (!dateVal || !employeeId) {
    return null;
  }

  // Handle Excel Date (number or string)
  let date: Date;
  try {
    if (typeof dateVal === 'number') {
      const parsedDate = XLSX.SSF.parse_date_code(dateVal);
      date = new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d);
    } else {
      const valStr = String(dateVal).trim();
      if (valStr.includes('-')) {
        date = new Date(valStr);
      } else if (valStr.includes('/')) {
        const parts = valStr.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts.map(Number);
          // Handle potential Buddhist Calendar (BE) year
          const year = y > 2400 ? y - 543 : y;
          date = new Date(year, m - 1, d);
        } else {
          date = new Date(valStr);
        }
      } else {
        date = new Date(valStr);
      }
    }
  } catch (err) {
    console.error(`[ParseExcel] Invalid date value: ${dateVal}`);
    return null;
  }

  if (isNaN(date.getTime())) return null;

  return {
    date,
    employeeId: String(employeeId).trim(),
    workerName: String(cleanRow[DAILY_REPORT_COLUMNS.WORKER_NAME] || '').trim(),
    // Regular
    hoursRegular: cleanRow[DAILY_REPORT_COLUMNS.HOURS_REGULAR]
      ? Number(cleanRow[DAILY_REPORT_COLUMNS.HOURS_REGULAR])
      : undefined,
    taskRegular: String(cleanRow[DAILY_REPORT_COLUMNS.TASK_REGULAR] || '').trim(),
    projectRegular: String(cleanRow[DAILY_REPORT_COLUMNS.PROJECT_REGULAR] || '').trim(),
    // OT Morning
    hoursOTMorning: cleanRow[DAILY_REPORT_COLUMNS.HOURS_OT_MORNING]
      ? Number(cleanRow[DAILY_REPORT_COLUMNS.HOURS_OT_MORNING])
      : undefined,
    taskOTMorning: String(cleanRow[DAILY_REPORT_COLUMNS.TASK_OT_MORNING] || '').trim(),
    projectOTMorning: String(cleanRow[DAILY_REPORT_COLUMNS.PROJECT_OT_MORNING] || '').trim(),
    // OT Noon
    hoursOTNoon: cleanRow[DAILY_REPORT_COLUMNS.HOURS_OT_NOON]
      ? Number(cleanRow[DAILY_REPORT_COLUMNS.HOURS_OT_NOON])
      : undefined,
    taskOTNoon: String(cleanRow[DAILY_REPORT_COLUMNS.TASK_OT_NOON] || '').trim(),
    projectOTNoon: String(cleanRow[DAILY_REPORT_COLUMNS.PROJECT_OT_NOON] || '').trim(),
    // OT Evening
    hoursOTEvening: cleanRow[DAILY_REPORT_COLUMNS.HOURS_OT_EVENING]
      ? Number(cleanRow[DAILY_REPORT_COLUMNS.HOURS_OT_EVENING])
      : undefined,
    taskOTEvening: String(cleanRow[DAILY_REPORT_COLUMNS.TASK_OT_EVENING] || '').trim(),
    projectOTEvening: String(cleanRow[DAILY_REPORT_COLUMNS.PROJECT_OT_EVENING] || '').trim(),
  };
}
