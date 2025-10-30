/**
 * Project Edit Page
 * หน้าแก้ไขโครงการ
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Paper, Alert } from '@mui/material';
import { Layout, ProtectedRoute } from '@/components/layout';
import { LoadingSpinner } from '@/components/common';
import { ProjectForm } from '../components/ProjectForm';
import { projectService } from '@/services/projectService';
import { type ProjectFormData } from '@/validation/projectSchema';

export default function ProjectEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getById(id as string),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProjectFormData) =>
      projectService.update(id as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      router.push('/project-management');
    },
  });

  const handleSubmit = async (data: ProjectFormData) => {
    await updateMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    router.push('/project-management');
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <LoadingSpinner message="กำลังโหลดข้อมูล..." />
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error || !project) {
    return (
      <ProtectedRoute>
        <Layout>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Alert severity="error">
              ไม่พบข้อมูลโครงการ หรือคุณไม่มีสิทธิ์เข้าถึง
            </Alert>
          </Container>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['FM', 'PM', 'AM']}>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Paper elevation={2} sx={{ p: 4 }}>
            <ProjectForm
              mode="edit"
              defaultValues={project}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={updateMutation.isPending}
            />
          </Paper>
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
