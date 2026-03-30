import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormLabel,
    InputLabel,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

interface PreviewResponse {
    columns: string[];
    preview: Record<string, unknown>[];
    total_rows?: number;
}

interface ImportResponse {
    imported: number;
    skipped?: number;
    errors: number;
    rolled_back?: boolean;
}

interface ClientSite {
    id: string;
    site_code: string;
    site_name?: string;
}

interface Client {
    id: string;
    name: string;
    sites?: ClientSite[];
}

type EquipmentField = { key: string; labelKey: string; required: boolean };
type ImportMode = 'upsert' | 'skip' | 'error';

const EQUIPMENT_FIELDS: EquipmentField[] = [
    { key: 'equipment_type', labelKey: 'client.equipmentType', required: true },
    { key: 'manufacturer', labelKey: 'client.manufacturer', required: false },
    { key: 'model', labelKey: 'client.model', required: false },
    { key: 'serial_number', labelKey: 'client.serialNumber', required: false },
    { key: 'asset_tag', labelKey: 'client.assetTag', required: false },
    { key: 'location_note', labelKey: 'client.locationNote', required: false },
    { key: 'refrigerant', labelKey: 'client.refrigerant', required: false },
    { key: 'notes', labelKey: 'client.notes', required: false },
    { key: 'is_active', labelKey: 'client.statusLabel', required: false },
];

const EquipmentImport: React.FC = () => {
    const { clientId, siteId } = useParams<{ clientId: string; siteId: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManageEquipment = hasPermission(user, 'equipment.manage');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
    const [duplicateMode, setDuplicateMode] = useState<ImportMode>('upsert');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const { data: client } = useQuery<Client>({
        queryKey: ['client', clientId],
        enabled: Boolean(clientId),
        queryFn: async () => (await api.get(`/clients/${clientId}`)).data,
    });

    const site = useMemo(
        () => client?.sites?.find((entry) => entry.id === siteId) || null,
        [client, siteId],
    );

    const selectedRowSet = useMemo(() => new Set(selectedRows), [selectedRows]);
    const totalPreviewRows = preview?.preview.length ?? 0;
    const allRowsSelected = totalPreviewRows > 0 && selectedRows.length === totalPreviewRows;
    const partiallySelected = selectedRows.length > 0 && selectedRows.length < totalPreviewRows;
    const visibleRows = useMemo(
        () => preview?.preview.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) ?? [],
        [page, preview, rowsPerPage],
    );

    const loadPreview = async (selectedFile: File, headerMode: boolean) => {
        if (!siteId) {
            return;
        }

        setPreviewLoading(true);
        setStatus(null);
        setPreview(null);
        setSelectedRows([]);
        setPage(0);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('first_row_is_header', String(headerMode));

            const { data } = await api.post<PreviewResponse>(`/equipment/sites/${siteId}/import/preview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPreview(data);
            setMapping({});
            setSelectedRows(data.preview.map((_, index) => index));
        } catch (error: any) {
            setStatus({ type: 'error', message: error?.response?.data?.detail || t('equipmentImport.previewError') });
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        if (!selected) {
            return;
        }

        setFile(selected);
        await loadPreview(selected, firstRowIsHeader);
    };

    const handleHeaderToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const checked = event.target.checked;
        setFirstRowIsHeader(checked);

        if (file) {
            await loadPreview(file, checked);
        }
    };

    const toggleAllRows = (checked: boolean) => {
        if (!preview) {
            return;
        }

        setSelectedRows(checked ? preview.preview.map((_, index) => index) : []);
    };

    const toggleRow = (rowIndex: number) => {
        setSelectedRows((current) => (
            current.includes(rowIndex)
                ? current.filter((index) => index !== rowIndex)
                : [...current, rowIndex].sort((left, right) => left - right)
        ));
    };

    const handleImport = async () => {
        if (!file || !siteId) {
            setStatus({ type: 'error', message: t('equipmentImport.noFile') });
            return;
        }

        if (selectedRows.length === 0) {
            setStatus({ type: 'error', message: t('equipmentImport.noRowsSelected') });
            return;
        }

        const missing = EQUIPMENT_FIELDS.filter((field) => field.required && !mapping[field.key]).map((field) => t(field.labelKey));
        if (missing.length) {
            setStatus({ type: 'error', message: t('equipmentImport.missingRequired', { fields: missing.join(', ') }) });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mapping', JSON.stringify(mapping));
            formData.append('selected_rows', JSON.stringify(selectedRows));
            formData.append('mode', duplicateMode);
            formData.append('first_row_is_header', String(firstRowIsHeader));

            const { data } = await api.post<ImportResponse>(`/equipment/sites/${siteId}/import/confirm`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const summary = t('equipmentImport.importSummary', {
                imported: data.imported,
                skipped: data.skipped ?? 0,
                errors: data.errors,
            });

            setStatus({
                type: data.errors ? 'error' : 'success',
                message: data.rolled_back ? `${summary} ${t('equipmentImport.rolledBack')}` : summary,
            });
            await queryClient.invalidateQueries({ queryKey: ['site-equipment', siteId] });
        } catch (error: any) {
            setStatus({ type: 'error', message: error?.response?.data?.detail || t('equipmentImport.importError') });
        } finally {
            setLoading(false);
        }
    };

    if (!canManageEquipment) {
        return <Alert severity="warning">{t('equipmentImport.noPermission')}</Alert>;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="h4">{t('equipmentImport.title')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {site ? t('equipmentImport.subtitle', { site: `${site.site_code}${site.site_name ? ` - ${site.site_name}` : ''}` }) : t('equipmentImport.subtitleFallback')}
                    </Typography>
                </Box>
                <Button variant="text" onClick={() => navigate(`/clients/${clientId}/sites/${siteId}`)}>{t('common.back')}</Button>
            </Box>

            <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Typography variant="h6">{t('equipmentImport.optionsTitle')}</Typography>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant="contained" component="label">
                            {t('equipmentImport.upload')}
                            <input type="file" hidden accept=".csv,.xlsx,.xlsm" onChange={handleFileChange} />
                        </Button>
                        {file ? <Typography variant="body2">{t('equipmentImport.selectedFile')}: {file.name}</Typography> : null}
                    </Box>

                    <FormControlLabel
                        control={<Checkbox checked={firstRowIsHeader} onChange={handleHeaderToggle} />}
                        label={t('equipmentImport.firstRowHeader')}
                    />

                    <FormControl>
                        <FormLabel>{t('equipmentImport.duplicateStrategyTitle')}</FormLabel>
                        <RadioGroup
                            value={duplicateMode}
                            onChange={(event) => setDuplicateMode(event.target.value as ImportMode)}
                        >
                            <FormControlLabel value="upsert" control={<Radio />} label={t('equipmentImport.modeUpsert')} />
                            <FormControlLabel value="skip" control={<Radio />} label={t('equipmentImport.modeSkip')} />
                            <FormControlLabel value="error" control={<Radio />} label={t('equipmentImport.modeError')} />
                        </RadioGroup>
                    </FormControl>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="contained" onClick={handleImport} disabled={loading || previewLoading || !preview}>
                            {t('equipmentImport.import')}
                        </Button>
                    </Box>
                </Stack>
            </Paper>

            {status ? <Alert severity={status.type}>{status.message}</Alert> : null}
            {previewLoading ? <Alert severity="info">{t('equipmentImport.previewLoading')}</Alert> : null}

            {preview ? (
                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Typography variant="h6">{t('equipmentImport.previewTitle')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('equipmentImport.selectedRowsCount', {
                                selected: selectedRows.length,
                                total: totalPreviewRows,
                            })}
                        </Typography>
                    </Stack>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button variant="outlined" size="small" onClick={() => toggleAllRows(true)}>
                            {t('equipmentImport.selectAll')}
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => toggleAllRows(false)}>
                            {t('equipmentImport.clearSelection')}
                        </Button>
                    </Box>

                    <TableContainer sx={{ maxHeight: 560 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={allRowsSelected}
                                            indeterminate={partiallySelected}
                                            onChange={(event) => toggleAllRows(event.target.checked)}
                                        />
                                    </TableCell>
                                    <TableCell>#</TableCell>
                                    {preview.columns.map((column) => (
                                        <TableCell key={column}>{column}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {visibleRows.map((row, visibleIndex) => {
                                    const rowIndex = page * rowsPerPage + visibleIndex;
                                    return (
                                        <TableRow key={rowIndex} hover selected={selectedRowSet.has(rowIndex)}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedRowSet.has(rowIndex)}
                                                    onChange={() => toggleRow(rowIndex)}
                                                />
                                            </TableCell>
                                            <TableCell>{rowIndex + 1}</TableCell>
                                            {preview.columns.map((column) => (
                                                <TableCell key={column}>{String(row[column] ?? '')}</TableCell>
                                            ))}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        component="div"
                        count={totalPreviewRows}
                        page={page}
                        onPageChange={(_, nextPage) => setPage(nextPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(Number(event.target.value));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                    />

                    <Typography variant="h6">{t('equipmentImport.mappingTitle')}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
                        {EQUIPMENT_FIELDS.map((field) => (
                            <FormControl key={field.key} size="small">
                                <InputLabel>{t(field.labelKey)}{field.required ? ' *' : ''}</InputLabel>
                                <Select
                                    label={`${t(field.labelKey)}${field.required ? ' *' : ''}`}
                                    value={mapping[field.key] || ''}
                                    onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}
                                >
                                    <MenuItem value="">
                                        <em>{t('equipmentImport.noColumn')}</em>
                                    </MenuItem>
                                    {preview.columns.map((column) => (
                                        <MenuItem key={column} value={column}>{column}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ))}
                    </Box>
                </Paper>
            ) : null}
        </Box>
    );
};

export default EquipmentImport;
