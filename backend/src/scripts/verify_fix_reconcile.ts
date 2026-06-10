import { reconciliationService } from '../services/reconciliation/ReconciliationService';

async function verify() {
  const employeeNumber = '200612';
  const workDateStr = '2026-05-12';
  const projectLocationId = 'P003';

  // ข้อมูลจำลองที่ User ส่งมา (ที่มี 3 punches)
  const mockScanData = {
    employeeId: '200612',
    employeeNumber: '200612',
    punches: ['08:15', '12:05', '13:00'],
    allScans: ['08:15:00', '12:05:00', '13:00:00'],
    workDate: new Date('2026-05-12T00:00:00Z'),
    projectLocationId: 'P002',
    regularHours: 0,
    otMorningHours: 0,
    otNoonHours: 0,
    otEveningHours: 0,
  };

  console.log('--- Starting Verification ---');
  console.log(`Simulating reconciliation for ${employeeNumber} on ${workDateStr}`);

  try {
    const result = await reconciliationService.generateForEmployee(
      employeeNumber,
      workDateStr,
      projectLocationId,
      mockScanData
    );

    console.log('Reconciliation Result:');
    console.log(`Status: ${result.status}`);
    console.log(`Scan Punches: ${JSON.stringify(result.scanPunches)}`);
    console.log(`Early Leave Minutes: ${result.earlyLeaveMinutes}`);
    console.log(`Note: ${result.note}`);

    // ตรวจสอบว่า scanPunches มีครบ 3 ตัว
    if (result.scanPunches?.length === 3) {
      console.log('✅ SUCCESS: scanPunches contains all 3 items.');
    } else {
      console.error(`❌ FAILED: scanPunches only has ${result.scanPunches?.length} items.`);
    }

    // ตรวจสอบ earlyLeaveMinutes
    // reportEnd (21:00 = 1260) - scanLastOut (13:00 = 780) = 480
    if (result.earlyLeaveMinutes === 480) {
      console.log('✅ SUCCESS: earlyLeaveMinutes is 480 (correctly calculated from 13:00).');
    } else {
      console.error(`❌ FAILED: earlyLeaveMinutes is ${result.earlyLeaveMinutes} (expected 480).`);
    }
  } catch (err) {
    console.error('Error during verification:', err);
  }
}

verify();
