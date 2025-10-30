# Labor Management System - Frontend

Next.js 14 frontend application for the Labor Management System.

## Technology Stack

- **Framework**: Next.js 14 with TypeScript
- **UI Library**: Material-UI v5
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Form Handling**: React Hook Form + Zod
- **i18n**: react-i18next (Thai/English)
- **Date Utilities**: date-fns, date-fns-tz
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Testing**: Vitest + React Testing Library + Playwright

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run e2e
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── common/       # Generic components (Button, Input, etc.)
│   ├── layout/       # Layout components (Navbar, etc.)
│   └── forms/        # Form components
├── pages/            # Next.js pages
├── services/         # API services and Firebase
│   ├── api/          # HTTP client
│   └── firebase/     # Firebase configuration
├── store/            # Zustand state management
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
└── styles/           # Global styles
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_FIREBASE_*` - Firebase configuration

## Development Notes

- All UI text should be in Thai (ภาษาไทย)
- Use Material-UI components with Thai locale
- Follow the project's TypeScript strict mode
- Write tests for all components
