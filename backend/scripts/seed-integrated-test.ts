/**
 * Integrated Wage Calculation Seed Script
 * สคริปต์สำหรับสร้างข้อมูลจำลองเพื่อทดสอบการคำนวณค่าแรงแบบบูรณาการ (T-230)
 *
 * Usage:
 *   npx ts-node backend/scripts/seed-integrated-test.ts
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import { format } from 'date-fns';

const seedActor = 'integrated-wage-seed';

const COLLECTIONS = {
    PROJECT_LOCATIONS: 'Project',
    DAILY_CONTRACTORS: 'dailyContractors',
    DC_INCOME_DETAILS: 'dcIncomeDetails',
    DC_EXPENSE_DETAILS: 'dcExpenseDetails',
    DAILY_REPORTS: 'dailyReports',
    SCAN_DATA: 'scanData',
    LATE_RECORDS: 'lateRecords',
    SKILLS: 'skills',
} as const;

async function initializeFirebase() {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06';
    const emulatorEnabled = process.env.FIREBASE_EMULATOR_ENABLED === 'true';

    if (emulatorEnabled) {
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
        console.log('🔥 Using Firestore Emulator');
        if (!admin.apps.length) {
            admin.initializeApp({ projectId });
        }
    } else {
        // Clear emulator env vars to force cloud connection
        delete process.env.FIRESTORE_EMULATOR_HOST;
        delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
        delete process.env.FIREBASE_EMULATOR_HOST;

        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required for production mode');
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        console.log('☁️ Using Production Firebase');
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId
            });
        }
    }

    return {
        db: admin.firestore(),
    };
}

async function main() {
    const { db } = await initializeFirebase();
    console.log('🚀 Starting Integrated Seed for Wage Calculation...');

    const now = new Date();
    const startDate = new Date('2024-02-16');

    // 1. Get existing project or use a default
    const projectsSnapshot = await db.collection(COLLECTIONS.PROJECT_LOCATIONS).limit(1).get();
    if (projectsSnapshot.empty) {
        console.log('❌ No project found. Please ensure at least one project exists.');
        return;
    }
    const project = projectsSnapshot.docs[0];
    const projectId = project.id;
    console.log(`📍 Using Project: ${project.data().projectName} (${projectId})`);

    // 2. Get existing 10 DCs
    const dcsSnapshot = await db.collection(COLLECTIONS.DAILY_CONTRACTORS).limit(10).get();
    if (dcsSnapshot.empty) {
        console.log('❌ No contractors found.');
        return;
    }
    const dcs = dcsSnapshot.docs;
    console.log(`👷 Found ${dcs.length} contractors to seed.`);

    // 3. Ensure Income/Expense Details exist for these DCs
    for (const dcDoc of dcs) {
        const dcId = dcDoc.id;
        const incomeRef = db.collection(COLLECTIONS.DC_INCOME_DETAILS).doc(`${dcId}-income`);
        const incomeSnap = await incomeRef.get();
        if (!incomeSnap.exists) {
            await incomeRef.set({
                dailyContractorId: dcId,
                hourlyRate: 50 + Math.random() * 20, // 50-70 THB/hr
                professionalRate: 100,
                phoneAllowance: 0,
                isActive: true,
                effectiveDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
                createdAt: admin.firestore.Timestamp.fromDate(now),
                updatedAt: admin.firestore.Timestamp.fromDate(now),
                createdBy: seedActor,
            });
        }

        const expenseRef = db.collection(COLLECTIONS.DC_EXPENSE_DETAILS).doc(`${dcId}-expense`);
        const expenseSnap = await expenseRef.get();
        if (!expenseSnap.exists) {
            await expenseRef.set({
                dailyContractorId: dcId,
                accommodationCost: 0,
                followerCount: 0,
                isActive: true,
                effectiveDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
                createdAt: admin.firestore.Timestamp.fromDate(now),
                updatedAt: admin.firestore.Timestamp.fromDate(now),
                createdBy: seedActor,
            });
        }
    }
    console.log('✅ Ensured Income/Expense details for all 10 DCs.');

    // 4. Create Daily Reports and Scan Data for 15 days
    const batchSize = 400;
    let batch = db.batch();
    let count = 0;

    for (let d = 0; d < 15; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + d);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        for (let i = 0; i < dcs.length; i++) {
            const dc = dcs[i];
            const dcId = dc.id;
            const employeeNumber = dc.data().employeeId;

            // Scenario Logic:
            // i=0: Normal
            // i=1: Late (Scan at 08:16)
            // i=2: Discrepancy (Report exists, Scan missing)
            // i=3: Discrepancy (Scan exists, Report missing)
            // i=4: Hour Mismatch (Report 8h, Scan calculates to 6h)
            // i>4: Alternating or Normal

            let createReport = true;
            let createScan = true;
            let scanInTime = '08:00';
            let scanOutTime = '17:00';
            let reportHours = 8;

            if (i === 1 && d % 3 === 0) {
                scanInTime = '08:16'; // Late
            } else if (i === 2 && d % 5 === 0) {
                createScan = false; // Missing Scan
            } else if (i === 3 && d % 5 === 0) {
                createReport = false; // Missing Report
            } else if (i === 4 && d % 4 === 0) {
                scanOutTime = '15:00'; // 6h vs 8h
            }

            // Create Daily Report
            if (createReport) {
                const reportRef = db.collection(COLLECTIONS.DAILY_REPORTS).doc();
                batch.set(reportRef, {
                    dailyContractorId: dcId,
                    projectLocationId: projectId,
                    reportDate: admin.firestore.Timestamp.fromDate(currentDate),
                    workType: 'regular',
                    startTime: '08:00',
                    endTime: '17:00',
                    breakHours: 1,
                    totalHours: 9,
                    netHours: reportHours,
                    status: 'approved',
                    createdAt: admin.firestore.Timestamp.fromDate(now),
                    createdBy: seedActor,
                });
                count++;
            }

            // Create Scan Data
            if (createScan) {
                const inTime = new Date(currentDate);
                const [hIn, mIn] = scanInTime.split(':').map(Number);
                inTime.setHours(hIn, mIn, 0, 0);

                const outTime = new Date(currentDate);
                const [hOut, mOut] = scanOutTime.split(':').map(Number);
                outTime.setHours(hOut, mOut, 0, 0);

                // IN Scan
                const scanInRef = db.collection(COLLECTIONS.SCAN_DATA).doc(`${dcId}_${dateStr}_in`);
                batch.set(scanInRef, {
                    employeeNumber: employeeNumber,
                    dailyContractorId: dcId,
                    projectLocationId: projectId,
                    scanDateTime: admin.firestore.Timestamp.fromDate(inTime),
                    workDate: admin.firestore.Timestamp.fromDate(currentDate),
                    scanType: hIn < 12 ? 'regular_in' : 'regular_out',
                    isLate: hIn > 8 || (hIn === 8 && mIn > 0),
                    lateMinutes: hIn > 8 || (hIn === 8 && mIn > 0) ? (hIn * 60 + mIn) - (8 * 60) : 0,
                    importBatchId: 'seed-batch-001',
                    createdAt: admin.firestore.Timestamp.fromDate(now),
                });

                // OUT Scan
                const scanOutRef = db.collection(COLLECTIONS.SCAN_DATA).doc(`${dcId}_${dateStr}_out`);
                batch.set(scanOutRef, {
                    employeeNumber: employeeNumber,
                    dailyContractorId: dcId,
                    projectLocationId: projectId,
                    scanDateTime: admin.firestore.Timestamp.fromDate(outTime),
                    workDate: admin.firestore.Timestamp.fromDate(currentDate),
                    scanType: 'regular_out',
                    isLate: false,
                    lateMinutes: 0,
                    importBatchId: 'seed-batch-001',
                    createdAt: admin.firestore.Timestamp.fromDate(now),
                });
                count += 2;
            }

            if (count >= batchSize) {
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }
    }

    await batch.commit();
    console.log('✅ Created 15 days of Reports and Scan Data with variations.');
    console.log('\n🎉 Seed completed! Test with:');
    console.log(`   • Date Range: 2024-02-16 to 2024-02-28`);
    console.log('   • Scenario 1 (Late): Employee in row 2 (index 1)');
    console.log('   • Scenario 2 (Missing Scan): Employee in row 3 (index 2)');
    console.log('   • Scenario 3 (Missing Report): Employee in row 4 (index 3)');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    });
