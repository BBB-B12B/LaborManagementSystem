import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
if (!admin.apps.length) {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp();
    }
}

import { matcherService } from '../services/reconciliation/MatcherService';

async function backfill() {
    const db = admin.firestore();
    console.log('Fetching existing scan data...');
    const scanQuery = await db.collection('scanData').where('isDeleted', '==', false).get();
    
    const uniqueRecords = new Set<string>();
    const tasks: {employeeNumber: string, dateStr: string, projectLocationId: string}[] = [];

    scanQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.employeeNumber && data.workDate && data.projectLocationId) {
            let dateStr = '';
            if (data.workDate.toDate) {
                const dateObj = data.workDate.toDate();
                dateStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            } else if (data.workDate instanceof Date) {
                dateStr = data.workDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            } else if (typeof data.workDate === 'string') {
                dateStr = data.workDate.split('T')[0];
            }
            
            if (dateStr) {
                const key = `${data.employeeNumber}_${dateStr}_${data.projectLocationId}`;
                if (!uniqueRecords.has(key)) {
                    uniqueRecords.add(key);
                    tasks.push({
                        employeeNumber: data.employeeNumber,
                        dateStr,
                        projectLocationId: data.projectLocationId
                    });
                }
            }
        }
    });

    console.log(`Found ${tasks.length} unique combinations to reconcile.`);
    
    let successCount = 0;
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        try {
            await matcherService.reconcile(t.employeeNumber, t.dateStr, t.projectLocationId);
            successCount++;
            if (successCount % 10 === 0) {
                console.log(`Processed ${successCount}/${tasks.length}...`);
            }
        } catch (e) {
            console.error(`Failed to reconcile ${t.employeeNumber} on ${t.dateStr}:`, e);
        }
    }
    
    console.log(`Finished! Reconciled ${successCount} records.`);
}

backfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
