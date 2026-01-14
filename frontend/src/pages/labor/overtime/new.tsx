/**
 * Overtime Create Page
 * หน้าบันทึก OT ใหม่
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Paper } from '@mui/material';
import { Layout, ProtectedRoute } from '@/components/layout';
import { OvertimeForm } from './components/OvertimeForm';
import { overtimeService } from '@/services/overtimeService';
import { type OvertimeFormData } from '@/validation/overtimeSchema';

/**
 * Overtime Create Page
 *
 * Features:
 * - 3 OT period tabs (Morning/Noon/Evening)
 * - Multi-DC support
 * - Auto-calculate OT hours and wage (1.5x)
 * - Image upload
 * - Time validation per period
 */
export default function OvertimeCreatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: OvertimeFormData) => overtimeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records'] });
      queryClient.invalidateQueries({ queryKey: ['overtimeRecords'] });
      router.push('/overtime');
    },
  });

  const handleSubmit = async (data: OvertimeFormData) => {
    await createMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    router.push('/overtime');
  };

  return (
    <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Paper elevation={2} sx={{ p: 4 }}>
            <OvertimeForm
              mode="create"
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createMutation.isPending}
            />
          </Paper>
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
