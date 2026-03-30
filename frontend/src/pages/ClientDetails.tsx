import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Visibility as VisibilityIcon } from '@mui/icons-material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import {
    billingPaymentModeValues,
    billingServiceTypeValues,
    getBillingPaymentModeLabel,
    getBillingServiceTypeLabel,
} from '../utils/serviceRequestI18n';

interface ClientBillingProject {
    id: string;
    client_id: string;
    site_id?: string | null;
    project_reference: string;
    project_year?: string | null;
    service_type: 'paid_service' | 'warranty' | 'maintenance' | 'installation' | 'subscription' | 'other';
    payment_mode: 'paid' | 'warranty' | 'contract' | 'internal' | 'other';
    description?: string | null;
    regular_labor_rate?: number | string | null;
    transport_rate?: number | string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    is_default: boolean;
    is_active: boolean;
    notes?: string | null;
}

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
    project_number?: string;
    salutation_name?: string;
    vat_number?: string;
    address?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
    notes?: string;
    sites?: ClientSite[];
    billing_projects?: ClientBillingProject[];
}

type SiteFormValues = {
    site_code: string;
    site_name?: string;
    city?: string;
    address?: string;
    project_number?: string;
    notes?: string;
};

type BillingProjectFormValues = {
    site_id?: string;
    project_reference: string;
    project_year?: string;
    service_type: ClientBillingProject['service_type'];
    payment_mode: ClientBillingProject['payment_mode'];
    description?: string;
    regular_labor_rate?: string;
    transport_rate?: string;
    valid_from?: string;
    valid_to?: string;
    is_default: boolean;
    is_active: boolean;
    notes?: string;
};

const ClientDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const canManageClients = hasPermission(user, 'clients.manage');
    const canReadBillingCommercial =
        hasAnyPermission(user, ['billing_projects.read_commercial', 'clients.manage']) ||
        (hasPermission(user, 'labor_rates.read') && hasPermission(user, 'transport_rates.read'));
    const [siteDialogOpen, setSiteDialogOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<ClientSite | null>(null);
    const [billingDialogOpen, setBillingDialogOpen] = useState(false);
    const [editingBillingProject, setEditingBillingProject] = useState<ClientBillingProject | null>(null);
    const [siteForm, setSiteForm] = useState<SiteFormValues>({
        site_code: '',
        site_name: '',
        city: '',
        address: '',
        project_number: '',
        notes: '' });
    const [billingProjectForm, setBillingProjectForm] = useState<BillingProjectFormValues>({
        site_id: '',
        project_reference: '',
        project_year: '',
        service_type: 'other',
        payment_mode: 'other',
        description: '',
        regular_labor_rate: '',
        transport_rate: '',
        valid_from: '',
        valid_to: '',
        is_default: false,
        is_active: true,
        notes: '' });

    const { data: client, isLoading } = useQuery<Client>({
        queryKey: ['client', id],
        enabled: Boolean(id),
        queryFn: async () => {
            const { data } = await api.get(`/clients/${id}`);
            return data;
        } });

    const upsertSiteMutation = useMutation({
        mutationFn: async () => {
            if (!id) throw new Error('Missing client id');
            if (editingSite) {
                const { data } = await api.patch(`/clients/${id}/sites/${editingSite.id}`, siteForm);
                return data;
            }
            const payload = { ...siteForm, client_id: id };
            const { data } = await api.post(`/clients/${id}/sites`, payload);
            return data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['client', id] });
            await queryClient.invalidateQueries({ queryKey: ['clients'] });
            setSiteDialogOpen(false);
            setEditingSite(null);
            setSiteForm({
                site_code: '',
                site_name: '',
                city: '',
                address: '',
                project_number: '',
                notes: '' });
        } });

    const deleteSiteMutation = useMutation({
        mutationFn: async (siteId: string) => {
            if (!id) throw new Error('Missing client id');
            await api.delete(`/clients/${id}/sites/${siteId}`);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['client', id] });
            await queryClient.invalidateQueries({ queryKey: ['clients'] });
        } });

    const upsertBillingProjectMutation = useMutation({
        mutationFn: async () => {
            if (!id) throw new Error('Missing client id');
            const payload = {
                ...billingProjectForm,
                client_id: id,
                site_id: billingProjectForm.site_id || null,
                regular_labor_rate: billingProjectForm.regular_labor_rate || null,
                transport_rate: billingProjectForm.transport_rate || null,
                valid_from: billingProjectForm.valid_from || null,
                valid_to: billingProjectForm.valid_to || null };
            if (editingBillingProject) {
                const { client_id: _clientId, ...updatePayload } = payload;
                const { data } = await api.patch(`/clients/${id}/billing-projects/${editingBillingProject.id}`, updatePayload);
                return data;
            }
            const { data } = await api.post(`/clients/${id}/billing-projects`, payload);
            return data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['client', id] });
            await queryClient.invalidateQueries({ queryKey: ['clients'] });
            setBillingDialogOpen(false);
            setEditingBillingProject(null);
            setBillingProjectForm({
                site_id: '',
                project_reference: '',
                project_year: '',
                service_type: 'other',
                payment_mode: 'other',
                description: '',
                regular_labor_rate: '',
                transport_rate: '',
                valid_from: '',
                valid_to: '',
                is_default: false,
                is_active: true,
                notes: '' });
        } });

    const handleOpenNewSite = () => {
        setEditingSite(null);
        setSiteForm({
            site_code: '',
            site_name: '',
            city: '',
            address: '',
            project_number: '',
            notes: '' });
        setSiteDialogOpen(true);
    };

    const handleOpenEditSite = (site: ClientSite) => {
        setEditingSite(site);
        setSiteForm({
            site_code: site.site_code || '',
            site_name: site.site_name || '',
            city: site.city || '',
            address: site.address || '',
            project_number: site.project_number || '',
            notes: site.notes || '' });
        setSiteDialogOpen(true);
    };

    const handleOpenNewBillingProject = () => {
        setEditingBillingProject(null);
        setBillingProjectForm({
            site_id: '',
            project_reference: '',
            project_year: '',
            service_type: 'other',
            payment_mode: 'other',
            description: '',
            regular_labor_rate: '',
            transport_rate: '',
            valid_from: '',
            valid_to: '',
            is_default: false,
            is_active: true,
            notes: '' });
        setBillingDialogOpen(true);
    };

    const handleOpenEditBillingProject = (project: ClientBillingProject) => {
        setEditingBillingProject(project);
        setBillingProjectForm({
            site_id: project.site_id || '',
            project_reference: project.project_reference,
            project_year: project.project_year || '',
            service_type: project.service_type,
            payment_mode: project.payment_mode,
            description: project.description || '',
            regular_labor_rate: project.regular_labor_rate ? String(project.regular_labor_rate) : '',
            transport_rate: project.transport_rate ? String(project.transport_rate) : '',
            valid_from: project.valid_from || '',
            valid_to: project.valid_to || '',
            is_default: project.is_default,
            is_active: project.is_active,
            notes: project.notes || '' });
        setBillingDialogOpen(true);
    };

    const handleDeleteSite = async (site: ClientSite) => {
        const confirmed = window.confirm(
            t('client.confirmDeleteSite'),
        );
        if (!confirmed) return;
        await deleteSiteMutation.mutateAsync(site.id);
    };

    if (isLoading || !client) {
        return <Typography>{t('common.loading')}</Typography>;
    }

    const billingProjects = client.billing_projects || [];
    const activeBillingProjects = billingProjects.filter((project) => project.is_active);
    const defaultBillingProject =
        activeBillingProjects.find((project) => project.is_default) || activeBillingProjects[0] || null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4">{client.name}</Typography>
                    {client.client_number ? (
                        <Typography variant="subtitle1" color="text.secondary">
                            {t('client.clientNumber')}: {client.client_number}
                        </Typography>
                    ) : null}
                </Box>
                <Button variant="text" onClick={() => navigate(-1)}>
                    {t('common.back')}
                </Button>
            </Box>

            <Card>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">
                                {t('clientBillingLocalized.billingProjectsSummary')}
                            </Typography>
                            <Typography>{`${activeBillingProjects.length}/${billingProjects.length}`}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">
                                {t('clientBillingLocalized.defaultBillingProject')}
                            </Typography>
                            <Typography>{defaultBillingProject?.project_reference || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">
                                {t('clientBillingLocalized.projectNumberLegacy')}
                            </Typography>
                            <Typography>{client.project_number || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">{t('client.vat')}</Typography>
                            <Typography>{client.vat_number || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">
                                {t('client.salutationName')}
                            </Typography>
                            <Typography>{client.salutation_name || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">{t('client.email')}</Typography>
                            <Typography>{client.email || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">{t('client.phone')}</Typography>
                            <Typography>{client.phone || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">{t('client.city')}</Typography>
                            <Typography>{client.city || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="subtitle2">{t('client.country')}</Typography>
                            <Typography>{client.country || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle2">{t('client.address')}</Typography>
                            <Typography>{client.address || '-'}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle2">{t('client.notes')}</Typography>
                            <Typography>{client.notes || '-'}</Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">{t('client.sites')}</Typography>
                    {canManageClients ? (
                        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleOpenNewSite}>
                            {t('client.addSite')}
                        </Button>
                    ) : null}
                </Box>
                {client.sites && client.sites.length > 0 ? (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('client.siteCode')}</TableCell>
                                <TableCell>{t('client.siteName')}</TableCell>
                                <TableCell>{t('client.siteCity')}</TableCell>
                                <TableCell>{t('client.siteAddress')}</TableCell>
                                <TableCell>{t('clientBillingLocalized.projectNumberLegacy')}</TableCell>
                                <TableCell>{t('client.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {client.sites.map((site) => (
                                <TableRow
                                    key={site.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/clients/${client.id}/sites/${site.id}`)}
                                >
                                    <TableCell>
                                        <Button
                                            variant="text"
                                            size="small"
                                            sx={{ px: 0, minWidth: 0, justifyContent: 'flex-start' }}
                                            onClick={() => navigate(`/clients/${client.id}/sites/${site.id}`)}
                                        >
                                            {site.site_code}
                                        </Button>
                                    </TableCell>
                                    <TableCell>{site.site_name || '-'}</TableCell>
                                    <TableCell>{site.city}</TableCell>
                                    <TableCell>{site.address}</TableCell>
                                    <TableCell>{site.project_number}</TableCell>
                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                        <IconButton size="small" onClick={() => navigate(`/clients/${client.id}/sites/${site.id}`)}>
                                            <VisibilityIcon fontSize="small" />
                                        </IconButton>
                                        {canManageClients ? (
                                            <IconButton size="small" onClick={() => handleOpenEditSite(site)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        ) : null}
                                        {canManageClients ? (
                                            <IconButton size="small" color="error" onClick={() => handleDeleteSite(site)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {t('client.noSites')}
                    </Typography>
                )}
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">{t('clientBillingLocalized.billingProjects')}</Typography>
                    {canManageClients ? (
                        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleOpenNewBillingProject}>
                            {t('clientBillingLocalized.addBillingProject')}
                        </Button>
                    ) : null}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('clientBillingLocalized.billingProjectsHint')}
                </Typography>
                {client.billing_projects && client.billing_projects.length > 0 ? (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('client.siteName')}</TableCell>
                                <TableCell>{t('client.projectNumber')}</TableCell>
                                <TableCell>{t('serviceRequests.billing.serviceTypeLabel')}</TableCell>
                                <TableCell>{t('serviceRequests.billing.paymentModeLabel')}</TableCell>
                                <TableCell>{t('client.statusLabel')}</TableCell>
                                {canManageClients ? <TableCell>{t('client.actions')}</TableCell> : null}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {client.billing_projects.map((project) => (
                                <TableRow key={project.id}>
                                    <TableCell>
                                        {client.sites?.find((site) => site.id === project.site_id)?.site_name ||
                                            client.sites?.find((site) => site.id === project.site_id)?.site_code ||
                                            t('clientBillingLocalized.allSites')}
                                    </TableCell>
                                    <TableCell>{project.project_reference}</TableCell>
                                    <TableCell>{getBillingServiceTypeLabel(t, project.service_type)}</TableCell>
                                    <TableCell>{getBillingPaymentModeLabel(t, project.payment_mode)}</TableCell>
                                    <TableCell>
                                        {project.is_active
                                            ? t('clientBillingLocalized.activeLabel')
                                            : t('clientBillingLocalized.inactiveLabel')}
                                        {project.is_default ? ` / ${t('clientBillingLocalized.defaultLabel')}` : ''}
                                    </TableCell>
                                    {canManageClients ? (
                                        <TableCell>
                                            <IconButton size="small" onClick={() => handleOpenEditBillingProject(project)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    ) : null}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {t('clientBillingLocalized.noBillingProjects')}
                    </Typography>
                )}
            </Paper>

            <Dialog open={siteDialogOpen} onClose={() => setSiteDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>
                    {editingSite
                        ? t('client.editSite')
                        : t('client.addSite')}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        fullWidth
                        required
                        label={t('client.siteCode')}
                        value={siteForm.site_code}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, site_code: e.target.value }))}
                    />
                    <TextField
                        margin="dense"
                        fullWidth
                        label={t('client.siteName')}
                        value={siteForm.site_name || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, site_name: e.target.value }))}
                    />
                    <TextField
                        margin="dense"
                        fullWidth
                        label={t('client.siteCity')}
                        value={siteForm.city || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                    <TextField
                        margin="dense"
                        fullWidth
                        label={t('client.siteAddress')}
                        value={siteForm.address || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, address: e.target.value }))}
                    />
                    <TextField
                        margin="dense"
                        fullWidth
                        label={t('client.projectNumber')}
                        value={siteForm.project_number || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, project_number: e.target.value }))}
                    />
                    <TextField
                        margin="dense"
                        fullWidth
                        multiline
                        minRows={2}
                        label={t('client.notes')}
                        value={siteForm.notes || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSiteDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={() => upsertSiteMutation.mutate()}
                        disabled={!siteForm.site_code || upsertSiteMutation.isPending}
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={billingDialogOpen} onClose={() => setBillingDialogOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>
                    {editingBillingProject
                        ? t('clientBillingLocalized.editBillingProject')
                        : t('clientBillingLocalized.addBillingProject')}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        fullWidth
                        required
                        label={t('client.projectNumber')}
                        value={billingProjectForm.project_reference}
                        onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, project_reference: e.target.value }))}
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            margin="dense"
                            fullWidth
                            label={t('client.projectYear')}
                            value={billingProjectForm.project_year || ''}
                            onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, project_year: e.target.value }))}
                        />
                        <TextField
                            select
                            margin="dense"
                            fullWidth
                            label={t('client.siteName')}
                            value={billingProjectForm.site_id || ''}
                            onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, site_id: e.target.value }))}
                        >
                            <MenuItem value="">{t('clientBillingLocalized.allSites')}</MenuItem>
                            {(client.sites || []).map((site) => (
                                <MenuItem key={site.id} value={site.id}>
                                    {site.site_code} {site.site_name ? `- ${site.site_name}` : ''}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            select
                            margin="dense"
                            fullWidth
                            label={t('serviceRequests.billing.serviceTypeLabel')}
                            value={billingProjectForm.service_type}
                            onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, service_type: e.target.value as ClientBillingProject['service_type'] }))}
                        >
                            {billingServiceTypeValues.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {getBillingServiceTypeLabel(t, value)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            margin="dense"
                            fullWidth
                            label={t('serviceRequests.billing.paymentModeLabel')}
                            value={billingProjectForm.payment_mode}
                            onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, payment_mode: e.target.value as ClientBillingProject['payment_mode'] }))}
                        >
                            {billingPaymentModeValues.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {getBillingPaymentModeLabel(t, value)}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                    <TextField
                        margin="dense"
                        fullWidth
                        label={t('client.description')}
                        value={billingProjectForm.description || ''}
                        onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    {canReadBillingCommercial ? (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                margin="dense"
                                fullWidth
                                label={t('client.regularLaborRate')}
                                value={billingProjectForm.regular_labor_rate || ''}
                                onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, regular_labor_rate: e.target.value }))}
                            />
                            <TextField
                                margin="dense"
                                fullWidth
                                label={t('client.transportRate')}
                                value={billingProjectForm.transport_rate || ''}
                                onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, transport_rate: e.target.value }))}
                            />
                        </Box>
                    ) : null}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            margin="dense"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            label={t('client.validFrom')}
                            value={billingProjectForm.valid_from || ''}
                            onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, valid_from: e.target.value }))}
                        />
                        <TextField
                            margin="dense"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            label={t('client.validTo')}
                            value={billingProjectForm.valid_to || ''}
                            onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, valid_to: e.target.value }))}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Button
                            variant={billingProjectForm.is_default ? 'contained' : 'outlined'}
                            onClick={() => setBillingProjectForm((prev) => ({ ...prev, is_default: !prev.is_default }))}
                        >
                            {t('clientBillingLocalized.defaultLabel')}
                        </Button>
                        <Button
                            variant={billingProjectForm.is_active ? 'contained' : 'outlined'}
                            color={billingProjectForm.is_active ? 'success' : 'inherit'}
                            onClick={() => setBillingProjectForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                        >
                            {billingProjectForm.is_active
                                ? t('clientBillingLocalized.activeLabel')
                                : t('clientBillingLocalized.inactiveLabel')}
                        </Button>
                    </Box>
                    <TextField
                        margin="dense"
                        fullWidth
                        multiline
                        minRows={2}
                        label={t('client.notes')}
                        value={billingProjectForm.notes || ''}
                        onChange={(e) => setBillingProjectForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBillingDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={() => upsertBillingProjectMutation.mutate()}
                        disabled={!billingProjectForm.project_reference || upsertBillingProjectMutation.isPending}
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ClientDetails;
