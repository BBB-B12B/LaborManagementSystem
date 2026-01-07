# Infrastructure

## 1. Tech Stack (Framework & Libraries)
*   **Core**:
    *   **Runtime**: Node.js v20+
    *   **Backend**: Express.js with TypeScript
    *   **Frontend**: Next.js 14 (React 18)
*   **Database**: Firebase Firestore (NoSQL)
*   **Storage**: AWS SDK for R2 / Firebase Storage (FileAttachment)
*   **Validation & Security**:
    *   `express-validator`: API Request Validation
    *   `bcrypt`: Password Hashing
    *   `helmet`, `cors`: API Security
    *   `jsonwebtoken`: Auth Tokens
*   **Utilities**:
    *   `winston`: Logging
    *   `xlsx`: Excel Import/Export
    *   `date-fns`, `date-fns-tz`: Date Manipulation
*   **DevOps**: Docker, Docker Compose (Standard Run Method: `docker-compose up`)

## 2. Folder Structure (Complete Project Map)
```
/Labor Management System
  /backend
    /src
      /api/routes           # 14 Route Files (auth, users, projects, etc.)
      /controllers          # Request Handlers
      /services             # Business Logic & CRUD
      /models               # 19 Data Models (User, DailyReport, ScanData, etc.)
      /config               # Environment & Firebase Config
  /frontend
    /src
      /components           # Reusable UI (Forms, Layouts, DataGrid)
      /pages                # Next.js Pages (dashboard, daily-reports, etc.)
      /services             # API Integration
      /store                # State Management (Zustand)
      /utils                # Helpers
  /specs                    # Specifications & Task Lists
    /001-labor-daily-report # Phase 1 Spec
  /Speckit                  # Master Control Documentation
```
