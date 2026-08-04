import { useCallback, useRef, useState } from 'react';

export type PermissionStatus = 'not-yet-asked' | 'granted' | 'blocked-permanently';

interface CameraPermissionsState {
  cameraStatus: PermissionStatus;
  locationStatus: PermissionStatus;
  /** Latest resolved GPS fix, kept fresh — null until the first fix resolves. */
  position: GeolocationPosition | null;
  /** Non-permission location failure (e.g. timeout — common on laptops with no GPS chip,
   *  relying on slower WiFi/IP-based positioning). Distinct from 'blocked-permanently',
   *  which is a hard permission denial — this is "permission granted, fix just hasn't
   *  arrived / failed", and is retry-able via retryLocation(). */
  locationError: string | null;
  /** Attempts camera + geolocation access; resolves true only if both end up granted.
   *  Safe to call repeatedly — but once a permission is 'blocked-permanently', the browser
   *  will keep rejecting silently; callers must show settings-instructions instead of retrying blindly. */
  requestBoth: () => Promise<boolean>;
  /** Retries only the location fix (e.g. after a timeout) without re-touching camera. */
  retryLocation: () => void;
}

/**
 * Tracks camera + geolocation permission state for the geotagged camera flow.
 * Exposes a 3-state status per permission because once a user hard-denies a permission,
 * the browser will never re-show its native prompt from JS — 'blocked-permanently' must be
 * surfaced distinctly from 'not-yet-asked' so the UI can point the user to browser settings
 * instead of offering a retry button that would silently no-op forever.
 */
// enableHighAccuracy:true forces GPS-chip-grade positioning, which most laptops don't have —
// they fall back to slow/absent WiFi-based positioning and routinely time out. Default to the
// faster network-based fix; a lat/lon fix (not survey-grade precision) is all this feature needs.
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 };

function describeGeoError(err: GeolocationPositionError): string {
  if (err.code === err.TIMEOUT) return 'หาตำแหน่งไม่สำเร็จ (หมดเวลา) ลองใหม่อีกครั้ง';
  if (err.code === err.POSITION_UNAVAILABLE) return 'ไม่สามารถระบุตำแหน่งได้ในขณะนี้ ลองใหม่อีกครั้ง';
  return 'เกิดข้อผิดพลาดในการหาตำแหน่ง ลองใหม่อีกครั้ง';
}

export function useCameraPermissions(): CameraPermissionsState {
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>('not-yet-asked');
  const [locationStatus, setLocationStatus] = useState<PermissionStatus>('not-yet-asked');
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startWatchingPosition = useCallback(() => {
    if (watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition(pos);
        setLocationError(null);
      },
      () => {
        // Errors here don't change status — requestBoth()/retryLocation() own that transition.
      },
      GEO_OPTIONS
    );
  }, []);

  const requestCamera = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      // Only probing for permission here — the actual capture stream is owned by GeotaggedCamera.
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus('granted');
      return true;
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraStatus('blocked-permanently');
      } else {
        // Device/hardware error, not a permission denial — leave status as not-yet-asked
        // so the UI can distinguish "no camera available" from "permission blocked" upstream.
      }
      return false;
    }
  }, []);

  const requestLocation = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition(pos);
          setLocationStatus('granted');
          setLocationError(null);
          startWatchingPosition();
          resolve(true);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('blocked-permanently');
          } else {
            // Permission was granted (or never denied) but the fix itself failed/timed out —
            // surface it instead of leaving the caller stuck with position=null forever.
            console.error('[useCameraPermissions] getCurrentPosition failed:', err);
            setLocationError(describeGeoError(err));
          }
          resolve(false);
        },
        GEO_OPTIONS
      );
    });
  }, [startWatchingPosition]);

  const retryLocation = useCallback(() => {
    setLocationError(null);
    requestLocation();
  }, [requestLocation]);

  const requestBoth = useCallback(async (): Promise<boolean> => {
    const [cameraOk, locationOk] = await Promise.all([requestCamera(), requestLocation()]);
    return cameraOk && locationOk;
  }, [requestCamera, requestLocation]);

  return { cameraStatus, locationStatus, position, locationError, requestBoth, retryLocation };
}
