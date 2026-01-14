/**
 * Overtime Edit Page
 * หน้าแก้ไข OT
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Paper, Alert } from '@mui/material';
import { Layout, ProtectedRoute } from '@/components/layout';
import { LoadingSpinner } from '@/components/common';
import { OvertimeForm } from '../components/OvertimeForm';
import { overtimeService } from '@/services/overtimeService';
import { type OvertimeFormData } from '@/validation/overtimeSchema';

/**
 * Overtime Edit Page
 *
 * Allows users to edit existing OT records
 * - Loads existing data
 * - Shows edit history
 * - Tracks changes in EditHistory collection
 */
export default function OvertimeEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();

  // Fetch existing overtime record
  const { data: record, isLoading, error } = useQuery({
    queryKey: ['overtimeRecord', id],
    queryFn: () => overtimeService.getById(id as string),
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: OvertimeFormData) =>
      overtimeService.update(id as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeRecords'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeRecord', id] });
      router.push('/overtime');
    },
  });

  const handleSubmit = async (data: OvertimeFormData) => {
    await updateMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    router.push('/overtime');
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

  if (error || !record) {
    return (
      <ProtectedRoute>
        <Layout>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Alert severity="error">
              ไม่พบข้อมูล OT หรือคุณไม่มีสิทธิ์เข้าถึง
            </Alert>
          </Container>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Paper elevation={2} sx={{ p: 4 }}>
            <OvertimeForm
              mode="edit"
              defaultValues={record}
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
