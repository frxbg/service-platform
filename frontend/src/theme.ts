import { createTheme, alpha } from '@mui/material/styles';
import { bgBG } from '@mui/material/locale';

// Shared palette tokens
const primary = {
  main: '#3b82f6',   // vivid sky blue
  light: '#93c5fd',
  dark: '#1d4ed8',
  contrastText: '#fff',
};

const lightTheme = createTheme(
  {
    palette: {
      mode: 'light',
      primary,
      secondary: {
        main: '#6366f1',   // indigo
        light: '#a5b4fc',
        dark: '#4338ca',
        contrastText: '#fff',
      },
      success: { main: '#10b981', light: '#34d399', dark: '#059669' },
      warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
      error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
      info: { main: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
      background: {
        default: '#f1f5f9',   // light slate
        paper: '#ffffff',
      },
      divider: 'rgba(0,0,0,0.08)',
      text: {
        primary: '#0f172a',
        secondary: '#475569',
      },
    },
    typography: {
      fontFamily: [
        'Inter',
        'Roboto',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h4: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2 },
      h5: { fontWeight: 700, fontSize: '1.375rem' },
      h6: { fontWeight: 600, fontSize: '1.125rem' },
      subtitle1: { fontWeight: 600, fontSize: '0.9375rem' },
      body2: { fontSize: '0.875rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    },
    shape: { borderRadius: 10 },
    shadows: [
      'none',
      '0 1px 2px 0 rgba(0,0,0,0.05)',
      '0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1)',
      '0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1)',
      '0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1)',
      '0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)',
      '0 25px 50px -12px rgba(0,0,0,0.25)',
      // fill remaining 17 slots with same soft shadow
      ...Array(18).fill('0 4px 6px -1px rgba(0,0,0,0.1)'),
    ] as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          *, *::before, *::after { box-sizing: border-box; }
          html { font-size: 16px; scroll-behavior: smooth; }
          body  { margin: 0; min-height: 100vh; background: #f1f5f9; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 6px; }
        `,
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: '#ffffff',
            color: '#0f172a',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: '#1e293b',  // dark sidebar
            color: '#f1f5f9',
            border: 'none',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: '8px',
            padding: '7px 18px',
            fontSize: '0.875rem',
            transition: 'all 0.15s ease',
          },
          contained: {
            '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': { borderWidth: '1.5px' },
          },
          sizeSmall: { padding: '4px 12px', fontSize: '0.8125rem' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '14px',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.05)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.05)',
          },
          rounded: { borderRadius: '14px' },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 600,
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#64748b',
              background: '#f8fafc',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.12s',
            '&:hover': { background: alpha('#3b82f6', 0.04) },
            '&:last-child td': { borderBottom: 0 },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '10px 14px' },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              background: '#fff',
              '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem' },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            margin: '2px 8px',
            width: 'calc(100% - 16px)',
            color: '#94a3b8',
            transition: 'all 0.15s',
            '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#f1f5f9' },
            '&.Mui-selected': {
              background: alpha('#3b82f6', 0.9),
              color: '#ffffff',
              '&:hover': { background: '#3b82f6' },
              '& .MuiListItemIcon-root': { color: '#ffffff' },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 38, color: '#94a3b8' } },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: 'rgba(255,255,255,0.08)' } },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontWeight: 700, fontSize: '1.1rem', paddingBottom: '8px' } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: '16px' } },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: '10px' } },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          },
        },
      },
    },
  },
  bgBG,
);

export default lightTheme;
