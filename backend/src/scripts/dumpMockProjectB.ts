import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Configuration
const PROJECT_B_KEY_PATH = path.resolve(__dirname, '../config/after-sale-key.json');
const TARGET_COLLECTION = 'DailyEmployeeTimesheets';

// Check if key exists
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
// Mock Data Generation
// ----------------------------------------------------------------------

interface MockTimesheet {
  employeeNumber: string;
  date: string;
  projectLocationId: string;
  isActive: boolean;
  expectedShifts: {
    normal: boolean;
    otMorning: boolean;
    otNoon: boolean;
    otEvening: boolean;
  };
  shiftTimes: {
    day?: string;
    otEvening?: string;
    otMorning?: string;
  };
  workLogs: any[];
}

const mockEmployees = ['100154', '101382', '200022', '200247', '200396'];
const mockDates = ['2025-08-25', '2025-08-26', '2025-08-27'];
const projectId = 'PROJ-MOCK';

const generateMockData = (): MockTimesheet[] => {
  const records: MockTimesheet[] = [];

  for (const date of mockDates) {
    for (const emp of mockEmployees) {
      // Create some variance based on employee number
      const isOvertimeWorker = emp.startsWith('2'); // Just a fake rule for data variance
      
      records.push({
        employeeNumber: emp,
        date: date,
        projectLocationId: projectId,
        isActive: true,
        expectedShifts: {
          normal: true,
          otMorning: false,
          otNoon: false,
          otEvening: isOvertimeWorker, // 2xxxxx workers get OT
        },
        shiftTimes: {
          day: '08:00 - 17:00',
          ...(isOvertimeWorker ? { otEvening: '18:00 - 21:00' } : {})
        },
        workLogs: [
          {
            taskId: `TASK-MOCK-${Math.floor(Math.random() * 1000)}`,
            workOrderId: 'WO-2025-MOCK',
            categoryId: 'CAT-MOCK',
            dailyReportId: `h-mock-${Date.now()}`,
            shifts: { normal: true, ...(isOvertimeWorker ? { otEvening: true } : {}) }
          }
        ],
      });
    }
  }

  return records;
};

// ----------------------------------------------------------------------
// Execution Logic
// ----------------------------------------------------------------------

async function run() {
  console.log(`Starting mock data dump into Project B (${serviceAccount.project_id})...`);
  const records = generateMockData();
  let successCount = 0;

  const batch = db.batch();
  let operationCount = 0;

  for (const record of records) {
    const docId = `${record.employeeNumber}_${record.date}`;
    const docRef = db.collection(TARGET_COLLECTION).doc(docId);
    
    batch.set(docRef, {
      ...record,
      lastUpdated: new Date().toISOString()
    });

    operationCount++;

    // Commit batch every 500 records (Firestore limit)
    if (operationCount === 500) {
      await batch.commit();
      successCount += operationCount;
      console.log(`Committed batch of ${operationCount}...`);
      operationCount = 0;
    }
  }

  // Commit remaining
  if (operationCount > 0) {
    await batch.commit();
    successCount += operationCount;
  }

  console.log(`\n✅ Successfully dumped ${successCount} records into ${TARGET_COLLECTION} collection of Project B!`);
  console.log('You can now test the wage calculation in your system.');
  process.exit(0);
}

run().catch(error => {
  console.error('Fatal error during dump:', error);
  process.exit(1);
});
