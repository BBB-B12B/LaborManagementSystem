# Authorization Guide

## Overview

Labor Management System ใช้ **Role-Based Access Control (RBAC)** สำหรับควบคุมการเข้าถึงข้อมูลและฟีเจอร์ต่างๆ

## Role Hierarchy

| Level | Role Code | Thai Name | English Name | Key Permissions |
|-------|-----------|-----------|--------------|-----------------|
| 1 | MD | กรรมการผู้จัดการ | Managing Director | All access, all projects |
| 2 | PD | ผู้อำนวยการโครงการ | Project Director | Department projects, wage calculation |
| 3 | PM | ผู้จัดการโครงการ | Project Manager | Project creation, wage calculation |
| 4 | PE | วิศวกรโครงการ | Project Engineer | Project creation |
| 5 | OE | วิศวกรสำนักงาน | Office Engineer | Project creation |
| 6 | SE | วิศวกรประจำหน้างาน | Site Engineer | Daily report, DC management |
| 7 | FM | หัวหน้างาน | Foreman | Daily report, DC management |
| 8 | AM | ผู้ดูแลระบบ | Admin | All management features |

## Feature Access Matrix

| Feature | AM | FM | SE | OE | PE | PM | PD | MD |
|---------|----|----|----|----|----|----|----|----|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Daily Report (View) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Daily Report (Create/Edit) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overtime Management | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Project Management | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Member Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DC Management | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Wage Calculation | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ScanData Upload | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ScanData Monitoring | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

## Functional Requirements

### FR-A-003: Project Management Access
- **Allowed**: Admin, OE, PE, PM, PD
- **Denied**: FM, SE, MD (MD has all access anyway)

### FR-A-004: Member Management Access
- **Allowed**: Admin only
- **Purpose**: Prevent unauthorized user creation/modification

### FR-A-005: DC Management Access
- **Allowed**: Admin, Foreman
- **Purpose**: Only authorized personnel can manage daily contractors

### FR-A-006: Wage Calculation Access
- **Allowed**: Admin, PM, PD, MD
- **Purpose**: Sensitive financial information

### FR-A-007: Department Isolation (PD)
- **Rule**: PD can only access projects in their own department (PD01-PD05)
- **Implementation**: Auto-filter queries by department

### FR-A-008: All Projects Access (MD)
- **Rule**: MD can access all projects across all departments
- **Implementation**: Skip department filter

## Backend Implementation

### 1. Middleware Usage

#### Authentication
```typescript
import { authenticate } from '@/api/middleware/auth';

// Apply to all protected routes
router.use('/api/*', authenticate);
```

#### Role-Based Access Control
```typescript
import { checkRole } from '@/api/middleware/auth';

// Only Admin and FM can access
router.post('/api/daily-contractors',
  authenticate,
  checkRole(['AM', 'FM']),
  createDC
);

// Only management can access
router.get('/api/wage-calculation',
  authenticate,
  checkRole(['AM', 'PM', 'PD', 'MD']),
  getWages
);
```

#### Department Isolation
```typescript
import { checkDepartmentAccess } from '@/api/middleware/auth';

// Auto-filter by department for PD role
router.get('/api/projects',
  authenticate,
  checkDepartmentAccess,
  getProjects
);
```

#### Project Access Control
```typescript
import { checkProjectAccess } from '@/api/middleware/auth';

// Check if user has access to specific project
router.get('/api/projects/:id',
  authenticate,
  checkProjectAccess,
  getProjectById
);
```

### 2. Route Protection Examples

#### Daily Reports
```typescript
// All authenticated users can view
router.get('/api/daily-reports', authenticate, getDailyReports);

// Only authorized roles can create/edit
router.post('/api/daily-reports',
  authenticate,
  checkRole(['SE', 'OE', 'PE', 'PM', 'PD', 'AM']),
  createDailyReport
);
```

#### Member Management
```typescript
// Admin only
router.use('/api/users',
  authenticate,
  checkRole(['AM'])
);
```

#### Wage Calculation
```typescript
// Management only
router.use('/api/wage-periods',
  authenticate,
  checkRole(['AM', 'PM', 'PD', 'MD'])
);
```

### 3. Service-Level Authorization

```typescript
// In service methods
export async function getProjects(userId: string, userRole: UserRole) {
  // MD can see all
  if (userRole === 'MD') {
    return await getAllProjects();
  }

  // PD restricted to department
  if (userRole === 'PD') {
    const user = await getUserById(userId);
    return await getProjectsByDepartment(user.department);
  }

  // Others see accessible projects only
  const user = await getUserById(userId);
  return await getProjectsByIds(user.projectLocationIds);
}
```

## Frontend Implementation

### 1. Permission Utilities

```typescript
import { Permissions } from '@/utils/permissions';

// Check permissions
const canEdit = Permissions.canEditDailyReport(user.roleCode);
const canAccessWage = Permissions.canAccessWageCalculation(user.roleCode);
```

### 2. React Hook

```typescript
import { usePermissions } from '@/utils/permissions';

function MyComponent() {
  const { user } = useAuthStore();
  const permissions = usePermissions(user);

  return (
    <div>
      {permissions.canAccessWageCalculation && (
        <Button onClick={() => router.push('/wage-calculation')}>
          คำนวณค่าแรง
        </Button>
      )}
    </div>
  );
}
```

### 3. Menu Filtering

```typescript
// Navbar.tsx
const menuItems: NavMenuItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <DashboardIcon />,
    roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'],
  },
  {
    label: 'Member Management',
    path: '/members',
    icon: <PeopleIcon />,
    roles: ['AM'], // Admin only
  },
  // ...
];

const visibleMenuItems = menuItems.filter((item) => {
  if (!user || !user.roleCode) return false;
  return item.roles.includes(user.roleCode);
});
```

### 4. Button Disabling

```typescript
<Button
  variant="contained"
  disabled={!Permissions.canEditDailyReport(user.roleCode)}
  onClick={handleEdit}
>
  แก้ไข
</Button>
```

### 5. Conditional Rendering

```typescript
{Permissions.canAccessMemberManagement(user.roleCode) && (
  <MenuItem onClick={() => router.push('/members')}>
    <PeopleIcon /> จัดการสมาชิก
  </MenuItem>
)}
```

## Security Best Practices

### 1. Password Hashing
- **Algorithm**: bcrypt
- **Rounds**: 10
- **Implementation**: Backend only, never send plain passwords

```typescript
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
```

### 2. Input Validation
- **Library**: express-validator (backend), Zod (frontend)
- **Rule**: Validate all user inputs
- **Protection**: Against injection attacks

### 3. CORS Configuration
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

### 4. Rate Limiting (Optional)
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 5. Environment Variables
- Store sensitive data in `.env`
- Never commit `.env` to git
- Use `.env.example` for documentation

### 6. XSS Protection
- Sanitize user input
- Use Content-Security-Policy headers
- Escape output in templates

## Testing

### Unit Tests
```typescript
describe('RBAC Middleware', () => {
  it('should allow Admin to access member management', async () => {
    const req = { user: { roleCode: 'AM' } };
    const middleware = checkRole(['AM']);
    await expect(middleware(req, res, next)).resolves.not.toThrow();
  });

  it('should deny FM from accessing member management', async () => {
    const req = { user: { roleCode: 'FM' } };
    const middleware = checkRole(['AM']);
    await expect(middleware(req, res, next)).rejects.toThrow('Access denied');
  });
});
```

### Integration Tests
```typescript
describe('Protected Routes', () => {
  it('should return 403 for unauthorized role', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', fmUserToken);

    expect(response.status).toBe(403);
  });

  it('should return 200 for authorized role', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', adminUserToken);

    expect(response.status).toBe(200);
  });
});
```

## Troubleshooting

### Common Issues

#### 1. "Access denied" error even with correct role
- Check if `user.roleCode` is set correctly
- Verify role code matches exactly (case-sensitive)
- Check middleware order (authenticate must come before checkRole)

#### 2. Menu items not showing
- Verify `user.roleCode` is populated
- Check Navbar menuItems array has correct roles
- Ensure user object is loaded from auth store

#### 3. Department filter not working for PD
- Verify checkDepartmentAccess middleware is applied
- Check user.department is set correctly
- Ensure service methods respect department filter

## References

- Data Model: [data-model.md](../specs/001-labor-daily-report/data-model.md)
- Functional Requirements: [spec.md](../specs/001-labor-daily-report/spec.md)
- API Contracts: [contracts/](../specs/001-labor-daily-report/contracts/)
