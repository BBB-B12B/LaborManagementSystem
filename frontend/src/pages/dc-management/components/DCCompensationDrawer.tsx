import React from 'react';
import {
  Drawer,
  Box,
  IconButton,
  Typography,
  Divider,
  CircularProgress,
  Grid,
  TextField,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDCCompensation,
  upsertDCCompensation,
  type DailyContractor,
} from '@/services/dcService';
import { useToast } from '@/components/common/Toast';

const numberPreprocessor = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const compensationSchema = z.object({
  hourlyRate: z
    .preprocess(numberPreprocessor, z.number().min(0, 'กรุณาระบุค่าแรงต่อชั่วโมง')),
  professionalRate: z
    .preprocess(numberPreprocessor, z.number().min(0, 'กรุณาระบุค่าวิชาชีพ')),
  phoneAllowancePerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0, 'กรุณาระบุค่าโทรศัพท์')),
  accommodationCostPerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0, 'กรุณาระบุค่าที่พัก')),
  followerCount: z
    .preprocess(numberPreprocessor, z.number().min(0, 'กรุณาระบุจำนวนผู้ติดตาม')),
  followerAccommodationPerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0)),
  refrigeratorCostPerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0)),
  soundSystemCostPerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0)),
  tvCostPerPeriod: z.preprocess(numberPreprocessor, z.number().min(0)),
  washingMachineCostPerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0)),
  portableAcCostPerPeriod: z
    .preprocess(numberPreprocessor, z.number().min(0)),
});

type CompensationFormValues = z.infer<typeof compensationSchema>;

export interface DCCompensationDrawerProps {
  open: boolean;
  contractor: DailyContractor | null;
  onClose: () => void;
}

export const DCCompensationDrawer: React.FC<DCCompensationDrawerProps> = ({
  open,
  contractor,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<CompensationFormValues>({
    resolver: zodResolver(compensationSchema),
    defaultValues: {
      hourlyRate: 0,
      professionalRate: 0,
      phoneAllowancePerPeriod: 0,
      accommodationCostPerPeriod: 0,
      followerCount: 0,
      followerAccommodationPerPeriod: 0,
      refrigeratorCostPerPeriod: 0,
      soundSystemCostPerPeriod: 0,
      tvCostPerPeriod: 0,
      washingMachineCostPerPeriod: 0,
      portableAcCostPerPeriod: 0,
    },
  });

  const followerCount = watch('followerCount');
  React.useEffect(() => {
    setValue('followerAccommodationPerPeriod', followerCount * 300);
  }, [followerCount, setValue]);

  const hourlyRate = watch('hourlyRate');
  const otRate = React.useMemo(() => Number((hourlyRate * 1.5).toFixed(2)), [hourlyRate]);

  const { data, isLoading } = useQuery({
    queryKey: ['dcCompensation', contractor?.id],
    queryFn: () => getDCCompensation(contractor!.id),
    enabled: open && Boolean(contractor?.id),
  });

  React.useEffect(() => {
    if (data) {
      reset({
        hourlyRate: data.income?.hourlyRate ?? 0,
        professionalRate: data.income?.professionalRate ?? 0,
        phoneAllowancePerPeriod: data.income?.phoneAllowancePerPeriod ?? 0,
        accommodationCostPerPeriod: data.expense?.accommodationCostPerPeriod ?? 0,
        followerCount: data.expense?.followerCount ?? 0,
        followerAccommodationPerPeriod: data.expense?.followerAccommodationPerPeriod ?? 0,
        refrigeratorCostPerPeriod: data.expense?.refrigeratorCostPerPeriod ?? 0,
        soundSystemCostPerPeriod: data.expense?.soundSystemCostPerPeriod ?? 0,
        tvCostPerPeriod: data.expense?.tvCostPerPeriod ?? 0,
        washingMachineCostPerPeriod: data.expense?.washingMachineCostPerPeriod ?? 0,
        portableAcCostPerPeriod: data.expense?.portableAcCostPerPeriod ?? 0,
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (payload: CompensationFormValues) =>
      upsertDCCompensation(contractor!.id, {
        income: {
          hourlyRate: payload.hourlyRate,
          professionalRate: payload.professionalRate,
          phoneAllowancePerPeriod: payload.phoneAllowancePerPeriod,
        },
        expense: {
          accommodationCostPerPeriod: payload.accommodationCostPerPeriod,
          followerCount: payload.followerCount,
          refrigeratorCostPerPeriod: payload.refrigeratorCostPerPeriod,
          soundSystemCostPerPeriod: payload.soundSystemCostPerPeriod,
          tvCostPerPeriod: payload.tvCostPerPeriod,
          washingMachineCostPerPeriod: payload.washingMachineCostPerPeriod,
          portableAcCostPerPeriod: payload.portableAcCostPerPeriod,
        },
      }),
    onSuccess: () => {
      showSuccess('บันทึกข้อมูลค่าแรงสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['dcCompensation', contractor?.id] });
      queryClient.invalidateQueries({ queryKey: ['dailyContractors'] });
      onClose();
    },
    onError: (error: any) => {
      showError(error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลค่าแรง');
    },
  });

  const handleFormSubmit = async (values: CompensationFormValues) => {
    await mutation.mutateAsync(values);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
    >
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          จัดการค่าแรง: {contractor?.name || ''}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              รายได้
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="hourlyRate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าแรงต่อชั่วโมง (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="ค่าแรง OT ต่อชั่วโมง (บาท)"
                  value={otRate}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  helperText="คำนวณอัตโนมัติ = ค่าแรงปกติ × 1.5"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="professionalRate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าวิชาชีพต่อชั่วโมง (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="phoneAllowancePerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าโทรศัพท์ต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              รายจ่าย
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="accommodationCostPerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าที่พักต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="followerCount"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) =>
                        field.onChange(event.target.value === '' ? '' : Number(event.target.value))
                      }
                      label="จำนวนผู้ติดตาม"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'กรอกเป็นจำนวนคน'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="followerAccommodationPerPeriod"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? 0}
                      label="ค่าที่พักผู้ติดตาม (บาท)"
                      fullWidth
                      InputProps={{ readOnly: true }}
                      helperText="คำนวณอัตโนมัติ = จำนวนผู้ติดตาม × 300"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="refrigeratorCostPerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าตู้เย็นต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="soundSystemCostPerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าเครื่องเสียงต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="tvCostPerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าทีวีต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="washingMachineCostPerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าเครื่องซักผ้าต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="portableAcCostPerPeriod"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value === '' ? '' : Number(event.target.value))}
                      label="ค่าแอร์เคลื่อนที่ต่องวด (บาท)"
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'ถ้าไม่มีให้ใส่ 0'}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
              <Button variant="outlined" onClick={onClose} disabled={isSubmitting || mutation.isPending}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting || mutation.isPending}
              >
                {mutation.isPending ? <CircularProgress size={20} /> : 'บันทึก'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default DCCompensationDrawer;
