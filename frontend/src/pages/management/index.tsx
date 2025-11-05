/**
 * Management Hub Page
 * หน้าศูนย์รวมเมนูจัดการ (โครงการ, สมาชิก, แรงงานรายวัน)
 */

import React from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import GroupsIcon from '@mui/icons-material/Groups';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { Layout, ProtectedRoute } from '@/components/layout';
import { BackButton } from '@/components/common/BackButton';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/utils/permissions';

const MANAGEMENT_SECTIONS = [
  {
    key: 'projects',
    label: 'จัดการโครงการ',
    description: 'สร้างและปรับปรุงข้อมูลโครงการ กำหนดผู้รับผิดชอบและสถานะ',
    icon: <FolderIcon fontSize="large" color="primary" />,
    href: '/project-management',
    permissionCheck: (permissions: ReturnType<typeof usePermissions>) =>
      permissions.canAccessNewProject,
  },
  {
    key: 'members',
    label: 'จัดการสมาชิก',
    description: 'เพิ่มสิทธิ์ผู้ใช้งาน ปรับบทบาท และดูข้อมูลสมาชิกทั้งหมด',
    icon: <GroupsIcon fontSize="large" color="primary" />,
    href: '/member-management',
    permissionCheck: (permissions: ReturnType<typeof usePermissions>) =>
      permissions.canAccessMemberManagement,
  },
  {
    key: 'daily-contractors',
    label: 'จัดการแรงงานรายวัน',
    description: 'ดูและบันทึกข้อมูลแรงงานรายวัน จัดกลุ่มทักษะ และสถานะการทำงาน',
    icon: <EngineeringIcon fontSize="large" color="primary" />,
    href: '/dc-management',
    permissionCheck: (permissions: ReturnType<typeof usePermissions>) =>
      permissions.canAccessDCManagement,
  },
] as const;

export default function ManagementHubPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const permissions = usePermissions(user);

  const sections = MANAGEMENT_SECTIONS.filter((section) =>
    section.permissionCheck(permissions)
  );

  return (
    <ProtectedRoute requiredRoles={['AM', 'FM', 'OE', 'PE', 'PM', 'PD', 'MD']}>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <BackButton href="/dashboard" />
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" gutterBottom>
              การจัดการข้อมูล
            </Typography>
          </Box>

          {sections.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="h6">ไม่มีสิทธิ์เข้าถึง</Typography>
                <Typography variant="body2" color="text.secondary">
                  บัญชีผู้ใช้นี้ยังไม่ได้รับสิทธิ์จัดการข้อมูลในส่วนใด หากต้องการเข้าถึงให้ติดต่อผู้ดูแลระบบ
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {sections.map((section) => (
                <Grid key={section.key} item xs={12} md={4}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ mb: 2 }}>{section.icon}</Box>
                      <Typography variant="h6" gutterBottom>
                        {section.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {section.description}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small" onClick={() => router.push(section.href)}>
                        เข้าสู่หน้าจัดการ
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
