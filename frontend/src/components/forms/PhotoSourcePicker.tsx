import React, { useId, useState } from 'react';
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
 * normal layout so mobile browsers/WebViews still open the file/camera dialog —
 * some Android WebViews refuse to open a picker for a `display:none` input even
 * when activated via a <label>.
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
 * Camera vs Gallery (vs File). This makes Android and iOS behave identically:
 * a bare `<input accept="image/*">` lets each browser decide the UX — iOS shows
 * a menu (camera/library), Android jumps straight to the gallery with no camera.
 *
 * Resolved Issue (Camera not opening on mobile):
 *  1. MUI Menu uses a Portal and focus-management which shifts focus back to the
 *     trigger element immediately upon selection. Mobile browsers (especially iOS
 *     Safari) interpret this as an interruption and cancel any pending native file
 *     pickers due to the broken user-gesture trust chain.
 *  2. We replace Menu with an elegant bottom sheet Drawer, and trigger the hidden
 *     inputs synchronously via `.click()` in the MenuItem onClick handler. This keeps
 *     the gesture trusted and ensures the camera/file picker opens reliably.
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
  const uid = useId();
  const camId = `${uid}-cam`;
  const galId = `${uid}-gal`;
  const fileId = `${uid}-file`;

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

  const handleInputTrigger = (id: string) => {
    // 1. Synchronously trigger input click inside the user gesture handler
    const inputEl = document.getElementById(id) as HTMLInputElement | null;
    if (inputEl) {
      inputEl.click();
    }
    // 2. Close drawer
    closeMenu();
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
                onClick={() => handleInputTrigger(camId)}
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
                onClick={() => handleInputTrigger(galId)}
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
                  onClick={() => handleInputTrigger(fileId)}
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
      {/* Camera: `capture` forces the camera app (image only) */}
      <input
        id={camId}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        onChange={handleChange}
        style={visuallyHidden}
      />
      {/* Gallery: plain image picker */}
      <input
        id={galId}
        type="file"
        accept={galleryAccept}
        multiple={multiple}
        onChange={handleChange}
        style={visuallyHidden}
      />
      {/* File: any accepted type incl. PDF */}
      {fileAccept && (
        <input
          id={fileId}
          type="file"
          accept={fileAccept}
          multiple={multiple}
          onChange={handleChange}
          style={visuallyHidden}
        />
      )}
    </>
  );
};

export default PhotoSourcePicker;

