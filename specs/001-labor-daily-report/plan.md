# Implementation Plan: ระบบจัดการแรงงานและรายงานประจำวัน

**Branch**: `001-labor-daily-report` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-labor-daily-report/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Labor Management System เป็นระบบบริหารจัดการแรงงานรายวันและคำนวณค่าแรง ครอบคลุม 8 User Stories หลัก:
1. Dashboard และ Navigation - แสดงภาพรวมแรงงาน Active และ ScanData Monitoring
2. Daily Report (เวลาปกติ) - บันทึกเวลาทำงานประจำวันพร้อม Edit History
3. Overtime Management - บันทึก OT แยกเป็น เช้า/เที่ยง/เย็น
4. Project Management - จัดการโครงการและสังกัด (PD01-PD05)
5. Member Management - จัดการผู้ใช้ 8 Role (Admin/FM/SE/OE/PE/PM/PD/MD)
6. DC Management - จัดการแรงงานรายวันพร้อมข้อมูลรายได้/รายจ่าย
7. Wage Calculation - คำนวณค่าแรงต่องวด 15 วัน พร้อมประกันสังคมและ Excel export
8. ScanData Management & Monitoring - อัปโหลด Excel สแกนนิ้ว ตรวจสอบความผิดปกติกับ Daily Report

**Technical Approach**: Web application ด้วย Firebase (Firestore/Auth), Cloudflare R2, รองรับภาษาไทย UTF-8, Excel import/export, Multi-role authorization

## Technical Context

**Language/Version**: NEEDS CLARIFICATION (Frontend: React/Vue/Angular/Next.js?, Backend: Node.js/Python/Go?)
**Primary Dependencies**:
- Firebase SDK (Firestore + Authentication)
- Cloudflare R2 SDK
- Excel library (SheetJS/xlsx/ExcelJS)
- NEEDS CLARIFICATION (Web framework, UI component library, State management)

**Storage**:
- Firebase Firestore (primary database)
- Cloudflare R2 Object Storage (file storage)

**Testing**: NEEDS CLARIFICATION (Jest/Vitest/Cypress for frontend?, pytest/Go test for backend?)
**Target Platform**: Web application (Browser-based, desktop + mobile responsive)
**Project Type**: Web (Frontend + Backend)

**Performance Goals**:
- Dashboard load time: <2s
- Daily Report save: <1 minute for single entry
- Wage calculation: <5 minutes for full period
- Excel import (1000 records): <30s
- Excel export: <10s
- Auto Complete search: <0.5s

**Constraints**:
- UTF-8 encoding (Thai language support mandatory)
- Multi-role authorization (8 roles)
- Edit History tracking (all Daily Report changes)
- Daily Report ≥ ScanData validation principle
- 15-day wage period enforcement

**Scale/Scope**:
- 50+ concurrent users
- 8 user stories
- 8 user roles
- 5 departments (PD01-PD05)
- ~15 key entities
- ~100+ functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: Constitution file is currently a template. Applying general software engineering principles:

| Principle | Status | Notes |
|-----------|--------|-------|
| **Simplicity** | ⚠️ REVIEW | 8 User Stories with complex interdependencies. Wage calculation has intricate business logic (social security, OT rates, scan validation). Can we simplify Phase 1 MVP? |
| **Testability** | ✅ PASS | Independent tests defined for each User Story. Clear acceptance scenarios. |
| **Clear Contracts** | ⚠️ NEEDS WORK | API contracts undefined. Need to define REST/GraphQL endpoints in Phase 1. |
| **Data Integrity** | ✅ PASS | Edit History tracking, soft deletes, Primary Key linking between collections. |
| **Security** | ✅ PASS | Multi-role authorization (8 roles), Firebase Auth, bcrypt password hashing, environment variables for secrets. |
| **Performance** | ✅ PASS | Clear SLAs defined (SC-001 through SC-022). |
| **Observability** | ⚠️ NEEDS WORK | No logging/monitoring strategy defined. Need to add in Phase 1. |

**Gate Decision**: ⚠️ **CONDITIONAL PASS** - Proceed to Phase 0 research with clarifications needed on:
1. Technology stack (framework selection)
2. Testing strategy
3. API contract design
4. Logging/monitoring approach
5. MVP scope simplification

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/              # Firestore data models
│   │   ├── User.ts
│   │   ├── DailyContractor.ts
│   │   ├── ProjectLocation.ts
│   │   ├── DailyReport.ts
│   │   ├── EditHistory.ts
│   │   ├── WagePeriod.ts
│   │   ├── DCIncomeDetails.ts
│   │   ├── DCExpenseDetails.ts
│   │   ├── AdditionalIncome.ts
│   │   ├── AdditionalExpense.ts
│   │   ├── SocialSecurityCalculation.ts
│   │   ├── ScanData.ts
│   │   ├── ScanDataDiscrepancy.ts
│   │   └── LateRecord.ts
│   ├── services/            # Business logic
│   │   ├── auth/            # Authentication & authorization
│   │   ├── dailyReport/     # Daily Report CRUD + validation
│   │   ├── overtime/        # OT management
│   │   ├── project/         # Project management
│   │   ├── member/          # User management
│   │   ├── dc/              # DC management
│   │   ├── wageCalculation/ # Wage calculation engine
│   │   └── scanData/        # ScanData import & validation
│   ├── api/                 # REST/GraphQL endpoints
│   │   ├── routes/
│   │   ├── middleware/      # Auth, validation, logging
│   │   └── validators/
│   ├── utils/               # Shared utilities
│   │   ├── excel/           # Excel import/export
│   │   ├── validation/
│   │   ├── encryption/      # bcrypt
│   │   └── dateTime/        # Thai timezone, wage period
│   └── config/              # Environment, Firebase, R2
└── tests/
    ├── contract/            # API contract tests
    ├── integration/         # Service integration tests
    └── unit/                # Unit tests

frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          # Buttons, inputs, modals
│   │   ├── layout/          # Navbar, dashboard widgets
│   │   └── forms/           # Form components
│   ├── pages/               # Route pages
│   │   ├── Dashboard/
│   │   ├── DailyReport/
│   │   ├── Overtime/
│   │   ├── ProjectManagement/
│   │   ├── MemberManagement/
│   │   ├── DCManagement/
│   │   ├── WageCalculation/
│   │   └── ScanDataMonitoring/
│   ├── services/            # API clients
│   │   ├── api/             # HTTP client setup
│   │   ├── auth/
│   │   ├── dailyReport/
│   │   ├── wageCalculation/
│   │   └── scanData/
│   ├── store/               # State management (Redux/Zustand/Context)
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Helpers (date formatting, validation)
│   └── types/               # TypeScript types
└── tests/
    ├── e2e/                 # End-to-end tests (Cypress/Playwright)
    ├── integration/         # Component integration tests
    └── unit/                # Component unit tests

shared/
├── types/                   # Shared TypeScript types
└── contracts/               # API contracts (OpenAPI/GraphQL schemas)
```

**Structure Decision**:
- **Web application** (Option 2) selected based on requirements
- **Frontend + Backend** separation for scalability
- **Shared types** for type safety across stack
- **Service-oriented** backend for testability
- **Page-based** frontend routing aligned with User Stories

## Docker Infrastructure

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Docker Environment                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │    │   Backend    │    │   Firebase   │  │
│  │  (Next.js)   │◄───┤  (Express)   │◄───┤   Emulator   │  │
│  │  Port: 3000  │    │  Port: 4000  │    │  Port: 9099  │  │
│  └──────────────┘    └──────────────┘    │  Port: 8080  │  │
│         │                    │            │  Port: 9000  │  │
│         │                    │            └──────────────┘  │
│         │                    │                   │          │
│         │                    │            ┌──────────────┐  │
│         │                    └────────────┤   Node.js    │  │
│         │                                 │   Alpine     │  │
│         │                                 │   Base Image │  │
│         │                                 └──────────────┘  │
│         │                                                    │
│         └────────────────────────────────────────────────── │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Docker Volumes (Persistent)              │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • node_modules (frontend & backend)                 │  │
│  │  • firebase-data (emulator persistence)              │  │
│  │  • uploads (temporary file storage)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Docker Network: app-network              │  │
│  │  • frontend.local → backend.local                    │  │
│  │  • backend.local → firebase-emulator.local           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Container Services

#### 1. Frontend Container (Next.js)
- **Base Image**: `node:20-alpine`
- **Working Directory**: `/app`
- **Port**: 3000 (exposed)
- **Environment**:
  - `NODE_ENV=development`
  - `NEXT_PUBLIC_API_URL=http://backend:4000`
  - `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=firebase-emulator:9099`
- **Volumes**:
  - `./frontend:/app` (source code)
  - `frontend_node_modules:/app/node_modules` (dependencies)
- **Hot Reload**: Enabled via volume mount
- **Command**: `npm run dev`

#### 2. Backend Container (Express)
- **Base Image**: `node:20-alpine`
- **Working Directory**: `/app`
- **Port**: 4000 (exposed)
- **Environment**:
  - `NODE_ENV=development`
  - `PORT=4000`
  - `FIREBASE_EMULATOR_HOST=firebase-emulator`
  - `FIRESTORE_EMULATOR_HOST=firebase-emulator:8080`
  - `FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099`
  - `CLOUDFLARE_R2_ENDPOINT=${CLOUDFLARE_R2_ENDPOINT}`
  - `CLOUDFLARE_R2_ACCESS_KEY=${CLOUDFLARE_R2_ACCESS_KEY}`
  - `CLOUDFLARE_R2_SECRET_KEY=${CLOUDFLARE_R2_SECRET_KEY}`
- **Volumes**:
  - `./backend:/app` (source code)
  - `backend_node_modules:/app/node_modules` (dependencies)
  - `./uploads:/app/uploads` (file uploads)
- **Hot Reload**: Enabled via nodemon
- **Command**: `npm run dev`

#### 3. Firebase Emulator Container
- **Base Image**: `firebase/emulator-suite:latest`
- **Ports**:
  - 4000: Emulator UI
  - 8080: Firestore Emulator
  - 9099: Authentication Emulator
  - 9000: Realtime Database Emulator
- **Volumes**:
  - `./firebase:/firebase` (firebase config)
  - `firebase_data:/opt/data` (persistent data)
- **Environment**:
  - `FIREBASE_PROJECT_ID=labor-management-dev`
- **Command**: `firebase emulators:start --import=/opt/data --export-on-exit=/opt/data`

### Docker Compose Services

```yaml
services:
  frontend:
    depends_on: [backend]
  backend:
    depends_on: [firebase-emulator]
  firebase-emulator:
    # Standalone service
```

### Volume Strategy

**Named Volumes** (Docker-managed):
- `frontend_node_modules`: Optimized npm packages for frontend
- `backend_node_modules`: Optimized npm packages for backend
- `firebase_data`: Firebase emulator persistent data

**Bind Mounts** (Host-mapped):
- `./frontend:/app`: Live code editing
- `./backend:/app`: Live code editing
- `./uploads:/app/uploads`: File uploads accessible from host

### Network Configuration

**Custom Bridge Network**: `app-network`
- Enables service discovery by name
- Isolated from host network
- Supports DNS resolution
  - `frontend` → `http://frontend:3000`
  - `backend` → `http://backend:4000`
  - `firebase-emulator` → `http://firebase-emulator:4000`

### Environment Variables

**Required `.env` file** (root directory):
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=labor-management-dev
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=labor-management-dev.firebaseapp.com

# Cloudflare R2 Configuration
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=your-r2-access-key
CLOUDFLARE_R2_SECRET_KEY=your-r2-secret-key
CLOUDFLARE_R2_BUCKET_NAME=labor-management-uploads

# Application
NODE_ENV=development
FRONTEND_PORT=3000
BACKEND_PORT=4000
```

### Development Workflow

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f frontend
docker-compose logs -f backend

# Rebuild after dependency changes
docker-compose up -d --build

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Production Considerations

**Multi-stage Builds**:
- Stage 1: Build (with dev dependencies)
- Stage 2: Production (optimized, minimal dependencies)

**Production Image Sizes**:
- Frontend: ~150 MB (Next.js optimized)
- Backend: ~100 MB (Node.js Alpine)

**Health Checks**:
- Frontend: `HEALTHCHECK CMD curl -f http://localhost:3000 || exit 1`
- Backend: `HEALTHCHECK CMD curl -f http://localhost:4000/health || exit 1`

**Security**:
- Non-root user in containers
- Read-only root filesystem where possible
- Minimal attack surface with Alpine Linux

### Infrastructure Files Created

```text
/
├── docker-compose.yml           # Main orchestration file
├── .dockerignore                # Global Docker ignore
├── frontend/
│   ├── Dockerfile               # Frontend image definition
│   ├── Dockerfile.prod          # Production-optimized image
│   └── .dockerignore            # Frontend-specific ignore
├── backend/
│   ├── Dockerfile               # Backend image definition
│   ├── Dockerfile.prod          # Production-optimized image
│   └── .dockerignore            # Backend-specific ignore
└── firebase/
    └── firebase.json            # Firebase emulator configuration
```

## Complexity Tracking

> **No complexity violations identified**

All 8 User Stories are well-scoped and follow established patterns.
- **Simplicity**: User stories have clear acceptance criteria
- **Testability**: Each feature has independent test coverage
- **Contracts**: Clear API boundaries via OpenAPI spec
- **Data model**: Well-normalized schema with proper relationships

---

## Complete Functional Requirements Coverage

### Dashboard & Navigation (FR-D: 4 requirements)
- FR-D-001: Dashboard with active worker count + ScanData monitoring widget
- FR-D-002: Navbar with 6 menu items
- FR-D-003: Navigation functionality
- FR-D-004: Persistent navbar across pages

### Daily Report - Regular Hours (FR-DR: 11 requirements)
- FR-DR-001 to FR-DR-008: Form fields, validation, time checks
- FR-DR-009 to FR-DR-011: Edit History tracking and display

### Overtime Management (FR-OT: 7 requirements)
- FR-OT-001 to FR-OT-007: OT tabs (morning/noon/evening), overlap detection

### Project Management (FR-P: 3 requirements)
- FR-P-001 to FR-P-003: CRUD for Project Locations with departments

### Member Management (FR-M: 6 requirements)
- FR-M-001 to FR-M-006: User CRUD, 8 roles, password security

### DC Management (FR-DC: 4 requirements)
- FR-DC-001 to FR-DC-004: DC CRUD, skills, project linking

### Authorization (FR-A: 8 requirements)
- FR-A-001 to FR-A-008: Role-based access, department restrictions

### Language & i18n (FR-L: 2 requirements)
- FR-L-001 to FR-L-002: Thai language UI and code comments

### Wage Calculation (FR-WC: 30 requirements)
- FR-WC-001 to FR-WC-013: Period creation, calculation logic, social security
- FR-WC-014 to FR-WC-021: Additional income/expense management
- FR-WC-022 to FR-WC-027: Total calculations, data persistence
- FR-WC-028 to FR-WC-030: Excel export, edit, delete

### ScanData Management (FR-SD: 18 requirements)
- FR-SD-001 to FR-SD-005: Upload, import, behavior classification
- FR-SD-006 to FR-SD-009: Hour calculation, validation, discrepancy detection
- FR-SD-010 to FR-SD-013: Monitoring dashboard, detail view, resolution
- FR-SD-014 to FR-SD-018: Warning system, late tracking, edge cases

**Total: 106 Functional Requirements**

---

## All Edge Cases Documented (20+ cases)

### Data Entry Edge Cases
1. Multi-select DC limit handling
2. End time before start time validation
3. Missing required fields
4. Time overlap detection
5. Duplicate username prevention

### Security & Access Edge Cases
6. Unauthorized project access blocking
7. User deletion with existing data (soft delete)
8. OT overlapping with regular hours

### Wage Calculation Edge Cases
9. Non-15-day wage period validation
10. Missing DC income/expense data (default to 0)
11. Social security across months
12. Wage period deletion confirmation
13. DC with no daily reports (show 0 hours)
14. Negative income/expense prevention
15. Large Excel file export handling

### ScanData Edge Cases
16. Invalid Excel format validation
17. Unknown EmployeeNumber handling
18. Multiple scans in same timeframe
19. Large discrepancy warning (>2 hours)
20. Multiple late arrivals aggregation
21. OT crossing midnight

---

## Success Criteria (22 Measurable Outcomes)

### Performance Criteria (SC-001 to SC-010)
- SC-001: Daily Report entry <1 min (single DC)
- SC-002: Multi-select entry <2 min
- SC-003: Dashboard load <2 sec
- SC-004: 50+ concurrent users
- SC-005: Navigation <1 sec
- SC-006: 90% first-time success rate
- SC-007: 50% time reduction vs manual
- SC-008: Auto Complete <0.5 sec
- SC-009: Project creation <2 min
- SC-010: User/DC management <3 min

### Wage Calculation Criteria (SC-011 to SC-015)
- SC-011: Wage period calculation <5 min
- SC-012: 100% accurate calculations
- SC-013: Additional items entry <2 min
- SC-014: Excel export <10 sec
- SC-015: 100% accurate social security

### ScanData Criteria (SC-016 to SC-022)
- SC-016: Import 1000 records <30 sec
- SC-017: 100% accurate behavior classification
- SC-018: 100% accurate discrepancy detection
- SC-019: Monitoring widget load <2 sec
- SC-020: Discrepancy fix <1 min
- SC-021: 100% accurate 5-minute rounding
- SC-022: 100% accurate Daily Report ≥ ScanData validation

---

## All Assumptions Documented (22 items)

### System Assumptions (1-10)
1. Pre-existing data for testing
2. Multi-project user access
3. Auto Complete search by name/ID
4. 15-day wage periods only
5. OT time windows defined
6. Multi-select uses same task data
7. bcrypt password hashing
8. Soft delete for data integrity
9. Unlimited edit history storage
10. External file storage (R2)

### Business Logic Assumptions (11-15)
11. OT rate = 1.5x regular rate
12. Social security: 5%, cap 750 baht/month, min 83 baht, ID starting with "9" exempt
13. Follower accommodation: 300 baht/person/period
14. 5 departments: PD01-PD05
15. Primary Key linking between collections

### Technical Assumptions (16-22)
16. Excel format: EmployeeNumber, Date (datetime)
17. Working hours: 08:00-17:00, lunch 12:00-13:00
18. 5-minute rounding down (58→55, 54→50)
19. Daily Report always takes precedence over ScanData
20. Warning if difference >2 hours
21. Late = scan after 08:00
22. OT can cross midnight

---

## Phase 0 & 1 Completion Summary

✅ **Phase 0: Research & Technology Decisions**
- Resolved 13 NEEDS CLARIFICATION items
- Selected technology stack (Next.js, Express, Firebase, Firestore, MUI)
- Documented 13 key architectural decisions
- Output: [research.md](./research.md) - 21 KB

✅ **Phase 1: Design & Contracts**
- Extracted 17 data entities from specification
- Defined Firestore schema with TypeScript interfaces
- Created 15+ Firestore collections with indexes
- Generated OpenAPI 3.0 specification (50+ REST endpoints)
- Defined 8 user roles with permission matrices
- Documented 106 functional requirements
- Cataloged 21 edge cases
- Mapped 22 success criteria
- Listed 22 assumptions
- Output: [data-model.md](./data-model.md) - 62 KB, [contracts/openapi.yaml](./contracts/openapi.yaml) - 14 KB

✅ **Phase 1: Developer Onboarding**
- Created comprehensive quickstart guide
- Documented 8 User Story mappings
- Provided debugging & troubleshooting guide
- Technology stack reference table
- Common issues & solutions
- Output: [quickstart.md](./quickstart.md) - 3.6 KB

✅ **Agent Context Updated**
- Updated Claude Code context file
- Technology stack documented
- Project structure defined
- Output: CLAUDE.md (updated)

---

## Phase 2 Ready: Generate Tasks (Next Step)

After this `/speckit.plan` command, execute `/speckit.tasks` to:
1. Generate actionable tasks from all User Stories
2. Define dependencies between tasks
3. Estimate effort & timeline
4. Create tasks.md with implementation roadmap

**Estimated timeline for Phase 2 tasks generation: 30 minutes**

---

## Artifacts Generated

All Phase 1 outputs are in `/specs/001-labor-daily-report/`:

```
✅ spec.md               (94 KB) - Complete feature specification
✅ plan.md               (Enhanced) - Implementation plan with Docker infrastructure
✅ research.md           (21 KB) - Technology research & decisions
✅ data-model.md         (62 KB) - Data schema & entities (17)
✅ quickstart.md         (Enhanced) - Developer onboarding guide with Docker
✅ CHECKLIST.md          (53 KB) - Complete implementation checklist (7 phases, 8 User Stories)
✅ contracts/
   └── openapi.yaml      (14 KB) - REST API specification
✅ CLAUDE.md            - Agent context file (updated)
```

**Docker Infrastructure Files** (in project root):

```
✅ docker-compose.yml           - Orchestration (frontend, backend, firebase-emulator)
✅ .dockerignore                - Global Docker ignore
✅ .env.example                 - Environment variables template
✅ frontend/
   ├── Dockerfile               - Multi-stage build (dev + production)
   └── .dockerignore            - Frontend-specific ignore
✅ backend/
   ├── Dockerfile               - Multi-stage build (dev + production)
   └── .dockerignore            - Backend-specific ignore
✅ firebase/
   ├── firebase.json            - Emulator configuration
   ├── firestore.rules          - Security rules (17 collections)
   └── firestore.indexes.json   - Composite indexes (18 indexes)
```

**Total Documentation**: ~280 KB of comprehensive project documentation + Docker infrastructure
