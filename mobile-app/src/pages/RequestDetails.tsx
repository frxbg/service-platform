import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '../api/axios';
import MobileLayout from '../components/MobileLayout';
import SignaturePad from '../components/SignaturePad';
import { useAuth } from '../context/AuthContext';
import StatusPill from '../components/StatusPill';
import type {
  MobileMaterialOption,
  MobileRequestDetail,
  MobileRequestMutationResponse,
  MobileWarehouseOption,
} from '../types/mobile';
import { buildDialLink, buildNavigationLink, openExternalLink } from '../utils/mobileLinks';
import {
  formatDateTime,
  formatMinutes,
  translateAssignmentStatus,
  translatePriority,
  translateSource,
} from '../utils/requestPresentation';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value || '-'}</Typography>
    </Stack>
  );
}

function defaultDateValue() {
  return new Date().toISOString().slice(0, 10);
}

type SignatureRole = 'technician' | 'client';

export default function RequestDetailsPage() {
  const { requestId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [workLogDialogOpen, setWorkLogDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [signatureDialogRole, setSignatureDialogRole] = useState<SignatureRole | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [signatureDraft, setSignatureDraft] = useState({
    signer_name: '',
    signature_image_data: null as string | null,
    has_signature: false,
  });
  const [workLogDraft, setWorkLogDraft] = useState({
    work_date: defaultDateValue(),
    time_from: '09:00',
    time_to: '10:00',
    activity_description: '',
    repair_type_code: '',
    is_holiday_override: false,
  });
  const [materialDraft, setMaterialDraft] = useState({
    material_id: '',
    warehouse_id: '',
    quantity: '1',
    unit: '',
    notes: '',
  });

  const invalidateRequestData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mobile-workboard'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-request', requestId] }),
    ]);
  };

  const requestQuery = useQuery({
    queryKey: ['mobile-request', requestId],
    queryFn: async () => {
      const { data } = await api.get<MobileRequestDetail>(`/mobile/requests/${requestId}`);
      return data;
    },
    enabled: Boolean(requestId),
  });

  const warehouseQuery = useQuery({
    queryKey: ['mobile-warehouses'],
    queryFn: async () => {
      const { data } = await api.get<MobileWarehouseOption[]>('/mobile/warehouses');
      return data;
    },
    enabled: materialDialogOpen,
  });

  const materialOptionsQuery = useQuery({
    queryKey: ['mobile-material-options', materialSearch],
    queryFn: async () => {
      const { data } = await api.get<MobileMaterialOption[]>('/mobile/materials', {
        params: {
          search: materialSearch || undefined,
          limit: 20,
        },
      });
      return data;
    },
    enabled: materialDialogOpen,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MobileRequestMutationResponse>(`/mobile/requests/${requestId}/accept`);
      return data;
    },
    onSuccess: async () => {
      setToastMessage(t('requestDetails.acceptSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.acceptError'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/reject`,
        { reject_reason: rejectReason },
      );
      return data;
    },
    onSuccess: async () => {
      setRejectDialogOpen(false);
      setRejectReason('');
      setToastMessage(t('requestDetails.rejectSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.rejectError'));
    },
  });

  const startWorkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/start-work`,
      );
      return data;
    },
    onSuccess: async () => {
      setToastMessage(t('requestDetails.startWorkSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.startWorkError'));
    },
  });

  const workLogMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/work-logs`,
        workLogDraft,
      );
      return data;
    },
    onSuccess: async () => {
      setWorkLogDialogOpen(false);
      setWorkLogDraft({
        work_date: defaultDateValue(),
        time_from: '09:00',
        time_to: '10:00',
        activity_description: '',
        repair_type_code: '',
        is_holiday_override: false,
      });
      setToastMessage(t('requestDetails.workLogSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.workLogError'));
    },
  });

  const materialMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/material-usages`,
        {
          ...materialDraft,
          quantity: Number(materialDraft.quantity),
        },
      );
      return data;
    },
    onSuccess: async () => {
      setMaterialDialogOpen(false);
      setMaterialSearch('');
      setMaterialDraft({
        material_id: '',
        warehouse_id: '',
        quantity: '1',
        unit: '',
        notes: '',
      });
      setToastMessage(t('requestDetails.materialSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.materialError'));
    },
  });

  const signatureMutation = useMutation({
    mutationFn: async (role: SignatureRole) => {
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/signatures`,
        {
          signer_role: role,
          signer_name: signatureDraft.signer_name,
          signature_image_data: signatureDraft.signature_image_data,
          device_info: navigator.userAgent,
        },
      );
      return data;
    },
    onSuccess: async () => {
      setSignatureDialogRole(null);
      setSignatureDraft({
        signer_name: '',
        signature_image_data: null,
        has_signature: false,
      });
      setToastMessage(t('requestDetails.signatureSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.signatureError'));
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MobileRequestMutationResponse>(`/mobile/requests/${requestId}/complete`);
      return data;
    },
    onSuccess: async () => {
      setToastMessage(t('requestDetails.completeSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      setToastMessage(t('requestDetails.completeError'));
    },
  });

  const request = requestQuery.data;
  const navigateLink = buildNavigationLink(request?.address);
  const dialLink = buildDialLink(request?.contact_phone);
  const signaturesByRole = useMemo(
    () => ({
      technician: request?.signatures.find((signature) => signature.signer_role === 'technician') || null,
      client: request?.signatures.find((signature) => signature.signer_role === 'client') || null,
    }),
    [request?.signatures],
  );
  const selectedMaterial = useMemo(
    () =>
      materialOptionsQuery.data?.find((item) => item.id === materialDraft.material_id) || null,
    [materialDraft.material_id, materialOptionsQuery.data],
  );

  const isTerminalRequest = ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(request?.status || '');
  const canReject =
    (request?.current_assignment_status === 'pending' || request?.current_assignment_status === 'accepted') &&
    !['IN_PROGRESS', 'WAITING_PARTS', 'WAITING_CLIENT', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(
      request?.status || '',
    );
  const canStartWork =
    request?.assigned_to_me &&
    ['pending', 'accepted'].includes(request.current_assignment_status || '') &&
    !['IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(request.status);
  const canAddOperationalEntries =
    request?.assigned_to_me &&
    ['accepted', 'pending'].includes(request.current_assignment_status || '') &&
    !isTerminalRequest;
  const canCaptureSignatures = Boolean(request?.assigned_to_me) && !isTerminalRequest;
  const canCompleteRequest = Boolean(request?.can_complete) && !isTerminalRequest;

  const defaultSignerName = (role: SignatureRole) => {
    if (role === 'technician') {
      return user?.full_name || user?.email || t('forms.technicianSignerDefault');
    }
    return request?.contact_name || request?.client_name || t('forms.clientSignerDefault');
  };

  const openSignatureDialog = (role: SignatureRole) => {
    setSignatureDraft({
      signer_name: signaturesByRole[role]?.signer_name || defaultSignerName(role),
      signature_image_data: null,
      has_signature: false,
    });
    setSignatureDialogRole(role);
  };

  const openProtocolPdf = async () => {
    const response = await api.get(`/service-protocols/${requestId}/pdf`, { responseType: 'blob' });
    const fileUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <MobileLayout
      title={
        request
          ? t('requestDetails.title', { number: request.request_number })
          : t('navigation.requestDetails')
      }
      showBack
    >
      {requestQuery.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8, gap: 2 }}>
          <CircularProgress />
          <Typography>{t('common.loading')}</Typography>
        </Box>
      ) : null}

      {requestQuery.isError ? <Alert severity="error">{t('requestDetails.loadError')}</Alert> : null}

      {request ? (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box>
                    <Typography variant="h5">{request.request_number}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {request.client_name}
                    </Typography>
                  </Box>
                  <StatusPill status={request.status} />
                </Stack>

                <Alert severity="info">{t('requestDetails.operationalOnly')}</Alert>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={translatePriority(request.priority, t)} />
                  {request.current_assignment_status ? (
                    <Chip
                      color="info"
                      label={translateAssignmentStatus(request.current_assignment_status, t)}
                    />
                  ) : null}
                </Stack>

                <Typography variant="body1">{request.problem_summary}</Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.quickActions')}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {request.available_to_accept || request.current_assignment_status === 'pending' ? (
                    <Button
                      variant="contained"
                      color="secondary"
                      disabled={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate()}
                    >
                      {t('requestDetails.accept')}
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={rejectMutation.isPending}
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      {t('requestDetails.reject')}
                    </Button>
                  ) : null}
                  {canStartWork ? (
                    <Button
                      variant="outlined"
                      disabled={startWorkMutation.isPending}
                      onClick={() => startWorkMutation.mutate()}
                    >
                      {t('requestDetails.startWork')}
                    </Button>
                  ) : null}
                  {canAddOperationalEntries ? (
                    <Button variant="outlined" onClick={() => setWorkLogDialogOpen(true)}>
                      {t('requestDetails.addWorkLog')}
                    </Button>
                  ) : null}
                  {canAddOperationalEntries ? (
                    <Button variant="outlined" onClick={() => setMaterialDialogOpen(true)}>
                      {t('requestDetails.addMaterial')}
                    </Button>
                  ) : null}
                  {canCaptureSignatures ? (
                    <Button variant="outlined" onClick={() => openSignatureDialog('technician')}>
                      {signaturesByRole.technician
                        ? t('requestDetails.replaceSignature')
                        : t('requestDetails.captureTechnicianSignature')}
                    </Button>
                  ) : null}
                  {canCaptureSignatures ? (
                    <Button variant="outlined" onClick={() => openSignatureDialog('client')}>
                      {signaturesByRole.client
                        ? t('requestDetails.replaceClientSignature')
                        : t('requestDetails.captureClientSignature')}
                    </Button>
                  ) : null}
                  {request?.assigned_to_me ? (
                    <Button
                      variant="contained"
                      color="success"
                      disabled={!canCompleteRequest || completeMutation.isPending}
                      onClick={() => completeMutation.mutate()}
                    >
                      {t('requestDetails.complete')}
                    </Button>
                  ) : null}
                  {navigateLink ? (
                    <Button variant="outlined" onClick={() => openExternalLink(navigateLink)}>
                      {t('requestDetails.navigate')}
                    </Button>
                  ) : null}
                  {dialLink ? (
                    <Button variant="outlined" onClick={() => openExternalLink(dialLink)}>
                      {t('requestDetails.call')}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.protocol')}
                </Typography>
                <Alert severity="info">{t('requestDetails.protocolNote')}</Alert>
                <Alert severity={request.can_complete ? 'success' : 'warning'}>
                  {request.can_complete
                    ? t('requestDetails.signatureReady')
                    : t('requestDetails.signatureMissing')}
                </Alert>
                <Stack spacing={1.5}>
                  {(['technician', 'client'] as SignatureRole[]).map((role) => {
                    const signature = signaturesByRole[role];
                    const title =
                      role === 'technician'
                        ? t('requestDetails.technicianSignature')
                        : t('requestDetails.clientSignature');

                    return (
                      <Box
                        key={role}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.5,
                          bgcolor: 'rgba(255,255,255,0.65)',
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {title}
                            </Typography>
                            <Chip
                              size="small"
                              color={signature ? 'success' : 'default'}
                              label={
                                signature
                                  ? t('requestDetails.signatureCaptured')
                                  : t('requestDetails.signaturePending')
                              }
                            />
                          </Stack>
                          {signature ? (
                            <Stack spacing={1}>
                              <Box
                                component="img"
                                src={signature.signature_image_data}
                                alt={title}
                                sx={{
                                  width: '100%',
                                  maxHeight: 120,
                                  objectFit: 'contain',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1.5,
                                  bgcolor: '#ffffff',
                                }}
                              />
                              <Typography variant="caption" color="text.secondary" display="block">
                                {t('requestDetails.signedBy')}: {signature.signer_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {t('requestDetails.signedAt')}:{' '}
                                {formatDateTime(
                                  signature.signed_at,
                                  i18n.resolvedLanguage || i18n.language,
                                )}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('requestDetails.signaturePending')}
                            </Typography>
                          )}
                          {canCaptureSignatures ? (
                            <Button variant="text" onClick={() => openSignatureDialog(role)}>
                              {signature
                                ? t('requestDetails.replaceSignature')
                                : t('requestDetails.captureSignature')}
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
                {request?.assigned_to_me ? (
                  <Typography variant="caption" color="text.secondary">
                    {request.can_complete
                      ? t('requestDetails.completeReadyHint')
                      : t('requestDetails.completeBlockedHint')}
                  </Typography>
                ) : null}
                <Button variant="outlined" onClick={() => void openProtocolPdf()}>
                  {t('requestDetails.protocolPdf')}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.summary')}
                </Typography>
                <DetailRow
                  label={t('requestDetails.requestStatus')}
                  value={<StatusPill status={request.status} />}
                />
                <DetailRow
                  label={t('requestDetails.assignmentStatus')}
                  value={
                    request.current_assignment_status
                      ? translateAssignmentStatus(request.current_assignment_status, t)
                      : t('common.notAvailable')
                  }
                />
                <Divider />
                <DetailRow
                  label={t('requestDetails.reportedAt')}
                  value={formatDateTime(request.reported_at, i18n.resolvedLanguage || i18n.language)}
                />
                <DetailRow label={t('requestDetails.client')} value={request.client_name} />
                <DetailRow label={t('requestDetails.site')} value={request.site_name || request.site_code} />
                <DetailRow
                  label={t('requestDetails.address')}
                  value={request.address || t('common.notAvailable')}
                />
                <DetailRow
                  label={t('requestDetails.contact')}
                  value={request.contact_name || t('common.notAvailable')}
                />
                <DetailRow
                  label={t('requestDetails.phone')}
                  value={request.contact_phone || t('common.notAvailable')}
                />
                <DetailRow
                  label={t('requestDetails.source')}
                  value={translateSource(request.source, t)}
                />
                <DetailRow label={t('requestDetails.problem')} value={request.problem_summary} />
                <DetailRow
                  label={t('requestDetails.notesClient')}
                  value={request.notes_client || t('common.notAvailable')}
                />
              </Stack>
            </CardContent>
          </Card>

          {request.billing_project ? (
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('requestDetails.billingProject')}
                  </Typography>
                  <DetailRow
                    label={t('requestDetails.projectReference')}
                    value={request.billing_project.project_reference}
                  />
                  <DetailRow
                    label={t('requestDetails.serviceType')}
                    value={request.billing_project.service_type}
                  />
                  <DetailRow
                    label={t('requestDetails.paymentMode')}
                    value={request.billing_project.payment_mode}
                  />
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.technicians')}
                </Typography>
                {request.assignments.length ? (
                  request.assignments.map((assignment) => (
                    <Box key={assignment.id}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {assignment.technician_user.full_name || assignment.technician_user.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {translateAssignmentStatus(assignment.assignment_status, t)}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('common.notAvailable')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.workLogs')}
                </Typography>
                {request.work_logs.length ? (
                  request.work_logs.map((log) => (
                    <Box key={log.id}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {log.activity_description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('fields.technician')}: {log.technician_user.full_name || log.technician_user.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('fields.time')}: {log.time_from} - {log.time_to}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('fields.duration')}: {formatMinutes(log.minutes_total, t)}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('requestDetails.emptyWorkLogs')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.materials')}
                </Typography>
                {request.material_usages.length ? (
                  request.material_usages.map((usage) => (
                    <Box key={usage.id}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {usage.material.erp_code} - {usage.material.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('fields.quantity')}: {usage.quantity} {usage.unit}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('fields.warehouse')}: {usage.warehouse.code} - {usage.warehouse.name}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('requestDetails.emptyMaterials')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('requestDetails.equipment')}
                </Typography>
                {request.equipment_assets.length ? (
                  request.equipment_assets.map((asset) => (
                    <Box key={asset.id}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {asset.equipment_type}
                      </Typography>
                      {asset.manufacturer ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('fields.manufacturer')}: {asset.manufacturer}
                        </Typography>
                      ) : null}
                      {asset.model ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('fields.model')}: {asset.model}
                        </Typography>
                      ) : null}
                      {asset.serial_number ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('fields.serialNumber')}: {asset.serial_number}
                        </Typography>
                      ) : null}
                      {asset.asset_tag ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('fields.assetTag')}: {asset.asset_tag}
                        </Typography>
                      ) : null}
                      {asset.location_note ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('fields.locationNote')}: {asset.location_note}
                        </Typography>
                      ) : null}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('requestDetails.emptyEquipment')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      ) : null}

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('forms.rejectTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('forms.rejectReason')}
            fullWidth
            multiline
            minRows={3}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!rejectReason.trim() || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate()}
          >
            {t('requestDetails.reject')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={workLogDialogOpen} onClose={() => setWorkLogDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('forms.workLogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('forms.workDate')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={workLogDraft.work_date}
              onChange={(event) =>
                setWorkLogDraft((current) => ({ ...current, work_date: event.target.value }))
              }
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('forms.timeFrom')}
                type="time"
                InputLabelProps={{ shrink: true }}
                value={workLogDraft.time_from}
                onChange={(event) =>
                  setWorkLogDraft((current) => ({ ...current, time_from: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label={t('forms.timeTo')}
                type="time"
                InputLabelProps={{ shrink: true }}
                value={workLogDraft.time_to}
                onChange={(event) =>
                  setWorkLogDraft((current) => ({ ...current, time_to: event.target.value }))
                }
                fullWidth
              />
            </Stack>
            <TextField
              label={t('forms.activityDescription')}
              multiline
              minRows={3}
              value={workLogDraft.activity_description}
              onChange={(event) =>
                setWorkLogDraft((current) => ({
                  ...current,
                  activity_description: event.target.value,
                }))
              }
            />
            <TextField
              label={t('forms.repairType')}
              value={workLogDraft.repair_type_code}
              onChange={(event) =>
                setWorkLogDraft((current) => ({ ...current, repair_type_code: event.target.value }))
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={workLogDraft.is_holiday_override}
                  onChange={(event) =>
                    setWorkLogDraft((current) => ({
                      ...current,
                      is_holiday_override: event.target.checked,
                    }))
                  }
                />
              }
              label={t('forms.holidayOverride')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkLogDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!workLogDraft.activity_description.trim() || workLogMutation.isPending}
            onClick={() => workLogMutation.mutate()}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={materialDialogOpen} onClose={() => setMaterialDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('forms.materialTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('forms.searchMaterial')}
              value={materialSearch}
              onChange={(event) => setMaterialSearch(event.target.value)}
            />
            <TextField
              select
              label={t('forms.selectMaterial')}
              value={materialDraft.material_id}
              onChange={(event) => {
                const nextId = event.target.value;
                const nextMaterial =
                  materialOptionsQuery.data?.find((item) => item.id === nextId) || null;
                setMaterialDraft((current) => ({
                  ...current,
                  material_id: nextId,
                  unit: nextMaterial?.unit || current.unit,
                }));
              }}
              helperText={
                materialOptionsQuery.isLoading ? t('common.loading') : selectedMaterial?.description || ' '
              }
            >
              {(materialOptionsQuery.data || []).map((material) => (
                <MenuItem key={material.id} value={material.id}>
                  {material.erp_code} - {material.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('forms.selectWarehouse')}
              value={materialDraft.warehouse_id}
              onChange={(event) =>
                setMaterialDraft((current) => ({ ...current, warehouse_id: event.target.value }))
              }
              helperText={warehouseQuery.isLoading ? t('common.loading') : ' '}
            >
              {(warehouseQuery.data || []).map((warehouse) => (
                <MenuItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('forms.quantity')}
                type="number"
                inputProps={{ min: '0.01', step: '0.01' }}
                value={materialDraft.quantity}
                onChange={(event) =>
                  setMaterialDraft((current) => ({ ...current, quantity: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label={t('forms.unit')}
                value={materialDraft.unit}
                onChange={(event) =>
                  setMaterialDraft((current) => ({ ...current, unit: event.target.value }))
                }
                fullWidth
              />
            </Stack>
            <TextField
              label={t('forms.notes')}
              multiline
              minRows={2}
              value={materialDraft.notes}
              onChange={(event) =>
                setMaterialDraft((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaterialDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={
              !materialDraft.material_id ||
              !materialDraft.warehouse_id ||
              !materialDraft.quantity ||
              materialMutation.isPending
            }
            onClick={() => materialMutation.mutate()}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(signatureDialogRole)}
        onClose={() => setSignatureDialogRole(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {signatureDialogRole === 'technician'
            ? t('requestDetails.technicianSignature')
            : t('requestDetails.clientSignature')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('forms.signerName')}
              value={signatureDraft.signer_name}
              onChange={(event) =>
                setSignatureDraft((current) => ({ ...current, signer_name: event.target.value }))
              }
              fullWidth
            />
            <SignaturePad
              key={signatureDialogRole || 'signature'}
              onChange={({ imageDataUrl, hasSignature }) =>
                setSignatureDraft((current) => ({
                  ...current,
                  signature_image_data: imageDataUrl,
                  has_signature: hasSignature,
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignatureDialogRole(null)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={
              !signatureDialogRole ||
              !signatureDraft.signer_name.trim() ||
              !signatureDraft.has_signature ||
              !signatureDraft.signature_image_data ||
              signatureMutation.isPending
            }
            onClick={() => signatureDialogRole && signatureMutation.mutate(signatureDialogRole)}
          >
            {t('forms.saveSignature')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </MobileLayout>
  );
}
