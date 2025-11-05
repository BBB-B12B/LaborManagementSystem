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
  Grid,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Layout, ProtectedRoute } from '@/components/layout';
import { BackButton, DataGrid, LoadingSpinner, useToast, useDeleteConfirmDialog } from '@/components/common';
import { projectService, type Project } from '@/services/projectService';
import { getProjectStatusLabel } from '@/validation/projectSchema';
import { ProjectDrawer } from './components/ProjectDrawer';
import type { ProjectFormData } from '@/validation/projectSchema';

export default function ProjectListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    confirmDelete: showDeleteConfirm,
    ConfirmDialog: DeleteConfirmDialog,
  } = useDeleteConfirmDialog();

  const [searchFilter, setSearchFilter] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitialValues, setDrawerInitialValues] = useState<Partial<ProjectFormData> | undefined>(undefined);
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
    setDrawerMode('create');
    setEditingProjectId(null);
    setDrawerInitialValues({
      status: 'active',
      isActive: true,
    });
    setDrawerLoading(false);
    setDrawerOpen(true);
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
        name: detail.name,
        department: detail.department,
        status: detail.status,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถโหลดข้อมูลโครงการได้');
      handleCloseDrawer();
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    await showDeleteConfirm(`โครงการ: ${name}`, async () => {
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
      headerName: 'รหัส',
      width: 120,
    },
    {
      field: 'name',
      headerName: 'ชื่อโครงการ',
      width: 250,
      flex: 1,
    },
    {
      field: 'department',
      headerName: 'สังกัด',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value || '-'} size="small" color="default" />
      ),
    },
    {
      field: 'location',
      headerName: 'ที่อยู่',
      width: 200,
      flex: 1,
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 130,
      renderCell: (params) => {
        const colors: Record<string, 'success' | 'warning' | 'error'> = {
          active: 'success',
          completed: 'warning',
          suspended: 'error',
        };
        return (
          <Chip
            label={getProjectStatusLabel(params.value)}
            size="small"
            color={colors[params.value] || 'default'}
          />
        );
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'จัดการ',
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label="แก้ไข"
          onClick={() => handleEdit(params.row as Project)}
          showInMenu
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="ลบ"
          onClick={() => handleDelete(params.id as string, params.row.name)}
          showInMenu
        />,
      ],
    },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <LoadingSpinner message="กำลังโหลดข้อมูลโครงการ..." />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['GOD', 'FM', 'PM', 'AM']}>
      <Layout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <BackButton href="/management" />
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4">จัดการโครงการ</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              สร้างโครงการใหม่
            </Button>
          </Box>

          <Paper elevation={2}>
            <DataGrid
              rows={projects || []}
              columns={columns}
              loading={isLoading}
              autoHeight
              disableRowSelectionOnClick
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: 'code', sort: 'asc' }] },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </Paper>
          <DeleteConfirmDialog />

          <ProjectDrawer
            title={drawerMode === 'create' ? 'สร้างโครงการใหม่' : 'แก้ไขโครงการ'}
            key={drawerMode === 'edit' ? editingProjectId ?? 'edit' : 'create'}
            open={drawerOpen}
            onClose={handleCloseDrawer}
            mode={drawerMode}
            defaultValues={drawerInitialValues}
            loading={drawerLoading}
            isLoading={drawerMode === 'create' ? createMutation.isPending : updateMutation.isPending}
            onSubmit={handleDrawerSubmit}
          />
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
