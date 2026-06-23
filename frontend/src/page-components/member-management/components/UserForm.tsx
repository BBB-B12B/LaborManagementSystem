'use client';
/**
 * User Form Component
 * Create / Edit user with validation
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateFormData,
  type UserUpdateFormData,
} from '@/validation/userManagementSchema';
import { RoleSelect } from '@/components/forms/RoleSelect';
import { DepartmentSelect } from '@/components/forms/DepartmentSelect';
import { ProjectSelect } from '@/components/forms/ProjectSelect';

export interface UserFormProps {
  defaultValues?: Partial<UserUpdateFormData>;
  onSubmit: (data: UserCreateFormData | UserUpdateFormData) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
  isLoading?: boolean;
}

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

  const schema = mode === 'create' ? userCreateSchema : userUpdateSchema;

  const initialValues = useMemo(
    () => ({
      employeeId: '',
      username: '',
      password: '',
      name: '',
      projectLocationIds: [] as string[],
      isActive: true,
      ...defaultValues,
    }),
    [defaultValues]
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateFormData | UserUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const handleFormSubmit = async (data: UserCreateFormData | UserUpdateFormData) => {
    try {
      setSubmitError(null);
      await onSubmit(data);
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง';
      setSubmitError(message);
    }
  };

  const passwordHelper =
    mode === 'edit'
      ? 'ถ้าไม่เปลี่ยนรหัส ให้เว้นว่าง'
      : 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';

  return (
    <Box>
      {submitError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {submitError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        <Grid container spacing={1.5}>

          {/* Row 1: รหัสพนักงาน + ชื่อ-นามสกุล */}
          <Grid item xs={12} md={6}>
            <Controller
              name="employeeId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="รหัสพนักงาน *"
                  required
                  fullWidth
                  size="small"
                  error={!!errors.employeeId}
                  helperText={errors.employeeId?.message}
                  disabled={isLoading || isSubmitting || mode === 'edit'}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="ชื่อ-นามสกุล *"
                  required
                  fullWidth
                  size="small"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Row 2: Username + Password */}
          <Grid item xs={12} md={6}>
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Username *"
                  required
                  fullWidth
                  size="small"
                  error={!!errors.username}
                  helperText={errors.username?.message || 'เช่น somchai.j'}
                  disabled={isLoading || isSubmitting}
                  onChange={(event) => field.onChange(event.target.value.toLowerCase())}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="รหัสผ่าน *"
                  type={showPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  fullWidth
                  size="small"
                  error={!!errors.password}
                  helperText={errors.password?.message || passwordHelper}
                  disabled={isLoading || isSubmitting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((prev) => !prev)}
                          edge="end"
                          size="small"
                          disabled={isLoading || isSubmitting}
                          aria-label="toggle password visibility"
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Row 3: ยืนยันรหัสผ่าน + Role */}
          <Grid item xs={12} md={6}>
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="ยืนยันรหัสผ่าน *"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  fullWidth
                  size="small"
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message || 'ต้องตรงกับรหัสผ่าน'}
                  disabled={isLoading || isSubmitting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          edge="end"
                          size="small"
                          disabled={isLoading || isSubmitting}
                          aria-label="toggle confirm password visibility"
                        >
                          {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="roleId"
              control={control}
              render={({ field }) => (
                <RoleSelect
                  {...field}
                  label="Role"
                  error={!!errors.roleId}
                  helperText={errors.roleId?.message}
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          {/* Row 4: Department + สถานะ */}
          <Grid item xs={12} md={6}>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <DepartmentSelect
                  {...field}
                  label="Department"
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
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
                  label="เปิดใช้งาน (Active)"
                />
              )}
            />
          </Grid>

          {/* Row 5: โครงการ (full width) */}
          <Grid item xs={12}>
            <Controller
              name="projectLocationIds"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  multiple
                  displayProjectNameOnly
                  value={
                    Array.isArray(field.value) ? field.value : field.value ? [field.value] : []
                  }
                  onChange={(value) =>
                    field.onChange(Array.isArray(value) ? value : value ? [value] : [])
                  }
                  error={!!errors.projectLocationIds}
                  helperText={errors.projectLocationIds?.message || 'เลือกหลายโครงการได้'}
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          {/* Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="error"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
                sx={{ borderRadius: '10px', px: 3 }}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="success"
                disabled={isLoading || isSubmitting}
                startIcon={isSubmitting && <CircularProgress size={20} />}
                sx={{
                  borderRadius: '10px',
                  px: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {mode === 'create' ? 'บันทึกผู้ใช้ใหม่' : 'บันทึกการแก้ไข'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default UserForm;
