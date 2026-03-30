import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    Paper,
    Radio,
    RadioGroup,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, UploadFile as UploadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatBgDate } from '../utils/dateTime';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

interface Material {
    id: string;
    erp_code: string;
    barcode?: string;
    name: string;
    unit: string;
    category: string;
    cost?: number;
    cost_currency?: string;
    default_margin_percent?: number;
    default_sell_price?: number;
    last_synced_at?: string | null;
    is_active?: boolean;
}

type BulkMarginMode = 'adjust' | 'replace';

const Materials: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const canManageMaterialsCatalog = hasPermission(user, 'materials.manage');
    const canReadMaterialCommercial = hasAnyPermission(user, ['materials.read_commercial', 'materials.manage']);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [bulkMarginMode, setBulkMarginMode] = useState<BulkMarginMode>('adjust');
    const [bulkMarginValue, setBulkMarginValue] = useState<string>('');
    const [newMaterial, setNewMaterial] = useState({
        erp_code: '',
        name: '',
        unit: 'pcs',
        cost: 0,
        default_margin_percent: 30,
        category: 'general',
        cost_currency: 'EUR',
        description: '',
    });
    const [createError, setCreateError] = useState<string | null>(null);

    const { data: materials = [], isLoading } = useQuery<Material[]>({
        queryKey: ['materials', page, rowsPerPage, search],
        queryFn: async () => {
            const { data } = await api.get('/materials/', {
                params: { skip: page * rowsPerPage, limit: rowsPerPage, search },
            });
            return data;
        },
    });

    const selectedSet = useMemo(() => new Set(selectedMaterialIds), [selectedMaterialIds]);
    const pageIds = useMemo(() => materials.map((material) => material.id), [materials]);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
    const pageIndeterminate = pageIds.some((id) => selectedSet.has(id)) && !allPageSelected;
    const loadingColSpan = canManageMaterialsCatalog ? (canReadMaterialCommercial ? 9 : 7) : (canReadMaterialCommercial ? 8 : 6);

    const createMaterialMutation = useMutation({
        mutationFn: async (payload: typeof newMaterial) => {
            const { data } = await api.post('/materials/', payload);
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['materials'] });
            setCreateDialogOpen(false);
            setNewMaterial({
                erp_code: '',
                name: '',
                unit: 'pcs',
                cost: 0,
                default_margin_percent: 30,
                category: 'general',
                cost_currency: 'EUR',
                description: '',
            });
            setCreateError(null);
            setStatus({ type: 'success', message: 'Материалът е създаден.' });
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            if (Array.isArray(detail)) {
                setCreateError(detail.map((item: any) => item?.msg).join(', '));
            } else if (typeof detail === 'string') {
                setCreateError(detail);
            } else {
                setCreateError('Create failed');
            }
        },
    });

    const bulkMarginMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/materials/bulk-margin-update', {
                material_ids: selectedMaterialIds,
                margin_percent: Number(bulkMarginValue),
                mode: bulkMarginMode,
            });
            return data;
        },
        onSuccess: (data) => {
            void queryClient.invalidateQueries({ queryKey: ['materials'] });
            setBulkDialogOpen(false);
            setBulkMarginValue('');
            setSelectedMaterialIds([]);
            setStatus({
                type: 'success',
                message: `Обновени материали: ${data.updated}`,
            });
        },
        onError: (error: any) => {
            setStatus({
                type: 'error',
                message: error?.response?.data?.detail || 'Масовата промяна на надценката се провали.',
            });
        },
    });

    const toggleMaterial = (materialId: string) => {
        setSelectedMaterialIds((current) => (
            current.includes(materialId)
                ? current.filter((id) => id !== materialId)
                : [...current, materialId]
        ));
    };

    const toggleCurrentPage = (checked: boolean) => {
        if (checked) {
            setSelectedMaterialIds((current) => Array.from(new Set([...current, ...pageIds])));
            return;
        }

        setSelectedMaterialIds((current) => current.filter((id) => !pageIds.includes(id)));
    };

    const openBulkDialog = () => {
        if (selectedMaterialIds.length === 0) {
            setStatus({ type: 'error', message: 'Изберете поне един материал.' });
            return;
        }
        setBulkDialogOpen(true);
    };

    const handleBulkApply = () => {
        if (selectedMaterialIds.length === 0) {
            setStatus({ type: 'error', message: 'Изберете поне един материал.' });
            return;
        }

        if (bulkMarginValue.trim() === '' || Number.isNaN(Number(bulkMarginValue))) {
            setStatus({ type: 'error', message: 'Въведете валидна стойност за надценката.' });
            return;
        }

        bulkMarginMutation.mutate();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h4">{t('nav.materials')}</Typography>
                {canManageMaterialsCatalog ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button variant="outlined" onClick={openBulkDialog} disabled={selectedMaterialIds.length === 0}>
                            Промени надценката ({selectedMaterialIds.length})
                        </Button>
                        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                            {t('material.newMaterial', { defaultValue: t('offer.newMaterial') })}
                        </Button>
                        <Button variant="contained" startIcon={<UploadIcon />} onClick={() => navigate('/materials/import')}>
                            Импорт
                        </Button>
                    </Box>
                ) : null}
            </Box>

            {status ? <Alert severity={status.type}>{status.message}</Alert> : null}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    placeholder="Search..."
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                    }}
                    InputProps={{
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                    }}
                />
                {canManageMaterialsCatalog ? (
                    <Typography variant="body2" color="text.secondary">
                        Избрани материали: {selectedMaterialIds.length}
                    </Typography>
                ) : null}
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            {canManageMaterialsCatalog ? (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={allPageSelected}
                                        indeterminate={pageIndeterminate}
                                        onChange={(event) => toggleCurrentPage(event.target.checked)}
                                    />
                                </TableCell>
                            ) : null}
                            <TableCell>{t('material.erp_code')}</TableCell>
                            <TableCell>{t('material.name')}</TableCell>
                            <TableCell>{t('material.category')}</TableCell>
                            <TableCell>{t('material.unit')}</TableCell>
                            {canReadMaterialCommercial ? <TableCell>{t('material.cost')}</TableCell> : null}
                            {canReadMaterialCommercial ? <TableCell>{t('material.defaultMargin')}</TableCell> : null}
                            <TableCell>Статус</TableCell>
                            <TableCell>{t('material.createdAt')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={loadingColSpan} align="center">{t('common.loading')}</TableCell>
                            </TableRow>
                        ) : (
                            materials.map((material) => (
                                <TableRow
                                    key={material.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/materials/${material.id}`)}
                                >
                                    {canManageMaterialsCatalog ? (
                                        <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedSet.has(material.id)}
                                                onChange={() => toggleMaterial(material.id)}
                                            />
                                        </TableCell>
                                    ) : null}
                                    <TableCell>{material.erp_code}</TableCell>
                                    <TableCell>{material.name}</TableCell>
                                    <TableCell>{material.category}</TableCell>
                                    <TableCell>{material.unit}</TableCell>
                                    {canReadMaterialCommercial ? (
                                        <TableCell>{material.cost ?? '-'} {material.cost_currency || ''}</TableCell>
                                    ) : null}
                                    {canReadMaterialCommercial ? (
                                        <TableCell>{material.default_margin_percent ?? 0}%</TableCell>
                                    ) : null}
                                    <TableCell>{material.is_active === false ? 'Неактивен' : 'Активен'}</TableCell>
                                    <TableCell>
                                        {material.last_synced_at ? formatBgDate(material.last_synced_at) : '-'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={-1}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_, nextPage) => setPage(nextPage)}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                    }}
                />
            </TableContainer>

            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{t('material.newMaterial', { defaultValue: t('offer.newMaterial') })}</DialogTitle>
                <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {createError ? <Alert severity="error">{createError}</Alert> : null}
                    <TextField
                        label={t('materials.code')}
                        fullWidth
                        value={newMaterial.erp_code}
                        onChange={(event) => setNewMaterial({ ...newMaterial, erp_code: event.target.value })}
                    />
                    <TextField
                        label={t('materials.name')}
                        fullWidth
                        value={newMaterial.name}
                        onChange={(event) => setNewMaterial({ ...newMaterial, name: event.target.value })}
                    />
                    <TextField
                        label={t('material.category')}
                        fullWidth
                        value={newMaterial.category}
                        onChange={(event) => setNewMaterial({ ...newMaterial, category: event.target.value })}
                    />
                    <TextField
                        label={t('materials.unit')}
                        fullWidth
                        value={newMaterial.unit}
                        onChange={(event) => setNewMaterial({ ...newMaterial, unit: event.target.value })}
                    />
                    <TextField
                        label={t('material.cost_currency', { defaultValue: 'Валута' })}
                        fullWidth
                        value={newMaterial.cost_currency}
                        onChange={(event) => setNewMaterial({ ...newMaterial, cost_currency: event.target.value })}
                    />
                    <TextField
                        type="number"
                        label={t('materials.cost')}
                        fullWidth
                        value={newMaterial.cost}
                        onChange={(event) => setNewMaterial({ ...newMaterial, cost: Number(event.target.value) || 0 })}
                    />
                    <TextField
                        type="number"
                        label={t('materials.defaultMargin')}
                        fullWidth
                        value={newMaterial.default_margin_percent}
                        onChange={(event) => setNewMaterial({ ...newMaterial, default_margin_percent: Number(event.target.value) || 0 })}
                    />
                    <TextField
                        label={t('material.description', { defaultValue: t('offer.description') })}
                        fullWidth
                        multiline
                        minRows={2}
                        value={newMaterial.description}
                        onChange={(event) => setNewMaterial({ ...newMaterial, description: event.target.value })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={() => createMaterialMutation.mutate(newMaterial)}
                        disabled={createMaterialMutation.isPending}
                    >
                        {t('common.create')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Масова промяна на надценката</DialogTitle>
                <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Избрани материали: {selectedMaterialIds.length}
                    </Typography>
                    <FormControl>
                        <FormLabel>Режим</FormLabel>
                        <RadioGroup
                            value={bulkMarginMode}
                            onChange={(event) => setBulkMarginMode(event.target.value as BulkMarginMode)}
                        >
                            <FormControlLabel value="adjust" control={<Radio />} label="Добави/извади от текущата надценка %" />
                            <FormControlLabel value="replace" control={<Radio />} label="Задай нова надценка %" />
                        </RadioGroup>
                    </FormControl>
                    <TextField
                        type="number"
                        label={bulkMarginMode === 'adjust' ? 'Промяна на надценката %' : 'Нова надценка %'}
                        fullWidth
                        value={bulkMarginValue}
                        onChange={(event) => setBulkMarginValue(event.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleBulkApply} disabled={bulkMarginMutation.isPending}>
                        Приложи
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Materials;
