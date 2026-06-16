/**
 * Token Utilities
 * สำหรับจัดการและตรวจสอบ JWT token ใน client-side
 */

/**
 * Decodes a JWT token and checks if it is expired or close to expiration.
 * @param token JWT token string
 * @returns true if token is expired or invalid, false otherwise
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    const exp = payload.exp;
    if (!exp) return true;
    
    // Get current time in seconds, with 10-second buffer for safety
    const now = Math.floor(Date.now() / 1000);
    return now >= exp - 10;
  } catch {
    return true;
  }
};
