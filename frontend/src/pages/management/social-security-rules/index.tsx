import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Button, Container, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { Layout, ProtectedRoute } from '@/components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/common/Toast';
import {
  socialSecurityRuleService,
  SocialSecurityRule,
  CreateSocialSecurityRuleInput,
} from '@/services/socialSecurityRuleService';
import { SocialSecurityRuleModal } from '@/page-components/management/social-security-rules/components/SocialSecurityRuleModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('th-TH').format(num);
};

export default function SocialSecurityRulesPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<SocialSecurityRule | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['social-security-rules'],
    queryFn: () => socialSecurityRuleService.getAll(1, 100),
  });

  const rules = data?.data || [];

  const createMutation = useMutation({
    mutationFn: socialSecurityRuleService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-security-rules'] });
      toast.success('สร้างเกณฑ์เรียบร้อยแล้ว');
      setIsModalOpen(false);
    },
    onError: () => toast.error('สร้างล้มเหลว'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateSocialSecurityRuleInput }) =>
      socialSecurityRuleService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-security-rules'] });
      toast.success('แก้ไขเกณฑ์เรียบร้อยแล้ว');
      setIsModalOpen(false);
    },
    onError: () => toast.error('แก้ไขล้มเหลว'),
  });

  const deleteMutation = useMutation({
    mutationFn: socialSecurityRuleService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-security-rules'] });
      toast.success('ลบเกณฑ์เรียบร้อยแล้ว');
      setIsConfirmDeleteOpen(false);
    },
    onError: () => toast.error('ลบล้มเหลว'),
  });

  const handleCreate = () => {
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleEdit = (rule: SocialSecurityRule) => {
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setRuleToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (ruleToDelete) {
      deleteMutation.mutate(ruleToDelete);
    }
  };

  const onSave = async (data: CreateSocialSecurityRuleInput, isEdit: boolean, id?: string) => {
    if (isEdit && id) {
      await updateMutation.mutateAsync({ id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const columns: GridColDef[] = [
    { field: 'order', headerName: 'ลำดับประเมินผล', width: 130, flex: 1 },
    { field: 'name', headerName: 'ชื่อเกณฑ์', width: 300, flex: 2 },
    {
      field: 'condition',
      headerName: 'เงื่อนไขรายได้',
      width: 200,
      flex: 1,
      renderCell: (params: GridRenderCellParams<SocialSecurityRule>) =>
        `${params.row.conditionOperator} ${formatNumber(params.row.conditionValue)} ฿`,
    },
    {
      field: 'deduction',
      headerName: 'ยอดที่จะหัก',
      width: 250,
      flex: 1,
      renderCell: (params: GridRenderCellParams<SocialSecurityRule>) => {
        const { deductionType, deductionValue, minDeduction, maxDeduction } = params.row;
        if (deductionType === 'fixed') return `คงที่ ${formatNumber(deductionValue)} ฿`;

        let txt = `${deductionValue}%`;
        if (minDeduction && maxDeduction) {
          txt += ` (ขั้นต่ำ ${minDeduction} - สูงสุด ${maxDeduction})`;
        } else if (maxDeduction) {
          txt += ` (ไม่เกิน ${maxDeduction})`;
        } else if (minDeduction) {
          txt += ` (ไม่ต่ำกว่า ${minDeduction})`;
        }
        return txt;
      },
    },
    {
      field: 'isActive',
      headerName: 'สถานะ',
      width: 120,
      renderCell: (params: GridRenderCellParams<SocialSecurityRule>) => (
        <Box
          sx={{
            bgcolor: params.row.isActive ? 'success.light' : 'error.light',
            color: params.row.isActive ? 'success.dark' : 'error.dark',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.875rem',
            fontWeight: 'bold',
          }}
        >
          {params.row.isActive ? 'ใช้งาน' : 'ปืด'}
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<SocialSecurityRule>) => (
        <Box>
          <Tooltip title="แก้ไข">
            <IconButton onClick={() => handleEdit(params.row)} size="small" color="primary">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton onClick={() => handleDeleteClick(params.row.id)} size="small" color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <ProtectedRoute requiredRoles={['AM', 'MD']}>
      <Layout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {/* Header Area */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.push('/management')} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" fontWeight="bold">
                การจัดการเกณฑ์ประกันสังคม
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                กำหนดกฎการหักเงินประกันสังคมจากรายได้รวม (Total Income) ตามลำดับความสำคัญ
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="info"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              sx={{ px: 3, py: 1 }}
            >
              สร้างเกณฑ์ใหม่
            </Button>
          </Box>

          {/* Data Table */}
          <Paper sx={{ width: '100%', overflow: 'hidden', p: 2 }}>
            <DataGrid
              rows={rules}
              columns={columns}
              loading={isLoading}
              autoHeight
              disableSelectionOnClick
              hideFooter
            />
          </Paper>

          {/* Modals */}
          <SocialSecurityRuleModal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={onSave}
            initialData={selectedRule}
          />

          <ConfirmDialog
            open={isConfirmDeleteOpen}
            title="ยืนยันการลบเกณฑ์"
            message="คุณแน่ใจหรือไม่ว่าต้องการลบเกณฑ์นี้? กรุณาทราบว่าการลบอาจส่งผลต่อการคำนวณงวดที่กำลังใช้งานอยู่"
            onConfirm={confirmDelete}
            onClose={() => setIsConfirmDeleteOpen(false)}
            confirmText="ลบ"
            severity="error"
          />
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
