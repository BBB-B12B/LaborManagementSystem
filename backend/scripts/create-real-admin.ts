
import 'dotenv/config';
import admin from 'firebase-admin';
import bcrypt from 'bcrypt';

async function main() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!projectId || !serviceAccountKey) {
        throw new Error('Missing FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY');
    }

    // force disabled emulator to ensure we talk to cloud
    process.env.FIRESTORE_EMULATOR_HOST = '';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '';
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

    console.log('--- Creating Real Admin User (GOD Mode) ---');
    console.log(`Target Project: ${projectId}`);

    // Parse Service Account
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountKey);
    } catch (e) {
        // Maybe path?
        serviceAccount = require(serviceAccountKey);
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId
        });
    }

    const db = admin.firestore();

    // 1. Create GOD Role
    const godRole = {
        code: 'GOD', // Custom role
        name: 'Super Admin',
        nameEnglish: 'God Mode',
        description: 'Full System Access',
        level: 99,
        permissions: {
            canAccessDashboard: true,
            canCreateDailyReport: true,
            canEditDailyReport: true,
            canDeleteDailyReport: true,
            canAccessNewProject: true,
            canAccessMemberManagement: true,
            canAccessDCManagement: true,
            canAccessWageCalculation: true,
            canUploadScanData: true,
            canAccessAllProjects: true,
            canAccessDepartmentProjects: true,
        },
        createdAt: new Date()
    };

    console.log(`Creating Role 'GOD'...`);
    await db.collection('roles').doc('GOD').set(godRole);
    console.log('✅ Role GOD created.');

    // 2. Create User
    const password = 'admin1';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'admin1';

    const user = {
        employeeId: userId,
        username: 'admin',
        passwordHash: hashedPassword,
        name: 'System Admin',
        roleId: 'GOD',
        department: 'HO',
        projectLocationIds: [],
        isActive: true,
        dateOfBirth: new Date('1990-01-01'),
        startDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system-setup',
        updatedBy: 'system-setup'
    };

    console.log(`Creating User 'admin' (ID: ${userId})...`);
    await db.collection('users').doc(userId).set(user);
    console.log(`✅ User 'admin' created.`);
    console.log(`   Username: admin`);
    console.log(`   Password: ${password}`);
    console.log(`   EmployeeID: ${userId}`);
    console.log('--- Setup Complete ---');
}

main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
