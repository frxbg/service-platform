import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Paper,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatBgDateTime } from '../utils/dateTime';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import type { EquipmentAsset, ReferenceBillingProject, ServiceRequestListItem } from '../types/serviceRequests';
import {
    getBillingPaymentModeLabel,
    getBillingServiceTypeLabel,
    getRequestPriorityLabel,
    getRequestStatusLabel,
    requestPriorityColors,
    requestStatusColors,
} from '../utils/serviceRequestI18n';

interface ClientSite {
    id: string;
    site_code: string;
    site_name?: string;
    city?: string;
    address?: string;
    project_number?: string;
    notes?: string;
}

interface Client {
    id: string;
    name: string;
    client_number?: string;
    sites?: ClientSite[];
    billing_projects?: ReferenceBillingProject[];
}

type EquipmentFormValues = {
    equipment_type: string;
    manufacturer: string;
    model: string;
    serial_number: string;
    asset_tag: string;
    location_note: string;
    refrigerant: string;
    notes: string;
    is_active: boolean;
};

const emptyEquipmentForm: EquipmentFormValues = {
    equipment_type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    location_note: '',
    refrigerant: '',
    notes: '',
    is_active: true,
};

const SiteDetails: React.FC = () => {
    const { clientId, siteId } = useParams<{ clientId: string; siteId: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canCreateRequest = hasPermission(user, 'service_requests.create');
    const canReadRequests = hasAnyPermission(user, ['service_requests.read_all', 'service_requests.read_assigned']);
    const canManageEquipment = hasPermission(user, 'equipment.manage');
    const [equipmentDialogOpen, setEquipmentDialogOpen] = React.useState(false);
    const [editingEquipment, setEditingEquipment] = React.useState<EquipmentAsset | null>(null);
    const [equipmentForm, setEquipmentForm] = React.useState<EquipmentFormValues>(emptyEquipmentForm);
    const [equipmentFeedback, setEquipmentFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
        queryKey: ['client', clientId],
        enabled: Boolean(clientId),
        queryFn: async () => (await api.get(`/clients/${clientId}`)).data,
    });

    const { data: equipment = [], isLoading: isLoadingEquipment, error: equipmentError } = useQuery<EquipmentAsset[]>({
        queryKey: ['site-equipment', siteId],
        enabled: Boolean(siteId),
        queryFn: async () => (await api.get(`/equipment/sites/${siteId}`)).data,
    });

    const { data: siteRequests = [], isLoading: isLoadingRequests } = useQuery<ServiceRequestListItem[]>({
        queryKey: ['site-service-requests', clientId, siteId],
        enabled: Boolean(clientId && siteId && canReadRequests),
        queryFn: async () => (
            await api.get('/service-requests/', {
                params: {
                    client_id: clientId,
                    site_id: siteId,
                },
            })
        ).data,
    });

    const site = React.useMemo(
        () => client?.sites?.find((entry) => entry.id === siteId) || null,
        [client, siteId],
    );

    const relatedBillingProjects = React.useMemo(() => {
        if (!client?.billing_projects) {
            return [];
        }
        return client.billing_projects.filter((project) => !project.site_id || project.site_id === siteId);
    }, [client?.billing_projects, siteId]);

    const currentRequests = React.useMemo(
        () => siteRequests.filter((request) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(request.status)),
        [siteRequests],
    );

    const recentRequests = React.useMemo(
        () => siteRequests.filter((request) => ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(request.status)),
        [siteRequests],
    );

    const activeEquipmentCount = React.useMemo(
        () => equipment.filter((asset) => asset.is_active).length,
        [equipment],
    );

    const upsertEquipmentMutation = useMutation({
        mutationFn: async () => {
            if (!siteId) {
                throw new Error('Missing site id');
            }
            if (!equipmentForm.equipment_type.trim()) {
                throw new Error(t('client.equipmentTypeRequired'));
            }

            const payload = {
                ...equipmentForm,
                equipment_type: equipmentForm.equipment_type.trim(),
                manufacturer: equipmentForm.manufacturer || null,
                model: equipmentForm.model || null,
                serial_number: equipmentForm.serial_number || null,
                asset_tag: equipmentForm.asset_tag || null,
                location_note: equipmentForm.location_note || null,
                refrigerant: equipmentForm.refrigerant || null,
                notes: equipmentForm.notes || null,
            };

            if (editingEquipment) {
                const { data } = await api.patch(`/equipment/${editingEquipment.id}`, payload);
                return data;
            }

            const { data } = await api.post(`/equipment/sites/${siteId}`, payload);
            return data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['site-equipment', siteId] });
            setEquipmentDialogOpen(false);
            setEditingEquipment(null);
            setEquipmentForm(emptyEquipmentForm);
            setEquipmentFeedback({ type: 'success', message: t('client.equipmentSaved') });
        },
        onError: (error: any) => {
            setEquipmentFeedback({
                type: 'error',
                message: error?.response?.data?.detail || error?.message || t('client.equipmentSaveFailed'),
            });
        },
    });

    const openNewRequest = () => {
        if (!client || !site) {
            return;
        }
        navigate(`/service-requests/new?client_id=${client.id}&site_id=${site.id}`);
    };

    const handleOpenNewEquipment = () => {
        setEditingEquipment(null);
        setEquipmentForm(emptyEquipmentForm);
        setEquipmentFeedback(null);
        setEquipmentDialogOpen(true);
    };

    const handleOpenEditEquipment = (asset: EquipmentAsset) => {
        setEditingEquipment(asset);
        setEquipmentForm({
            equipment_type: asset.equipment_type || '',
            manufacturer: asset.manufacturer || '',
            model: asset.model || '',
            serial_number: asset.serial_number || '',
            asset_tag: asset.asset_tag || '',
            location_note: asset.location_note || '',
            refrigerant: asset.refrigerant || '',
            notes: asset.notes || '',
            is_active: asset.is_active,
        });
        setEquipmentFeedback(null);
        setEquipmentDialogOpen(true);
    };

    const renderEquipmentSubtitle = (asset: EquipmentAsset) => {
        const details = [asset.manufacturer, asset.model].filter(Boolean).join(' / ');
        if (details) {
            return details;
        }
        if (asset.serial_number || asset.asset_tag) {
            return [asset.serial_number, asset.asset_tag].filter(Boolean).join(' / ');
        }
        return '-';
    };

    if (isLoadingClient || !client) {
        return <Typography>{t('common.loading')}</Typography>;
    }

    if (!site) {
        return <Alert severity="error">{t('client.siteNotFound')}</Alert>;
    }

    return (
        <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {site.site_code}
                        {site.site_name ? ` - ${site.site_name}` : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {client.name}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
                    <Button variant="text" onClick={() => navigate(`/clients/${client.id}`)}>
                        {t('client.backToClient')}
                    </Button>
                    {canCreateRequest ? (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={openNewRequest}>
                            {t('serviceRequests.newRequest')}
                        </Button>
                    ) : null}
                </Stack>
            </Box>

            <Card>
                <CardContent>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2">{t('client.siteCity')}</Typography>
                            <Typography>{site.city || '-'}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2">{t('client.siteAddress')}</Typography>
                            <Typography>{site.address || '-'}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2">{t('client.projectNumber')}</Typography>
                            <Typography>{site.project_number || '-'}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2">{t('client.notes')}</Typography>
                            <Typography>{site.notes || '-'}</Typography>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                            <Typography variant="h6">{t('client.equipment')}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('client.siteEquipmentHint')}
                            </Typography>
                        </Box>
                        {canManageEquipment ? (
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => navigate(`/clients/${client.id}/sites/${site.id}/equipment/import`)}>
                                    {t('client.importEquipment')}
                                </Button>
                                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNewEquipment}>
                                    {t('client.addEquipment')}
                                </Button>
                            </Stack>
                        ) : null}
                    </Box>

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={t('client.equipmentCount', { count: equipment.length })} />
                        <Chip size="small" color={activeEquipmentCount > 0 ? 'success' : 'default'} label={t('client.activeEquipmentCount', { count: activeEquipmentCount })} />
                    </Stack>

                    {equipmentFeedback ? <Alert severity={equipmentFeedback.type}>{equipmentFeedback.message}</Alert> : null}

                    {isLoadingEquipment ? (
                        <Typography color="text.secondary">{t('common.loading')}</Typography>
                    ) : equipmentError ? (
                        <Alert severity="warning">
                            {(equipmentError as any)?.response?.status === 403
                                ? t('client.noEquipmentPermission')
                                : t('client.equipmentLoadFailed')}
                        </Alert>
                    ) : equipment.length === 0 ? (
                        <Typography color="text.secondary">{t('client.noEquipment')}</Typography>
                    ) : (
                        <Stack spacing={1.25}>
                            {equipment.map((asset) => (
                                <Paper
                                    key={asset.id}
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        cursor: canManageEquipment ? 'pointer' : 'default',
                                    }}
                                    onClick={canManageEquipment ? () => handleOpenEditEquipment(asset) : undefined}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: { xs: 'flex-start', md: 'center' },
                                            flexDirection: { xs: 'column', md: 'row' },
                                            gap: 1.5,
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="subtitle2">
                                                {asset.equipment_type}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {renderEquipmentSubtitle(asset)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('client.serialNumber')}: {asset.serial_number || '-'} | {t('client.assetTag')}: {asset.asset_tag || '-'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('client.locationNote')}: {asset.location_note || '-'} | {t('client.refrigerant')}: {asset.refrigerant || '-'}
                                            </Typography>
                                            {asset.notes ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    {asset.notes}
                                                </Typography>
                                            ) : null}
                                        </Box>

                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                                            <Chip
                                                size="small"
                                                label={asset.is_active ? t('client.activeLabel') : t('client.inactiveLabel')}
                                                color={asset.is_active ? 'success' : 'default'}
                                            />
                                            {asset.request_id ? <Chip size="small" variant="outlined" label={t('client.requestOrigin')} /> : null}
                                            {canManageEquipment ? (
                                                <IconButton size="small" onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleOpenEditEquipment(asset);
                                                }}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            ) : null}
                                        </Stack>
                                    </Box>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </Stack>
            </Paper>

            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                    <Chip
                        size="small"
                        color={currentRequests.length > 0 ? 'warning' : 'default'}
                        label={t('client.currentRequestsCount', { count: currentRequests.length })}
                    />
                    <Chip
                        size="small"
                        color={recentRequests.length > 0 ? 'success' : 'default'}
                        label={t('client.recentRequestsCount', { count: recentRequests.length })}
                    />
                    <Chip
                        size="small"
                        variant="outlined"
                        label={t('client.relatedBillingProjectsCount', { count: relatedBillingProjects.length })}
                    />
                    {canReadRequests ? (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/service-requests?client_id=${client.id}&site_id=${site.id}`)}
                        >
                            {t('client.viewAllSiteRequests')}
                        </Button>
                    ) : null}
                </Stack>

                {!canReadRequests ? (
                    <Typography color="text.secondary">{t('client.noSiteRequestPermission')}</Typography>
                ) : isLoadingRequests ? (
                    <Typography color="text.secondary">{t('common.loading')}</Typography>
                ) : (
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                {t('client.currentRequests')}
                            </Typography>
                            {currentRequests.length === 0 ? (
                                <Typography color="text.secondary">{t('client.noSiteRequests')}</Typography>
                            ) : (
                                <Stack spacing={1.25}>
                                    {currentRequests.map((request) => (
                                        <Paper key={request.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: { xs: 'flex-start', md: 'center' },
                                                    flexDirection: { xs: 'column', md: 'row' },
                                                    gap: 1,
                                                }}
                                            >
                                                <Box>
                                                    <Button
                                                        variant="text"
                                                        size="small"
                                                        sx={{ px: 0, minWidth: 0, justifyContent: 'flex-start' }}
                                                        onClick={() => navigate(`/service-requests/${request.id}`)}
                                                    >
                                                        {request.request_number}
                                                    </Button>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('serviceRequests.table.responsible')}: {request.responsible_user.full_name || request.responsible_user.email}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('serviceRequests.table.received')}: {formatBgDateTime(request.reported_at)}
                                                    </Typography>
                                                </Box>
                                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                                    <Chip
                                                        size="small"
                                                        label={getRequestStatusLabel(t, request.status)}
                                                        color={requestStatusColors[request.status] || 'default'}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        label={getRequestPriorityLabel(t, request.priority)}
                                                        color={requestPriorityColors[request.priority] || 'default'}
                                                    />
                                                </Stack>
                                            </Box>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        <Box>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                {t('client.recentRequests')}
                            </Typography>
                            {recentRequests.length === 0 ? (
                                <Typography color="text.secondary">{t('client.noRecentSiteRequests')}</Typography>
                            ) : (
                                <Stack spacing={1.25}>
                                    {recentRequests.map((request) => (
                                        <Paper key={request.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: { xs: 'flex-start', md: 'center' },
                                                    flexDirection: { xs: 'column', md: 'row' },
                                                    gap: 1,
                                                }}
                                            >
                                                <Box>
                                                    <Button
                                                        variant="text"
                                                        size="small"
                                                        sx={{ px: 0, minWidth: 0, justifyContent: 'flex-start' }}
                                                        onClick={() => navigate(`/service-requests/${request.id}`)}
                                                    >
                                                        {request.request_number}
                                                    </Button>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {formatBgDateTime(request.reported_at)}
                                                    </Typography>
                                                </Box>
                                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                                    <Chip
                                                        size="small"
                                                        label={getRequestStatusLabel(t, request.status)}
                                                        color={requestStatusColors[request.status] || 'default'}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        label={getRequestPriorityLabel(t, request.priority)}
                                                        color={requestPriorityColors[request.priority] || 'default'}
                                                    />
                                                </Stack>
                                            </Box>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    </Stack>
                )}
            </Paper>

            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {t('client.relatedBillingProjects')}
                </Typography>
                {relatedBillingProjects.length === 0 ? (
                    <Typography color="text.secondary">{t('client.noBillingProjects')}</Typography>
                ) : (
                    <Stack spacing={1.25}>
                        {relatedBillingProjects.map((project) => (
                            <Paper key={project.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                        <Typography variant="subtitle2">{project.project_reference}</Typography>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            {project.is_default ? (
                                                <Chip size="small" label={t('client.defaultLabel')} color="primary" />
                                            ) : null}
                                            <Chip
                                                size="small"
                                                label={project.is_active ? t('client.activeLabel') : t('client.inactiveLabel')}
                                                color={project.is_active ? 'success' : 'default'}
                                            />
                                        </Stack>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {getBillingServiceTypeLabel(t, project.service_type)} / {getBillingPaymentModeLabel(t, project.payment_mode)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {project.description || '-'}
                                    </Typography>
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                )}
            </Paper>

            <Dialog open={equipmentDialogOpen} onClose={() => setEquipmentDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>
                    {editingEquipment ? t('client.editEquipment') : t('client.addEquipment')}
                </DialogTitle>
                <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label={t('client.equipmentType')}
                        value={equipmentForm.equipment_type}
                        onChange={(event) => setEquipmentForm((current) => ({ ...current, equipment_type: event.target.value }))}
                        required
                        autoFocus
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField
                            label={t('client.manufacturer')}
                            value={equipmentForm.manufacturer}
                            onChange={(event) => setEquipmentForm((current) => ({ ...current, manufacturer: event.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label={t('client.model')}
                            value={equipmentForm.model}
                            onChange={(event) => setEquipmentForm((current) => ({ ...current, model: event.target.value }))}
                            fullWidth
                        />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField
                            label={t('client.serialNumber')}
                            value={equipmentForm.serial_number}
                            onChange={(event) => setEquipmentForm((current) => ({ ...current, serial_number: event.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label={t('client.assetTag')}
                            value={equipmentForm.asset_tag}
                            onChange={(event) => setEquipmentForm((current) => ({ ...current, asset_tag: event.target.value }))}
                            fullWidth
                        />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField
                            label={t('client.locationNote')}
                            value={equipmentForm.location_note}
                            onChange={(event) => setEquipmentForm((current) => ({ ...current, location_note: event.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label={t('client.refrigerant')}
                            value={equipmentForm.refrigerant}
                            onChange={(event) => setEquipmentForm((current) => ({ ...current, refrigerant: event.target.value }))}
                            fullWidth
                        />
                    </Stack>
                    <TextField
                        label={t('client.notes')}
                        value={equipmentForm.notes}
                        onChange={(event) => setEquipmentForm((current) => ({ ...current, notes: event.target.value }))}
                        multiline
                        minRows={3}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={equipmentForm.is_active}
                                onChange={(event) => setEquipmentForm((current) => ({ ...current, is_active: event.target.checked }))}
                            />
                        }
                        label={t('client.activeLabel')}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEquipmentDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={() => upsertEquipmentMutation.mutate()} disabled={upsertEquipmentMutation.isPending}>
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};

export default SiteDetails;
