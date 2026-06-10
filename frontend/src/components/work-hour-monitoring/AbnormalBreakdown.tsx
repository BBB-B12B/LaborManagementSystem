import React from 'react';
import { Box, Grid } from '@mui/material';
import {
  HighlightOff as CancelIcon,
  Info as InfoIcon,
  SearchOff as SearchOffIcon,
  PersonOff as PersonOffIcon,
  PersonRemove as PersonRemoveIcon,
  PendingActions as PendingActionsIcon,
} from '@mui/icons-material';
import { RECON_COLORS } from '../../constants/theme';
import BreakdownCard from './BreakdownCard';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService } from '../../services/reconciliationService';

interface Props {
  onCardClick: (id: string) => void;
  activeId?: string;
  project?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

const AbnormalBreakdown: React.FC<Props> = ({
  onCardClick,
  activeId,
  project,
  startDate,
  endDate,
}) => {
  const { data: stats } = useQuery({
    queryKey: ['reconciliation-stats', project, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () =>
      reconciliationService.getStats({
        homeProjectId: project !== 'all' ? project : undefined,
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined,
      }),
    staleTime: 60000,
  });

  const items = [
    {
      id: 'missingDaily',
      title: 'ขาดข้อมูล Daily Report',
      description: 'มีสแกนนิ้ว แต่ไม่มีข้อมูลใน Daily Report',
      icon: <CancelIcon sx={{ fontSize: 28, color: RECON_COLORS.RED.activeBorder }} />,
      colorTheme: 'red' as const,
      count: stats?.missingDailyCount ?? 0,
    },
    {
      id: 'workHourConflict',
      title: 'ข้อมูลขัดแย้งกัน',
      description: 'ชั่วโมงทำงาน/OT ระหว่าง Daily Report และสแกนนิ้วไม่ตรงกัน',
      icon: <InfoIcon sx={{ fontSize: 28, color: RECON_COLORS.ORANGE.text }} />,
      colorTheme: 'orange' as const,
      count: stats?.conflictedCount ?? 0,
    },
    {
      id: 'missingScan',
      title: 'ขาดข้อมูลสแกนนิ้ว',
      description: 'มีข้อมูลใน Daily Report แต่ไม่มีสแกนนิ้ว',
      icon: <SearchOffIcon sx={{ fontSize: 28, color: RECON_COLORS.RED.activeBorder }} />,
      colorTheme: 'red' as const,
      count: stats?.missingScanCount ?? 0,
    },
    {
      id: 'unregistered',
      title: 'ไม่มีข้อมูลในระบบ',
      description: 'มีสแกนนิ้ว แต่ไม่พบข้อมูลพนักงานในระบบ',
      icon: <PersonOffIcon sx={{ fontSize: 28, color: '#7c3aed' }} />,
      colorTheme: 'purple' as const,
      count: stats?.unregisteredCount ?? 0,
    },
    {
      id: 'absent',
      title: 'ขาดงาน',
      description: 'ไม่มีการลงชั่วโมงและไม่มีการสแกนนิ้ว',
      icon: <PersonRemoveIcon sx={{ fontSize: 28, color: RECON_COLORS.RED.activeBorder }} />,
      colorTheme: 'red' as const,
      count: stats?.absentCount ?? 0,
    },
    {
      id: 'pendingLeave',
      title: 'รอตรวจใบรับรองแพทย์',
      description: 'มีการแนบใบรับรองแพทย์/หลักฐานลางาน รอแอดมินตรวจสอบ',
      icon: <PendingActionsIcon sx={{ fontSize: 28, color: RECON_COLORS.ORANGE.activeBorder }} />,
      colorTheme: 'orange' as const,
      count: stats?.pendingLeaveCount ?? 0,
    },
  ];

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1.5}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={2} key={item.id}>
            <BreakdownCard
              active={activeId === item.id}
              colorTheme={item.colorTheme}
              title={item.title}
              description={item.description}
              count={item.count}
              icon={item.icon}
              onClick={() => onCardClick(item.id)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AbnormalBreakdown;
