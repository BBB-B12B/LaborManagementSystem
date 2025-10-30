# Frontend Documentation
## เอกสารประกอบการพัฒนา Frontend

Welcome to the Labor Management System frontend documentation. This directory contains comprehensive guides for developers working on the application.

## 📚 Documentation Index

### 1. [Loading States & Notifications](./LOADING_AND_NOTIFICATIONS.md)
**คู่มือการจัดการสถานะการโหลดและการแจ้งเตือน**

Learn how to implement consistent loading states and toast notifications across the application.

**Topics covered:**
- Loading states with React Query (list pages, dashboard, forms, infinite scroll)
- LoadingSpinner component usage
- Toast notifications (success, error, warning, info)
- Error handling patterns
- Best practices and testing

**Key patterns:**
```typescript
// Loading state
if (isLoading) {
  return <LoadingSpinner message="กำลังโหลดข้อมูล..." />;
}

// Toast notification
const toast = useToast();
toast.success('บันทึกข้อมูลสำเร็จ');
toast.error('เกิดข้อผิดพลาด');
```

---

### 2. [Responsive Design](./RESPONSIVE_DESIGN.md)
**คู่มือการออกแบบหน้าจอที่รองรับทุกอุปกรณ์**

Comprehensive guide for building responsive UIs that work on mobile, tablet, and desktop.

**Topics covered:**
- Material-UI breakpoints (xs, sm, md, lg, xl)
- Responsive patterns (Grid, Typography, Drawer, etc.)
- Mobile-first approach
- Testing checklist for all devices
- Common responsive components
- Best practices

**Key patterns:**
```typescript
// Responsive styling
<Box sx={{
  padding: 2,           // Mobile
  md: { padding: 4 },   // Tablet
  lg: { padding: 6 },   // Desktop
}}>

// Conditional rendering
const { isMobile, isDesktop } = useResponsive();
{isMobile && <MobileView />}
{isDesktop && <DesktopView />}
```

---

## 🏗️ Architecture Overview

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: Material-UI v5
- **State Management**: Zustand (client state), React Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Internationalization**: react-i18next (Thai/English)
- **Date/Time**: date-fns + date-fns-tz (Bangkok timezone)
- **HTTP Client**: Axios
- **Notifications**: Notistack

### Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable components
│   │   ├── common/          # Common UI components
│   │   ├── forms/           # Form components
│   │   └── layout/          # Layout components
│   ├── pages/               # Next.js pages
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API services
│   ├── stores/              # Zustand stores
│   ├── theme/               # MUI theme configuration
│   ├── i18n/                # Internationalization
│   ├── validation/          # Zod schemas
│   └── utils/               # Utility functions
├── docs/                    # Documentation (this folder)
└── public/                  # Static assets
```

---

## 🧩 Component Library

### Common Components

All components are exported from `@/components/common`:

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **LoadingSpinner** | Show loading state | [Loading & Notifications](./LOADING_AND_NOTIFICATIONS.md#loadingspinner-component) |
| **DataGrid** | List view with sorting/filtering | Auto-generated from code |
| **ConfirmDialog** | Confirmation dialogs | Auto-generated from code |
| **ErrorBoundary** | Catch React errors | Auto-generated from code |
| **Toast** | Notifications | [Loading & Notifications](./LOADING_AND_NOTIFICATIONS.md#toast-notifications) |
| **Modal** | Modal dialogs | Auto-generated from code |
| **ResponsiveContainer** | Responsive wrapper | [Responsive Design](./RESPONSIVE_DESIGN.md#utilities) |

### Form Components

All form components are exported from `@/components/forms`:

| Component | Purpose | Features |
|-----------|---------|----------|
| **DatePicker** | Date selection | Thai locale, Bangkok timezone |
| **TimePicker** | Time selection | 24-hour format, work hours calculation |
| **AutoComplete** | Autocomplete input | Async search, debouncing |
| **ProjectSelect** | Project selection | Role-based filtering |
| **SkillSelect** | Skill selection | Pre-defined skills |
| **RoleSelect** | Role selection | 8 roles (AM, FM, SE, etc.) |
| **DepartmentSelect** | Department selection | PD01-PD05 |
| **DCAutoComplete** | Daily Contractor search | Search by name/ID |
| **FileUpload** | File upload | Image/document upload |

### Layout Components

| Component | Purpose |
|-----------|---------|
| **Layout** | Page wrapper with navbar and sidebar |
| **Navbar** | Top navigation with role-based menu |
| **ProtectedRoute** | Authentication wrapper for pages |

---

## 🎨 Theming

### Colors

```typescript
// Primary: Blue
primary: '#1976d2'

// Secondary: Pink/Red
secondary: '#dc004e'

// Status colors
error: '#d32f2f'      // Red
warning: '#ed6c02'    // Orange
info: '#0288d1'       // Blue
success: '#2e7d32'    // Green
```

### Typography

- **Font Family**: Sarabun (Thai), Roboto (fallback)
- **Headings**: h1-h6 with 500 font weight
- **Body**: 16px (body1), 14px (body2)
- **Buttons**: No text transform (important for Thai)

### Breakpoints

```typescript
xs: 0px      // Mobile portrait
sm: 600px    // Mobile landscape
md: 900px    // Tablet
lg: 1200px   // Desktop
xl: 1536px   // Wide desktop
```

---

## 🔐 Authentication & Authorization

### Roles

8 roles with different permissions:

- **AM**: Admin Manager (full access)
- **FM**: Finance Manager (wage calculation, reports)
- **SE**: Site Engineer (daily reports, project management)
- **OE**: Office Engineer (data entry, reports)
- **PE**: Project Engineer (project management)
- **PM**: Project Manager (project oversight)
- **PD**: Project Director (all projects)
- **MD**: Managing Director (system-wide access)

### Protected Routes

All pages except login are wrapped with `ProtectedRoute`:

```typescript
import { ProtectedRoute } from '@/components/layout';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Layout>
        {/* Page content */}
      </Layout>
    </ProtectedRoute>
  );
}

// With role requirement
<ProtectedRoute requiredRoles={['AM', 'FM']}>
  {/* Admin/Finance only */}
</ProtectedRoute>
```

---

## 📝 Forms & Validation

### Form Pattern

All forms use React Hook Form + Zod:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { mySchema } from '@/validation/mySchema';

const {
  control,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(mySchema),
  defaultValues: { ... },
});
```

### Validation Schemas

Located in `src/validation/`:

- **baseSchemas.ts**: Reusable validators (email, phone, Thai ID, etc.)
- **userSchema.ts**: User create/edit validation
- **dailyReportSchema.ts**: Daily Report + OT validation
- **projectSchema.ts**: Project validation
- **dcSchema.ts**: Daily Contractor validation

All error messages are in Thai.

---

## 🌐 Internationalization

### Current Languages

- **Thai** (th): Primary language
- **English** (en): Secondary language

### Usage

```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();

// Use translation
<Typography>{t('common.save')}</Typography>

// Change language
i18n.changeLanguage('en');
```

### Translation Files

Located in `src/i18n/locales/`:
- `th/translation.json`
- `en/translation.json`

---

## 🚀 API Integration

### React Query Pattern

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyReportService } from '@/services/dailyReportService';

// Query (GET)
const { data, isLoading, error } = useQuery({
  queryKey: ['dailyReports'],
  queryFn: () => dailyReportService.getAll(),
});

// Mutation (POST/PUT/DELETE)
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (data) => dailyReportService.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['dailyReports'] });
    toast.success('บันทึกสำเร็จ');
  },
  onError: (error) => {
    toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
  },
});
```

### API Services

Located in `src/services/`:
- `authService.ts`: Authentication
- `dailyReportService.ts`: Daily Reports
- `userService.ts`: User management
- `projectService.ts`: Projects
- `dcService.ts`: Daily Contractors
- `wageService.ts`: Wage calculations

---

## 🧪 Testing

### Manual Testing Checklist

For each new page/feature:

**Functionality**
- [ ] All CRUD operations work
- [ ] Form validation works with Thai error messages
- [ ] Loading states show during API calls
- [ ] Success/error toasts appear
- [ ] Role-based access control works

**Responsive Design**
- [ ] Mobile (320px, 375px, 414px)
- [ ] Tablet (768px, 1024px)
- [ ] Desktop (1280px, 1920px)
- [ ] Portrait and landscape orientations

**Accessibility**
- [ ] Keyboard navigation works
- [ ] Touch targets are 44x44px minimum
- [ ] Text is readable (minimum 14px)
- [ ] Color contrast meets WCAG AA

**Performance**
- [ ] Search is < 0.5s
- [ ] Page loads < 2s
- [ ] No unnecessary re-renders

---

## 📖 Development Guidelines

### Code Style

1. **TypeScript**: Use strict typing, avoid `any`
2. **Components**: Functional components with TypeScript interfaces
3. **Naming**: PascalCase for components, camelCase for functions/variables
4. **Comments**: Use JSDoc for complex functions, Thai comments where helpful
5. **Imports**: Use absolute imports with `@/` prefix

### File Structure

```typescript
/**
 * Component Name
 * คำอธิบายภาษาไทย
 *
 * Description in English
 */

import { ... } from '...';

// Interfaces
export interface ComponentNameProps {
  // Props with JSDoc
}

// Component
export const ComponentName: React.FC<ComponentNameProps> = ({ ... }) => {
  // Hooks
  // State
  // Effects
  // Handlers
  // Render

  return (
    // JSX
  );
};

export default ComponentName;
```

### Best Practices

1. **Always use TypeScript types** - No implicit any
2. **Use Material-UI components** - Don't create from scratch
3. **Follow mobile-first approach** - Start with mobile, enhance for desktop
4. **Show loading states** - Use LoadingSpinner for all async operations
5. **Handle errors gracefully** - Show user-friendly Thai messages
6. **Use React Query** - For all server state management
7. **Validate forms** - Use Zod schemas with Thai error messages
8. **Test responsiveness** - Check on actual devices
9. **Follow responsive patterns** - See [Responsive Design](./RESPONSIVE_DESIGN.md)
10. **Use existing components** - Don't reinvent the wheel

---

## 🛠️ Custom Hooks

### useResponsive

Check screen size breakpoints:

```typescript
import { useResponsive } from '@/hooks';

const { isMobile, isTablet, isDesktop } = useResponsive();
```

See [Responsive Design - Utilities](./RESPONSIVE_DESIGN.md#utilities) for full documentation.

### useToast

Show toast notifications:

```typescript
import { useToast } from '@/components/common';

const toast = useToast();

toast.success('บันทึกสำเร็จ');
toast.error('เกิดข้อผิดพลาด');
toast.warning('คำเตือน');
toast.info('ข้อมูล');
```

See [Loading & Notifications - Toast](./LOADING_AND_NOTIFICATIONS.md#toast-notifications) for full documentation.

---

## 🔧 Utilities

### Date/Time Helpers

Located in `src/utils/dateUtils.ts`:

```typescript
import {
  toBangkokTime,
  formatDate,
  formatTime,
  formatDateTime,
  calculateWorkHours,
} from '@/utils/dateUtils';

// Convert UTC to Bangkok
const bangkokDate = toBangkokTime(utcDate);

// Format for display
const formatted = formatDate(date, 'dd/MM/yyyy');
const time = formatTime(date, 'HH:mm');
```

### Validation Helpers

Located in `src/validation/baseSchemas.ts`:

```typescript
import {
  validateDateRange,
  validateTimeRange,
  emptyStringToNull,
  stringToNumber,
} from '@/validation/baseSchemas';
```

---

## 📦 Dependencies

### Core
- `next`: ^14.0.0
- `react`: ^18.0.0
- `typescript`: ^5.0.0

### UI
- `@mui/material`: ^5.14.0
- `@mui/x-data-grid`: ^6.18.0
- `@mui/icons-material`: ^5.14.0
- `notistack`: ^3.0.0

### Forms & Validation
- `react-hook-form`: ^7.48.0
- `zod`: ^3.22.0
- `@hookform/resolvers`: ^3.3.0

### State Management
- `zustand`: ^4.4.0
- `@tanstack/react-query`: ^5.0.0

### Date/Time
- `date-fns`: ^2.30.0
- `date-fns-tz`: ^2.0.0

### HTTP
- `axios`: ^1.6.0

### i18n
- `react-i18next`: ^13.5.0
- `i18next`: ^23.7.0

---

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build

```bash
npm run build
npm start
```

### Type Check

```bash
npm run type-check
```

### Lint

```bash
npm run lint
```

---

## 📞 Support

### Common Issues

**Issue**: Components not found
**Solution**: Check import path uses `@/` prefix

**Issue**: Date/time showing wrong timezone
**Solution**: Use `toBangkokTime()` from dateUtils

**Issue**: Form validation not showing Thai messages
**Solution**: Use schemas from `@/validation/baseSchemas`

**Issue**: Responsive design not working
**Solution**: Use MUI breakpoints in `sx` prop, see [Responsive Design](./RESPONSIVE_DESIGN.md)

### Resources

- [Material-UI Documentation](https://mui.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev/)

---

## 📝 Contributing

When adding new features:

1. Follow existing patterns and conventions
2. Add TypeScript types for all props and functions
3. Include JSDoc comments for complex logic
4. Add Thai translations to i18n files
5. Create Zod validation schemas with Thai error messages
6. Test on mobile, tablet, and desktop
7. Add loading states and error handling
8. Update this documentation if needed

---

## 📄 License

Internal project - All rights reserved

---

**Last Updated**: 2025-10-24

**Version**: 1.0.0 (Phase 6 Complete)
