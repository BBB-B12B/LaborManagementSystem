/**
 * ScanData Discrepancy Detail Page
 * หน้ารายละเอียดความผิดปกติแต่ละรายการ
 *
 * Features:
 * - Side-by-side comparison: Daily Report vs ScanData
 * - Resolution actions: Update DR, Create DR, Mark Verified, Ignore
 * - Detailed scan records timeline
 * - Resolution history
 *
 * User Story: US8 - ScanData Management & Monitoring (Priority 8)
 * FR-SD-013: Resolution methods
 * FR-SD-014: Audit trail
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  Divider,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Edit,
  Add,
  Block,
  History,
  Warning,
  Info,
  AccessTime,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getDiscrepancyById,
  resolveDiscrepancy,
  type ScanDataDiscrepancy,
} from '../../services/scanDataService';
import {
  getDiscrepancyTypeLabel,
  getDiscrepancyTypeColor,
  getSeverityColor,
} from '../../validation/scanDataSchema';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

/**
 * Resolution form schema
 */
const ResolutionSchema = z.object({
  method: z.enum(['update_dr', 'create_dr', 'verify', 'ignore']),
  note: z.string().min(1, 'กรุณาระบุหมายเหตุ'),
  updatedHours: z.number().min(0).optional(),
});

type ResolutionInput = z.infer<typeof ResolutionSchema>;

/**
 * Discrepancy Detail Page Component
 */
export default function DiscrepancyDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<
    'update_dr' | 'create_dr' | 'verify' | 'ignore' | null
  >(null);

  // Fetch discrepancy details
  const { data: discrepancy, isLoading, error } = useQuery({
    queryKey: ['discrepancy', id],
    queryFn: () => getDiscrepancyById(id as string),
    enabled: !!id,
  });

  // Resolution form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResolutionInput>({
    resolver: zodResolver(ResolutionSchema),
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async (data: ResolutionInput) => {
      return await resolveDiscrepancy(id as string, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discrepancy', id] });
      queryClient.invalidateQueries({ queryKey: ['discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['discrepancySummary'] });
      setResolveDialogOpen(false);
      reset();
    },
  });

  const handleResolveClick = (
    method: 'update_dr' | 'create_dr' | 'verify' | 'ignore'
  ) => {
    setSelectedMethod(method);
    setResolveDialogOpen(true);
  };

  const onSubmitResolution = (data: ResolutionInput) => {
    resolveMutation.mutate({
      ...data,
      method: selectedMethod!,
    });
  };

  const handleBack = () => {
    router.push('/scan-data-monitoring');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner size="large" />
      </Container>
    );
  }

  if (error || !discrepancy) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
          {error ? (error as Error).message : 'ไม่พบข้อมูลความผิดปกติ'}
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          กลับ
        </Button>
      </Container>
    );
  }

  const isResolved = discrepancy.status !== 'pending';

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          กลับ
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              รายละเอียดความผิดปกติ
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={getDiscrepancyTypeLabel(discrepancy.discrepancyType)}
                color={getDiscrepancyTypeColor(discrepancy.discrepancyType)}
              />
              <Chip
                label={discrepancy.severity}
                color={getSeverityColor(discrepancy.severity)}
                size="small"
              />
              <Chip
                label={getStatusLabel(discrepancy.status)}
                color={getStatusColor(discrepancy.status)}
                size="small"
              />
            </Stack>
          </Box>

          {/* Resolution Actions */}
          {!isResolved && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="อัพเดท Daily Report ด้วยข้อมูลจาก ScanData">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Edit />}
                  onClick={() => handleResolveClick('update_dr')}
                  disabled={discrepancy.discrepancyType === 'Type3'}
                >
                  Update DR
                </Button>
              </Tooltip>
              <Tooltip title="สร้าง Daily Report ใหม่จาก ScanData">
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Add />}
                  onClick={() => handleResolveClick('create_dr')}
                  disabled={discrepancy.discrepancyType !== 'Type3'}
                >
                  Create DR
                </Button>
              </Tooltip>
              <Tooltip title="ตรวจสอบแล้ว - ข้อมูลถูกต้อง">
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<CheckCircle />}
                  onClick={() => handleResolveClick('verify')}
                >
                  Verify
                </Button>
              </Tooltip>
              <Tooltip title="ยกเว้น - ไม่ต้องแก้ไข">
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<Block />}
                  onClick={() => handleResolveClick('ignore')}
                >
                  Ignore
                </Button>
              </Tooltip>
            </Stack>
          )}
        </Box>
      </Box>

      {/* Alert Banner */}
      {discrepancy.severity === 'high' && discrepancy.status === 'pending' && (
        <Alert severity="error" icon={<Warning />} sx={{ mb: 3 }}>
          <AlertTitle>ความผิดปกติรุนแรง</AlertTitle>
          ต้องดำเนินการแก้ไขโดยเร็วที่สุด - ส่วนต่างชั่วโมงมากกว่า 2 ชั่วโมง
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column: Basic Info & Comparison */}
        <Grid item xs={12} lg={8}>
          {/* Basic Information */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Info sx={{ verticalAlign: 'middle', mr: 1 }} />
              ข้อมูลพื้นฐาน
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  วันที่
                </Typography>
                <Typography variant="body1">
                  {new Date(discrepancy.workDate).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  รหัสพนักงาน
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {discrepancy.employeeNumber}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  ชื่อ DC
                </Typography>
                <Typography variant="body1">
                  {discrepancy.dailyContractorName || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  โครงการ
                </Typography>
                <Typography variant="body1">
                  {discrepancy.projectLocationName || '-'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Side-by-Side Comparison */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              เปรียบเทียบข้อมูล
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={3}>
              {/* Daily Report Column */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ bgcolor: 'primary.50', height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Daily Report
                    </Typography>
                    {discrepancy.dailyReportHours != null ? (
                      <>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            ชั่วโมงทำงาน
                          </Typography>
                          <Typography variant="h4" color="primary.main">
                            {discrepancy.dailyReportHours.toFixed(2)} ชม.
                          </Typography>
                        </Box>
                        {discrepancy.dailyReportData && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              เวลาเข้า-ออก
                            </Typography>
                            <Typography variant="body2">
                              {discrepancy.dailyReportData.startTime || '-'} -{' '}
                              {discrepancy.dailyReportData.endTime || '-'}
                            </Typography>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        ไม่มีข้อมูล Daily Report
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* ScanData Column */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ bgcolor: 'secondary.50', height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      ScanData
                    </Typography>
                    {discrepancy.scanDataHours != null ? (
                      <>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            ชั่วโมงทำงาน
                          </Typography>
                          <Typography variant="h4" color="secondary.main">
                            {discrepancy.scanDataHours.toFixed(2)} ชม.
                          </Typography>
                        </Box>
                        {discrepancy.scanDataRecords && discrepancy.scanDataRecords.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              จำนวนการสแกน
                            </Typography>
                            <Typography variant="body2">
                              {discrepancy.scanDataRecords.length} ครั้ง
                            </Typography>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        ไม่มีข้อมูล ScanData
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Difference */}
              <Grid item xs={12}>
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor:
                      Math.abs(discrepancy.hoursDifference || 0) > 2
                        ? 'error.50'
                        : 'warning.50',
                    borderColor:
                      Math.abs(discrepancy.hoursDifference || 0) > 2 ? 'error.main' : 'warning.main',
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      ส่วนต่าง
                    </Typography>
                    <Typography variant="h3" color={
                      Math.abs(discrepancy.hoursDifference || 0) > 2 ? 'error.main' : 'warning.main'
                    }>
                      {discrepancy.hoursDifference != null
                        ? `${discrepancy.hoursDifference > 0 ? '+' : ''}${discrepancy.hoursDifference.toFixed(2)} ชม.`
                        : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {discrepancy.hoursDifference > 0
                        ? 'ScanData มากกว่า Daily Report'
                        : 'Daily Report มากกว่า ScanData'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Scan Records Timeline */}
          {discrepancy.scanDataRecords && discrepancy.scanDataRecords.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <AccessTime sx={{ verticalAlign: 'middle', mr: 1 }} />
                ประวัติการสแกน ({discrepancy.scanDataRecords.length} ครั้ง)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>เวลา</TableCell>
                    <TableCell>ประเภท</TableCell>
                    <TableCell align="right">ชั่วโมง (ปัดเศษ)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {discrepancy.scanDataRecords
                    .sort((a, b) => new Date(a.scanTime).getTime() - new Date(b.scanTime).getTime())
                    .map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(record.scanTime).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip label={record.scanType} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          {record.roundedTime
                            ? new Date(record.roundedTime).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Grid>

        {/* Right Column: Resolution History & Notes */}
        <Grid item xs={12} lg={4}>
          {/* Resolution Status */}
          {isResolved && discrepancy.resolutionMethod && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50' }}>
              <Typography variant="h6" gutterBottom color="success.main">
                <CheckCircle sx={{ verticalAlign: 'middle', mr: 1 }} />
                แก้ไขแล้ว
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  วิธีการแก้ไข
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {getResolutionMethodLabel(discrepancy.resolutionMethod)}
                </Typography>

                {discrepancy.resolvedBy && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      ผู้แก้ไข
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      {discrepancy.resolvedBy}
                    </Typography>
                  </>
                )}

                {discrepancy.resolvedAt && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      เวลาที่แก้ไข
                    </Typography>
                    <Typography variant="body2">
                      {new Date(discrepancy.resolvedAt).toLocaleString('th-TH')}
                    </Typography>
                  </>
                )}
              </Box>
            </Paper>
          )}

          {/* Resolution Note */}
          {discrepancy.resolutionNote && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                หมายเหตุการแก้ไข
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {discrepancy.resolutionNote}
              </Typography>
            </Paper>
          )}

          {/* Detection Info */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <History sx={{ verticalAlign: 'middle', mr: 1 }} />
              ข้อมูลการตรวจพบ
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                ตรวจพบเมื่อ
              </Typography>
              <Typography variant="body2" gutterBottom>
                {new Date(discrepancy.detectedAt).toLocaleString('th-TH')}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                ประเภทความผิดปกติ
              </Typography>
              <Typography variant="body2" gutterBottom>
                {getDiscrepancyTypeDescription(discrepancy.discrepancyType)}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                ระดับความรุนแรง
              </Typography>
              <Typography variant="body2">
                {discrepancy.severity === 'high'
                  ? 'สูง (ส่วนต่าง > 2 ชม.)'
                  : discrepancy.severity === 'medium'
                  ? 'กลาง (ส่วนต่าง 1-2 ชม.)'
                  : 'ต่ำ (ส่วนต่าง < 1 ชม.)'}
              </Typography>
            </Box>
          </Paper>

          {/* Help Card */}
          <Paper sx={{ p: 3, bgcolor: 'info.50' }}>
            <Typography variant="subtitle2" gutterBottom color="info.main">
              💡 คำแนะนำ
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              {discrepancy.discrepancyType === 'Type1' && (
                <>
                  <strong>Type1:</strong> Daily Report มีชั่วโมงน้อยกว่า ScanData
                  <br />
                  → แนะนำ: <strong>Update DR</strong> เพื่ออัพเดทให้ตรงกับ ScanData
                </>
              )}
              {discrepancy.discrepancyType === 'Type2' && (
                <>
                  <strong>Type2:</strong> มี Daily Report แต่ไม่มี ScanData
                  <br />
                  → แนะนำ: <strong>Verify</strong> หาก DC ทำงานจริง หรือ <strong>Update DR</strong>{' '}
                  หากต้องแก้ไข
                </>
              )}
              {discrepancy.discrepancyType === 'Type3' && (
                <>
                  <strong>Type3:</strong> มี ScanData แต่ไม่มี Daily Report
                  <br />
                  → แนะนำ: <strong>Create DR</strong> สร้าง Daily Report ใหม่จาก ScanData
                </>
              )}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Resolution Dialog */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedMethod === 'update_dr' && 'อัพเดท Daily Report'}
          {selectedMethod === 'create_dr' && 'สร้าง Daily Report ใหม่'}
          {selectedMethod === 'verify' && 'ตรวจสอบแล้ว'}
          {selectedMethod === 'ignore' && 'ยกเว้น'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmitResolution)}>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="info">
                {selectedMethod === 'update_dr' &&
                  'จะอัพเดท Daily Report ให้ตรงกับข้อมูลจาก ScanData'}
                {selectedMethod === 'create_dr' &&
                  'จะสร้าง Daily Report ใหม่จากข้อมูล ScanData'}
                {selectedMethod === 'verify' &&
                  'ยืนยันว่าข้อมูลถูกต้อง ไม่ต้องแก้ไข'}
                {selectedMethod === 'ignore' &&
                  'ยกเว้นความผิดปกตินี้ จะไม่แสดงในรายการรอแก้ไข'}
              </Alert>

              {selectedMethod === 'update_dr' && (
                <Controller
                  name="updatedHours"
                  control={control}
                  defaultValue={discrepancy?.scanDataHours || 0}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="ชั่วโมงทำงาน (จาก ScanData)"
                      type="number"
                      fullWidth
                      inputProps={{ step: 0.01, min: 0 }}
                      error={!!errors.updatedHours}
                      helperText={errors.updatedHours?.message}
                    />
                  )}
                />
              )}

              <Controller
                name="note"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="หมายเหตุ"
                    multiline
                    rows={3}
                    fullWidth
                    required
                    error={!!errors.note}
                    helperText={errors.note?.message || 'กรุณาระบุเหตุผลในการดำเนินการ'}
                  />
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResolveDialogOpen(false)}>ยกเลิก</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
}

/**
 * Helper Functions
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'รอแก้ไข';
    case 'fixed':
      return 'แก้ไขแล้ว';
    case 'verified':
      return 'ตรวจสอบแล้ว';
    case 'ignored':
      return 'ยกเว้น';
    default:
      return status;
  }
}

function getStatusColor(
  status: string
): 'warning' | 'success' | 'info' | 'default' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'fixed':
      return 'success';
    case 'verified':
      return 'info';
    case 'ignored':
      return 'default';
    default:
      return 'default';
  }
}

function getResolutionMethodLabel(method: string): string {
  switch (method) {
    case 'update_dr':
      return 'อัพเดท Daily Report';
    case 'create_dr':
      return 'สร้าง Daily Report ใหม่';
    case 'verify':
      return 'ตรวจสอบแล้ว - ข้อมูลถูกต้อง';
    case 'ignore':
      return 'ยกเว้น - ไม่ต้องแก้ไข';
    default:
      return method;
  }
}

function getDiscrepancyTypeDescription(type: string): string {
  switch (type) {
    case 'Type1':
      return 'Daily Report < ScanData (ชั่วโมงต่างกัน)';
    case 'Type2':
      return 'มี Daily Report แต่ไม่มี ScanData';
    case 'Type3':
      return 'มี ScanData แต่ไม่มี Daily Report';
    default:
      return type;
  }
}
