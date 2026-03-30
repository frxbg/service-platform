import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import type { ProtocolPreview, ReferenceBillingProject, ServiceRequest } from '../types/serviceRequests';
import {
    formatBgDate,
    formatBgDateTime,
    formatBgTimeRange,
    getSuggestedWorkLogTiming,
    isValidTimeRange,
    toLocalDateTimeInputValue,
} from '../utils/dateTime';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import {
    getAssignmentStatusLabel,
    getBillingPaymentModeLabel,
    getBillingServiceTypeLabel,
    getRequestPriorityLabel,
    getRequestStatusLabel,
    requestStatusValues,
} from '../utils/serviceRequestI18n';

interface UserOption {
    id: string;
    full_name?: string | null;
    email: string;
}

interface MaterialOption {
    id: string;
    erp_code: string;
    name: string;
    unit: string;
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
}

const minutesToHours = (minutes?: number | null) => {
    const safeMinutes = Math.max(0, Number(minutes || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    return `${hours}h ${remainingMinutes}m`;
};

const createDefaultWorkLogForm = (technicianUserId = '') => ({
    ...getSuggestedWorkLogTiming(),
    activity_description: '',
    technician_user_id: technicianUserId,
});

const ServiceRequestDetails: React.FC = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [message, setMessage] = React.useState('');
    const [errorText, setErrorText] = React.useState('');
    const [assignmentUserId, setAssignmentUserId] = React.useState('');
    const [billingProjectId, setBillingProjectId] = React.useState('');
    const [billingProjectReason, setBillingProjectReason] = React.useState('');
    const [statusValue, setStatusValue] = React.useState('IN_PROGRESS');
    const [rejectReason, setRejectReason] = React.useState('');
    const [workLogForm, setWorkLogForm] = React.useState(() => createDefaultWorkLogForm());
    const [materialForm, setMaterialForm] = React.useState({
        material_id: '',
        warehouse_id: '',
        quantity: '1',
        unit: '',
        technician_user_id: '',
        notes: '',
    });
    const [followUpProblem, setFollowUpProblem] = React.useState('');

    const canAssign = hasPermission(user, 'service_requests.assign');
    const canAccept = hasPermission(user, 'service_requests.accept');
    const canReject = hasPermission(user, 'service_requests.reject');
    const canEdit = hasPermission(user, 'service_requests.edit');
    const canManageWork = hasPermission(user, 'work_logs.manage');
    const canManageMaterials = hasPermission(user, 'material_usages.manage');
    const canCreateFollowUp = hasPermission(user, 'service_requests.create');
    const canReadProtocol = hasAnyPermission(user, ['service_requests.read_all', 'service_requests.read_assigned']);

    const { data: request, isLoading, isError, error } = useQuery<ServiceRequest>({
        queryKey: ['service-request', id],
        enabled: Boolean(id),
        queryFn: async () => (await api.get(`/service-requests/${id}`)).data,
    });

    const { data: protocol } = useQuery<ProtocolPreview>({
        queryKey: ['service-protocol-preview', id],
        enabled: Boolean(id && canReadProtocol),
        queryFn: async () => (await api.get(`/service-protocols/${id}/preview`)).data,
    });

    const { data: billingProjectOptions = [] } = useQuery<ReferenceBillingProject[]>({
        queryKey: ['service-request-billing-project-options', id],
        enabled: Boolean(id && canEdit),
        queryFn: async () => (await api.get(`/service-requests/${id}/billing-project-options`)).data,
    });

    const { data: users = [] } = useQuery<UserOption[]>({
        queryKey: ['service-request-users-options'],
        enabled: canAssign,
        queryFn: async () => (await api.get('/users/', { params: { limit: 500 } })).data,
    });

    const { data: materials = [] } = useQuery<MaterialOption[]>({
        queryKey: ['service-request-material-options'],
        enabled: canManageMaterials,
        queryFn: async () => (await api.get('/materials/', { params: { limit: 500 } })).data,
    });

    const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
        queryKey: ['service-request-warehouse-options'],
        enabled: canManageMaterials,
        queryFn: async () => (await api.get('/warehouses/')).data,
    });

    React.useEffect(() => {
        if (!request) return;
        const defaultTechnicianId = request.assignments?.[0]?.technician_user.id || user?.id || '';
        setStatusValue(request.status);
        setBillingProjectId(request.billing_project_id || '');
        setWorkLogForm((current) => ({
            ...current,
            technician_user_id: current.technician_user_id || defaultTechnicianId,
        }));
        setMaterialForm((current) => ({
            ...current,
            technician_user_id: current.technician_user_id || defaultTechnicianId,
        }));
    }, [request, user?.id]);

    const workLogTimeRangeError = React.useMemo(() => {
        if (!workLogForm.time_from || !workLogForm.time_to) {
            return '';
        }

        if (isValidTimeRange(workLogForm.time_from, workLogForm.time_to)) {
            return '';
        }

        return t('serviceRequests.details.invalidTimeRange');
    }, [t, workLogForm.time_from, workLogForm.time_to]);

    const refresh = async (nextMessage: string) => {
        setErrorText('');
        setMessage(nextMessage);
        await queryClient.invalidateQueries({ queryKey: ['service-request', id] });
        await queryClient.invalidateQueries({ queryKey: ['service-requests'] });
        await queryClient.invalidateQueries({ queryKey: ['service-protocol-preview', id] });
    };

    const fail = (error: any) =>
        setErrorText(error?.response?.data?.detail || t('serviceRequests.details.requestFailed'));

    const exportProtocolPdf = async () => {
        try {
            const response = await api.get(`/service-protocols/${id}/pdf`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const opened = window.open(url, '_blank', 'noopener,noreferrer');
            if (!opened) {
                const link = document.createElement('a');
                link.href = url;
                link.download = `service_protocol_${request?.request_number || id}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error: any) {
            fail(error);
        }
    };

    const assignMutation = useMutation({
        mutationFn: async () => api.post(`/service-requests/${id}/assignments`, [{ technician_user_id: assignmentUserId, is_primary: false }]),
        onSuccess: async () => {
            setAssignmentUserId('');
            await refresh(t('serviceRequests.details.messages.technicianAssigned'));
        },
        onError: fail,
    });

    const statusMutation = useMutation({
        mutationFn: async () => api.post(`/service-requests/${id}/status`, { status: statusValue }),
        onSuccess: async () =>
            refresh(
                t('serviceRequests.details.messages.statusUpdated', {
                    status: getRequestStatusLabel(t, statusValue),
                }),
            ),
        onError: fail,
    });

    const billingProjectMutation = useMutation({
        mutationFn: async () =>
            api.post(`/service-requests/${id}/billing-project`, {
                billing_project_id: billingProjectId,
                reason_for_change: billingProjectReason,
            }),
        onSuccess: async () => {
            setBillingProjectReason('');
            await refresh(t('serviceRequests.details.messages.billingProjectChanged'));
        },
        onError: fail,
    });

    const workLogMutation = useMutation({
        mutationFn: async () => api.post('/work-logs/', { request_id: id, ...workLogForm }),
        onSuccess: async () => {
            setWorkLogForm((current) => createDefaultWorkLogForm(current.technician_user_id));
            await refresh(t('serviceRequests.details.messages.workLogAdded'));
        },
        onError: fail,
    });

    const materialMutation = useMutation({
        mutationFn: async () => api.post('/material-usages/', { request_id: id, ...materialForm }),
        onSuccess: async () => {
            setMaterialForm((current) => ({
                ...current,
                material_id: '',
                warehouse_id: '',
                quantity: '1',
                unit: '',
                notes: '',
            }));
            await refresh(t('serviceRequests.details.messages.materialUsageAdded'));
        },
        onError: fail,
    });

    const acceptMutation = useMutation({
        mutationFn: async (assignmentId: string) => api.post(`/service-assignments/${assignmentId}/accept`),
        onSuccess: async () => refresh(t('serviceRequests.details.messages.assignmentAccepted')),
        onError: fail,
    });

    const rejectMutation = useMutation({
        mutationFn: async (assignmentId: string) => api.post(`/service-assignments/${assignmentId}/reject`, { reject_reason: rejectReason }),
        onSuccess: async () => {
            setRejectReason('');
            await refresh(t('serviceRequests.details.messages.assignmentRejected'));
        },
        onError: fail,
    });

    const followUpMutation = useMutation({
        mutationFn: async () => {
            if (!request) {
                throw new Error(t('serviceRequests.details.requestNotLoaded'));
            }
            return api.post('/service-requests/', {
                client_id: request.client.id,
                site_id: request.site.id,
                billing_project_id: request.billing_project_id || undefined,
                reported_problem: followUpProblem,
                reported_at: toLocalDateTimeInputValue(new Date()),
                source: 'onsite',
                priority: 'standard',
            });
        },
        onSuccess: async () => {
            setFollowUpProblem('');
            await refresh(t('serviceRequests.details.messages.followUpCreated'));
        },
        onError: fail,
    });

    const deleteMutation = useMutation({
        mutationFn: async () => api.delete(`/service-requests/${id}`),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['service-requests'] });
            navigate('/service-requests');
        },
        onError: fail,
    });
    const selectedMaterial = materials.find((entry) => entry.id === materialForm.material_id);

    React.useEffect(() => {
        if (!selectedMaterial) return;
        setMaterialForm((current) => ({
            ...current,
            unit: current.unit || selectedMaterial.unit,
        }));
    }, [selectedMaterial]);

    if (isLoading) {
        return <Typography>{t('serviceRequests.details.loading')}</Typography>;
    }

    if (isError || !request) {
        return (
            <Alert severity="error">
                {(error as any)?.response?.data?.detail || t('serviceRequests.details.requestFailed')}
            </Alert>
        );
    }

    const assignments = request.assignments || [];
    const workLogs = request.work_logs || [];
    const materialUsages = request.material_usages || [];
    const availableBillingProjects = billingProjectOptions.filter((project) => {
        if (!project.is_active) return false;
        return !project.site_id || project.site_id === request.site.id;
    });
    const myAssignment = assignments.find((entry) => entry.technician_user.id === user?.id);

    return (
        <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{request.request_number}</Typography>
                    <Typography color="text.secondary">{request.client.name} | {request.site.site_name || request.site.site_code}</Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                    {request.can_delete && (
                        <Button
                            color="error"
                            variant="outlined"
                            onClick={() => {
                                if (window.confirm(t('serviceRequests.details.confirmDelete'))) {
                                    deleteMutation.mutate();
                                }
                            }}
                        >
                            {t('serviceRequests.details.delete')}
                        </Button>
                    )}
                    <Button variant="outlined" onClick={exportProtocolPdf}>
                        {t('serviceRequests.details.exportPdf')}
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/service-requests')}>
                        {t('serviceRequests.details.back')}
                    </Button>
                </Stack>
            </Box>

            {message && <Alert severity="success">{message}</Alert>}
            {errorText && <Alert severity="error">{errorText}</Alert>}
            {request.is_locked && !request.can_edit && (
                <Alert severity="info">{t('serviceRequests.details.lockedNotice')}</Alert>
            )}

            <Card>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Typography>
                            <strong>{t('serviceRequests.details.problem')}:</strong> {request.reported_problem}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.details.responsible')}:</strong> {request.responsible_user.full_name || request.responsible_user.email}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.details.received')}:</strong> {formatBgDateTime(request.reported_at)}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.billing.project')}:</strong> {request.project_reference_snapshot || '-'}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.billing.serviceTypeLabel')}:</strong> {request.service_type_snapshot ? getBillingServiceTypeLabel(t, request.service_type_snapshot) : '-'}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.billing.paymentModeLabel')}:</strong> {request.payment_mode_snapshot ? getBillingPaymentModeLabel(t, request.payment_mode_snapshot) : '-'}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Chip label={getRequestStatusLabel(t, request.status)} color="primary" />
                            <Chip label={getRequestPriorityLabel(t, request.priority)} variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
                <Stack spacing={3} sx={{ flex: 2 }}>
                    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            {t('serviceRequests.details.assignments')}
                        </Typography>
                        <Stack spacing={2}>
                            {assignments.map((assignment) => (
                                <Box key={assignment.id}>
                                    <Typography sx={{ fontWeight: 600 }}>
                                        {assignment.technician_user.full_name || assignment.technician_user.email}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {getAssignmentStatusLabel(t, assignment.assignment_status)}
                                        {assignment.reject_reason ? ` | ${assignment.reject_reason}` : ''}
                                    </Typography>
                                    {myAssignment?.id === assignment.id && assignment.assignment_status === 'pending' && (
                                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
                                            {canAccept && (
                                                <Button variant="contained" onClick={() => acceptMutation.mutate(assignment.id)}>
                                                    {t('serviceRequests.details.accept')}
                                                </Button>
                                            )}
                                            {canReject && (
                                                <>
                                                    <TextField
                                                        size="small"
                                                        label={t('serviceRequests.details.rejectReason')}
                                                        value={rejectReason}
                                                        onChange={(event) => setRejectReason(event.target.value)}
                                                    />
                                                    <Button variant="outlined" color="error" onClick={() => rejectMutation.mutate(assignment.id)}>
                                                        {t('serviceRequests.details.reject')}
                                                    </Button>
                                                </>
                                            )}
                                        </Stack>
                                    )}
                                </Box>
                            ))}
                            {canAssign && request.can_edit && (
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>{t('serviceRequests.details.technician')}</InputLabel>
                                        <Select
                                            value={assignmentUserId}
                                            label={t('serviceRequests.details.technician')}
                                            onChange={(event) => setAssignmentUserId(event.target.value)}
                                        >
                                            {users.map((entry) => (
                                                <MenuItem key={entry.id} value={entry.id}>{entry.full_name || entry.email}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <Button variant="contained" disabled={!assignmentUserId} onClick={() => assignMutation.mutate()}>
                                        {t('serviceRequests.details.assign')}
                                    </Button>
                                </Stack>
                            )}
                        </Stack>
                    </Paper>

                    {canEdit && request.can_edit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.billing.changeTitle')}
                            </Typography>
                            <Stack spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.billing.project')}</InputLabel>
                                    <Select
                                        value={billingProjectId}
                                        label={t('serviceRequests.billing.project')}
                                        onChange={(event) => setBillingProjectId(event.target.value)}
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
                                <TextField
                                    size="small"
                                    label={t('serviceRequests.billing.changeReason')}
                                    value={billingProjectReason}
                                    onChange={(event) => setBillingProjectReason(event.target.value)}
                                />
                                <Button
                                    variant="contained"
                                    disabled={!billingProjectId || !billingProjectReason.trim() || billingProjectMutation.isPending}
                                    onClick={() => billingProjectMutation.mutate()}
                                >
                                    {t('serviceRequests.billing.applyChange')}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canEdit && request.can_edit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.statusSection')}
                            </Typography>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.statusSection')}</InputLabel>
                                    <Select
                                        value={statusValue}
                                        label={t('serviceRequests.details.statusSection')}
                                        onChange={(event) => setStatusValue(event.target.value)}
                                    >
                                        {requestStatusValues.map((status) => (
                                            <MenuItem key={status} value={status}>{getRequestStatusLabel(t, status)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button variant="contained" onClick={() => statusMutation.mutate()}>
                                    {t('serviceRequests.details.apply')}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canManageWork && request.can_edit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.addWorkLog')}
                            </Typography>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <TextField size="small" type="date" label={t('serviceRequests.details.date')} InputLabelProps={{ shrink: true }} value={workLogForm.work_date} onChange={(event) => setWorkLogForm((current) => ({ ...current, work_date: event.target.value }))} fullWidth />
                                    <TextField size="small" type="time" label={t('serviceRequests.details.from')} InputLabelProps={{ shrink: true }} value={workLogForm.time_from} onChange={(event) => setWorkLogForm((current) => ({ ...current, time_from: event.target.value }))} error={Boolean(workLogTimeRangeError)} helperText={workLogTimeRangeError || ' '} fullWidth />
                                    <TextField size="small" type="time" label={t('serviceRequests.details.to')} InputLabelProps={{ shrink: true }} value={workLogForm.time_to} onChange={(event) => setWorkLogForm((current) => ({ ...current, time_to: event.target.value }))} error={Boolean(workLogTimeRangeError)} helperText={workLogTimeRangeError || ' '} fullWidth />
                                </Stack>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.technician')}</InputLabel>
                                    <Select value={workLogForm.technician_user_id} label={t('serviceRequests.details.technician')} onChange={(event) => setWorkLogForm((current) => ({ ...current, technician_user_id: event.target.value }))}>
                                        {assignments.map((assignment) => (
                                            <MenuItem key={assignment.id} value={assignment.technician_user.id}>
                                                {assignment.technician_user.full_name || assignment.technician_user.email}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField size="small" label={t('serviceRequests.details.activityDescription')} multiline minRows={3} value={workLogForm.activity_description} onChange={(event) => setWorkLogForm((current) => ({ ...current, activity_description: event.target.value }))} />
                                <Button variant="contained" disabled={!workLogForm.activity_description || Boolean(workLogTimeRangeError)} onClick={() => workLogMutation.mutate()}>
                                    {t('serviceRequests.details.addWorkLogAction')}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canManageMaterials && request.can_edit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.materialUsage')}
                            </Typography>
                            <Stack spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.material')}</InputLabel>
                                    <Select value={materialForm.material_id} label={t('serviceRequests.details.material')} onChange={(event) => setMaterialForm((current) => ({ ...current, material_id: event.target.value, unit: '' }))}>
                                        {materials.map((entry) => (
                                            <MenuItem key={entry.id} value={entry.id}>{entry.erp_code} - {entry.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>{t('serviceRequests.details.warehouse')}</InputLabel>
                                        <Select value={materialForm.warehouse_id} label={t('serviceRequests.details.warehouse')} onChange={(event) => setMaterialForm((current) => ({ ...current, warehouse_id: event.target.value }))}>
                                            {warehouses.map((entry) => (
                                                <MenuItem key={entry.id} value={entry.id}>{entry.code} - {entry.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <TextField size="small" label={t('serviceRequests.details.quantity')} value={materialForm.quantity} onChange={(event) => setMaterialForm((current) => ({ ...current, quantity: event.target.value }))} fullWidth />
                                    <TextField size="small" label={t('serviceRequests.details.unit')} value={materialForm.unit} onChange={(event) => setMaterialForm((current) => ({ ...current, unit: event.target.value }))} fullWidth />
                                </Stack>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.technician')}</InputLabel>
                                    <Select value={materialForm.technician_user_id} label={t('serviceRequests.details.technician')} onChange={(event) => setMaterialForm((current) => ({ ...current, technician_user_id: event.target.value }))}>
                                        {assignments.map((assignment) => (
                                            <MenuItem key={assignment.id} value={assignment.technician_user.id}>
                                                {assignment.technician_user.full_name || assignment.technician_user.email}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField size="small" label={t('serviceRequests.details.notes')} value={materialForm.notes} onChange={(event) => setMaterialForm((current) => ({ ...current, notes: event.target.value }))} />
                                <Button variant="contained" disabled={!materialForm.material_id || !materialForm.warehouse_id} onClick={() => materialMutation.mutate()}>
                                    {t('serviceRequests.details.addMaterialUsage')}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canCreateFollowUp && request.can_edit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.followUpTitle')}
                            </Typography>
                            <Stack spacing={2}>
                                <TextField
                                    size="small"
                                    label={t('serviceRequests.details.followUpProblem')}
                                    multiline
                                    minRows={3}
                                    value={followUpProblem}
                                    onChange={(event) => setFollowUpProblem(event.target.value)}
                                />
                                <Button variant="contained" disabled={!followUpProblem} onClick={() => followUpMutation.mutate()}>
                                    {t('serviceRequests.details.createFollowUp')}
                                </Button>
                            </Stack>
                        </Paper>
                    )}
                </Stack>

                <Stack spacing={3} sx={{ flex: 1 }}>
                    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            {t('serviceRequests.details.protocolPreview')}
                        </Typography>
                        {!protocol ? (
                            <Typography color="text.secondary">
                                {t('serviceRequests.details.protocolEmpty')}
                            </Typography>
                        ) : (
                            <Stack spacing={1}>
                                <Typography><strong>{t('serviceRequests.details.executionDate')}:</strong> {protocol.execution_date ? formatBgDate(protocol.execution_date) : '-'}</Typography>
                                <Typography><strong>{t('serviceRequests.details.time')}:</strong> {formatBgTimeRange(protocol.worked_time_from, protocol.worked_time_to)}</Typography>
                                <Typography><strong>{t('serviceRequests.details.technicians')}:</strong> {protocol.technicians.join(', ') || '-'}</Typography>
                                <Typography><strong>{t('serviceRequests.details.total')}:</strong> {minutesToHours(protocol.total_minutes)}</Typography>
                                <Typography variant="body2"><strong>{t('serviceRequests.details.work')}:</strong> {protocol.work_description || '-'}</Typography>
                            </Stack>
                        )}
                    </Paper>

                    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            {t('serviceRequests.details.executionLog')}
                        </Typography>
                        <Stack spacing={1.5}>
                            {workLogs.length === 0 ? (
                                <Typography color="text.secondary">
                                    {t('serviceRequests.details.noWorkLogs')}
                                </Typography>
                            ) : (
                                workLogs.map((log) => (
                                    <Box key={log.id}>
                                        <Typography sx={{ fontWeight: 600 }}>
                                            {log.technician_user.full_name || log.technician_user.email}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatBgDate(log.work_date)} {formatBgTimeRange(log.time_from, log.time_to)} | {log.activity_description}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                            {materialUsages.length > 0 && (
                                <>
                                    <Typography variant="subtitle2" sx={{ pt: 1 }}>
                                        {t('serviceRequests.details.materials')}
                                    </Typography>
                                    {materialUsages.map((usage) => (
                                        <Box key={usage.id}>
                                            <Typography sx={{ fontWeight: 600 }}>
                                                {usage.material.erp_code} - {usage.material.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {usage.quantity} {usage.unit} {t('serviceRequests.details.fromWarehouse')} {usage.warehouse.code}
                                            </Typography>
                                        </Box>
                                    ))}
                                </>
                            )}
                        </Stack>
                    </Paper>
                </Stack>
            </Stack>
        </Stack>
    );
};

export default ServiceRequestDetails;
