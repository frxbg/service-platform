import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';

import api from '../api/axios';
import MobileLayout from '../components/MobileLayout';
import type { MobileNotification } from '../types/mobile';
import { formatDateTime } from '../utils/requestPresentation';

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const localizeNotification = (notification: MobileNotification) => {
    if (notification.notification_type !== 'service_request_assigned') {
      return {
        title: notification.title,
        message: notification.message,
      };
    }

    const requestNumber =
      notification.title.match(/([A-Z]{2}-\d{4}-\d{4})/)?.[1] ||
      notification.message.match(/([A-Z]{2}-\d{4}-\d{4})/)?.[1] ||
      '';
    const clientSiteMatch = notification.message.match(/for\s+(.+?)\s\/\s(.+?)\.?$/i);

    return {
      title: t('notificationsPage.assignmentTitle', { requestNumber: requestNumber || notification.entity_id || '-' }),
      message: t('notificationsPage.assignmentMessage', {
        requestNumber: requestNumber || notification.entity_id || '-',
        client: clientSiteMatch?.[1] || t('common.notAvailable'),
        site: clientSiteMatch?.[2] || t('common.notAvailable'),
      }),
    };
  };

  const notificationsQuery = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: async () => {
      const { data } = await api.get<MobileNotification[]>('/notifications', {
        params: { limit: 100 },
      });
      return data;
    },
  });
  const notificationsError = notificationsQuery.error as AxiosError<{ detail?: string }> | null;

  const refreshNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['mobile-notifications-unread'] });
  };

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/notifications/${notificationId}/read`);
    },
    onSuccess: async () => {
      await refreshNotifications();
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all');
    },
    onSuccess: async () => {
      await refreshNotifications();
    },
  });

  return (
    <MobileLayout title={t('navigation.notifications')}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">{t('notificationsPage.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('notificationsPage.subtitle')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            disabled={markAllReadMutation.isPending || !notificationsQuery.data?.some((item) => !item.is_read)}
            onClick={() => markAllReadMutation.mutate()}
          >
            {t('notificationsPage.markAllRead')}
          </Button>
        </Box>

        {notificationsQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : null}

        {notificationsQuery.isError ? (
          <Alert severity="error">
            {notificationsError?.response?.data?.detail || t('common.error')}
          </Alert>
        ) : null}

        {notificationsQuery.data?.map((notification) => {
          const localized = localizeNotification(notification);

          return (
            <Card key={notification.id} sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {localized.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(notification.created_at, i18n.resolvedLanguage || i18n.language)}
                      </Typography>
                    </Box>
                    {!notification.is_read ? (
                      <Button
                        size="small"
                        disabled={markReadMutation.isPending}
                        onClick={() => markReadMutation.mutate(notification.id)}
                      >
                        {t('notificationsPage.markRead')}
                      </Button>
                    ) : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {localized.message}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          );
        })}

        {!notificationsQuery.isLoading && !notificationsQuery.isError && !notificationsQuery.data?.length ? (
          <Alert severity="info">{t('notificationsPage.empty')}</Alert>
        ) : null}
      </Stack>
    </MobileLayout>
  );
}
