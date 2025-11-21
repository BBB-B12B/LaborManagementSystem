import { createTheme, ThemeOptions } from '@mui/material/styles';
import { thTH } from '@mui/material/locale';

// Palette inspired by the provided reference UI (dark sidebar, light content, red accent)
const primaryColors = {
  main: '#2b2337', // Deep plum for sidebar/background accents
  light: '#3b3048',
  dark: '#1d1727',
  contrastText: '#f5f5f8',
};

const secondaryColors = {
  main: '#d62828', // Red accent for highlights/numbers
  light: '#e74b4b',
  dark: '#b82020',
  contrastText: '#ffffff',
};

const neutral = {
  50: '#f8f8fb',
  100: '#f1f2f6',
  200: '#e7e9f0',
  300: '#d8dbe6',
  400: '#c3c7d6',
  500: '#a8adbf',
  600: '#8d93a8',
  700: '#6f748a',
  800: '#4e5266',
  900: '#343748',
};

const errorColors = {
  main: '#d62828',
  light: '#f1b5b5',
  dark: '#b82020',
};

const warningColors = {
  main: '#f59e0b',
  light: '#fde3b8',
  dark: '#c47c08',
};

const infoColors = {
  main: '#2563eb',
  light: '#d6e4ff',
  dark: '#1d4ed8',
};

const successColors = {
  main: '#2e7d32',
  light: '#cfe9d1',
  dark: '#1b5e20',
};

const baseThemeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: primaryColors,
    secondary: secondaryColors,
    error: errorColors,
    warning: warningColors,
    info: infoColors,
    success: successColors,
    background: {
      default: neutral[100],
      paper: '#ffffff',
    },
    text: {
      primary: '#1c1e2b',
      secondary: '#5a6074',
      disabled: '#a0a4b8',
    },
    divider: neutral[300],
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
      'Sarabun',
      'Prompt',
      'Kanit',
    ].join(','),
    h1: { fontSize: '2.5rem', fontWeight: 600 },
    h2: { fontSize: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
    h5: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.9rem' },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 16px',
          fontWeight: 600,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 8px 18px rgba(38, 40, 66, 0.12)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: neutral[300],
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: neutral[400],
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: secondaryColors.main,
            boxShadow: '0 0 0 3px rgba(214, 40, 40, 0.12)',
          },
        },
        input: {
          padding: '10px 14px',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: neutral[700],
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 14,
          border: `1px solid ${neutral[300]}`,
          boxShadow: '0px 12px 30px rgba(27, 30, 48, 0.08)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 12px 30px rgba(27, 30, 48, 0.08)',
          borderRadius: 16,
          border: `1px solid ${neutral[300]}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${neutral[200]}`,
        },
        head: {
          fontWeight: 700,
          backgroundColor: neutral[50],
          color: '#3a4055',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingLeft: 14,
          paddingRight: 14,
        },
      },
    },
  },
};

export const theme = createTheme(baseThemeOptions, thTH);

export const darkTheme = createTheme(
  {
    ...baseThemeOptions,
    palette: {
      ...baseThemeOptions.palette,
      mode: 'dark',
      background: {
        default: '#121212',
        paper: '#1e1e1e',
      },
      text: {
        primary: '#ffffff',
        secondary: 'rgba(255, 255, 255, 0.7)',
        disabled: 'rgba(255, 255, 255, 0.5)',
      },
    },
  },
  thTH
);

export default theme;
