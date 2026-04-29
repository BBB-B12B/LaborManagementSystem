import React from 'react';
import { Box, Grid, Paper, Typography, Stack, Button, IconButton } from '@mui/material';
import {
  HighlightOff as CancelIcon,
  Info as InfoIcon,
  SearchOff as SearchOffIcon,
  QueryBuilder as ClockIcon,
  FileDownload as FileDownloadIcon,
  AccountCircle as AccountIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  NearMe as SendIcon,
  RocketLaunch as RocketIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const BLUE = {
  NAVY: '#001b48',
  ROYAL: '#01497c',
  CERULEAN: '#2a9df4',
  LIGHT: '#a1c1db',
  ICE: '#f0f9ff',
  TEXT_MAIN: '#1c1e2b',
  TEXT_LIGHT: '#64748b',
};

const BreakdownCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'colorTheme',
})<{ active?: boolean; colorTheme: 'red' | 'orange' | 'purple' | 'blue' }>(({ theme, active, colorTheme }) => {
  const colors = {
    red: { border: '#fca5a5', hover: '#ef4444', bg: '#fff5f5' },
    orange: { border: '#fed7aa', hover: '#ea580c', bg: '#fff7ed' },
    purple: { border: '#ddd6fe', hover: '#7c3aed', bg: '#f5f3ff' },
    blue: { border: '#bae6fd', hover: '#0284c7', bg: '#f0f9ff' },
  };

  const selected = colors[colorTheme];

  return {
    padding: theme.spacing(1.5),
    borderRadius: '12px',
    border: '2px solid',
    borderColor: active ? selected.hover : selected.border,
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 20px -8px ${selected.hover}30`,
      borderColor: selected.hover,
    },
    ...(active && {
      boxShadow: `0 8px 25px -5px ${selected.hover}40`,
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '4px',
        height: '100%',
        backgroundColor: selected.hover,
      }
    })
  };
});

const ExportButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '0.6rem',
  fontWeight: 800,
  borderRadius: '6px',
  padding: '1px 6px',
  marginTop: theme.spacing(0.5),
  border: '1px solid #cbd5e1',
  color: '#475569',
  '&:hover': {
    backgroundColor: '#f1f5f9',
    borderColor: '#94a3b8',
  }
}));

const DetailItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  borderRadius: '10px',
  marginBottom: theme.spacing(0.75),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: BLUE.CERULEAN,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  }
}));

const StatusBadge = styled(Box)(({ theme }) => ({
  padding: '2px 12px',
  borderRadius: '6px',
  fontSize: '0.7rem',
  fontWeight: 800,
  backgroundColor: '#f1f5f9',
  color: '#64748b',
  border: '1px solid #e2e8f0',
}));

const ComparisonBox = styled(Box)(({ theme }) => ({
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: theme.spacing(1),
  border: '1px solid #e2e8f0',
  flex: 1,
}));

const ProofImagePlaceholder = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '110px',
  backgroundColor: '#fff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(0.5),
  color: '#94a3b8',
  fontSize: '0.75rem',
  fontWeight: 700,
}));

const TimeTable = styled('table')(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  '& th, & td': {
    border: '1px solid #cbd5e1',
    padding: '4px',
    textAlign: 'center',
    fontSize: '0.6rem',
    height: '32px',
  },
  '& th': {
    backgroundColor: '#f8fafc',
    fontWeight: 800,
    color: '#64748b',
  },
  '& td.label': {
    backgroundColor: '#fff',
    fontWeight: 900,
    textAlign: 'left',
    paddingLeft: '12px',
    width: '120px',
    fontSize: '0.85rem',
    color: BLUE.NAVY,
  },
  '& td.time-cell': {
    minWidth: '45px',
    fontWeight: 700,
  },
  '& td.empty-scan': {
    backgroundColor: '#ffedd5',
    color: '#ea580c',
  }
}));

const ReferenceButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  textTransform: 'none',
  width: '100%',
  justifyContent: 'center',
  padding: '10px',
  borderRadius: '8px',
  backgroundColor: active ? '#cbd5e1' : '#e2e8f0',
  color: BLUE.NAVY,
  fontWeight: 800,
  fontSize: '0.75rem',
  '&:hover': {
    backgroundColor: '#cbd5e1',
  },
  '&:last-child': {
    marginBottom: 0,
  }
}));

// --- Removed mock data as data is now shown in the main table ---

interface BreakdownItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  colorTheme: 'red' | 'orange' | 'purple' | 'blue';
  count: number;
}

interface Props {
  onCardClick: (id: string) => void;
  onExport: (id: string) => void;
  activeId?: string;
  viewMode?: 'breakdown' | 'fixed' | 'pending';
}

const AbnormalBreakdown: React.FC<Props> = ({ onCardClick, onExport, activeId, viewMode = 'breakdown' }) => {

  const items: BreakdownItem[] = [
    {
      id: 'missingDaily',
      title: 'ขาดข้อมูล Daily Report',
      description: 'มีสแกนนิ้ว แต่ไม่มีข้อมูลใน Daily Report',
      icon: <CancelIcon sx={{ fontSize: 28, color: '#ef4444' }} />,
      colorTheme: 'red',
      count: 24,
    },
    {
      id: 'workHourConflict',
      title: 'ข้อมูลการทำงานขัดแย้งกัน',
      description: 'ชั่วโมงทำงาน Daily Report และ สแกนนิ้วไม่ตรงกัน',
      icon: <InfoIcon sx={{ fontSize: 28, color: '#ea580c' }} />,
      colorTheme: 'orange',
      count: 12,
    },
    {
      id: 'missingScan',
      title: 'ขาดข้อมูลสแกนนิ้ว',
      description: 'มีข้อมูลใน Daily Report แต่ไม่มีสแกนนิ้ว',
      icon: <SearchOffIcon sx={{ fontSize: 28, color: '#ef4444' }} />,
      colorTheme: 'red',
      count: 5,
    },
    {
      id: 'otConflict',
      title: 'ข้อมูล OT ขัดแย้งกัน',
      description: 'ชั่วโมง OT ของ Daily Report และ สแกนนิ้วไม่ตรงกัน',
      icon: <ClockIcon sx={{ fontSize: 28, color: '#7c3aed' }} />,
      colorTheme: 'purple',
      count: 3,
    }
  ];

  // activeItem is no longer needed since detail view is removed

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1.5}>
        {viewMode === 'fixed' ? (
          <Grid item xs={12}>
            <BreakdownCard 
              active={true} 
              colorTheme="blue"
              elevation={0}
              sx={{ cursor: 'default', '&:hover': { transform: 'none', boxShadow: 'none' } }}
            >
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    border: '1px solid #bae6fd'
                  }}>
                    <SendIcon sx={{ fontSize: 24, color: '#0284c7', transform: 'rotate(-45deg)' }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={900} sx={{ lineHeight: 1.1, color: BLUE.NAVY }}>
                      แก้ไขแล้ว
                    </Typography>
                    <Typography variant="caption" sx={{ color: BLUE.TEXT_LIGHT, fontWeight: 700 }}>
                      รายการข้อมูลที่ได้รับการตรวจสอบและแก้ไขเรียบร้อยแล้ว
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ textAlign: 'right', mr: 2 }}>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#075985', lineHeight: 1 }}>10</Typography>
                    <Typography variant="caption" fontWeight={800} sx={{ color: '#0369a1' }}>รายการ</Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    size="small" 
                    startIcon={<FileDownloadIcon />}
                    onClick={() => onExport('fixed')}
                    sx={{ 
                      textTransform: 'none', 
                      fontWeight: 800, 
                      borderRadius: '8px', 
                      backgroundColor: '#bae6fd', 
                      color: BLUE.ROYAL,
                      px: 2,
                      '&:hover': { backgroundColor: '#7dd3fc' } 
                    }}
                  >
                    Export ข้อมูลแก้ไขแล้ว
                  </Button>
                </Stack>
              </Stack>
            </BreakdownCard>
          </Grid>
        ) : viewMode === 'pending' ? (
          <Grid item xs={12}>
            <BreakdownCard 
              active={true} 
              colorTheme="orange"
              elevation={0}
              sx={{ cursor: 'default', '&:hover': { transform: 'none', boxShadow: 'none' } }}
            >
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    border: '1px solid #fed7aa'
                  }}>
                    <RocketIcon sx={{ fontSize: 24, color: '#d97706' }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={900} sx={{ lineHeight: 1.1, color: BLUE.NAVY }}>
                      รอแก้ไข
                    </Typography>
                    <Typography variant="caption" sx={{ color: BLUE.TEXT_LIGHT, fontWeight: 700 }}>
                      รายการข้อมูลที่อยู่ระหว่างการตรวจสอบและรอการแก้ไข
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ textAlign: 'right', mr: 2 }}>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#92400e', lineHeight: 1 }}>34</Typography>
                    <Typography variant="caption" fontWeight={800} sx={{ color: '#b45309' }}>รายการ</Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    size="small" 
                    startIcon={<FileDownloadIcon />}
                    onClick={() => onExport('pending')}
                    sx={{ 
                      textTransform: 'none', 
                      fontWeight: 800, 
                      borderRadius: '8px', 
                      backgroundColor: '#ffedd5', 
                      color: '#92400e',
                      px: 2,
                      '&:hover': { backgroundColor: '#fed7aa' } 
                    }}
                  >
                    Export ข้อมูลที่รอแก้ไข
                  </Button>
                </Stack>
              </Stack>
            </BreakdownCard>
          </Grid>
        ) : (
          items.map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.id}>
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
                    <ExportButton 
                      size="small" 
                      variant="outlined" 
                      startIcon={<FileDownloadIcon sx={{ fontSize: '10px !important' }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport(item.id);
                      }}
                    >
                      Export
                    </ExportButton>
                  </Box>
                </Stack>
              </BreakdownCard>
            </Grid>
          ))
        )}
      </Grid>

    </Box>
  );
};

export default AbnormalBreakdown;
