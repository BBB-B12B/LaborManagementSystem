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
 * Visually-hidden (NOT display:none). The inputs must stay rendered in the
 * normal layout so mobile browsers/WebViews still open the file/camera dialog.
 */
const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Cross-platform photo/file source chooser.
 *
 * Tapping the trigger opens a small popup so the user explicitly chooses
 * Camera vs Gallery (vs File). This makes Android and iOS behave identically.
 *
 * Fixes for Mobile Camera opening issues:
 *  1. Drawer UI stays mounted: We keep the bottom drawer open when a selection is tapped.
 *     If the Drawer closes immediately (DOM unmounts/focus shifts), mobile Safari/Chrome
 *     cancels the file-picker request for security. The drawer closes only in handleChange.
 *  2. React Refs: We use React refs instead of document.getElementById, avoiding potential
 *     race conditions or ID conflicts across multiple picker instances.
 *  3. Removed "multiple" from Camera input: Mobile browsers (especially iOS Safari) ignore
 *     the `capture="environment"` attribute when the input also has `multiple`, falling back
 *     to the library or failing to open. Removing it forces the native camera application.
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setIsOpen(true);
  };
  const closeMenu = () => setIsOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files);
    // reset so re-picking the same file still fires onChange
    e.target.value = '';
    closeMenu();
  };

  const handleInputTrigger = (type: 'camera' | 'gallery' | 'file') => {
    // Synchronously trigger input click inside the user gesture handler
    if (type === 'camera' && cameraInputRef.current) {
      cameraInputRef.current.click();
    } else if (type === 'gallery' && galleryInputRef.current) {
      galleryInputRef.current.click();
    } else if (type === 'file' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const Trigger = (component || Box) as React.ElementType;

  return (
    <>
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
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleInputTrigger('camera')}
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

            <ListItem disablePadding sx={{ mt: 1 }}>
              <ListItemButton
                onClick={() => handleInputTrigger('gallery')}
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

            {fileAccept && (
              <ListItem disablePadding sx={{ mt: 1 }}>
                <ListItemButton
                  onClick={() => handleInputTrigger('file')}
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

      {/* Inputs live OUTSIDE the Menu portal, visually-hidden (not display:none) */}
      {/* Camera: `capture` forces the camera app (image only). MUST NOT have "multiple" */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleChange}
        style={visuallyHidden}
      />
      {/* Gallery: plain image picker */}
      <input
        type="file"
        accept={galleryAccept}
        multiple={multiple}
        ref={galleryInputRef}
        onChange={handleChange}
        style={visuallyHidden}
      />
      {/* File: any accepted type incl. PDF */}
      {fileAccept && (
        <input
          type="file"
          accept={fileAccept}
          multiple={multiple}
          ref={fileInputRef}
          onChange={handleChange}
          style={visuallyHidden}
        />
      )}
    </>
  );
};

export default PhotoSourcePicker;


