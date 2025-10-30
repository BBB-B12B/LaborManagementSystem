/**
 * Create Admin User Script
 * สคริปต์สร้าง Admin user สำหรับทดสอบระบบ
 *
 * Usage: node scripts/create-admin.js
 */

const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const useEmulator = process.env.NODE_ENV === 'development';

  if (useEmulator) {
    // Use Firebase Emulator (use container name inside Docker network)
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || 'firebase-emulator:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 'firebase-emulator:9099';

    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'employeemanagementsystem-dc2b4',
    });

    console.log('✅ Connected to Firebase Emulator');
    console.log('   Firestore:', process.env.FIRESTORE_EMULATOR_HOST);
    console.log('   Auth:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  } else {
    // Use production Firebase
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });

    console.log('✅ Connected to Firebase Production');
  }
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Create admin user
 */
async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...\n');

    // Admin user data
    const username = 'admin';
    const password = 'Admin123!';
    const email = 'admin@labor-system.local';
    const employeeId = 'EMP001';

    // 1. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    // 2. Create Firebase Auth user
    let authUser;
    try {
      authUser = await auth.createUser({
        email,
        password,
        displayName: 'Admin User',
      });
      console.log('✅ Firebase Auth user created:', authUser.uid);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        // Get existing user
        authUser = await auth.getUserByEmail(email);
        console.log('⚠️  Firebase Auth user already exists:', authUser.uid);
      } else {
        throw error;
      }
    }

    // 3. Create Firestore user document (matching User Model)
    const userDoc = {
      employeeId,
      username,
      passwordHash: hashedPassword,
      name: 'Admin User',
      roleId: 'role-admin', // Admin role ID
      department: 'PD01',
      dateOfBirth: null,
      startDate: admin.firestore.Timestamp.now(),
      projectLocationIds: [],
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      updatedBy: 'system',
    };

    await db.collection('users').doc(authUser.uid).set(userDoc);
    console.log('✅ Firestore user document created');

    // 4. Print credentials
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Admin user created successfully!');
    console.log('='.repeat(50));
    console.log('\n📋 Login Credentials:');
    console.log('  Username: ', username);
    console.log('  Password: ', password);
    console.log('  Email:    ', email);
    console.log('  Role:     ', 'Admin (AM)');
    console.log('\n🌐 Login at:');
    console.log('  http://localhost:3000/login');
    console.log('\n' + '='.repeat(50) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser();
