import React, { useRef, useState } from 'react';
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
 * Here the app owns the choice, so both platforms offer the same options.
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(e.currentTarget);
  };
  const closeMenu = () => setAnchorEl(null);

  const pick = (ref: React.RefObject<HTMLInputElement>) => {
    closeMenu();
    ref.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files);
    // reset so re-picking the same file still fires onChange
    e.target.value = '';
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
        <MenuItem onClick={() => pick(cameraRef)}>
          <ListItemIcon>
            <Camera size={18} />
          </ListItemIcon>
          <ListItemText>{cameraLabel}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => pick(galleryRef)}>
          <ListItemIcon>
            <ImageIcon size={18} />
          </ListItemIcon>
          <ListItemText>{galleryLabel}</ListItemText>
        </MenuItem>
        {fileAccept && (
          <MenuItem onClick={() => pick(fileRef)}>
            <ListItemIcon>
              <Paperclip size={18} />
            </ListItemIcon>
            <ListItemText>{fileLabel}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Camera: `capture` forces the camera app (image only) */}
      <input
        ref={cameraRef}
        type="file"
        hidden
        accept="image/*"
        capture="environment"
        multiple={multiple}
        onChange={handleChange}
      />
      {/* Gallery: plain image picker */}
      <input
        ref={galleryRef}
        type="file"
        hidden
        accept={galleryAccept}
        multiple={multiple}
        onChange={handleChange}
      />
      {/* File: any accepted type incl. PDF */}
      {fileAccept && (
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={fileAccept}
          multiple={multiple}
          onChange={handleChange}
        />
      )}
    </>
  );
};

export default PhotoSourcePicker;
