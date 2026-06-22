import React, { useState, useId } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  Divider,
  Typography,
  Button,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Camera, Image as ImageIcon, Paperclip } from 'lucide-react';

export interface PhotoSourcePickerProps {
  onSelect: (files: FileList | null) => void;
  galleryAccept?: string;
  fileAccept?: string;
  multiple?: boolean;
  disabled?: boolean;
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
 * ─── Why nested labels work on iOS / Android ────────────────────────────────
 *
 * Root cause of the previous approach failing:
 *   MUI Drawer uses a Portal (renders in document.body) AND traps focus with
 *   aria-modal. Inputs placed OUTSIDE the Drawer with htmlFor labels INSIDE
 *   the Drawer fail because:
 *   (a) The focus trap prevents activation of elements outside the modal DOM.
 *   (b) The htmlFor mechanism must cross the Portal boundary, which some
 *       mobile browsers refuse to follow when a focus trap is active.
 *
 * Solution — nested labels (input inside label, same DOM subtree):
 *   • Each option row is a <label> element rendered INSIDE the Drawer.
 *   • The <input> is nested directly inside that same <label>.
 *   • The browser activates the input at the OS level when the label is tapped.
 *   • No cross-portal htmlFor, no JS .click(), no focus trap crossing.
 *   • The lazy-mount issue does NOT apply here because we use native label
 *     activation (not a programmatic .click()), so the input being mounted
 *     during animation is fine — the user taps AFTER the Drawer is visible.
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

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
  };
  const closeMenu = () => setIsOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files);
    e.target.value = '';
    closeMenu();
  };

  const Trigger = (component || Box) as React.ElementType;

  const labelRowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    py: 1.8,
    px: 2,
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    userSelect: 'none' as const,
    '&:hover': { bgcolor: '#f8fafc' },
    '&:active': { bgcolor: '#f1f5f9' },
  };

  return (
    <>
      {/* ─── Trigger ────────────────────────────────────────────────────────── */}
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

      {/* ─── Drawer (inputs nested inside labels — same DOM subtree) ─────────── */}
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
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
            <Box sx={{ width: 40, height: 4, bgcolor: '#e2e8f0', borderRadius: 2 }} />
          </Box>

          <Typography variant="subtitle1" fontWeight={800} align="center" sx={{ color: '#1e293b' }}>
            เลือกช่องทางแนบรูปภาพ
          </Typography>

          <Divider sx={{ borderColor: '#f1f5f9' }} />

          <List disablePadding>
            {/* Camera — nested input inside label, no JS .click(), no htmlFor crossing portal */}
            <ListItem disablePadding>
              <Box
                component="label"
                sx={labelRowSx}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleChange}
                />
                <Box sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                  <Camera size={22} />
                </Box>
                <Typography fontWeight={700} color="#334155" fontSize="1rem">
                  {cameraLabel}
                </Typography>
              </Box>
            </ListItem>

            {/* Gallery — nested input inside label */}
            <ListItem disablePadding sx={{ mt: 1 }}>
              <Box
                component="label"
                sx={labelRowSx}
              >
                <input
                  type="file"
                  accept={galleryAccept}
                  multiple={multiple}
                  style={{ display: 'none' }}
                  onChange={handleChange}
                />
                <Box sx={{ color: '#10b981', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                  <ImageIcon size={22} />
                </Box>
                <Typography fontWeight={700} color="#334155" fontSize="1rem">
                  {galleryLabel}
                </Typography>
              </Box>
            </ListItem>

            {/* File (optional) — nested input inside label */}
            {fileAccept && (
              <ListItem disablePadding sx={{ mt: 1 }}>
                <Box
                  component="label"
                  sx={labelRowSx}
                >
                  <input
                    type="file"
                    accept={fileAccept}
                    multiple={multiple}
                    style={{ display: 'none' }}
                    onChange={handleChange}
                  />
                  <Box sx={{ color: '#64748b', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    <Paperclip size={22} />
                  </Box>
                  <Typography fontWeight={700} color="#334155" fontSize="1rem">
                    {fileLabel}
                  </Typography>
                </Box>
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
              '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
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
