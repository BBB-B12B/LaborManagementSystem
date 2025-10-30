# Labor Management System - Backend

Express.js backend API for the Labor Management System.

## Technology Stack

- **Framework**: Express.js with TypeScript
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK
- **File Storage**: Cloudflare R2 (S3-compatible)
- **Excel Processing**: xlsx (SheetJS)
- **Logging**: Winston
- **Security**: Helmet, bcrypt, express-validator
- **Testing**: Vitest + Supertest

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Server will run on [http://localhost:4000](http://localhost:4000).

### Building

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Firebase Emulator Seed Data

```bash
# เติมข้อมูลตัวอย่างใน Firebase Emulator Suite
npx ts-node scripts/seed-emulator.ts

# หรือใช้ npm script (ภายใน backend/)
npm run seed:emulator

# ถ้าไม่ต้องการลบข้อมูลเดิม
npx ts-node scripts/seed-emulator.ts --no-clean
```

สคริปต์จะสร้าง:
- Roles พื้นฐาน (Admin / Foreman / Site Engineer)
- ผู้ใช้ตัวอย่าง (admin / foreman / engineer) พร้อมรหัสผ่าน (`Admin123!` ฯลฯ)
- ทักษะ, โครงการ, แรงงานรายวัน และข้อมูลค่าแรงเบื้องต้น

## Project Structure

```
src/
├── models/              # Firestore data models
├── services/            # Business logic
│   ├── auth/            # Authentication & authorization
│   ├── dailyReport/     # Daily Report CRUD + validation
│   ├── overtime/        # OT management
│   ├── project/         # Project management
│   ├── member/          # User management
│   ├── dc/              # DC management
│   ├── wageCalculation/ # Wage calculation engine
│   └── scanData/        # ScanData import & validation
├── api/                 # REST endpoints
│   ├── routes/          # Express routes
│   ├── middleware/      # Auth, validation, logging
│   └── validators/      # Request validation schemas
├── utils/               # Utility functions
│   ├── excel/           # Excel import/export
│   ├── validation/      # Data validation
│   ├── encryption/      # bcrypt helpers
│   └── dateTime/        # Date/time utilities
├── config/              # Configuration
└── types/               # TypeScript types
```

## Environment Variables

Configure these in `.env`:

- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (development/production)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIRESTORE_EMULATOR_HOST` - Firestore emulator host (development)
- `FIREBASE_AUTH_EMULATOR_HOST` - Auth emulator host (development)
- `CLOUDFLARE_R2_*` - Cloudflare R2 credentials
- `JWT_SECRET` - JWT secret key
- `BCRYPT_ROUNDS` - bcrypt hashing rounds

## API Documentation

API documentation will be available at `/api/docs` (Swagger UI).

## Development Notes

- All code comments should be in Thai (ภาษาไทย)
- Follow TypeScript strict mode
- Write tests for all services
- Use Firebase emulators for local development
- Log all errors with Winston
