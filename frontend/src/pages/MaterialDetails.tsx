import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    FormControlLabel,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

interface MaterialOfferUsage {
    offer_id: string;
    offer_number: string;
    offer_status: string;
    client_name?: string | null;
    project_name?: string | null;
    quantity: number;
    unit?: string | null;
    line_price?: number;
    line_cost?: number;
    line_no: number;
    created_at?: string | null;
}

interface MaterialDetailsResponse {
    id: string;
    erp_code: string;
    barcode?: string | null;
    name: string;
    description?: string | null;
    unit: string;
    category: string;
    subcategory?: string | null;
    cost?: number;
    cost_currency?: string;
    default_margin_percent?: number | null;
    default_sell_price?: number | null;
    is_active: boolean;
    last_synced_at?: string | null;
    usage_count: number;
    offers: MaterialOfferUsage[];
}

const statusColorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    DRAFT: 'default',
    PUBLISHED: 'info',
    SENT: 'warning',
    ACCEPTED: 'success',
    REJECTED: 'error',
    ARCHIVED: 'default',
};

const MaterialDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const canManageMaterialsCatalog = hasPermission(user, 'materials.manage');
    const canReadMaterialCommercial = hasAnyPermission(user, ['materials.read_commercial', 'materials.manage']);
    const [status, setStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const { data: material, isLoading } = useQuery<MaterialDetailsResponse>({
        queryKey: ['material-details', id],
        queryFn: async () => {
            const { data } = await api.get(`/materials/${id}/details`);
            return data;
        },
        enabled: Boolean(id),
    });

    const [form, setForm] = React.useState<Partial<MaterialDetailsResponse>>({});

    React.useEffect(() => {
        if (material) {
            setForm(material);
        }
    }, [material]);

    const recalculateFromMargin = React.useCallback((nextCost?: number, nextMargin?: number) => {
        const cost = Number(nextCost ?? form.cost ?? 0);
        const margin = Number(nextMargin ?? form.default_margin_percent ?? 0);
        const nextSellPrice = cost * (1 + margin / 100);

        setForm((prev) => ({
            ...prev,
            cost,
            default_margin_percent: margin,
            default_sell_price: Number(nextSellPrice.toFixed(2)),
        }));
    }, [form.cost, form.default_margin_percent]);

    const recalculateFromPrice = React.useCallback((nextCost?: number, nextPrice?: number) => {
        const cost = Number(nextCost ?? form.cost ?? 0);
        const price = Number(nextPrice ?? form.default_sell_price ?? 0);
        const nextMargin = cost > 0 ? ((price - cost) / cost) * 100 : 0;

        setForm((prev) => ({
            ...prev,
            cost,
            default_sell_price: price,
            default_margin_percent: Number(nextMargin.toFixed(2)),
        }));
    }, [form.cost, form.default_sell_price]);

    const updateMutation = useMutation({
        mutationFn: async (payload: Partial<MaterialDetailsResponse>) => {
            const { data } = await api.patch(`/materials/${id}`, payload);
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['materials'] });
            void queryClient.invalidateQueries({ queryKey: ['material', id] });
            void queryClient.invalidateQueries({ queryKey: ['material-details', id] });
            setStatus({ type: 'success', message: 'Материалът е запазен.' });
        },
        onError: (error: any) => {
            setStatus({
                type: 'error',
                message: error?.response?.data?.detail || 'Записът на материала се провали.',
            });
        },
    });

    const handleTextChange = (field: keyof MaterialDetailsResponse) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value) || 0;
        recalculateFromMargin(value, Number(form.default_margin_percent ?? 0));
    };

    const handleMarginChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value) || 0;
        recalculateFromMargin(Number(form.cost ?? 0), value);
    };

    const handlePriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value) || 0;
        recalculateFromPrice(Number(form.cost ?? 0), value);
    };

    const handleSave = () => {
        updateMutation.mutate({
            erp_code: form.erp_code,
            barcode: form.barcode,
            name: form.name,
            description: form.description,
            unit: form.unit,
            category: form.category,
            subcategory: form.subcategory,
            cost: form.cost,
            cost_currency: form.cost_currency,
            default_margin_percent: form.default_margin_percent,
            default_sell_price: form.default_sell_price,
            is_active: form.is_active,
        });
    };

    if (isLoading || !material) {
        return <Typography>{t('common.loading')}</Typography>;
    }

    const inputProps = { readOnly: !canManageMaterialsCatalog };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="h4">{form.name || material.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        ERP: {form.erp_code || material.erp_code} | Използван в оферти: {material.usage_count}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" onClick={() => navigate(-1)}>
                        {t('common.back')}
                    </Button>
                    {canManageMaterialsCatalog ? (
                        <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending}>
                            {t('common.save', { defaultValue: 'Запази' })}
                        </Button>
                    ) : null}
                </Box>
            </Box>

            {status ? <Alert severity={status.type}>{status.message}</Alert> : null}

            <Card>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6">Детайли за материала</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
                        <TextField
                            label={t('materials.code')}
                            fullWidth
                            value={form.erp_code || ''}
                            onChange={handleTextChange('erp_code')}
                            InputProps={inputProps}
                        />
                        <TextField
                            label="Баркод"
                            fullWidth
                            value={form.barcode || ''}
                            onChange={handleTextChange('barcode')}
                            InputProps={inputProps}
                        />
                        <TextField
                            label={t('materials.name')}
                            fullWidth
                            value={form.name || ''}
                            onChange={handleTextChange('name')}
                            InputProps={inputProps}
                        />
                        <TextField
                            label={t('materials.unit')}
                            fullWidth
                            value={form.unit || ''}
                            onChange={handleTextChange('unit')}
                            InputProps={inputProps}
                        />
                        <TextField
                            label={t('material.category')}
                            fullWidth
                            value={form.category || ''}
                            onChange={handleTextChange('category')}
                            InputProps={inputProps}
                        />
                        <TextField
                            label="Подкатегория"
                            fullWidth
                            value={form.subcategory || ''}
                            onChange={handleTextChange('subcategory')}
                            InputProps={inputProps}
                        />
                        {canReadMaterialCommercial ? (
                            <TextField
                                label={t('materials.cost')}
                                type="number"
                                fullWidth
                                value={form.cost ?? ''}
                                onChange={handleCostChange}
                                InputProps={inputProps}
                            />
                        ) : null}
                        {canReadMaterialCommercial ? (
                            <TextField
                                label="Валута"
                                fullWidth
                                value={form.cost_currency || ''}
                                onChange={handleTextChange('cost_currency')}
                                InputProps={inputProps}
                            />
                        ) : null}
                        {canReadMaterialCommercial ? (
                            <TextField
                                label={t('material.defaultMargin')}
                                type="number"
                                fullWidth
                                value={form.default_margin_percent ?? ''}
                                onChange={handleMarginChange}
                                InputProps={inputProps}
                            />
                        ) : null}
                        {canReadMaterialCommercial ? (
                            <TextField
                                label="Продажна цена"
                                type="number"
                                fullWidth
                                value={form.default_sell_price ?? ''}
                                onChange={handlePriceChange}
                                InputProps={inputProps}
                            />
                        ) : null}
                        <TextField
                            label="Последна синхронизация"
                            fullWidth
                            value={material.last_synced_at ? new Date(material.last_synced_at).toLocaleString() : '-'}
                            InputProps={{ readOnly: true }}
                        />
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    checked={form.is_active !== false}
                                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                                    disabled={!canManageMaterialsCatalog}
                                />
                            )}
                            label="Активен материал"
                        />
                    </Box>
                    <TextField
                        label={t('offer.description')}
                        fullWidth
                        multiline
                        minRows={3}
                        value={form.description || ''}
                        onChange={handleTextChange('description')}
                        InputProps={inputProps}
                    />
                </CardContent>
            </Card>

            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">Оферти, в които е използван материалът</Typography>
                {material.offers.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        Материалът още не е използван в оферти.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Оферта</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Клиент</TableCell>
                                    <TableCell>Обект</TableCell>
                                    <TableCell>Ред</TableCell>
                                    <TableCell>Количество</TableCell>
                                    {canReadMaterialCommercial ? <TableCell>Цена</TableCell> : null}
                                    {canReadMaterialCommercial ? <TableCell>Себестойност</TableCell> : null}
                                    <TableCell>Дата</TableCell>
                                    <TableCell>Действие</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {material.offers.map((usage) => (
                                    <TableRow key={`${usage.offer_id}-${usage.line_no}`} hover>
                                        <TableCell>{usage.offer_number}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={usage.offer_status}
                                                color={statusColorMap[usage.offer_status] || 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>{usage.client_name || '-'}</TableCell>
                                        <TableCell>{usage.project_name || '-'}</TableCell>
                                        <TableCell>{usage.line_no}</TableCell>
                                        <TableCell>{usage.quantity} {usage.unit || ''}</TableCell>
                                        {canReadMaterialCommercial ? <TableCell>{usage.line_price ?? '-'}</TableCell> : null}
                                        {canReadMaterialCommercial ? <TableCell>{usage.line_cost ?? '-'}</TableCell> : null}
                                        <TableCell>{usage.created_at ? new Date(usage.created_at).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>
                                            <Button size="small" onClick={() => navigate(`/offers/${usage.offer_id}/view`)}>
                                                Отвори
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default MaterialDetails;
