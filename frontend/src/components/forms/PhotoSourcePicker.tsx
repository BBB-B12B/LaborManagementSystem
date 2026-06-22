import React, { useState, useRef } from 'react';
import { Box, Divider, Typography, Button } from '@mui/material';
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
 * ─── Why no MUI Drawer ────────────────────────────────────────────────────────
 *
 * MUI Drawer uses a Portal (renders outside React tree, in document.body).
 * On mobile browsers, calling input.click() from inside a Portal is not
 * treated as a trusted user gesture → camera/file picker blocked.
 *
 * This was true even with nested labels inside the Drawer: some mobile
 * browsers block file picker activation when the initiating element is
 * inside an aria-modal/Portal boundary.
 *
 * Solution — position:fixed div in the normal React tree:
 *   • The bottom sheet is a regular child of this component (no Portal).
 *   • Each option is a <Box onClick={...}> that synchronously calls
 *     inputRef.current?.click() from the same user-gesture call stack.
 *   • This is identical to the pattern in Camera.tsx (qc-report-new)
 *     which is confirmed to work on real iOS/Android devices.
 *   • The hidden inputs are always mounted (outside the {isOpen &&} block)
 *     so the ref is always valid when .click() is called.
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const openMenu = () => { if (!disabled) setIsOpen(true); };
  const closeMenu = () => setIsOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files);
    e.target.value = '';
    setIsOpen(false);
  };

  // Each handler: close sheet first (queues re-render), then .click() synchronously.
  // The .click() is still in the same call stack as the user tap → trusted gesture.
  // Inputs are always mounted (declared outside {isOpen&&}) so ref is always valid.
  const handleCamera = () => { setIsOpen(false); cameraRef.current?.click(); };
  const handleGallery = () => { setIsOpen(false); galleryRef.current?.click(); };
  const handleFile = () => { setIsOpen(false); fileRef.current?.click(); };

  const Trigger = (component || Box) as React.ElementType;

  const optionSx = {
    display: 'flex', alignItems: 'center', gap: 2,
    py: 1.8, px: 2, borderRadius: '12px', cursor: 'pointer',
    '&:hover': { bgcolor: '#f8fafc' },
    '&:active': { bgcolor: '#f1f5f9' },
  };

  return (
    <>
      {/* ─── Always-mounted hidden inputs — never inside isOpen block ──────── */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={galleryAccept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      {fileAccept && (
        <input
          ref={fileRef}
          type="file"
          accept={fileAccept}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      )}

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

      {/* ─── Bottom sheet — position:fixed, NOT a Portal ────────────────────── *
       *   Stays in the normal React/DOM tree. onClick handlers on the options  *
       *   call inputRef.click() synchronously → always a trusted gesture.      */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <Box
            onClick={closeMenu}
            sx={{
              position: 'fixed', inset: 0,
              bgcolor: 'rgba(0,0,0,0.5)',
              zIndex: 1300,
            }}
          />

          {/* Sheet (sibling of backdrop — click events don't bubble between siblings) */}
          <Box
            sx={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 1301,
              bgcolor: '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '16px 16px 24px 16px',
              maxWidth: { xs: '100%', sm: '480px' },
              mx: 'auto',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.1)',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Handle bar */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: '#e2e8f0', borderRadius: 2 }} />
              </Box>

              <Typography variant="subtitle1" fontWeight={800} align="center" sx={{ color: '#1e293b', mb: 1 }}>
                เลือกช่องทางแนบรูปภาพ
              </Typography>

              <Divider sx={{ borderColor: '#f1f5f9' }} />

              {/* Camera option */}
              <Box onClick={handleCamera} sx={optionSx}>
                <Box sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                  <Camera size={22} />
                </Box>
                <Typography fontWeight={700} color="#334155" fontSize="1rem">
                  {cameraLabel}
                </Typography>
              </Box>

              {/* Gallery option */}
              <Box onClick={handleGallery} sx={optionSx}>
                <Box sx={{ color: '#10b981', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                  <ImageIcon size={22} />
                </Box>
                <Typography fontWeight={700} color="#334155" fontSize="1rem">
                  {galleryLabel}
                </Typography>
              </Box>

              {/* File option (optional) */}
              {fileAccept && (
                <Box onClick={handleFile} sx={optionSx}>
                  <Box sx={{ color: '#64748b', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    <Paperclip size={22} />
                  </Box>
                  <Typography fontWeight={700} color="#334155" fontSize="1rem">
                    {fileLabel}
                  </Typography>
                </Box>
              )}

              <Button
                variant="outlined"
                color="inherit"
                onClick={closeMenu}
                sx={{
                  mt: 1, py: 1.5, borderRadius: '12px', fontWeight: 800,
                  borderColor: '#e2e8f0', color: '#64748b', fontSize: '0.95rem',
                  '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                }}
              >
                ยกเลิก
              </Button>
            </Box>
          </Box>
        </>
      )}
    </>
  );
};

export default PhotoSourcePicker;
