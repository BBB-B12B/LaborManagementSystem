/**
 * Modal Base Component
 * คอมโพเนนต์ Modal พื้นฐาน
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface ModalProps {
  /**
   * Modal open state
   */
  open: boolean;

  /**
   * Close handler
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title?: string;

  /**
   * Modal content
   */
  children: React.ReactNode;

  /**
   * Confirm button text
   */
  confirmText?: string;

  /**
   * Cancel button text
   */
  cancelText?: string;

  /**
   * Confirm handler
   */
  onConfirm?: () => void;

  /**
   * Disable confirm button
   */
  confirmDisabled?: boolean;

  /**
   * Hide footer actions
   */
  hideActions?: boolean;

  /**
   * Max width
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;

  /**
   * Full width
   */
  fullWidth?: boolean;

  /**
   * Disable backdrop click to close
   */
  disableBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  onConfirm,
  confirmDisabled = false,
  hideActions = false,
  maxWidth = 'sm',
  fullWidth = true,
  disableBackdropClick = false,
}) => {
  const handleClose = (_: any, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      {title && (
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <span>{title}</span>
            <IconButton
              edge="end"
              color="inherit"
              onClick={onClose}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
      )}

      <DialogContent dividers>{children}</DialogContent>

      {!hideActions && (
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            {cancelText}
          </Button>
          {onConfirm && (
            <Button
              onClick={onConfirm}
              variant="contained"
              color="primary"
              disabled={confirmDisabled}
            >
              {confirmText}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default Modal;
