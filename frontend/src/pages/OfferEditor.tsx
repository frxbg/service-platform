import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    Autocomplete,
    InputAdornment,
    Snackbar,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    PictureAsPdf as PdfIcon,
    Save as SaveIcon,
    Percent as PercentIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import Grid from '@mui/material/Grid';

interface OfferLine {
    id?: string;
    line_no: number;
    type: string;
    section?: string;
    material_id?: string;
    description: string;
    quantity: number;
    unit: string;
    cost: number;
    price: number;
    margin_percent?: number;
    margin_value?: number;
    discount_percent?: number;
}

interface Offer {
    id: string;
    offer_number: string;
    client_id: string;
    site_id?: string | null;
    contact_person_id?: string | null;
    contact_person_name?: string | null;
    contacts?: ClientContact[];
    tag_names?: string[];
    project_name: string;
    site_address: string;
    currency: string;
    status: string;
    validity_days: number;
    payment_terms: string;
    delivery_time: string;
    notes_internal: string;
    notes_client: string;
    total_cost: number;
    total_price: number;
    total_margin_value: number;
    total_margin_percent: number;
    show_discount_column: boolean;
    lines: OfferLine[];
}

interface ClientSite {
    id: string;
    site_code: string;
    site_name?: string;
    city?: string;
    address?: string;
    project_number?: string;
}

interface ClientContact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
}

interface ClientWithSites {
    id: string;
    name: string;
    sites?: ClientSite[];
    contacts?: ClientContact[];
}

type OfferFormValues = {
    client_id: string;
    site_id?: string | null;
    contact_person_ids?: string[];
    contact_person_id?: string | null;
    contact_person_name?: string | null;
    project_name: string;
    site_address: string;
    currency: string;
    validity_days: number;
    payment_terms: string;
    delivery_time: string;
    notes_internal: string;
    notes_client: string;
    show_discount_column: boolean;
    status: string;
};

const money = new Intl.NumberFormat('bg-BG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const allowedStatuses = ['draft', 'published', 'sent', 'accepted', 'rejected', 'archived'] as const;
const normalizeStatus = (value?: string) => {
    const normalized = (value || '').toString().trim().toLowerCase();
    return allowedStatuses.includes(normalized as (typeof allowedStatuses)[number])
        ? normalized
        : 'draft';
};
const parseTags = (raw: string): string[] =>
    Array.from(
        new Set(
            raw
                .split(/[,;\n]/g)
                .map((token) => token.trim())
                .filter(Boolean),
        ),
    );
const normalizeOfferLines = (inputLines: OfferLine[] = []): OfferLine[] =>
    inputLines.map((line) => ({
        ...line,
        type: line.type || 'material',
        discount_percent: Number(line.discount_percent ?? 0),
    }));
const LINE_AUTOSAVE_DELAY_MS = 60000;

const OfferEditor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const isNew = id === 'new';

    const [lines, setLines] = useState<OfferLine[]>([]);
    const [targetMarginInput, setTargetMarginInput] = useState<string>('');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [isMarginInputTouched, setIsMarginInputTouched] = useState<boolean>(false);

    const [clientDialogOpen, setClientDialogOpen] = useState(false);
    const [newClient, setNewClient] = useState({
        name: '',
        vat_number: '',
        city: '',
        address: '',
        contact_person: '',
        email: '',
        phone: '',
    });

    const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [newMaterial, setNewMaterial] = useState({
        erp_code: '',
        name: '',
        unit: 'pcs',
        cost: 0,
        default_margin_percent: 30,
    });
    const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null);
    const [siteInput, setSiteInput] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<ClientContact[]>([]);
    const [contactInput, setContactInput] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [newContact, setNewContact] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
    });
    const [lineSaveState, setLineSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
    const [lastLineSavedAt, setLastLineSavedAt] = useState<Date | null>(null);
    const [isLineSavePending, setIsLineSavePending] = useState(false);
    const autosaveTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
    const queuedLinesRef = React.useRef<OfferLine[] | null>(null);
    const lastSavedLinesHashRef = React.useRef('');
    const lineEditVersionRef = React.useRef(0);
    const lineSaveInFlightRef = React.useRef(false);

    const { control, handleSubmit, reset, watch, setValue, getValues } = useForm<OfferFormValues>({
        defaultValues: {
            client_id: '',
            site_id: '',
            contact_person_ids: [],
            contact_person_id: '',
            contact_person_name: '',
            project_name: '',
            site_address: '',
            currency: 'EUR',
            validity_days: 30,
            payment_terms: '',
            delivery_time: '',
            notes_internal: '',
            notes_client: '',
            show_discount_column: false,
            status: 'draft',
        },
    });
    const { data: offer, isLoading } = useQuery<Offer | null>({
        queryKey: ['offer', id],
        queryFn: async () => {
            if (isNew) return null;
            const { data } = await api.get(`/offers/${id}`);
            return data;
        },
        enabled: !isNew,
    });

    const { data: clients = [] } = useQuery<ClientWithSites[]>({
        queryKey: ['clients'],
        queryFn: async () => {
            const { data } = await api.get('/clients/', { params: { limit: 1000 } });
            return data;
        },
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials-all'],
        queryFn: async () => {
            const { data } = await api.get('/materials/', { params: { limit: 1000 } });
            return data;
        },
    });

    const currentCurrency = watch('currency') || 'EUR';
    const showDiscountColumn = watch('show_discount_column');
    const selectedClientId = watch('client_id');
    const selectedClient = useMemo(
        () => (clients as ClientWithSites[]).find((c) => c.id === selectedClientId),
        [clients, selectedClientId],
    );

    // Initialize target margin from offer totals on load
    useEffect(() => {
        if (offer && !isMarginInputTouched) {
            const marginRaw = offer.total_margin_percent;
            const marginNum = Number(marginRaw ?? 0);
            setTargetMarginInput(
                Number.isFinite(marginNum) ? marginNum.toFixed(2) : '0.00',
            );
        }
    }, [offer, isMarginInputTouched]);

    useEffect(() => {
        if (offer) {
            const normalizedLines = normalizeOfferLines(offer.lines || []);
            reset({
                client_id: offer.client_id ?? '',
                site_id: offer.site_id ?? '',
                contact_person_ids: (offer.contacts || []).map((c) => c.id),
                contact_person_id: offer.contact_person_id ?? '',
                contact_person_name: offer.contact_person_name ?? '',
                project_name: offer.project_name ?? '',
                site_address: offer.site_address ?? '',
                currency: offer.currency ?? 'EUR',
                validity_days: offer.validity_days ?? 30,
                payment_terms: offer.payment_terms ?? '',
                delivery_time: offer.delivery_time ?? '',
                notes_internal: offer.notes_internal ?? '',
                notes_client: offer.notes_client ?? '',
                show_discount_column: Boolean(offer.show_discount_column),
                status: normalizeStatus(offer.status),
            });
            setTagsInput((offer.tag_names || []).join(', '));
            setLines(normalizedLines);
            lastSavedLinesHashRef.current = JSON.stringify(
                buildSanitizedLines(normalizedLines, Boolean(offer.show_discount_column)),
            );
            queuedLinesRef.current = null;
            lineEditVersionRef.current = 0;
            setLineSaveState('saved');
            setLastLineSavedAt(null);
        }
    }, [offer, reset]);

    useEffect(() => {
        if (isNew) {
            setTagsInput('');
        }
    }, [isNew, id]);

    useEffect(() => {
        setSelectedSite(null);
        setSiteInput('');
        setSelectedContacts([]);
        setContactInput('');
        setValue('site_id', '');
        setValue('contact_person_ids', []);
        setValue('contact_person_id', '');
        setValue('contact_person_name', '');
        if (selectedClientId) {
            setValue('project_name', '');
            setValue('site_address', '');
        }
    }, [selectedClientId, setValue]);

    useEffect(() => {
        if (!offer || !selectedClient) return;
        const match =
            selectedClient.sites?.find((s) => s.id === offer.site_id) ||
            selectedClient.sites?.find(
                (s) =>
                    s.site_code === offer.project_name ||
                    s.site_name === offer.project_name ||
                    s.project_number === offer.project_name ||
                    s.address === offer.site_address,
            ) ||
            null;
        if (match) {
            setSelectedSite(match);
            setValue('site_id', match.id);
            const composedAddress = [match.address, match.city].filter(Boolean).join(', ') || match.address || '';
            const projectValue = match.site_name || match.site_code || match.project_number || '';
            const inputText = match.site_code || match.site_name || match.address || '';
            if (projectValue) setValue('project_name', projectValue);
            if (composedAddress) setValue('site_address', composedAddress);
            if (inputText) setSiteInput(inputText);
        }
    }, [offer, selectedClient, setValue]);

    useEffect(() => {
        if (!offer) return;
        const byIds = offer.contacts?.length
            ? (selectedClient?.contacts || []).filter((c) =>
                (offer.contacts || []).some((oc) => oc.id === c.id),
            )
            : [];
        if (byIds.length > 0) {
            setSelectedContacts(byIds);
            setContactInput('');
            setValue('contact_person_ids', byIds.map((c) => c.id));
            setValue('contact_person_id', byIds[0].id);
            setValue('contact_person_name', byIds[0].name || '');
            return;
        }

        const contactId = offer.contact_person_id || '';
        const contactName = offer.contact_person_name || '';
        if (contactId && selectedClient?.contacts?.length) {
            const existing = selectedClient.contacts.find((c) => c.id === contactId);
            if (existing) {
                setSelectedContacts([existing]);
                setContactInput('');
                setValue('contact_person_ids', [existing.id]);
                setValue('contact_person_id', existing.id);
                setValue('contact_person_name', existing.name || contactName || '');
                return;
            }
        }

        if (contactName) {
            setSelectedContacts([]);
            setContactInput(contactName);
            setValue('contact_person_ids', []);
            setValue('contact_person_id', contactId);
            setValue('contact_person_name', contactName);
        }
    }, [offer, selectedClient, setValue]);

    useEffect(() => {
        if (!showDiscountColumn) {
            setLines((prev) => {
                const updatedLines = prev.map((line) => {
                    const price = Number(line.price || 0);
                    const cost = Number(line.cost || 0);
                    const marginValue = price - cost;
                    const marginPercent = price > 0 ? (marginValue / price) * 100 : 0;
                    return {
                        ...line,
                        discount_percent: 0,
                        margin_value: marginValue,
                        margin_percent: marginPercent,
                    };
                });
                if (updatedLines.length > 0) {
                    markLinesChanged(updatedLines);
                }
                return updatedLines;
            });
        }
    }, [showDiscountColumn]);

    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                window.clearTimeout(autosaveTimerRef.current);
            }
        };
    }, []);

    const saveMutation = useMutation({
        mutationFn: async (data: OfferFormValues) => {
            if (isNew) {
                return api.post('/offers/', data);
            }
            return api.patch(`/offers/${id}`, data);
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['offers'] });
            queryClient.invalidateQueries({ queryKey: ['offer', id] });
            if (!isNew) {
                const normalizedLines = normalizeOfferLines(response.data?.lines || lines || []);
                setLines(normalizedLines);
                lastSavedLinesHashRef.current = JSON.stringify(buildSanitizedLines(normalizedLines));
            }
        },
    });

    const createClientMutation = useMutation({
        mutationFn: async (clientData: typeof newClient) => {
            const { data } = await api.post('/clients/', clientData);
            return data;
        },
        onSuccess: (createdClient) => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setValue('client_id', createdClient.id);
            setClientDialogOpen(false);
            setNewClient({
                name: '',
                vat_number: '',
                city: '',
                address: '',
                contact_person: '',
                email: '',
                phone: '',
            });
        },
    });

    const createMaterialMutation = useMutation({
        mutationFn: async (materialData: typeof newMaterial) => {
            const { data } = await api.post('/materials/', materialData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials-all'] });
            setMaterialDialogOpen(false);
            setNewMaterial({
                erp_code: '',
                name: '',
                unit: 'pcs',
                cost: 0,
                default_margin_percent: 30,
            });
        },
    });

    const createContactMutation = useMutation({
        mutationFn: async (contactData: typeof newContact) => {
            if (!selectedClientId) {
                throw new Error('No client selected');
            }
            const payload = { ...contactData, client_id: selectedClientId };
            const { data } = await api.post(`/clients/${selectedClientId}/contacts`, payload);
            return data;
        },
        onSuccess: (contact) => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setContactDialogOpen(false);
            setNewContact({ name: '', email: '', phone: '', role: '' });
            setContactInput('');
            setSelectedContacts((prev) => {
                const exists = prev.some((c) => c.id === contact.id);
                return exists ? prev : [...prev, contact];
            });
            const currentIds = getValues('contact_person_ids') || [];
            const nextIds = Array.from(new Set([...currentIds, contact.id]));
            setValue('contact_person_ids', nextIds);
            setValue('contact_person_id', nextIds[0] || '');
            setValue('contact_person_name', contact.name || '');
        },
    });

    const handleSaveOffer = async (formValues: OfferFormValues) => {
        const selectedContactIds = (
            formValues.contact_person_ids?.length
                ? formValues.contact_person_ids
                : selectedContacts.map((c) => c.id)
        ).filter(Boolean);
        const firstSelectedContact =
            selectedContacts.find((c) => c.id === selectedContactIds[0]) || selectedContacts[0] || null;
        const payload = {
            ...formValues,
            site_id: formValues.site_id || selectedSite?.id || null,
            contact_person_ids: selectedContactIds,
            contact_person_id: selectedContactIds[0] || formValues.contact_person_id || null,
            contact_person_name: selectedContactIds.length
                ? firstSelectedContact?.name || formValues.contact_person_name || null
                : formValues.contact_person_name || null,
            tags: parseTags(tagsInput),
            status: normalizeStatus(formValues.status),
        };
        try {
            const response = await saveMutation.mutateAsync(payload);
            const newId = isNew ? response.data.id : id;

            // For new offers, backend creates as draft; apply desired status if different
            if (isNew && newId && payload.status && payload.status !== 'draft') {
                await api.patch(`/offers/${newId}`, { status: payload.status });
            }

            if (newId && lines.length > 0) {
                await persistLinesForOffer(newId, lines);
            }
            if (isNew && newId) {
                navigate(`/offers/${newId}`);
            } else {
                queryClient.invalidateQueries({ queryKey: ['offers'] });
                queryClient.invalidateQueries({ queryKey: ['offer', newId] });
            }
            return newId;
        } catch (error) {
            console.error('Save offer failed', error);
            return null;
        }
    };

    const handleSave = (targetStatus?: string) => {
        return handleSubmit(async (values) => {
            const currentStatus = normalizeStatus(values.status);
            let nextStatus = currentStatus;
            if (targetStatus === 'published') {
                nextStatus = currentStatus === 'draft' ? 'published' : currentStatus;
            } else if (targetStatus) {
                nextStatus = normalizeStatus(targetStatus);
            }
            const savedId = await handleSaveOffer({ ...values, status: nextStatus });
            if (savedId) {
                if (targetStatus === 'published') {
                    navigate('/offers');
                } else {
                    setSnackbarOpen(true);
                    if (isNew) {
                        navigate(`/offers/${savedId}`);
                    }
                }
            }
        });
    };

    const handleExportPdf = async () => {
        if (isNew || !id) return;
        setPdfLoading(true);
        try {
            const { data } = await api.get(`/offers/${id}/pdf`, { responseType: 'blob' });
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const opened = window.open(url, '_blank', 'noopener,noreferrer');
            if (!opened) {
                const link = document.createElement('a');
                link.href = url;
                link.download = `offer_${offer?.offer_number || id}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
            console.error('PDF export failed', error);
        } finally {
            setPdfLoading(false);
        }
    };

    const buildSanitizedLines = (linesToSanitize: OfferLine[], discountColumnEnabled = showDiscountColumn) => {
        const toNumber = (v: any) => {
            const n = Number(v);
            return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
        };

        const materials = linesToSanitize
            .map((line, idx) => ({ line, idx }))
            .filter(({ line }) => (line.type || 'material') !== 'labour');
        const labour = linesToSanitize
            .map((line, idx) => ({ line, idx }))
            .filter(({ line }) => (line.type || 'material') === 'labour');
        const ordered = [...materials, ...labour].map(({ line }) => line);

        return ordered.map((line, idx) => {
            const discount = discountColumnEnabled ? toNumber(line.discount_percent ?? 0) : 0;
            const cost = toNumber(line.cost ?? 0);
            const price = toNumber(line.price ?? 0);
            const effectivePrice = price * (1 - discount / 100);
            const marginValue = effectivePrice - cost;
            const marginPercent = effectivePrice > 0 ? (marginValue / effectivePrice) * 100 : 0;

            return {
                ...line,
                type: line.type || 'material',
                line_no: idx + 1,
                quantity: toNumber(line.quantity ?? 0),
                cost,
                price,
                discount_percent: discount,
                margin_percent: toNumber(line.margin_percent ?? marginPercent),
                margin_value: toNumber(line.margin_value ?? marginValue),
            };
        });
    };

    const queueLinesAutosave = (linesSnapshot: OfferLine[], immediate = false) => {
        if (isNew || !id) {
            return;
        }

        queuedLinesRef.current = linesSnapshot;

        if (autosaveTimerRef.current) {
            window.clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = window.setTimeout(() => {
            void flushLinesAutosave(immediate);
        }, immediate ? 100 : LINE_AUTOSAVE_DELAY_MS);
    };

    const persistLinesForOffer = async (
        offerId: string,
        linesToPersist: OfferLine[],
        requestVersion = lineEditVersionRef.current,
    ) => {
        const payload = buildSanitizedLines(linesToPersist);
        const payloadHash = JSON.stringify(payload);
        const { data } = await api.post(`/offers/${offerId}/lines/bulk`, payload);
        const normalized = normalizeOfferLines(data.lines || payload);

        lastSavedLinesHashRef.current = payloadHash;
        queryClient.invalidateQueries({ queryKey: ['offer', offerId] });
        queryClient.invalidateQueries({ queryKey: ['offers'] });

        if (lineEditVersionRef.current === requestVersion) {
            setLines(normalized);
            setLineSaveState('saved');
            setLastLineSavedAt(new Date());
        }

        return normalized;
    };

    const flushLinesAutosave = async (forceImmediate = false) => {
        if (isNew || !id) {
            return;
        }

        const nextLines = queuedLinesRef.current;
        if (!nextLines) {
            return;
        }

        const payloadHash = JSON.stringify(buildSanitizedLines(nextLines));
        if (!forceImmediate && payloadHash === lastSavedLinesHashRef.current) {
            queuedLinesRef.current = null;
            if (lineSaveState !== 'saved') {
                setLineSaveState('saved');
            }
            return;
        }

        if (lineSaveInFlightRef.current) {
            return;
        }

        lineSaveInFlightRef.current = true;
        setIsLineSavePending(true);
        setLineSaveState('saving');
        const snapshot = nextLines;
        const requestVersion = lineEditVersionRef.current;
        queuedLinesRef.current = null;

        try {
            await persistLinesForOffer(id, snapshot, requestVersion);
        } catch (error) {
            console.error('Autosave lines failed', error);
            queuedLinesRef.current = snapshot;
            setLineSaveState('error');
        } finally {
            lineSaveInFlightRef.current = false;
            setIsLineSavePending(false);
            if (queuedLinesRef.current) {
                queueLinesAutosave(queuedLinesRef.current, true);
            }
        }
    };

    const markLinesChanged = (nextLines: OfferLine[], immediate = false) => {
        lineEditVersionRef.current += 1;
        setLineSaveState('dirty');
        queueLinesAutosave(nextLines, immediate);
    };

    const handleSaveLines = () => {
        if (!isNew && id) {
            queuedLinesRef.current = lines;
            void flushLinesAutosave(true);
        }
    };

    const parsedTargetMargin = useMemo(() => {
        const normalized = (targetMarginInput || '').replace(',', '.');
        const num = parseFloat(normalized);
        return Number.isFinite(num) ? num : 0;
    }, [targetMarginInput]);
    const lineSaveCaption =
        lineSaveState === 'saving'
            ? t('offer.autosaveSaving', { defaultValue: 'Автозапис: записва...' })
            : lineSaveState === 'error'
                ? t('offer.autosaveError', { defaultValue: 'Автозапис: грешка при запис' })
                : lineSaveState === 'dirty'
                    ? t('offer.autosavePending', { defaultValue: 'Автозапис: има незаписани промени' })
                : lineSaveState === 'saved' && lastLineSavedAt
                    ? t('offer.autosaveSavedAt', {
                        defaultValue: 'Автозапис: записано в {{time}}',
                        time: lastLineSavedAt.toLocaleTimeString('bg-BG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        }),
                    })
                    : t('offer.autosaveReady', { defaultValue: 'Автозапис: няма незаписани промени' });

    const applyMarginLocally = (target: number) => {
        const clamped = Math.max(0, Math.min(target, 99.99));
        let updatedLines: OfferLine[] = [];
        setLines((prev) => {
            updatedLines = prev.map((line) => {
                const cost = Number(line.cost) || 0;
                const discount = showDiscountColumn ? Number(line.discount_percent || 0) : 0;
                const discountFactor = 1 - discount / 100;
                const effectivePrice = cost / (1 - clamped / 100);
                const priceBeforeDiscount = discountFactor > 0 ? effectivePrice / discountFactor : effectivePrice;
                const marginValue = effectivePrice - cost;
                return {
                    ...line,
                    margin_percent: clamped,
                    margin_value: marginValue,
                    price: priceBeforeDiscount,
                };
            });
            return updatedLines;
        });
        setIsMarginInputTouched(false);
        return updatedLines.length ? updatedLines : lines;
    };

    const handleApplyMargin = async () => {
        if (parsedTargetMargin >= 0 && parsedTargetMargin < 100) {
            const updated = applyMarginLocally(parsedTargetMargin);
            if (!isNew && updated.length > 0) {
                markLinesChanged(updated, true);
                await flushLinesAutosave(true);
            }
            if (isNew && updated.length > 0) {
                const formValues = getValues();
                const response = await saveMutation.mutateAsync({
                    ...formValues,
                    status: normalizeStatus(formValues.status),
                });
                const newId = response.data.id;
                await persistLinesForOffer(newId, updated);
                navigate(`/offers/${newId}`);
            }
        }
    };

    const addLine = () => {
        const newLine: OfferLine = {
            line_no: lines.length + 1,
            type: 'material',
            description: '',
            quantity: 1,
            unit: 'pcs',
            cost: 0,
            price: 0,
            margin_percent: 0,
            discount_percent: 0,
        };
        const updated = [...lines, newLine];
        setLines(updated);
        markLinesChanged(updated, true);
    };

    const addLabourLine = () => {
        const newLine: OfferLine = {
            line_no: lines.length + 1,
            type: 'labour',
            description: '',
            quantity: 1,
            unit: 'h',
            cost: 0,
            price: 0,
            margin_percent: 0,
            discount_percent: 0,
        };
        const updated = [...lines, newLine];
        setLines(updated);
        markLinesChanged(updated, true);
    };

    const removeLine = (index: number) => {
        const updated = lines.filter((_, i) => i !== index);
        setLines(updated);
        markLinesChanged(updated, true);
    };

    const updateLine = (index: number, field: string, value: any) => {
        const numericFields = ['cost', 'price', 'margin_percent', 'quantity', 'discount_percent'];
        const updated = [...lines];
        let nextVal: any = value;

        if (numericFields.includes(field)) {
            if (value === '' || value === null || value === undefined) {
                nextVal = '';
            } else {
                const num = Number(value);
                nextVal = Number.isFinite(num) ? num : '';
            }
        }

        updated[index] = {
            ...updated[index],
            [field]: nextVal,
        };

        if (!showDiscountColumn) {
            updated[index].discount_percent = 0;
        }

        const cost = Number(updated[index].cost) || 0;
        const price = Number(updated[index].price) || 0;
        const discountRaw = showDiscountColumn ? Number(updated[index].discount_percent) || 0 : 0;
        const discount = Math.min(Math.max(discountRaw, 0), 99.99);
        const margin = Number(updated[index].margin_percent);
        const discountFactor = 1 - discount / 100;
        updated[index].discount_percent = discount;

        const effectivePrice = price * discountFactor;

        if (field === 'cost' || field === 'price' || field === 'discount_percent') {
            const marginValue = effectivePrice - cost;
            const marginPercent = effectivePrice > 0 ? (marginValue / effectivePrice) * 100 : 0;
            updated[index].margin_percent = marginPercent;
            updated[index].margin_value = marginValue;
        }

        if (field === 'margin_percent' && Number.isFinite(margin)) {
            if (margin < 100) {
                const effectivePriceFromMargin = cost / (1 - margin / 100);
                const priceBeforeDiscount = discountFactor !== 0 ? effectivePriceFromMargin / discountFactor : effectivePriceFromMargin;
                updated[index].price = priceBeforeDiscount;
                updated[index].margin_value = effectivePriceFromMargin - cost;
            }
        }

        setLines(updated);
        markLinesChanged(updated);
    };

    const handleMaterialSelect = (index: number, material: any) => {
        if (!material) return;

        const cost = Number(material.cost) || 0;
        const marginDefault = Number(material.default_margin_percent) || 0;
        const defaultPrice = material.default_sell_price
            ? Number(material.default_sell_price)
            : undefined;

        let price = defaultPrice && defaultPrice > 0 ? defaultPrice : 0;
        let marginPercent = marginDefault;
        let marginValue = 0;

        if (price === 0 && marginPercent) {
            price = cost / (1 - marginPercent / 100);
        }

        if (price > 0) {
            marginValue = price - cost;
            if (price !== 0) {
                marginPercent = ((price - cost) / price) * 100;
            }
        }

        const updated = [...lines];
        updated[index] = {
            ...updated[index],
            type: 'material',
            material_id: material.id,
            description: material.name,
            unit: material.unit,
            quantity: updated[index].quantity || 1,
            cost,
            price,
            discount_percent: showDiscountColumn ? updated[index].discount_percent ?? 0 : 0,
            margin_percent: marginPercent,
            margin_value: marginValue,
        };
        setLines(updated);
        markLinesChanged(updated);
    };

    const getLineAmounts = (line: OfferLine) => {
        const qty = Number(line.quantity || 0);
        const discount = showDiscountColumn ? Number(line.discount_percent || 0) : 0;
        const basePrice = Number(line.price || 0);
        const effectivePrice = basePrice * (1 - discount / 100);
        return { effectivePrice, lineTotal: effectivePrice * qty, discount };
    };

    const formatNumberDisplay = (value: any) => {
        if (value === '' || value === null || value === undefined) return '';
        return value.toString();
    };

    const materialRows = useMemo(
        () =>
            lines
                .map((line, idx) => ({
                    line: { ...line, type: line.type || 'material' },
                    idx,
                }))
                .filter(({ line }) => (line.type || 'material') !== 'labour'),
        [lines],
    );

    const labourRows = useMemo(
        () =>
            lines
                .map((line, idx) => ({
                    line: { ...line, type: line.type || 'material' },
                    idx,
                }))
                .filter(({ line }) => (line.type || 'material') === 'labour'),
        [lines],
    );

    const totals = useMemo(() => {
        let totalCost = 0;
        let totalPrice = 0;
        lines.forEach((line) => {
            const qty = Number(line.quantity || 0);
            const discount = showDiscountColumn ? Number(line.discount_percent || 0) : 0;
            const price = Number(line.price || 0);
            const effectivePrice = price * (1 - discount / 100);
            totalCost += (Number(line.cost || 0)) * qty;
            totalPrice += effectivePrice * qty;
        });
        const marginValue = totalPrice - totalCost;
        const marginPercent = totalPrice > 0 ? (marginValue / totalPrice) * 100 : 0;
        return { totalCost, totalPrice, marginValue, marginPercent };
    }, [lines, showDiscountColumn]);

    const siteOptions = useMemo(() => selectedClient?.sites || [], [selectedClient]);
    const contactOptions = useMemo(() => selectedClient?.contacts || [], [selectedClient]);

    const handleSiteSelect = (value: ClientSite | string | null) => {
        if (!value) {
            setSelectedSite(null);
            setValue('site_id', '');
            return;
        }
        const siteObj: ClientSite =
            typeof value === 'string'
                ? { id: 'new', site_code: value, site_name: value }
                : value;
        setSelectedSite(siteObj);
        setValue('site_id', siteObj.id === 'new' ? '' : siteObj.id);
        const inputText =
            siteObj.site_code || siteObj.site_name || siteObj.address || '';
        if (inputText) setSiteInput(inputText);
        const projectValue = siteObj.site_name || siteObj.site_code || siteObj.project_number || '';
        const composedAddress =
            [siteObj.address, siteObj.city].filter(Boolean).join(', ') ||
            siteObj.address ||
            siteObj.site_name ||
            siteObj.site_code ||
            '';
        if (projectValue) setValue('project_name', projectValue);
        if (composedAddress) setValue('site_address', composedAddress);
    };

    const handleContactSelect = (values: ClientContact[]) => {
        setSelectedContacts(values);
        const ids = values.map((v) => v.id);
        setValue('contact_person_ids', ids);
        setValue('contact_person_id', ids[0] || '');
        setValue('contact_person_name', values[0]?.name || '');
    };
    // Backend supports: draft, published, sent, accepted, rejected, archived
    const statusOptions = [
        { value: 'draft', label: t('status.draft') },
        { value: 'published', label: t('status.published') },
        { value: 'sent', label: t('status.sent') },
        { value: 'accepted', label: t('status.accepted') },
        { value: 'rejected', label: t('status.rejected') },
        { value: 'archived', label: t('status.archived') },
    ];


    // Update target margin input when totals change (but only if user hasn't touched it)
    useEffect(() => {
        if (!isMarginInputTouched && !isNew && totals.marginPercent !== undefined) {
            setTargetMarginInput(totals.marginPercent.toFixed(2));
        }
    }, [totals.marginPercent, isMarginInputTouched, isNew]);

    if (isLoading && !isNew) {
        return <Typography>{t('common.loading')}</Typography>;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 1, sm: 2 } }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 2,
                    mb: 2,
                }}
            >
                <Typography variant="h4" sx={{ fontWeight: 600, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    {isNew
                        ? t('offer.newTitle')
                        : t('offer.titleWithNumber', { number: offer?.offer_number })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        startIcon={<PdfIcon />}
                        onClick={handleExportPdf}
                        disabled={isNew || pdfLoading}
                        size="small"
                    >
                        {t('offer.exportPdf')}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<SaveIcon />}
                        onClick={handleSave()}
                        disabled={saveMutation.isPending}
                        size="small"
                        sx={{
                            color: 'primary.main',
                            borderColor: 'primary.main',
                            '&:hover': {
                                backgroundColor: 'rgba(59,130,246,0.04)',
                                borderColor: 'primary.main',
                            }
                        }}
                    >
                        {t('common.save', { defaultValue: 'Запази' })}
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSave('published')}
                        disabled={saveMutation.isPending}
                        size="small"
                        sx={{
                            backgroundColor: 'primary.main',
                            '&:hover': {
                                backgroundColor: 'primary.dark',
                            }
                        }}
                    >
                        {t('offer.saveAndPublish')}
                    </Button>
                </Box>
            </Box>

            <Card
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                }}
            >
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid sx={{ minWidth: 260 }} size={{ xs: 12, md: 3 }}>
                            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Controller
                                    name="client_id"
                                    control={control}
                                    rules={{ required: true }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            select
                                            fullWidth
                                            size="small"
                                            label={t('offer.client')}
                                            required
                                        >
                                            {clients.map((client: any) => (
                                                <MenuItem key={client.id} value={client.id}>
                                                    {client.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                                <Button
                                    variant="outlined"
                                    onClick={() => setClientDialogOpen(true)}
                                    sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}
                                    size="small"
                                >
                                    {t('offer.newClient')}
                                </Button>
                            </Box>
                        </Grid>
                        <Grid sx={{ minWidth: 220 }} size={{ xs: 12, md: 3 }}>
                            <Autocomplete
                                freeSolo
                                options={siteOptions}
                                getOptionLabel={(option) =>
                                    typeof option === 'string'
                                        ? option
                                        : option.site_code || option.site_name || option.address || ''
                                }
                                value={selectedSite}
                                onChange={(_, newValue) => handleSiteSelect(newValue as any)}
                                inputValue={siteInput}
                                onInputChange={(_, newInput, reason) => {
                                    setSiteInput(newInput);
                                    if (reason === 'input') {
                                        setSelectedSite(null);
                                        setValue('site_id', '');
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        size="small"
                                        label={t('client.siteCode')}
                                        placeholder={t('client.selectSite')}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) =>
                                    (typeof option === 'string' ? option : option.id) ===
                                    (typeof value === 'string' ? value : value.id)
                                }
                            />
                        </Grid>
                        <Grid sx={{ minWidth: 220 }} size={{ xs: 12, md: 3 }}>
                            <Controller
                                name="project_name"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        size="small"
                                        label={t('offer.projectName')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid sx={{ minWidth: 320 }} size={{ xs: 12, md: 6 }}>
                            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center' }}>
                                <Autocomplete
                                    multiple
                                    options={contactOptions}
                                    getOptionLabel={(option) =>
                                        option.name || option.email || option.phone || ''
                                    }
                                    value={selectedContacts}
                                    onChange={(_, newValue) => handleContactSelect(newValue as ClientContact[])}
                                    inputValue={contactInput}
                                    onInputChange={(_, newInput) => {
                                        setContactInput(newInput);
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            fullWidth
                                            size="small"
                                            label={t('offer.contactPerson', { defaultValue: 'Лице за контакт' })}
                                            placeholder={t('offer.contactPersonPlaceholder', { defaultValue: 'Избери един или повече' })}
                                        />
                                    )}
                                    isOptionEqualToValue={(option, value) =>
                                        option.id === value.id
                                    }
                                    filterSelectedOptions
                                    disabled={!selectedClientId}
                                    sx={{ flex: 1, minWidth: 260 }}
                                />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setContactDialogOpen(true)}
                                    disabled={!selectedClientId}
                                    sx={{ whiteSpace: 'nowrap', minWidth: { xs: '100%', sm: 150 } }}
                                >
                                    {t('offer.addContact', { defaultValue: 'Добави контакт' })}
                                </Button>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="site_address"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        size="small"
                                        label={t('offer.siteAddress')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="currency"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        select
                                        fullWidth
                                        size="small"
                                        label={t('offer.currency')}
                                    >
                                        <MenuItem value="EUR">
                                            {t('currencies.eur')}
                                        </MenuItem>
                                    </TextField>
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="validity_days"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        label={t('offer.validityDays')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="payment_terms"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        size="small"
                                        label={t('offer.paymentTerms')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="delivery_time"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        size="small"
                                        label={t('offer.deliveryTime')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="notes_internal"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        size="small"
                                        multiline
                                        minRows={2}
                                        label={t('offer.internalNotes')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="show_discount_column"
                                control={control}
                                render={({ field }) => (
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                color="primary"
                                                checked={Boolean(field.value)}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                            />
                                        }
                                        label={t('offer.showDiscountColumn')}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        select
                                        fullWidth
                                        size="small"
                                        label={t('offer.status')}
                                    >
                                        {statusOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label={t('offer.tags', { defaultValue: 'Тагове' })}
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                placeholder={t('offer.tagsPlaceholder', { defaultValue: 'например: компресор, фреон, сервиз' })}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Controller
                                name="notes_client"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        fullWidth
                                        size="small"
                                        multiline
                                        minRows={2}
                                        label={t('offer.clientNotes')}
                                    />
                                )}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {!isNew && (
                <Card

                >
                    <CardContent>
                        <Grid container spacing={3} alignItems="center">
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.9, mb: 0.5 }}>
                                            {t('offer.totalCost')}
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            {money.format(totals.totalCost)} {currentCurrency}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.9, mb: 0.5 }}>
                                            {t('offer.priceTotal')}
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            {money.format(totals.totalPrice)} {currentCurrency}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.9, mb: 0.5 }}>
                                            {t('offer.marginTotal')}
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            {money.format(totals.marginValue)} {currentCurrency} (
                                            {money.format(totals.marginPercent)}%)
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        alignItems: 'center',
                                    }}
                                >
                                    <TextField
                                        size="small"
                                        type="number"
                                        inputProps={{
                                            step: '0.1',
                                            min: '0',
                                            max: '99.99'
                                        }}
                                        label={t('offer.targetMargin')}
                                        value={targetMarginInput || ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(',', '.');
                                            setTargetMarginInput(raw);
                                            if (!isMarginInputTouched) {
                                                setIsMarginInputTouched(true);
                                            }
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PercentIcon fontSize="small" />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            flex: 1,
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: (theme) =>
                                                    theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.1)'
                                                        : 'rgba(255, 255, 255, 0.9)',
                                                backdropFilter: 'blur(10px)',
                                            },
                                        }}
                                    />
                                    <Button
                                        variant="contained"
                                        onClick={handleApplyMargin}
                                        disabled={
                                            parsedTargetMargin <= 0 ||
                                            parsedTargetMargin >= 100 ||
                                            (!isNew && isLineSavePending) ||
                                            !parsedTargetMargin
                                        }
                                        sx={{
                                            minWidth: 120,
                                            fontWeight: 600,
                                            backgroundColor: (theme) =>
                                                theme.palette.mode === 'dark'
                                                    ? 'rgba(255, 255, 255, 0.2)'
                                                    : 'rgba(37, 99, 234, 0.39)',
                                            color: 'inherit',
                                            '&:hover': {
                                                backgroundColor: (theme) =>
                                                    theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.3)'
                                                        : 'rgba(255, 255, 255, 1)',
                                            },
                                            '&.Mui-disabled': {
                                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.4)',
                                            }
                                        }}
                                    >
                                        {(!isNew && isLineSavePending)
                                            ? t('common.saving')
                                            : t('offer.applyMargin')}
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {!isNew && (
                <>
                    {/* ############################################################################### */}
                    {!isNew && (
                        <>
                            <Paper sx={{ mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('offer.lines')}</Typography>
                                        <Typography
                                            variant="caption"
                                            color={lineSaveState === 'error' ? 'error.main' : 'text.secondary'}
                                        >
                                            {lineSaveCaption}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addLine}>{t('offer.addLine')}</Button>
                                        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addLabourLine}>{t('offer.addLabourLine')}</Button>
                                        <Button size="small" variant="outlined" onClick={() => navigate(`/materials?new=1${!isNew && id ? `&return=/offers/${id}` : ''}`)}>{t('offer.newMaterial')}</Button>
                                        <Button size="small" variant="contained" onClick={handleSaveLines} disabled={isLineSavePending}>
                                            {isLineSavePending ? t('common.saving') : t('offer.saveLines')}
                                        </Button>
                                    </Box>
                                </Box>

                                <Box sx={{ p: 2, backgroundColor: 'background.paper', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {materialRows.map(({ line, idx }) => {
                                        const { effectivePrice, lineTotal } = getLineAmounts(line);
                                        return (
                                            <Card key={line.id ?? idx} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Autocomplete
                                                        size="small"
                                                        options={materials}
                                                        getOptionLabel={(m: any) => `${m.erp_code || ''} - ${m.name || ''}`}
                                                        value={materials.find((m: any) => m.id === line.material_id) || null}
                                                        onChange={(_, v) => handleMaterialSelect(idx, v)}
                                                        renderInput={(params) => <TextField {...params} label={t('offer.material')} sx={{ minWidth: 200 }} />}
                                                    />
                                                    <TextField size="small" label={t('offer.description')} value={line.description || ''} onChange={(e) => updateLine(idx, 'description', e.target.value)} sx={{ flex: 1 }} />
                                                    <TextField size="small" type="number" label={t('offer.quantityShort')} value={formatNumberDisplay(line.quantity)} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} sx={{ width: 90 }} />
                                                    <TextField size="small" label={t('offer.unitShort')} value={line.unit || ''} onChange={(e) => updateLine(idx, 'unit', e.target.value)} sx={{ width: 80 }} />
                                                    <IconButton color="error" onClick={() => removeLine(idx)}><DeleteIcon /></IconButton>
                                                </Box>

                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <TextField size="small" type="number" label={t('offer.lineCostShort')} value={formatNumberDisplay(line.cost)} onChange={(e) => updateLine(idx, 'cost', e.target.value)} sx={{ width: 110 }} />
                                                    <TextField size="small" type="number" label={t('offer.lineMarginPercent')} value={formatNumberDisplay(line.margin_percent)} onChange={(e) => updateLine(idx, 'margin_percent', e.target.value)} sx={{ width: 110 }} />
                                                    <TextField size="small" type="number" label={t('offer.linePrice')} value={formatNumberDisplay(line.price)} onChange={(e) => updateLine(idx, 'price', e.target.value)} sx={{ width: 110 }} />
                                                    {showDiscountColumn && (
                                                        <>
                                                            <TextField size="small" type="number" label={t('offer.discountPercent')} inputProps={{ min: 0, max: 99.99, step: 0.1 }} value={formatNumberDisplay(line.discount_percent ?? 0)} onChange={(e) => updateLine(idx, 'discount_percent', e.target.value)} sx={{ width: 110 }} />
                                                            <Typography sx={{ minWidth: 120, textAlign: 'center', fontWeight: 500 }}>{money.format(effectivePrice)} {currentCurrency}</Typography>
                                                        </>
                                                    )}
                                                    <Typography sx={{ ml: 'auto', fontWeight: 600 }}>
                                                        {t('offer.lineTotalLabel')}{' '}
                                                        {money.format(lineTotal)} {currentCurrency}
                                                    </Typography>
                                                </Box>
                                            </Card>
                                        );
                                    })}
                                </Box>
                            </Paper>
                        </>
                    )}
                    {/* ######################################################################################### */}
                    {labourRows.length > 0 && (
                        <Paper
                            sx={{
                                mb: 2,
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Box
                                sx={{
                                    p: 2,
                                    display: 'flex',
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    justifyContent: 'space-between',
                                    alignItems: { xs: 'stretch', sm: 'center' },
                                    gap: 2,
                                    backgroundColor: 'background.default',
                                    borderBottom: '1px solid',
                                    borderBottomColor: 'divider',
                                }}
                            >
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    {t('offer.labourLines')}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button
                                        startIcon={<AddIcon />}
                                        onClick={addLabourLine}
                                        size="small"
                                        variant="outlined"
                                    >
                                        {t('offer.addLabourLine')}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleSaveLines}
                                        disabled={isLineSavePending}
                                        size="small"
                                    >
                                        {isLineSavePending
                                            ? t('common.saving')
                                            : t('offer.saveLines')}
                                    </Button>
                                </Box>
                            </Box>
                            <TableContainer sx={{ maxHeight: '500px', overflow: 'auto' }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell width={40}>#</TableCell>
                                            <TableCell>{t('offer.description')}</TableCell>
                                            <TableCell width={100}>{t('offer.quantityShort')}</TableCell>
                                            <TableCell width={100}>{t('offer.unitShort')}</TableCell>
                                            <TableCell width={120}>{t('offer.lineCostShort')}</TableCell>
                                            <TableCell width={120}>{t('offer.linePrice')}</TableCell>
                                            {showDiscountColumn && (
                                                <>
                                                    <TableCell width={120}>
                                                        {t('offer.discountPercent')}
                                                    </TableCell>
                                                    <TableCell width={140}>
                                                        {t('offer.priceAfterDiscount')}
                                                    </TableCell>
                                                </>
                                            )}
                                            <TableCell width={120}>{t('offer.lineMarginPercent')}</TableCell>
                                            <TableCell width={120}>{t('offer.lineTotal')}</TableCell>
                                            <TableCell width={60} />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {labourRows.map(({ line, idx }, rowIndex) => {
                                            const { effectivePrice, lineTotal } = getLineAmounts(line);
                                            return (
                                                <TableRow
                                                    key={line.id ?? idx}
                                                    sx={{
                                                        '&:hover': {
                                                            backgroundColor: 'action.hover',
                                                        }
                                                    }}
                                                >
                                                    <TableCell>{rowIndex + 1}</TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            label={t('offer.description')}
                                                            value={line.description || ''}
                                                            onChange={(e) =>
                                                                updateLine(idx, 'description', e.target.value)
                                                            }
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label={t('offer.quantityShort')}
                                                            value={formatNumberDisplay(line.quantity)}
                                                            onChange={(e) =>
                                                                updateLine(
                                                                    idx,
                                                                    'quantity',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            label={t('offer.unitShort')}
                                                            value={line.unit || ''}
                                                            onChange={(e) =>
                                                                updateLine(idx, 'unit', e.target.value)
                                                            }
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label={t('offer.lineCostShort')}
                                                            value={formatNumberDisplay(line.cost)}
                                                            onChange={(e) =>
                                                                updateLine(
                                                                    idx,
                                                                    'cost',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label={t('offer.linePrice')}
                                                            value={formatNumberDisplay(line.price)}
                                                            onChange={(e) =>
                                                                updateLine(
                                                                    idx,
                                                                    'price',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    {showDiscountColumn && (
                                                        <TableCell>
                                                            <TextField
                                                                size="small"
                                                                type="number"
                                                                label={t('offer.discountPercent')}
                                                                inputProps={{ min: 0, max: 99.99, step: 0.1 }}
                                                                value={formatNumberDisplay(line.discount_percent ?? 0)}
                                                                onChange={(e) =>
                                                                    updateLine(
                                                                        idx,
                                                                        'discount_percent',
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                fullWidth
                                                            />
                                                        </TableCell>
                                                    )}
                                                    {showDiscountColumn && (
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                {money.format(effectivePrice)} {currentCurrency}
                                                            </Typography>
                                                        </TableCell>
                                                    )}
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label={t('offer.lineMarginPercent')}
                                                            value={formatNumberDisplay(line.margin_percent)}
                                                            onChange={(e) =>
                                                                updateLine(
                                                                    idx,
                                                                    'margin_percent',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {money.format(lineTotal)} {currentCurrency}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => removeLine(idx)}
                                                            color="error"
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </>
            )}

            {isNew && (
                <Alert
                    severity="info"
                    sx={{
                        borderRadius: 2,
                        backgroundColor: 'info.light',
                        color: 'info.contrastText',
                    }}
                >
                    {t('offer.infoSaveFirst')}
                </Alert>
            )}

            <Dialog
                open={clientDialogOpen}
                onClose={() => setClientDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t('offer.newClientTitle')}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={t('clients.name')}
                                fullWidth
                                value={newClient.name}
                                onChange={(e) =>
                                    setNewClient({ ...newClient, name: e.target.value })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('clients.vatNumber')}
                                fullWidth
                                value={newClient.vat_number}
                                onChange={(e) =>
                                    setNewClient({
                                        ...newClient,
                                        vat_number: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('clients.city')}
                                fullWidth
                                value={newClient.city}
                                onChange={(e) =>
                                    setNewClient({ ...newClient, city: e.target.value })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={t('clients.address')}
                                fullWidth
                                value={newClient.address}
                                onChange={(e) =>
                                    setNewClient({
                                        ...newClient,
                                        address: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('clients.contactPerson')}
                                fullWidth
                                value={newClient.contact_person}
                                onChange={(e) =>
                                    setNewClient({
                                        ...newClient,
                                        contact_person: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('clients.email')}
                                fullWidth
                                value={newClient.email}
                                onChange={(e) =>
                                    setNewClient({
                                        ...newClient,
                                        email: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={t('clients.phone')}
                                fullWidth
                                value={newClient.phone}
                                onChange={(e) =>
                                    setNewClient({
                                        ...newClient,
                                        phone: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClientDialogOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => createClientMutation.mutate(newClient)}
                    >
                        {t('common.create')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={contactDialogOpen}
                onClose={() => setContactDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t('offer.newContactTitle', { defaultValue: 'Ново лице за контакт' })}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={t('offer.contactPerson', { defaultValue: 'Лице за контакт' })}
                                fullWidth
                                value={newContact.name}
                                onChange={(e) =>
                                    setNewContact({ ...newContact, name: e.target.value })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('clients.email')}
                                fullWidth
                                value={newContact.email}
                                onChange={(e) =>
                                    setNewContact({ ...newContact, email: e.target.value })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('clients.phone')}
                                fullWidth
                                value={newContact.phone}
                                onChange={(e) =>
                                    setNewContact({ ...newContact, phone: e.target.value })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={t('offer.contactRole', { defaultValue: 'Роля / позиция' })}
                                fullWidth
                                value={newContact.role}
                                onChange={(e) =>
                                    setNewContact({ ...newContact, role: e.target.value })
                                }
                                size="small"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setContactDialogOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => createContactMutation.mutate(newContact)}
                        disabled={!selectedClientId || !newContact.name}
                    >
                        {t('common.create')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={materialDialogOpen}
                onClose={() => setMaterialDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t('offer.newMaterialTitle')}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('materials.code')}
                                fullWidth
                                value={newMaterial.erp_code}
                                onChange={(e) =>
                                    setNewMaterial({
                                        ...newMaterial,
                                        erp_code: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('materials.name')}
                                fullWidth
                                value={newMaterial.name}
                                onChange={(e) =>
                                    setNewMaterial({
                                        ...newMaterial,
                                        name: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label={t('materials.unit')}
                                fullWidth
                                value={newMaterial.unit}
                                onChange={(e) =>
                                    setNewMaterial({
                                        ...newMaterial,
                                        unit: e.target.value,
                                    })
                                }
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                type="number"
                                label={t('materials.cost')}
                                fullWidth
                                value={newMaterial.cost === 0 ? '' : newMaterial.cost}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setNewMaterial({
                                        ...newMaterial,
                                        cost: raw === '' ? 0 : Number(raw) || 0,
                                    });
                                }}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                type="number"
                                label={t('materials.defaultMargin')}
                                fullWidth
                                value={newMaterial.default_margin_percent === 0 ? '' : newMaterial.default_margin_percent}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setNewMaterial({
                                        ...newMaterial,
                                        default_margin_percent: raw === '' ? 0 : Number(raw) || 0,
                                    });
                                }}
                                size="small"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMaterialDialogOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() =>
                            createMaterialMutation.mutate({
                                ...newMaterial,
                                cost: Number(newMaterial.cost) || 0,
                                default_margin_percent: Number(newMaterial.default_margin_percent) || 0,
                            })
                        }
                    >
                        {t('common.create')}
                    </Button>
                </DialogActions>
            </Dialog>
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    Офертата е запазена успешно
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default OfferEditor;




