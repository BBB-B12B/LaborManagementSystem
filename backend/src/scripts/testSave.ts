import { db } from '../config/firebase';

async function test() {
  try {
    const scanDate = '2025-08-25';
    const projectCode = '';
    const uniqueKey = `SCAN_200022_${projectCode}_${scanDate}`;
    
    console.log('uniqueKey:', uniqueKey);
    const docRef = db.collection('scanData').doc(uniqueKey);
    
    const contractorId = null;
    const importedAt = new Date();
    const workDate = new Date();
    const primaryScan = new Date();
    const importBatchId = 'batch-123';
    const projectName = '';

    const scanData: any = {
          dailyContractorId: contractorId,
          employeeId: '200022',
          employeeNumber: '200022',
          projectLocationId: 'loc-1',
          scanDateTime: primaryScan || workDate,
          scanDate,
          workDate,
          isLate: false,
          lateMinutes: 0,
          hasDiscrepancy: false,
          createdAt: importedAt,
          importedAt,
          importedBy: 'test',
          importBatchId,
          Time1: null,
          Time2: null,
          Time3: null,
          Time4: null,
          Time5: null,
          Time6: null,
          allScans: [],
          normalStatus: 0,
          regularHours: 0,
          lunchStatus: 0,
          otMorningHours: 0,
          otEveningHours: 0,
          projectName,
          projectCode,
          isDeleted: false
    };

    // explicitly test undefined strip
    Object.keys(scanData).forEach(key => {
        if (scanData[key] === undefined) {
             delete scanData[key];
        }
    });

    await docRef.set(scanData, { merge: true });
    console.log('Test successful');
  } catch (err: any) {
    console.error('Test failed:', err);
  }
  process.exit(0);
}

test();
