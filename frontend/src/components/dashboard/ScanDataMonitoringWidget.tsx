import React from 'react';
import { Card, CardContent, CardHeader, Typography, Alert, Box } from '@mui/material';

const ScanDataMonitoringWidget: React.FC = () => {
  return (
    <Card>
      <CardHeader title="การกระทบยอด (Reconciliation)" />
      <CardContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          ระบบได้ถูกอัปเกรดเป็น Event-Driven Reconciliation เรียบร้อยแล้ว
        </Alert>
        <Typography variant="body2" color="text.secondary">
          โปรดไปที่หน้าจอ <strong>ระบบติดตามและจัดการชั่วโมงทำงาน</strong>{' '}
          เพื่อดูรายละเอียดและอนุมัติการกระทบยอด
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ScanDataMonitoringWidget;
