import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import type { ProtocolPreview, ReferenceBillingProject, ServiceRequest } from '../types/serviceRequests';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import {
    getAppLocale,
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

const ServiceRequestDetails: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const locale = getAppLocale(i18n.resolvedLanguage);
    const [message, setMessage] = React.useState('');
    const [errorText, setErrorText] = React.useState('');
    const [assignmentUserId, setAssignmentUserId] = React.useState('');
    const [billingProjectId, setBillingProjectId] = React.useState('');
    const [billingProjectReason, setBillingProjectReason] = React.useState('');
    const [statusValue, setStatusValue] = React.useState('IN_PROGRESS');
    const [rejectReason, setRejectReason] = React.useState('');
    const [workLogForm, setWorkLogForm] = React.useState({
        work_date: new Date().toISOString().slice(0, 10),
        time_from: '08:00',
        time_to: '10:00',
        activity_description: '',
        technician_user_id: '',
    });
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
        queryFn: async () => (await api.get('/users', { params: { limit: 500 } })).data,
    });

    const { data: materials = [] } = useQuery<MaterialOption[]>({
        queryKey: ['service-request-material-options'],
        enabled: canManageMaterials,
        queryFn: async () => (await api.get('/materials', { params: { limit: 500 } })).data,
    });

    const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
        queryKey: ['service-request-warehouse-options'],
        enabled: canManageMaterials,
        queryFn: async () => (await api.get('/warehouses')).data,
    });

    React.useEffect(() => {
        if (!request) return;
        setStatusValue(request.status);
        setBillingProjectId(request.billing_project_id || '');
        setWorkLogForm((current) => ({
            ...current,
            technician_user_id: current.technician_user_id || request.assignments?.[0]?.technician_user.id || user?.id || '',
        }));
        setMaterialForm((current) => ({
            ...current,
            technician_user_id: current.technician_user_id || request.assignments?.[0]?.technician_user.id || user?.id || '',
        }));
    }, [request, user?.id]);

    const refresh = async (nextMessage: string) => {
        setErrorText('');
        setMessage(nextMessage);
        await queryClient.invalidateQueries({ queryKey: ['service-request', id] });
        await queryClient.invalidateQueries({ queryKey: ['service-requests'] });
        await queryClient.invalidateQueries({ queryKey: ['service-protocol-preview', id] });
    };

    const fail = (error: any) =>
        setErrorText(error?.response?.data?.detail || t('serviceRequests.details.requestFailed', { defaultValue: 'Неуспешна заявка' }));

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
            await refresh(t('serviceRequests.details.messages.technicianAssigned', { defaultValue: 'Техникът е назначен.' }));
        },
        onError: fail,
    });

    const statusMutation = useMutation({
        mutationFn: async () => api.post(`/service-requests/${id}/status`, { status: statusValue }),
        onSuccess: async () =>
            refresh(
                t('serviceRequests.details.messages.statusUpdated', {
                    defaultValue: 'Статусът е обновен до {{status}}.',
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
            await refresh(t('serviceRequests.details.messages.billingProjectChanged', { defaultValue: 'Проектът за фактуриране и сервиз е обновен.' }));
        },
        onError: fail,
    });

    const workLogMutation = useMutation({
        mutationFn: async () => api.post('/work-logs', { request_id: id, ...workLogForm }),
        onSuccess: async () => {
            setWorkLogForm((current) => ({ ...current, activity_description: '' }));
            await refresh(t('serviceRequests.details.messages.workLogAdded', { defaultValue: 'Добавен е отчет за работа.' }));
        },
        onError: fail,
    });

    const materialMutation = useMutation({
        mutationFn: async () => api.post('/material-usages', { request_id: id, ...materialForm }),
        onSuccess: async () => {
            setMaterialForm((current) => ({
                ...current,
                material_id: '',
                warehouse_id: '',
                quantity: '1',
                unit: '',
                notes: '',
            }));
            await refresh(t('serviceRequests.details.messages.materialUsageAdded', { defaultValue: 'Добавен е изразходван материал.' }));
        },
        onError: fail,
    });

    const acceptMutation = useMutation({
        mutationFn: async (assignmentId: string) => api.post(`/service-assignments/${assignmentId}/accept`),
        onSuccess: async () => refresh(t('serviceRequests.details.messages.assignmentAccepted', { defaultValue: 'Задачата е приета.' })),
        onError: fail,
    });

    const rejectMutation = useMutation({
        mutationFn: async (assignmentId: string) => api.post(`/service-assignments/${assignmentId}/reject`, { reject_reason: rejectReason }),
        onSuccess: async () => {
            setRejectReason('');
            await refresh(t('serviceRequests.details.messages.assignmentRejected', { defaultValue: 'Задачата е отхвърлена.' }));
        },
        onError: fail,
    });

    const followUpMutation = useMutation({
        mutationFn: async () => {
            if (!request) {
                throw new Error(t('serviceRequests.details.requestNotLoaded', { defaultValue: 'Сервизната заявка не е заредена' }));
            }
            return api.post('/service-requests', {
                client_id: request.client.id,
                site_id: request.site.id,
                billing_project_id: request.billing_project_id,
                reported_problem: followUpProblem,
                reported_at: new Date().toISOString(),
                source: 'onsite',
                priority: 'standard',
                discovered_during_request_id: id,
            });
        },
        onSuccess: async () => {
            setFollowUpProblem('');
            await refresh(t('serviceRequests.details.messages.followUpCreated', { defaultValue: 'Създадена е последваща заявка.' }));
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
        return <Typography>{t('serviceRequests.details.loading', { defaultValue: 'Зареждане...' })}</Typography>;
    }

    if (isError || !request) {
        return (
            <Alert severity="error">
                {(error as any)?.response?.data?.detail || t('serviceRequests.details.requestFailed', { defaultValue: 'Неуспешна заявка' })}
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
                    <Button variant="outlined" onClick={exportProtocolPdf}>
                        {t('serviceRequests.details.exportPdf', { defaultValue: 'Експортирай PDF' })}
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/service-requests')}>
                        {t('serviceRequests.details.back', { defaultValue: 'Назад' })}
                    </Button>
                </Stack>
            </Box>

            {message && <Alert severity="success">{message}</Alert>}
            {errorText && <Alert severity="error">{errorText}</Alert>}

            <Card>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Typography>
                            <strong>{t('serviceRequests.details.problem', { defaultValue: 'Проблем' })}:</strong> {request.reported_problem}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.details.responsible', { defaultValue: 'Отговорник' })}:</strong> {request.responsible_user.full_name || request.responsible_user.email}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.details.received', { defaultValue: 'Получена' })}:</strong> {new Date(request.reported_at).toLocaleString(locale)}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.billing.project', { defaultValue: 'Проект за фактуриране и сервиз' })}:</strong> {request.project_reference_snapshot || '-'}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.billing.serviceTypeLabel', { defaultValue: 'Тип услуга' })}:</strong> {request.service_type_snapshot ? getBillingServiceTypeLabel(t, request.service_type_snapshot) : '-'}
                        </Typography>
                        <Typography>
                            <strong>{t('serviceRequests.billing.paymentModeLabel', { defaultValue: 'Режим на плащане' })}:</strong> {request.payment_mode_snapshot ? getBillingPaymentModeLabel(t, request.payment_mode_snapshot) : '-'}
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
                            {t('serviceRequests.details.assignments', { defaultValue: 'Назначения' })}
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
                                                    {t('serviceRequests.details.accept', { defaultValue: 'Приеми' })}
                                                </Button>
                                            )}
                                            {canReject && (
                                                <>
                                                    <TextField
                                                        size="small"
                                                        label={t('serviceRequests.details.rejectReason', { defaultValue: 'Причина за отказ' })}
                                                        value={rejectReason}
                                                        onChange={(event) => setRejectReason(event.target.value)}
                                                    />
                                                    <Button variant="outlined" color="error" onClick={() => rejectMutation.mutate(assignment.id)}>
                                                        {t('serviceRequests.details.reject', { defaultValue: 'Откажи' })}
                                                    </Button>
                                                </>
                                            )}
                                        </Stack>
                                    )}
                                </Box>
                            ))}
                            {canAssign && (
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>{t('serviceRequests.details.technician', { defaultValue: 'Техник' })}</InputLabel>
                                        <Select
                                            value={assignmentUserId}
                                            label={t('serviceRequests.details.technician', { defaultValue: 'Техник' })}
                                            onChange={(event) => setAssignmentUserId(event.target.value)}
                                        >
                                            {users.map((entry) => (
                                                <MenuItem key={entry.id} value={entry.id}>{entry.full_name || entry.email}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <Button variant="contained" disabled={!assignmentUserId} onClick={() => assignMutation.mutate()}>
                                        {t('serviceRequests.details.assign', { defaultValue: 'Назначи' })}
                                    </Button>
                                </Stack>
                            )}
                        </Stack>
                    </Paper>

                    {canEdit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.billing.changeTitle', { defaultValue: 'Смяна на проект за фактуриране и сервиз' })}
                            </Typography>
                            <Stack spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.billing.project', { defaultValue: 'Проект за фактуриране и сервиз' })}</InputLabel>
                                    <Select
                                        value={billingProjectId}
                                        label={t('serviceRequests.billing.project', { defaultValue: 'Проект за фактуриране и сервиз' })}
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
                                    label={t('serviceRequests.billing.changeReason', { defaultValue: 'Причина за промяна' })}
                                    value={billingProjectReason}
                                    onChange={(event) => setBillingProjectReason(event.target.value)}
                                />
                                <Button
                                    variant="contained"
                                    disabled={!billingProjectId || !billingProjectReason.trim() || billingProjectMutation.isPending}
                                    onClick={() => billingProjectMutation.mutate()}
                                >
                                    {t('serviceRequests.billing.applyChange', { defaultValue: 'Смени проекта за фактуриране и сервиз' })}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canEdit && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.statusSection', { defaultValue: 'Статус' })}
                            </Typography>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.statusSection', { defaultValue: 'Статус' })}</InputLabel>
                                    <Select
                                        value={statusValue}
                                        label={t('serviceRequests.details.statusSection', { defaultValue: 'Статус' })}
                                        onChange={(event) => setStatusValue(event.target.value)}
                                    >
                                        {requestStatusValues.map((status) => (
                                            <MenuItem key={status} value={status}>{getRequestStatusLabel(t, status)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button variant="contained" onClick={() => statusMutation.mutate()}>
                                    {t('serviceRequests.details.apply', { defaultValue: 'Приложи' })}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canManageWork && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.addWorkLog', { defaultValue: 'Добави отчет за работа' })}
                            </Typography>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <TextField size="small" type="date" label={t('serviceRequests.details.date', { defaultValue: 'Дата' })} InputLabelProps={{ shrink: true }} value={workLogForm.work_date} onChange={(event) => setWorkLogForm((current) => ({ ...current, work_date: event.target.value }))} fullWidth />
                                    <TextField size="small" type="time" label={t('serviceRequests.details.from', { defaultValue: 'От' })} InputLabelProps={{ shrink: true }} value={workLogForm.time_from} onChange={(event) => setWorkLogForm((current) => ({ ...current, time_from: event.target.value }))} fullWidth />
                                    <TextField size="small" type="time" label={t('serviceRequests.details.to', { defaultValue: 'До' })} InputLabelProps={{ shrink: true }} value={workLogForm.time_to} onChange={(event) => setWorkLogForm((current) => ({ ...current, time_to: event.target.value }))} fullWidth />
                                </Stack>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.technician', { defaultValue: 'Техник' })}</InputLabel>
                                    <Select value={workLogForm.technician_user_id} label={t('serviceRequests.details.technician', { defaultValue: 'Техник' })} onChange={(event) => setWorkLogForm((current) => ({ ...current, technician_user_id: event.target.value }))}>
                                        {assignments.map((assignment) => (
                                            <MenuItem key={assignment.id} value={assignment.technician_user.id}>
                                                {assignment.technician_user.full_name || assignment.technician_user.email}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField size="small" label={t('serviceRequests.details.activityDescription', { defaultValue: 'Описание на дейността' })} multiline minRows={3} value={workLogForm.activity_description} onChange={(event) => setWorkLogForm((current) => ({ ...current, activity_description: event.target.value }))} />
                                <Button variant="contained" disabled={!workLogForm.activity_description} onClick={() => workLogMutation.mutate()}>
                                    {t('serviceRequests.details.addWorkLogAction', { defaultValue: 'Добави отчет' })}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canManageMaterials && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.materialUsage', { defaultValue: 'Разход на материали' })}
                            </Typography>
                            <Stack spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.material', { defaultValue: 'Материал' })}</InputLabel>
                                    <Select value={materialForm.material_id} label={t('serviceRequests.details.material', { defaultValue: 'Материал' })} onChange={(event) => setMaterialForm((current) => ({ ...current, material_id: event.target.value, unit: '' }))}>
                                        {materials.map((entry) => (
                                            <MenuItem key={entry.id} value={entry.id}>{entry.erp_code} - {entry.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>{t('serviceRequests.details.warehouse', { defaultValue: 'Склад' })}</InputLabel>
                                        <Select value={materialForm.warehouse_id} label={t('serviceRequests.details.warehouse', { defaultValue: 'Склад' })} onChange={(event) => setMaterialForm((current) => ({ ...current, warehouse_id: event.target.value }))}>
                                            {warehouses.map((entry) => (
                                                <MenuItem key={entry.id} value={entry.id}>{entry.code} - {entry.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <TextField size="small" label={t('serviceRequests.details.quantity', { defaultValue: 'Количество' })} value={materialForm.quantity} onChange={(event) => setMaterialForm((current) => ({ ...current, quantity: event.target.value }))} fullWidth />
                                    <TextField size="small" label={t('serviceRequests.details.unit', { defaultValue: 'Мярка' })} value={materialForm.unit} onChange={(event) => setMaterialForm((current) => ({ ...current, unit: event.target.value }))} fullWidth />
                                </Stack>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>{t('serviceRequests.details.technician', { defaultValue: 'Техник' })}</InputLabel>
                                    <Select value={materialForm.technician_user_id} label={t('serviceRequests.details.technician', { defaultValue: 'Техник' })} onChange={(event) => setMaterialForm((current) => ({ ...current, technician_user_id: event.target.value }))}>
                                        {assignments.map((assignment) => (
                                            <MenuItem key={assignment.id} value={assignment.technician_user.id}>
                                                {assignment.technician_user.full_name || assignment.technician_user.email}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField size="small" label={t('serviceRequests.details.notes', { defaultValue: 'Бележки' })} value={materialForm.notes} onChange={(event) => setMaterialForm((current) => ({ ...current, notes: event.target.value }))} />
                                <Button variant="contained" disabled={!materialForm.material_id || !materialForm.warehouse_id} onClick={() => materialMutation.mutate()}>
                                    {t('serviceRequests.details.addMaterialUsage', { defaultValue: 'Добави материал' })}
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    {canCreateFollowUp && (
                        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                {t('serviceRequests.details.followUpTitle', { defaultValue: 'Последваща заявка от обекта' })}
                            </Typography>
                            <Stack spacing={2}>
                                <TextField
                                    size="small"
                                    label={t('serviceRequests.details.followUpProblem', { defaultValue: 'Нов проблем, открит на място' })}
                                    multiline
                                    minRows={3}
                                    value={followUpProblem}
                                    onChange={(event) => setFollowUpProblem(event.target.value)}
                                />
                                <Button variant="contained" disabled={!followUpProblem} onClick={() => followUpMutation.mutate()}>
                                    {t('serviceRequests.details.createFollowUp', { defaultValue: 'Създай последваща заявка' })}
                                </Button>
                            </Stack>
                        </Paper>
                    )}
                </Stack>

                <Stack spacing={3} sx={{ flex: 1 }}>
                    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            {t('serviceRequests.details.protocolPreview', { defaultValue: 'Преглед на протокол' })}
                        </Typography>
                        {!protocol ? (
                            <Typography color="text.secondary">
                                {t('serviceRequests.details.protocolEmpty', {
                                    defaultValue: 'Прегледът на протокола ще се появи след запис на данните за изпълнение.',
                                })}
                            </Typography>
                        ) : (
                            <Stack spacing={1}>
                                <Typography><strong>{t('serviceRequests.details.executionDate', { defaultValue: 'Дата на изпълнение' })}:</strong> {protocol.execution_date || '-'}</Typography>
                                <Typography><strong>{t('serviceRequests.details.time', { defaultValue: 'Време' })}:</strong> {protocol.worked_time_from || '-'} - {protocol.worked_time_to || '-'}</Typography>
                                <Typography><strong>{t('serviceRequests.details.technicians', { defaultValue: 'Техници' })}:</strong> {protocol.technicians.join(', ') || '-'}</Typography>
                                <Typography><strong>{t('serviceRequests.details.total', { defaultValue: 'Общо' })}:</strong> {minutesToHours(protocol.total_minutes)}</Typography>
                                <Typography variant="body2"><strong>{t('serviceRequests.details.work', { defaultValue: 'Извършена работа' })}:</strong> {protocol.work_description || '-'}</Typography>
                            </Stack>
                        )}
                    </Paper>

                    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            {t('serviceRequests.details.executionLog', { defaultValue: 'Дневник на изпълнението' })}
                        </Typography>
                        <Stack spacing={1.5}>
                            {workLogs.length === 0 ? (
                                <Typography color="text.secondary">
                                    {t('serviceRequests.details.noWorkLogs', { defaultValue: 'Все още няма отчети за работа.' })}
                                </Typography>
                            ) : (
                                workLogs.map((log) => (
                                    <Box key={log.id}>
                                        <Typography sx={{ fontWeight: 600 }}>
                                            {log.technician_user.full_name || log.technician_user.email}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {log.work_date} {log.time_from} - {log.time_to} | {log.activity_description}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                            {materialUsages.length > 0 && (
                                <>
                                    <Typography variant="subtitle2" sx={{ pt: 1 }}>
                                        {t('serviceRequests.details.materials', { defaultValue: 'Материали' })}
                                    </Typography>
                                    {materialUsages.map((usage) => (
                                        <Box key={usage.id}>
                                            <Typography sx={{ fontWeight: 600 }}>
                                                {usage.material.erp_code} - {usage.material.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {usage.quantity} {usage.unit} {t('serviceRequests.details.fromWarehouse', { defaultValue: 'от' })} {usage.warehouse.code}
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
