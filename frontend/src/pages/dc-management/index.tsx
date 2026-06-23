/**
 * DC Management List Page
 * หน้ารายการจัดการแรงงานรายวัน
 *
 * Features:
 * - List all DCs with filters
 * - AutoComplete search (SC-008: <0.5s)
 * - Skill and project filtering
 * - Edit/Delete actions
 * - Authorization: FM, SE, PM, Admin (FR-DC-001)
 *
 * User Story: US6 - DC Management (Priority 6)
 */

import React, { useMemo, useState } from 'react';
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
  Tabs,
  Tab,
} from '@mui/material';
import { Add, Edit, Delete, Search, FileDownload, CloudUpload } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dcService,
  type DailyContractor,
  type DCFilterOptions,
  type DCImportSummary,
} from '../../services/dcService';
import { projectService, type Project } from '@/services/projectService';

import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useDeleteConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { SkillSelect } from '../../components/forms/SkillSelect';
import { ProjectSelect } from '../../components/forms/ProjectSelect';
import { Layout, ProtectedRoute } from '@/components/layout';
import { DCModal } from '@/page-components/dc-management/components/DCModal';
import { DCImportDialog } from '@/page-components/dc-management/components/DCImportDialog';
import type { DCCreateInput, DCEditInput } from '@/validation/dcSchema';
import { useAuthStore } from '@/store/authStore';

const normalizeDCFormPayload = <T extends DCCreateInput | DCEditInput>(payload: T): T => {
  const toStringOrEmpty = (value?: string | null) => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const toIsoOrEmpty = (value?: Date | string | null) => {
    if (!value) return '';
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }
    return value;
  };

  return {
    ...payload,
    employeeId: toStringOrEmpty(payload.employeeId),
    name: toStringOrEmpty(payload.name),
    username: toStringOrEmpty(payload.username as string | null | undefined),
    password: toStringOrEmpty(payload.password as string | null | undefined),
    skillId: toStringOrEmpty(payload.skillId),
    projectLocationId: toStringOrEmpty(payload.projectLocationId),
    startDate: toIsoOrEmpty(payload.startDate as Date | string | null | undefined) as any,
    isActive: payload.isActive ?? true,
    paidLeave: payload.paidLeave !== undefined && (payload.paidLeave as any) !== '' ? Number(payload.paidLeave) : undefined,
    unpaidLeave: payload.unpaidLeave !== undefined && (payload.unpaidLeave as any) !== '' ? Number(payload.unpaidLeave) : undefined,
    lateMinutes: payload.lateMinutes !== undefined && (payload.lateMinutes as any) !== '' ? Number(payload.lateMinutes) : undefined,
    earlyLeaveMinutes: payload.earlyLeaveMinutes !== undefined && (payload.earlyLeaveMinutes as any) !== '' ? Number(payload.earlyLeaveMinutes) : undefined,
    absentDays: payload.absentDays !== undefined && (payload.absentDays as any) !== '' ? Number(payload.absentDays) : undefined,
  };
};

/**
 * DC Management List Page
 *
 * FR-DC-001: FM, SE, PM, Admin can manage DC
 * FR-DC-003: Auto Complete search
 * SC-008: Search performance <0.5s
 */
export default function DCManagementPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const { confirmDelete: showDeleteConfirm, ConfirmDialog: DeleteConfirmDialog } =
    useDeleteConfirmDialog();
  const { user } = useAuthStore();

  // Filters
  const [filters, setFilters] = useState<DCFilterOptions>({
    search: '',
    skillId: '',
    projectLocationId: '',
    isActive: undefined,
    page: 1,
    pageSize: 10,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitialValues, setDrawerInitialValues] = useState<Partial<DCEditInput> | undefined>(
    undefined
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<DCImportSummary | null>(null);

  // Fetch all projects for display mapping
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });

  const projectDepartmentMap = useMemo(() => {
    const map = new Map<string, string>();
    (projects as Project[]).forEach((proj) => {
      if (proj.department) {
        map.set(proj.id, proj.department);
      }
    });
    return map;
  }, [projects]);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (projects as Project[]).forEach((proj) => {
      if (proj.projectName) {
        map.set(proj.id, proj.projectName);
      }
    });
    return map;
  }, [projects]);

  // Fetch DCs
  const { data, isLoading, error } = useQuery({
    queryKey: ['dailyContractors', filters],
    queryFn: () => dcService.getAllDCs(filters),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: dcService.deleteDC,
    onSuccess: () => {
      showSuccess('ลบแรงงานรายวันสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['dailyContractors'] });
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการลบแรงงานรายวัน');
    },
  });

  // Handlers
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleSkillChange = (skillId: string | null) => {
    setFilters((prev) => ({ ...prev, skillId: skillId || '', page: 1 }));
  };

  const handleProjectChange = (projectLocationId: string) => {
    setFilters((prev) => ({ ...prev, projectLocationId, page: 1 }));
  };

  const handleOpenImport = () => {
    setImportResult(null);
    importMutation.reset();
    setImportDialogOpen(true);
  };

  const handleCloseImport = () => {
    setImportDialogOpen(false);
    setImportResult(null);
    importMutation.reset();
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setDrawerLoading(false);
    setEditingId(null);
    setDrawerInitialValues(undefined);
  };

  const createMutation = useMutation({
    mutationFn: dcService.createDC,
    onSuccess: () => {
      showSuccess('สร้างแรงงานรายวันสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['dailyContractors'] });
      handleCloseDrawer();
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการสร้างแรงงานรายวัน');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DCEditInput }) => dcService.updateDC(id, data),
    onSuccess: () => {
      showSuccess('อัปเดตแรงงานรายวันสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['dailyContractors'] });
      handleCloseDrawer();
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการอัปเดตแรงงานรายวัน');
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => dcService.importDailyContractorsFromFile(file),
    onSuccess: (result: DCImportSummary) => {
      setImportResult(result);
      const message =
        result.errors.length > 0
          ? `นำเข้าแรงงานสำเร็จ ${result.imported}/${result.total} รายการ (บางรายการถูกข้าม)`
          : `นำเข้าแรงงานสำเร็จ ${result.imported}/${result.total} รายการ`;
      showSuccess(message);
      queryClient.invalidateQueries({ queryKey: ['dailyContractors'] });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error || error?.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูลแรงงาน';
      showError(message);
    },
  });

  const handleDownloadTemplate = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('DC Workers');

    ws.columns = [
      { header: 'EmployeeName', key: 'name', width: 26 },
      { header: 'รหัสพนักงาน', key: 'empId', width: 16 },
      { header: 'ตำแหน่ง', key: 'position', width: 16 },
      { header: 'หน่วยงาน', key: 'dept', width: 30 },
      { header: 'วันเกิด(วว/ดด/ปปปป)', key: 'dob', width: 22, numFmt: '@' },
      { header: 'วันเริ่มงาน(วว/ดด/ปปปป)', key: 'start', width: 24, numFmt: '@' },
      { header: 'สถานะใช้งาน(TRUE/FALSE)', key: 'isActive', width: 24 },
      { header: 'ลาได้เงิน', key: 'paidLeave', width: 12 },
      { header: 'ลาไม่ได้เงิน', key: 'unpaidLeave', width: 14 },
      { header: 'มาสาย', key: 'late', width: 10 },
      { header: 'ออกก่อน', key: 'earlyLeave', width: 12 },
      { header: 'ขาดงาน', key: 'absent', width: 10 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let userProjectName = '';
    if (user?.projectLocationIds && user.projectLocationIds.length > 0) {
      const firstProjectId = user.projectLocationIds[0];
      const project = (projects as Project[]).find((p) => p.id === firstProjectId);
      if (project) userProjectName = project.projectName || project.department || '';
    }
    const sampleRow = ws.addRow(['นายสมหมาย ใจดี', 'EMP001', 'กรรมกร', userProjectName, null, null, 'TRUE', '0', '0', '0', '0', '0']);
    // Use richText to force text storage — prevents Excel from auto-converting to date serial
    sampleRow.getCell(5).value = { richText: [{ text: '1990-01-01' }] };
    sampleRow.getCell(6).value = { richText: [{ text: '2024-01-01' }] };

    const projectNames = [...new Set(
      (projects as Project[]).map(p => p.projectName || p.department).filter(Boolean)
    )];

    if (projectNames.length > 0) {
      const refWs = wb.addWorksheet('Ref_Projects');
      projectNames.forEach((name, i) => { refWs.getCell(`A${i + 1}`).value = name; });

      const refRange = `'Ref_Projects'!$A$1:$A$${projectNames.length}`;
      for (let row = 2; row <= 1000; row++) {
        ws.getCell(`D${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [refRange] };
      }
    }

    for (let row = 2; row <= 1000; row++) {
      ws.getCell(`G${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"TRUE,FALSE"'],
      };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'dc-labor-data-template.xlsx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateDC = () => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitialValues({ isActive: true, projectLocationId: '' });
    setDrawerLoading(false);
    setDrawerOpen(true);
  };

  const handleEditDC = async (contractor: DailyContractor) => {
    setDrawerMode('edit');
    setDrawerLoading(true);
    setDrawerOpen(true);
    try {
      const [detail, compensation] = await Promise.all([
        dcService.getDCById(contractor.id),
        dcService.getDCCompensation(contractor.id).catch(() => null),
      ]);
      setEditingId(contractor.id);

      const income = compensation?.income as any;
      const expense = compensation?.expense as any;

      const currentYear = new Date().getFullYear().toString();
      const yearlyStats = (detail.attendanceStats?.yearly?.[currentYear] || {}) as any;

      setDrawerInitialValues({
        ...detail,
        startDate: detail.startDate ? new Date(detail.startDate) : undefined,
        projectLocationId: detail.projectLocationId || '',
        dailyWageRate: income?.dailyWageRate ?? '',
        professionalRate: income?.professionalRate ?? '',
        phoneAllowance: income?.phoneAllowancePerPeriod ?? '',
        allowance: income?.allowance ?? '',
        otherIncome: income?.otherIncome ?? '',
        mouDeductionRate: income?.mouDeductionRate ?? '',
        housingFee: expense?.accommodationCostPerPeriod ?? '',
        followerCount: expense?.followerCount ?? '',
        refrigeratorFee: expense?.refrigeratorCostPerPeriod ?? '',
        soundSystemFee: expense?.soundSystemCostPerPeriod ?? '',
        tvFee: expense?.tvCostPerPeriod ?? '',
        laundryFee: expense?.washingMachineCostPerPeriod ?? '',
        airConFee: expense?.portableAcCostPerPeriod ?? '',
        otherDeduction: expense?.otherDeduction ?? '',
        paidLeave: yearlyStats.paidLeave ?? '',
        unpaidLeave: yearlyStats.unpaidLeave ?? '',
        lateMinutes: yearlyStats.lateMinutes ?? '',
        earlyLeaveMinutes: yearlyStats.earlyLeaveMinutes ?? '',
        absentDays: yearlyStats.absentDays ?? '',
      });
    } catch (error: any) {
      showError(error.message || 'ไม่สามารถโหลดข้อมูลแรงงานรายวันได้');
      handleCloseDrawer();
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDeleteDC = async (contractor: DailyContractor) => {
    await showDeleteConfirm(`แรงงานรายวัน: ${contractor.name}`, async () => {
      await deleteMutation.mutateAsync(contractor.id);
    });
  };

  const handleDrawerSubmit = async (data: DCCreateInput | DCEditInput) => {
    const sanitized = normalizeDCFormPayload(data);
    if (drawerMode === 'create') {
      await createMutation.mutateAsync(sanitized as DCCreateInput);
    } else if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: sanitized as DCEditInput });
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
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          {params.value}
          {params.value?.startsWith('9') && (
            <Tooltip title="ยกเว้นประกันสังคม">
              <Chip
                label="ยกเว้น"
                size="small"
                color="info"
                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
              />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'name',
      headerName: 'ชื่อ-นามสกุล',
      width: 250,
    },
    {
      field: 'skillId',
      headerName: 'ตำแหน่ง',
      width: 220,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">{params.value || 'ไม่ระบุ'}</Typography>
      ),
    },
    {
      field: 'department',
      headerName: 'สังกัด',
      width: 120,
      valueGetter: (params) => params.row.projectLocationId,
      renderCell: (params: GridRenderCellParams) => {
        const id = params.value as string;
        const department = id ? projectDepartmentMap.get(id) : null;

        if (!department)
          return (
            <Typography variant="caption" color="text.secondary">
              -
            </Typography>
          );

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip label={department} size="small" color="primary" variant="outlined" />
          </Box>
        );
      },
    },
    {
      field: 'project',
      headerName: 'หน่วยงาน',
      width: 250,
      valueGetter: (params) => params.row.projectLocationId,
      renderCell: (params: GridRenderCellParams) => {
        const id = params.value as string;
        const projectName = id ? projectNameMap.get(id) : null;

        if (!projectName)
          return (
            <Typography variant="caption" color="text.secondary">
              ไม่ระบุ
            </Typography>
          );

        return (
          <Typography variant="body2" sx={{ whiteSpace: 'normal', lineHeight: 1.2 }}>
            {projectName}
          </Typography>
        );
      },
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
              onClick={() => handleEditDC(params.row as DailyContractor)}
              color="primary"
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton
              size="small"
              onClick={() => handleDeleteDC(params.row as DailyContractor)}
              color="error"
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const importErrorMessage = importMutation.isError
    ? (importMutation.error as any)?.response?.data?.error ||
      (importMutation.error as Error)?.message ||
      'เกิดข้อผิดพลาดในการนำเข้าข้อมูลแรงงาน'
    : null;

  const pageContent = (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          จัดการแรงงานรายวัน (DC)
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
            onClick={handleOpenImport}
          >
            นำเข้าจากไฟล์
          </Button>
          <Button variant="contained" color="info" startIcon={<Add />} onClick={handleCreateDC}>
            สร้างแรงงานรายวันใหม่
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
              placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Grid>

          {/* Skill Filter */}
          <Grid item xs={12} md={3}>
            <SkillSelect
              value={filters.skillId || ''}
              onChange={handleSkillChange}
              label="กรองตำแหน่ง"
            />
          </Grid>

          {/* Project Filter */}
          <Grid item xs={12} md={3}>
            <ProjectSelect
              value={filters.projectLocationId || ''}
              onChange={(value) => {
                const selected = Array.isArray(value) ? value[0] : value;
                handleProjectChange(selected || '');
              }}
              label="กรองโครงการ"
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
                  skillId: '',
                  projectLocationId: '',
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
            rows={data?.dailyContractors || []}
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

      <DCModal
        title={drawerMode === 'create' ? 'สร้างแรงงานรายวันใหม่' : 'แก้ไขแรงงานรายวัน'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        mode={drawerMode}
        defaultValues={drawerInitialValues}
        isLoading={
          (drawerMode === 'create' ? createMutation.isPending : updateMutation.isPending) ||
          drawerLoading
        }
        onSubmit={handleDrawerSubmit}
      />
      <DCImportDialog
        open={importDialogOpen}
        onClose={handleCloseImport}
        onImport={(file) => importMutation.mutate(file)}
        isLoading={importMutation.isPending}
        result={importResult}
        errorMessage={importErrorMessage}
      />
    </Container>
  );
  if (error) {
    return (
      <ProtectedRoute requiredRoles={['GOD', 'AM', 'FM', 'SE', 'OE', 'PM', 'PD']}>
        <Layout>
          <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography color="error">เกิดข้อผิดพลาด: {(error as Error).message}</Typography>
          </Container>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['GOD', 'AM', 'FM', 'SE', 'OE', 'PM', 'PD']}>
      <Layout>{pageContent}</Layout>
    </ProtectedRoute>
  );
}
