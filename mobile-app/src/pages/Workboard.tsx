import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import type { MobileRequestMutationResponse, MobileWorkboardResponse } from '../types/mobile';
import { formatDateTime } from '../utils/requestPresentation';

type WorkboardGroupKey = 'assigned_to_me' | 'available' | 'other';
type ViewMode = 'mine' | 'all';

export default function WorkboardPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const workboardQuery = useQuery({
    queryKey: ['mobile-workboard'],
    queryFn: async () => {
      const { data } = await api.get<MobileWorkboardResponse>('/mobile/requests/workboard');
      return data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/accept`,
      );
      return data;
    },
    onSuccess: () => {
      setToastMessage(t('requestDetails.acceptSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['mobile-workboard'] });
    },
    onError: () => {
      setToastMessage(t('requestDetails.acceptError'));
    },
  });

  const allItems = useMemo(() => {
    const assigned = workboardQuery.data?.assigned_to_me ?? [];
    const available = workboardQuery.data?.available ?? [];
    const other = workboardQuery.data?.other_visible ?? [];
    return [...assigned, ...available, ...other];
  }, [workboardQuery.data]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (viewMode === 'mine') {
      items = items.filter((item) => item.assigned_to_me);
    }
    if (statusFilter) {
      items = items.filter((item) => item.status === statusFilter);
    }
    if (clientFilter) {
      items = items.filter((item) => item.client_id === clientFilter);
    }
    if (cityFilter) {
      items = items.filter((item) => (item.city || '') === cityFilter);
    }
    if (siteFilter) {
      items = items.filter((item) => item.site_id === siteFilter);
    }
    return items;
  }, [allItems, viewMode, statusFilter, clientFilter, cityFilter, siteFilter]);

  const sections = useMemo(() => {
    const byGroup = {
      assigned_to_me: filteredItems.filter((item) => item.workboard_group === 'assigned_to_me'),
      available: filteredItems.filter((item) => item.workboard_group === 'available'),
      other: filteredItems.filter((item) => item.workboard_group === 'other'),
    };

    const groupOrder: Array<{ key: WorkboardGroupKey; title: string; items: typeof filteredItems }> = [
      {
        key: 'assigned_to_me',
        title: t('workboard.groups.assigned_to_me'),
        items: byGroup.assigned_to_me,
      },
      {
        key: 'available',
        title: t('workboard.groups.available'),
        items: byGroup.available,
      },
      {
        key: 'other',
        title: t('workboard.groups.other'),
        items: byGroup.other,
      },
    ];

    return viewMode === 'mine' ? groupOrder.filter((section) => section.key === 'assigned_to_me') : groupOrder;
  }, [filteredItems, t, viewMode]);

  const summary = useMemo(
    () => [
      {
        key: 'unfinished',
        label: t('workboard.unfinished'),
        count: allItems.filter((item) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(item.status)).length,
      },
      {
        key: 'pending',
        label: t('workboard.pendingAcceptance'),
        count: allItems.filter((item) => item.status === 'PENDING_ACCEPTANCE').length,
      },
      {
        key: 'progress',
        label: t('workboard.inProgress'),
        count: allItems.filter((item) => item.status === 'IN_PROGRESS').length,
      },
      {
        key: 'parts',
        label: t('workboard.waitingParts'),
        count: allItems.filter((item) => item.status === 'WAITING_PARTS').length,
      },
      {
        key: 'client',
        label: t('workboard.waitingClient'),
        count: allItems.filter((item) => item.status === 'WAITING_CLIENT').length,
      },
    ],
    [allItems, t],
  );

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    allItems.forEach((item) => {
      if (!map.has(item.client_id)) {
        map.set(item.client_id, item.client_name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allItems]);

  const cityOptions = useMemo(
    () =>
      Array.from(new Set(allItems.map((item) => item.city).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [allItems],
  );

  const siteOptions = useMemo(() => {
    const map = new Map<string, string>();
    allItems.forEach((item) => {
      if (!map.has(item.site_id)) {
        map.set(item.site_id, item.site_name || item.site_code);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allItems]);

  const statusOptions = useMemo(
    () => Array.from(new Set(allItems.map((item) => item.status))).sort(),
    [allItems],
  );
  const activeFilterCount = [statusFilter, clientFilter, cityFilter, siteFilter].filter(Boolean).length;

  return (
    <MobileLayout title={t('navigation.requests')}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">{t('workboard.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('workboard.subtitle')}
          </Typography>
          {workboardQuery.data?.generated_at ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {t('workboard.lastUpdated', {
                value: formatDateTime(
                  workboardQuery.data.generated_at,
                  i18n.resolvedLanguage || i18n.language,
                ),
              })}
            </Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {summary.map((item) => (
            <Card key={item.key} sx={{ minWidth: 120, flex: '1 1 120px' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {item.count}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, next) => next && setViewMode(next)}
          color="primary"
        >
          <ToggleButton value="mine">{t('workboard.viewMine')}</ToggleButton>
          <ToggleButton value="all">{t('workboard.viewAll')}</ToggleButton>
        </ToggleButtonGroup>

        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={() => setFiltersOpen((current) => !current)}>
              {filtersOpen ? t('workboard.hideFilters') : t('workboard.showFilters')}
            </Button>
            <Button variant="outlined" onClick={() => void workboardQuery.refetch()}>
              {t('workboard.refresh')}
            </Button>
            {activeFilterCount ? (
              <Chip
                color="primary"
                variant="outlined"
                label={t('workboard.activeFilters', { count: activeFilterCount })}
              />
            ) : null}
            {activeFilterCount ? (
              <Button
                variant="text"
                onClick={() => {
                  setStatusFilter('');
                  setClientFilter('');
                  setCityFilter('');
                  setSiteFilter('');
                }}
              >
                {t('common.clear')}
              </Button>
            ) : null}
          </Stack>

          {filtersOpen ? (
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {t('workboard.filtersTitle')}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <TextField
                      select
                      label={t('workboard.filterStatus')}
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      sx={{ minWidth: 160, flex: '1 1 160px' }}
                    >
                      <MenuItem value="">{t('workboard.allStatuses')}</MenuItem>
                      {statusOptions.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label={t('workboard.filterClient')}
                      value={clientFilter}
                      onChange={(event) => setClientFilter(event.target.value)}
                      sx={{ minWidth: 180, flex: '1 1 180px' }}
                    >
                      <MenuItem value="">{t('workboard.allClients')}</MenuItem>
                      {clientOptions.map(([id, name]) => (
                        <MenuItem key={id} value={id}>
                          {name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label={t('workboard.filterCity')}
                      value={cityFilter}
                      onChange={(event) => setCityFilter(event.target.value)}
                      sx={{ minWidth: 150, flex: '1 1 150px' }}
                    >
                      <MenuItem value="">{t('workboard.allCities')}</MenuItem>
                      {cityOptions.map((city) => (
                        <MenuItem key={city} value={city}>
                          {city}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label={t('workboard.filterSite')}
                      value={siteFilter}
                      onChange={(event) => setSiteFilter(event.target.value)}
                      sx={{ minWidth: 180, flex: '1 1 180px' }}
                    >
                      <MenuItem value="">{t('workboard.allSites')}</MenuItem>
                      {siteOptions.map(([id, name]) => (
                        <MenuItem key={id} value={id}>
                          {name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Stack>

        {workboardQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : null}

        {workboardQuery.isError ? <Alert severity="error">{t('common.error')}</Alert> : null}

        {!workboardQuery.isLoading && !workboardQuery.isError
          ? sections.map((section) =>
              section.items.length ? (
                <Stack key={section.key} spacing={1.25}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {section.title}
                  </Typography>
                  {section.items.map((item) => (
                    <RequestCard
                      key={item.id}
                      item={item}
                      onAccept={(requestId: string) => acceptMutation.mutate(requestId)}
                      acceptPending={
                        acceptMutation.isPending && acceptMutation.variables === item.id
                      }
                    />
                  ))}
                </Stack>
              ) : null,
            )
          : null}

        {!workboardQuery.isLoading &&
        !workboardQuery.isError &&
        sections.every((section) => section.items.length === 0) ? (
          <Alert severity="info">{t('workboard.empty')}</Alert>
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
