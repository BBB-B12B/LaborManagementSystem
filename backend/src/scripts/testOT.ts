
import { ScanDataAggregator } from '../services/scanData/ScanDataAggregator';

function createRecord(emp: string, timeStr: string) {
  const dateStr = '2025-08-25';
  const scanDateTime = new Date(`${dateStr}T${timeStr}`);
  return {
    rowNumber: 1,
    employeeNumber: emp,
    scanDateTime
  };
}

async function test() {
  const scenarios = [
    { name: 'Regular Out (17:55)', times: ['08:00:00', '17:55:33'], expectedOT: 0 },
    { name: 'Regular Out (18:00)', times: ['08:00:00', '18:00:00'], expectedOT: 0 },
    { name: 'Just under 0.5 OT (18:29)', times: ['08:00:00', '18:29:59'], expectedOT: 0 },
    { name: 'Exactly 0.5 OT (18:30)', times: ['08:00:00', '18:30:00'], expectedOT: 0.5 },
    { name: 'Exactly 1.0 OT (19:00)', times: ['08:00:00', '19:00:00'], expectedOT: 1.0 },
    { name: 'Split Scan (17:05, 18:35)', times: ['08:00:00', '17:05:00', '18:35:00'], expectedOT: 0.5 },
  ];

  for (const s of scenarios) {
    const records = s.times.map(t => createRecord('411000', t));
    const results = ScanDataAggregator.aggregate(records);
    const ot = results[0].otEveningHours;
    console.log(`${s.name}: Result OT = ${ot}, Match = ${ot === s.expectedOT}`);
  }
}

test().catch(console.error);
