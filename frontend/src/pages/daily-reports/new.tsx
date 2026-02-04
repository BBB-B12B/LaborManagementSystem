
import React from 'react';
import { DailyReportDashboard } from './components/DailyReportDashboard';
import { Layout, ProtectedRoute } from '@/components/layout';
import { Container } from '@mui/material';

/**
 * Unified Daily Report Page (Desktop & Mobile)
 * 
 * Replaces the legacy "WorkRecordComposerPage" (Card UI).
 * Now renders the Unified Daily Report View for all devices.
 */
export default function WorkRecordComposerPage() {
  return (
    <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
      <Layout>
        {/* Center container for Desktop aesthetics */}
        <Container maxWidth="md" sx={{ py: 0 }}>
          <DailyReportDashboard />
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
