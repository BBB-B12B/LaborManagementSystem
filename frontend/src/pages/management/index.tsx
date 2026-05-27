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
  CardActionArea,
  Button,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import GroupsIcon from '@mui/icons-material/Groups';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { Layout, ProtectedRoute } from '@/components/layout';

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
  {
    key: 'social-security-rules',
    label: 'จัดการเกณฑ์ประกันสังคม',
    description: 'ตั้งค่าเงื่อนไขการหักเงินประกันสังคมตามรายได้',
    icon: <EngineeringIcon fontSize="large" color="primary" />, // Can reuse icon or import a new one like SettingsIcon
    href: '/management/social-security-rules',
    permissionCheck: (permissions: ReturnType<typeof usePermissions>) =>
      permissions.canAccessSSOManagement,
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
    <ProtectedRoute requiredRoles={['AM', 'OE', 'PE', 'PM', 'PD', 'MD']}>
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>

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
                <Grid key={section.key} item xs={12} sm={6} md={3}>
                  <Card
                    sx={{
                      height: '100%',
                      minHeight: 220,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '24px',
                      border: '2px solid transparent',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <CardActionArea
                      onClick={() => router.push(section.href)}
                      sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 3,
                      }}
                    >
                      <CardContent
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          width: '100%',
                        }}
                      >
                        <Box
                          sx={{
                            mb: 2,
                            color: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '& svg': {
                              fontSize: '64px !important',
                            },
                          }}
                        >
                          {section.icon}
                        </Box>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 600, color: 'text.primary' }}
                        >
                          {section.label}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
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
