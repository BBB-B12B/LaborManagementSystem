/**
 * Loading Spinner Component
 * คอมโพเนนต์แสดงสถานะกำลังโหลด
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

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
  large: 60,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'กำลังโหลด...',
  size = 'medium',
  fullPage = false,
}) => {
  const content = (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
    >
      <CircularProgress size={sizeMap[size]} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullPage) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="rgba(255, 255, 255, 0.9)"
        zIndex={9999}
      >
        {content}
      </Box>
    );
  }

  return <Box py={4}>{content}</Box>;
};

export default LoadingSpinner;
