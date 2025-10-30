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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  MonetizationOn,
  FileDownload,
  CloudUpload,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dcService,
  type DailyContractor,
  type DCFilterOptions,
  type DCImportSummary,
} from '../../services/dcService';
import { BackButton } from '../../components/common/BackButton';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useDeleteConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { SkillSelect } from '../../components/forms/SkillSelect';
import { ProjectSelect } from '../../components/forms/ProjectSelect';
import { Layout, ProtectedRoute } from '@/components/layout';
import { DCDrawer } from './components/DCDrawer';
import { DCCompensationDrawer } from './components/DCCompensationDrawer';
import { DCImportDialog } from './components/DCImportDialog';
import type { DCCreateInput, DCEditInput } from '@/validation/dcSchema';
import { getSkills } from '@/services/skillService';

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
    phoneNumber: toStringOrEmpty(payload.phoneNumber as string | null | undefined),
    idCardNumber: toStringOrEmpty(payload.idCardNumber as string | null | undefined),
    address: toStringOrEmpty(payload.address as string | null | undefined),
    emergencyContact: toStringOrEmpty(payload.emergencyContact as string | null | undefined),
    emergencyPhone: toStringOrEmpty(payload.emergencyPhone as string | null | undefined),
    projectLocationIds: Array.isArray(payload.projectLocationIds)
      ? payload.projectLocationIds.filter(Boolean)
      : [],
    startDate: toIsoOrEmpty(payload.startDate as Date | string | null | undefined) as any,
    endDate: toIsoOrEmpty(payload.endDate as Date | string | null | undefined) as any,
    isActive: payload.isActive ?? true,
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
  const {
    confirmDelete: showDeleteConfirm,
    ConfirmDialog: DeleteConfirmDialog,
  } = useDeleteConfirmDialog();

  // Filters
  const [filters, setFilters] = useState<DCFilterOptions>({
    search: '',
    skillId: '',
    projectLocationId: '',
    isActive: undefined,
    page: 1,
    pageSize: 25,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitialValues, setDrawerInitialValues] = useState<Partial<DCEditInput> | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [compensationDrawerOpen, setCompensationDrawerOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<DailyContractor | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<DCImportSummary | null>(null);

  // Fetch skills for display mapping
  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: getSkills,
  });

  const skillNameMap = useMemo(() => {
    const map = new Map<string, string>();
    skills.forEach((skill) => map.set(skill.id, skill.name));
    return map;
  }, [skills]);

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

  const handleSkillChange = (skillId: string) => {
    setFilters((prev) => ({ ...prev, skillId, page: 1 }));
  };

  const handleProjectChange = (projectLocationId: string) => {
    setFilters((prev) => ({ ...prev, projectLocationId, page: 1 }));
  };

  const handleOpenCompensation = (contractor: DailyContractor) => {
    setSelectedContractor(contractor);
    setCompensationDrawerOpen(true);
  };

  const handleCloseCompensation = () => {
    setCompensationDrawerOpen(false);
    setSelectedContractor(null);
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
        error?.response?.data?.error ||
        error?.message ||
        'เกิดข้อผิดพลาดในการนำเข้าข้อมูลแรงงาน';
      showError(message);
    },
  });

  const handleCreateDC = () => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitialValues({ isActive: true, projectLocationIds: [] });
    setDrawerLoading(false);
    setDrawerOpen(true);
  };

  const handleEditDC = async (contractor: DailyContractor) => {
    setDrawerMode('edit');
    setDrawerLoading(true);
    setDrawerOpen(true);
    try {
      const detail = await dcService.getDCById(contractor.id);
      setEditingId(contractor.id);
      setDrawerInitialValues({
        ...detail,
        startDate: detail.startDate ? new Date(detail.startDate) : undefined,
        endDate: detail.endDate ? new Date(detail.endDate) : undefined,
        projectLocationIds: detail.projectLocationIds || [],
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
      width: 200,
      flex: 1,
    },
    {
      field: 'skillId',
      headerName: 'ทักษะ',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const skillId = params.value as string | undefined;
        const label = skillId ? skillNameMap.get(skillId) || skillId : '-';
        return <Chip label={label} size="small" />;
      },
    },
    {
      field: 'phoneNumber',
      headerName: 'เบอร์โทร',
      width: 130,
      renderCell: (params: GridRenderCellParams) => params.value || '-',
    },
    {
      field: 'projectLocationIds',
      headerName: 'จำนวนโครงการ',
      width: 120,
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={`${params.value?.length || 0} โครงการ`}
          size="small"
          color="primary"
          variant="outlined"
        />
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
          <Tooltip
            title={
              (params.row as DailyContractor).hasCompensation
                ? 'ตั้งค่าแล้ว - คลิกเพื่อแก้ไข'
                : 'ยังไม่ได้ตั้งค่าค่าแรง'
            }
          >
            <IconButton
              size="small"
              onClick={() => handleOpenCompensation(params.row as DailyContractor)}
              sx={{
                color: (params.row as DailyContractor).hasCompensation
                  ? 'error.main'
                  : 'text.disabled',
              }}
            >
              <MonetizationOn fontSize="small" />
            </IconButton>
          </Tooltip>
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
      <BackButton href="/management" />
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
            component="a"
            href="/dc-labor-data-template.csv"
            download
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
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleCreateDC}
          >
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
                startAdornment: (
                  <Search sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
            />
          </Grid>

          {/* Skill Filter */}
          <Grid item xs={12} md={3}>
            <SkillSelect
              value={filters.skillId || ''}
              onChange={handleSkillChange}
              label="กรองทักษะ"
              showAll
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

      <DCDrawer
        title={drawerMode === 'create' ? 'สร้างแรงงานรายวันใหม่' : 'แก้ไขแรงงานรายวัน'}
        key={drawerMode === 'edit' ? editingId ?? 'edit' : 'create'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        mode={drawerMode}
        defaultValues={drawerInitialValues}
        loading={drawerLoading}
        isLoading={drawerMode === 'create' ? createMutation.isPending : updateMutation.isPending}
        onSubmit={handleDrawerSubmit}
      />
      <DCCompensationDrawer
        open={compensationDrawerOpen}
        contractor={selectedContractor}
        onClose={handleCloseCompensation}
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
            <Typography color="error">
              เกิดข้อผิดพลาด: {(error as Error).message}
            </Typography>
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
