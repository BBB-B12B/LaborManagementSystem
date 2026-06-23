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
import { memberService, type User, type UserFilterOptions } from '../../services/memberService';

import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useDeleteConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { RoleSelect } from '../../components/forms/RoleSelect';
import { DepartmentSelect } from '../../components/forms/DepartmentSelect';
import { UserDrawer } from '@/page-components/member-management/components/UserDrawer';
import type {
  UserCreateFormData as UserCreateInput,
  UserUpdateFormData as UserEditInput,
} from '@/validation/userManagementSchema';
import { Layout, ProtectedRoute } from '@/components/layout';
import { UserImportDialog } from '@/page-components/member-management/components/UserImportDialog';
import { api } from '@/services/api/client';

/**
 * Member Management List Page
 *
 * FR-M-001: Admin only access
 * FR-M-002: List users with filters
 */
export default function MemberManagementPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const { confirmDelete: showDeleteConfirm, ConfirmDialog: DeleteConfirmDialog } =
    useDeleteConfirmDialog();

  // Filters
  const [filters, setFilters] = useState<UserFilterOptions>({
    search: '',
    roleId: '',
    department: '',
    isActive: undefined,
    page: 1,
    pageSize: 10,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitialValues, setDrawerInitialValues] = useState<
    Partial<UserEditInput> | undefined
  >(undefined);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(
    null
  );

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

  const handleRoleChange = (roleId: string | null) => {
    setFilters((prev) => ({ ...prev, roleId: roleId || '', page: 1 }));
  };

  const handleDepartmentChange = (department: string | null) => {
    setFilters((prev) => ({ ...prev, department: department || '', page: 1 }));
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

  const handleDownloadTemplate = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Users');

    ws.columns = [
      { header: 'Employee ID', key: 'empId', width: 16 },
      { header: 'Username', key: 'username', width: 18 },
      { header: 'Password', key: 'password', width: 16 },
      { header: 'Full Name', key: 'fullName', width: 26 },
      { header: 'Role ID', key: 'roleId', width: 12 },
      { header: 'Department', key: 'dept', width: 14 },
      { header: 'Project Location IDs (comma-separated)', key: 'projects', width: 42 },
      { header: 'Is Active (TRUE/FALSE)', key: 'isActive', width: 22 },
      { header: 'Notes', key: 'notes', width: 28 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    ws.addRow(['EMP001', 'somchai.j', 'Pass@1234', 'สมชาย ใจดี', 'FM', 'PD01', '', 'TRUE', 'หัวหน้าไซต์']);

    for (let row = 2; row <= 1000; row++) {
      ws.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"AM,FM,SE,OE,PE,PM,PD,MD,LD"'],
      };
      ws.getCell(`F${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"PD01,PD02,PD03,PD04,PD05,HO,WH"'],
      };
      ws.getCell(`H${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"TRUE,FALSE"'],
      };
    }

    // Fetch projects → hidden reference sheet so users can look up IDs
    try {
      const res = await (api.get('/projects/active') as Promise<any>);
      const projectList: { id: string; projectName: string; department: string }[] =
        Array.isArray(res) ? res : (res.items ?? []);

      if (projectList.length > 0) {
        const refWs = wb.addWorksheet('โครงการ (อ้างอิง)');
        refWs.columns = [
          { header: 'ชื่อโครงการ / หน่วยงาน', key: 'name', width: 40 },
          { header: 'Project ID (ใส่ในคอลัมน์ G คั่นด้วย ,)', key: 'id', width: 40 },
        ];
        refWs.getRow(1).font = { bold: true };
        projectList.forEach(p => refWs.addRow([p.projectName, p.id]));
      }
    } catch { /* skip if fetch fails */ }

    ws.getCell('G1').note =
      'Project Location IDs\n' +
      '• ใส่ Firestore ID คั่นด้วย , (comma)\n' +
      '• ดู ID ได้ที่ sheet "โครงการ (อ้างอิง)"\n' +
      '• ผู้อยู่หลายโครงการ: id1,id2,id3\n' +
      '• หรือเว้นว่างแล้วเลือกใน Wizard หลังอัปโหลด';

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'user-data-template.xlsx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            onClick={handleDownloadTemplate}
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
          <Button variant="contained" color="info" startIcon={<Add />} onClick={handleCreateUser}>
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
            />
          </Grid>

          {/* Department Filter */}
          <Grid item xs={12} md={3}>
            <DepartmentSelect
              value={filters.department || ''}
              onChange={handleDepartmentChange}
              label="กรองสังกัด"
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
            pageSize={filters.pageSize || 10}
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
        key={drawerMode === 'edit' ? (editingUserId ?? 'edit') : 'create'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        mode={drawerMode}
        defaultValues={drawerInitialValues}
        isLoading={drawerMode === 'create' ? createMutation.isPending : updateMutation.isPending}
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
