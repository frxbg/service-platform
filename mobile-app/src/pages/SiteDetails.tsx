import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import api from '../api/axios';
import MobileLayout from '../components/MobileLayout';
import RequestCard from '../components/RequestCard';
import type {
  MobileRequestMutationResponse,
  MobileSiteDetail,
  MobileSiteRequestListItem,
} from '../types/mobile';
import { formatEquipmentLabel } from '../utils/requestPresentation';

type RequestScope = 'current' | 'completed' | 'all';

export default function SiteDetailsPage() {
  const { clientId = '', siteId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [equipmentKey, setEquipmentKey] = useState('');
  const [requestScope, setRequestScope] = useState<RequestScope>('current');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const siteQuery = useQuery({
    queryKey: ['mobile-site', siteId],
    queryFn: async () => {
      const { data } = await api.get<MobileSiteDetail>(`/mobile/sites/${siteId}`);
      return data;
    },
    enabled: Boolean(siteId),
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/accept`,
      );
      return data;
    },
    onSuccess: async () => {
      setToastMessage(t('requestDetails.acceptSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mobile-workboard'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-site', siteId] }),
      ]);
    },
    onError: () => {
      setToastMessage(t('requestDetails.acceptError'));
    },
  });

  const visibleRequests = useMemo<MobileSiteRequestListItem[]>(() => {
    if (!siteQuery.data) {
      return [];
    }

    if (requestScope === 'current') {
      return siteQuery.data.current_requests;
    }
    if (requestScope === 'completed') {
      return siteQuery.data.completed_requests;
    }
    return [...siteQuery.data.current_requests, ...siteQuery.data.completed_requests];
  }, [requestScope, siteQuery.data]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return visibleRequests.filter((request) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          request.request_number,
          request.problem_summary,
          request.client_name,
          request.site_name,
          request.site_code,
          request.address,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));

      const matchesEquipment = !equipmentKey || request.equipment_keys.includes(equipmentKey);
      return matchesSearch && matchesEquipment;
    });
  }, [equipmentKey, search, visibleRequests]);

  return (
    <MobileLayout
      title={siteQuery.data?.site_name || siteQuery.data?.site_code || t('navigation.siteDetails')}
      showBack
    >
      <Stack spacing={2}>
        {siteQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : null}

        {siteQuery.isError ? <Alert severity="error">{t('common.error')}</Alert> : null}

        {siteQuery.data ? (
          <>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h5">
                    {siteQuery.data.site_name || siteQuery.data.site_code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {siteQuery.data.client_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {siteQuery.data.address || siteQuery.data.city || t('common.notAvailable')}
                  </Typography>
                  {siteQuery.data.notes ? (
                    <Typography variant="body2" color="text.secondary">
                      {siteQuery.data.notes}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button variant="outlined" onClick={() => navigate(`/clients/${clientId}`)}>
                      {t('siteDetails.openClient')}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('siteDetails.equipment')}
                  </Typography>
                  {siteQuery.data.equipment.length ? (
                    siteQuery.data.equipment.map((equipment) => (
                      <Box
                        key={equipment.equipment_key}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.25,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatEquipmentLabel(equipment)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('siteDetails.requestCount', { count: equipment.request_count })}
                        </Typography>
                        {equipment.location_note ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {equipment.location_note}
                          </Typography>
                        ) : null}
                      </Box>
                    ))
                  ) : (
                    <Alert severity="info">{t('siteDetails.emptyEquipment')}</Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('siteDetails.requests')}
                  </Typography>

                  <ToggleButtonGroup
                    value={requestScope}
                    exclusive
                    onChange={(_, value: RequestScope | null) => value && setRequestScope(value)}
                    color="primary"
                  >
                    <ToggleButton value="current">{t('siteDetails.currentRequests')}</ToggleButton>
                    <ToggleButton value="completed">{t('siteDetails.completedRequests')}</ToggleButton>
                    <ToggleButton value="all">{t('siteDetails.allRequests')}</ToggleButton>
                  </ToggleButtonGroup>

                  <TextField
                    label={t('siteDetails.searchRequests')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <TextField
                    select
                    label={t('siteDetails.filterEquipment')}
                    value={equipmentKey}
                    onChange={(event) => setEquipmentKey(event.target.value)}
                  >
                    <MenuItem value="">{t('siteDetails.allEquipment')}</MenuItem>
                    {siteQuery.data.equipment.map((equipment) => (
                      <MenuItem key={equipment.equipment_key} value={equipment.equipment_key}>
                        {formatEquipmentLabel(equipment)}
                      </MenuItem>
                    ))}
                  </TextField>

                  {filteredRequests.length ? (
                    <Stack spacing={1.25}>
                      {filteredRequests.map((request) => (
                        <RequestCard
                          key={request.id}
                          item={request}
                          onAccept={(requestId: string) => acceptMutation.mutate(requestId)}
                          acceptPending={
                            acceptMutation.isPending && acceptMutation.variables === request.id
                          }
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">{t('siteDetails.emptyRequests')}</Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </MobileLayout>
  );
}
