import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import BarcodeScannerDialog from '../components/BarcodeScannerDialog';
import MobileLayout from '../components/MobileLayout';
import SignaturePad from '../components/SignaturePad';
import { useAuth } from '../context/AuthContext';
import StatusPill from '../components/StatusPill';
import type {
  MobileMaterialOption,
  MobileRequestDetail,
  MobileRequestMutationResponse,
  MobileSiteDetail,
  MobileWarehouseOption,
} from '../types/mobile';
import { buildDialLink, buildNavigationLink, openExternalLink } from '../utils/mobileLinks';
import {
  formatDate,
  formatDateTime,
  formatEquipmentLabel,
  formatMinutes,
  formatTimeRange,
  getSuggestedWorkLogTiming,
  isValidTimeRange,
  toLocalDateInputValue,
  translateAssignmentStatus,
  translatePriority,
  translateSource,
} from '../utils/requestPresentation';
import {
  OFFLINE_DRAFT_KINDS,
  clearOfflineDraft,
  loadAllOfflineDrafts,
  saveOfflineDraft,
  type OfflineDraftKind,
  type OfflineDraftRecord,
} from '../utils/offlineDrafts';
import { getCurrentCoordinates } from '../utils/geolocation';

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

type SignatureRole = 'technician' | 'client';
type WorkLogDraft = ReturnType<typeof createDefaultWorkLogDraft>;

interface MaterialDraft {
  material_id: string;
  warehouse_id: string;
  quantity: string;
  unit: string;
  notes: string;
}

interface MaterialOfflineDraft extends MaterialDraft {
  search: string;
}

interface EquipmentDraft {
  equipment_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  asset_tag: string;
  location_note: string;
  refrigerant: string;
  notes: string;
}

interface EquipmentOfflineDraft extends EquipmentDraft {
  selectedSiteEquipmentKey: string;
}

interface SignatureDraft {
  role: SignatureRole | null;
  signer_name: string;
  signature_image_data: string | null;
  has_signature: boolean;
}

type TravelLogEntry = MobileRequestDetail['travel_logs'][number];

interface TravelReviewDraft {
  travel_log_id: string;
  final_duration_minutes: string;
  final_distance_km: string;
  manual_adjustment_note: string;
}

function createDefaultWorkLogDraft() {
  return {
    ...getSuggestedWorkLogTiming(),
    activity_description: '',
    repair_type_code: '',
    is_holiday_override: false,
  };
}

function createEmptyMaterialDraft(): MaterialDraft {
  return {
    material_id: '',
    warehouse_id: '',
    quantity: '1',
    unit: '',
    notes: '',
  };
}

function createEmptyEquipmentDraft(): EquipmentDraft {
  return {
    equipment_type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    location_note: '',
    refrigerant: '',
    notes: '',
  };
}

function createEmptySignatureDraft(role: SignatureRole | null = null): SignatureDraft {
  return {
    role,
    signer_name: '',
    signature_image_data: null,
    has_signature: false,
  };
}

function isMeaningfulWorkLogDraft(draft: WorkLogDraft) {
  return Boolean(
    draft.activity_description.trim() || draft.repair_type_code.trim() || draft.is_holiday_override,
  );
}

function isMeaningfulMaterialDraft(draft: MaterialOfflineDraft) {
  return Boolean(
    draft.material_id ||
      draft.warehouse_id ||
      draft.notes.trim() ||
      draft.search.trim() ||
      draft.unit.trim() ||
      draft.quantity !== '1',
  );
}

function isMeaningfulEquipmentDraft(draft: EquipmentOfflineDraft) {
  return Boolean(
    draft.selectedSiteEquipmentKey ||
      draft.equipment_type.trim() ||
      draft.manufacturer.trim() ||
      draft.model.trim() ||
      draft.serial_number.trim() ||
      draft.asset_tag.trim() ||
      draft.location_note.trim() ||
      draft.refrigerant.trim() ||
      draft.notes.trim(),
  );
}

function isMeaningfulSignatureDraft(draft: SignatureDraft) {
  return Boolean(draft.role || draft.signer_name.trim() || draft.has_signature || draft.signature_image_data);
}

function createTravelReviewDraft(log: TravelLogEntry): TravelReviewDraft {
  return {
    travel_log_id: log.id,
    final_duration_minutes:
      log.final_duration_minutes !== null && log.final_duration_minutes !== undefined
        ? String(log.final_duration_minutes)
        : '',
    final_distance_km:
      log.final_distance_km !== null && log.final_distance_km !== undefined
        ? String(log.final_distance_km)
        : '',
    manual_adjustment_note: log.manual_adjustment_note || '',
  };
}

function formatRunningDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function RequestDetailsPage() {
  const { requestId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [workLogDialogOpen, setWorkLogDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialScannerOpen, setMaterialScannerOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [travelReviewDialogOpen, setTravelReviewDialogOpen] = useState(false);
  const [selectedSiteEquipmentKey, setSelectedSiteEquipmentKey] = useState('');
  const [signatureDialogRole, setSignatureDialogRole] = useState<SignatureRole | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [travelTick, setTravelTick] = useState(() => Date.now());
  const [signatureDraft, setSignatureDraft] = useState<SignatureDraft>(() => createEmptySignatureDraft());
  const [workLogDraft, setWorkLogDraft] = useState(() => createDefaultWorkLogDraft());
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(() => createEmptyMaterialDraft());
  const [equipmentDraft, setEquipmentDraft] = useState<EquipmentDraft>(() => createEmptyEquipmentDraft());
  const [travelReviewDraft, setTravelReviewDraft] = useState<TravelReviewDraft | null>(null);
  const [offlineDrafts, setOfflineDrafts] = useState<Partial<Record<OfflineDraftKind, OfflineDraftRecord>>>({});

  const persistOfflineDraft = <T,>(
    kind: OfflineDraftKind,
    payload: T | null,
    status: OfflineDraftRecord<T>['status'] = 'local_draft',
    lastError: string | null = null,
  ) => {
    const record = saveOfflineDraft(requestId, kind, payload, { status, lastError });
    if (record) {
      setOfflineDrafts((current) => ({ ...current, [kind]: record as OfflineDraftRecord }));
    }
    return record;
  };

  const removeOfflineDraft = (kind: OfflineDraftKind) => {
    clearOfflineDraft(requestId, kind);
    setOfflineDrafts((current) => {
      const next = { ...current };
      delete next[kind];
      return next;
    });
  };

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

  const siteDetailQuery = useQuery({
    queryKey: ['mobile-site', requestQuery.data?.site_id],
    queryFn: async () => {
      const { data } = await api.get<MobileSiteDetail>(`/mobile/sites/${requestQuery.data?.site_id}`);
      return data;
    },
    enabled: Boolean(requestQuery.data?.site_id),
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

  const startTravelMutation = useMutation({
    mutationFn: async () => {
      const coordinates = await getCurrentCoordinates();
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/travel/start`,
        {
          started_at: new Date().toISOString(),
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
        },
      );
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['mobile-request', requestId], data.request);
      setToastMessage(t('requestDetails.startTravelSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['mobile-workboard'] });
    },
    onError: () => {
      setToastMessage(t('requestDetails.startTravelError'));
    },
  });

  const stopTravelMutation = useMutation({
    mutationFn: async () => {
      const coordinates = await getCurrentCoordinates();
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/travel/stop`,
        {
          ended_at: new Date().toISOString(),
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
        },
      );
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['mobile-request', requestId], data.request);
      const latestTravelLog = [...(data.request.travel_logs || [])]
        .filter((log) => log.technician_user.id === user?.id && !log.is_active)
        .sort((left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime())[0];
      if (latestTravelLog) {
        setTravelReviewDraft(createTravelReviewDraft(latestTravelLog));
        setTravelReviewDialogOpen(true);
      }
      setToastMessage(t('requestDetails.stopTravelSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['mobile-workboard'] });
    },
    onError: () => {
      setToastMessage(t('requestDetails.stopTravelError'));
    },
  });

  const updateTravelMutation = useMutation({
    mutationFn: async () => {
      if (!travelReviewDraft) {
        throw new Error('Travel review draft is missing');
      }

      const { data } = await api.patch<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/travel/${travelReviewDraft.travel_log_id}`,
        {
          final_duration_minutes: travelReviewDraft.final_duration_minutes
            ? Number(travelReviewDraft.final_duration_minutes)
            : undefined,
          final_distance_km: travelReviewDraft.final_distance_km
            ? Number(travelReviewDraft.final_distance_km)
            : undefined,
          manual_adjustment_note: travelReviewDraft.manual_adjustment_note || undefined,
        },
      );
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['mobile-request', requestId], data.request);
      setTravelReviewDialogOpen(false);
      setTravelReviewDraft(null);
      setToastMessage(t('requestDetails.travelReviewSaved'));
      await queryClient.invalidateQueries({ queryKey: ['mobile-workboard'] });
    },
    onError: () => {
      setToastMessage(t('requestDetails.travelReviewError'));
    },
  });

  const workLogMutation = useMutation({
    mutationFn: async () => {
      persistOfflineDraft('work_log', workLogDraft, 'pending_sync');
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/work-logs`,
        workLogDraft,
      );
      return data;
    },
    onSuccess: async () => {
      setWorkLogDialogOpen(false);
      setWorkLogDraft(createDefaultWorkLogDraft());
      removeOfflineDraft('work_log');
      setToastMessage(t('requestDetails.workLogSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      persistOfflineDraft('work_log', workLogDraft, 'sync_failed', t('requestDetails.workLogError'));
      setToastMessage(t('requestDetails.workLogErrorSavedLocally'));
    },
  });

  const materialMutation = useMutation({
    mutationFn: async () => {
      persistOfflineDraft(
        'material_usage',
        { ...materialDraft, search: materialSearch },
        'pending_sync',
      );
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
      setMaterialDraft(createEmptyMaterialDraft());
      removeOfflineDraft('material_usage');
      setToastMessage(t('requestDetails.materialSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      persistOfflineDraft(
        'material_usage',
        { ...materialDraft, search: materialSearch },
        'sync_failed',
        t('requestDetails.materialError'),
      );
      setToastMessage(t('requestDetails.materialErrorSavedLocally'));
    },
  });

  const equipmentMutation = useMutation({
    mutationFn: async () => {
      persistOfflineDraft(
        'equipment',
        { ...equipmentDraft, selectedSiteEquipmentKey },
        'pending_sync',
      );
      const { data } = await api.post<MobileRequestMutationResponse>(
        `/mobile/requests/${requestId}/equipment-assets`,
        equipmentDraft,
      );
      return data;
    },
    onSuccess: async () => {
      setEquipmentDialogOpen(false);
      resetEquipmentDraft();
      removeOfflineDraft('equipment');
      setToastMessage(t('requestDetails.equipmentSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      persistOfflineDraft(
        'equipment',
        { ...equipmentDraft, selectedSiteEquipmentKey },
        'sync_failed',
        t('requestDetails.equipmentError'),
      );
      setToastMessage(t('requestDetails.equipmentErrorSavedLocally'));
    },
  });

  const signatureMutation = useMutation({
    mutationFn: async (role: SignatureRole) => {
      persistOfflineDraft(
        'signature',
        { ...signatureDraft, role },
        'pending_sync',
      );
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
      setSignatureDraft(createEmptySignatureDraft());
      removeOfflineDraft('signature');
      setToastMessage(t('requestDetails.signatureSuccess'));
      await invalidateRequestData();
    },
    onError: () => {
      persistOfflineDraft(
        'signature',
        signatureDraft,
        'sync_failed',
        t('requestDetails.signatureError'),
      );
      setToastMessage(t('requestDetails.signatureErrorSavedLocally'));
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
  const siteEquipmentOptions = useMemo(() => siteDetailQuery.data?.equipment || [], [siteDetailQuery.data]);
  const travelLogs = useMemo(
    () =>
      [...(request?.travel_logs || [])].sort(
        (left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime(),
      ),
    [request?.travel_logs],
  );
  const activeTravelLog = useMemo(
    () => travelLogs.find((log) => log.is_active && log.technician_user.id === user?.id) || null,
    [travelLogs, user?.id],
  );
  const activeTravelElapsedSeconds = useMemo(() => {
    if (!activeTravelLog) {
      return 0;
    }
    const startedAt = new Date(activeTravelLog.started_at).getTime();
    return Math.max(Math.floor((travelTick - startedAt) / 1000), 0);
  }, [activeTravelLog, travelTick]);

  useEffect(() => {
    if (!requestId) {
      return;
    }

    const savedDrafts = loadAllOfflineDrafts(requestId);
    setOfflineDrafts(savedDrafts);

    const savedWorkLog = savedDrafts.work_log?.payload as WorkLogDraft | undefined;
    setWorkLogDraft(savedWorkLog || createDefaultWorkLogDraft());

    const savedMaterial = savedDrafts.material_usage?.payload as MaterialOfflineDraft | undefined;
    setMaterialDraft(savedMaterial ? {
      material_id: savedMaterial.material_id,
      warehouse_id: savedMaterial.warehouse_id,
      quantity: savedMaterial.quantity,
      unit: savedMaterial.unit,
      notes: savedMaterial.notes,
    } : createEmptyMaterialDraft());
    setMaterialSearch(savedMaterial?.search || '');

    const savedEquipment = savedDrafts.equipment?.payload as EquipmentOfflineDraft | undefined;
    setSelectedSiteEquipmentKey(savedEquipment?.selectedSiteEquipmentKey || '');
    setEquipmentDraft(savedEquipment ? {
      equipment_type: savedEquipment.equipment_type,
      manufacturer: savedEquipment.manufacturer,
      model: savedEquipment.model,
      serial_number: savedEquipment.serial_number,
      asset_tag: savedEquipment.asset_tag,
      location_note: savedEquipment.location_note,
      refrigerant: savedEquipment.refrigerant,
      notes: savedEquipment.notes,
    } : createEmptyEquipmentDraft());

    const savedSignature = savedDrafts.signature?.payload as SignatureDraft | undefined;
    setSignatureDraft(savedSignature || createEmptySignatureDraft());
  }, [requestId]);

  useEffect(() => {
    if (!activeTravelLog) {
      return;
    }

    const timer = window.setInterval(() => setTravelTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTravelLog]);

  useEffect(() => {
    if (!materialDialogOpen || !materialSearch.trim()) {
      return;
    }

    const normalizedSearch = materialSearch.trim().toLowerCase();
    const exactMatch = (materialOptionsQuery.data || []).find((item) => {
      const barcodeMatch = item.barcode?.trim().toLowerCase() === normalizedSearch;
      const erpCodeMatch = item.erp_code.trim().toLowerCase() === normalizedSearch;
      return barcodeMatch || erpCodeMatch;
    });

    if (!exactMatch) {
      return;
    }

    setMaterialDraft((current) => ({
      ...current,
      material_id: exactMatch.id,
      unit: exactMatch.unit || current.unit,
    }));
  }, [materialDialogOpen, materialOptionsQuery.data, materialSearch]);

  const resetEquipmentDraft = () => {
    setSelectedSiteEquipmentKey('');
    setEquipmentDraft(createEmptyEquipmentDraft());
  };

  useEffect(() => {
    if (!requestId) {
      return;
    }

    if (isMeaningfulWorkLogDraft(workLogDraft)) {
      persistOfflineDraft('work_log', workLogDraft);
      return;
    }

    removeOfflineDraft('work_log');
  }, [requestId, workLogDraft]);

  useEffect(() => {
    if (!requestId) {
      return;
    }

    const payload: MaterialOfflineDraft = {
      ...materialDraft,
      search: materialSearch,
    };

    if (isMeaningfulMaterialDraft(payload)) {
      persistOfflineDraft('material_usage', payload);
      return;
    }

    removeOfflineDraft('material_usage');
  }, [requestId, materialDraft, materialSearch]);

  useEffect(() => {
    if (!requestId) {
      return;
    }

    const payload: EquipmentOfflineDraft = {
      ...equipmentDraft,
      selectedSiteEquipmentKey,
    };

    if (isMeaningfulEquipmentDraft(payload)) {
      persistOfflineDraft('equipment', payload);
      return;
    }

    removeOfflineDraft('equipment');
  }, [requestId, equipmentDraft, selectedSiteEquipmentKey]);

  useEffect(() => {
    if (!requestId) {
      return;
    }

    if (isMeaningfulSignatureDraft(signatureDraft)) {
      persistOfflineDraft('signature', signatureDraft);
      return;
    }

    removeOfflineDraft('signature');
  }, [requestId, signatureDraft]);

  const openWorkLogDialog = () => {
    if (!isMeaningfulWorkLogDraft(workLogDraft)) {
      setWorkLogDraft(createDefaultWorkLogDraft());
    }
    setWorkLogDialogOpen(true);
  };

  const openMaterialDialog = () => {
    setMaterialDialogOpen(true);
  };

  const openEquipmentDialog = () => {
    if (!isMeaningfulEquipmentDraft({ ...equipmentDraft, selectedSiteEquipmentKey })) {
      resetEquipmentDraft();
    }
    setEquipmentDialogOpen(true);
  };

  const openTravelReview = (travelLog: TravelLogEntry) => {
    setTravelReviewDraft(createTravelReviewDraft(travelLog));
    setTravelReviewDialogOpen(true);
  };

  const resumeOfflineDraft = (kind: OfflineDraftKind) => {
    if (kind === 'work_log') {
      setWorkLogDialogOpen(true);
      return;
    }

    if (kind === 'material_usage') {
      setMaterialDialogOpen(true);
      return;
    }

    if (kind === 'equipment') {
      setEquipmentDialogOpen(true);
      return;
    }

    const savedSignature = offlineDrafts.signature?.payload as SignatureDraft | undefined;
    if (savedSignature?.role) {
      setSignatureDialogRole(savedSignature.role);
    }
  };

  const clearAllOfflineDrafts = () => {
    OFFLINE_DRAFT_KINDS.forEach((kind) => clearOfflineDraft(requestId, kind));
    setOfflineDrafts({});
    setWorkLogDraft(createDefaultWorkLogDraft());
    setMaterialDraft(createEmptyMaterialDraft());
    setMaterialSearch('');
    resetEquipmentDraft();
    setSignatureDraft(createEmptySignatureDraft());
    setSignatureDialogRole(null);
  };

  const applySiteEquipment = (equipmentKey: string) => {
    if (!equipmentKey) {
      resetEquipmentDraft();
      return;
    }

    setSelectedSiteEquipmentKey(equipmentKey);
    const selectedEquipment =
      siteEquipmentOptions.find((item) => item.equipment_key === equipmentKey) || null;

    if (!selectedEquipment) {
      return;
    }

    setEquipmentDraft({
      equipment_type: selectedEquipment.equipment_type || '',
      manufacturer: selectedEquipment.manufacturer || '',
      model: selectedEquipment.model || '',
      serial_number: selectedEquipment.serial_number || '',
      asset_tag: selectedEquipment.asset_tag || '',
      location_note: selectedEquipment.location_note || '',
      refrigerant: selectedEquipment.refrigerant || '',
      notes: selectedEquipment.notes || '',
    });
  };

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
  const canManageTravel = Boolean(request?.assigned_to_me) && !isTerminalRequest;
  const canCaptureSignatures = Boolean(request?.assigned_to_me) && !isTerminalRequest;
  const canCompleteRequest = Boolean(request?.can_complete) && !isTerminalRequest;
  const activeOfflineDrafts = useMemo(
    () =>
      Object.entries(offlineDrafts).filter(
        (entry): entry is [OfflineDraftKind, OfflineDraftRecord] =>
          Boolean(entry[1]?.payload) && entry[1]?.status !== 'synced',
      ),
    [offlineDrafts],
  );
  const hasSyncFailedDraft = activeOfflineDrafts.some(([, draft]) => draft.status === 'sync_failed');
  const workLogTimeRangeError =
    workLogDraft.time_from && workLogDraft.time_to && !isValidTimeRange(workLogDraft.time_from, workLogDraft.time_to)
      ? t('forms.invalidTimeRange')
      : '';
  const formatDistanceKm = (value?: number | string | null) => {
    if (value === null || value === undefined || value === '') {
      return t('common.notAvailable');
    }

    return t('requestDetails.distanceValue', {
      value: Number(value).toLocaleString(i18n.resolvedLanguage || i18n.language, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    });
  };

  const defaultSignerName = (role: SignatureRole) => {
    if (role === 'technician') {
      return user?.full_name || user?.email || t('forms.technicianSignerDefault');
    }
    return request?.contact_name || request?.client_name || t('forms.clientSignerDefault');
  };

  const openSignatureDialog = (role: SignatureRole) => {
    const savedSignature = offlineDrafts.signature?.payload as SignatureDraft | undefined;
    if (savedSignature?.role === role && isMeaningfulSignatureDraft(savedSignature)) {
      setSignatureDraft(savedSignature);
    } else {
      setSignatureDraft({
        role,
        signer_name: signaturesByRole[role]?.signer_name || defaultSignerName(role),
        signature_image_data: null,
        has_signature: false,
      });
    }
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
                  {canManageTravel && !activeTravelLog ? (
                    <Button
                      variant="outlined"
                      color="warning"
                      disabled={startTravelMutation.isPending}
                      onClick={() => startTravelMutation.mutate()}
                    >
                      {t('requestDetails.startTravel')}
                    </Button>
                  ) : null}
                  {canManageTravel && activeTravelLog ? (
                    <Button
                      variant="contained"
                      color="warning"
                      disabled={stopTravelMutation.isPending}
                      onClick={() => stopTravelMutation.mutate()}
                    >
                      {t('requestDetails.stopTravel')}
                    </Button>
                  ) : null}
                  {canAddOperationalEntries ? (
                    <Button variant="outlined" onClick={openWorkLogDialog}>
                      {t('requestDetails.addWorkLog')}
                    </Button>
                  ) : null}
                  {canAddOperationalEntries ? (
                    <Button variant="outlined" onClick={openMaterialDialog}>
                      {t('requestDetails.addMaterial')}
                    </Button>
                  ) : null}
                  {canAddOperationalEntries ? (
                    <Button variant="outlined" onClick={openEquipmentDialog}>
                      {t('requestDetails.addEquipment')}
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
                  {t('requestDetails.travel')}
                </Typography>
                {activeTravelLog ? (
                  <Alert severity="warning">
                    {t('requestDetails.travelActiveSince', {
                      value: formatDateTime(activeTravelLog.started_at, i18n.resolvedLanguage || i18n.language),
                    })}
                  </Alert>
                ) : (
                  <Alert severity="info">{t('requestDetails.travelInactive')}</Alert>
                )}
                {activeTravelLog ? (
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.5,
                      bgcolor: 'rgba(245, 158, 11, 0.08)',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('requestDetails.travelRunningTimer')}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {formatRunningDuration(activeTravelElapsedSeconds)}
                    </Typography>
                  </Box>
                ) : null}
                {travelLogs.length ? (
                  travelLogs.map((travelLog) => (
                    <Box
                      key={travelLog.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 1.5,
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {travelLog.technician_user.full_name || travelLog.technician_user.email}
                          </Typography>
                          <Chip
                            size="small"
                            color={travelLog.is_active ? 'warning' : 'default'}
                            label={
                              travelLog.is_active
                                ? t('requestDetails.travelStatusActive')
                                : t('requestDetails.travelStatusStopped')
                            }
                          />
                          {travelLog.is_gps_estimated ? (
                            <Chip size="small" color="info" label={t('requestDetails.travelGpsEstimated')} />
                          ) : null}
                          {travelLog.has_manual_adjustments ? (
                            <Chip size="small" color="success" label={t('requestDetails.travelManualAdjusted')} />
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('requestDetails.travelStartedAt')}:{' '}
                          {formatDateTime(travelLog.started_at, i18n.resolvedLanguage || i18n.language)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('requestDetails.travelEndedAt')}:{' '}
                          {travelLog.ended_at
                            ? formatDateTime(travelLog.ended_at, i18n.resolvedLanguage || i18n.language)
                            : t('requestDetails.travelStillRunning')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('requestDetails.travelEstimatedDuration')}:{' '}
                          {travelLog.estimated_duration_minutes !== null &&
                          travelLog.estimated_duration_minutes !== undefined
                            ? formatMinutes(travelLog.estimated_duration_minutes, t)
                            : t('common.notAvailable')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('requestDetails.travelFinalDuration')}:{' '}
                          {travelLog.final_duration_minutes !== null &&
                          travelLog.final_duration_minutes !== undefined
                            ? formatMinutes(travelLog.final_duration_minutes, t)
                            : t('common.notAvailable')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('requestDetails.travelEstimatedDistance')}: {formatDistanceKm(travelLog.estimated_distance_km)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('requestDetails.travelFinalDistance')}: {formatDistanceKm(travelLog.final_distance_km)}
                        </Typography>
                        {travelLog.manual_adjustment_note ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {t('requestDetails.travelAdjustmentNote')}: {travelLog.manual_adjustment_note}
                          </Typography>
                        ) : null}
                        {!travelLog.is_active && travelLog.technician_user.id === user?.id ? (
                          <Button variant="text" onClick={() => openTravelReview(travelLog)}>
                            {t('requestDetails.travelReview')}
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('requestDetails.travelEmpty')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          {activeOfflineDrafts.length ? (
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {t('requestDetails.offlineDraftsTitle')}
                  </Typography>
                  <Alert severity={hasSyncFailedDraft ? 'warning' : 'info'}>
                    {hasSyncFailedDraft
                      ? t('requestDetails.offlineDraftsSyncFailed')
                      : t('requestDetails.offlineDraftsSaved')}
                  </Alert>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {activeOfflineDrafts.map(([kind, draft]) => (
                      <Chip
                        key={kind}
                        color={draft.status === 'sync_failed' ? 'warning' : 'default'}
                        label={t('requestDetails.offlineDraftChip', {
                          draft: t(`offlineDrafts.kind.${kind}`),
                          status: t(`offlineDrafts.status.${draft.status}`),
                        })}
                      />
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {activeOfflineDrafts.map(([kind]) => (
                      <Button key={kind} variant="text" onClick={() => resumeOfflineDraft(kind)}>
                        {t('requestDetails.resumeDraft', {
                          draft: t(`offlineDrafts.kind.${kind}`),
                        })}
                      </Button>
                    ))}
                    <Button variant="text" color="inherit" onClick={clearAllOfflineDrafts}>
                      {t('requestDetails.clearOfflineDrafts')}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ) : null}

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
                <Button
                  variant="text"
                  sx={{ justifyContent: 'flex-start', px: 0 }}
                  onClick={() => navigate(`/clients/${request.client_id}/sites/${request.site_id}`)}
                >
                  {t('requestDetails.openSite')}
                </Button>
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
                        {t('fields.time')}: {formatTimeRange(log.time_from, log.time_to)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('forms.workDate')}: {formatDate(log.work_date)}
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
              inputProps={{ max: toLocalDateInputValue(new Date()) }}
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
                error={Boolean(workLogTimeRangeError)}
                helperText={workLogTimeRangeError || ' '}
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
                error={Boolean(workLogTimeRangeError)}
                helperText={workLogTimeRangeError || ' '}
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
            disabled={!workLogDraft.activity_description.trim() || Boolean(workLogTimeRangeError) || workLogMutation.isPending}
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
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <TextField
                label={t('forms.searchMaterial')}
                value={materialSearch}
                onChange={(event) => setMaterialSearch(event.target.value)}
                sx={{ flex: '1 1 220px' }}
              />
              <Button variant="outlined" onClick={() => setMaterialScannerOpen(true)}>
                {t('forms.scanBarcode')}
              </Button>
            </Stack>
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
                materialOptionsQuery.isLoading
                  ? t('common.loading')
                  : selectedMaterial?.description || selectedMaterial?.barcode || ' '
              }
            >
              {(materialOptionsQuery.data || []).map((material) => (
                <MenuItem key={material.id} value={material.id}>
                  {material.erp_code} - {material.name}
                  {material.barcode ? ` (${material.barcode})` : ''}
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

      <Dialog open={equipmentDialogOpen} onClose={() => setEquipmentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('forms.equipmentTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label={t('forms.selectExistingEquipment')}
              value={selectedSiteEquipmentKey}
              onChange={(event) => applySiteEquipment(event.target.value)}
              helperText={
                siteDetailQuery.isLoading
                  ? t('common.loading')
                  : t('requestDetails.siteEquipmentHint')
              }
              fullWidth
            >
              <MenuItem value="">{t('forms.manualEquipmentEntry')}</MenuItem>
              {siteEquipmentOptions.map((equipment) => (
                <MenuItem key={equipment.equipment_key} value={equipment.equipment_key}>
                  {formatEquipmentLabel(equipment)}
                </MenuItem>
              ))}
            </TextField>
            {!siteDetailQuery.isLoading && !siteEquipmentOptions.length ? (
              <Alert severity="info">{t('requestDetails.noSiteEquipment')}</Alert>
            ) : null}
            <TextField
              label={t('forms.equipmentType')}
              value={equipmentDraft.equipment_type}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, equipment_type: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('fields.manufacturer')}
              value={equipmentDraft.manufacturer}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, manufacturer: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('fields.model')}
              value={equipmentDraft.model}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, model: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('fields.serialNumber')}
              value={equipmentDraft.serial_number}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, serial_number: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('fields.assetTag')}
              value={equipmentDraft.asset_tag}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, asset_tag: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('fields.locationNote')}
              value={equipmentDraft.location_note}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, location_note: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('forms.refrigerant')}
              value={equipmentDraft.refrigerant}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, refrigerant: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label={t('forms.notes')}
              multiline
              minRows={2}
              value={equipmentDraft.notes}
              onChange={(event) =>
                setEquipmentDraft((current) => ({ ...current, notes: event.target.value }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEquipmentDialogOpen(false);
              resetEquipmentDraft();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!equipmentDraft.equipment_type.trim() || equipmentMutation.isPending}
            onClick={() => equipmentMutation.mutate()}
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
            {signatureDraft.signature_image_data ? (
              <Box
                component="img"
                src={signatureDraft.signature_image_data}
                alt={t('forms.signatureTitle')}
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
            ) : null}
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

      <Dialog
        open={travelReviewDialogOpen}
        onClose={() => {
          setTravelReviewDialogOpen(false);
          setTravelReviewDraft(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('requestDetails.travelReviewTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('requestDetails.travelFinalDuration')}
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={travelReviewDraft?.final_duration_minutes || ''}
              onChange={(event) =>
                setTravelReviewDraft((current) =>
                  current
                    ? {
                        ...current,
                        final_duration_minutes: event.target.value,
                      }
                    : current,
                )
              }
              fullWidth
            />
            <TextField
              label={t('requestDetails.travelFinalDistance')}
              type="number"
              inputProps={{ min: 0, step: '0.01' }}
              value={travelReviewDraft?.final_distance_km || ''}
              onChange={(event) =>
                setTravelReviewDraft((current) =>
                  current
                    ? {
                        ...current,
                        final_distance_km: event.target.value,
                      }
                    : current,
                )
              }
              fullWidth
            />
            <TextField
              label={t('requestDetails.travelAdjustmentNote')}
              multiline
              minRows={3}
              value={travelReviewDraft?.manual_adjustment_note || ''}
              onChange={(event) =>
                setTravelReviewDraft((current) =>
                  current
                    ? {
                        ...current,
                        manual_adjustment_note: event.target.value,
                      }
                    : current,
                )
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTravelReviewDialogOpen(false);
              setTravelReviewDraft(null);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!travelReviewDraft?.travel_log_id || updateTravelMutation.isPending}
            onClick={() => updateTravelMutation.mutate()}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />

      <BarcodeScannerDialog
        open={materialScannerOpen}
        onClose={() => setMaterialScannerOpen(false)}
        onDetected={(value) => setMaterialSearch(value)}
      />
    </MobileLayout>
  );
}
