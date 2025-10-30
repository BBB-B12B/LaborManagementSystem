/**
 * Member Management - Edit User Page
 * หน้าแก้ไขข้อมูลผู้ใช้
 *
 * Features:
 * - Edit existing user
 * - Password change (optional)
 * - Username uniqueness check
 * - Admin only access (FR-M-001)
 *
 * User Story: US5 - Member Management (Priority 5)
 */

import React from 'react';
import { useRouter } from 'next/router';
import { Container, Typography, Box, Button, Alert } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserForm } from '../components/UserForm';
import { memberService } from '../../../services/memberService';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { useToast } from '../../../components/common/Toast';
import type { UserEditInput } from '../../../validation/userSchema';

/**
 * Edit User Page
 *
 * FR-M-003: แก้ไขข้อมูลผู้ใช้
 * FR-M-006: Password change is optional in edit mode
 */
export default function EditUserPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  // Fetch user data
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: () => memberService.getUserById(id as string),
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UserEditInput) =>
      memberService.updateUser(id as string, data),
    onSuccess: () => {
      showSuccess('อัปเดทข้อมูลผู้ใช้สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      router.push('/member-management');
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการอัปเดทข้อมูลผู้ใช้');
    },
  });

  const handleSubmit = async (data: UserEditInput) => {
    await updateMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    router.push('/member-management');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
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
        <Button
          startIcon={<ArrowBack />}
          onClick={handleCancel}
          sx={{ mt: 2 }}
        >
          กลับไปรายการผู้ใช้
        </Button>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">ไม่พบข้อมูลผู้ใช้</Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleCancel}
          sx={{ mt: 2 }}
        >
          กลับไปรายการผู้ใช้
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleCancel}
          sx={{ mb: 2 }}
        >
          กลับไปรายการผู้ใช้
        </Button>
        <Typography variant="h4" component="h1">
          แก้ไขข้อมูลผู้ใช้
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {user.name} ({user.username})
        </Typography>
      </Box>

      {/* Form */}
      <UserForm
        mode="edit"
        defaultValues={{
          employeeId: user.employeeId,
          username: user.username,
          name: user.name,
          roleId: user.roleId,
          department: user.department,
          dateOfBirth: user.dateOfBirth,
          startDate: user.startDate,
          projectLocationIds: user.projectLocationIds,
          isActive: user.isActive,
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={updateMutation.isPending}
      />
    </Container>
  );
}
