import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Configuration
const PROJECT_B_KEY_PATH = path.resolve(__dirname, '../../../keys/after-sale-system-621698fcd44f.json');
const TARGET_COLLECTION = 'DailyEmployeeTimesheets';

// The input CSV file path passed as argument
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('ERROR: Please provide the path to the CSV file.');
  console.error('Usage: npx ts-node src/scripts/dumpCsvToProjectB.ts "<path-to-csv>"');
  process.exit(1);
}

if (!fs.existsSync(PROJECT_B_KEY_PATH)) {
  console.error(`ERROR: Service account key not found at ${PROJECT_B_KEY_PATH}`);
  process.exit(1);
}

// Initialize Firebase Admin for Project B
const serviceAccount = require(PROJECT_B_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ----------------------------------------------------------------------
// Parsing Logic
// ----------------------------------------------------------------------

interface ParsedTimesheet {
  employeeNumber: string;
  date: string; // YYYY-MM-DD
  projectLocationId: string;
  isActive: boolean;
  expectedShifts: {
    normal: boolean;
    otMorning: boolean;
    otNoon: boolean;
    otEvening: boolean;
  };
  expectedHours: {
    normal: number;
    otMorning: number;
    otNoon: number;
    otEvening: number;
  };
  shiftTimes: {
    day?: string;
    otEvening?: string;
    otMorning?: string;
    otNoon?: string;
  };
  workLogs: any[];
}

const parseThaiDate = (thaiDateStr: string): string | null => {
  if (!thaiDateStr) return null;
  const parts = thaiDateStr.split('/');
  if (parts.length !== 3) return null;

  const [dayStr, monthStr, yearStr] = parts;
  const day = dayStr.padStart(2, '0');
  const year = yearStr; // Already 2025

  const thaiMonths: Record<string, string> = {
    'ม.ค.': '01',
    'ก.พ.': '02',
    'มี.ค.': '03',
    'เม.ย.': '04',
    'พ.ค.': '05',
    'มิ.ย.': '06',
    'ก.ค.': '07',
    'ส.ค.': '08',
    'ก.ย.': '09',
    'ต.ค.': '10',
    'พ.ย.': '11',
    'ธ.ค.': '12'
  };

  const month = thaiMonths[monthStr.trim()];
  if (!month) return null;

  return `${year}-${month}-${day}`;
};

async function run() {
  console.log(`Starting CSV parsing...`);
  
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const fileContent = fs.readFileSync(path.resolve(csvFilePath), 'utf-8');
  const lines = fileContent.split(/\r?\n/);
  
  // Maps to aggregate multiple rows for the same employee+date
  const aggregationMap = new Map<string, ParsedTimesheet>();
  const TARGET_START_DATE = '2025-08-25';
  let skippedEmptyId = 0;
  let skippedOldDate = 0;

  console.log('Processing rows...');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Split respecting quotes
    const columns = parseCsvLine(line);

    const rawDate = columns[0];
    const normalTime = columns[2];
    const taskName = columns[3];
    const location = columns[4];
    
    const otMorningHrs = parseFloat(columns[5] || '0');
    const otMorningTask = columns[6];
    const otNoonHrs = parseFloat(columns[8] || '0');
    const otNoonTask = columns[9];
    const otEveningHrs = parseFloat(columns[11] || '0');
    const otEveningTask = columns[12];
    
    const matcId = columns[15]?.trim();
    const normalHrs = parseFloat(columns[17] || '0');

    // 1. Skip rows without MatcID
    if (!matcId) {
      skippedEmptyId++;
      continue;
    }

    // 2. Parse and filter date
    const isoDate = parseThaiDate(rawDate);
    if (!isoDate) continue;

    if (isoDate < TARGET_START_DATE) {
      skippedOldDate++;
      continue;
    }

    const docId = `${matcId}_${isoDate}`;
    let record = aggregationMap.get(docId);

    if (!record) {
      record = {
        employeeNumber: matcId,
        date: isoDate,
        projectLocationId: location || 'UNKNOWN',
        isActive: true,
        expectedShifts: {
          normal: false,
          otMorning: false,
          otNoon: false,
          otEvening: false,
        },
        expectedHours: {
          normal: 0,
          otMorning: 0,
          otNoon: 0,
          otEvening: 0,
        },
        shiftTimes: {},
        workLogs: []
      };
      aggregationMap.set(docId, record);
    }

    // Update aggregate logic
    if (normalHrs > 0 || normalTime.trim()) {
      record.expectedShifts.normal = true;
      record.expectedHours.normal = Math.max(record.expectedHours.normal, normalHrs || 8); // Default to 8 if blank but time exists
      if (normalTime.trim() && !record.shiftTimes.day) {
        record.shiftTimes.day = normalTime.trim();
      }
    }
    if (otMorningHrs > 0 || otMorningTask?.trim()) {
      record.expectedShifts.otMorning = true;
      record.expectedHours.otMorning = Math.max(record.expectedHours.otMorning, otMorningHrs);
    }
    if (otNoonHrs > 0 || otNoonTask?.trim()) {
      record.expectedShifts.otNoon = true;
      record.expectedHours.otNoon = Math.max(record.expectedHours.otNoon, otNoonHrs);
    }
    if (otEveningHrs > 0 || otEveningTask?.trim()) {
      record.expectedShifts.otEvening = true;
      record.expectedHours.otEvening = Math.max(record.expectedHours.otEvening, otEveningHrs);
      if (!record.shiftTimes.otEvening) {
        record.shiftTimes.otEvening = '18:00 - 21:00'; // Fallback approximation since time isn't in CSV
      }
    }

    // Push worklog
    record.workLogs.push({
      taskName: taskName,
      location: location,
      otMorningTask,
      otNoonTask,
      otEveningTask
    });
  }

  const finalRecords = Array.from(aggregationMap.values());
  console.log(`\n--- Parsing Summary ---`);
  console.log(`Skipped (No MatcID): ${skippedEmptyId}`);
  console.log(`Skipped (Before ${TARGET_START_DATE}): ${skippedOldDate}`);
  console.log(`Valid aggregated documents to upload: ${finalRecords.length}`);
  console.log(`-----------------------\n`);

  if (finalRecords.length === 0) {
    console.log('No records to upload. Exiting.');
    process.exit(0);
  }

  console.log(`Connecting to Project B to dump data...`);
  
  let batch = db.batch();
  let operationCount = 0;
  let successCount = 0;

  for (const record of finalRecords) {
    const docId = `${record.employeeNumber}_${record.date}`;
    const docRef = db.collection(TARGET_COLLECTION).doc(docId);
    
    batch.set(docRef, {
      ...record,
      lastUpdated: new Date().toISOString()
    });

    operationCount++;

    if (operationCount === 500) {
      await batch.commit();
      successCount += operationCount;
      process.stdout.write(`...Committed ${successCount} records\r`);
      operationCount = 0;
      batch = db.batch();
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    successCount += operationCount;
  }

  console.log(`\n✅ Successfully dumped ${successCount} aggregated timesheets into Project B!`);
  process.exit(0);
}

run().catch(error => {
  console.error('Fatal error during dump:', error);
  process.exit(1);
});
