/**
 * Unauthorized Page
 * หน้าสำหรับแจ้งเตือนเมื่อผู้ใช้ไม่มีสิทธิ์เข้าถึงหน้าใดหน้าหนึ่ง
 */

import React from 'react';
import Link from 'next/link';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Typography } from '@mui/material';
import { Layout } from '@/components/layout';

const UnauthorizedPage: React.FC = () => {
  return (
    <Layout>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          textAlign: 'center',
          gap: 2,
        }}
      >
        <WarningAmberIcon color="warning" sx={{ fontSize: 72 }} />
        <Typography variant="h3" component="h1">
          ไม่มีสิทธิ์เข้าถึง
        </Typography>
        <Typography variant="body1" color="text.secondary">
          คุณไม่มีสิทธิ์ในการเข้าถึงหน้าที่ต้องการ กรุณาติดต่อผู้ดูแลระบบหากคิดว่ามีข้อผิดพลาด
        </Typography>
        <Button component={Link} href="/" variant="contained" sx={{ mt: 2 }}>
          กลับไปหน้าแรก
        </Button>
      </Box>
    </Layout>
  );
};

export default UnauthorizedPage;

