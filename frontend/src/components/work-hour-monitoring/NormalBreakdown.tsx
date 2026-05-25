import React from 'react';
import { Box, Grid } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  EventBusy as LeaveIcon,
  TaskAlt as TaskAltIcon,
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
      homeProjectId: project !== 'all' ? project : undefined,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    }),
    staleTime: 60000,
  });

  // แยก "ปกติตั้งแต่แรก" ออกจาก "แก้ไขแล้วจนปกติ"
  // matchedCount = MATCHED ทั้งหมดในปัจจุบัน (รวมทั้งที่ถูก resolve มาแล้ว)
  // resolvedMatchedCount = รายการที่เคยผิดปกติแล้วถูกแก้ไขจนกลายเป็น MATCHED (เฉพาะ status: MATCHED)
  const pureMatchedCount = Math.max(0, (stats?.matchedCount ?? 0) - (stats?.resolvedMatchedCount ?? 0));

  const items = [
    {
      id: 'normal',
      title: 'ข้อมูลตรงกันตั้งแต่แรก',
      description: 'Daily Report ตรงกับสแกนนิ้วโดยไม่ต้องแก้ไข',
      icon: <CheckCircleIcon sx={{ fontSize: 28, color: RECON_COLORS.GREEN.activeBorder }} />,
      colorTheme: 'green' as const,
      count: pureMatchedCount,
    },
    {
      id: 'leave',
      title: 'ลา',
      description: stats?.resolvedLeaveCount && stats.resolvedLeaveCount > 0
        ? `พนักงานแจ้งลาหยุดในระบบ (แก้ไขจากขาดงาน ${stats.resolvedLeaveCount} รายการ)`
        : 'พนักงานแจ้งลาหยุดในระบบ Daily Report',
      icon: <LeaveIcon sx={{ fontSize: 28, color: RECON_COLORS.ORANGE.text }} />,
      colorTheme: 'orange' as const,
      count: stats?.leaveCount ?? 0,
    },
    {
      id: 'abnormal_fixed',
      title: 'แก้ไขแล้วจนปกติ',
      description: 'รายการที่เคยผิดปกติ — Admin แก้ไขจนข้อมูลตรงกันแล้ว',
      icon: <TaskAltIcon sx={{ fontSize: 28, color: RECON_COLORS.BLUE.text }} />,
      colorTheme: 'blue' as const,
      count: stats?.resolvedMatchedCount ?? 0,
    },
  ];

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1.5}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={2.4} key={item.id}>
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
