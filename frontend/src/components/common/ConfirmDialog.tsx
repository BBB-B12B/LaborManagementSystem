/**
 * Confirm Dialog Component
 * คอมโพเนนต์ยืนยันการทำงาน
 *
 * Reusable confirmation dialog for critical actions
 * Used for delete confirmations, irreversible operations, etc.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error' | 'info' | 'success';
  loading?: boolean;
  disabled?: boolean;
}

/**
 * ConfirmDialog component
 * - Customizable title, message, and button text
 * - Severity levels (warning, error, info, success)
 * - Loading state during async operations
 * - Thai language support
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  severity = 'warning',
  loading = false,
  disabled = false,
}) => {
  const { t } = useTranslation();

  /**
   * Get icon based on severity
   */
  const getIcon = () => {
    const iconProps = { sx: { mr: 1, verticalAlign: 'middle' } };

    switch (severity) {
      case 'error':
        return <ErrorIcon color="error" {...iconProps} />;
      case 'warning':
        return <WarningIcon color="warning" {...iconProps} />;
      case 'info':
        return <InfoIcon color="info" {...iconProps} />;
      case 'success':
        return <SuccessIcon color="success" {...iconProps} />;
      default:
        return <WarningIcon color="warning" {...iconProps} />;
    }
  };

  /**
   * Get button color based on severity
   */
  const getButtonColor = (): 'error' | 'warning' | 'primary' | 'success' => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'primary';
    }
  };

  /**
   * Handle confirm action
   */
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirm action failed:', error);
    }
  };

  // Default text
  const defaultTitle = severity === 'error' || severity === 'warning'
    ? 'ยืนยันการดำเนินการ'
    : 'แจ้งเตือน';

  const defaultConfirmText = t('common.confirm');
  const defaultCancelText = t('common.cancel');

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="confirm-dialog-title">
        {getIcon()}
        {title || defaultTitle}
      </DialogTitle>

      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          variant="outlined"
          color="inherit"
        >
          {cancelText || defaultCancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading || disabled}
          variant="contained"
          color={getButtonColor()}
          autoFocus
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'กำลังดำเนินการ...' : (confirmText || defaultConfirmText)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Hook for managing confirm dialog state
 */
export const useConfirmDialog = () => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [config, setConfig] = React.useState<Partial<ConfirmDialogProps>>({});

  /**
   * Open dialog with configuration
   */
  const confirm = (dialogConfig: Partial<ConfirmDialogProps>) => {
    setConfig(dialogConfig);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      const originalOnConfirm = dialogConfig.onConfirm;
      const originalOnClose = dialogConfig.onClose;

      setConfig({
        ...dialogConfig,
        onConfirm: async () => {
          try {
            setLoading(true);
            if (originalOnConfirm) {
              await originalOnConfirm();
            }
            resolve(true);
            setOpen(false);
          } catch (error) {
            console.error('Confirm action failed:', error);
            resolve(false);
          } finally {
            setLoading(false);
          }
        },
        onClose: () => {
          if (originalOnClose) {
            originalOnClose();
          }
          resolve(false);
          setOpen(false);
        },
      });
    });
  };

  /**
   * Close dialog
   */
  const close = () => {
    if (!loading) {
      setOpen(false);
    }
  };

  return {
    open,
    loading,
    confirm,
    close,
    ConfirmDialog: () => (
      <ConfirmDialog
        open={open}
        loading={loading}
        onClose={close}
        onConfirm={config.onConfirm || (() => {})}
        {...config}
        message={config.message || ''}
      />
    ),
  };
};

/**
 * Preset confirm dialogs for common operations
 */

/**
 * Delete confirmation dialog
 */
export const useDeleteConfirmDialog = () => {
  const confirmDialog = useConfirmDialog();

  const confirmDelete = (
    itemName: string,
    onDelete: () => void | Promise<void>
  ) => {
    return confirmDialog.confirm({
      title: 'ยืนยันการลบ',
      message: `คุณต้องการลบ "${itemName}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      severity: 'error',
      onConfirm: onDelete,
    });
  };

  return {
    ...confirmDialog,
    confirmDelete,
  };
};

/**
 * Save confirmation dialog
 */
export const useSaveConfirmDialog = () => {
  const confirmDialog = useConfirmDialog();

  const confirmSave = (
    message: string = 'คุณต้องการบันทึกการเปลี่ยนแปลงใช่หรือไม่?',
    onSave: () => void | Promise<void>
  ) => {
    return confirmDialog.confirm({
      title: 'ยืนยันการบันทึก',
      message,
      confirmText: 'บันทึก',
      cancelText: 'ยกเลิก',
      severity: 'info',
      onConfirm: onSave,
    });
  };

  return {
    ...confirmDialog,
    confirmSave,
  };
};

/**
 * Discard changes confirmation dialog
 */
export const useDiscardChangesDialog = () => {
  const confirmDialog = useConfirmDialog();

  const confirmDiscard = (
    onDiscard: () => void | Promise<void>
  ) => {
    return confirmDialog.confirm({
      title: 'ยกเลิกการเปลี่ยนแปลง',
      message: 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก คุณต้องการยกเลิกการเปลี่ยนแปลงใช่หรือไม่?',
      confirmText: 'ยกเลิกการเปลี่ยนแปลง',
      cancelText: 'กลับไปแก้ไข',
      severity: 'warning',
      onConfirm: onDiscard,
    });
  };

  return {
    ...confirmDialog,
    confirmDiscard,
  };
};

export default ConfirmDialog;
