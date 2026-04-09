import { db } from '../config/firebase';
import { collections } from '../config/collections';
import { scanDataService } from '../services/scanData/ScanDataService';

/**
 * Optimized re-triggering of discrepancy detection.
 * Calls detectDiscrepancies once per project for the entire date range.
 */
async function retriggerDiscrepancies() {
    console.log('Starting optimized historical discrepancy detection...');

    try {
        const scanSnapshot = await db.collection('scanData').get();
        console.log(`Found ${scanSnapshot.size} total scan records.`);

        const projectRangeMap = new Map<string, { min: Date; max: Date }>();

        scanSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const projectId = data.projectLocationId;
            const workDateRaw = data.workDate;
            
            if (!projectId || !workDateRaw) return;

            let workDate: Date;
            if (workDateRaw instanceof Date) {
                workDate = workDateRaw;
            } else if (workDateRaw && typeof workDateRaw.toDate === 'function') {
                workDate = workDateRaw.toDate();
            } else {
                workDate = new Date(workDateRaw);
            }
            
            if (isNaN(workDate.getTime())) return;

            if (!projectRangeMap.has(projectId)) {
                projectRangeMap.set(projectId, { min: new Date(workDate), max: new Date(workDate) });
            } else {
                const range = projectRangeMap.get(projectId)!;
                if (workDate < range.min) range.min = new Date(workDate);
                if (workDate > range.max) range.max = new Date(workDate);
            }
        });

        console.log(`Found ${projectRangeMap.size} projects to re-process.`);

        let totalCreated = 0;

        for (const [projectId, range] of projectRangeMap.entries()) {
            console.log(`Processing Project: ${projectId} from ${range.min.toISOString().split('T')[0]} to ${range.max.toISOString().split('T')[0]}`);
            
            try {
                const result = await scanDataService.detectDiscrepancies(
                    projectId,
                    range.min,
                    range.max,
                    'system-migration-optimized'
                );
                
                totalCreated += result.discrepanciesCreated;
                console.log(`Done: Found/Created ${result.discrepanciesCreated} discrepancies for ${projectId}`);
            } catch (err) {
                console.error(`Failed to process ${projectId}:`, err);
            }
        }

        console.log('--- RE-DETECTION COMPLETE ---');
        console.log(`Total Discrepancies Found/Created: ${totalCreated}`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

retriggerDiscrepancies();
