/**
 * User Form Component
 * ฟอร์มจัดการผู้ใช้
 *
 * Features:
 * - Create/Edit user
 * - Username validation (unique, no spaces)
 * - Password management (create: required, edit: optional)
 * - Role and department selection
 * - Multi-select accessible projects
 * - Admin only (FR-M-001)
 */

import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  InputAdornment,
  IconButton,
  Paper,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  userCreateSchema,
  userEditSchema,
  type UserCreateInput,
  type UserEditInput,
} from '../../../validation/userSchema';
import { DatePicker } from '../../../components/forms/DatePicker';
import { RoleSelect } from '../../../components/forms/RoleSelect';
import { DepartmentSelect } from '../../../components/forms/DepartmentSelect';
import { ProjectSelect } from '../../../components/forms/ProjectSelect';

export interface UserFormProps {
  /**
   * Initial form data (for edit mode)
   */
  defaultValues?: Partial<UserEditInput>;

  /**
   * Callback when form is submitted successfully
   */
  onSubmit: (data: UserCreateInput | UserEditInput) => Promise<void>;

  /**
   * Callback when cancel button is clicked
   */
  onCancel: () => void;

  /**
   * Form mode
   */
  mode: 'create' | 'edit';

  /**
   * Loading state
   */
  isLoading?: boolean;
}

/**
 * UserForm Component
 *
 * FR-M-002: สร้าง/แก้ไขผู้ใช้
 * FR-M-006: Password >= 8 characters with bcrypt
 */
export function UserForm({
  defaultValues,
  onSubmit,
  onCancel,
  mode,
  isLoading = false,
}: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Use different schema based on mode
  const schema = mode === 'create' ? userCreateSchema : userEditSchema;

  const initialValues = React.useMemo(
    () => ({
      isActive: true,
      projectLocationIds: [],
      ...defaultValues,
    }),
    [defaultValues]
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateInput | UserEditInput>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  React.useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const handleFormSubmit = async (data: UserCreateInput | UserEditInput) => {
    try {
      setSubmitError(null);
      await onSubmit(data);
    } catch (error: any) {
      setSubmitError(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'create' ? 'สร้างผู้ใช้ใหม่' : 'แก้ไขข้อมูลผู้ใช้'}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        <Grid container spacing={3}>
          {/* Basic Information Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              ข้อมูลพื้นฐาน
            </Typography>
          </Grid>

          {/* Employee ID */}
          <Grid item xs={12} md={6}>
            <Controller
              name="employeeId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="รหัสพนักงาน"
                  required
                  fullWidth
                  error={!!errors.employeeId}
                  helperText={errors.employeeId?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Full Name */}
          <Grid item xs={12} md={6}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="ชื่อ-นามสกุล"
                  required
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Username */}
          <Grid item xs={12} md={6}>
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Username"
                  required
                  fullWidth
                  error={!!errors.username}
                  helperText={
                    errors.username?.message || 'Username ไม่สามารถมีช่องว่างได้'
                  }
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Password */}
          <Grid item xs={12} md={6}>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="รหัสผ่าน"
                  type={showPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  fullWidth
                  error={!!errors.password}
                  helperText={
                    errors.password?.message ||
                    (mode === 'edit'
                      ? 'เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน'
                      : 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร (A-Z)')
                  }
                  disabled={isLoading || isSubmitting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          disabled={isLoading || isSubmitting}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Confirm Password */}
          <Grid item xs={12} md={6}>
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="ยืนยันรหัสผ่าน"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  fullWidth
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                  disabled={isLoading || isSubmitting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleToggleConfirmPasswordVisibility}
                          edge="end"
                          disabled={isLoading || isSubmitting}
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Role & Department Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
              บทบาทและแผนก
            </Typography>
          </Grid>

          {/* Role */}
          <Grid item xs={12} md={6}>
            <Controller
              name="roleId"
              control={control}
              render={({ field }) => (
                <RoleSelect
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.roleId}
                  helperText={errors.roleId?.message}
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          {/* Department */}
          <Grid item xs={12} md={6}>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <DepartmentSelect
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          {/* Date Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
              วันที่
            </Typography>
          </Grid>

          {/* Date of Birth */}
          <Grid item xs={12} md={6}>
            <Controller
              name="dateOfBirth"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="วันเกิด"
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.dateOfBirth}
                  helperText={errors.dateOfBirth?.message}
                  disabled={isLoading || isSubmitting}
                  maxDate={new Date()}
                />
              )}
            />
          </Grid>

          {/* Start Date */}
          <Grid item xs={12} md={6}>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="วันที่เริ่มงาน"
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.startDate}
                  helperText={errors.startDate?.message}
                  disabled={isLoading || isSubmitting}
                  required
                  maxDate={new Date()}
                />
              )}
            />
          </Grid>

          {/* Project Access Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
              โครงการที่เข้าถึงได้
            </Typography>
          </Grid>

          {/* Accessible Projects */}
          <Grid item xs={12}>
            <Controller
              name="projectLocationIds"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  multiple
                  value={
                    Array.isArray(field.value)
                      ? field.value
                      : field.value
                      ? [field.value]
                      : []
                  }
                  onChange={(value) =>
                    field.onChange(
                      Array.isArray(value)
                        ? value
                        : value
                        ? [value]
                        : []
                    )
                  }
                  error={!!errors.projectLocationIds}
                  helperText={
                    errors.projectLocationIds?.message ||
                    'เลือกโครงการที่ผู้ใช้สามารถเข้าถึงได้'
                  }
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          {/* Status Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
              สถานะ
            </Typography>
          </Grid>

          {/* Active Status */}
          <Grid item xs={12}>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={isLoading || isSubmitting}
                    />
                  }
                  label="ใช้งาน (Active)"
                />
              )}
            />
          </Grid>

          {/* Form Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading || isSubmitting}
                startIcon={isSubmitting && <CircularProgress size={20} />}
              >
                {mode === 'create' ? 'สร้างผู้ใช้' : 'บันทึกการแก้ไข'}
              </Button>
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
              >
                ยกเลิก
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
