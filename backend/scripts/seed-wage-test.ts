/**
 * Wage Test Seed Script
 * สคริปต์สำหรับสร้างข้อมูลจำลองเพื่อทดสอบระบบคำนวณค่าแรง (T-170)
 *
 * Usage:
 *   npx ts-node backend/scripts/seed-wage-test.ts
 */

import 'dotenv/config';
import admin from 'firebase-admin';

const seedActor = 'wage-test-seed';

const COLLECTIONS = {
    PROJECT_LOCATIONS: 'Project',
    DAILY_CONTRACTORS: 'dailyContractors',
    DC_INCOME_DETAILS: 'dcIncomeDetails',
    DC_EXPENSE_DETAILS: 'dcExpenseDetails',
    DAILY_REPORTS: 'dailyReports',
    LATE_RECORDS: 'lateRecords',
    SKILLS: 'skills',
} as const;

async function initializeFirebase() {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-dev';

    // ปรับเปลี่ยน Host ถ้าเป็นการรันจากเครื่อง Windows (Host Machine)
    if (process.platform === 'win32') {
        if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST.includes('firebase-emulator')) {
            process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
            process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
        }
    }

    // ตรวจสอบว่าใช้ Emulator หรือไม่
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        console.log(`🔥 Using Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    }

    if (!admin.apps.length) {
        admin.initializeApp({ projectId });
    }

    return {
        db: admin.firestore(),
    };
}

async function main() {
    const { db } = await initializeFirebase();
    console.log('🚀 Starting Seed for Wage Calculation Test...');

    const now = new Date();
    const startDate = new Date('2024-01-01');

    // 1. Create Project
    const projectId = 'TEST-SITE-001';
    await db.collection(COLLECTIONS.PROJECT_LOCATIONS).doc(projectId).set({
        code: 'TEST001',
        projectName: 'อาคารทดสอบระบบ (TEST)',
        location: 'กรุงเทพฯ',
        department: 'TEST-DEPT',
        projectManager: 'ผู้จัดการทดสอบ',
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
        status: 'active',
        isActive: true,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: seedActor,
        updatedBy: seedActor,
    });
    console.log('✅ Created Project: TEST-SITE-001');

    // 2. Create Skill (ถ้ายังไม่มี)
    const skillId = 'skill-test-elec';
    await db.collection(COLLECTIONS.SKILLS).doc(skillId).set({
        code: 'TEST-ELEC',
        name: 'ช่างไฟฟ้า (ทดสอบ)',
        nameEnglish: 'Electrician (Test)',
        baseHourlyRate: 320,
        isActive: true,
        createdAt: admin.firestore.Timestamp.fromDate(now),
    });

    // 3. Create Daily Contractor
    const dcId = 'TEST-DC-999';
    const employeeId = '999001';
    await db.collection(COLLECTIONS.DAILY_CONTRACTORS).doc(dcId).set({
        employeeId: employeeId,
        name: 'นายทดสอบ ระบบดี',
        skillId: skillId,
        projectLocationIds: [projectId],
        phoneNumber: '0990000000',
        isActive: true,
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: seedActor,
        updatedBy: seedActor,
    });
    console.log(`✅ Created Daily Contractor: ${employeeId}`);

    // 4. Create Compensation (Income/Expense Details)
    await db.collection(COLLECTIONS.DC_INCOME_DETAILS).doc(`${dcId}-income`).set({
        dailyContractorId: dcId,
        hourlyRate: 62.5, // 500 บาท / 8 ชม.
        professionalRate: 200, // ค่าวิชาชีพต่อวัน
        phoneAllowance: 100,
        isActive: true,
        effectiveDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: seedActor,
        updatedBy: seedActor,
    });

    await db.collection(COLLECTIONS.DC_EXPENSE_DETAILS).doc(`${dcId}-expense`).set({
        dailyContractorId: dcId,
        accommodationCost: 300,
        followerCount: 0,
        followerAccommodation: 0,
        refrigeratorCost: 0,
        soundSystemCost: 0,
        tvCost: 0,
        washingMachineCost: 0,
        portableAcCost: 0,
        isActive: true,
        effectiveDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        createdBy: seedActor,
        updatedBy: seedActor,
    });
    console.log('✅ Created Compensation Details');

    // 5. Create Daily Reports for 15 days
    const batch = db.batch();
    for (let d = 0; d < 15; d++) {
        const reportDate = new Date(startDate);
        reportDate.setDate(startDate.getDate() + d);

        const reportRef = db.collection(COLLECTIONS.DAILY_REPORTS).doc();
        batch.set(reportRef, {
            dailyContractorId: dcId,
            projectLocationId: projectId,
            reportDate: admin.firestore.Timestamp.fromDate(reportDate),
            workType: 'regular',
            startTime: '08:00',
            endTime: '17:00',
            breakHours: 1,
            totalHours: 9,
            netHours: 8,
            status: 'approved',
            createdAt: admin.firestore.Timestamp.fromDate(now),
            createdBy: seedActor,
        });
    }
    await batch.commit();
    console.log('✅ Created 15 Daily Reports (8h/day)');

    // 6. Create one Late Record
    const lateDate = new Date('2024-01-05');
    await db.collection(COLLECTIONS.LATE_RECORDS).doc().set({
        dailyContractorId: dcId,
        wagePeriodId: 'MOCK_PERIOD', // จะถูกเชื่อมโยงทีหลังเมื่อสร้างงวดค่าแรง
        lateDate: admin.firestore.Timestamp.fromDate(lateDate),
        scanTime: '08:15',
        lateMinutes: 15,
        lateDeduction: 50,
        includedInWageCalculation: true,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.fromDate(now),
    });
    console.log('✅ Created 1 Late Record (Deduction: 50)');

    console.log('\n🎉 Seed completed! You can now test wage calculation for:');
    console.log(`   • Project: อาคารทดสอบระบบ (TEST)`);
    console.log(`   • Date Range: 2024-01-01 to 2024-01-15`);
    console.log(`   • Contractor: นายทดสอบ ระบบดี (${employeeId})\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    });
