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
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface PreviewResponse {
    columns: string[];
    preview: Record<string, unknown>[];
    total_rows?: number;
}

interface ImportResponse {
    imported: number;
    skipped?: number;
    errors: number;
    sites_imported?: number;
    rolled_back?: boolean;
}

type ClientField = { key: string; labelKey?: string; label?: string; required: boolean };
type ImportMode = 'upsert' | 'skip' | 'rename' | 'error';

const CLIENT_FIELDS: ClientField[] = [
    { key: 'name', labelKey: 'client.name', required: true },
    { key: 'client_number', labelKey: 'client.clientNumber', required: false },
    { key: 'project_number', labelKey: 'client.projectNumber', required: false },
    { key: 'vat_number', labelKey: 'client.vat', required: false },
    { key: 'address', labelKey: 'client.address', required: false },
    { key: 'city', labelKey: 'client.city', required: false },
    { key: 'country', labelKey: 'client.country', required: false },
    { key: 'email', labelKey: 'client.email', required: false },
    { key: 'phone', labelKey: 'client.phone', required: false },
    { key: 'notes', labelKey: 'client.notes', required: false },
    { key: 'site_code', labelKey: 'client.siteCode', required: false },
    { key: 'site_name', labelKey: 'client.siteName', required: false },
    { key: 'site_city', labelKey: 'client.siteCity', required: false },
    { key: 'site_address', labelKey: 'client.siteAddress', required: false },
];

const ClientImport: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
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

    const getLabel = (field: ClientField) => (field.labelKey ? t(field.labelKey) : (field.label || field.key));
    const selectedRowSet = useMemo(() => new Set(selectedRows), [selectedRows]);
    const totalPreviewRows = preview?.preview.length ?? 0;
    const allRowsSelected = totalPreviewRows > 0 && selectedRows.length === totalPreviewRows;
    const partiallySelected = selectedRows.length > 0 && selectedRows.length < totalPreviewRows;
    const visibleRows = useMemo(
        () => preview?.preview.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) ?? [],
        [page, preview, rowsPerPage],
    );

    const loadPreview = async (selectedFile: File, headerMode: boolean) => {
        setPreviewLoading(true);
        setStatus(null);
        setPreview(null);
        setSelectedRows([]);
        setPage(0);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('first_row_is_header', String(headerMode));

            const { data } = await api.post<PreviewResponse>('/clients/import/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPreview(data);
            setMapping({});
            setSelectedRows(data.preview.map((_, index) => index));
        } catch (error: any) {
            setStatus({ type: 'error', message: error?.response?.data?.detail || t('clientImport.previewError') });
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
        if (!file) {
            setStatus({ type: 'error', message: t('clientImport.noFile') });
            return;
        }

        if (selectedRows.length === 0) {
            setStatus({ type: 'error', message: t('clientImport.noRowsSelected') });
            return;
        }

        const missing = CLIENT_FIELDS.filter((field) => field.required && !mapping[field.key]).map((field) => getLabel(field));
        if (missing.length) {
            setStatus({ type: 'error', message: t('clientImport.missingRequired', { fields: missing.join(', ') }) });
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

            const { data } = await api.post<ImportResponse>('/clients/import/confirm', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const summary = t('clientImport.importSummary', {
                imported: data.imported,
                errors: data.errors,
                sites: data.sites_imported ?? 0,
                skipped: data.skipped ?? 0,
            });

            setStatus({
                type: data.errors ? 'error' : 'success',
                message: data.rolled_back ? `${summary} ${t('clientImport.rolledBack')}` : summary,
            });
        } catch (error: any) {
            setStatus({ type: 'error', message: error?.response?.data?.detail || t('clientImport.importError') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4">{t('clientImport.title')}</Typography>
                <Button variant="text" onClick={() => navigate(-1)}>{t('common.back')}</Button>
            </Box>

            <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Typography variant="h6">{t('clientImport.optionsTitle')}</Typography>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant="contained" component="label">
                            {t('clientImport.upload')}
                            <input type="file" hidden accept=".csv,.xlsx,.xlsm" onChange={handleFileChange} />
                        </Button>
                        {file && <Typography variant="body2">{t('clientImport.selectedFile')}: {file.name}</Typography>}
                    </Box>

                    <FormControlLabel
                        control={<Checkbox checked={firstRowIsHeader} onChange={handleHeaderToggle} />}
                        label={t('clientImport.firstRowHeader')}
                    />

                    <FormControl>
                        <FormLabel>{t('clientImport.duplicateStrategyTitle')}</FormLabel>
                        <RadioGroup
                            value={duplicateMode}
                            onChange={(event) => setDuplicateMode(event.target.value as ImportMode)}
                        >
                            <FormControlLabel value="skip" control={<Radio />} label={t('clientImport.modeSkip')} />
                            <FormControlLabel value="upsert" control={<Radio />} label={t('clientImport.modeUpsert')} />
                            <FormControlLabel value="rename" control={<Radio />} label={t('clientImport.modeRename')} />
                            <FormControlLabel value="error" control={<Radio />} label={t('clientImport.modeError')} />
                        </RadioGroup>
                    </FormControl>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="contained" onClick={handleImport} disabled={loading || previewLoading || !preview}>
                            {t('clientImport.import')}
                        </Button>
                    </Box>
                </Stack>
            </Paper>

            {status && <Alert severity={status.type}>{status.message}</Alert>}

            {previewLoading && <Alert severity="info">{t('clientImport.previewLoading')}</Alert>}

            {preview && (
                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Typography variant="h6">{t('clientImport.previewTitle')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('clientImport.selectedRowsCount', {
                                selected: selectedRows.length,
                                total: totalPreviewRows,
                            })}
                        </Typography>
                    </Stack>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button variant="outlined" size="small" onClick={() => toggleAllRows(true)}>
                            {t('clientImport.selectAll')}
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => toggleAllRows(false)}>
                            {t('clientImport.clearSelection')}
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

                    <Typography variant="h6">{t('clientImport.mappingTitle')}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
                        {CLIENT_FIELDS.map((field) => (
                            <FormControl key={field.key} size="small">
                                <InputLabel>{getLabel(field)}{field.required ? ' *' : ''}</InputLabel>
                                <Select
                                    label={`${getLabel(field)}${field.required ? ' *' : ''}`}
                                    value={mapping[field.key] || ''}
                                    onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}
                                >
                                    <MenuItem value="">
                                        <em>{t('clientImport.noColumn')}</em>
                                    </MenuItem>
                                    {preview.columns.map((column) => (
                                        <MenuItem key={column} value={column}>{column}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ))}
                    </Box>
                </Paper>
            )}
        </Box>
    );
};

export default ClientImport;
