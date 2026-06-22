import React, { useState } from 'react';
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
 * Visually-hidden (NOT display:none). The input stays rendered inside the
 * label layout so the browser's native label-to-input click mapping works
 * perfectly on all mobile viewports and WebViews.
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
 * Tapping the trigger opens a bottom drawer containing options for Camera,
 * Gallery, and optional File Attachments.
 *
 * Bulletproof Mobile camera/file trigger:
 *  1. Nested Native HTML Inputs: We nest each `<input type="file">` directly inside
 *     `<ListItemButton component="label">`. This renders a native `<label>` element.
 *  2. Zero JavaScript Triggers: When the user taps a button, the browser natively
 *     links the label tap directly to the nested input. This is handled at the OS/browser
 *     level, ensuring it is a 100% trusted gesture that is never blocked.
 *  3. Stable DOM: The drawer remains open until the user actually picks a file
 *     (which triggers `handleChange` and runs `closeMenu`), keeping the DOM stable
 *     and preventing browser cancellations.
 *  4. Single Camera Capture: The camera input does not have the `multiple` attribute,
 *     which resolves conflicts that cause mobile Safari/Chrome to ignore the camera.
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
                component="label"
                sx={{ py: 1.8, px: 2, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                {/* Camera Input nested inside label. MUST NOT be multiple */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleChange}
                  style={visuallyHidden}
                />
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
                component="label"
                sx={{ py: 1.8, px: 2, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                {/* Gallery Input nested inside label */}
                <input
                  type="file"
                  accept={galleryAccept}
                  multiple={multiple}
                  onChange={handleChange}
                  style={visuallyHidden}
                />
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
                  component="label"
                  sx={{ py: 1.8, px: 2, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  {/* File Input nested inside label */}
                  <input
                    type="file"
                    accept={fileAccept}
                    multiple={multiple}
                    onChange={handleChange}
                    style={visuallyHidden}
                  />
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



