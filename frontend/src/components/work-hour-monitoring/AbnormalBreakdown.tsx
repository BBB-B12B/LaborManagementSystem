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

// --- Mock Data for the list ---
const mockAbnormalRecords = [
  { id: '1', empId: '400156', name: 'นายสมศักดิ์ ขยันยิ่ง', date: '25 พฤษภาคม 2025', status: 'รอตรวจสอบ', type: 'workHourConflict' },
  { id: '2', empId: '201490', name: 'นายสมชาย ใจกล้า', date: '25 พฤษภาคม 2025', status: 'รอตรวจสอบ', type: 'missingScan' },
  { id: '3', empId: '400158', name: 'นายธนาธิป ใจดี', date: '25 พฤษภาคม 2025', status: 'รอตรวจสอบ', type: 'otConflict' },
];

const mockFixedRecords = [
  { id: 'f1', empId: '400156', name: 'นายสมศักดิ์ ขยันยิ่ง', date: '25 พฤษภาคม 2025', fixedDate: '26 พฤษภาคม 2025', responsible: 'Admin A', dept: 'คลังสินค้า (WH)', remark: 'ปรับตาม Daily Report' },
  { id: 'f2', empId: '400156', name: 'นายสมศักดิ์ ขยันยิ่ง', date: '25 พฤษภาคม 2025', fixedDate: '26 พฤษภาคม 2025', responsible: 'Admin B', dept: 'คลังสินค้า (WH)', remark: 'ตรวจสอบรูปถ่ายแล้ว' },
  { id: 'f3', empId: '400156', name: 'นายสมศักดิ์ ขยันยิ่ง', date: '25 พฤษภาคม 2025', fixedDate: '26 พฤษภาคม 2025', responsible: 'Admin A', dept: 'คลังสินค้า (WH)', remark: 'ปรับเวลาเข้างาน' },
];

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
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [referenceType, setReferenceType] = React.useState<'checkIn' | 'checkOut'>('checkIn');

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

  const handleToggleExpand = (recordId: string) => {
    if (expandedId !== recordId) {
      setReferenceType('checkIn');
    }
    setExpandedId(expandedId === recordId ? null : recordId);
  };

  const activeItem = items.find(i => i.id === activeId);

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

      {/* Detail List View (Number 1) */}
      {(activeId || viewMode === 'fixed' || viewMode === 'pending') && (
        <Box sx={{ mt: 2, animation: 'fadeIn 0.3s ease-out' }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 1.5, 
              borderRadius: '12px', 
              backgroundColor: '#f8fafc', 
              border: '1px solid #e2e8f0',
              maxHeight: '320px',
              overflowY: 'auto',
              // ... scrollbar styles ...
            }}
          >
            <Box sx={{ 
              mb: 1.5, 
              p: 1, 
              borderRadius: '6px',
              backgroundColor: viewMode === 'fixed' ? '#f0f9ff' : (
                               viewMode === 'pending' ? '#fff7ed' : (
                               activeItem?.colorTheme === 'red' ? '#fff5f5' : 
                               activeItem?.colorTheme === 'orange' ? '#fff7ed' : 
                               activeItem?.colorTheme === 'purple' ? '#f5f3ff' : '#f0f9ff')),
              borderLeft: `4px solid ${
                viewMode === 'fixed' ? '#0284c7' : (
                viewMode === 'pending' ? '#ea580c' : (
                activeItem?.colorTheme === 'red' ? '#ef4444' : 
                activeItem?.colorTheme === 'orange' ? '#ea580c' : 
                activeItem?.colorTheme === 'purple' ? '#7c3aed' : '#0284c7'))
              }`,
              display: 'flex', 
              alignItems: 'center' 
            }}>
              <Typography variant="subtitle2" fontWeight={900} sx={{ color: BLUE.NAVY }}>
                {viewMode === 'fixed' ? 'แก้ไขแล้ว' : (viewMode === 'pending' ? 'รอแก้ไข' : activeItem?.title)}
              </Typography>
            </Box>

            <Stack spacing={0.75}>
              {(viewMode === 'fixed' ? mockFixedRecords : mockAbnormalRecords).map((record) => {
                const recordType = viewMode === 'breakdown' ? activeId : ((record as any).type || activeId);
                const isExpanded = expandedId === record.id && viewMode !== 'fixed';
                const canExpand = viewMode !== 'fixed';
                
                return (
                  <Box key={record.id}>
                    <DetailItem 
                      elevation={0} 
                      onClick={() => canExpand && handleToggleExpand(record.id)}
                      sx={{ 
                        cursor: canExpand ? 'pointer' : 'default',
                        ...(isExpanded && { borderColor: BLUE.CERULEAN, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, mb: 0 })
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AccountIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" fontWeight={800} sx={{ color: BLUE.TEXT_MAIN, fontSize: '0.75rem' }}>
                            พนักงาน : {record.empId} - {record.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: BLUE.TEXT_LIGHT, fontWeight: 700, display: 'block', fontSize: '0.65rem' }}>
                            {viewMode === 'fixed' ? `วันที่แก้ไข : ${(record as any).fixedDate}` : `วันที่ : ${record.date}`}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StatusBadge sx={{ 
                          backgroundColor: viewMode === 'pending' ? '#fff7ed' : '#f1f5f9',
                          color: viewMode === 'pending' ? '#ea580c' : '#64748b',
                          borderColor: viewMode === 'pending' ? '#fed7aa' : '#e2e8f0'
                        }}>
                          {viewMode === 'fixed' ? (record as any).responsible : (viewMode === 'pending' ? 'รอแก้ไข' : (record as any).status)}
                        </StatusBadge>
                        {canExpand && (
                          <IconButton size="small">
                            {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        )}
                        {viewMode === 'fixed' && (
                          <Typography variant="caption" sx={{ fontStyle: 'italic', color: BLUE.TEXT_LIGHT, ml: 1, fontSize: '0.6rem' }}>
                            {(record as any).remark}
                          </Typography>
                        )}
                      </Stack>
                    </DetailItem>
                    
                    {isExpanded && (
                      <Paper 
                        elevation={0} 
                        sx={{ 
                          p: 2, 
                          mb: 0.75, 
                          border: '1px solid', 
                          borderColor: BLUE.CERULEAN, 
                          borderTop: 'none',
                          borderBottomLeftRadius: '10px',
                          borderBottomRightRadius: '10px',
                          backgroundColor: '#fff',
                          animation: 'fadeIn 0.2s ease-out'
                        }}
                      >
                        {recordType === 'missingScan' || recordType === 'missingDaily' ? (
                          <>
                            <Grid container spacing={3}>
                              {/* Left: Daily Report Reference */}
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" fontWeight={900} sx={{ mb: 1.5, display: 'block', color: recordType === 'missingDaily' ? '#ef4444' : BLUE.NAVY, fontSize: '0.85rem', borderBottom: `2px solid ${recordType === 'missingDaily' ? '#fecaca' : '#e2e8f0'}`, pb: 0.5 }}>
                                  ข้อมูลอ้างอิง Daily Report
                                </Typography>
                                {recordType === 'missingDaily' ? (
                                  <ComparisonBox sx={{ borderColor: '#fecaca', backgroundColor: '#fff', p: 1.5 }}>
                                    <ProofImagePlaceholder sx={{ border: '1px solid #fecaca', flexDirection: 'column', color: '#ef4444' }}>
                                      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                        <Typography variant="h6" fontWeight={900} sx={{ fontSize: '1rem' }}>!</Typography>
                                      </Box>
                                      <Typography variant="caption" fontWeight={900}>ไม่พบข้อมูล Daily Report</Typography>
                                    </ProofImagePlaceholder>
                                  </ComparisonBox>
                                ) : (
                                  <Stack direction="row" spacing={1.5}>
                                    <ComparisonBox sx={{ p: 1.2, backgroundColor: '#fff', flex: 1 }}>
                                      <ProofImagePlaceholder sx={{ height: '90px' }}>รูปภาพ / Timestamp</ProofImagePlaceholder>
                                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                                        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.65rem', color: BLUE.TEXT_LIGHT }}>เวลาเข้างาน</Typography>
                                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.7rem' }}>08.00.05</Typography>
                                      </Stack>
                                    </ComparisonBox>
                                    <ComparisonBox sx={{ p: 1.2, backgroundColor: '#fff', flex: 1 }}>
                                      <ProofImagePlaceholder sx={{ height: '90px' }}>รูปภาพ / Timestamp</ProofImagePlaceholder>
                                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                                        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.65rem', color: BLUE.TEXT_LIGHT }}>เวลาออกงาน</Typography>
                                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.7rem' }}>17.03.05</Typography>
                                      </Stack>
                                    </ComparisonBox>
                                  </Stack>
                                )}
                              </Grid>

                              {/* Right: Scan Data */}
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" fontWeight={900} sx={{ mb: 1.5, display: 'block', color: recordType === 'missingScan' ? '#ea580c' : BLUE.NAVY, fontSize: '0.85rem', borderBottom: `2px solid ${recordType === 'missingScan' ? '#fed7aa' : '#e2e8f0'}`, pb: 0.5, textAlign: 'center' }}>
                                  ข้อมูลในระบบสแกนนิ้ว
                                </Typography>
                                {recordType === 'missingScan' ? (
                                  <ComparisonBox sx={{ borderColor: '#fed7aa', backgroundColor: '#fff', p: 1.5 }}>
                                    <ProofImagePlaceholder sx={{ border: '1px solid #fed7aa', flexDirection: 'column', color: '#ea580c' }}>
                                      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                        <Typography variant="h6" fontWeight={900} sx={{ fontSize: '1rem' }}>!</Typography>
                                      </Box>
                                      <Typography variant="caption" fontWeight={900}>ไม่พบข้อมูลสแกนนิ้ว</Typography>
                                    </ProofImagePlaceholder>
                                  </ComparisonBox>
                                ) : (
                                  <ComparisonBox sx={{ borderColor: BLUE.CERULEAN, backgroundColor: '#fff', p: 1.5 }}>
                                    <ProofImagePlaceholder sx={{ border: '1px solid #e2e8f0' }}>
                                      <Typography variant="caption" fontWeight={700}>พบข้อมูลสแกนนิ้ว (In/Out)</Typography>
                                    </ProofImagePlaceholder>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.65rem', color: BLUE.TEXT_LIGHT }}>สถานที่</Typography>
                                      <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.7rem' }}>คลังสินค้า (WH)</Typography>
                                    </Stack>
                                  </ComparisonBox>
                                )}
                              </Grid>
                            </Grid>

                            {/* Bottom: Time Comparison Table */}
                            <Box sx={{ mt: 3 }}>
                              <Typography variant="caption" fontWeight={900} sx={{ mb: 1, display: 'block', color: BLUE.NAVY, fontSize: '0.9rem', textAlign: 'center' }}>
                                ข้อมูลแสดงเวลาทำงาน
                              </Typography>
                              <TimeTable>
                                <thead>
                                  <tr>
                                    <th rowSpan={1}></th>
                                    {Array.from({ length: 10 }).map((_, i) => (
                                      <th key={i}>Time {i + 1}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="label">Daily Report :</td>
                                    {recordType === 'missingDaily' ? (
                                      Array.from({ length: 10 }).map((_, i) => <td key={i} className="time-cell empty-scan">-</td>)
                                    ) : (
                                      <>
                                        <td className="time-cell">08.00.05</td>
                                        <td className="time-cell">17.03.05</td>
                                        {Array.from({ length: 8 }).map((_, i) => <td key={i} className="time-cell"></td>)}
                                      </>
                                    )}
                                  </tr>
                                  <tr>
                                    <td className="label">สแกนนิ้ว :</td>
                                    {recordType === 'missingScan' ? (
                                      Array.from({ length: 10 }).map((_, i) => <td key={i} className="time-cell empty-scan">-</td>)
                                    ) : (
                                      <>
                                        <td className="time-cell">07.58.12</td>
                                        <td className="time-cell">17.05.44</td>
                                        {Array.from({ length: 8 }).map((_, i) => <td key={i} className="time-cell"></td>)}
                                      </>
                                    )}
                                  </tr>
                                </tbody>
                              </TimeTable>
                            </Box>

                            {recordType !== 'missingDaily' && (
                              <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                                <Button 
                                  variant="outlined" 
                                  size="medium" 
                                  onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '8px', color: '#64748b', borderColor: '#cbd5e1', px: 3 }}
                                >
                                  ยกเลิก
                                </Button>
                                <Button 
                                  variant="contained" 
                                  size="medium" 
                                  sx={{ 
                                    textTransform: 'none', 
                                    fontWeight: 800, 
                                    borderRadius: '8px', 
                                    backgroundColor: '#bae6fd', 
                                    color: BLUE.ROYAL,
                                    px: 3,
                                    '&:hover': { backgroundColor: '#7dd3fc' } 
                                  }}
                                >
                                  ยืนยันข้อมูลปรับตาม Daily Report
                                </Button>
                              </Stack>
                            )}
                          </>
                        ) : (
                          <>
                            <Typography variant="caption" fontWeight={900} sx={{ mb: 1.5, color: BLUE.NAVY, textAlign: 'center', display: 'block' }}>
                              ตรวจสอบข้อมูลขัดแย้ง
                            </Typography>
                            
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" fontWeight={900} sx={{ mb: 0.5, display: 'block', color: '#64748b', fontSize: '0.65rem' }}>
                                  1. ข้อมูลอ้างอิง Daily Report
                                </Typography>
                                <ComparisonBox>
                                  <ProofImagePlaceholder>รูปถ่าย / Timestamp</ProofImagePlaceholder>
                                  <Stack spacing={0.25}>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem' }}>
                                        {recordType === 'otConflict' ? 'OT (รวม)' : 'ชั่วโมงทำงานปกติ'}
                                      </Typography>
                                      <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.6rem' }}>
                                        {recordType === 'otConflict' ? '2 ชม.' : '8 ชม.'}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem' }}>สถานที่</Typography>
                                      <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.6rem' }}>คลังสินค้า (WH)</Typography>
                                    </Stack>
                                  </Stack>
                                </ComparisonBox>
                              </Grid>

                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" fontWeight={900} sx={{ mb: 0.5, display: 'block', color: '#ea580c', fontSize: '0.65rem' }}>
                                  2. ข้อมูลในระบบสแกนนิ้ว
                                </Typography>
                                <ComparisonBox sx={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed' }}>
                                  <ProofImagePlaceholder sx={{ backgroundColor: '#fff', border: '1px solid #fed7aa' }}>
                                    <InfoIcon sx={{ color: '#ea580c', mr: 0.5, fontSize: 14 }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#ea580c' }}>ข้อมูลขัดแย้งกัน</Typography>
                                  </ProofImagePlaceholder>
                                  <Stack spacing={0.25}>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" fontWeight={700} sx={{ color: recordType === 'otConflict' ? '#7c3aed' : '#ea580c', fontSize: '0.6rem' }}>
                                        {recordType === 'otConflict' ? 'OT (รวม)' : 'ชั่วโมงทำงานปกติ'}
                                      </Typography>
                                      <Typography variant="caption" fontWeight={900} sx={{ color: '#ef4444', fontSize: '0.6rem' }}>
                                        {recordType === 'otConflict' ? '0 ชม.' : '6 ชม.'}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" fontWeight={700} sx={{ color: recordType === 'otConflict' ? '#7c3aed' : '#ea580c', fontSize: '0.6rem' }}>สถานที่</Typography>
                                      <Typography variant="caption" fontWeight={900} sx={{ color: '#ef4444', fontSize: '0.6rem' }}>คลังสินค้า (WH)</Typography>
                                    </Stack>
                                  </Stack>
                                </ComparisonBox>
                              </Grid>
                            </Grid>

                            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                              <Button 
                                variant="outlined" 
                                size="small" 
                                onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '6px', color: '#64748b', borderColor: '#cbd5e1', fontSize: '0.65rem' }}
                              >
                                ยกเลิก
                              </Button>
                              <Button 
                                variant="contained" 
                                size="small" 
                                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '6px', backgroundColor: '#2a9df4', fontSize: '0.65rem', '&:hover': { backgroundColor: '#0284c7' } }}
                              >
                                ยืนยันข้อมูล
                              </Button>
                            </Stack>
                          </>
                        )}
                      </Paper>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default AbnormalBreakdown;
