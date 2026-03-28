import React, { useMemo, useState } from 'react';
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
    TextField,
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
    rolled_back?: boolean;
}

type ImportMode = 'upsert' | 'skip' | 'rename' | 'error';

const MATERIAL_FIELDS = [
    { key: 'erp_code', label: 'ERP код', required: true },
    { key: 'name', label: 'Име', required: true },
    { key: 'unit', label: 'Мярка', required: true },
    { key: 'cost', label: 'Себестойност', required: true },
    { key: 'cost_currency', label: 'Валута', required: false },
    { key: 'barcode', label: 'Баркод', required: false },
    { key: 'description', label: 'Описание', required: false },
    { key: 'category', label: 'Категория', required: false },
    { key: 'subcategory', label: 'Подкатегория', required: false },
    { key: 'default_margin_percent', label: 'Марж % (ако няма глобален)', required: false },
];

const MaterialImport: React.FC = () => {
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [globalMargin, setGlobalMargin] = useState<string>('');
    const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
    const [duplicateMode, setDuplicateMode] = useState<ImportMode>('upsert');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

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

            const { data } = await api.post<PreviewResponse>('/materials/import/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPreview(data);
            setMapping({});
            setSelectedRows(data.preview.map((_, index) => index));
        } catch (error: any) {
            setStatus({
                type: 'error',
                message: error?.response?.data?.detail || 'Неуспешно зареждане на файла',
            });
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
            setStatus({ type: 'error', message: 'Моля качете файл.' });
            return;
        }

        if (selectedRows.length === 0) {
            setStatus({ type: 'error', message: 'Изберете поне един ред за импортиране.' });
            return;
        }

        const missing = MATERIAL_FIELDS.filter((field) => field.required && !mapping[field.key]).map((field) => field.label);
        if (missing.length) {
            setStatus({ type: 'error', message: `Липсва съпоставяне за: ${missing.join(', ')}` });
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

            if (globalMargin.trim() !== '') {
                formData.append('default_margin_percent', globalMargin);
            }

            const { data } = await api.post<ImportResponse>('/materials/import/confirm', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const summary = [
                `Импортирани/обновени: ${data.imported}`,
                `Пропуснати: ${data.skipped ?? 0}`,
                `Грешки: ${data.errors}`,
            ].join(', ');

            setStatus({
                type: data.errors ? 'error' : 'success',
                message: data.rolled_back ? `${summary}. Импортът е спрян и промените са върнати.` : summary,
            });
        } catch (error: any) {
            setStatus({ type: 'error', message: error?.response?.data?.detail || 'Импортът се провали' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4">Импорт на материали</Typography>
                <Button variant="text" onClick={() => navigate(-1)}>Назад</Button>
            </Box>

            <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Typography variant="h6">Опции за импортиране</Typography>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant="contained" component="label">
                            Качи CSV/XLSX
                            <input type="file" hidden accept=".csv,.xlsx,.xlsm" onChange={handleFileChange} />
                        </Button>
                        {file && <Typography variant="body2">Избран файл: {file.name}</Typography>}
                    </Box>

                    <FormControlLabel
                        control={<Checkbox checked={firstRowIsHeader} onChange={handleHeaderToggle} />}
                        label="Първият ред е заглавие"
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2 }}>
                        <FormControl>
                            <FormLabel>Действие при съществуващ ERP код</FormLabel>
                            <RadioGroup
                                value={duplicateMode}
                                onChange={(event) => setDuplicateMode(event.target.value as ImportMode)}
                            >
                                <FormControlLabel value="skip" control={<Radio />} label="Пропусни съществуващите записи" />
                                <FormControlLabel value="upsert" control={<Radio />} label="Обнови съществуващите записи" />
                                <FormControlLabel value="rename" control={<Radio />} label="Създай нов запис с import_ код" />
                                <FormControlLabel value="error" control={<Radio />} label="Спри с грешка и върни всички промени" />
                            </RadioGroup>
                        </FormControl>

                        <TextField
                            label="Глобален марж % (по избор)"
                            type="number"
                            size="small"
                            value={globalMargin}
                            onChange={(event) => setGlobalMargin(event.target.value)}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="contained" onClick={handleImport} disabled={loading || previewLoading || !preview}>
                            Импорт
                        </Button>
                    </Box>
                </Stack>
            </Paper>

            {status && <Alert severity={status.type}>{status.message}</Alert>}

            {previewLoading && <Alert severity="info">Зареждане на предварителен преглед...</Alert>}

            {preview && (
                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Typography variant="h6">Преглед на данните</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Избрани редове: {selectedRows.length} / {totalPreviewRows}
                        </Typography>
                    </Stack>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button variant="outlined" size="small" onClick={() => toggleAllRows(true)}>
                            Избери всички
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => toggleAllRows(false)}>
                            Изчисти избора
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

                    <Typography variant="h6">Съпоставяне на полетата</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
                        {MATERIAL_FIELDS.map((field) => (
                            <FormControl key={field.key} size="small">
                                <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                                <Select
                                    label={`${field.label}${field.required ? ' *' : ''}`}
                                    value={mapping[field.key] || ''}
                                    onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}
                                >
                                    <MenuItem value="">
                                        <em>Не е избрано</em>
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

export default MaterialImport;
