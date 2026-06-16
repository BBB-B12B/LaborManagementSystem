/**
 * Loading Spinner Component
 * คอมโพเนนต์แสดงสถานะกำลังโหลด
 */

import React from 'react';
import { Box, CircularProgress, Typography, Backdrop } from '@mui/material';

export interface LoadingSpinnerProps {
  /**
   * Loading message
   */
  message?: string;

  /**
   * Size of spinner (small, medium, large)
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Show full page overlay
   */
  fullPage?: boolean;
}

const sizeMap = {
  small: 24,
  medium: 40,
  large: 54,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'กำลังโหลด...',
  size = 'medium',
  fullPage = false,
}) => {
  const spinnerSize = sizeMap[size];

  if (fullPage) {
    return (
      <Backdrop
        sx={{
          color: (theme) => theme.palette.primary.main,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          zIndex: (theme) => Math.max(theme.zIndex.drawer, theme.zIndex.modal) + 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backdropFilter: 'blur(5px)',
          transition: 'opacity 0.25s ease-in-out',
        }}
        open={true}
      >
        <CircularProgress color="primary" size={spinnerSize} thickness={4} />
        {message && (
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.primary' }}>
            {message}
          </Typography>
        )}
      </Backdrop>
    );
  }

  return (
    <Box py={4} display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
      <CircularProgress size={spinnerSize} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;
