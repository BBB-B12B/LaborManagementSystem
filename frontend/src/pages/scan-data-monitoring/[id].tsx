import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Container, Typography } from '@mui/material';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export default function DiscrepancyDetailPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new Work Hour Monitoring dashboard which handles Reconciliations
    router.replace('/work-hour-monitoring');
  }, [router]);

  return (
    <Container maxWidth="lg" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner size="large" />
      <Typography variant="h6" sx={{ mt: 4, color: 'text.secondary' }}>
        กำลังพาคุณไปยังระบบจัดการชั่วโมงทำงานใหม่...
      </Typography>
    </Container>
  );
}
