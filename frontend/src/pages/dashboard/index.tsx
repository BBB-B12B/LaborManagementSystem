/**
 * Dashboard Page
 * หน้าแดชบอร์ด
 *
 * Main dashboard showing:
 * - Active workers count (FR-D-001)
 * - ScanData monitoring widget (FR-D-001)
 * - Navigation menu (FR-D-002, FR-D-003, FR-D-004)
 */

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Engineering as EngineeringIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Layout, ProtectedRoute } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import ScanDataMonitoringWidget from '@/components/dashboard/ScanDataMonitoringWidget';

/**
 * Stat card component
 */
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = 'primary',
  subtitle,
}) => {
  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: `${color}.main`,
              width: 56,
              height: 56,
              mr: 2,
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h4" component="div" fontWeight="600">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};

/**
 * Dashboard page component
 */
function Dashboard() {
  const { t } = useTranslation();

  // TODO: Replace with actual API calls
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return {
        activeWorkers: 45,
        totalProjects: 8,
        todayReports: 12,
      };
    },
  });

  return (
    <Layout>
      <Box>
        {/* Page Title */}
        <Typography variant="h4" component="h1" gutterBottom fontWeight="600">
          {t('dashboard.title')}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          ภาพรวมระบบจัดการแรงงานและรายงานประจำวัน
        </Typography>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Active Workers - FR-D-001 */}
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={t('dashboard.activeWorkers')}
              value={dashboardStats?.activeWorkers || 0}
              icon={<EngineeringIcon fontSize="large" />}
              color="primary"
              subtitle="คน"
            />
          </Grid>

          {/* Total Projects */}
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={t('dashboard.totalProjects')}
              value={dashboardStats?.totalProjects || 0}
              icon={<FolderIcon fontSize="large" />}
              color="info"
              subtitle="โครงการ"
            />
          </Grid>

          {/* Today's Reports */}
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title={t('dashboard.todayReports')}
              value={dashboardStats?.todayReports || 0}
              icon={<DescriptionIcon fontSize="large" />}
              color="success"
              subtitle="รายงาน"
            />
          </Grid>
        </Grid>

        {/* ScanData Monitoring Widget - FR-D-001 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <ScanDataMonitoringWidget />
          </Grid>

          {/* Additional widgets can be added here */}
          {/* <Grid item xs={12} md={6}>
            <RecentActivitiesWidget />
          </Grid> */}
        </Grid>
      </Box>
    </Layout>
  );
}

/**
 * Wrap dashboard with ProtectedRoute
 */
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
