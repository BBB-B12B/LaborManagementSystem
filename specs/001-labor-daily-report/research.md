# Research & Technology Decisions

**Feature**: Labor Management System
**Branch**: `001-labor-daily-report`
**Date**: 2025-10-23

## Overview

This document resolves all "NEEDS CLARIFICATION" items from the Technical Context and establishes technology choices for the Labor Management System.

---

## 1. Frontend Framework Selection

### Decision: **Next.js 14+ (React framework)**

### Rationale:
- **Server-Side Rendering (SSR)**: Improves initial load time for Dashboard (<2s requirement)
- **TypeScript support**: Built-in, excellent for type safety with Thai language data
- **App Router**: Modern routing aligned with 8 page-based user stories
- **API Routes**: Can serve as BFF (Backend for Frontend) layer
- **Deployment**: Vercel/Netlify compatible, easy CI/CD
- **Ecosystem**: Large component library ecosystem (Material-UI, Ant Design with Thai support)

### Alternatives Considered:
- **Vue.js + Nuxt**: Good, but smaller ecosystem for enterprise components
- **Angular**: Too heavy for 8-page application, steeper learning curve
- **Plain React (CRA/Vite)**: Missing SSR, would need manual routing setup

### Best Practices:
- Use App Router for file-based routing
- Implement route-level code splitting
- Use React Server Components where possible
- Implement incremental static regeneration for Dashboard

---

## 2. Backend Framework Selection

### Decision: **Node.js with Express.js + TypeScript**

### Rationale:
- **Full-stack TypeScript**: Share types between frontend/backend (15+ entities)
- **Firebase SDK compatibility**: Official Node.js SDK well-supported
- **Performance**: Async I/O suitable for I/O-bound operations (Firestore queries)
- **Excel processing**: Excellent libraries (xlsx, exceljs) for import/export
- **Ecosystem**: Mature middleware for auth, validation, logging
- **Team familiarity**: Common stack, easier hiring/onboarding

### Alternatives Considered:
- **Python + FastAPI**: Great for ML/data processing but overkill here, weaker Excel libraries
- **Go**: Excellent performance but steeper curve, smaller Firebase ecosystem
- **NestJS**: Too opinionated for straightforward CRUD app

### Best Practices:
- Use Express.js with TypeScript decorators for routes
- Implement service layer pattern (separation of concerns)
- Use dependency injection for testability
- Implement request validation middleware (Joi/Zod)

---

## 3. UI Component Library

### Decision: **Material-UI (MUI) v5+**

### Rationale:
- **Thai language support**: Built-in i18n with th-TH locale
- **Data Grid**: MUI-X DataGrid for complex tables (Daily Report listing)
- **Form components**: AutoComplete for DC selection (0.5s search requirement)
- **Date/Time pickers**: Thai Buddhist calendar support
- **Customizable**: Theme system for brand colors
- **Accessibility**: WCAG 2.1 compliant

### Alternatives Considered:
- **Ant Design**: Good Thai support but heavier bundle size
- **Chakra UI**: Modern but less mature DataGrid components
- **Tailwind + Headless UI**: More setup required, no built-in components

### Best Practices:
- Configure Thai locale globally
- Use MUI-X DataGrid Pro for pagination/filtering
- Implement custom theme for consistent styling
- Use MUI's built-in form validation

---

## 4. State Management

### Decision: **Zustand + React Query**

### Rationale:
- **Zustand**: Lightweight (1KB), simpler than Redux, TypeScript-first
- **React Query**: Built for server state (Firestore), handles caching/refetching
- **Separation**: Zustand for UI state, React Query for server state
- **Performance**: Automatic query deduplication, background refetching
- **DevTools**: Both have excellent debugging tools

### Alternatives Considered:
- **Redux Toolkit**: Too verbose for 8-page app, unnecessary ceremony
- **Context API only**: Poor performance with frequent updates
- **MobX**: Less TypeScript-friendly, smaller ecosystem

### Best Practices:
- Use React Query for all Firestore data
- Use Zustand for auth state, UI flags, form state
- Implement optimistic updates for Daily Report saves
- Configure aggressive caching for static data (Project list)

---

## 5. Testing Strategy

### Decision: **Vitest + Testing Library + Playwright**

### Rationale:
- **Vitest**: Fast (Vite-powered), ESM-native, Jest-compatible API
- **React Testing Library**: Component testing best practices
- **Playwright**: Cross-browser E2E, excellent Thai text support
- **Coverage**: Fast feedback loop for TDD

### Test Layers:
```
Unit Tests (Vitest + Testing Library):
- Business logic (wage calculation, social security)
- Utility functions (date parsing, Thai text validation)
- React components (Dashboard widgets, forms)

Integration Tests (Vitest):
- Service layer with mock Firestore
- API endpoints with supertest
- Excel import/export pipelines

Contract Tests (Pact/OpenAPI validator):
- Frontend-Backend API contracts
- Firestore schema validation

E2E Tests (Playwright):
- Critical user flows (US1→US2→US3)
- Multi-role authorization scenarios
- Excel upload/download flows
```

### Alternatives Considered:
- **Jest**: Slower than Vitest, ESM issues
- **Cypress**: Good but heavier than Playwright, slower
- **Selenium**: Outdated, harder to maintain

### Best Practices:
- TDD for business logic (wage calculation)
- Integration tests for services
- E2E smoke tests for each User Story
- Visual regression testing for Dashboard

---

## 6. Excel Import/Export Library

### Decision: **SheetJS (xlsx) Community Edition**

### Rationale:
- **Full-featured**: Read/write XLSX, CSV, ODS
- **Performance**: Streams large files (1000+ records in 30s)
- **Thai support**: UTF-8 encoding, no character issues
- **Mature**: 10+ years, actively maintained
- **Type definitions**: @types/xlsx available

### Implementation Plan:
```typescript
// Import ScanData
import * as XLSX from 'xlsx';

interface ScanDataRow {
  EmployeeNumber: string;
  Date: Date;
}

function parseScanDataExcel(file: File): Promise<ScanDataRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer());
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ScanDataRow>(worksheet, {
    raw: false,
    dateNF: 'yyyy-mm-dd hh:mm:ss' // Thai datetime format
  });
}

// Export Wage Calculation
function exportWageCalculation(data: WagePeriod[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Wage Calculation');
  return XLSX.write(workbook, { type: 'blob', bookType: 'xlsx' });
}
```

### Alternatives Considered:
- **ExcelJS**: More features but slower performance
- **PapaParse**: CSV only, no XLSX support
- **xlsx-populate**: Abandoned, no TypeScript

### Best Practices:
- Validate Excel structure before parsing
- Stream large files to avoid memory issues
- Implement progress callbacks for UX
- Add error handling for malformed files

---

## 7. Logging & Monitoring Strategy

### Decision: **Winston (Backend) + Sentry (Frontend + Backend)**

### Rationale:
- **Winston**: Structured logging, multiple transports, log levels
- **Sentry**: Error tracking, performance monitoring, release tracking
- **Integration**: Sentry captures Winston errors automatically
- **Alerts**: Slack/email notifications for critical errors

### Logging Levels:
```
ERROR: Failed operations (wage calculation errors, DB writes)
WARN:  Validation failures (Daily Report < ScanData)
INFO:  User actions (login, wage period created)
DEBUG: Development troubleshooting
```

### Implementation:
```typescript
import winston from 'winston';
import * as Sentry from '@sentry/node';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Capture errors to Sentry
logger.on('error', (error) => {
  Sentry.captureException(error);
});
```

### Alternatives Considered:
- **Pino**: Faster but less ecosystem integration
- **Bunyan**: Outdated, less active
- **LogRocket**: Frontend-only, expensive

### Best Practices:
- Log all authentication attempts
- Log wage calculation inputs/outputs for audit
- Monitor ScanData discrepancy trends
- Alert on high error rates (>5% of requests)

---

## 8. API Design Pattern

### Decision: **RESTful API with OpenAPI 3.0 specification**

### Rationale:
- **Standards-based**: Industry standard, tooling ecosystem
- **Auto-documentation**: Swagger UI for development
- **Code generation**: TypeScript clients from OpenAPI spec
- **Validation**: JSON Schema validation from spec

### API Structure:
```
/api/v1/auth
  POST   /login
  POST   /logout
  GET    /me

/api/v1/users
  GET    /users
  POST   /users
  GET    /users/:id
  PUT    /users/:id
  DELETE /users/:id

/api/v1/daily-reports
  GET    /daily-reports
  POST   /daily-reports
  GET    /daily-reports/:id
  PUT    /daily-reports/:id
  DELETE /daily-reports/:id
  GET    /daily-reports/:id/history

/api/v1/wage-periods
  GET    /wage-periods
  POST   /wage-periods
  GET    /wage-periods/:id
  PUT    /wage-periods/:id
  DELETE /wage-periods/:id
  POST   /wage-periods/:id/calculate
  GET    /wage-periods/:id/export

/api/v1/scan-data
  POST   /scan-data/import
  GET    /scan-data/discrepancies
  GET    /scan-data/discrepancies/:id
  PUT    /scan-data/discrepancies/:id/resolve
```

### Alternatives Considered:
- **GraphQL**: Overkill for simple CRUD, adds complexity
- **tRPC**: TypeScript-only, limits client options
- **gRPC**: Frontend doesn't need that performance

### Best Practices:
- Version API (v1, v2)
- Use plural resource names
- Implement HATEOAS for pagination
- Return 201 for creates, 204 for deletes
- Use query params for filtering/sorting

---

## 9. Authentication & Authorization

### Decision: **Firebase Authentication + Custom Claims for Roles**

### Rationale:
- **Already committed**: Spec mandates Firebase Auth
- **Custom Claims**: Store role (Admin/FM/SE/OE/PE/PM/PD/MD) in JWT
- **Security Rules**: Firestore security rules for data access
- **Session management**: Built-in token refresh

### Implementation:
```typescript
// Set custom claims on user creation
import { getAuth } from 'firebase-admin/auth';

async function setUserRole(uid: string, role: Role) {
  await getAuth().setCustomUserClaims(uid, { role });
}

// Middleware to check roles
function requireRole(...allowedRoles: Role[]) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(token);

    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = decoded;
    next();
  };
}

// Usage
app.post('/api/v1/wage-periods',
  requireRole('Admin', 'PM', 'PD', 'MD'),
  createWagePeriod
);
```

### Firestore Security Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function hasRole(role) {
      return isAuthenticated() && request.auth.token.role == role;
    }

    function hasAnyRole(roles) {
      return isAuthenticated() && request.auth.token.role in roles;
    }

    // Daily Reports
    match /dailyReports/{reportId} {
      allow read: if isAuthenticated();
      allow create, update: if hasAnyRole(['Admin', 'FM', 'SE']);
      allow delete: if hasRole('Admin');
    }

    // Wage Periods
    match /wagePeriods/{periodId} {
      allow read: if isAuthenticated();
      allow write: if hasAnyRole(['Admin', 'PM', 'PD', 'MD']);
    }
  }
}
```

### Best Practices:
- Store sensitive data in custom claims (not Firestore)
- Implement token refresh before expiry
- Log all authentication events
- Use secure cookies for session tokens
- Implement rate limiting on login endpoint

---

## 10. Internationalization (i18n)

### Decision: **react-i18next + Thai locale**

### Rationale:
- **React integration**: Hooks, HOCs, React Suspense support
- **Namespace support**: Organize translations by feature
- **Pluralization**: Thai-specific plural rules
- **Lazy loading**: Load translations on-demand

### Implementation:
```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    lng: 'th',
    fallbackLng: 'en',
    ns: ['common', 'dailyReport', 'wageCalculation'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false
    }
  });

// Usage in components
import { useTranslation } from 'react-i18next';

function DailyReportForm() {
  const { t } = useTranslation('dailyReport');

  return (
    <form>
      <label>{t('fields.projectLocation')}</label>
      <input placeholder={t('placeholders.selectProject')} />
    </form>
  );
}
```

### Translation Files Structure:
```
public/
  locales/
    th/
      common.json          # Shared translations
      dailyReport.json     # Daily Report translations
      wageCalculation.json # Wage Calculation translations
    en/
      common.json          # English fallback
```

### Best Practices:
- Use namespaces per feature
- Keep translation keys semantic
- Implement missing translation warnings in dev
- Use interpolation for dynamic values
- Test with Thai Buddhist calendar dates

---

## 11. Date/Time Handling

### Decision: **date-fns + date-fns-tz for Thai timezone**

### Rationale:
- **Lightweight**: Tree-shakable, small bundle
- **Immutable**: No mutation surprises like Moment.js
- **Thai locale**: Built-in th locale
- **Timezone support**: date-fns-tz for Asia/Bangkok
- **TypeScript**: Full type definitions

### Implementation:
```typescript
import { format, parseISO, addDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const BANGKOK_TZ = 'Asia/Bangkok';

// Format date in Thai
function formatThaiDate(date: Date): string {
  return format(date, 'dd MMMM yyyy', { locale: th });
}

// Calculate wage period (15 days)
function getWagePeriod(startDate: Date): { start: Date; end: Date } {
  const start = utcToZonedTime(startDate, BANGKOK_TZ);
  const end = addDays(start, 14); // 15 days inclusive

  return { start, end };
}

// Validate time overlap
function hasTimeOverlap(
  range1: { start: Date; end: Date },
  range2: { start: Date; end: Date }
): boolean {
  return range1.start < range2.end && range2.start < range1.end;
}
```

### Best Practices:
- Always store UTC in Firestore
- Convert to Bangkok timezone for display
- Use ISO 8601 format for date strings
- Implement wage period validation (exactly 15 days)
- Handle OT across midnight correctly

---

## 12. Form Validation

### Decision: **Zod + React Hook Form**

### Rationale:
- **Type-safe**: Zod schemas generate TypeScript types
- **Runtime validation**: Validates at runtime (important for user input)
- **React Hook Form**: Performance (uncontrolled forms), built-in validation
- **Server-client sharing**: Same Zod schemas on backend/frontend

### Implementation:
```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Shared schema (backend/frontend)
const DailyReportSchema = z.object({
  projectId: z.string().uuid(),
  dcIds: z.array(z.string().uuid()).min(1, 'เลือกแรงงานอย่างน้อย 1 คน'),
  taskName: z.string().min(1, 'ระบุงานที่ทำ'),
  date: z.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'รูปแบบเวลาไม่ถูกต้อง'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'รูปแบบเวลาไม่ถูกต้อง'),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', path: ['endTime'] }
);

type DailyReportInput = z.infer<typeof DailyReportSchema>;

// React Hook Form usage
function DailyReportForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<DailyReportInput>({
    resolver: zodResolver(DailyReportSchema)
  });

  const onSubmit = (data: DailyReportInput) => {
    // Data is validated and typed
    saveDailyReport(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('taskName')} />
      {errors.taskName && <span>{errors.taskName.message}</span>}
    </form>
  );
}
```

### Validation Rules:
- Required fields (FR-DR-007)
- Time overlap detection (FR-DR-008)
- Excel format validation (FR-SD-003)
- Employee ID format (9 digits or custom)
- Thai text validation (UTF-8, no invalid chars)

### Best Practices:
- Share Zod schemas between frontend/backend
- Use Zod for API input validation
- Implement custom validators for business rules
- Display Thai error messages
- Validate on blur for better UX

---

## 13. Deployment & CI/CD

### Decision: **Vercel (Frontend) + Cloud Run (Backend) + GitHub Actions**

### Rationale:
- **Vercel**: Zero-config Next.js deployment, edge network, preview deployments
- **Cloud Run**: Containerized backend, auto-scaling, Firebase integration
- **GitHub Actions**: Free for public repos, Matrix builds for tests
- **Environment parity**: Consistent dev/staging/prod environments

### CI/CD Pipeline:
```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: npm run test
      - run: npm run build

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd backend && npm ci
      - run: npm run test
      - run: npm run build

  deploy-frontend:
    needs: [test-frontend, test-backend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'

  deploy-backend:
    needs: [test-frontend, test-backend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v0
      - run: |
          cd backend
          gcloud builds submit --tag gcr.io/$PROJECT_ID/labor-backend
          gcloud run deploy labor-backend \
            --image gcr.io/$PROJECT_ID/labor-backend \
            --platform managed \
            --region asia-southeast1 \
            --allow-unauthenticated
```

### Environments:
- **Development**: Local (Docker Compose), connects to emulator
- **Staging**: Vercel preview + Cloud Run staging, test Firebase project
- **Production**: Vercel + Cloud Run, production Firebase project

### Best Practices:
- Run tests on every PR
- Deploy staging on develop branch
- Deploy production on main branch only
- Use secrets for API keys
- Implement automated rollback on errors

---

## Summary Table

| Area | Technology | Rationale |
|------|------------|-----------|
| **Frontend Framework** | Next.js 14 | SSR, TypeScript, App Router |
| **Backend Framework** | Node.js + Express | Full-stack TypeScript, Firebase SDK |
| **UI Components** | Material-UI v5 | Thai locale, DataGrid, forms |
| **State Management** | Zustand + React Query | Lightweight, server state handling |
| **Testing** | Vitest + Testing Library + Playwright | Fast, ESM-native, E2E |
| **Excel** | SheetJS (xlsx) | Performance, Thai support |
| **Logging** | Winston + Sentry | Structured logging, error tracking |
| **API Design** | RESTful + OpenAPI | Standards-based, documentation |
| **Auth** | Firebase Auth + Custom Claims | Role-based access, Security Rules |
| **i18n** | react-i18next | React integration, namespaces |
| **Date/Time** | date-fns + date-fns-tz | Lightweight, Thai locale, timezone |
| **Validation** | Zod + React Hook Form | Type-safe, runtime validation |
| **Deployment** | Vercel + Cloud Run + GitHub Actions | Zero-config, auto-scaling, CI/CD |

---

## Next Steps

All NEEDS CLARIFICATION items have been resolved. Proceed to **Phase 1: Design & Contracts**:

1. Generate `data-model.md` from Key Entities in spec
2. Create API contracts in `/contracts/` directory (OpenAPI 3.0 specs)
3. Create `quickstart.md` for developer onboarding
4. Update agent context with technology decisions
