import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Box,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  CreateSocialSecurityRuleInput,
  SocialSecurityRule,
} from '@/services/socialSecurityRuleService';
import { useToast } from '@/components/common/Toast';

const ruleSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อเกณฑ์'),
  conditionOperator: z.enum(['<=', '<', '>=', '>', '==']),
  conditionValue: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number().min(0, 'ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0')
  ),
  deductionType: z.enum(['percentage', 'fixed']),
  deductionValue: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number().min(0, 'ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0')
  ),
  minDeduction: z.preprocess(
    (val) => (val === '' || val === null ? null : Number(val)),
    z.number().optional().nullable()
  ),
  maxDeduction: z.preprocess(
    (val) => (val === '' || val === null ? null : Number(val)),
    z.number().optional().nullable()
  ),
  order: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number().min(1, 'ลำดับต้องเริ่มต้นที่ 1')
  ),
  isActive: z.boolean().default(true),
});

type RuleFormData = z.infer<typeof ruleSchema>;

interface SocialSecurityRuleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateSocialSecurityRuleInput, isEdit: boolean, id?: string) => Promise<void>;
  initialData?: SocialSecurityRule | null;
}

export function SocialSecurityRuleModal({
  open,
  onClose,
  onSave,
  initialData,
}: SocialSecurityRuleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const isEdit = !!initialData;

  const defaultValues: RuleFormData = {
    name: initialData?.name || '',
    conditionOperator: initialData?.conditionOperator || '<=',
    conditionValue: initialData?.conditionValue ?? ('' as any),
    deductionType: initialData?.deductionType || 'percentage',
    deductionValue: initialData?.deductionValue ?? ('' as any),
    minDeduction: initialData?.minDeduction ?? ('' as any),
    maxDeduction: initialData?.maxDeduction ?? ('' as any),
    order: initialData?.order ?? ('' as any),
    isActive: initialData?.isActive ?? true,
  };

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues,
  });

  const deductionTypeWatcher = watch('deductionType');

  // Sync initialData
  React.useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, initialData, reset]);

  const onSubmit = async (data: RuleFormData) => {
    try {
      setIsSubmitting(true);

      const payload: CreateSocialSecurityRuleInput = {
        name: data.name,
        conditionOperator: data.conditionOperator,
        conditionValue: data.conditionValue,
        deductionType: data.deductionType,
        deductionValue: data.deductionValue,
        minDeduction: data.minDeduction ? data.minDeduction : undefined,
        maxDeduction: data.maxDeduction ? data.maxDeduction : undefined,
        order: data.order,
        isActive: data.isActive,
      };

      await onSave(payload, isEdit, initialData?.id);
      onClose();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{isEdit ? 'แก้ไขเกณฑ์ประกันสังคม' : 'สร้างเกณฑ์ใหม่'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="ชื่อเกณฑ์ (เช่น รายได้ไม่เกิน 15,000 หัก 5%)"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>

            {/* Condition Row */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                เงื่อนไข (ถ้ารายได้รวม...)
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="conditionOperator"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="ตัวดำเนินการ"
                    fullWidth
                    error={!!errors.conditionOperator}
                    helperText={errors.conditionOperator?.message}
                  >
                    <MenuItem value="<=">น้อยกว่าหรือเท่ากับ (&lt;=)</MenuItem>
                    <MenuItem value="<">น้อยกว่า (&lt;)</MenuItem>
                    <MenuItem value=">=">มากกว่าหรือเท่ากับ (&gt;=)</MenuItem>
                    <MenuItem value=">">มากกว่า (&gt;)</MenuItem>
                    <MenuItem value="==">เท่ากับ (==)</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={8}>
              <Controller
                name="conditionValue"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="จำนวนเงินรายได้ฐาน (บาท)"
                    fullWidth
                    error={!!errors.conditionValue}
                    helperText={errors.conditionValue?.message}
                    onChange={(e) => field.onChange(e.target.value)}
                    value={field.value}
                  />
                )}
              />
            </Grid>

            {/* Deduction Row */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                ผลลัพธ์ (จะถูกหัก...)
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="deductionType"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="ประเภทการหัก"
                    fullWidth
                    error={!!errors.deductionType}
                    helperText={errors.deductionType?.message}
                  >
                    <MenuItem value="percentage">หักเป็นเปอร์เซ็นต์ (%)</MenuItem>
                    <MenuItem value="fixed">หักเป็นยอดคงที่ (บาท)</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="deductionValue"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label={
                      deductionTypeWatcher === 'percentage'
                        ? 'จำนวนเปอร์เซ็นต์ (เช่น 5)'
                        : 'ยอดเงิน (บาท)'
                    }
                    fullWidth
                    error={!!errors.deductionValue}
                    helperText={errors.deductionValue?.message}
                    onChange={(e) => field.onChange(e.target.value)}
                    value={field.value}
                  />
                )}
              />
            </Grid>

            {/* Min/Max row only for percentage */}
            {deductionTypeWatcher === 'percentage' && (
              <>
                <Grid item xs={6}>
                  <Controller
                    name="minDeduction"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        label="ขั้นต่ำ (บาท) *ไม่จำเป็น"
                        fullWidth
                        error={!!errors.minDeduction}
                        helperText={errors.minDeduction?.message}
                        onChange={(e) => field.onChange(e.target.value)}
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="maxDeduction"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        label="ขั้นสูง ไม่เกิน (บาท) *ไม่จำเป็น"
                        fullWidth
                        error={!!errors.maxDeduction}
                        helperText={errors.maxDeduction?.message}
                        onChange={(e) => field.onChange(e.target.value)}
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>
              </>
            )}

            {/* Order/Priority */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                ลำดับความสำคัญ
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="order"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="ลำดับคิวของกฎ (เช่น 1 = เช็คเป็นข้อแรก)"
                    fullWidth
                    error={!!errors.order}
                    helperText={
                      errors.order?.message ||
                      'ระบบจะเช็คตามลำดับ ถ้ารายได้เข้าเงื่อนไขข้อไหนก่อน จะใช้ข้อนั้นคำนวณทันที'
                    }
                    onChange={(e) => field.onChange(e.target.value)}
                    value={field.value}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="สถานะ" fullWidth>
                    <MenuItem value={true as any}>เปิดใช้งาน</MenuItem>
                    <MenuItem value={false as any}>ปิดใช้งานชั่วคราว</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>วิธีการทำงาน:</strong> ระบบจะใช้รายได้ทั้งหมดรวมแล้ว (Total Income) มาเช็คกับ
              "เงื่อนไข" ข้างต้น หากเข้าเงื่อนไข จะทำการหักเงินตาม "ผลลัพธ์" ที่ตั้งไว้
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            color="error"
            disabled={isSubmitting}
            sx={{ borderRadius: '10px', px: 3 }}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={isSubmitting}
            sx={{
              borderRadius: '10px',
              px: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {isEdit ? 'บันทึกการแก้ไข' : 'สร้างกฎ'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
