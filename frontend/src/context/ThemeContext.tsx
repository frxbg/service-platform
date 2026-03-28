import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, alpha } from '@mui/material/styles';
import { bgBG } from '@mui/material/locale';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeMode must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('theme-mode');
        return (saved === 'dark' || saved === 'light') ? saved : 'light';
    });

    useEffect(() => {
        localStorage.setItem('theme-mode', mode);
    }, [mode]);

    const toggleTheme = () => {
        setMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
    };

    const theme = useMemo(() => createTheme(
        {
            palette: {
                mode,
                ...(mode === 'light' ? {
                    primary: { main: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8', contrastText: '#fff' },
                    secondary: { main: '#6366f1', light: '#a5b4fc', dark: '#4338ca', contrastText: '#fff' },
                    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
                    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
                    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
                    info: { main: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
                    background: { default: '#f1f5f9', paper: '#ffffff' },
                    divider: 'rgba(0,0,0,0.08)',
                    text: { primary: '#0f172a', secondary: '#475569' },
                } : {
                    primary: { main: '#60a5fa', light: '#93c5fd', dark: '#2563eb', contrastText: '#fff' },
                    secondary: { main: '#a78bfa', light: '#c4b5fd', dark: '#7c3aed', contrastText: '#fff' },
                    success: { main: '#34d399', light: '#6ee7b7', dark: '#10b981' },
                    warning: { main: '#fbbf24', light: '#fcd34d', dark: '#f59e0b' },
                    error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444' },
                    info: { main: '#22d3ee', light: '#67e8f9', dark: '#06b6d4' },
                    background: { default: '#0f172a', paper: '#1e293b' },
                    divider: 'rgba(255,255,255,0.08)',
                    text: { primary: '#f8fafc', secondary: '#94a3b8' },
                }),
            },
            typography: {
                fontFamily: [
                    'Inter', 'Roboto', '-apple-system', 'BlinkMacSystemFont',
                    '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif',
                ].join(','),
                h4: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2 },
                h5: { fontWeight: 700, fontSize: '1.375rem' },
                h6: { fontWeight: 600, fontSize: '1.125rem' },
                subtitle1: { fontWeight: 600, fontSize: '0.9375rem' },
                body2: { fontSize: '0.875rem', lineHeight: 1.6 },
                button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
            },
            shape: { borderRadius: 10 },
            components: {
                MuiCssBaseline: {
                    styleOverrides: `
                        *, *::before, *::after { box-sizing: border-box; }
                        html { font-size: 16px; scroll-behavior: smooth; }
                        body  { margin: 0; min-height: 100vh; background: ${mode === 'light' ? '#f1f5f9' : '#0f172a'}; }
                        ::-webkit-scrollbar { width: 6px; height: 6px; }
                        ::-webkit-scrollbar-track { background: transparent; }
                        ::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.3); border-radius: 6px; }
                    `,
                },
                MuiAppBar: {
                    styleOverrides: {
                        root: {
                            background: mode === 'light' ? '#ffffff' : '#1e293b',
                            color: mode === 'light' ? '#0f172a' : '#f8fafc',
                            borderBottom: `1px solid ${mode === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'}`,
                            boxShadow: 'none',
                        },
                    },
                },
                MuiDrawer: {
                    styleOverrides: {
                        paper: {
                            background: '#0f172a', // Always dark sidebar
                            color: '#f8fafc',
                            borderRight: '1px solid rgba(255,255,255,0.05)',
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
                            boxShadow: mode === 'light'
                                ? '0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1)'
                                : '0 4px 6px -1px rgba(0,0,0,0.3)',
                            border: `1px solid ${mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                        },
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        root: {
                            backgroundImage: 'none',
                            boxShadow: mode === 'light'
                                ? '0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.05)'
                                : '0 4px 6px -1px rgba(0,0,0,0.3)',
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
                                color: mode === 'light' ? '#64748b' : '#94a3b8',
                                background: mode === 'light' ? '#f8fafc' : '#1e293b',
                                borderBottom: `1px solid ${mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                            },
                        },
                    },
                },
                MuiTableRow: {
                    styleOverrides: {
                        root: {
                            transition: 'background 0.12s',
                            '&:hover': { background: mode === 'light' ? alpha('#3b82f6', 0.04) : alpha('#60a5fa', 0.08) },
                            '&:last-child td': { borderBottom: 0 },
                        },
                    },
                },
                MuiTableCell: {
                    styleOverrides: {
                        root: {
                            borderBottom: `1px solid ${mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                            padding: '10px 14px'
                        },
                    },
                },
                MuiTextField: {
                    defaultProps: { size: 'small' },
                    styleOverrides: {
                        root: {
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '8px',
                                background: mode === 'light' ? '#fff' : '#1e293b',
                                '& fieldset': { borderColor: mode === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' },
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
                            color: '#94a3b8', // Always optimized for dark sidebar
                            transition: 'all 0.15s',
                            '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#f8fafc' },
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
            },
        },
        bgBG
    ), [mode]);

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme }}>
            <MuiThemeProvider theme={theme}>
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
