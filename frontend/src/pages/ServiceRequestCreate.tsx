import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { toLocalDateTimeInputValue } from '../utils/dateTime';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import type { ReferenceBillingProject } from '../types/serviceRequests';
import {
    getBillingPaymentModeLabel,
    getBillingServiceTypeLabel,
    getRequestPriorityLabel,
    getRequestSourceLabel,
    requestPriorityValues,
    requestSourceValues,
} from '../utils/serviceRequestI18n';

interface ClientSiteOption {
    id: string;
    site_code: string;
    site_name?: string | null;
    address?: string | null;
}

interface ClientOption {
    id: string;
    name: string;
    sites: ClientSiteOption[];
    billing_projects?: ReferenceBillingProject[];
}

interface UserOption {
    id: string;
    full_name?: string | null;
    email: string;
}

const createEmptyForm = () => ({
    client_id: '',
    site_id: '',
    billing_project_id: '',
    source: 'phone',
    external_order_number: '',
    reported_problem: '',
    request_reason_code: '',
    priority: 'standard',
    reported_at: toLocalDateTimeInputValue(new Date()),
    responsible_user_id: '',
    notes_internal: '',
    notes_client: '',
});

const ServiceRequestCreate: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canCreate = hasPermission(user, 'service_requests.create');
    const canReadUserOptions = hasAnyPermission(user, ['users.manage', 'service_requests.create', 'service_requests.assign']);
    const [createError, setCreateError] = React.useState('');
    const [form, setForm] = React.useState({
        ...createEmptyForm(),
        client_id: searchParams.get('client_id') || '',
        site_id: searchParams.get('site_id') || '',
        responsible_user_id: user?.id || '',
    });

    const { data: clients = [] } = useQuery<ClientOption[]>({
        queryKey: ['service-request-clients'],
        enabled: canCreate,
        queryFn: async () => (await api.get('/clients/', { params: { limit: 500 } })).data,
    });

    const { data: users = [] } = useQuery<UserOption[]>({
        queryKey: ['service-request-users'],
        enabled: canReadUserOptions,
        queryFn: async () => (await api.get('/users/', { params: { limit: 500 } })).data,
    });

    const selectedClient = React.useMemo(
        () => clients.find((client) => client.id === form.client_id) || null,
        [clients, form.client_id],
    );

    const selectedSite = React.useMemo(
        () => selectedClient?.sites.find((site) => site.id === form.site_id) || null,
        [selectedClient, form.site_id],
    );

    const availableBillingProjects = React.useMemo(() => {
        if (!selectedClient || !form.site_id) {
            return [];
        }
        return (selectedClient.billing_projects || []).filter((project) => {
            if (!project.is_active) {
                return false;
            }
            return !project.site_id || project.site_id === form.site_id;
        });
    }, [selectedClient, form.site_id]);

    const selectedBillingProject = React.useMemo(
        () => availableBillingProjects.find((project) => project.id === form.billing_project_id) || null,
        [availableBillingProjects, form.billing_project_id],
    );

    const responsibleOptions = React.useMemo(() => {
        if (users.length > 0) {
            return users;
        }
        if (!user) {
            return [];
        }
        return [{ id: user.id, full_name: user.full_name, email: user.email }];
    }, [user, users]);

    const selectedResponsible = React.useMemo(
        () => responsibleOptions.find((entry) => entry.id === form.responsible_user_id) || null,
        [responsibleOptions, form.responsible_user_id],
    );

    React.useEffect(() => {
        if (!selectedClient) {
            if (form.site_id || form.billing_project_id) {
                setForm((current) => ({
                    ...current,
                    site_id: '',
                    billing_project_id: '',
                }));
            }
            return;
        }

        if (form.site_id && !selectedClient.sites.some((site) => site.id === form.site_id)) {
            setForm((current) => ({
                ...current,
                site_id: '',
                billing_project_id: '',
            }));
        }
    }, [selectedClient, form.site_id, form.billing_project_id]);

    React.useEffect(() => {
        if (!availableBillingProjects.length) {
            if (form.billing_project_id) {
                setForm((current) => ({ ...current, billing_project_id: '' }));
            }
            return;
        }

        if (form.billing_project_id && availableBillingProjects.some((project) => project.id === form.billing_project_id)) {
            return;
        }

        const suggestedProject =
            availableBillingProjects.find((project) => project.site_id === form.site_id && project.is_default) ||
            availableBillingProjects.find((project) => !project.site_id && project.is_default) ||
            availableBillingProjects[0];

        if (suggestedProject) {
            setForm((current) => ({ ...current, billing_project_id: suggestedProject.id }));
        }
    }, [availableBillingProjects, form.billing_project_id, form.site_id]);

    const createMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                ...form,
                billing_project_id: form.billing_project_id || null,
                responsible_user_id: form.responsible_user_id || user?.id || null,
            };
            const { data } = await api.post('/service-requests/', payload);
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['service-requests'] });
            navigate(`/service-requests/${data.id}`);
        },
        onError: (error: any) => {
            setCreateError(error?.response?.data?.detail || t('serviceRequests.createDialog.createFailed'));
        },
    });

    if (!canCreate) {
        return <Alert severity="warning">{t('serviceRequests.noPermission')}</Alert>;
    }

    return (
        <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {t('serviceRequests.createPage.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('serviceRequests.createPage.subtitle')}
                    </Typography>
                </Box>
                <Button variant="text" onClick={() => navigate('/service-requests')}>
                    {t('serviceRequests.createPage.backToList')}
                </Button>
            </Box>

            {createError && <Alert severity="error">{createError}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 2fr) 360px' }, gap: 3 }}>
                <Card>
                    <CardContent>
                        <Stack spacing={2.5}>
                            <Autocomplete
                                options={clients}
                                value={selectedClient}
                                onChange={(_event, value) => {
                                    setForm((current) => ({
                                        ...current,
                                        client_id: value?.id || '',
                                        site_id: '',
                                        billing_project_id: '',
                                    }));
                                }}
                                getOptionLabel={(option) => option.name}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t('serviceRequests.createDialog.client')}
                                        placeholder={t('serviceRequests.createPage.searchClient')}
                                    />
                                )}
                            />

                            <Autocomplete
                                options={selectedClient?.sites || []}
                                value={selectedSite}
                                onChange={(_event, value) => {
                                    setForm((current) => ({
                                        ...current,
                                        site_id: value?.id || '',
                                        billing_project_id: '',
                                    }));
                                }}
                                disabled={!selectedClient}
                                getOptionLabel={(option) =>
                                    `${option.site_code}${option.site_name ? ` - ${option.site_name}` : ''}`
                                }
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t('serviceRequests.createDialog.site')}
                                        placeholder={t('serviceRequests.createPage.searchSite')}
                                    />
                                )}
                            />

                            <Autocomplete
                                options={availableBillingProjects}
                                value={selectedBillingProject}
                                onChange={(_event, value) => {
                                    setForm((current) => ({
                                        ...current,
                                        billing_project_id: value?.id || '',
                                    }));
                                }}
                                disabled={!selectedSite}
                                getOptionLabel={(option) =>
                                    `${option.project_reference}${option.description ? ` - ${option.description}` : ''}`
                                }
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t('serviceRequests.billing.project')}
                                        placeholder={t('serviceRequests.createPage.searchBillingProject')}
                                    />
                                )}
                            />

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    select
                                    fullWidth
                                    label={t('serviceRequests.createDialog.source')}
                                    value={form.source}
                                    onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                                >
                                    {requestSourceValues.map((value) => (
                                        <MenuItem key={value} value={value}>
                                            {getRequestSourceLabel(t, value)}
                                        </MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    select
                                    fullWidth
                                    label={t('serviceRequests.createDialog.priority')}
                                    value={form.priority}
                                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                                >
                                    {requestPriorityValues.map((value) => (
                                        <MenuItem key={value} value={value}>
                                            {getRequestPriorityLabel(t, value)}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    fullWidth
                                    label={t('serviceRequests.createDialog.externalOrderNumber')}
                                    value={form.external_order_number}
                                    onChange={(event) => setForm((current) => ({ ...current, external_order_number: event.target.value }))}
                                />
                                <TextField
                                    fullWidth
                                    label={t('serviceRequests.createDialog.reasonCode')}
                                    value={form.request_reason_code}
                                    onChange={(event) => setForm((current) => ({ ...current, request_reason_code: event.target.value }))}
                                />
                            </Stack>

                            <TextField
                                type="datetime-local"
                                InputLabelProps={{ shrink: true }}
                                label={t('serviceRequests.createDialog.receivedAt')}
                                value={form.reported_at}
                                onChange={(event) => setForm((current) => ({ ...current, reported_at: event.target.value }))}
                            />

                            <Autocomplete
                                options={responsibleOptions}
                                value={selectedResponsible}
                                onChange={(_event, value) => {
                                    setForm((current) => ({
                                        ...current,
                                        responsible_user_id: value?.id || '',
                                    }));
                                }}
                                getOptionLabel={(option) => option.full_name || option.email}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t('serviceRequests.createDialog.responsibleUser')}
                                        placeholder={t('serviceRequests.createPage.searchResponsible')}
                                    />
                                )}
                            />

                            <TextField
                                label={t('serviceRequests.createDialog.problem')}
                                multiline
                                minRows={4}
                                value={form.reported_problem}
                                onChange={(event) => setForm((current) => ({ ...current, reported_problem: event.target.value }))}
                            />

                            <TextField
                                label={t('serviceRequests.createDialog.internalNotes')}
                                multiline
                                minRows={3}
                                value={form.notes_internal}
                                onChange={(event) => setForm((current) => ({ ...current, notes_internal: event.target.value }))}
                            />

                            <TextField
                                label={t('serviceRequests.createDialog.clientNotes')}
                                multiline
                                minRows={3}
                                value={form.notes_client}
                                onChange={(event) => setForm((current) => ({ ...current, notes_client: event.target.value }))}
                            />
                        </Stack>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">{t('serviceRequests.createPage.summaryTitle')}</Typography>
                            <Box>
                                <Typography variant="subtitle2">{t('serviceRequests.createDialog.client')}</Typography>
                                <Typography color="text.secondary">{selectedClient?.name || '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2">{t('serviceRequests.createDialog.site')}</Typography>
                                <Typography color="text.secondary">
                                    {selectedSite ? `${selectedSite.site_code}${selectedSite.site_name ? ` - ${selectedSite.site_name}` : ''}` : '-'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2">{t('serviceRequests.billing.project')}</Typography>
                                <Typography color="text.secondary">
                                    {selectedBillingProject?.project_reference || t('serviceRequests.billing.assignLater')}
                                </Typography>
                            </Box>
                            {selectedBillingProject && (
                                <Alert severity="info" variant="outlined">
                                    {`${getBillingServiceTypeLabel(t, selectedBillingProject.service_type)} / ${getBillingPaymentModeLabel(t, selectedBillingProject.payment_mode)}`}
                                </Alert>
                            )}
                            <Box>
                                <Typography variant="subtitle2">{t('serviceRequests.createDialog.responsibleUser')}</Typography>
                                <Typography color="text.secondary">
                                    {selectedResponsible?.full_name || selectedResponsible?.email || '-'}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip size="small" label={getRequestSourceLabel(t, form.source)} />
                                <Chip size="small" color="primary" label={getRequestPriorityLabel(t, form.priority)} />
                            </Stack>
                            {!selectedClient || !selectedSite || !form.reported_problem ? (
                                <Alert severity="warning" variant="outlined">
                                    {t('serviceRequests.createPage.requiredHint')}
                                </Alert>
                            ) : null}
                            <Box sx={{ pt: 1 }}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => createMutation.mutate()}
                                    disabled={createMutation.isPending || !selectedClient || !selectedSite || !form.reported_problem}
                                >
                                    {t('serviceRequests.createDialog.create')}
                                </Button>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </Stack>
    );
};

export default ServiceRequestCreate;
