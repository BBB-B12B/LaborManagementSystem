/**
 * Daily Report Edit Page
 * หน้าแก้ไขรายงานการทำงานรายวัน
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Paper, Alert } from '@mui/material';
import { Layout, ProtectedRoute } from '@/components/layout';
import { LoadingSpinner } from '@/components/common';
import { DailyReportForm } from '../components/DailyReportForm';
import { dailyReportService } from '@/services/dailyReportService';
import { type DailyReportFormData } from '@/validation/dailyReportSchema';

/**
 * Daily Report Edit Page
 *
 * Allows users to edit existing daily reports
 * - Loads existing data
 * - Shows edit history
 * - Tracks changes in EditHistory collection
 */
export default function DailyReportEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();

  // Fetch existing daily report
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['dailyReport', id],
    queryFn: () => dailyReportService.getById(id as string),
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: DailyReportFormData) =>
      dailyReportService.update(id as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records'] });
      queryClient.invalidateQueries({ queryKey: ['dailyReports'] });
      queryClient.invalidateQueries({ queryKey: ['dailyReport', id] });
      router.push('/daily-reports');
    },
  });

  const handleSubmit = async (data: DailyReportFormData) => {
    await updateMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    router.push('/daily-reports');
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

  if (error || !report) {
    return (
      <ProtectedRoute>
        <Layout>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Alert severity="error">
              ไม่พบข้อมูลรายงานการทำงาน หรือคุณไม่มีสิทธิ์เข้าถึง
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
            <DailyReportForm
              mode="edit"
              defaultValues={report}
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
