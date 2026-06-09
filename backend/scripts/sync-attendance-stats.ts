import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { db } from '../src/config/firebase';

async function main() {
  console.log('🔄 Starting Attendance Stats Synchronization...');

  // 1. Fetch all Daily Contractors
  const dcSnapshot = await db.collection('dailyContractors').get();
  
  if (dcSnapshot.empty) {
    console.log('No daily contractors found. Exiting.');
    return;
  }

  console.log(`Found ${dcSnapshot.size} contractors. Processing...`);

  // 2. We will look through wagePeriods to aggregate stats
  const wagePeriodsSnapshot = await db.collection('wagePeriods').get();
  const wagePeriods: any[] = wagePeriodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 3. Fetch all reconciliationRecords
  const recSnapshot = await db.collection('reconciliationRecords').get();
  const allRecords = recSnapshot.docs.map(doc => doc.data());

  let processedCount = 0;

  for (const dcDoc of dcSnapshot.docs) {
    const dcId = dcDoc.id;
    const dcData = dcDoc.data();

    const attendanceStats: any = {
      yearly: {},
      periods: {}
    };

    // Find all summaries for this DC across all periods
    // First, process reconciliation records to ensure we capture all late/absent data even if wage period not yet generated
    const dcRecords = allRecords.filter(r => r.employeeId === dcId || r.employeeId === dcData.employeeId);
    
    dcRecords.forEach(r => {
      if (!r.workDate) return;
      
      const yearStr = r.workDate.substring(0, 4);
      const monthStr = r.workDate.substring(5, 7);
      const dayInt = parseInt(r.workDate.substring(8, 10), 10);
      const periodSuffix = dayInt <= 15 ? 'P1' : 'P2';
      const periodCode = `${yearStr}${monthStr}-${periodSuffix}`;
      
      // Initialize yearly
      if (!attendanceStats.yearly[yearStr]) {
        attendanceStats.yearly[yearStr] = { paidLeave: 0, unpaidLeave: 0, lateMinutes: 0, earlyLeaveMinutes: 0, absentDays: 0 };
      }
      
      // Initialize period
      if (!attendanceStats.periods[periodCode]) {
        const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
        const name = periodSuffix === 'P1' 
          ? `01/${monthStr}/${yearStr} - 15/${monthStr}/${yearStr}`
          : `16/${monthStr}/${yearStr} - ${lastDay}/${monthStr}/${yearStr}`;
          
        attendanceStats.periods[periodCode] = { name, paidLeave: 0, unpaidLeave: 0, lateMinutes: 0, earlyLeaveMinutes: 0, absentDays: 0 };
      }
      
      // Accumulate
      if (r.isLate) {
        attendanceStats.yearly[yearStr].lateMinutes += (r.lateMinutes || 0);
        attendanceStats.periods[periodCode].lateMinutes += (r.lateMinutes || 0);
      }
      
      if (r.isEarlyLeave) {
        attendanceStats.yearly[yearStr].earlyLeaveMinutes += (r.earlyLeaveMinutes || 0);
        attendanceStats.periods[periodCode].earlyLeaveMinutes += (r.earlyLeaveMinutes || 0);
      }
      
      if (r.status === 'ABSENT') {
        attendanceStats.yearly[yearStr].absentDays++;
        attendanceStats.periods[periodCode].absentDays++;
      }
    });

    // Then overlay paid/unpaid leave from wage period summaries
    for (const period of wagePeriods) {
      if (!period.dcSummaries) continue;

      const summary = period.dcSummaries.find((s: any) => s.dailyContractorId === dcId);
      if (!summary) continue;

      const periodCode = period.periodCode || '';
      const year = periodCode.substring(0, 4);

      if (!year) continue;

      // Ensure initialized
      if (!attendanceStats.yearly[year]) {
        attendanceStats.yearly[year] = { paidLeave: 0, unpaidLeave: 0, lateMinutes: 0, earlyLeaveMinutes: 0, absentDays: 0 };
      }
      if (!attendanceStats.periods[periodCode]) {
        const monthStr = periodCode.substring(4, 6);
        const periodSuffix = periodCode.substring(7, 9);
        const lastDay = new Date(parseInt(year), parseInt(monthStr), 0).getDate();
        const name = periodSuffix === 'P1' 
          ? `01/${monthStr}/${year} - 15/${monthStr}/${year}`
          : `16/${monthStr}/${year} - ${lastDay}/${monthStr}/${year}`;
        attendanceStats.periods[periodCode] = { name, paidLeave: 0, unpaidLeave: 0, lateMinutes: 0, earlyLeaveMinutes: 0, absentDays: 0 };
      }

      const paidLeave = summary.paidLeaveDays || 0;
      const unpaidLeave = summary.unpaidLeaveDays || 0;

      attendanceStats.yearly[year].paidLeave += paidLeave;
      attendanceStats.yearly[year].unpaidLeave += unpaidLeave;
      
      attendanceStats.periods[periodCode].paidLeave += paidLeave;
      attendanceStats.periods[periodCode].unpaidLeave += unpaidLeave;
    }

    // Update the DB
    await db.collection('dailyContractors').doc(dcId).update({
      attendanceStats
    });

    processedCount++;
    process.stdout.write(`\rProgress: ${processedCount}/${dcSnapshot.size}`);
  }

  console.log('\n✅ Attendance Stats Synchronization Completed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error during synchronization:', err);
  process.exit(1);
});
