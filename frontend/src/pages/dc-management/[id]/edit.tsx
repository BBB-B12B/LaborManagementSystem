/**
 * DC Management - Edit DC Page
 * หน้าแก้ไขข้อมูลแรงงานรายวัน
 *
 * Features:
 * - Edit existing DC
 * - Update all DC fields
 * - EmployeeID validation (unique)
 * - Authorization: FM, SE, PM, Admin (FR-DC-001)
 *
 * User Story: US6 - DC Management (Priority 6)
 */

import React from 'react';
import { useRouter } from 'next/router';
import { Container, Typography, Box, Button, Alert } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DCForm } from '../components/DCForm';
import { dcService } from '../../../services/dcService';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { useToast } from '../../../components/common/Toast';
import type { DCEditInput } from '../../../validation/dcSchema';

/**
 * Edit DC Page
 *
 * FR-DC-001: Edit DC data
 */
export default function EditDCPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  // Fetch DC data
  const {
    data: dc,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dailyContractor', id],
    queryFn: () => dcService.getDCById(id as string),
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: DCEditInput) => dcService.updateDC(id as string, data),
    onSuccess: () => {
      showSuccess('อัปเดทข้อมูลแรงงานรายวันสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['dailyContractors'] });
      queryClient.invalidateQueries({ queryKey: ['dailyContractor', id] });
      router.push('/dc-management');
    },
    onError: (error: any) => {
      showError(
        error.message || 'เกิดข้อผิดพลาดในการอัปเดทข้อมูลแรงงานรายวัน'
      );
    },
  });

  const handleSubmit = async (data: DCEditInput) => {
    await updateMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    router.push('/dc-management');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
          }}
        >
          <LoadingSpinner size="large" />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          เกิดข้อผิดพลาด: {(error as Error).message}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={handleCancel} sx={{ mt: 2 }}>
          กลับไปรายการแรงงานรายวัน
        </Button>
      </Container>
    );
  }

  if (!dc) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">ไม่พบข้อมูลแรงงานรายวัน</Alert>
        <Button startIcon={<ArrowBack />} onClick={handleCancel} sx={{ mt: 2 }}>
          กลับไปรายการแรงงานรายวัน
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={handleCancel} sx={{ mb: 2 }}>
          กลับไปรายการแรงงานรายวัน
        </Button>
        <Typography variant="h4" component="h1">
          แก้ไขข้อมูลแรงงานรายวัน
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {dc.name} ({dc.employeeId})
        </Typography>
      </Box>

      {/* Form */}
      <DCForm
        mode="edit"
        defaultValues={{
          employeeId: dc.employeeId,
          name: dc.name,
          skillId: dc.skillId,
          phoneNumber: dc.phoneNumber,
          idCardNumber: dc.idCardNumber,
          address: dc.address,
          emergencyContact: dc.emergencyContact,
          emergencyPhone: dc.emergencyPhone,
          startDate: dc.startDate,
          endDate: dc.endDate,
          projectLocationIds: dc.projectLocationIds,
          isActive: dc.isActive,
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={updateMutation.isPending}
      />
    </Container>
  );
}
