import React, { useState, useRef, useCallback } from 'react';
import { Box, Divider, Typography, Button } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
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
 * ─── Why no MUI Drawer / Popover ──────────────────────────────────────────────
 *
 * MUI Portal-based components (Drawer, Popover, Menu) render outside the React
 * tree in document.body. On mobile browsers, calling input.click() from inside
 * a Portal is not treated as a trusted user gesture → camera/file picker blocked.
 *
 * This was true even with nested labels inside the Drawer: some mobile browsers
 * block file picker activation when the initiating element is inside an
 * aria-modal/Portal boundary.
 *
 * Solution — position:fixed div in the normal React tree:
 *   • Mobile  (<md): bottom sheet at screen bottom — anchored to viewport edge.
 *   • Desktop (≥md): small dropdown card anchored near the trigger button,
 *                    positioned via getBoundingClientRect() (still position:fixed,
 *                    still non-Portal — safe on both mobile and desktop browsers).
 *   • Hidden inputs are always mounted (outside the {isOpen} block) so the ref
 *     is always valid when .click() is called synchronously.
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
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Desktop = md breakpoint and up (≥768px)
  const isDesktop = useMediaQuery('(min-width:768px)');

  const openMenu = useCallback((e: React.MouseEvent) => {
    if (!disabled) {
      setAnchorRect((e.currentTarget as Element).getBoundingClientRect());
      setIsOpen(true);
    }
  }, [disabled]);

  const closeMenu = () => setIsOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files);
    e.target.value = '';
    setIsOpen(false);
  };

  // Each handler: close sheet first (queues re-render), then .click() synchronously.
  // The .click() is still in the same call stack as the user tap → trusted gesture.
  const handleCamera = () => { setIsOpen(false); cameraRef.current?.click(); };
  const handleGallery = () => { setIsOpen(false); galleryRef.current?.click(); };
  const handleFile = () => { setIsOpen(false); fileRef.current?.click(); };

  const Trigger = (component || Box) as React.ElementType;

  const optionSx = {
    display: 'flex', alignItems: 'center', gap: 1.5,
    py: 1.2, px: 1.5, borderRadius: '8px', cursor: 'pointer',
    '&:hover': { bgcolor: '#f1f5f9' },
    '&:active': { bgcolor: '#e2e8f0' },
  };

  // ─── Desktop dropdown position ───────────────────────────────────────────────
  // Prefer below-left of trigger; flip right if overflows viewport.
  const DROPDOWN_WIDTH = 200;
  const getDropdownStyle = (): React.CSSProperties => {
    if (!anchorRect) return { top: 0, left: 0 };
    const viewportWidth = window.innerWidth;
    let left = anchorRect.left;
    // Flip left edge so dropdown doesn't overflow right side of viewport
    if (left + DROPDOWN_WIDTH > viewportWidth - 8) {
      left = anchorRect.right - DROPDOWN_WIDTH;
    }
    // Prefer below trigger; if too close to bottom, show above
    const top = anchorRect.bottom + 6;
    return { top, left, width: DROPDOWN_WIDTH };
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

      {isOpen && (
        <>
          {/* Backdrop — transparent on desktop so it doesn't dim the page */}
          <Box
            onClick={closeMenu}
            sx={{
              position: 'fixed', inset: 0,
              bgcolor: isDesktop ? 'transparent' : 'rgba(0,0,0,0.5)',
              zIndex: 1300,
            }}
          />

          {isDesktop ? (
            /* ─── Desktop: small dropdown card anchored near trigger ────────── */
            <Box
              sx={{
                position: 'fixed',
                ...getDropdownStyle(),
                zIndex: 1301,
                bgcolor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Box onClick={handleCamera} sx={optionSx}>
                <Box sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
                  <Camera size={18} />
                </Box>
                <Typography fontWeight={600} color="#334155" fontSize="0.875rem">
                  {cameraLabel}
                </Typography>
              </Box>

              <Box onClick={handleGallery} sx={optionSx}>
                <Box sx={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
                  <ImageIcon size={18} />
                </Box>
                <Typography fontWeight={600} color="#334155" fontSize="0.875rem">
                  {galleryLabel}
                </Typography>
              </Box>

              {fileAccept && (
                <Box onClick={handleFile} sx={optionSx}>
                  <Box sx={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                    <Paperclip size={18} />
                  </Box>
                  <Typography fontWeight={600} color="#334155" fontSize="0.875rem">
                    {fileLabel}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            /* ─── Mobile: bottom sheet — position:fixed, NOT a Portal ─────────
             *   Stays in the normal React/DOM tree. onClick handlers on the    *
             *   options call inputRef.click() synchronously → trusted gesture. */
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

                <Box onClick={handleCamera} sx={{ ...optionSx, py: 1.8 }}>
                  <Box sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    <Camera size={22} />
                  </Box>
                  <Typography fontWeight={700} color="#334155" fontSize="1rem">
                    {cameraLabel}
                  </Typography>
                </Box>

                <Box onClick={handleGallery} sx={{ ...optionSx, py: 1.8 }}>
                  <Box sx={{ color: '#10b981', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    <ImageIcon size={22} />
                  </Box>
                  <Typography fontWeight={700} color="#334155" fontSize="1rem">
                    {galleryLabel}
                  </Typography>
                </Box>

                {fileAccept && (
                  <Box onClick={handleFile} sx={{ ...optionSx, py: 1.8 }}>
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
          )}
        </>
      )}
    </>
  );
};

export default PhotoSourcePicker;
