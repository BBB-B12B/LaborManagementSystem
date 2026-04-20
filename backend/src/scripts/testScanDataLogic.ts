// @ts-nocheck
import { ScanData, classifyScanBehavior } from '../models/ScanData';
import { scanDataService } from '../services/scanData/ScanDataService';

async function runTest() {
    console.log('Testing ScanData Contextual Classification...');

    const baseDate = new Date('2026-03-12T00:00:00Z');

    // Scenario 1: Regular In/Out 08:00 - 17:00
    const scan1: ScanData = {
        id: 's1',
        dailyContractorId: 'dc1',
        employeeId: 'emp1',
        projectLocationId: 'p1',
        scanDateTime: new Date('2026-03-12T07:55:00Z'),
        scanBehavior: classifyScanBehavior(new Date('2026-03-12T07:55:00Z')),
        workDate: baseDate,
        roundedTime: new Date(),
        isLate: false,
        lateMinutes: 0,
        hasDiscrepancy: false,
        createdAt: new Date(),
        importedAt: new Date(),
        importedBy: 'test',
        importBatchId: 'b1'
    };

    const scan2: ScanData = {
        ...scan1,
        id: 's2',
        scanDateTime: new Date('2026-03-12T17:05:00Z'),
        scanBehavior: classifyScanBehavior(new Date('2026-03-12T17:05:00Z'))
    };

    let result = scanDataService.analyzeDailyScans([scan1, scan2]);
    console.log('Scenario 1 (08:00 - 17:00 => 8 hrs regular):', result);


    // Scenario 2: OT Morning + Regular In/Out 05:00 - 17:00
    const scan3: ScanData = {
        ...scan1,
        id: 's3',
        scanDateTime: new Date('2026-03-12T05:00:00Z'),
        scanBehavior: classifyScanBehavior(new Date('2026-03-12T05:00:00Z'))
    };

    result = scanDataService.analyzeDailyScans([scan3, scan1, scan2]);
    console.log('Scenario 2 (05:00-08:00, 08:00-17:00 => 3hr OT, 8hr Regular):', result);


    // Scenario 3: Regular In/Out + OT Evening 08:00 - 20:00
    const scan4: ScanData = {
        ...scan1,
        id: 's4',
        scanDateTime: new Date('2026-03-12T20:00:00Z'),
        scanBehavior: classifyScanBehavior(new Date('2026-03-12T20:00:00Z'))
    };

    result = scanDataService.analyzeDailyScans([scan1, scan2, scan4]);
    console.log('Scenario 3 (08:00-17:00, 17:00-20:00 => 8hr Regular, 3hr Evening OT):', result);

    // Scenario 4: Missed standard checkout, scanned out at 20:00 directly
    result = scanDataService.analyzeDailyScans([scan1, scan4]);
    console.log('Scenario 4 (08:00 IN, 20:00 OUT => 8hr Regular, 3hr Evening OT):', result);

}

runTest().catch(console.error);
