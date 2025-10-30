/**
 * Member Management List Page
 * หน้ารายการจัดการผู้ใช้
 *
 * Features:
 * - List all users with filters
 * - Role and department filtering
 * - Edit/Delete actions
 * - Admin only access (FR-M-001)
 *
 * User Story: US5 - Member Management (Priority 5)
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  TextField,
  Grid,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Search, FileDownload, CloudUpload } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  memberService,
  type User,
  type UserFilterOptions,
} from '../../services/memberService';
import { BackButton } from '../../components/common/BackButton';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useDeleteConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { RoleSelect } from '../../components/forms/RoleSelect';
import { DepartmentSelect } from '../../components/forms/DepartmentSelect';
import { UserDrawer } from './components/UserDrawer';
import type { UserCreateInput, UserEditInput } from '../../validation/userSchema';
import { Layout, ProtectedRoute } from '@/components/layout';
import { UserImportDialog } from './components/UserImportDialog';

/**
 * Member Management List Page
 *
 * FR-M-001: Admin only access
 * FR-M-002: List users with filters
 */
export default function MemberManagementPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const {
    confirmDelete: showDeleteConfirm,
    ConfirmDialog: DeleteConfirmDialog,
  } = useDeleteConfirmDialog();

  // Filters
  const [filters, setFilters] = useState<UserFilterOptions>({
    search: '',
    roleId: '',
    department: '',
    isActive: undefined,
    page: 1,
    pageSize: 25,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitialValues, setDrawerInitialValues] = useState<Partial<UserEditInput> | undefined>(undefined);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(null);

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingUserId(null);
    setDrawerInitialValues(undefined);
    setDrawerLoading(false);
  };

  const createMutation = useMutation({
    mutationFn: (data: UserCreateInput) => memberService.createUser(data),
    onSuccess: () => {
      showSuccess('สร้างผู้ใช้สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseDrawer();
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserEditInput }) =>
      memberService.updateUser(id, data),
    onSuccess: () => {
      showSuccess('อัปเดตผู้ใช้สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseDrawer();
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการอัปเดตผู้ใช้');
    },
  });

  const userImportMutation = useMutation({
    mutationFn: (file: File) => memberService.importUsersFromFile(file),
    onSuccess: (result: { success: number; failed: number }) => {
      setImportSummary(result);
      const message =
        result.failed > 0
          ? `นำเข้าผู้ใช้สำเร็จ ${result.success} รายการ (ไม่สำเร็จ ${result.failed} รายการ)`
          : `นำเข้าผู้ใช้สำเร็จ ${result.success} รายการ`;
      showSuccess(message);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error || error?.message || 'เกิดข้อผิดพลาดในการนำเข้าผู้ใช้';
      showError(message);
    },
  });

  const handleOpenImportDialog = () => {
    setImportSummary(null);
    userImportMutation.reset();
    setImportDialogOpen(true);
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportSummary(null);
    userImportMutation.reset();
  };

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => memberService.getAllUsers(filters),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: memberService.deleteUser,
    onSuccess: () => {
      showSuccess('ลบผู้ใช้สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้');
    },
  });

  // Handlers
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleRoleChange = (roleId: string) => {
    setFilters((prev) => ({ ...prev, roleId, page: 1 }));
  };

  const handleDepartmentChange = (department: string) => {
    setFilters((prev) => ({ ...prev, department, page: 1 }));
  };

  const handleCreateUser = () => {
    setDrawerMode('create');
    setEditingUserId(null);
    setDrawerInitialValues({ isActive: true, projectLocationIds: [] });
    setDrawerLoading(false);
    setDrawerOpen(true);
  };

  const handleEditUser = async (user: User) => {
    setDrawerMode('edit');
    setDrawerLoading(true);
    setDrawerOpen(true);
    try {
      const detail = await memberService.getUserById(user.id);
      setEditingUserId(user.id);
      setDrawerInitialValues({
        ...detail,
        projectLocationIds: detail.projectLocationIds || [],
        dateOfBirth: detail.dateOfBirth ? new Date(detail.dateOfBirth) : undefined,
        startDate: detail.startDate ? new Date(detail.startDate) : undefined,
      });
    } catch (error: any) {
      showError(error.message || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
      handleCloseDrawer();
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    await showDeleteConfirm(`ผู้ใช้: ${name}`, async () => {
      await deleteMutation.mutateAsync(id);
    });
  };

  const handleDrawerSubmit = async (data: UserCreateInput | UserEditInput) => {
    if (drawerMode === 'create') {
      await createMutation.mutateAsync(data as UserCreateInput);
    } else if (editingUserId) {
      await updateMutation.mutateAsync({ id: editingUserId, data: data as UserEditInput });
    } else {
      showError('ไม่พบข้อมูลผู้ใช้สำหรับการแก้ไข');
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage + 1 }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters((prev) => ({ ...prev, pageSize: newPageSize, page: 1 }));
  };

  // DataGrid columns
  const columns: GridColDef[] = [
    {
      field: 'employeeId',
      headerName: 'รหัสพนักงาน',
      width: 130,
    },
    {
      field: 'username',
      headerName: 'Username',
      width: 150,
    },
    {
      field: 'name',
      headerName: 'ชื่อ-นามสกุล',
      width: 200,
      flex: 1,
    },
    {
      field: 'roleId',
      headerName: 'Role',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        // TODO: Map roleId to role name
        return <Chip label={params.value} size="small" />;
      },
    },
    {
      field: 'department',
      headerName: 'สังกัด',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'isActive',
      headerName: 'สถานะ',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'ใช้งาน' : 'ปิดการใช้งาน'}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="แก้ไข">
            <IconButton
              size="small"
              onClick={() => handleEditUser(params.row as User)}
              color="primary"
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton
              size="small"
              onClick={() => handleDeleteUser(params.row.id, params.row.name)}
              color="error"
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const importErrorMessage = userImportMutation.isError
    ? (userImportMutation.error as any)?.response?.data?.error ||
      (userImportMutation.error as Error)?.message ||
      'เกิดข้อผิดพลาดในการนำเข้าผู้ใช้'
    : null;

  const pageContent = (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <BackButton href="/management" />
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          จัดการผู้ใช้งาน
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<FileDownload />}
            component="a"
            href="/user-data-template.csv"
            download
          >
            ดาวน์โหลดเทมเพลต
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<CloudUpload />}
            onClick={handleOpenImportDialog}
          >
            นำเข้าจากไฟล์
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleCreateUser}
          >
            สร้างผู้ใช้ใหม่
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          ค้นหาและกรอง
        </Typography>
        <Grid container spacing={2} alignItems="center">
          {/* Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="ค้นหาชื่อ, รหัสพนักงาน, Username..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Grid>

          {/* Role Filter */}
          <Grid item xs={12} md={3}>
            <RoleSelect
              value={filters.roleId || ''}
              onChange={handleRoleChange}
              label="กรอง Role"
              showAll
            />
          </Grid>

          {/* Department Filter */}
          <Grid item xs={12} md={3}>
            <DepartmentSelect
              value={filters.department || ''}
              onChange={handleDepartmentChange}
              label="กรองสังกัด"
              showAll
            />
          </Grid>

          {/* Reset Filters */}
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() =>
                setFilters({
                  search: '',
                  roleId: '',
                  department: '',
                  isActive: undefined,
                  page: 1,
                  pageSize: 25,
                })
              }
            >
              ล้างตัวกรอง
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Table */}
      <Paper sx={{ width: '100%' }}>
        {isLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="large" />
          </Box>
        ) : (
          <DataGrid
            rows={data?.users || []}
            columns={columns}
            pagination
            page={(filters.page || 1) - 1}
            pageSize={filters.pageSize || 25}
            rowsPerPageOptions={[10, 25, 50, 100]}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            rowCount={data?.total || 0}
            paginationMode="server"
            autoHeight
            disableSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid #f0f0f0',
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#fafafa',
                borderBottom: '2px solid #e0e0e0',
              },
            }}
          />
        )}
      </Paper>

      <DeleteConfirmDialog />

      <UserDrawer
        title={drawerMode === 'create' ? 'สร้างผู้ใช้ใหม่' : 'แก้ไขผู้ใช้'}
        key={drawerMode === 'edit' ? editingUserId ?? 'edit' : 'create'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        mode={drawerMode}
        defaultValues={drawerInitialValues}
        isLoading={
          drawerMode === 'create'
            ? createMutation.isPending
            : updateMutation.isPending
        }
        loading={drawerLoading}
        onSubmit={handleDrawerSubmit}
      />
      <UserImportDialog
        open={importDialogOpen}
        onClose={handleCloseImportDialog}
        onImport={(file) => userImportMutation.mutate(file)}
        isLoading={userImportMutation.isPending}
        errorMessage={importErrorMessage}
        summary={importSummary}
      />
    </Container>
  );

  if (error) {
    return (
      <ProtectedRoute requiredRoles={['GOD', 'AM', 'FM', 'OE', 'PE', 'PM', 'PD', 'MD']}>
        <Layout>
          <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography color="error">เกิดข้อผิดพลาด: {(error as Error).message}</Typography>
          </Container>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['GOD', 'AM', 'FM', 'OE', 'PE', 'PM', 'PD', 'MD']}>
      <Layout>{pageContent}</Layout>
    </ProtectedRoute>
  );
}
