import { ScanDataAggregator } from './src/services/scanData/ScanDataAggregator';
import { BulkImportRecord } from './src/services/scanData/ScanDataService';

async function test() {
  console.log('Testing ScanDataAggregator logic...');

  // Test 1: Deduplication logic (07:02 and 07:11)
  const baseDate = new Date('2025-09-08T00:00:00Z'); // 7 AM Bangkok is 00:00 UTC
  const records: BulkImportRecord[] = [
    {
      rowNumber: 1,
      employeeNumber: '201607',
      scanDateTime: new Date('2025-09-08T00:02:00Z'), // 07:02 Bangkok
    },
    {
      rowNumber: 2,
      employeeNumber: '201607',
      scanDateTime: new Date('2025-09-08T00:11:00Z'), // 07:11 Bangkok
    },
    {
      rowNumber: 3,
      employeeNumber: '201607',
      scanDateTime: new Date('2025-09-08T10:00:00Z'), // 17:00 Bangkok
    }
  ];

  const result = ScanDataAggregator.aggregate(records);
  console.log('\n--- Test 1 Aggregation Result ---');
  console.log(`Employee: ${result[0].employeeNumber}, Date: ${result[0].workDate}`);
  console.log(`Time1: ${result[0].time1}`);
  console.log(`Time2: ${result[0].time2}`);
  console.log(`Time3: ${result[0].time3}`);
  console.log(`Punches: ${result[0].punches.join(', ')}`);

  // Verification 1
  if (result[0].time1 === '07:11:00' && result[0].time2 === '17:00:00') {
    console.log('✅ PASS: Scans merged correctly (07:02 & 07:11 -> 07:11)');
  } else {
    console.log('❌ FAIL: Scans not merged correctly');
  }

  // Test 2: Timezone logic (Early morning 05:52 AM)
  // 05:52 AM Bangkok is 22:52 UTC on the PREVIOUS day.
  const earlyRecord: BulkImportRecord[] = [
    {
      rowNumber: 4,
      employeeNumber: '201572',
      scanDateTime: new Date('2025-09-07T22:52:00Z'), // 05:52 AM Sept 8 Bangkok
    }
  ];

  const result2 = ScanDataAggregator.aggregate(earlyRecord);
  console.log('\n--- Test 2 Aggregation Result ---');
  console.log(`Employee: ${result2[0].employeeNumber}, Date: ${result2[0].workDate}`);
  console.log(`Time1: ${result2[0].time1}`);

  // Verification 2
  if (result2[0].workDate === '2025-09-08') {
    console.log('✅ PASS: Timezone grouping correct (UTC 22:52 -> Bangkok 2025-09-08)');
  } else {
    console.log('❌ FAIL: Timezone grouping failed');
  }
}

test().catch(console.error);
