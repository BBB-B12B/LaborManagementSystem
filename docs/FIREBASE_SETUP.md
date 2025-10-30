# Firebase Setup Guide

## Overview

Labor Management System ใช้ **Firebase** เป็น backend database และ authentication service

- **Project ID**: `employeemanagementsystem-dc2b4`
- **Database**: Cloud Firestore
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Storage

---

## Quick Start

### 1. สำหรับ Development (ใช้ Emulator)

```bash
# 1. Start Firebase Emulator
cd firebase
firebase emulators:start

# 2. Start Backend
cd backend
cp .env.example .env
npm run dev

# 3. Start Frontend
cd frontend
cp .env.example .env.local
npm run dev
```

**ข้อดี**: ไม่ต้องใช้ credentials, ข้อมูลไม่ไป production

### 2. สำหรับ Production (ใช้ Firebase Production)

```bash
# 1. Download Service Account Key
# - Go to: Firebase Console → Project Settings → Service Accounts
# - Click "Generate new private key"
# - Save as: backend/serviceAccountKey.json

# 2. Setup Backend .env
cd backend
cp .env.example .env
# แก้ไข .env:
NODE_ENV=production
FIREBASE_PROJECT_ID=employeemanagementsystem-dc2b4
# ใส่ service account key (see below)

# 3. Setup Frontend .env.local
cd frontend
cp .env.example .env.local
# ใช้ค่าเดิมจาก .env.example (already correct)
```

---

## Configuration Details

### Frontend Configuration

**ไฟล์**: `frontend/src/config/firebase.ts`

```typescript
const firebaseConfig = {
  apiKey: 'AIzaSyDEUDTXX-RPpfAHMP94BH4wPQLRKuBdFYo',
  authDomain: 'employeemanagementsystem-dc2b4.firebaseapp.com',
  projectId: 'employeemanagementsystem-dc2b4',
  storageBucket: 'employeemanagementsystem-dc2b4.firebasestorage.app',
  messagingSenderId: '349594161973',
  appId: '1:349594161973:web:db27af7499f50c087b727c',
  measurementId: 'G-J3PGPWH860',
};
```

**Environment Variables** (`frontend/.env.local`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDEUDTXX-RPpfAHMP94BH4wPQLRKuBdFYo
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=employeemanagementsystem-dc2b4.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=employeemanagementsystem-dc2b4
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=employeemanagementsystem-dc2b4.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=349594161973
NEXT_PUBLIC_FIREBASE_APP_ID=1:349594161973:web:db27af7499f50c087b727c
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-J3PGPWH860
```

### Backend Configuration

**ไฟล์**: `backend/src/config/firebase.ts`

**Development Mode** (uses emulator):
```env
NODE_ENV=development
FIREBASE_PROJECT_ID=employeemanagementsystem-dc2b4
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

**Production Mode** (uses service account):
```env
NODE_ENV=production
FIREBASE_PROJECT_ID=employeemanagementsystem-dc2b4
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"employeemanagementsystem-dc2b4",...}'
```

---

## Firebase Emulator Setup

### Installation

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not done)
cd firebase
firebase init
```

### Start Emulator

```bash
cd firebase
firebase emulators:start
```

**Emulator UI**: http://localhost:4001

**Ports**:
- Firestore: 8080
- Authentication: 9099
- Storage: 9199
- UI: 4001

### Import/Export Data

```bash
# Export data
firebase emulators:export ./backup

# Import data
firebase emulators:start --import=./backup
```

---

## Firestore Security Rules

**ไฟล์**: `firebase/firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roleCode == 'AM';
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Daily Contractors
    match /dailyContractors/{dcId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() &&
                     (isAdmin() ||
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roleCode == 'FM');
    }

    // Daily Reports
    match /dailyReports/{reportId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() &&
                               (isAdmin() ||
                                resource.data.createdBy == request.auth.uid);
    }

    // Other collections...
  }
}
```

---

## Firestore Indexes

**ไฟล์**: `firebase/firestore.indexes.json`

ระบบต้องการ composite indexes สำหรับ queries ที่ซับซ้อน:

```json
{
  "indexes": [
    {
      "collectionGroup": "dailyReports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectLocationId", "order": "ASCENDING" },
        { "fieldPath": "workDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "scanData",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "employeeNumber", "order": "ASCENDING" },
        { "fieldPath": "scanDate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deploy Indexes**:
```bash
firebase deploy --only firestore:indexes
```

---

## Service Account Setup (Production)

### 1. Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `employeemanagementsystem-dc2b4`
3. Go to: **Project Settings** → **Service Accounts**
4. Click: **Generate new private key**
5. Save file as: `backend/serviceAccountKey.json`

### 2. Use Service Account

**Option 1**: Environment Variable (Recommended for deployment)

```bash
# Read JSON file and convert to single-line string
cat backend/serviceAccountKey.json | tr -d '\n' > service-account-inline.txt

# Copy content and paste in .env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

**Option 2**: File Path (For local development)

```env
# In backend/.env
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

### 3. Security Best Practices

⚠️ **IMPORTANT**:
- ❌ **NEVER** commit `serviceAccountKey.json` to git
- ❌ **NEVER** commit `.env` to git
- ✅ **ALWAYS** use `.gitignore` to exclude sensitive files
- ✅ **ALWAYS** use environment variables in production

```bash
# Add to .gitignore
echo "serviceAccountKey.json" >> .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

---

## Usage Examples

### Frontend

```typescript
import { db, auth } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Get all users
const usersRef = collection(db, 'users');
const snapshot = await getDocs(usersRef);

// Query with filter
const q = query(
  collection(db, 'dailyReports'),
  where('projectLocationId', '==', 'project123')
);
const reports = await getDocs(q);

// Authentication
import { signInWithEmailAndPassword } from 'firebase/auth';
await signInWithEmailAndPassword(auth, email, password);
```

### Backend

```typescript
import { db, auth } from './config/firebase';

// Get document
const userDoc = await db.collection('users').doc(userId).get();
const userData = userDoc.data();

// Query collection
const snapshot = await db
  .collection('dailyReports')
  .where('projectLocationId', '==', projectId)
  .orderBy('workDate', 'desc')
  .limit(10)
  .get();

const reports = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));

// Create document
await db.collection('users').add({
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

// Authentication
const user = await auth.getUser(uid);
```

---

## Troubleshooting

### Error: "Firebase not initialized"

**Solution**: ตรวจสอบว่า environment variables ถูกต้อง

```bash
# Frontend
cat frontend/.env.local | grep FIREBASE

# Backend
cat backend/.env | grep FIREBASE
```

### Error: "PERMISSION_DENIED"

**Solutions**:
1. ตรวจสอบ Firestore Security Rules
2. ตรวจสอบว่า user authenticate แล้ว
3. ตรวจสอบว่า user มี role ที่เหมาะสม

### Error: "Cannot connect to emulator"

**Solutions**:
1. ตรวจสอบว่า emulator running: `firebase emulators:start`
2. ตรวจสอบ port ว่างหรือไม่: `lsof -i :8080`
3. ตรวจสอบ environment variables:
   ```bash
   FIRESTORE_EMULATOR_HOST=localhost:8080
   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
   ```

### Error: "Invalid service account"

**Solutions**:
1. Download service account key ใหม่
2. ตรวจสอบว่า JSON format ถูกต้อง
3. ตรวจสอบว่า project ID ตรงกัน

---

## Migration from Emulator to Production

```bash
# 1. Export data from emulator
firebase emulators:export ./emulator-data

# 2. Import to production (requires firebase-admin script)
# Create import script: scripts/import-to-production.js

# 3. Run import
node scripts/import-to-production.js
```

---

## Monitoring & Analytics

### Firebase Console
- **URL**: https://console.firebase.google.com/project/employeemanagementsystem-dc2b4
- **Features**:
  - Firestore data viewer
  - Authentication users list
  - Storage files browser
  - Analytics dashboard
  - Performance monitoring

### Logs
```bash
# Frontend logs (browser console)
# Backend logs (terminal)
npm run dev

# Production logs
firebase functions:log
```

---

## Cost Optimization

### Free Tier Limits (Spark Plan)
- **Firestore**: 1 GB storage, 50K reads/day, 20K writes/day
- **Authentication**: Unlimited
- **Storage**: 5 GB storage, 1 GB/day downloads

### Upgrade to Blaze Plan (Pay-as-you-go)
- Required for: Cloud Functions, increased quotas
- Pricing: https://firebase.google.com/pricing

---

## References

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Data Model](../specs/001-labor-daily-report/data-model.md)
- [Authorization Guide](./AUTHORIZATION.md)
- [Quick Start Guide](../specs/001-labor-daily-report/quickstart.md)
