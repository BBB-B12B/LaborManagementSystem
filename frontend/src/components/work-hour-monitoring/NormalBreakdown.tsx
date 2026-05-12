import React from 'react';
import { Box, Grid } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  EventBusy as LeaveIcon,
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

const NormalBreakdown: React.FC<Props> = ({ onCardClick, activeId, project, startDate, endDate }) => {
  const { data: stats } = useQuery({
    queryKey: ['reconciliation-stats', project, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => reconciliationService.getStats({
      projectLocationId: project !== 'all' ? project : undefined,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    }),
    staleTime: 60000,
  });

  const items = [
    {
      id: 'normal',
      title: 'ข้อมูลตรงกัน',
      description: 'ชั่วโมงทำงานใน Daily Report ตรงกับสแกนนิ้ว',
      icon: <CheckCircleIcon sx={{ fontSize: 28, color: RECON_COLORS.GREEN.activeBorder }} />,
      colorTheme: 'green' as const,
      count: stats?.normalCount ?? 0,
    },
    {
      id: 'leave',
      title: 'ลา',
      description: 'พนักงานแจ้งลาหยุดในระบบ Daily Report',
      icon: <LeaveIcon sx={{ fontSize: 28, color: RECON_COLORS.ORANGE.text }} />,
      colorTheme: 'orange' as const,
      count: stats?.leaveCount ?? 0,
    },
  ];

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1.5}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.id}>
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

export default NormalBreakdown;
