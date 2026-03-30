import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    AppBar,
    Avatar,
    Box,
    CssBaseline,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Brightness4 as DarkModeIcon,
    Brightness7 as LightModeIcon,
    BuildCircleOutlined as BuildCircleOutlinedIcon,
    Close as CloseIcon,
    Dashboard as DashboardIcon,
    Description as DescriptionIcon,
    Inventory as InventoryIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    People as PeopleIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material';

import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

const drawerWidth = 256;

interface MenuItem {
    text: string;
    icon: React.ReactNode;
    path: string;
}

interface DrawerContentProps {
    menuItems: MenuItem[];
    activePath: string;
    isMobile: boolean;
    userFullName?: string;
    userEmail?: string;
    canManageSettings?: boolean;
    onNavigate: (path: string) => void;
    onClose: () => void;
    onLogout: () => void;
}

const DrawerContent: React.FC<DrawerContentProps> = ({
    menuItems,
    activePath,
    isMobile,
    userFullName,
    userEmail,
    canManageSettings,
    onNavigate,
    onClose,
    onLogout,
}) => {
    const { t } = useTranslation();
    const isActive = (path: string) =>
        path === '/' ? activePath === '/' : activePath.startsWith(path);

    const getInitials = (name?: string, email?: string) => {
        if (name) return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
        return (email?.[0] ?? 'U').toUpperCase();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                        sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '9px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
                        }}
                    >
                        <DescriptionIcon sx={{ fontSize: 18, color: '#fff' }} />
                    </Box>
                    <Typography variant="h6" sx={{ color: '#f1f5f9', fontWeight: 700, letterSpacing: '-0.01em' }}>
                        {t('app.brandName')}
                    </Typography>
                </Stack>
                {isMobile && (
                    <IconButton size="small" onClick={onClose} sx={{ color: '#64748b' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 2 }} />

            <List sx={{ px: 1, py: 1.5, flexGrow: 1 }}>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton selected={isActive(item.path)} onClick={() => onNavigate(item.path)}>
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                    fontSize: '0.875rem',
                                    fontWeight: isActive(item.path) ? 600 : 400,
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 2 }} />

            <List sx={{ px: 1, py: 1 }}>
                {canManageSettings && (
                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton onClick={() => onNavigate('/settings')}>
                            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                            <ListItemText primary={t('layout.settings')} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                        </ListItemButton>
                    </ListItem>
                )}
                <ListItem disablePadding>
                    <ListItemButton onClick={onLogout}>
                        <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary={t('layout.logout')} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    </ListItemButton>
                </ListItem>
            </List>

            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    mx: 1,
                    mb: 1.5,
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                }}
            >
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#3b82f6', fontSize: '0.8rem', fontWeight: 700 }}>
                    {getInitials(userFullName, userEmail)}
                </Avatar>
                <Box sx={{ overflow: 'hidden' }}>
                    <Typography
                        variant="body2"
                        sx={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                        {userFullName || userEmail}
                    </Typography>
                    {userFullName && (
                        <Typography
                            variant="caption"
                            sx={{ color: '#64748b', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                            {userEmail}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

const Layout: React.FC = () => {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const { mode, toggleTheme } = useThemeMode();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [mobileOpen, setMobileOpen] = useState(false);

    const canReadOffers = hasAnyPermission(user, [
        'offers.read_all',
        'offers.read_own',
        'offers.edit_all',
        'offers.edit_own',
    ]);
    const canReadService = hasAnyPermission(user, [
        'service_requests.read_all',
        'service_requests.read_assigned',
        'service_requests.create',
        'service_requests.assign',
        'service_requests.accept',
        'service_requests.reject',
        'service_requests.edit',
        'service_requests.close',
        'work_logs.manage',
        'material_usages.manage',
    ]);
    const canReadClients = hasAnyPermission(user, ['clients.read', 'clients.manage']);
    const canReadMaterials = hasAnyPermission(user, [
        'materials.read',
        'materials.read_operational',
        'materials.read_commercial',
        'materials.manage',
        'material_usages.manage',
    ]);
    const canManageUsers = hasPermission(user, 'users.manage');
    const canManageSettings = hasPermission(user, 'settings.manage');

    const handleNavigation = (path: string) => {
        navigate(path);
        if (isMobile) setMobileOpen(false);
    };

    const menuItems: MenuItem[] = [
        { text: t('nav.dashboard'), icon: <DashboardIcon fontSize="small" />, path: '/' },
    ];
    if (canReadService) {
        menuItems.push({ text: t('nav.service'), icon: <BuildCircleOutlinedIcon fontSize="small" />, path: '/service-requests' });
    }
    if (canReadOffers) {
        menuItems.push({ text: t('nav.offers'), icon: <DescriptionIcon fontSize="small" />, path: '/offers' });
    }
    if (canReadClients) {
        menuItems.push({ text: t('nav.clients'), icon: <PeopleIcon fontSize="small" />, path: '/clients' });
    }
    if (canReadMaterials) {
        menuItems.push({ text: t('nav.materials'), icon: <InventoryIcon fontSize="small" />, path: '/materials' });
    }
    if (canManageUsers) {
        menuItems.push({ text: t('nav.users'), icon: <PersonIcon fontSize="small" />, path: '/users' });
    }

    const currentTitle = menuItems.find((item) =>
        item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
    )?.text ?? t('app.brandName');

    const drawerProps = {
        menuItems,
        activePath: location.pathname,
        isMobile,
        userFullName: user?.full_name,
        userEmail: user?.email,
        canManageSettings,
        onNavigate: handleNavigation,
        onClose: () => setMobileOpen(false),
        onLogout: logout,
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <CssBaseline />

            <AppBar
                position="fixed"
                sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}
                elevation={0}
            >
                <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
                    <IconButton
                        edge="start"
                        onClick={() => setMobileOpen(true)}
                        sx={{ mr: 1.5, display: { sm: 'none' }, color: '#475569' }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="subtitle1" noWrap sx={{ flexGrow: 1, color: '#0f172a', fontWeight: 600 }}>
                        {currentTitle}
                    </Typography>
                    <Tooltip title={mode === 'light' ? t('layout.darkTheme') : t('layout.lightTheme')}>
                        <IconButton onClick={toggleTheme} size="small" sx={{ color: '#64748b' }}>
                            {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { width: drawerWidth },
                    }}
                >
                    <DrawerContent {...drawerProps} />
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { width: drawerWidth },
                    }}
                    open
                >
                    <DrawerContent {...drawerProps} />
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 2, sm: 3 },
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    overflow: 'hidden',
                }}
            >
                <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
                <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
};

export default Layout;
