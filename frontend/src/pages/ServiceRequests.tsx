import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import type { ReferenceBillingProject, ServiceRequestListItem } from '../types/serviceRequests';
import {
    getAppLocale,
    getBillingPaymentModeLabel,
    getBillingServiceTypeLabel,
    getRequestPriorityLabel,
    getRequestSourceLabel,
    getRequestStatusLabel,
    requestPriorityColors,
    requestPriorityValues,
    requestSourceValues,
    requestStatusColors,
    requestStatusValues,
} from '../utils/serviceRequestI18n';

interface Client {
    id: string;
    name: string;
    sites: Array<{
        id: string;
        site_code: string;
        site_name?: string | null;
    }>;
    billing_projects?: ReferenceBillingProject[];
}

interface UserOption {
    id: string;
    full_name?: string | null;
    email: string;
}

const emptyCreateForm = {
    client_id: '',
    site_id: '',
    billing_project_id: '',
    source: 'phone',
    external_order_number: '',
    reported_problem: '',
    request_reason_code: '',
    priority: 'standard',
    reported_at: new Date().toISOString().slice(0, 16),
    responsible_user_id: '',
    notes_internal: '',
    notes_client: '',
};

const ServiceRequests: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const locale = getAppLocale(i18n.resolvedLanguage);
    const canCreate = hasPermission(user, 'service_requests.create');
    const canReadAll = hasPermission(user, 'service_requests.read_all');
    const canReadAssigned = hasPermission(user, 'service_requests.read_assigned');
    const canReadUserOptions = hasAnyPermission(user, ['users.manage', 'service_requests.create', 'service_requests.assign']);

    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('');
    const [priorityFilter, setPriorityFilter] = React.useState('');
    const [clientFilter, setClientFilter] = React.useState('');
    const [createOpen, setCreateOpen] = React.useState(false);
    const [createError, setCreateError] = React.useState('');
    const [createForm, setCreateForm] = React.useState(emptyCreateForm);

    const { data: requests = [], isLoading } = useQuery<ServiceRequestListItem[]>({
        queryKey: ['service-requests', search, statusFilter, priorityFilter, clientFilter],
        enabled: canReadAll || canReadAssigned,
        queryFn: async () => {
            const { data } = await api.get('/service-requests', {
                params: {
                    search: search || undefined,
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    client_id: clientFilter || undefined,
                },
            });
            return data;
        },
    });

    const { data: clients = [] } = useQuery<Client[]>({
        queryKey: ['service-request-clients'],
        queryFn: async () => {
            const { data } = await api.get('/clients', { params: { limit: 500 } });
            return data;
        },
    });

    const { data: users = [] } = useQuery<UserOption[]>({
        queryKey: ['service-request-users'],
        enabled: canReadUserOptions,
        queryFn: async () => {
            const { data } = await api.get('/users', { params: { limit: 500 } });
            return data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                ...createForm,
                responsible_user_id: createForm.responsible_user_id || user?.id,
            };
            const { data } = await api.post('/service-requests', payload);
            return data;
        },
        onSuccess: (data) => {
            setCreateOpen(false);
            setCreateForm(emptyCreateForm);
            setCreateError('');
            queryClient.invalidateQueries({ queryKey: ['service-requests'] });
            navigate(`/service-requests/${data.id}`);
        },
        onError: (error: any) => {
            setCreateError(
                error?.response?.data?.detail ||
                t('serviceRequests.createDialog.createFailed', { defaultValue: 'Неуспешно създаване на сервизна заявка' }),
            );
        },
    });

    const selectedClient = React.useMemo(
        () => clients.find((client) => client.id === createForm.client_id),
        [clients, createForm.client_id],
    );

    const availableBillingProjects = React.useMemo(() => {
        if (!selectedClient || !createForm.site_id) return [];
        return (selectedClient.billing_projects || []).filter((project) => {
            if (!project.is_active) return false;
            return !project.site_id || project.site_id === createForm.site_id;
        });
    }, [selectedClient, createForm.site_id]);

    const assignableUsers = React.useMemo(() => {
        if (users.length > 0) return users;
        if (!user) return [];
        return [{ id: user.id, full_name: user.full_name, email: user.email }];
    }, [user, users]);

    const openCreateDialog = () => {
        setCreateForm({
            ...emptyCreateForm,
            responsible_user_id: user?.id || '',
        });
        setCreateError('');
        setCreateOpen(true);
    };

    const updateCreateField = (field: string, value: string) => {
        setCreateForm((current) => ({
            ...current,
            [field]: value,
            ...(field === 'client_id' ? { site_id: '', billing_project_id: '' } : {}),
            ...(field === 'site_id' ? { billing_project_id: '' } : {}),
        }));
    };

    React.useEffect(() => {
        if (!availableBillingProjects.length) return;
        if (createForm.billing_project_id && availableBillingProjects.some((project) => project.id === createForm.billing_project_id)) {
            return;
        }
        const suggestedProject =
            availableBillingProjects.find((project) => project.site_id === createForm.site_id && project.is_default) ||
            availableBillingProjects.find((project) => !project.site_id && project.is_default) ||
            availableBillingProjects[0];

        if (suggestedProject) {
            setCreateForm((current) => ({
                ...current,
                billing_project_id: suggestedProject.id,
            }));
        }
    }, [availableBillingProjects, createForm.billing_project_id, createForm.site_id]);

    return (
        <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {t('serviceRequests.title', { defaultValue: 'Сервизни заявки' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('serviceRequests.subtitle', {
                            defaultValue: 'Приемане, разпределяне, работа на техник и преглед на протокол.',
                        })}
                    </Typography>
                </Box>
                {canCreate && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                        {t('serviceRequests.newRequest', { defaultValue: 'Нова заявка' })}
                    </Button>
                )}
            </Box>

            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                    <TextField
                        size="small"
                        label={t('serviceRequests.filters.search', { defaultValue: 'Търсене' })}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={{ minWidth: 240, flex: 1 }}
                        InputProps={{
                            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>{t('serviceRequests.filters.status', { defaultValue: 'Статус' })}</InputLabel>
                        <Select
                            value={statusFilter}
                            label={t('serviceRequests.filters.status', { defaultValue: 'Статус' })}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allStatuses', { defaultValue: 'Всички статуси' })}</MenuItem>
                            {requestStatusValues.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {getRequestStatusLabel(t, value)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>{t('serviceRequests.filters.priority', { defaultValue: 'Приоритет' })}</InputLabel>
                        <Select
                            value={priorityFilter}
                            label={t('serviceRequests.filters.priority', { defaultValue: 'Приоритет' })}
                            onChange={(event) => setPriorityFilter(event.target.value)}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allPriorities', { defaultValue: 'Всички приоритети' })}</MenuItem>
                            {requestPriorityValues.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {getRequestPriorityLabel(t, value)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>{t('serviceRequests.filters.client', { defaultValue: 'Клиент' })}</InputLabel>
                        <Select
                            value={clientFilter}
                            label={t('serviceRequests.filters.client', { defaultValue: 'Клиент' })}
                            onChange={(event) => setClientFilter(event.target.value)}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allClients', { defaultValue: 'Всички клиенти' })}</MenuItem>
                            {clients.map((client) => (
                                <MenuItem key={client.id} value={client.id}>
                                    {client.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Paper>

            <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('serviceRequests.table.request', { defaultValue: 'Заявка' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.client', { defaultValue: 'Клиент' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.site', { defaultValue: 'Обект' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.priority', { defaultValue: 'Приоритет' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.status', { defaultValue: 'Статус' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.responsible', { defaultValue: 'Отговорник' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.technicians', { defaultValue: 'Техници' })}</TableCell>
                            <TableCell>{t('serviceRequests.table.received', { defaultValue: 'Получена' })}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!canReadAll && !canReadAssigned ? (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Alert severity="warning" variant="outlined">
                                        {t('serviceRequests.noPermission', {
                                            defaultValue: 'Текущият профил няма право да вижда сервизните заявки.',
                                        })}
                                    </Alert>
                                </TableCell>
                            </TableRow>
                        ) : isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8}>{t('common.loading')}</TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    {t('serviceRequests.noResults', { defaultValue: 'Няма намерени сервизни заявки.' })}
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.map((request) => (
                                <TableRow
                                    key={request.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/service-requests/${request.id}`)}
                                >
                                    <TableCell sx={{ fontWeight: 600 }}>{request.request_number}</TableCell>
                                    <TableCell>{request.client.name}</TableCell>
                                    <TableCell>{request.site.site_name || request.site.site_code}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            label={getRequestPriorityLabel(t, request.priority)}
                                            color={requestPriorityColors[request.priority] || 'default'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            label={getRequestStatusLabel(t, request.status)}
                                            color={requestStatusColors[request.status] || 'default'}
                                        />
                                    </TableCell>
                                    <TableCell>{request.responsible_user.full_name || request.responsible_user.email}</TableCell>
                                    <TableCell>{request.assigned_technicians.join(', ') || '-'}</TableCell>
                                    <TableCell>{new Date(request.reported_at).toLocaleString(locale)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>{t('serviceRequests.createDialog.title', { defaultValue: 'Създай сервизна заявка' })}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        {createError && <Alert severity="error">{createError}</Alert>}
                        <FormControl fullWidth size="small">
                            <InputLabel>{t('serviceRequests.createDialog.client', { defaultValue: 'Клиент' })}</InputLabel>
                            <Select
                                value={createForm.client_id}
                                label={t('serviceRequests.createDialog.client', { defaultValue: 'Клиент' })}
                                onChange={(event) => updateCreateField('client_id', event.target.value)}
                            >
                                {clients.map((client) => (
                                    <MenuItem key={client.id} value={client.id}>
                                        {client.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" disabled={!selectedClient}>
                            <InputLabel>{t('serviceRequests.createDialog.site', { defaultValue: 'Обект' })}</InputLabel>
                            <Select
                                value={createForm.site_id}
                                label={t('serviceRequests.createDialog.site', { defaultValue: 'Обект' })}
                                onChange={(event) => updateCreateField('site_id', event.target.value)}
                            >
                                {(selectedClient?.sites || []).map((site) => (
                                    <MenuItem key={site.id} value={site.id}>
                                        {site.site_code} {site.site_name ? `- ${site.site_name}` : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" disabled={!selectedClient || !createForm.site_id || availableBillingProjects.length === 0}>
                            <InputLabel>{t('serviceRequests.billing.project', { defaultValue: 'Проект за фактуриране и сервиз' })}</InputLabel>
                            <Select
                                value={createForm.billing_project_id}
                                label={t('serviceRequests.billing.project', { defaultValue: 'Проект за фактуриране и сервиз' })}
                                onChange={(event) => updateCreateField('billing_project_id', event.target.value)}
                            >
                                {availableBillingProjects.map((project) => (
                                    <MenuItem key={project.id} value={project.id}>
                                        {project.project_reference}
                                        {project.description ? ` - ${project.description}` : ''}
                                        {` (${getBillingServiceTypeLabel(t, project.service_type)} / ${getBillingPaymentModeLabel(t, project.payment_mode)})`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {selectedClient && createForm.site_id && availableBillingProjects.length === 0 && (
                            <Alert severity="warning">
                                {t('serviceRequests.billing.noProjects', {
                                    defaultValue: 'Няма добавени проекти за фактуриране и сервиз.',
                                })}
                            </Alert>
                        )}
                        {createForm.billing_project_id && (
                            <Alert severity="info" variant="outlined">
                                {(() => {
                                    const selectedProject = availableBillingProjects.find(
                                        (project) => project.id === createForm.billing_project_id,
                                    );
                                    if (!selectedProject) {
                                        return t('serviceRequests.billing.project', { defaultValue: 'Проект за фактуриране и сервиз' });
                                    }
                                    return `${selectedProject.project_reference} | ${getBillingServiceTypeLabel(t, selectedProject.service_type)} | ${getBillingPaymentModeLabel(t, selectedProject.payment_mode)}`;
                                })()}
                            </Alert>
                        )}
                        <TextField
                            size="small"
                            label={t('serviceRequests.createDialog.problem', { defaultValue: 'Описание на проблема' })}
                            multiline
                            minRows={3}
                            value={createForm.reported_problem}
                            onChange={(event) => updateCreateField('reported_problem', event.target.value)}
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('serviceRequests.createDialog.source', { defaultValue: 'Източник' })}</InputLabel>
                                <Select
                                    value={createForm.source}
                                    label={t('serviceRequests.createDialog.source', { defaultValue: 'Източник' })}
                                    onChange={(event) => updateCreateField('source', event.target.value)}
                                >
                                    {requestSourceValues.map((value) => (
                                        <MenuItem key={value} value={value}>
                                            {getRequestSourceLabel(t, value)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('serviceRequests.createDialog.priority', { defaultValue: 'Приоритет' })}</InputLabel>
                                <Select
                                    value={createForm.priority}
                                    label={t('serviceRequests.createDialog.priority', { defaultValue: 'Приоритет' })}
                                    onChange={(event) => updateCreateField('priority', event.target.value)}
                                >
                                    {requestPriorityValues.map((value) => (
                                        <MenuItem key={value} value={value}>
                                            {getRequestPriorityLabel(t, value)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                size="small"
                                label={t('serviceRequests.createDialog.externalOrderNumber', { defaultValue: 'Външен номер на поръчка' })}
                                fullWidth
                                value={createForm.external_order_number}
                                onChange={(event) => updateCreateField('external_order_number', event.target.value)}
                            />
                            <TextField
                                size="small"
                                label={t('serviceRequests.createDialog.reasonCode', { defaultValue: 'Код причина' })}
                                fullWidth
                                value={createForm.request_reason_code}
                                onChange={(event) => updateCreateField('request_reason_code', event.target.value)}
                            />
                        </Stack>
                        <TextField
                            size="small"
                            label={t('serviceRequests.createDialog.receivedAt', { defaultValue: 'Получена на' })}
                            type="datetime-local"
                            InputLabelProps={{ shrink: true }}
                            value={createForm.reported_at}
                            onChange={(event) => updateCreateField('reported_at', event.target.value)}
                        />
                        <FormControl fullWidth size="small">
                            <InputLabel>{t('serviceRequests.createDialog.responsibleUser', { defaultValue: 'Отговорен потребител' })}</InputLabel>
                            <Select
                                value={createForm.responsible_user_id}
                                label={t('serviceRequests.createDialog.responsibleUser', { defaultValue: 'Отговорен потребител' })}
                                onChange={(event) => updateCreateField('responsible_user_id', event.target.value)}
                            >
                                {assignableUsers.map((entry) => (
                                    <MenuItem key={entry.id} value={entry.id}>
                                        {entry.full_name || entry.email}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            size="small"
                            label={t('serviceRequests.createDialog.internalNotes', { defaultValue: 'Вътрешни бележки' })}
                            multiline
                            minRows={2}
                            value={createForm.notes_internal}
                            onChange={(event) => updateCreateField('notes_internal', event.target.value)}
                        />
                        <TextField
                            size="small"
                            label={t('serviceRequests.createDialog.clientNotes', { defaultValue: 'Бележки към клиента' })}
                            multiline
                            minRows={2}
                            value={createForm.notes_client}
                            onChange={(event) => updateCreateField('notes_client', event.target.value)}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>
                        {t('serviceRequests.createDialog.cancel', { defaultValue: 'Отказ' })}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => createMutation.mutate()}
                        disabled={
                            createMutation.isPending ||
                            !createForm.client_id ||
                            !createForm.site_id ||
                            !createForm.billing_project_id ||
                            !createForm.reported_problem
                        }
                    >
                        {t('serviceRequests.createDialog.create', { defaultValue: 'Създай' })}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};

export default ServiceRequests;
