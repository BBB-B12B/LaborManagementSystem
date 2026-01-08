/**
 * Firebase Emulator Seed Script
 * สคริปต์สำหรับสร้างข้อมูลจำลองใน Firebase Emulator Suite
 *
 * Usage:
 *   npm install            # ติดตั้ง dependency (ครั้งแรก)
 *   npx ts-node backend/scripts/seed-emulator.ts
 *
 * Options:
 *   --no-clean   ไม่ลบข้อมูลเดิมก่อน seed
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import bcrypt from 'bcrypt';

const DEFAULT_PROJECT_ID = 'labor-management-dev';
const DEFAULT_FIRESTORE_HOST = 'localhost:8080';
const DEFAULT_AUTH_HOST = 'localhost:9099';

const shouldSkipClean = process.argv.includes('--no-clean');
const seedActor = 'seed-script';

const COLLECTIONS = {
  ROLES: 'roles',
  USERS: 'users',
  SKILLS: 'skills',

  PROJECT_LOCATIONS: 'Project',
  DAILY_CONTRACTORS: 'dailyContractors',
  DC_INCOME_DETAILS: 'dcIncomeDetails',
  DC_EXPENSE_DETAILS: 'dcExpenseDetails',
} as const;

type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

function resolveDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function followerAccommodation(count: number): number {
  return count * 300;
}

async function initializeFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const firestoreHost =
    process.env.FIRESTORE_EMULATOR_HOST || DEFAULT_FIRESTORE_HOST;
  const authHost =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || DEFAULT_AUTH_HOST;

  process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
    console.log('🔥 Firebase Admin connected to emulators');
    console.log(`   • Project ID : ${projectId}`);
    console.log(`   • Firestore  : ${firestoreHost}`);
    console.log(`   • Auth       : ${authHost}`);
  }

  return {
    db: admin.firestore(),
  };
}

async function clearCollection(db: admin.firestore.Firestore, name: CollectionName) {
  const snapshot = await db.collection(name).get();
  if (snapshot.empty) {
    console.log(`   • ${name} (already empty)`);
    return;
  }

  const docs = snapshot.docs;
  const chunkSize = 400;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    docs
      .slice(i, i + chunkSize)
      .forEach((doc: admin.firestore.QueryDocumentSnapshot) => batch.delete(doc.ref));
    await batch.commit();
  }

  console.log(`   • ${name} (${docs.length} removed)`);
}

async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  return bcrypt.hash(password, rounds);
}

async function seedRoles(db: admin.firestore.Firestore) {
  const roles = [
    {
      id: 'AM',
      code: 'AM',
      name: 'ผู้ดูแลระบบ',
      nameEnglish: 'Admin',
      description: 'จัดการผู้ใช้งานและมีสิทธิ์เต็มในระบบ',
      level: 8,
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
        canAccessAllProjects: false,
        canAccessDepartmentProjects: false,
      },
    },
    {
      id: 'FM',
      code: 'FM',
      name: 'หัวหน้าคนงาน',
      nameEnglish: 'Foreman',
      description: 'บันทึก Daily Report และจัดการแรงงานรายวัน',
      level: 7,
      permissions: {
        canAccessDashboard: true,
        canCreateDailyReport: true,
        canEditDailyReport: true,
        canDeleteDailyReport: false,
        canAccessNewProject: false,
        canAccessMemberManagement: false,
        canAccessDCManagement: true,
        canAccessWageCalculation: false,
        canUploadScanData: false,
        canAccessAllProjects: false,
        canAccessDepartmentProjects: false,
      },
    },
    {
      id: 'SE',
      code: 'SE',
      name: 'วิศวกรประจำไซต์',
      nameEnglish: 'Site Engineer',
      description: 'บันทึก Daily Report และดูแลแรงงานภาคสนาม',
      level: 6,
      permissions: {
        canAccessDashboard: true,
        canCreateDailyReport: true,
        canEditDailyReport: true,
        canDeleteDailyReport: false,
        canAccessNewProject: false,
        canAccessMemberManagement: false,
        canAccessDCManagement: true,
        canAccessWageCalculation: false,
        canUploadScanData: false,
        canAccessAllProjects: false,
        canAccessDepartmentProjects: false,
      },
    },
  ];

  const createdAt = new Date();
  for (const role of roles) {
    await db.collection(COLLECTIONS.ROLES).doc(role.id).set({
      code: role.code,
      name: role.name,
      nameEnglish: role.nameEnglish,
      description: role.description,
      permissions: role.permissions,
      level: role.level,
      createdAt,
    });
  }
  console.log('✅ Seeded roles');
}

async function seedSkills(db: admin.firestore.Firestore) {
  const skills = [
    {
      id: 'skill-electrician',
      code: 'ELEC',
      name: 'ช่างไฟฟ้า',
      nameEnglish: 'Electrician',
      baseHourlyRate: 320,
    },
    {
      id: 'skill-construction',
      code: 'CONST',
      name: 'ช่างก่อสร้าง',
      nameEnglish: 'Construction Worker',
      baseHourlyRate: 280,
    },
    {
      id: 'skill-helper',
      code: 'HELPER',
      name: 'ผู้ช่วยทั่วไป',
      nameEnglish: 'General Helper',
      baseHourlyRate: 250,
    },
  ];

  const createdAt = new Date();
  for (const skill of skills) {
    await db.collection(COLLECTIONS.SKILLS).doc(skill.id).set({
      code: skill.code,
      name: skill.name,
      nameEnglish: skill.nameEnglish,
      baseHourlyRate: skill.baseHourlyRate,
      isActive: true,
      createdAt,
    });
  }
  console.log('✅ Seeded skills');
}

async function seedProjects(db: admin.firestore.Firestore) {
  const projects = [
    {
      id: 'P001',
      code: 'P001',
      projectName: 'อาคารสำนักงาน A',
      location: 'กรุงเทพฯ',
      department: 'PD01',
      status: 'active',
      projectManager: 'สมชาย หัวหน้าไซต์',
    },
    {
      id: 'P002',
      code: 'P002',
      projectName: 'โครงการคอนโด B',
      location: 'นนทบุรี',
      department: 'PD02',
      status: 'active',
      projectManager: 'นิศาชล วิศวกรไซต์',
    },
  ];

  for (const project of projects) {
    const now = new Date();
    await db.collection(COLLECTIONS.PROJECT_LOCATIONS).doc(project.id).set({
      code: project.code,
      projectName: project.projectName,
      location: project.location,
      department: project.department,
      projectManager: project.projectManager,
      startDate: resolveDate('2024-01-01'),
      endDate: null,
      status: project.status,
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: seedActor,
      updatedBy: seedActor,
    });
  }
  console.log('✅ Seeded project locations');
}

async function seedUsers(db: admin.firestore.Firestore) {
  const users = [
    {
      id: 'user-admin',
      employeeId: 'EMP001',
      username: 'admin',
      password: 'admin123',
      name: 'Admin User',
      roleId: 'AM',
      department: 'PD01',
      projectLocationIds: ['P001', 'P002'],
      startDate: '2023-01-02',
    },
  ];

  for (const user of users) {
    const now = new Date();
    const passwordHash = await hashPassword(user.password);
    await db.collection(COLLECTIONS.USERS).doc(user.id).set({
      employeeId: user.employeeId,
      username: user.username,
      passwordHash,
      name: user.name,
      roleId: user.roleId,
      department: user.department,
      dateOfBirth: null,
      startDate: resolveDate(user.startDate),
      projectLocationIds: user.projectLocationIds,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: seedActor,
      updatedBy: seedActor,
    });
  }
  console.log('✅ Seeded users (พร้อม hash password)');
}

async function seedDailyContractors(db: admin.firestore.Firestore) {
  const contractors = [
    {
      id: 'dc-ppp',
      employeeId: '101527',
      name: 'พรพจน์ ใจดี',
      skillId: 'skill-electrician',
      projectLocationIds: ['P001'],
      phoneNumber: '0812345678',
      emergencyContact: 'สมชาย ใจดี',
      emergencyPhone: '0899999999',
      startDate: '2024-01-15',
      hourlyRate: 320,
      professionalRate: 120,
      phoneAllowance: 200,
      accommodationCost: 300,
      followerCount: 4,
      equipmentCosts: {
        refrigeratorCost: 300,
        soundSystemCost: 30,
        tvCost: 30,
        washingMachineCost: 40,
        portableAcCost: 59,
      },
    },
    {
      id: 'dc-jane',
      employeeId: '101528',
      name: 'เจนจิรา ประทุม',
      skillId: 'skill-construction',
      projectLocationIds: ['P002'],
      phoneNumber: '0823456789',
      emergencyContact: 'จิตรา ประทุม',
      emergencyPhone: '0866666666',
      startDate: '2024-02-01',
      hourlyRate: 280,
      professionalRate: 90,
      phoneAllowance: 150,
      accommodationCost: 250,
      followerCount: 2,
      equipmentCosts: {
        refrigeratorCost: 0,
        soundSystemCost: 0,
        tvCost: 0,
        washingMachineCost: 25,
        portableAcCost: 45,
      },
    },
  ];

  for (const contractor of contractors) {
    const now = new Date();
    await db.collection(COLLECTIONS.DAILY_CONTRACTORS).doc(contractor.id).set({
      employeeId: contractor.employeeId,
      username: null,
      passwordHash: null,
      name: contractor.name,
      skillId: contractor.skillId,
      projectLocationIds: contractor.projectLocationIds,
      phoneNumber: contractor.phoneNumber,
      idCardNumber: null,
      address: null,
      emergencyContact: contractor.emergencyContact,
      emergencyPhone: contractor.emergencyPhone,
      isActive: true,
      startDate: resolveDate(contractor.startDate),
      endDate: null,
      createdAt: now,
      updatedAt: now,
      createdBy: seedActor,
      updatedBy: seedActor,
    });

    const effectiveDate = resolveDate(contractor.startDate);
    await db.collection(COLLECTIONS.DC_INCOME_DETAILS).doc(`${contractor.id}-income`).set({
      dailyContractorId: contractor.id,
      hourlyRate: contractor.hourlyRate,
      professionalRate: contractor.professionalRate,
      phoneAllowance: contractor.phoneAllowance,
      isActive: true,
      effectiveDate,
      createdAt: now,
      updatedAt: now,
      createdBy: seedActor,
      updatedBy: seedActor,
    });

    const followerCost = followerAccommodation(contractor.followerCount);
    await db.collection(COLLECTIONS.DC_EXPENSE_DETAILS).doc(`${contractor.id}-expense`).set({
      dailyContractorId: contractor.id,
      accommodationCost: contractor.accommodationCost,
      followerCount: contractor.followerCount,
      followerAccommodation: followerCost,
      refrigeratorCost: contractor.equipmentCosts.refrigeratorCost,
      soundSystemCost: contractor.equipmentCosts.soundSystemCost,
      tvCost: contractor.equipmentCosts.tvCost,
      washingMachineCost: contractor.equipmentCosts.washingMachineCost,
      portableAcCost: contractor.equipmentCosts.portableAcCost,
      isActive: true,
      effectiveDate,
      createdAt: now,
      updatedAt: now,
      createdBy: seedActor,
      updatedBy: seedActor,
    });
  }
  console.log('✅ Seeded daily contractors + compensation');
}

async function main() {
  const { db } = await initializeFirebase();

  if (!shouldSkipClean) {
    console.log('🧹 Clearing existing collections');
    const collectionsToClear: CollectionName[] = [
      COLLECTIONS.ROLES,
      COLLECTIONS.USERS,
      COLLECTIONS.SKILLS,
      COLLECTIONS.PROJECT_LOCATIONS,
      COLLECTIONS.DAILY_CONTRACTORS,
      COLLECTIONS.DC_INCOME_DETAILS,
      COLLECTIONS.DC_EXPENSE_DETAILS,
    ];

    for (const collectionName of collectionsToClear) {
      // eslint-disable-next-line no-await-in-loop
      await clearCollection(db, collectionName);
    }
  } else {
    console.log('⏭️  Skip cleaning existing data');
  }

  await seedRoles(db);
  await seedSkills(db);
  await seedProjects(db);
  await seedUsers(db);
  await seedDailyContractors(db);

  console.log('\n🎉 Firebase Emulator seeding completed successfully!');
  console.log('   • Login ด้วย admin/Admin123!');
  console.log('   • มีโครงการ, ทักษะ และแรงงานตัวอย่างพร้อมใช้งาน\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
