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
  defaultValues?: Partial<UserEditInput>;
  onSubmit: (data: UserCreateInput | UserEditInput) => Promise<void>;
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

  const schema = mode === 'create' ? userCreateSchema : userEditSchema;

  const initialValues = useMemo(
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

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const handleFormSubmit = async (data: UserCreateInput | UserEditInput) => {
    try {
      setSubmitError(null);
      await onSubmit(data);
    } catch (error: any) {
      setSubmitError(error.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง');
    }
  };

  const passwordHelper =
    mode === 'edit'
      ? 'ถ้าไม่เปลี่ยนรหัส ให้เว้นว่าง'
      : 'รหัสผ่านอย่างน้อย 6 ตัวอักษร (A-Z, a-z, 0-9)';

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        border: '1px solid #e9ecef',
        backgroundColor: '#fafafa',
      }}
    >
      <Typography variant='h5' gutterBottom sx={{ fontWeight: 700 }}>
        {mode === 'create' ? 'สร้างผู้ใช้ใหม่' : 'แก้ไขผู้ใช้'}
      </Typography>

      {submitError && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box component='form' onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          <Grid item xs={12}>
            <Typography variant='subtitle1' sx={{ mb: 1, fontWeight: 600 }}>
              ข้อมูลพื้นฐาน
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name='employeeId'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label='รหัสพนักงาน *'
                  required
                  fullWidth
                  error={!!errors.employeeId}
                  helperText={errors.employeeId?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name='name'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label='ชื่อ-นามสกุล *'
                  required
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name='username'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label='Username *'
                  required
                  fullWidth
                  error={!!errors.username}
                  helperText={errors.username?.message || 'ไม่สามารถมีช่องว่างและต้องไม่ซ้ำ'}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name='password'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label='รหัสผ่าน *'
                  type={showPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  fullWidth
                  error={!!errors.password}
                  helperText={errors.password?.message || passwordHelper}
                  disabled={isLoading || isSubmitting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => setShowPassword((prev) => !prev)}
                          edge='end'
                          disabled={isLoading || isSubmitting}
                          aria-label='toggle password visibility'
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

          <Grid item xs={12} md={6}>
            <Controller
              name='confirmPassword'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label='ยืนยันรหัสผ่าน *'
                  type={showConfirmPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  fullWidth
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message || 'ต้องตรงกับรหัสผ่าน'}
                  disabled={isLoading || isSubmitting}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          edge='end'
                          disabled={isLoading || isSubmitting}
                          aria-label='toggle confirm password visibility'
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

          <Grid item xs={12}>
            <Typography variant='subtitle1' sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
              บทบาทและแผนก
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name='roleId'
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

          <Grid item xs={12} md={6}>
            <Controller
              name='department'
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

          <Grid item xs={12}>
            <Typography variant='subtitle1' sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
              วันที่
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name='dateOfBirth'
              control={control}
              render={({ field }) => (
                <DatePicker
                  label='วันเกิด'
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

          <Grid item xs={12} md={6}>
            <Controller
              name='startDate'
              control={control}
              render={({ field }) => (
                <DatePicker
                  label='วันที่เริ่มงาน *'
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

          <Grid item xs={12}>
            <Typography variant='subtitle1' sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
              โครงการที่เข้าถึงได้
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Controller
              name='projectLocationIds'
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  multiple
                  displayProjectNameOnly
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
                  helperText={errors.projectLocationIds?.message || 'เลือกหลายโครงการได้'}
                  disabled={isLoading || isSubmitting}
                  required
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant='subtitle1' sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
              สถานะ
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Controller
              name='isActive'
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
                  label='เปิดใช้งาน (Active)'
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
              <Button
                type='submit'
                variant='contained'
                color='primary'
                disabled={isLoading || isSubmitting}
                startIcon={isSubmitting && <CircularProgress size={20} />}
              >
                {mode === 'create' ? 'บันทึกผู้ใช้ใหม่' : 'บันทึกการแก้ไข'}
              </Button>
              <Button variant='outlined' onClick={onCancel} disabled={isLoading || isSubmitting}>
                ยกเลิก
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
