export const RECON_COLORS = {
  RED: {
    bg: '#FCEBEB',
    text: '#791F1F',
    border: '#F7C1C1',
    activeBorder: '#A32D2D',
    accent: '#A32D2D',
  },
  ORANGE: {
    bg: '#FAEEDA',
    text: '#633806',
    border: '#FAC775',
    activeBorder: '#BA7517',
    accent: '#BA7517',
  },
  GREEN: {
    bg: '#EAF3DE',
    text: '#27500A',
    border: '#C0DD97',
    activeBorder: '#3B6D11',
    accent: '#3B6D11',
  },
  BLUE: {
    bg: '#E6F1FB',
    text: '#0C447C',
    border: '#B5D4F4',
    NAVY: '#001b48',
    ROYAL: '#01497c',
    CERULEAN: '#2a9df4',
    LIGHT: '#a1c1db',
    ICE: '#f0f9ff',
    activeBorder: '#378ADD',
    accent: '#378ADD',
  },
  // สำหรับ badge เข้าสาย / ออกก่อน
  PURPLE: {
    bg: '#EEEDFE',
    text: '#3C3489',
    border: '#CECBF6',
    activeBorder: '#534AB7',
    accent: '#534AB7',
  },
  YELLOW: {
    bg: '#FFFBF0',
    hover: '#FFF3D6',
  },
  NEUTRAL: {
    textPrimary: 'var(--color-text-primary, #1c1e2b)',
    textSecondary: 'var(--color-text-secondary, #64748b)',
    textTertiary: 'var(--color-text-tertiary, #94a3b8)',
  },
};

export const MIN_FONT_SIZE = {
  SECONDARY: '12px',
  TABLE_CELL: '13px',
};

// --- Status → Color mapping (ใช้ใน StatusCapsule และ badge ทั่วไป) ---
export const STATUS_COLOR_MAP: Record<string, keyof typeof RECON_COLORS> = {
  MATCHED: 'GREEN',
  LEAVE: 'ORANGE',
  PENDING_LEAVE_REVIEW: 'ORANGE',
  CONFLICTED: 'ORANGE',
  MISSING_SCAN: 'RED',
  MISSING_DAILY: 'RED',
  ABSENT: 'RED',
  UNREGISTERED_EMPLOYEE: 'RED',
  LATE: 'PURPLE',
  EARLY_LEAVE: 'PURPLE',
};

// --- Status → Label mapping ---
export const STATUS_LABEL_MAP: Record<string, string> = {
  MATCHED: 'ข้อมูลตรงกัน',
  MISSING_SCAN: 'ขาดสแกนนิ้ว',
  MISSING_DAILY: 'ขาดข้อมูล Daily',
  CONFLICTED: 'ข้อมูลขัดแย้ง',
  ABSENT: 'ขาดงาน',
  LEAVE: 'ลา',
  PENDING_LEAVE_REVIEW: 'รอตรวจใบรับรองแพทย์',
  UNREGISTERED_EMPLOYEE: 'ไม่มีในระบบ',
};
