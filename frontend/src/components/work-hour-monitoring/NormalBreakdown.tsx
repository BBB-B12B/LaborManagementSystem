import React from 'react';
import { Box, Grid, Paper, Typography, Stack, Button } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  EventBusy as EventBusyIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService } from '../../services/reconciliationService';

const BLUE = {
  NAVY: '#001b48',
  ROYAL: '#02457a',
  CERULEAN: '#018abe',
  LIGHT: '#97cadb',
  ICE: '#d6e8ee',
  TEXT_LIGHT: '#64748b',
};

const BreakdownCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'colorTheme',
})<{ active?: boolean; colorTheme?: 'blue' | 'orange' | 'red' | 'purple' }>(({ theme, active, colorTheme }) => {
  let borderColor = 'transparent';
  let bgColor = '#ffffff';
  
  if (active) {
    if (colorTheme === 'blue') {
      borderColor = '#0ea5e9';
      bgColor = '#f0f9ff';
    } else if (colorTheme === 'orange') {
      borderColor = '#f59e0b';
      bgColor = '#fffbeb';
    } else if (colorTheme === 'red') {
      borderColor = '#ef4444';
      bgColor = '#fef2f2';
    } else if (colorTheme === 'purple') {
      borderColor = '#8b5cf6';
      bgColor = '#f5f3ff';
    }
  }

  return {
    padding: theme.spacing(1.5),
    border: `2px solid ${active ? borderColor : '#e2e8f0'}`,
    borderRadius: '12px',
    cursor: 'pointer',
    backgroundColor: bgColor,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
    height: '100%',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 16px -4px rgba(0,0,0,0.05)',
      borderColor: active ? borderColor : '#cbd5e1',
    },
  };
});

const ExportButton = styled(Button)({
  textTransform: 'none',
  fontSize: '0.65rem',
  padding: '2px 8px',
  minWidth: 'auto',
  fontWeight: 700,
  borderRadius: '6px',
});

interface Props {
  onCardClick: (statusId: string) => void;
  onExport: (statusId: string) => void;
  activeId?: string;
  project?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

interface BreakdownItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  colorTheme: 'blue' | 'orange' | 'red' | 'purple';
  count: number;
}

const NormalBreakdown: React.FC<Props> = ({ onCardClick, onExport, activeId, project, startDate, endDate }) => {
  const { data: stats } = useQuery({
    queryKey: ['reconciliation-breakdown-stats', project, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => reconciliationService.getStats({
      projectLocationId: project !== 'all' ? project : undefined,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    }),
    staleTime: 60000,
  });

  const counts = {
    matched: (stats?.normalCount ?? 0) - (stats?.leaveCount ?? 0),
    leave:   stats?.leaveCount ?? 0,
  };

  const items: BreakdownItem[] = [
    {
      id: 'normal',
      title: 'ข้อมูลตรงกัน',
      description: 'ชั่วโมงทำงาน/OT สอดคล้องกันทั้ง 2 ฝ่าย',
      icon: <CheckCircleIcon sx={{ fontSize: 28, color: '#0ea5e9' }} />,
      colorTheme: 'blue',
      count: counts.matched,
    },
    {
      id: 'leave',
      title: 'ลา',
      description: 'พนักงานยื่นใบลาหยุด รอการตรวจสอบจาก admin',
      icon: <EventBusyIcon sx={{ fontSize: 28, color: '#d97706' }} />,
      colorTheme: 'orange',
      count: counts.leave,
    },
  ];

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1.5}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={6} key={item.id}>
            <BreakdownCard 
              active={activeId === item.id} 
              colorTheme={item.colorTheme}
              onClick={() => onCardClick(item.id)}
              elevation={0}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: activeId === item.id ? '#fff' : 'transparent',
                  transition: 'all 0.3s'
                }}>
                  {item.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" fontWeight={900} sx={{ lineHeight: 1.1, mb: 0.2, display: 'block', fontSize: '0.75rem' }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BLUE.TEXT_LIGHT, display: 'block', lineHeight: 1, mb: 0.5, fontSize: '0.6rem' }}>
                    {item.description}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 0.5 }}>
                    <ExportButton 
                      size="small" 
                      variant="outlined" 
                      startIcon={<FileDownloadIcon sx={{ fontSize: '10px !important' }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport(item.id);
                      }}
                      sx={{ mt: 0 }}
                    >
                      Export
                    </ExportButton>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 0.8, color: '#334155' }}>
                        {item.count}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8' }}>
                        รายการ
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </BreakdownCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default NormalBreakdown;
