/**
 * Material-UI Theme Configuration
 * ธีม Material-UI พร้อม Thai Locale
 *
 * Configured for Labor Management System with Thai language support
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { thTH } from '@mui/material/locale';

// สีหลักของระบบ (Primary Colors)
const primaryColors = {
  main: '#1976d2', // Blue
  light: '#42a5f5',
  dark: '#1565c0',
  contrastText: '#fff',
};

// สีรอง (Secondary Colors)
const secondaryColors = {
  main: '#dc004e', // Pink/Red
  light: '#f06292',
  dark: '#c51162',
  contrastText: '#fff',
};

// สีสถานะ (Status Colors)
const errorColors = {
  main: '#d32f2f',
  light: '#ef5350',
  dark: '#c62828',
};

const warningColors = {
  main: '#ed6c02',
  light: '#ff9800',
  dark: '#e65100',
};

const infoColors = {
  main: '#0288d1',
  light: '#03a9f4',
  dark: '#01579b',
};

const successColors = {
  main: '#2e7d32',
  light: '#4caf50',
  dark: '#1b5e20',
};

// Base theme options
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
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
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
      // Thai fonts
      '"Sarabun"',
      '"Prompt"',
      '"Kanit"',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
    button: {
      textTransform: 'none', // Don't uppercase buttons (important for Thai)
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
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
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(224, 224, 224, 1)',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#f5f5f5',
        },
      },
    },
  },
};

// Create theme with Thai locale
export const theme = createTheme(baseThemeOptions, thTH);

// Dark theme (optional - for future use)
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
