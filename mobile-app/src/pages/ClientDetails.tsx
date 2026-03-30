import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
import type { MobileClient, MobileRequestListItem, MobileWorkboardResponse } from '../types/mobile';

export default function ClientDetailsPage() {
  const { clientId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const clientQuery = useQuery({
    queryKey: ['mobile-client', clientId],
    queryFn: async () => {
      const { data } = await api.get<MobileClient>(`/clients/${clientId}`);
      return data;
    },
    enabled: Boolean(clientId),
  });

  const workboardQuery = useQuery({
    queryKey: ['mobile-workboard'],
    queryFn: async () => {
      const { data } = await api.get<MobileWorkboardResponse>('/mobile/requests/workboard');
      return data;
    },
  });

  const requests = useMemo<MobileRequestListItem[]>(
    () => [
      ...(workboardQuery.data?.assigned_to_me || []),
      ...(workboardQuery.data?.available || []),
      ...(workboardQuery.data?.other_visible || []),
    ],
    [workboardQuery.data],
  );

  return (
    <MobileLayout title={clientQuery.data?.name || t('navigation.clients')} showBack>
      <Stack spacing={2}>
        {clientQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : null}

        {clientQuery.isError ? <Alert severity="error">{t('common.error')}</Alert> : null}

        {clientQuery.data ? (
          <>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h5">{clientQuery.data.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {clientQuery.data.city ||
                      clientQuery.data.email ||
                      clientQuery.data.phone ||
                      t('common.notAvailable')}
                  </Typography>
                  {clientQuery.data.notes ? (
                    <Typography variant="body2" color="text.secondary">
                      {clientQuery.data.notes}
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {t('clientsPage.sites')}
              </Typography>
              {clientQuery.data.sites.length ? (
                clientQuery.data.sites.map((site) => {
                  const siteRequests = requests.filter((item) => item.site_id === site.id);
                  const activeCount = siteRequests.filter(
                    (item) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(item.status),
                  ).length;
                  const completedCount = siteRequests.filter((item) =>
                    ['COMPLETED', 'CLOSED'].includes(item.status),
                  ).length;

                  return (
                    <Card key={site.id}>
                      <CardContent>
                        <Stack spacing={1.25}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            {site.site_name || site.site_code}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {site.city || site.address || t('common.notAvailable')}
                          </Typography>
                          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                            <Typography variant="caption">
                              {t('clientsPage.activeRequests')}: {activeCount}
                            </Typography>
                            <Typography variant="caption">
                              {t('clientsPage.closedRequests')}: {completedCount}
                            </Typography>
                          </Stack>
                          <Button
                            variant="contained"
                            onClick={() => navigate(`/clients/${clientId}/sites/${site.id}`)}
                          >
                            {t('clientsPage.openSite')}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Alert severity="info">{t('clientsPage.emptySites')}</Alert>
              )}
            </Stack>
          </>
        ) : null}
      </Stack>
    </MobileLayout>
  );
}
