/**
 * Toast Notification Component
 * คอมโพเนนต์แสดงการแจ้งเตือน
 * 
 * Using notistack (already in dependencies)
 */

import React from 'react';
import { SnackbarProvider, useSnackbar, VariantType } from 'notistack';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Toast Provider wrapper component
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      autoHideDuration={5000}
      action={(snackbarKey) => (
        <DismissButton snackbarKey={snackbarKey} />
      )}
    >
      {children}
    </SnackbarProvider>
  );
};

/**
 * Dismiss button for snackbars
 */
const DismissButton: React.FC<{ snackbarKey: string | number }> = ({ snackbarKey }) => {
  const { closeSnackbar } = useSnackbar();

  return (
    <IconButton
      size="small"
      color="inherit"
      onClick={() => closeSnackbar(snackbarKey)}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
};

/**
 * Toast hook for showing notifications
 */
export const useToast = () => {
  const { enqueueSnackbar } = useSnackbar();

  return {
    /**
     * Show success message
     */
    success: (message: string) => {
      enqueueSnackbar(message, { variant: 'success' });
    },

    /**
     * Show error message
     */
    error: (message: string) => {
      enqueueSnackbar(message, { variant: 'error' });
    },

    /**
     * Show warning message
     */
    warning: (message: string) => {
      enqueueSnackbar(message, { variant: 'warning' });
    },

    /**
     * Show info message
     */
    info: (message: string) => {
      enqueueSnackbar(message, { variant: 'info' });
    },

    /**
     * Show message with custom variant
     */
    show: (message: string, variant: VariantType = 'default') => {
      enqueueSnackbar(message, { variant });
    },
  };
};

export default ToastProvider;
