import React from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { RECON_COLORS, MIN_FONT_SIZE } from '../../constants/theme';

interface BreakdownCardProps {
  active?: boolean;
  colorTheme: 'red' | 'orange' | 'green' | 'blue' | 'purple';
  title: string;
  description: string;
  count: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const StyledPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'colorTheme',
})<{ active?: boolean; colorTheme: string }>(({ active, colorTheme }) => {
  const getThemeColors = () => {
    switch (colorTheme) {
      case 'red': return RECON_COLORS.RED;
      case 'orange': return RECON_COLORS.ORANGE;
      case 'green': return RECON_COLORS.GREEN;
      case 'blue': return RECON_COLORS.BLUE;
      case 'purple': return { bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed', accent: '#7c3aed' }; // Purple as exception or add to RECON_COLORS
      default: return RECON_COLORS.BLUE;
    }
  };

  const colors = getThemeColors();

  return {
    padding: '12px',
    borderRadius: '12px',
    border: '2px solid',
    borderColor: active ? colors.accent : colors.border,
    backgroundColor: active ? colors.bg : '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 20px -8px ${colors.accent}30`,
      borderColor: colors.accent,
      backgroundColor: active ? colors.bg : '#fafafa',
    },
    ...(active && {
      boxShadow: `0 8px 25px -5px ${colors.accent}40`,
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '4px',
        height: '100%',
        backgroundColor: colors.accent,
      }
    })
  };
});

const BreakdownCard: React.FC<BreakdownCardProps> = ({ 
  active, 
  colorTheme, 
  title, 
  description, 
  count, 
  icon, 
  onClick 
}) => {
  return (
    <StyledPaper 
      active={active} 
      colorTheme={colorTheme} 
      onClick={onClick}
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
          backgroundColor: active ? '#fff' : 'transparent',
          transition: 'all 0.3s',
          flexShrink: 0
        }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="caption" 
            fontWeight={900} 
            sx={{ 
              lineHeight: 1.1, 
              mb: 0.2, 
              display: 'block', 
              fontSize: '0.75rem',
              color: RECON_COLORS.NEUTRAL.textPrimary
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: RECON_COLORS.NEUTRAL.textSecondary, 
              display: 'block', 
              lineHeight: 1.2, 
              mb: 0.5, 
              fontSize: MIN_FONT_SIZE.SECONDARY 
            }}
          >
            {description}
          </Typography>
          <Stack direction="row" justifyContent="flex-end" alignItems="flex-end">
            <Box sx={{ textAlign: 'right' }}>
              <Typography 
                variant="h6" 
                fontWeight={900} 
                sx={{ 
                  lineHeight: 1, 
                  color: RECON_COLORS.NEUTRAL.textPrimary 
                }}
              >
                {count}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 800, 
                  color: RECON_COLORS.NEUTRAL.textTertiary 
                }}
              >
                รายการ
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </StyledPaper>
  );
};

export default BreakdownCard;
