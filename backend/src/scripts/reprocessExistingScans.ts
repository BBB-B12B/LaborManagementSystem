import { COLLECTIONS } from '../config/collections';
import { db } from '../config/firebase';
import { ScanDataAggregator } from '../services/scanData/ScanDataAggregator';
import { BulkImportRecord } from '../services/scanData/ScanDataService';
import { logger } from '../utils/logger';
import { parse as parseDate } from 'date-fns';

/**
 * Reprocess all existing scan data to apply:
 * 1. 15-minute merge window
 * 2. Proper Bangkok timezone grouping
 */
async function reprocessScans() {
    console.log('Starting automated scan data reprocessing...');
    
    // 1. Fetch all scan data
    const snapshot = await db.collection(COLLECTIONS.SCAN_DATA)
        .where('isDeleted', '==', false)
        .get();
    
    console.log(`Found ${snapshot.size} records to reprocess.`);
    
    if (snapshot.empty) {
        console.log('No records found.');
        return;
    }

    // 2. Map of EmployeeNumber -> WorkDate -> Set of unique scan times
    // This allows us to re-group scans that were split across two days
    const employeeScans = new Map<string, Map<string, Set<Date>>>();
    const projectCodes = new Map<string, string>(); // employeeNumber -> projectCode

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const empNo = data.employeeNumber || data.employeeId;
        const projectCode = data.projectCode || '';
        if (projectCode) projectCodes.set(empNo, projectCode);

        // Collect timestamps from scanDateTime and allScans
        const times: Date[] = [];
        
        // Primary scan
        const primary = data.scanDateTime?.toDate ? data.scanDateTime.toDate() : (data.scanDateTime instanceof Date ? data.scanDateTime : null);
        if (primary && !isNaN(primary.getTime())) times.push(primary);
        
        // Secondary scans (HH:mm:ss)
        const allScans = data.allScans || [];
        const baseDate = data.workDate?.toDate ? data.workDate.toDate() : (data.workDate instanceof Date ? data.workDate : primary);
        
        if (baseDate) {
            allScans.forEach((timeStr: string) => {
                try {
                    const [h, m, s] = timeStr.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) {
                        const d = new Date(baseDate);
                        d.setHours(h, m, s || 0, 0);
                        times.push(d);
                    }
                } catch (e) {}
            });
        }

        // Add to global map
        if (!employeeScans.has(empNo)) employeeScans.set(empNo, new Map());
        const dateMap = employeeScans.get(empNo)!;

        times.forEach(t => {
            // Determine the CORRECT Bangkok date for this timestamp
            const correctDateStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Bangkok',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(t);

            if (!dateMap.has(correctDateStr)) dateMap.set(correctDateStr, new Set());
            dateMap.get(correctDateStr)!.add(t);
        });
    });

    console.log(`Grouped data for ${employeeScans.size} unique employees.`);

    // 3. Batch re-aggregation and saving
    let batch = db.batch();
    let operations = 0;
    const BATCH_LIMIT = 400;

    let totalUpdated = 0;
    let totalDeleted = 0;

    // Delete existing records in smaller batches (Limit 500)
    const allDocRefs = snapshot.docs.map(doc => doc.ref);
    for (let i = 0; i < allDocRefs.length; i += 500) {
        const delBatch = db.batch();
        const chunk = allDocRefs.slice(i, i + 500);
        chunk.forEach(ref => delBatch.delete(ref));
        await delBatch.commit();
        console.log(`Progress: Deleted ${i + chunk.length} records...`);
    }
    console.log(`Deleted ${snapshot.size} legacy records.`);

    // Re-aggregate and save (Batch size handled below)
    for (const [empNo, dateMap] of employeeScans.entries()) {
        const projectCode = projectCodes.get(empNo) || 'P001';
        const projectCodeSafe = projectCode.replace(/\//g, '-');

        for (const [dateStr, scanSet] of dateMap.entries()) {
            const scanTimes = Array.from(scanSet);
            const importRecords: BulkImportRecord[] = scanTimes.map(t => ({
                rowNumber: 0,
                employeeNumber: empNo,
                scanDateTime: t
            }));

            const aggregated = ScanDataAggregator.aggregate(importRecords);
            
            if (aggregated.length > 0) {
                const group = aggregated[0];
                const uniqueKey = `SCAN_${empNo}_${projectCodeSafe}_${dateStr}`;
                const docRef = db.collection(COLLECTIONS.SCAN_DATA).doc(uniqueKey);
                
                const workDate = new Date(dateStr);
                workDate.setHours(0, 0, 0, 0);

                const scanDateTime = scanTimes.length > 0 ? scanTimes[0] : workDate;

                const scanData: any = {
                    employeeId: empNo,
                    employeeNumber: empNo,
                    projectCode,
                    scanDate: dateStr,
                    workDate,
                    scanDateTime,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isDeleted: false,
                    Time1: group.time1 || '',
                    Time2: group.time2 || '',
                    Time3: group.time3 || '',
                    Time4: group.time4 || '',
                    Time5: group.time5 || '',
                    Time6: group.time6 || '',
                    Time7: group.time7 || '',
                    Time8: group.time8 || '',
                    Time9: group.time9 || '',
                    Time10: group.time10 || '',
                    allScans: group.allScans,
                    punches: group.punches,
                    normalStatus: group.normalStatus,
                    regularHours: group.regularHours,
                    lunchStatus: group.lunchStatus,
                    otMorningHours: group.otMorningHours,
                    otEveningHours: group.otEveningHours,
                    lateMinutes: group.lateMinutes
                };

                // Strip undefined properties
                Object.keys(scanData).forEach(k => {
                    if (scanData[k] === undefined) delete scanData[k];
                });

                batch.set(docRef, scanData);
                operations++;
                totalUpdated++;

                if (operations >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    operations = 0;
                    console.log(`Progress: Saved ${totalUpdated} reprocessed records...`);
                }
            }
        }
    }

    if (operations > 0) {
        await batch.commit();
    }

    console.log('--- Batch Reprocessing Complete ---');
    console.log(`Original Records: ${snapshot.size}`);
    console.log(`Reprocessed Records: ${totalUpdated}`);
    console.log('All existing scan data has been updated with the 15-minute logic and correct timezones.');
}

reprocessScans().catch(err => {
    console.error('Reprocessing failed:', err);
    process.exit(1);
});
