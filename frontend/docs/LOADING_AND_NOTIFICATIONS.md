# Loading States & Notifications Guide
## คู่มือการจัดการสถานะการโหลดและการแจ้งเตือน

This guide shows how to implement loading states and toast notifications consistently across the application.

## Table of Contents
- [Loading States with React Query](#loading-states-with-react-query)
- [LoadingSpinner Component](#loadingspinner-component)
- [Toast Notifications](#toast-notifications)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Loading States with React Query

React Query automatically provides loading states for all API calls. Here's the standard pattern:

### Pattern 1: List Pages with Loading State

```typescript
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/common';
import { DataGrid } from '@/components/common';

export const DailyReportsListPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dailyReports'],
    queryFn: () => dailyReportService.getAll(),
  });

  // Show loading spinner while fetching
  if (isLoading) {
    return <LoadingSpinner message="กำลังโหลดรายการบันทึก..." />;
  }

  // Show error message
  if (error) {
    return <Alert severity="error">เกิดข้อผิดพลาดในการโหลดข้อมูล</Alert>;
  }

  return (
    <DataGrid
      rows={data || []}
      columns={columns}
      loading={isLoading}
      error={error?.message}
    />
  );
};
```

### Pattern 2: Dashboard with Multiple Queries

```typescript
import { useQueries } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/common';

export const DashboardPage = () => {
  const results = useQueries({
    queries: [
      { queryKey: ['stats'], queryFn: () => statsService.getStats() },
      { queryKey: ['recentReports'], queryFn: () => reportsService.getRecent() },
      { queryKey: ['scanData'], queryFn: () => scanService.getData() },
    ],
  });

  // Check if any query is loading
  const isLoading = results.some((result) => result.isLoading);

  // Check if all queries are successful
  const isSuccess = results.every((result) => result.isSuccess);

  if (isLoading) {
    return <LoadingSpinner message="กำลังโหลดข้อมูล..." />;
  }

  const [statsData, reportsData, scanData] = results.map((r) => r.data);

  return (
    <Box>
      <StatsCards stats={statsData} />
      <RecentReports reports={reportsData} />
      <ScanDataWidget data={scanData} />
    </Box>
  );
};
```

### Pattern 3: Form Submission with Loading

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/common';
import { Button, CircularProgress } from '@mui/material';

export const DailyReportForm = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => dailyReportService.create(data),
    onSuccess: () => {
      toast.success('บันทึกข้อมูลสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['dailyReports'] });
      router.push('/daily-reports');
    },
    onError: (error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}

      <Button
        type="submit"
        variant="contained"
        disabled={mutation.isPending}
        startIcon={mutation.isPending ? <CircularProgress size={16} /> : null}
      >
        {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </form>
  );
};
```

### Pattern 4: Infinite Scroll with Loading

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/common';

export const InfiniteListPage = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['reports'],
    queryFn: ({ pageParam = 0 }) =>
      reportsService.getPage(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box>
      {data?.pages.map((page) => (
        page.items.map((item) => <ItemCard key={item.id} item={item} />)
      ))}

      {hasNextPage && (
        <Button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
        </Button>
      )}
    </Box>
  );
};
```

---

## LoadingSpinner Component

The `LoadingSpinner` component provides a consistent loading UI.

### Props

```typescript
interface LoadingSpinnerProps {
  message?: string;           // Loading message (default: "กำลังโหลด...")
  size?: 'small' | 'medium' | 'large';  // Spinner size
  fullPage?: boolean;         // Show as full-page overlay
}
```

### Usage Examples

**Basic Usage**
```typescript
<LoadingSpinner />
```

**With Custom Message**
```typescript
<LoadingSpinner message="กำลังโหลดข้อมูลแรงงาน..." />
```

**Small Size for Inline Loading**
```typescript
<LoadingSpinner size="small" message="โหลด..." />
```

**Full Page Overlay**
```typescript
<LoadingSpinner fullPage message="กำลังประมวลผล..." />
```

**In DataGrid**
```typescript
<DataGrid
  rows={rows}
  columns={columns}
  loading={isLoading}  // DataGrid handles loading state internally
/>
```

---

## Toast Notifications

Use `useToast` hook for success/error/warning/info messages.

### Basic Usage

```typescript
import { useToast } from '@/components/common';

export const MyComponent = () => {
  const toast = useToast();

  const handleSuccess = () => {
    toast.success('บันทึกข้อมูลสำเร็จ');
  };

  const handleError = () => {
    toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
  };

  const handleWarning = () => {
    toast.warning('คำเตือน: ข้อมูลอาจไม่สมบูรณ์');
  };

  const handleInfo = () => {
    toast.info('ข้อมูล: รอบค่าแรงจะเริ่มในอีก 5 วัน');
  };

  return <>{/* Component JSX */}</>;
};
```

### With React Query Mutations

```typescript
const mutation = useMutation({
  mutationFn: (data) => apiService.create(data),
  onSuccess: (data) => {
    toast.success('สร้างข้อมูลสำเร็จ');
  },
  onError: (error) => {
    toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
  },
});
```

### Thai Messages for Common Operations

```typescript
// Success messages
toast.success('บันทึกข้อมูลสำเร็จ');           // Save success
toast.success('ลบข้อมูลสำเร็จ');              // Delete success
toast.success('อัพเดทข้อมูลสำเร็จ');           // Update success
toast.success('นำเข้าข้อมูลสำเร็จ');           // Import success
toast.success('ส่งออกข้อมูลสำเร็จ');           // Export success

// Error messages
toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');   // Generic error
toast.error('ไม่พบข้อมูล');                   // Not found
toast.error('ไม่มีสิทธิ์เข้าถึง');             // Unauthorized
toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');      // Validation error

// Warning messages
toast.warning('ข้อมูลยังไม่สมบูรณ์');          // Incomplete data
toast.warning('กรุณาตรวจสอบข้อมูลอีกครั้ง');   // Double-check
toast.warning('มีข้อมูลซ้ำในระบบ');            // Duplicate

// Info messages
toast.info('กำลังประมวลผล...');               // Processing
toast.info('รอบค่าแรงจะเริ่มในอีก 5 วัน');    // Upcoming period
```

---

## Error Handling

### API Error Handling Pattern

```typescript
import { AxiosError } from 'axios';
import { useToast } from '@/components/common';

export const MyComponent = () => {
  const toast = useToast();

  const handleApiError = (error: unknown) => {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      switch (status) {
        case 400:
          toast.error(`ข้อมูลไม่ถูกต้อง: ${message}`);
          break;
        case 401:
          toast.error('กรุณาเข้าสู่ระบบใหม่');
          router.push('/login');
          break;
        case 403:
          toast.error('คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้');
          break;
        case 404:
          toast.error('ไม่พบข้อมูล');
          break;
        case 500:
          toast.error('เกิดข้อผิดพลาดในระบบ กรุณาติดต่อผู้ดูแลระบบ');
          break;
        default:
          toast.error(`เกิดข้อผิดพลาด: ${message || error.message}`);
      }
    } else {
      toast.error('เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => apiService.create(data),
    onError: handleApiError,
  });

  return <>{/* Component JSX */}</>;
};
```

### Form Validation Errors

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/components/common';

export const MyForm = () => {
  const toast = useToast();

  const {
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(mySchema),
  });

  const onSubmit = async (data) => {
    try {
      await apiService.create(data);
      toast.success('บันทึกข้อมูลสำเร็จ');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูลอีกครั้ง');
    }
  };

  const onError = (errors) => {
    // Show first validation error
    const firstError = Object.values(errors)[0]?.message;
    if (firstError) {
      toast.error(firstError as string);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)}>
      {/* Form fields */}
    </form>
  );
};
```

---

## Best Practices

### 1. Always Show Loading State
```typescript
// ✅ Good: Clear loading feedback
if (isLoading) {
  return <LoadingSpinner message="กำลังโหลด..." />;
}

// ❌ Bad: No loading feedback
const data = useQuery(...).data;
```

### 2. Disable Buttons During Submission
```typescript
// ✅ Good: Prevent double submission
<Button
  type="submit"
  disabled={mutation.isPending}
  startIcon={mutation.isPending ? <CircularProgress size={16} /> : null}
>
  {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
</Button>

// ❌ Bad: User can click multiple times
<Button type="submit">บันทึก</Button>
```

### 3. Show Success/Error Feedback
```typescript
// ✅ Good: User knows what happened
const mutation = useMutation({
  mutationFn: apiService.create,
  onSuccess: () => toast.success('บันทึกสำเร็จ'),
  onError: (error) => toast.error(`เกิดข้อผิดพลาด: ${error.message}`),
});

// ❌ Bad: Silent failures
const mutation = useMutation({
  mutationFn: apiService.create,
});
```

### 4. Handle Empty States
```typescript
// ✅ Good: Show empty state
if (isLoading) return <LoadingSpinner />;
if (data?.length === 0) return <EmptyState message="ไม่มีข้อมูล" />;
return <DataGrid rows={data} />;

// ❌ Bad: Shows empty grid
if (isLoading) return <LoadingSpinner />;
return <DataGrid rows={data || []} />;
```

### 5. Use Optimistic Updates
```typescript
// ✅ Good: Instant feedback
const mutation = useMutation({
  mutationFn: apiService.update,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    const previous = queryClient.getQueryData(['items']);
    queryClient.setQueryData(['items'], (old) => [...old, newData]);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['items'], context.previous);
    toast.error('เกิดข้อผิดพลาด');
  },
  onSuccess: () => {
    toast.success('บันทึกสำเร็จ');
  },
});
```

### 6. Debounce Search Inputs
```typescript
// ✅ Good: Reduce API calls
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 500);

const { data, isLoading } = useQuery({
  queryKey: ['items', debouncedSearch],
  queryFn: () => apiService.search(debouncedSearch),
  enabled: debouncedSearch.length >= 2,
});

// ❌ Bad: API call on every keystroke
const { data } = useQuery({
  queryKey: ['items', search],
  queryFn: () => apiService.search(search),
});
```

### 7. Consistent Error Messages
```typescript
// ✅ Good: User-friendly Thai messages
toast.error('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');

// ❌ Bad: Technical English errors
toast.error('Failed to POST /api/daily-reports: 500 Internal Server Error');
```

---

## Component Loading States Checklist

Use this checklist when implementing a new page/component:

- [ ] Show `LoadingSpinner` during initial data fetch
- [ ] Disable form submit button during mutation
- [ ] Show loading text on button during submission ("กำลังบันทึก...")
- [ ] Show success toast on successful mutation
- [ ] Show error toast on failed mutation with Thai message
- [ ] Handle empty state (no data)
- [ ] Handle error state (failed to load)
- [ ] Test loading states work correctly
- [ ] Test that UI doesn't break during loading
- [ ] Ensure loading spinners are centered and visible

---

## Testing Loading States

### Manual Testing
1. **Slow network**: Use browser DevTools Network throttling (Slow 3G)
2. **Loading state**: Verify spinner appears immediately
3. **Success state**: Verify toast appears and data updates
4. **Error state**: Verify error toast with Thai message
5. **Button states**: Verify buttons disable during submission
6. **Empty state**: Clear data and verify empty state shows

### Automated Testing
```typescript
import { render, screen, waitFor } from '@testing-library/react';

test('shows loading spinner while fetching', async () => {
  render(<MyComponent />);

  expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText('กำลังโหลด...')).not.toBeInTheDocument();
  });
});

test('shows success toast on save', async () => {
  const { user } = setup(<MyForm />);

  await user.click(screen.getByRole('button', { name: 'บันทึก' }));

  await waitFor(() => {
    expect(screen.getByText('บันทึกข้อมูลสำเร็จ')).toBeInTheDocument();
  });
});
```

---

## Common Patterns Summary

| Scenario | Loading State | Success Feedback | Error Feedback |
|----------|--------------|------------------|----------------|
| **List Page** | `<LoadingSpinner />` | - | Error alert above grid |
| **Form Submit** | Disabled button + spinner | Success toast + redirect | Error toast |
| **Delete** | Loading on button | Success toast + refresh | Error toast |
| **Import** | Full page overlay | Success toast + count | Error toast + details |
| **Export** | Loading on button | Success toast + download | Error toast |
| **Search** | Small spinner in input | - | "ไม่พบผลลัพธ์" message |

---

## References

- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Notistack Documentation](https://notistack.com/getting-started)
- [Material-UI Loading Patterns](https://mui.com/material-ui/react-progress/)
