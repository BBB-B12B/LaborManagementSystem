/**
 * Seed Wage Test Data Script
 * สคริปต์สำหรับสร้างข้อมูลจำลอง 10 คน เพื่อทดสอบระบบคำนวณค่าแรง (T-200)
 * 
 * Scenarios:
 * W01-W03: Normal (08:00-17:00)
 * W04: Late (In 08:30)
 * W05: OT Evening (17:00-20:00)
 * W06: OT Morning (05:00-08:00)
 * W07: Scan Only (No Daily Report)
 * W08: Report Only (No Scan)
 * W09: Early Out (Out 15:00)
 * W10: Multi-Task (2 tasks in one day)
 *
 * Usage:
 *   npx ts-node backend/scripts/seedWageTestData.ts
 */

import 'dotenv/config';
import admin from 'firebase-admin';

const seedActor = 'wage-mock-gen';
const PROJECT_ID = 'P001';
const SKILL_ID = 'SK-GEN';

const COLLECTIONS = {
    PROJECT_LOCATIONS: 'Project',
    DAILY_CONTRACTORS: 'dailyContractors',
    DC_INCOME_DETAILS: 'dcIncomeDetails',
    DC_EXPENSE_DETAILS: 'dcExpenseDetails',
    DAILY_REPORTS: 'dailyReports',
    SCAN_DATA: 'scanData',
    SKILLS: 'skills',
} as const;

async function initializeFirebase() {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-dev';

    // Windows compatibility for emulator
    if (process.platform === 'win32') {
        if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST.includes('firebase-emulator')) {
            process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
            process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
        }
    }

    if (!admin.apps.length) {
        admin.initializeApp({ projectId });
    }

    return { db: admin.firestore() };
}

function createTime(date: Date, hour: number, minute: number): Date {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d;
}

async function main() {
    const { db } = await initializeFirebase();
    console.log('🚀 Generating Mock Data for Wage Calculation (2026-01-01 to 2026-01-15)...');

    const now = new Date();
    const startDate = new Date('2026-01-01');

    // 1. Ensure Project Exists
    await db.collection(COLLECTIONS.PROJECT_LOCATIONS).doc(PROJECT_ID).set({
        code: 'P001',
        projectCode: 'SITE-A',
        projectName: 'โครงการทดสอบ A (Mock)',
        department: 'PD01',
        status: 'กำลังดำเนินการอยู่',
        isActive: true,
        startDate: admin.firestore.Timestamp.fromDate(new Date('2025-01-01')),
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: seedActor,
        updatedBy: seedActor,
    }, { merge: true });

    // 2. Ensure Skill Exists
    await db.collection(COLLECTIONS.SKILLS).doc(SKILL_ID).set({
        code: 'GEN',
        name: 'แรงงานทั่วไป (Mock)',
        baseHourlyRate: 350 / 8, // ~43.75
        isActive: true,
        createdAt: admin.firestore.Timestamp.fromDate(now),
    }, { merge: true });

    // 3. Create 10 Workers
    const workerIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
        const id = `MOCK_W${i.toString().padStart(2, '0')}`;
        const employeeId = `M${i.toString().padStart(5, '0')}`;
        workerIds.push(id);

        await db.collection(COLLECTIONS.DAILY_CONTRACTORS).doc(id).set({
            employeeId: employeeId,
            name: `คนงานจำลอง ${i}`,
            skillId: SKILL_ID,
            projectLocationIds: [PROJECT_ID],
            username: `mock_worker_${i}`,
            isActive: true,
            startDate: admin.firestore.Timestamp.fromDate(new Date('2025-12-01')),
            createdAt: admin.firestore.Timestamp.fromDate(now),
            updatedAt: admin.firestore.Timestamp.fromDate(now),
            createdBy: seedActor,
            updatedBy: seedActor,
        }, { merge: true });

        // Income Details
        await db.collection(COLLECTIONS.DAILY_CONTRACTORS).doc(id).collection('incomeDetails').doc('current').set({
            hourlyRate: 50, // 400 per day
            professionalRate: i % 3 === 0 ? 100 : 0, // Some get professional rate
            isActive: true,
            effectiveDate: admin.firestore.Timestamp.fromDate(new Date('2025-01-01')),
            createdAt: admin.firestore.Timestamp.fromDate(now),
            updatedAt: admin.firestore.Timestamp.fromDate(now),
            createdBy: seedActor,
            updatedBy: seedActor,
        }, { merge: true });
    }
    console.log('✅ Created 10 Mock Workers and Income Details');

    // 4. Generate Reports and Scans for each day
    const batch = db.batch();
    let reportCount = 0;
    let scanCount = 0;

    for (let d = 0; d < 15; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + d);
        const dateStr = currentDate.toISOString().split('T')[0];

        for (const workerId of workerIds) {
            const workerNum = parseInt(workerId.split('_W')[1]);

            // --- SCENARIOS ---

            // W01-W03: Normal
            if (workerNum <= 3) {
                // Report
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:00', '17:00', 'regular');
                reportCount++;
                // Scans
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 7, 55, 'regular_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 12, 5, 'lunch_out');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 12, 55, 'lunch_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 17, 5, 'regular_out');
                scanCount += 4;
            }
            // W04: Late
            else if (workerNum === 4) {
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:30', '17:00', 'regular');
                reportCount++;
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 8, 30, 'regular_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 17, 5, 'regular_out');
                scanCount += 2;
            }
            // W05: Normal + OT Evening
            else if (workerNum === 5) {
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:00', '17:00', 'regular');
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '17:00', '20:00', 'ot_evening');
                reportCount += 2;
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 7, 55, 'regular_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 20, 5, 'ot_evening');
                scanCount += 2;
            }
            // W06: OT Morning + Normal
            else if (workerNum === 6) {
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '05:00', '08:00', 'ot_morning');
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:00', '17:00', 'regular');
                reportCount += 2;
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 4, 55, 'ot_morning');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 17, 5, 'regular_out');
                scanCount += 2;
            }
            // W07: Scan Only (No Report)
            else if (workerNum === 7) {
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 7, 55, 'regular_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 17, 5, 'regular_out');
                scanCount += 2;
            }
            // W08: Report Only (No Scan)
            else if (workerNum === 8) {
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:00', '17:00', 'regular');
                reportCount++;
            }
            // W09: Early Out
            else if (workerNum === 9) {
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:00', '15:00', 'regular');
                reportCount++;
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 7, 55, 'regular_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 15, 5, 'regular_out');
                scanCount += 2;
            }
            // W10: Multi-Task
            else if (workerNum === 10) {
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '08:00', '12:00', 'regular', 'งานช่วงเช้า');
                addReport(batch, db, workerId, PROJECT_ID, currentDate, '13:00', '17:00', 'regular', 'งานช่วงบ่าย');
                reportCount += 2;
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 7, 55, 'regular_in');
                addScan(batch, db, workerId, PROJECT_ID, currentDate, 17, 5, 'regular_out');
                scanCount += 2;
            }
        }

        // Commit every 2 days to avoid batch limits (500)
        if (d % 2 === 0) {
            await batch.commit();
            console.log(`📡 Progress: Date ${dateStr} committed...`);
        }
    }

    await batch.commit();
    console.log(`\n✅ Finished Generating Data:`);
    console.log(`   • Total Daily Reports: ${reportCount}`);
    console.log(`   • Total Scan Records: ${scanCount}`);
    console.log('\n🎉 Ready for testing Wage Calculation!');
}

function addReport(batch: admin.firestore.WriteBatch, db: admin.firestore.Firestore, dcId: string, projectId: string, date: Date, start: string, end: string, type: string, task: string = 'งานก่อสร้างทั่วไป') {
    const ref = db.collection(COLLECTIONS.DAILY_REPORTS).doc();
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);

    const startTime = createTime(date, sH, sM);
    const endTime = createTime(date, eH, eM);

    // Calc hours (simplified logic for seed)
    let diff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    let net = diff;
    if (type === 'regular' && sH < 13 && eH > 12) {
        net -= 1;
    }

    batch.set(ref, {
        dailyContractorId: dcId,
        projectLocationId: projectId,
        workDate: admin.firestore.Timestamp.fromDate(date),
        startTime: admin.firestore.Timestamp.fromDate(startTime),
        endTime: admin.firestore.Timestamp.fromDate(endTime),
        workType: type,
        taskName: task,
        totalHours: diff,
        breakHours: type === 'regular' && sH < 13 && eH > 12 ? 1 : 0,
        netHours: net,
        status: 'submitted',
        isDeleted: false,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
        createdBy: seedActor,
        updatedBy: seedActor,
        version: 1
    });
}

function addScan(batch: admin.firestore.WriteBatch, db: admin.firestore.Firestore, dcId: string, projectId: string, date: Date, h: number, m: number, behavior: string) {
    const ref = db.collection(COLLECTIONS.SCAN_DATA).doc();
    const scanTime = createTime(date, h, m);

    // Round down to 5 mins
    const rounded = new Date(scanTime);
    rounded.setMinutes(Math.floor(m / 5) * 5, 0, 0);

    batch.set(ref, {
        dailyContractorId: dcId,
        employeeId: dcId.replace('MOCK_', ''),
        projectLocationId: projectId,
        scanDateTime: admin.firestore.Timestamp.fromDate(scanTime),
        scanBehavior: behavior,
        workDate: admin.firestore.Timestamp.fromDate(date),
        roundedTime: admin.firestore.Timestamp.fromDate(rounded),
        isLate: h > 8 || (h === 8 && m > 0),
        lateMinutes: h >= 8 ? (h - 8) * 60 + m : 0,
        hasDiscrepancy: false,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
        importedAt: admin.firestore.Timestamp.fromDate(new Date()),
        importedBy: seedActor,
        importBatchId: 'MOCK_BATCH_202601'
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    });
