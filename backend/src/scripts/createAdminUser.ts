/**
 * createAdminUser.ts
 * Emergency script to recreate the GOD admin user in the users collection.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/createAdminUser.ts
 *
 * Customise USERNAME / PASSWORD / EMPLOYEE_ID below before running.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const EMPLOYEE_ID = 'ADM001';   // <- Firestore document ID (must be unique)
const USERNAME    = 'admin';    // <- login username (stored lowercase)
const PASSWORD    = 'Admin@123'; // <- plain-text password (will be bcrypt-hashed)
const NAME        = 'System Admin';
const DEPARTMENT  = 'HO';       // HO = Head Office
// ─────────────────────────────────────────────────────────────────────────────

// Force production — clear emulator vars loaded from .env
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function findGodRoleId(): Promise<string> {
  // Try 'GOD' role by roleCode field
  const snap = await db.collection('roles').where('roleCode', '==', 'GOD').limit(1).get();
  if (!snap.empty) {
    console.log(`✅ Found GOD role: ${snap.docs[0].id}`);
    return snap.docs[0].id;
  }

  // Fallback: first role in collection
  const all = await db.collection('roles').limit(5).get();
  if (!all.empty) {
    console.warn(`⚠️  No GOD role found — using first role: ${all.docs[0].id}`);
    all.docs.forEach(d => console.log(`   ${d.id}:`, JSON.stringify(d.data())));
    return all.docs[0].id;
  }

  // No roles at all — use placeholder
  console.warn('⚠️  roles collection is empty — using placeholder roleId "GOD"');
  return 'GOD';
}

async function main() {
  console.log('\n=== createAdminUser ===');
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}`);

  // 1. Check if user already exists
  const existing = await db.collection('users').doc(EMPLOYEE_ID).get();
  if (existing.exists) {
    console.log(`\n⚠️  User "${EMPLOYEE_ID}" already exists — aborting to avoid overwrite.`);
    console.log('   Data:', JSON.stringify(existing.data(), null, 2));
    return;
  }

  // 2. Resolve roleId
  const roleId = await findGodRoleId();

  // 3. Hash password
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  console.log(`🔑 Password hashed`);

  // 4. Build user document
  const now = admin.firestore.Timestamp.now();
  const userData = {
    id:                EMPLOYEE_ID,
    employeeId:        EMPLOYEE_ID,
    username:          USERNAME.trim().toLowerCase(),
    passwordHash,
    name:              NAME,
    fullNameEn:        NAME,
    roleId,
    department:        DEPARTMENT,
    startDate:         now,
    projectLocationIds: [],
    isActive:          true,
    createdAt:         now,
    updatedAt:         now,
    createdBy:         'system',
    updatedBy:         'system',
  };

  // 5. Write to Firestore
  await db.collection('users').doc(EMPLOYEE_ID).set(userData);
  console.log(`\n✅ Admin user created successfully!`);
  console.log(`   Document ID : ${EMPLOYEE_ID}`);
  console.log(`   Username    : ${USERNAME.toLowerCase()}`);
  console.log(`   Password    : ${PASSWORD}  ← change after first login`);
  console.log(`   Role ID     : ${roleId}`);
  console.log(`   Department  : ${DEPARTMENT}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
