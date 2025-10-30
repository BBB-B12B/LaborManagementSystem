/**
 * ScanData Monitoring Widget
 * Widget แสดงสรุปความผิดปกติของ ScanData สำหรับ Dashboard
 *
 * Features:
 * - แสดงจำนวนความผิดปกติแต่ละประเภท (Type1, Type2, Type3)
 * - แสดงรายการล่าสุด
 * - Filter ตามวันที่และโครงการ
 * - คลิกดูรายละเอียดได้
 *
 * FR-SD-010: Dashboard monitoring widget
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh,
  Visibility,
  FilterList,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  getDiscrepancySummary,
  type ScanDataDiscrepancy,
} from '../../services/scanDataService';
import {
  getDiscrepancyTypeLabel,
  getDiscrepancyTypeColor,
  getSeverityColor,
} from '../../validation/scanDataSchema';

interface ScanDataMonitoringWidgetProps {
  projectLocationId?: string;
  onViewAll?: () => void;
}

const ScanDataMonitoringWidget: React.FC<ScanDataMonitoringWidgetProps> = ({
  projectLocationId,
  onViewAll,
}) => {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch discrepancy summary
  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['discrepancySummary', projectLocationId],
    queryFn: () => getDiscrepancySummary(projectLocationId),
    refetchInterval: autoRefresh ? 60000 : false, // Auto-refresh every 1 minute
  });

  const handleViewDiscrepancy = (id: string) => {
    router.push(`/scan-data-monitoring/${id}`);
  };

  const handleViewAllDiscrepancies = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      router.push('/scan-data-monitoring');
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <Card>
        <CardHeader title="ScanData Monitoring" />
        <CardContent>
          <Alert severity="error">
            เกิดข้อผิดพลาด: {(error as Error).message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="ScanData Monitoring"
        subheader="ตรวจสอบความผิดปกติระหว่าง Daily Report และ ScanData"
        action={
          <Tooltip title="รีเฟรช">
            <IconButton onClick={handleRefresh} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : summary ? (
          <Box>
            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {/* Total Discrepancies */}
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'error.light',
                    borderRadius: 1,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" color="error.dark">
                    {summary.totalDiscrepancies}
                  </Typography>
                  <Typography variant="body2" color="error.dark">
                    ทั้งหมด
                  </Typography>
                </Box>
              </Grid>

              {/* Pending Count */}
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'warning.light',
                    borderRadius: 1,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" color="warning.dark">
                    {summary.pendingCount}
                  </Typography>
                  <Typography variant="body2" color="warning.dark">
                    รอแก้ไข
                  </Typography>
                </Box>
              </Grid>

              {/* High Severity */}
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'error.lighter',
                    borderRadius: 1,
                    textAlign: 'center',
                    border: '1px solid',
                    borderColor: 'error.main',
                  }}
                >
                  <Typography variant="h4" color="error.main">
                    {summary.highSeverityCount}
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    ความรุนแรงสูง
                  </Typography>
                </Box>
              </Grid>

              {/* View All Button */}
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'primary.light',
                    borderRadius: 1,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'primary.main',
                      '& *': {
                        color: 'white',
                      },
                    },
                  }}
                  onClick={handleViewAllDiscrepancies}
                >
                  <Visibility sx={{ fontSize: 32, color: 'primary.dark' }} />
                  <Typography variant="body2" color="primary.dark">
                    ดูทั้งหมด
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Type Breakdown */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                ประเภทความผิดปกติ:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                <Chip
                  icon={<ErrorIcon />}
                  label={`Type 1: ${summary.type1Count}`}
                  color="error"
                  size="small"
                  title="Daily Report < ScanData"
                />
                <Chip
                  icon={<WarningIcon />}
                  label={`Type 2: ${summary.type2Count}`}
                  color="warning"
                  size="small"
                  title="Daily Report มี แต่ ScanData ไม่มี"
                />
                <Chip
                  icon={<WarningIcon />}
                  label={`Type 3: ${summary.type3Count}`}
                  color="warning"
                  size="small"
                  title="Daily Report ไม่มี แต่ ScanData มี"
                />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Recent Discrepancies */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                ความผิดปกติล่าสุด:
              </Typography>
              {summary.recentDiscrepancies.length === 0 ? (
                <Alert severity="success" sx={{ mt: 1 }}>
                  ไม่พบความผิดปกติ ✓
                </Alert>
              ) : (
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {summary.recentDiscrepancies.map((discrepancy) => (
                    <ListItemButton
                      key={discrepancy.id}
                      onClick={() => handleViewDiscrepancy(discrepancy.id)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {discrepancy.dailyContractorName || discrepancy.employeeNumber}
                            </Typography>
                            <Chip
                              label={discrepancy.discrepancyType}
                              size="small"
                              color={getDiscrepancyTypeColor(discrepancy.discrepancyType)}
                            />
                            <Chip
                              label={discrepancy.severity}
                              size="small"
                              color={getSeverityColor(discrepancy.severity)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" display="block">
                              {new Date(discrepancy.workDate).toLocaleDateString('th-TH')} •{' '}
                              {discrepancy.projectLocationName || 'โครงการ'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {getDiscrepancyTypeLabel(discrepancy.discrepancyType)}
                              {discrepancy.hoursDifference
                                ? ` (ต่าง ${discrepancy.hoursDifference.toFixed(2)} ชม.)`
                                : ''}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>

            {/* Info */}
            {summary.totalDiscrepancies > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  💡 ระบบตรวจจับความผิดปกติระหว่าง Daily Report และ ScanData
                  โดยอัตโนมัติ กรุณาตรวจสอบและแก้ไขก่อนคำนวณค่าแรง
                </Typography>
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="info">ไม่มีข้อมูล</Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ScanDataMonitoringWidget;
