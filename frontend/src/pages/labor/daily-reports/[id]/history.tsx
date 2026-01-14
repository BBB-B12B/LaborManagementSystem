/**
 * Daily Report Edit History Page
 * หน้าประวัติการแก้ไขรายงานการทำงานรายวัน
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
} from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import { Layout, ProtectedRoute } from '@/components/layout';
import { LoadingSpinner } from '@/components/common';
import { dailyReportService } from '@/services/dailyReportService';
import { formatDateTime } from '@/utils/dateUtils';

/**
 * Daily Report Edit History Page
 *
 * Shows complete edit history for a daily report:
 * - Who edited
 * - When edited
 * - Before/after values
 * - Timeline view
 */
export default function DailyReportHistoryPage() {
  const router = useRouter();
  const { id } = router.query;

  // Fetch edit history
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['dailyReportHistory', id],
    queryFn: () => dailyReportService.getHistory(id as string),
    enabled: !!id,
  });

  // Fetch current report for context
  const { data: report } = useQuery({
    queryKey: ['dailyReport', id],
    queryFn: () => dailyReportService.getById(id as string),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <LoadingSpinner message="กำลังโหลดประวัติการแก้ไข..." />
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error || !history) {
    return (
      <ProtectedRoute>
        <Layout>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Alert severity="error">
              ไม่พบประวัติการแก้ไข หรือคุณไม่มีสิทธิ์เข้าถึง
            </Alert>
          </Container>
        </Layout>
      </ProtectedRoute>
    );
  }

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      projectLocationId: 'โครงการ',
      reportDate: 'วันที่',
      dailyContractorIds: 'แรงงาน',
      workDescription: 'งาน',
      startTime: 'เวลาเริ่ม',
      endTime: 'เวลาจบ',
      workHours: 'ชั่วโมง',
      totalWage: 'ค่าแรง',
      workType: 'ประเภทงาน',
      notes: 'หมายเหตุ',
      imageUrls: 'รูปภาพ',
    };
    return labels[field] || field;
  };

  const formatValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return '-';

    if (Array.isArray(value)) {
      return value.length > 0 ? `${value.length} รายการ` : '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'ใช่' : 'ไม่';
    }

    if (typeof value === 'number') {
      if (field === 'totalWage') return `${value.toLocaleString()} บาท`;
      if (field === 'workHours') return `${value.toFixed(1)} ชม.`;
      return value.toString();
    }

    return value.toString();
  };

  return (
    <ProtectedRoute>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              ประวัติการแก้ไข
            </Typography>
            {report && (
              <Typography variant="body2" color="text.secondary">
                รายงาน: {report.workDescription} | {formatDateTime(report.reportDate, 'dd/MM/yyyy')}
              </Typography>
            )}
          </Box>

          {/* History Timeline */}
          {history.length === 0 ? (
            <Alert severity="info">ยังไม่มีประวัติการแก้ไข</Alert>
          ) : (
            <Timeline position="right">
              {history.map((entry, index) => (
                <TimelineItem key={entry.id}>
                  <TimelineSeparator>
                    <TimelineDot
                      color={entry.action === 'create' ? 'success' : 'primary'}
                    />
                    {index < history.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Card sx={{ mb: 2 }}>
                      <CardContent>
                        {/* Header */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2,
                          }}
                        >
                          <Box>
                            <Typography variant="h6">
                              {entry.action === 'create' ? 'สร้างรายการ' : 'แก้ไขรายการ'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              โดย: {entry.editedByName || entry.editedBy}
                            </Typography>
                          </Box>
                          <Chip
                            label={formatDateTime(entry.editedAt, 'dd/MM/yyyy HH:mm')}
                            size="small"
                            variant="outlined"
                          />
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        {/* Changes */}
                        {entry.action === 'create' ? (
                          <Alert severity="success" sx={{ mt: 2 }}>
                            สร้างรายการใหม่
                          </Alert>
                        ) : (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              รายการที่แก้ไข:
                            </Typography>
                            <Grid container spacing={2}>
                              {Object.entries(entry.changedFields || {}).map(([field, change]: [string, any]) => (
                                <Grid item xs={12} key={field}>
                                  <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="body2" fontWeight={600} gutterBottom>
                                      {getFieldLabel(field)}
                                    </Typography>
                                    <Grid container spacing={2}>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">
                                          ก่อนแก้ไข:
                                        </Typography>
                                        <Typography variant="body2">
                                          {formatValue(field, change.before)}
                                        </Typography>
                                      </Grid>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">
                                          หลังแก้ไข:
                                        </Typography>
                                        <Typography variant="body2" color="primary">
                                          {formatValue(field, change.after)}
                                        </Typography>
                                      </Grid>
                                    </Grid>
                                  </Paper>
                                </Grid>
                              ))}
                            </Grid>
                          </Box>
                        )}

                        {/* Notes */}
                        {entry.notes && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              หมายเหตุ:
                            </Typography>
                            <Typography variant="body2">{entry.notes}</Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
