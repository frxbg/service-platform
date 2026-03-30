import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Chip,
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
import { formatBgDateTime } from '../utils/dateTime';
import { hasPermission } from '../utils/permissions';
import type { ReferenceBillingProject, ServiceRequestListItem } from '../types/serviceRequests';
import {
    getRequestPriorityLabel,
    getRequestStatusLabel,
    requestPriorityColors,
    requestPriorityValues,
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

const ServiceRequests: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const canCreate = hasPermission(user, 'service_requests.create');
    const canReadAll = hasPermission(user, 'service_requests.read_all');
    const canReadAssigned = hasPermission(user, 'service_requests.read_assigned');

    const [search, setSearch] = React.useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = React.useState(searchParams.get('status') || '');
    const [priorityFilter, setPriorityFilter] = React.useState(searchParams.get('priority') || '');
    const [clientFilter, setClientFilter] = React.useState(searchParams.get('client_id') || '');
    const [siteFilter, setSiteFilter] = React.useState(searchParams.get('site_id') || '');

    const { data: requests = [], isLoading } = useQuery<ServiceRequestListItem[]>({
        queryKey: ['service-requests', search, statusFilter, priorityFilter, clientFilter, siteFilter],
        enabled: canReadAll || canReadAssigned,
        queryFn: async () => {
            const { data } = await api.get('/service-requests/', {
                params: {
                    search: search || undefined,
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    client_id: clientFilter || undefined,
                    site_id: siteFilter || undefined,
                },
            });
            return data;
        },
    });

    const { data: clients = [] } = useQuery<Client[]>({
        queryKey: ['service-request-clients'],
        queryFn: async () => {
            const { data } = await api.get('/clients/', { params: { limit: 500 } });
            return data;
        },
    });

    const selectedFilterClient = React.useMemo(
        () => clients.find((client) => client.id === clientFilter),
        [clients, clientFilter],
    );

    React.useEffect(() => {
        if (!selectedFilterClient) {
            if (siteFilter) {
                setSiteFilter('');
            }
            return;
        }

        if (siteFilter && !selectedFilterClient.sites.some((site) => site.id === siteFilter)) {
            setSiteFilter('');
        }
    }, [selectedFilterClient, siteFilter]);

    const openCreatePage = () => {
        const nextParams = new URLSearchParams();
        if (clientFilter) {
            nextParams.set('client_id', clientFilter);
        }
        if (siteFilter) {
            nextParams.set('site_id', siteFilter);
        }
        const suffix = nextParams.toString();
        navigate(suffix ? `/service-requests/new?${suffix}` : '/service-requests/new');
    };

    return (
        <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {t('serviceRequests.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('serviceRequests.subtitle')}
                    </Typography>
                </Box>
                {canCreate && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreatePage}>
                        {t('serviceRequests.newRequest')}
                    </Button>
                )}
            </Box>

            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                    <TextField
                        size="small"
                        label={t('serviceRequests.filters.search')}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={{ minWidth: 240, flex: 1 }}
                        InputProps={{
                            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>{t('serviceRequests.filters.status')}</InputLabel>
                        <Select
                            value={statusFilter}
                            label={t('serviceRequests.filters.status')}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allStatuses')}</MenuItem>
                            {requestStatusValues.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {getRequestStatusLabel(t, value)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>{t('serviceRequests.filters.priority')}</InputLabel>
                        <Select
                            value={priorityFilter}
                            label={t('serviceRequests.filters.priority')}
                            onChange={(event) => setPriorityFilter(event.target.value)}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allPriorities')}</MenuItem>
                            {requestPriorityValues.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {getRequestPriorityLabel(t, value)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>{t('serviceRequests.filters.client')}</InputLabel>
                        <Select
                            value={clientFilter}
                            label={t('serviceRequests.filters.client')}
                            onChange={(event) => {
                                setClientFilter(event.target.value);
                                setSiteFilter('');
                            }}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allClients')}</MenuItem>
                            {clients.map((client) => (
                                <MenuItem key={client.id} value={client.id}>
                                    {client.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 220 }} disabled={!selectedFilterClient}>
                        <InputLabel>{t('serviceRequests.filters.site')}</InputLabel>
                        <Select
                            value={siteFilter}
                            label={t('serviceRequests.filters.site')}
                            onChange={(event) => setSiteFilter(event.target.value)}
                        >
                            <MenuItem value="">{t('serviceRequests.filters.allSites')}</MenuItem>
                            {(selectedFilterClient?.sites || []).map((site) => (
                                <MenuItem key={site.id} value={site.id}>
                                    {site.site_code} {site.site_name ? `- ${site.site_name}` : ''}
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
                            <TableCell>{t('serviceRequests.table.request')}</TableCell>
                            <TableCell>{t('serviceRequests.table.client')}</TableCell>
                            <TableCell>{t('serviceRequests.table.site')}</TableCell>
                            <TableCell>{t('serviceRequests.table.priority')}</TableCell>
                            <TableCell>{t('serviceRequests.table.status')}</TableCell>
                            <TableCell>{t('serviceRequests.table.responsible')}</TableCell>
                            <TableCell>{t('serviceRequests.table.technicians')}</TableCell>
                            <TableCell>{t('serviceRequests.table.received')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!canReadAll && !canReadAssigned ? (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Alert severity="warning" variant="outlined">
                                        {t('serviceRequests.noPermission')}
                                    </Alert>
                                </TableCell>
                            </TableRow>
                        ) : isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8}>{t('common.loading')}</TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8}>{t('serviceRequests.noResults')}</TableCell>
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
                                    <TableCell>{formatBgDateTime(request.reported_at)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Stack>
    );
};

export default ServiceRequests;
