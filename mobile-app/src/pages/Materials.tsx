import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '../api/axios';
import MobileLayout from '../components/MobileLayout';
import type { MobileMaterialOption, MobileWarehouseOption } from '../types/mobile';

export default function MaterialsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const warehousesQuery = useQuery({
    queryKey: ['mobile-warehouses'],
    queryFn: async () => {
      const { data } = await api.get<MobileWarehouseOption[]>('/mobile/warehouses');
      return data;
    },
  });

  const materialsQuery = useQuery({
    queryKey: ['mobile-materials-page', search],
    queryFn: async () => {
      const { data } = await api.get<MobileMaterialOption[]>('/mobile/materials', {
        params: { search: search || undefined, limit: 100 },
      });
      return data;
    },
  });

  return (
    <MobileLayout title={t('navigation.materials')}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">{t('materialsPage.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('materialsPage.subtitle')}
          </Typography>
        </Box>

        <TextField
          select
          label={t('materialsPage.warehouse')}
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
        >
          {(warehousesQuery.data || []).map((warehouse) => (
            <MenuItem key={warehouse.id} value={warehouse.id}>
              {warehouse.code} - {warehouse.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={t('materialsPage.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <Alert severity="info">{t('materialsPage.stockPending')}</Alert>

        {materialsQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : null}

        {materialsQuery.isError ? <Alert severity="error">{t('common.error')}</Alert> : null}

        {materialsQuery.data?.map((material) => (
          <Card key={material.id}>
            <CardContent>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {material.erp_code} - {material.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {material.description || material.category || t('common.notAvailable')}
                </Typography>
                <Typography variant="caption">{material.unit}</Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}

        {!materialsQuery.isLoading && !materialsQuery.isError && !materialsQuery.data?.length ? (
          <Alert severity="info">{t('materialsPage.empty')}</Alert>
        ) : null}
      </Stack>
    </MobileLayout>
  );
}
