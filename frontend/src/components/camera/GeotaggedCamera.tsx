import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { X, Camera as CameraIcon } from 'lucide-react';
import { useCameraPermissions } from './useCameraPermissions';
import { drawWatermark } from './watermarkStamp';

interface GeotaggedCameraProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

/**
 * Custom in-app camera (getUserMedia + canvas) used ONLY where a live GPS+timestamp
 * watermark must be visibly burned into the captured photo.
 *
 * ─── Why NOT a MUI Dialog ──────────────────────────────────────────────────────
 * MUI Dialog renders through a Portal into document.body as an aria-modal. As
 * PhotoSourcePicker documents from hard experience, Portal/aria-modal boundaries
 * break click / trusted-gesture handling on mobile browsers (and were the cause of
 * the "tap shutter → popup just closes, nothing happens, no handler runs" bug).
 * This component therefore renders as a plain position:fixed overlay in the normal
 * React tree — the exact pattern PhotoSourcePicker's bottom sheet proves works on
 * both desktop and mobile here.
 */
const GeotaggedCamera: React.FC<GeotaggedCameraProps> = ({ open, onClose, onCapture }) => {
  const { cameraStatus, locationStatus, position, locationError, requestBoth, retryLocation } =
    useCameraPermissions();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setCapturing(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const granted = await requestBoth();
      if (cancelled || !granted) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStreamReady(true);
      } catch (err) {
        console.error('[GeotaggedCamera] getUserMedia/video.play failed:', err);
        setError('เปิดกล้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCapture = () => {
    setError(null);
    setCapturing(true);
    try {
      const video = videoRef.current;
      if (!video || !position) {
        setError('ยังไม่พร้อมถ่ายรูป (กล้อง/ตำแหน่งยังไม่พร้อม) กรุณารอสักครู่แล้วลองใหม่');
        setCapturing(false);
        return;
      }
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
        setError('กล้องยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่');
        setCapturing(false);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('ถ่ายรูปไม่สำเร็จ (canvas) กรุณาลองใหม่อีกครั้ง');
        setCapturing(false);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawWatermark(ctx, canvas.width, canvas.height, {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        timestamp: new Date(),
      });

      canvas.toBlob(
        (blob) => {
          try {
            if (!blob) {
              setError('ถ่ายรูปไม่สำเร็จ (blob) กรุณาลองใหม่อีกครั้ง');
              setCapturing(false);
              return;
            }
            const file = new File([blob], `site-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
            onClose();
          } catch (err) {
            console.error('[GeotaggedCamera] error after blob creation:', err);
            setError('ถ่ายรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
            setCapturing(false);
          }
        },
        'image/jpeg',
        0.9
      );
    } catch (err) {
      console.error('[GeotaggedCamera] handleCapture threw synchronously:', err);
      setError('ถ่ายรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      setCapturing(false);
    }
  };

  if (!open) return null;

  const bothBlocked =
    cameraStatus === 'blocked-permanently' || locationStatus === 'blocked-permanently';
  const waitingForFix = streamReady && !position;

  return (
    <Box
      // Full-viewport overlay in the NORMAL React tree (NOT a Portal) — see header note.
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        bgcolor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          aspectRatio: '3 / 4',
          bgcolor: '#000',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <IconButton
          type="button"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 4,
            color: '#fff',
            bgcolor: 'rgba(0,0,0,0.4)',
          }}
        >
          <X size={20} />
        </IconButton>

        {error && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bgcolor: 'rgba(220, 38, 38, 0.92)',
              color: '#fff',
              px: 2,
              py: 1,
              zIndex: 5,
              textAlign: 'center',
            }}
          >
            <Typography variant="caption">{error}</Typography>
          </Box>
        )}

        {bothBlocked ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              px: 4,
              color: '#fff',
              textAlign: 'center',
            }}
          >
            <Typography variant="body1">
              ต้องเปิดสิทธิ์กล้องและตำแหน่งเพื่อถ่ายรูปพร้อมข้อมูล — กรุณาไปเปิดสิทธิ์ใน
              Settings ของเบราว์เซอร์/แอป แล้วลองใหม่อีกครั้ง
            </Typography>
          </Box>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {waitingForFix && !locationError && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '22%',
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: '#fff',
                }}
              >
                <Typography variant="body2">กำลังค้นหาตำแหน่ง...</Typography>
              </Box>
            )}

            {locationError && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '20%',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  px: 3,
                  textAlign: 'center',
                  color: '#fff',
                }}
              >
                <Typography variant="body2">{locationError}</Typography>
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  onClick={retryLocation}
                  sx={{
                    color: '#fff',
                    borderColor: '#fff',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  ลองหาตำแหน่งอีกครั้ง
                </Button>
              </Box>
            )}

            {capturing && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '22%',
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: '#fff',
                }}
              >
                <Typography variant="body2">กำลังบันทึกรูป...</Typography>
              </Box>
            )}

            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                zIndex: 3,
              }}
            >
              <Button
                type="button"
                onClick={handleCapture}
                disabled={!streamReady || !position || capturing}
                variant="contained"
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  minWidth: 0,
                  bgcolor: '#fff',
                  color: '#000',
                  '&:hover': { bgcolor: '#eee' },
                }}
              >
                <CameraIcon size={26} />
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default GeotaggedCamera;
