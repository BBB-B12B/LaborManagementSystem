import * as XLSX from 'xlsx';

/**
 * Excel Column Headers (Thai) - v2 Single Row Format
 */
export const DAILY_REPORT_COLUMNS = {
  DATE: 'วันที่', 
  PROJECT_CODE: 'รหัสโครงการ',
  EMPLOYEE_ID: 'รหัสพนักงาน',
  WORKER_NAME: 'ชื่อพนักงาน',
  TASK_NAME: 'ชื่องาน',
  HOURS_REGULAR: 'ชั่วโมงทำงานปกติ',
  HOURS_OT_MORNING: 'ชั่วโมงโอทีเช้า',
  HOURS_OT_NOON: 'ชั่วโมงโอทีเที่ยง',
  HOURS_OT_EVENING: 'ชั่วโมงโอทีเย็น',
};

export interface ExcelDailyReportRowV2 {
  date: Date;
  projectCode: string;
  employeeId: string;
  workerName: string;
  taskName: string;
  hoursRegular?: number;
  hoursOTMorning?: number;
  hoursOTNoon?: number;
  hoursOTEvening?: number;
}

/**
 * Parse Excel Row data (v2)
 */
export function parseExcelRowV2(row: any): ExcelDailyReportRowV2 | null {
  const dateVal = row[DAILY_REPORT_COLUMNS.DATE];
  const projectCode = row[DAILY_REPORT_COLUMNS.PROJECT_CODE];
  const employeeId = row[DAILY_REPORT_COLUMNS.EMPLOYEE_ID];
  
  if (!dateVal || !projectCode || !employeeId) {
    return null;
  }

  // Handle Excel Date (number or string)
  let date: Date;
  if (typeof dateVal === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(dateVal);
    date = new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d);
  } else {
    // Expect DD/MM/YYYY
    const [d, m, y] = String(dateVal).split('/').map(Number);
    date = new Date(y, m - 1, d);
  }

  return {
    date,
    projectCode: String(projectCode).trim(),
    employeeId: String(employeeId).trim(),
    workerName: String(row[DAILY_REPORT_COLUMNS.WORKER_NAME] || ''),
    taskName: String(row[DAILY_REPORT_COLUMNS.TASK_NAME] || ''),
    hoursRegular: row[DAILY_REPORT_COLUMNS.HOURS_REGULAR] ? Number(row[DAILY_REPORT_COLUMNS.HOURS_REGULAR]) : undefined,
    hoursOTMorning: row[DAILY_REPORT_COLUMNS.HOURS_OT_MORNING] ? Number(row[DAILY_REPORT_COLUMNS.HOURS_OT_MORNING]) : undefined,
    hoursOTNoon: row[DAILY_REPORT_COLUMNS.HOURS_OT_NOON] ? Number(row[DAILY_REPORT_COLUMNS.HOURS_OT_NOON]) : undefined,
    hoursOTEvening: row[DAILY_REPORT_COLUMNS.HOURS_OT_EVENING] ? Number(row[DAILY_REPORT_COLUMNS.HOURS_OT_EVENING]) : undefined,
  };
}
