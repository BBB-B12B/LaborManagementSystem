import React from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton, DialogActions, Button, CircularProgress, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DCForm, type DCFormProps } from './DCForm';

export interface DCModalProps extends Omit<DCFormProps, 'onCancel'> {
    open: boolean;
    onClose: () => void;
    title?: string;
    formId?: string; // ID for form submission linkage
}

export const DCModal: React.FC<DCModalProps> = ({
    open,
    onClose,
    title,
    formId = 'dc-form-id', // Default Form ID
    isLoading,
    ...formProps
}) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm" // Compact Size
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 },
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">
                    {title || (formProps.mode === 'create' ? 'สร้างแรงงานรายวันใหม่' : 'แก้ไขแรงงานรายวัน')}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 1.5, overflowY: 'auto' }}>
                <DCForm
                    {...formProps}
                    onCancel={onClose}
                    formId={formId}
                    isLoading={isLoading}
                />
            </DialogContent>

            <DialogActions sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                    variant="contained"
                    sx={{ bgcolor: '#C62828', '&:hover': { bgcolor: '#8e0000' } }}
                    onClick={onClose}
                    disabled={isLoading}
                >
                    ยกเลิก
                </Button>
                <Button
                    type="submit"
                    form={formId} // Link to DCForm's ID
                    variant="contained"
                    sx={{ bgcolor: '#2D8A4E', '&:hover': { bgcolor: '#1b5e20' } }}
                    disabled={isLoading}
                    startIcon={isLoading && <CircularProgress size={20} />}
                >
                    {formProps.mode === 'create' ? 'บันทึกข้อมูล' : 'บันทึกการแก้ไข'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
