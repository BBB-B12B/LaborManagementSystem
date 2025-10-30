# Quickstart Guide: Labor Management System

**Feature**: ระบบจัดการแรงงานและรายงานประจำวัน
**Branch**: `001-labor-daily-report`
**Last Updated**: 2025-10-23

---

## 🚀 5-Minute Setup with Docker

### Prerequisites
- Docker Desktop (20.10+)
- Docker Compose (v2.0+)
- Git

### Quick Start (Docker - Recommended)

#### 1. Clone & Setup Environment
```bash
# Clone repository
git checkout 001-labor-daily-report

# Copy environment file
cp .env.example .env

# Edit .env file with your Firebase & Cloudflare R2 credentials
nano .env
```

#### 2. Start All Services with Docker
```bash
# Start all services (frontend, backend, firebase-emulator)
docker-compose up -d

# View logs
docker-compose logs -f

# Or view specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f firebase-emulator
```

#### 3. Access Applications
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Firebase Emulator UI**: http://localhost:4001
- **Firestore Emulator**: http://localhost:8080
- **Auth Emulator**: http://localhost:9099

#### 4. Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## 🔧 Alternative Setup (Without Docker)

### Prerequisites
- Node.js 20+
- Firebase CLI
- npm or yarn

### Installation
```bash
git checkout 001-labor-daily-report

# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Setup Firebase
cd firebase
firebase init
cd ..
```

### Start Development (Manual)
```bash
# Terminal 1: Firebase Emulator
cd firebase && firebase emulators:start

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

Access: http://localhost:3000

---

## 🐳 Docker Commands Reference

### Common Operations
```bash
# Rebuild after dependency changes
docker-compose up -d --build

# View running containers
docker ps

# Execute command in container
docker exec -it labor-frontend sh
docker exec -it labor-backend sh

# Remove all containers and volumes
docker-compose down -v

# View container logs (real-time)
docker-compose logs -f

# Restart specific service
docker-compose restart backend
```

### Troubleshooting Docker
```bash
# Check if services are running
docker-compose ps

# Rebuild specific service
docker-compose build frontend
docker-compose build backend

# Clean up Docker system
docker system prune -a

# Remove specific volume
docker volume rm labor_firebase_data
```

---

## 📁 Quick Navigation

| File | Purpose |
|------|---------|
| [spec.md](./spec.md) | Complete feature specification (8 User Stories) |
| [plan.md](./plan.md) | Implementation plan & architecture decisions |
| [research.md](./research.md) | Technology stack decisions (13 topics) |
| [data-model.md](./data-model.md) | Data entities & Firestore schema (17 entities) |
| [contracts/openapi.yaml](./contracts/openapi.yaml) | REST API specification |

---

## 🏗️ Architecture

**Frontend**: Next.js 14 + React 18 + TypeScript + Material-UI + React Query
**Backend**: Node.js + Express + TypeScript + Firebase + Firestore
**Database**: Firebase Firestore (15 collections)
**Testing**: Vitest + React Testing Library + Playwright
**Deployment**: Vercel (frontend) + Cloud Run (backend)

---

## 8 User Stories

```
US1 (P1) Dashboard & Navigation          → /dashboard
US2 (P2) Daily Report (Regular Hours)    → /daily-report
US3 (P3) Overtime (OT) Management        → /overtime
US4 (P4) Project Management              → /projects
US5 (P5) Member Management               → /members
US6 (P6) DC Management                   → /daily-contractors
US7 (P7) Wage Calculation                → /wage-calculation
US8 (P8) ScanData Monitoring             → /scan-data-monitoring
```

---

## 🧪 Testing

```bash
# Frontend tests
cd frontend && npm run test:unit

# Backend tests
cd backend && npm run test:unit

# E2E tests (requires running servers)
npm run test:e2e
```

---

## 🔐 8 User Roles

- Admin (AM) - Full access
- Foreman (FM) - Daily reports
- Site Engineer (SE) - Daily reports
- Office Engineer (OE) - Admin features
- Project Engineer (PE) - Projects
- Project Manager (PM) - Wage calculation
- Project Director (PD) - Wage calculation + dept
- Managing Director (MD) - All projects

---

## 📊 Key Features

- **Daily Report**: Multi-select DCs, time validation, edit history
- **Overtime**: 3 types (morning/noon/evening)
- **Wage Calculation**: Social security, OT rates, Excel export
- **ScanData Monitoring**: Fingerprint validation, 3-type discrepancy detection
- **Multi-language**: Thai/English support (i18next)
- **Authorization**: Role-based access with Firestore Security Rules

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Firebase emulator not found | Run `firebase emulators:start` in separate terminal |
| Thai text garbled | Check UTF-8 encoding: `<meta charset="utf-8" />` |
| Port 3000/3001 in use | `lsof -i :3000` then `kill -9 <PID>` |
| Node version wrong | `nvm install 20 && nvm use 20` |

---

## 📞 Need Help?

1. Check the full [spec.md](./spec.md) for requirements
2. Review [research.md](./research.md) for tech decisions
3. Check [data-model.md](./data-model.md) for schema
4. See [contracts/openapi.yaml](./contracts/openapi.yaml) for API
5. Run tests: `npm run test`

---

**Ready to code? Start with spec.md → data-model.md → implement User Story 1 ✨**
