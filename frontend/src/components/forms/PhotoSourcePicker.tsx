import React, { useState, useRef } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Button,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Camera, Image as ImageIcon, Paperclip } from 'lucide-react';

export interface PhotoSourcePickerProps {
  /** Called with the files the user picked, from whichever source. */
  onSelect: (files: FileList | null) => void;
  /** accept for the "เลือกรูป" (gallery) input. Default image/*. */
  galleryAccept?: string;
  /** When set, adds a 3rd "แนบไฟล์" item with this accept (e.g. image/*,application/pdf). */
  fileAccept?: string;
  /** Allow selecting multiple files. Default false. */
  multiple?: boolean;
  disabled?: boolean;
  /** Element used to render the clickable trigger. Default Box. */
  component?: React.ElementType;
  sx?: SxProps<Theme>;
  className?: string;
  cameraLabel?: string;
  galleryLabel?: string;
  fileLabel?: string;
  children?: React.ReactNode;
}

/**
 * Cross-platform photo/file source chooser.
 *
 * Tapping the trigger opens a bottom drawer with Camera / Gallery / File options.
 *
 * ─── Why inputs live OUTSIDE the Drawer ───────────────────────────────────────
 * Mobile Safari and Chrome require that a file-picker open from a "trusted
 * gesture" — one whose call-stack traces directly back to a real user tap,
 * with no async gaps and no DOM mutations between the tap and the click().
 *
 * MUI Drawer lazy-mounts its children on first open and runs CSS animations,
 * so any <input> rendered inside it is born inside an animation frame —
 * the browser no longer considers the subsequent .click() a trusted gesture
 * and silently blocks the camera/file picker.
 *
 * The fix (mirroring the working QC-report Camera.tsx):
 *   • Render both <input> elements at the TOP LEVEL, always mounted, display:none.
 *   • Each Drawer option calls inputRef.current?.click() directly on the tap handler.
 *   • The DOM is never mutated between the tap and the click → 100 % trusted gesture.
 */
const PhotoSourcePicker: React.FC<PhotoSourcePickerProps> = ({
  onSelect,
  galleryAccept = 'image/*',
  fileAccept,
  multiple = false,
  disabled = false,
  component,
  sx,
  className,
  cameraLabel = 'ถ่ายรูป',
  galleryLabel = 'เลือกรูป',
  fileLabel = 'แนบไฟล์',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Refs to the always-mounted hidden inputs (same pattern as Camera.tsx L60-61)
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
  };
  const closeMenu = () => setIsOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files);
    // Reset so re-picking the same file still fires onChange
    e.target.value = '';
    closeMenu();
  };

  // Each handler closes the drawer then immediately clicks the pre-mounted input.
  // Closing first keeps the DOM mutation before the click, not after — mobile
  // browsers don't block this because the click is still within the same
  // synchronous event handler as the original tap.
  const handleCameraClick = () => {
    closeMenu();
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    closeMenu();
    galleryInputRef.current?.click();
  };

  const handleFileClick = () => {
    closeMenu();
    fileInputRef.current?.click();
  };

  const Trigger = (component || Box) as React.ElementType;

  return (
    <>
      {/* ─── Always-mounted hidden inputs (OUTSIDE the Drawer) ─────────────── */}
      {/* Camera — single capture, no `multiple` to avoid Safari conflicts */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {/* Gallery */}
      <input
        ref={galleryInputRef}
        type="file"
        accept={galleryAccept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {/* File (optional) */}
      {fileAccept && (
        <input
          ref={fileInputRef}
          type="file"
          accept={fileAccept}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      )}

      {/* ─── Clickable Trigger ──────────────────────────────────────────────── */}
      <Trigger
        className={className}
        onClick={openMenu}
        aria-disabled={disabled || undefined}
        sx={[
          { cursor: disabled ? 'default' : 'pointer' },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {children}
      </Trigger>

      {/* ─── Bottom Drawer (UI only — no inputs here) ───────────────────────── */}
      <Drawer
        anchor="bottom"
        open={isOpen}
        onClose={closeMenu}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '16px 16px 24px 16px',
            maxWidth: { xs: '100%', sm: '480px' },
            margin: '0 auto',
            boxShadow: '0 -10px 25px rgba(0,0,0,0.1)',
            bgcolor: '#ffffff',
          }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Drag Notch Handle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
            <Box sx={{ width: 40, height: 4, bgcolor: '#e2e8f0', borderRadius: 2 }} />
          </Box>

          <Typography variant="subtitle1" fontWeight={800} align="center" sx={{ color: '#1e293b' }}>
            เลือกช่องทางแนบรูปภาพ
          </Typography>

          <Divider sx={{ borderColor: '#f1f5f9' }} />

          <List disablePadding>
            {/* Camera */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleCameraClick}
                sx={{ py: 1.8, px: 2, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                <ListItemIcon sx={{ color: '#3b82f6', minWidth: 40 }}>
                  <Camera size={22} />
                </ListItemIcon>
                <ListItemText
                  primary={cameraLabel}
                  primaryTypographyProps={{ fontWeight: 700, color: '#334155', fontSize: '1rem' }}
                />
              </ListItemButton>
            </ListItem>

            {/* Gallery */}
            <ListItem disablePadding sx={{ mt: 1 }}>
              <ListItemButton
                onClick={handleGalleryClick}
                sx={{ py: 1.8, px: 2, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                <ListItemIcon sx={{ color: '#10b981', minWidth: 40 }}>
                  <ImageIcon size={22} />
                </ListItemIcon>
                <ListItemText
                  primary={galleryLabel}
                  primaryTypographyProps={{ fontWeight: 700, color: '#334155', fontSize: '1rem' }}
                />
              </ListItemButton>
            </ListItem>

            {/* File (optional) */}
            {fileAccept && (
              <ListItem disablePadding sx={{ mt: 1 }}>
                <ListItemButton
                  onClick={handleFileClick}
                  sx={{ py: 1.8, px: 2, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  <ListItemIcon sx={{ color: '#64748b', minWidth: 40 }}>
                    <Paperclip size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary={fileLabel}
                    primaryTypographyProps={{ fontWeight: 700, color: '#334155', fontSize: '1rem' }}
                  />
                </ListItemButton>
              </ListItem>
            )}
          </List>

          <Button
            variant="outlined"
            color="inherit"
            onClick={closeMenu}
            sx={{
              mt: 1,
              py: 1.5,
              borderRadius: '12px',
              fontWeight: 800,
              borderColor: '#e2e8f0',
              color: '#64748b',
              fontSize: '0.95rem',
              '&:hover': {
                borderColor: '#cbd5e1',
                bgcolor: '#f8fafc'
              }
            }}
          >
            ยกเลิก
          </Button>
        </Box>
      </Drawer>
    </>
  );
};

export default PhotoSourcePicker;
