import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '../api/axios';
import MobileLayout from '../components/MobileLayout';
import type { MobileClient, MobileRequestListItem, MobileWorkboardResponse } from '../types/mobile';

export default function ClientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const clientsQuery = useQuery({
    queryKey: ['mobile-clients', search],
    queryFn: async () => {
      const { data } = await api.get<MobileClient[]>('/clients', {
        params: { search: search || undefined },
      });
      return data;
    },
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
    <MobileLayout title={t('navigation.clients')}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">{t('clientsPage.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('clientsPage.subtitle')}
          </Typography>
        </Box>

        <TextField
          label={t('clientsPage.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {clientsQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : null}

        {clientsQuery.isError ? <Alert severity="error">{t('common.error')}</Alert> : null}

        {clientsQuery.data?.map((client) => {
          const clientRequests = requests.filter((item) => item.client_id === client.id);
          const activeCount = clientRequests.filter((item) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(item.status)).length;
          const closedCount = clientRequests.filter((item) => ['COMPLETED', 'CLOSED'].includes(item.status)).length;

          return (
            <Card key={client.id} onClick={() => navigate(`/clients/${client.id}`)} sx={{ cursor: 'pointer' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {client.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {client.city || client.email || client.phone || t('common.notAvailable')}
                  </Typography>
                  <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                    <Typography variant="caption">
                      {t('clientsPage.sites')}: {client.sites.length}
                    </Typography>
                    <Typography variant="caption">
                      {t('clientsPage.activeRequests')}: {activeCount}
                    </Typography>
                    <Typography variant="caption">
                      {t('clientsPage.closedRequests')}: {closedCount}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}

        {!clientsQuery.isLoading && !clientsQuery.isError && !clientsQuery.data?.length ? (
          <Alert severity="info">{t('clientsPage.empty')}</Alert>
        ) : null}
      </Stack>
    </MobileLayout>
  );
}
