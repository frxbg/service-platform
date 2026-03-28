import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Paper,
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

interface OfferLine {
    line_no: number;
    description: string;
    quantity: number;
    unit: string;
    cost: number;
    price: number;
    discount_percent?: number;
    type?: string;
    margin_percent?: number;
}

interface Offer {
    id: string;
    offer_number: string;
    user_id: string;
    client: { name: string };
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
    show_discount_column?: boolean;
    lines: OfferLine[];
}

const money = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const OfferDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canReadOffer = hasPermission(user, 'offers.read_all')
        || hasPermission(user, 'offers.read_own')
        || hasPermission(user, 'offers.edit_all')
        || hasPermission(user, 'offers.edit_own');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [statusValue, setStatusValue] = useState('draft');

    const { data: offer, isLoading } = useQuery<Offer>({
        queryKey: ['offer', id],
        queryFn: async () => {
            const { data } = await api.get(`/offers/${id}`);
            return data;
        },
        enabled: Boolean(id && canReadOffer),
    });
    useEffect(() => {
        if (!offer?.status) return;
        setStatusValue(String(offer.status).toLowerCase());
    }, [offer?.status]);

    const updateStatusMutation = useMutation({
        mutationFn: async (nextStatus: string) => {
            const { data } = await api.patch(`/offers/${id}`, { status: nextStatus });
            return data;
        },
        onSuccess: (data) => {
            setStatusValue(String(data.status || '').toLowerCase());
            queryClient.invalidateQueries({ queryKey: ['offer', id] });
            queryClient.invalidateQueries({ queryKey: ['offers'] });
        },
    });

    const statusLabels: Record<string, string> = {
        DRAFT: t('offer.status.draft', { defaultValue: 'Чернова' }),
        PUBLISHED: t('offer.status.published', { defaultValue: 'Публикувана' }),
        SENT: t('offer.status.sent', { defaultValue: 'Изпратена' }),
        ACCEPTED: t('offer.status.accepted', { defaultValue: 'Приета' }),
        REJECTED: t('offer.status.rejected', { defaultValue: 'Отхвърлена' }),
        ARCHIVED: t('offer.status.archived', { defaultValue: 'Архивирана' }),
        // Fallback for lowercase
        draft: t('offer.status.draft', { defaultValue: 'Чернова' }),
        published: t('offer.status.published', { defaultValue: 'Публикувана' }),
        sent: t('offer.status.sent', { defaultValue: 'Изпратена' }),
        accepted: t('offer.status.accepted', { defaultValue: 'Приета' }),
        rejected: t('offer.status.rejected', { defaultValue: 'Отхвърлена' }),
        archived: t('offer.status.archived', { defaultValue: 'Приключена' }),
    };

    const statusColor: Record<string, 'default' | 'primary' | 'warning' | 'error' | 'success' | 'secondary'> = {
        DRAFT: 'secondary',      // purple
        PUBLISHED: 'primary',    // blue
        SENT: 'warning',         // yellow
        ACCEPTED: 'success',     // green
        REJECTED: 'error',       // red
        ARCHIVED: 'default',     // light grey
        // Fallback for lowercase
        draft: 'secondary',
        published: 'primary',
        sent: 'warning',
        accepted: 'success',
        rejected: 'error',
        archived: 'default',
    };


    const handleExportPdf = async () => {
        if (!id) return;
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

    if (!canReadOffer) {
        return <Alert severity="warning">You do not have permission to view offers.</Alert>;
    }

    if (isLoading || !offer) {
        return <Typography>{t('common.loading')}</Typography>;
    }
    const canEdit =
        hasPermission(user, 'offers.edit_all') ||
        (hasPermission(user, 'offers.edit_own') && user?.id === offer.user_id);

    const showDiscountColumn = Boolean(offer.show_discount_column);
    const materialLines =
        offer.lines?.filter((line) => (line.type || 'material') !== 'labour') ?? [];
    const labourLines =
        offer.lines?.filter((line) => (line.type || 'material') === 'labour') ?? [];

    const getLineAmounts = (line: OfferLine) => {
        const qty = Number(line.quantity || 0);
        const discount = showDiscountColumn ? Number(line.discount_percent || 0) : 0;
        const basePrice = Number(line.price || 0);
        const effectivePrice = basePrice * (1 - discount / 100);
        const lineTotal = effectivePrice * qty;
        return { effectivePrice, lineTotal, discount };
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {t('offer.titleWithNumber', { number: offer.offer_number })}
                    </Typography>
                    <Typography color="text.secondary">{offer.client?.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" onClick={() => navigate(-1)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<PdfIcon />}
                        onClick={handleExportPdf}
                        disabled={pdfLoading}
                    >
                        {t('offer.exportPdf')}
                    </Button>
                    {canEdit && (
                        <Button variant="contained" onClick={() => navigate(`/offers/${offer.id}`)}>
                            {t('offer.edit', { defaultValue: 'Редактиране' })}
                        </Button>
                    )}
                </Box>
            </Box>

            <Card>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.status.label', { defaultValue: 'Статус' })}
                            </Typography>
                            <Chip
                                label={statusLabels[offer.status] || offer.status}
                                color={statusColor[offer.status] || 'default'}
                                size="small"
                                sx={{ fontWeight: 600 }}
                            />
                            {canEdit && (
                                <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <FormControl size="small" sx={{ minWidth: 180 }}>
                                        <InputLabel>{t('offer.status')}</InputLabel>
                                        <Select
                                            value={statusValue}
                                            label={t('offer.status')}
                                            onChange={(e) => setStatusValue(String(e.target.value))}
                                        >
                                            <MenuItem value="draft">{t('status.draft')}</MenuItem>
                                            <MenuItem value="published">{t('status.published')}</MenuItem>
                                            <MenuItem value="sent">{t('status.sent')}</MenuItem>
                                            <MenuItem value="accepted">{t('status.accepted')}</MenuItem>
                                            <MenuItem value="rejected">{t('status.rejected')}</MenuItem>
                                            <MenuItem value="archived">{t('status.archived')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        disabled={updateStatusMutation.isPending}
                                        onClick={() => updateStatusMutation.mutate(statusValue)}
                                    >
                                        {t('common.save')}
                                    </Button>
                                </Box>
                            )}
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.currency')}
                            </Typography>
                            <Typography>{offer.currency}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.validityDays')}
                            </Typography>
                            <Typography>{offer.validity_days}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.paymentTerms')}
                            </Typography>
                            <Typography>{offer.payment_terms}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.deliveryTime')}
                            </Typography>
                            <Typography>{offer.delivery_time}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.siteAddress')}
                            </Typography>
                            <Typography>{offer.site_address}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }} >
                            <Typography variant="body2" color="text.secondary">
                                {t('offer.projectName')}
                            </Typography>
                            <Typography>{offer.project_name}</Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Card

            >
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">{t('offer.totalCost')}</Typography>
                            <Typography variant="h6">
                                {money.format(Number(offer.total_cost || 0))} {offer.currency}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">{t('offer.priceTotal')}</Typography>
                            <Typography variant="h6">
                                {money.format(Number(offer.total_price || 0))} {offer.currency}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }} >
                            <Typography variant="body2" color="text.secondary">{t('offer.marginTotal')}</Typography>
                            <Typography variant="h6">
                                {money.format(Number(offer.total_margin_value || 0))} {offer.currency} (
                                {money.format(Number(offer.total_margin_percent || 0))}%)
                            </Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {materialLines.length > 0 && (
                <Paper>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h6">{t('offer.lines')}</Typography>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>#</TableCell>
                                    <TableCell>{t('offer.description')}</TableCell>
                                    <TableCell>{t('offer.quantityShort')}</TableCell>
                                    <TableCell>{t('offer.unitShort')}</TableCell>
                                    <TableCell>{t('offer.lineCostShort')}</TableCell>
                                    <TableCell>{t('offer.linePrice')}</TableCell>
                                    {showDiscountColumn && (
                                        <TableCell>{t('offer.priceAfterDiscount', { defaultValue: 'Ед. цена след отстъпка' })}</TableCell>
                                    )}
                                    <TableCell>{t('offer.lineMarginPercent')}</TableCell>
                                    <TableCell>{t('offer.lineTotal')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {materialLines.map((line, index) => {
                                    const { effectivePrice, lineTotal, discount } = getLineAmounts(line);
                                    return (
                                        <TableRow key={line.line_no || index}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{line.description}</TableCell>
                                            <TableCell>{money.format(Number(line.quantity || 0))}</TableCell>
                                            <TableCell>{line.unit}</TableCell>
                                            <TableCell>{money.format(Number(line.cost || 0))}</TableCell>
                                            <TableCell>{money.format(Number(line.price || 0))}</TableCell>
                                            {showDiscountColumn && (
                                                <TableCell>
                                                    <Typography>
                                                        {money.format(effectivePrice)} {offer.currency}
                                                    </Typography>
                                                    {discount ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            -{discount.toFixed(2)}%
                                                        </Typography>
                                                    ) : null}
                                                </TableCell>
                                            )}
                                            <TableCell>{money.format(Number(line.margin_percent || 0))}%</TableCell>
                                            <TableCell>{money.format(lineTotal)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {labourLines.length > 0 && (
                <Paper>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h6">
                            {t('offer.labourLines', { defaultValue: 'Дейности по изпълнение' })}
                        </Typography>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>#</TableCell>
                                    <TableCell>{t('offer.description')}</TableCell>
                                    <TableCell>{t('offer.quantityShort')}</TableCell>
                                    <TableCell>{t('offer.unitShort')}</TableCell>
                                    <TableCell>{t('offer.lineCostShort')}</TableCell>
                                    <TableCell>{t('offer.linePrice')}</TableCell>
                                    {showDiscountColumn && (
                                        <TableCell>{t('offer.priceAfterDiscount', { defaultValue: 'Ед. цена след отстъпка' })}</TableCell>
                                    )}
                                    <TableCell>{t('offer.lineMarginPercent')}</TableCell>
                                    <TableCell>{t('offer.lineTotal')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {labourLines.map((line, index) => {
                                    const { effectivePrice, lineTotal, discount } = getLineAmounts(line);
                                    return (
                                        <TableRow key={line.line_no || `labour-${index}`}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{line.description}</TableCell>
                                            <TableCell>{money.format(Number(line.quantity || 0))}</TableCell>
                                            <TableCell>{line.unit}</TableCell>
                                            <TableCell>{money.format(Number(line.cost || 0))}</TableCell>
                                            <TableCell>{money.format(Number(line.price || 0))}</TableCell>
                                            {showDiscountColumn && (
                                                <TableCell>
                                                    <Typography>
                                                        {money.format(effectivePrice)} {offer.currency}
                                                    </Typography>
                                                    {discount ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            -{discount.toFixed(2)}%
                                                        </Typography>
                                                    ) : null}
                                                </TableCell>
                                            )}
                                            <TableCell>{money.format(Number(line.margin_percent || 0))}%</TableCell>
                                            <TableCell>{money.format(lineTotal)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Box>
    );
};

export default OfferDetails;
