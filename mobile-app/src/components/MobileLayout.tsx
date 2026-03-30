import React from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PeopleIcon from '@mui/icons-material/People';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import type { MobileNotification, MobileWorkboardResponse } from '../types/mobile';

interface MobileLayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
}

export default function MobileLayout({ title, children, showBack = false }: MobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { i18n, t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const workboardQuery = useQuery({
    queryKey: ['mobile-workboard'],
    queryFn: async () => {
      const { data } = await api.get<MobileWorkboardResponse>('/mobile/requests/workboard');
      return data;
    },
  });

  const requestCount = React.useMemo(() => {
    const items = [
      ...(workboardQuery.data?.assigned_to_me || []),
      ...(workboardQuery.data?.available || []),
      ...(workboardQuery.data?.other_visible || []),
    ];
    return items.filter((item) => !['CLOSED', 'CANCELLED'].includes(item.status)).length;
  }, [workboardQuery.data]);

  const notificationsQuery = useQuery({
    queryKey: ['mobile-notifications-unread'],
    queryFn: async () => {
      const { data } = await api.get<MobileNotification[]>('/notifications', {
        params: { unread_only: true, limit: 99 },
      });
      return data;
    },
  });

  const unreadNotificationCount = notificationsQuery.data?.length || 0;

  const navigationItems = [
    {
      key: 'requests',
      label: t('navigation.requests'),
      icon: (
        <Badge
          badgeContent={requestCount}
          color="warning"
          sx={{ '& .MuiBadge-badge': { bgcolor: '#facc15', color: '#111827' } }}
        >
          <AssignmentTurnedInIcon />
        </Badge>
      ),
      path: '/requests',
    },
    {
      key: 'clients',
      label: t('navigation.clients'),
      icon: <PeopleIcon />,
      path: '/clients',
    },
    {
      key: 'materials',
      label: t('navigation.materials'),
      icon: <Inventory2Icon />,
      path: '/materials',
    },
    {
      key: 'notifications',
      label: t('navigation.notifications'),
      icon: (
        <Badge badgeContent={unreadNotificationCount} color="error">
          <NotificationsIcon />
        </Badge>
      ),
      path: '/notifications',
    },
    {
      key: 'profile',
      label: t('navigation.profile'),
      icon: <PersonIcon />,
      path: '/profile',
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} color="transparent" sx={{ backdropFilter: 'blur(10px)' }}>
        <Toolbar sx={{ color: '#0f172a', gap: 1 }}>
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{ color: 'inherit' }}
            aria-label={t('navigation.menu')}
          >
            <MenuIcon />
          </IconButton>
          {showBack ? (
            <IconButton
              onClick={() => navigate(-1)}
              sx={{ color: 'inherit' }}
              aria-label={t('navigation.back')}
            >
              <ArrowBackIcon />
            </IconButton>
          ) : (
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: '#0f766e',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.9rem',
              }}
            >
              {t('app.shortBrand')}
            </Avatar>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
              {title}
            </Typography>
          </Box>
          <Select
            size="small"
            value={i18n.resolvedLanguage || i18n.language}
            onChange={(event) => void i18n.changeLanguage(event.target.value)}
            sx={{
              minWidth: 96,
              bgcolor: 'rgba(255,255,255,0.74)',
              '& .MuiSelect-select': { py: 0.75, fontWeight: 700 },
            }}
            inputProps={{ 'aria-label': t('common.language') }}
          >
            <MenuItem value="bg">{t('common.bulgarian')}</MenuItem>
            <MenuItem value="en">{t('common.english')}</MenuItem>
          </Select>
          <IconButton
            onClick={logout}
            sx={{ color: 'inherit' }}
            aria-label={t('navigation.logout')}
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 290, p: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ bgcolor: '#0f766e', width: 44, height: 44, fontWeight: 800 }}>{t('app.shortBrand')}</Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {t('app.brand')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('navigation.menu')}
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ mb: 1.5 }} />
          <List>
            {navigationItems.map((item) => (
              <ListItemButton
                key={item.key}
                selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                onClick={() => {
                  navigate(item.path);
                  setDrawerOpen(false);
                }}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box sx={{ p: 2 }}>{children}</Box>
    </Box>
  );
}
