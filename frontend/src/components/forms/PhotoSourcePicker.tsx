import React, { useState } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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
 * Tapping the trigger opens a small popup so the user explicitly chooses
 * Camera vs Gallery (vs File). This makes Android and iOS behave identically:
 * a bare `<input accept="image/*">` lets each browser decide the UX — iOS shows
 * a menu (camera/library), Android jumps straight to the gallery with no camera.
 *
 * IMPORTANT: each menu item is a native <label> wrapping its own hidden input.
 * Mobile browsers only open the file/camera dialog from a real user gesture, so
 * we MUST rely on native label->input activation — programmatically calling
 * input.click() after closing the menu gets blocked on mobile Safari/Chrome
 * (the click is no longer tied to the user's tap). The menu closes on change.
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(e.currentTarget);
  };
  const closeMenu = () => setAnchorEl(null);

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

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {/* Camera: native label activation + `capture` forces the camera app */}
        <MenuItem component="label">
          <ListItemIcon>
            <Camera size={18} />
          </ListItemIcon>
          <ListItemText>{cameraLabel}</ListItemText>
          <input
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            multiple={multiple}
            onChange={handleChange}
          />
        </MenuItem>

        {/* Gallery: plain image picker via native label */}
        <MenuItem component="label">
          <ListItemIcon>
            <ImageIcon size={18} />
          </ListItemIcon>
          <ListItemText>{galleryLabel}</ListItemText>
          <input
            type="file"
            hidden
            accept={galleryAccept}
            multiple={multiple}
            onChange={handleChange}
          />
        </MenuItem>

        {/* File: any accepted type incl. PDF, via native label */}
        {fileAccept && (
          <MenuItem component="label">
            <ListItemIcon>
              <Paperclip size={18} />
            </ListItemIcon>
            <ListItemText>{fileLabel}</ListItemText>
            <input
              type="file"
              hidden
              accept={fileAccept}
              multiple={multiple}
              onChange={handleChange}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default PhotoSourcePicker;
