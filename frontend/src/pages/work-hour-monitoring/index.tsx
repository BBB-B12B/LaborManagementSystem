import React, { useState } from 'react';
import { Box, Typography, Stack, Paper, Button, TextField, InputAdornment } from '@mui/material';
import {
  FileDownload as FileDownloadIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Layout, ProtectedRoute } from '@/components/layout';
import WorkHourComparisonTable from '@/components/work-hour-monitoring/WorkHourComparisonTable';
import SummaryStats from '@/components/work-hour-monitoring/SummaryStats';
import DatePicker from '@/components/forms/DatePicker';

/**
 * Work Hour Monitoring Page
 * ระบบติดตามและจัดการชั่วโมงทำงาน
 */
export default function WorkHourMonitoringPage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ProtectedRoute>
      <Layout maxWidth={false}>
        <Box sx={{ p: 1 }}>
          {/* Header Row (Styled Title & Date Selection) */}
          <Stack 
            direction="row" 
            justifyContent="space-between" 
            alignItems="center"
            sx={{ mb: 2, mt: 0.5 }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box 
                sx={{ 
                  width: 6, 
                  height: 32, 
                  backgroundColor: '#01497c', // BLUE.ROYAL
                  borderRadius: '3px',
                  boxShadow: '0 2px 8px rgba(1, 73, 124, 0.3)'
                }} 
              />
              <Typography 
                variant="h4" 
                fontWeight="900" 
                sx={{ 
                  color: '#001b48', // BLUE.NAVY
                  letterSpacing: '-1px',
                  fontSize: '1.75rem'
                }}
              >
                ระบบติดตามและจัดการชั่วโมงทำงาน
              </Typography>
            </Stack>

            <Box sx={{ minWidth: 200 }}>
              <DatePicker
                label={t('common.date')}
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
              />
            </Box>
          </Stack>

          {/* Compact Summary Stats Section */}
          <SummaryStats />

          {/* Tighter Action Row (Export & Search) */}
          <Stack 
            direction="row" 
            spacing={1} 
            justifyContent="flex-end" 
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              sx={{ 
                borderRadius: '8px', 
                borderColor: '#01497c', 
                color: '#01497c',
                textTransform: 'none',
                fontWeight: 800,
                px: 2,
                height: 36,
                '&:hover': { borderColor: '#001b48', backgroundColor: '#f0f9ff' }
              }}
            >
              Export
            </Button>
            
            <TextField
              placeholder="ตัวกรองข้อมูล"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ 
                width: 240,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  height: 36,
                  backgroundColor: '#fff',
                  fontSize: '0.875rem',
                  '& fieldset': { borderColor: '#a1c1db' },
                  '&:hover fieldset': { borderColor: '#2a9df4' },
                  '&.Mui-focused fieldset': { borderColor: '#01497c' },
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#01497c', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {/* Table Section - Reduced shadow and tighter border */}
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: '12px', 
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <WorkHourComparisonTable selectedDate={selectedDate} />
          </Paper>
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
