/**
 * Utility script to create or update a user account in Firebase (emulator or production).
 *
 * Usage:
 *   node scripts/create-user.js <username> <password> [name] [roleId] [employeeId] [department]
 *
 * Example (emulator via Docker):
 *   docker compose exec backend node scripts/create-user.js thiti.m 101527 "Thiti M" AM EMP101 PD01
 */

const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

const args = process.argv.slice(2);
const [username, password, nameArg, roleIdArg, employeeIdArg, departmentArg] = args;

if (!username || !password) {
  console.error('Usage: node scripts/create-user.js <username> <password> [name] [roleId] [employeeId] [department]');
  process.exit(1);
}

const displayName = nameArg || username;
const roleId = roleIdArg || 'AM';
const employeeId = employeeIdArg || `EMP${Date.now().toString().slice(-4)}`;
const department = departmentArg || 'PD01';
const projectLocationIds = [];

// Ensure we talk to emulator when NODE_ENV !== production
const useEmulator = process.env.NODE_ENV !== 'production';

if (!admin.apps.length) {
  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'firebase-emulator:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 'firebase-emulator:9099';

    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-dev',
    });
    console.log('[create-user] Connected to Firebase emulator');
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('[create-user] Connected to Firebase production project');
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function upsertAuthUser(email, uid) {
  try {
    const userRecord = await auth.getUser(uid);
    await auth.updateUser(uid, { email, password, displayName });
    console.log(`[create-user] Updated existing auth user (${uid})`);
    return userRecord;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }
  }

  try {
    const userRecord = await auth.createUser({
      uid,
      email,
      password,
      displayName,
    });
    console.log(`[create-user] Created auth user (${uid})`);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
      const existingUser = await auth.getUser(uid).catch(() => auth.getUserByEmail(email));
      await auth.updateUser(existingUser.uid, { password, displayName });
      console.log(`[create-user] Updated existing auth user (${existingUser.uid})`);
      return existingUser;
    }
    throw error;
  }
}

async function createOrUpdateUser() {
  try {
    const email = `${username}@labor-system.local`;
    const userId = username.replace(/[^a-zA-Z0-9_-]/g, '-');

    const authUser = await upsertAuthUser(email, userId);
    const passwordHash = await bcrypt.hash(password, 10);

    const userDoc = {
      employeeId,
      username,
      passwordHash,
      name: displayName,
      roleId,
      department,
      dateOfBirth: null,
      startDate: admin.firestore.Timestamp.now(),
      projectLocationIds,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'script:create-user',
      updatedBy: 'script:create-user',
    };

    await db.collection('users').doc(authUser.uid).set(userDoc, { merge: true });

    console.log(`\n[create-user] User created/updated successfully`);
    console.log(`  Username : ${username}`);
    console.log(`  Password : ${password}`);
    console.log(`  Name     : ${displayName}`);
    console.log(`  Role     : ${roleId}`);
    console.log(`  Employee : ${employeeId}`);
    console.log(`  Department: ${department}`);
    process.exit(0);
  } catch (error) {
    console.error('[create-user] Failed:', error);
    process.exit(1);
  }
}

createOrUpdateUser();
