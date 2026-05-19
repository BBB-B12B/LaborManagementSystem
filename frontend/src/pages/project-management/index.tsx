/**
 * Project List Page
 * หน้ารายการโครงการ
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Layout, ProtectedRoute } from '@/components/layout';
import { BackButton, LoadingSpinner, useToast, useDeleteConfirmDialog } from '@/components/common';
import { projectService, type Project } from '@/services/projectService';
import { ProjectDrawer } from './components/ProjectDrawer';
import { ProjectCreateModal } from './components/ProjectCreateModal';
import { PROJECT_STATUS_OPTIONS, type ProjectFormData } from '@/validation/projectSchema';

const CODE_PREFIX = 'P';
const CODE_PAD = 3;
const ACTIVE_STATUS = PROJECT_STATUS_OPTIONS[0];
const STATUS_COLOR_MAP: Record<string, 'success' | 'warning' | 'error'> = {
  [PROJECT_STATUS_OPTIONS[0]]: 'success',
  [PROJECT_STATUS_OPTIONS[1]]: 'warning',
  [PROJECT_STATUS_OPTIONS[2]]: 'error',
};

const extractCodeNumber = (code?: string | null): number | null => {
  if (!code) return null;
  const match = code.match(/(\d+)$/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isNaN(num) ? null : num;
};

const getNextProjectCodeFromList = (items: Project[]): string => {
  const max = items.reduce((acc, item) => {
    const value = extractCodeNumber(item.code) ?? extractCodeNumber(item.id);
    return value !== null && value > acc ? value : acc;
  }, 0);
  const next = Math.max(max + 1, 1);
  return `${CODE_PREFIX}${next.toString().padStart(CODE_PAD, '0')}`;
};

export default function ProjectListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirmDelete: showDeleteConfirm, ConfirmDialog: DeleteConfirmDialog } =
    useDeleteConfirmDialog();

  const [searchFilter, setSearchFilter] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitialValues, setDrawerInitialValues] = useState<
    Partial<ProjectFormData> | undefined
  >(undefined);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', searchFilter],
    queryFn: () => projectService.getAll({ search: searchFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectDepartments'] });
      toast.success('ลบโครงการสำเร็จ');
    },
    onError: (error) => {
      toast.error(`เกิดข้อผิดพลาด: ${(error as Error).message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectService.create(data),
    onSuccess: () => {
      toast.success('สร้างโครงการสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectDepartments'] });
      handleCloseDrawer();
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการสร้างโครงการ');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectFormData }) =>
      projectService.update(id, data),
    onSuccess: () => {
      toast.success('อัปเดตโครงการสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectDepartments'] });
      handleCloseDrawer();
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการอัปเดตโครงการ');
    },
  });

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingProjectId(null);
    setDrawerInitialValues(undefined);
    setDrawerLoading(false);
  };

  const handleCreate = () => {
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (data: ProjectFormData) => {
    await createMutation.mutateAsync(data);
    setCreateModalOpen(false);
  };

  const handleEdit = async (project: Project) => {
    setDrawerMode('edit');
    setDrawerLoading(true);
    setDrawerOpen(true);
    try {
      const detail = await projectService.getById(project.id);
      setEditingProjectId(project.id);
      setDrawerInitialValues({
        code: detail.code,
        projectCode: detail.projectCode || '',
        projectName: detail.projectName,
        department: detail.department,
        status: detail.status,
        projectManager: detail.projectManager || '',
        workDays: detail.workDays,
        followCompanyHoliday: detail.followCompanyHoliday,
      });
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถโหลดข้อมูลโครงการได้');
      handleCloseDrawer();
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDelete = async (id: string, projectName?: string) => {
    const displayName = projectName || id;
    await showDeleteConfirm(`โครงการ: ${displayName}`, async () => {
      await deleteMutation.mutateAsync(id);
    });
  };

  const handleDrawerSubmit = async (data: ProjectFormData) => {
    if (drawerMode === 'create') {
      await createMutation.mutateAsync(data);
    } else if (editingProjectId) {
      await updateMutation.mutateAsync({ id: editingProjectId, data });
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'code',
      headerName: 'ลำดับ',
      width: 140,
    },
    {
      field: 'projectCode',
      headerName: 'รหัสโครงการ',
      width: 160,
    },
    {
      field: 'projectName',
      headerName: 'ชื่อโครงการ',
      flex: 1,
      minWidth: 220,
      valueGetter: (params) => params.value || '-',
    },
    {
      field: 'department',
      headerName: 'สังกัด',
      width: 120,
      renderCell: (params) => <Chip label={params.value || '-'} size="small" color="default" />,
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 160,
      renderCell: (params) => {
        return (
          <Chip
            label={params.value || '-'}
            size="small"
            color={STATUS_COLOR_MAP[params.value as string] || 'default'}
          />
        );
      },
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
              onClick={() => handleEdit(params.row as Project)}
              color="primary"
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton
              size="small"
              onClick={() =>
                handleDelete(params.id as string, params.row.projectName || params.row.code)
              }
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['GOD', 'FM', 'PM', 'AM']}>
      <Layout>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          {/* <BackButton href="/management" /> removed as per global header change */}
          <Box
            sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="h4">จัดการโครงการ</Typography>
            <Button variant="contained" color="info" startIcon={<AddIcon />} onClick={handleCreate}>
              สร้างโครงการใหม่
            </Button>
          </Box>

          <Paper sx={{ width: '100%' }}>
            {isLoading ? (
              <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="large" />
              </Box>
            ) : (
              <DataGrid
                rows={projects || []}
                columns={columns}
                autoHeight
                disableSelectionOnClick
                hideFooter
                pageSize={100}
                initialState={{
                  sorting: { sortModel: [{ field: 'code', sort: 'asc' }] },
                }}
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

          <ProjectDrawer
            key={drawerMode === 'edit' ? (editingProjectId ?? 'edit') : 'create'}
            open={drawerOpen}
            onClose={handleCloseDrawer}
            mode={drawerMode}
            defaultValues={drawerInitialValues}
            loading={drawerLoading}
            isLoading={updateMutation.isPending}
            onSubmit={handleDrawerSubmit}
          />

          <ProjectCreateModal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onSubmit={handleCreateSubmit}
            isLoading={createMutation.isPending}
          />
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
