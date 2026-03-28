import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Add as AddIcon,
    Assignment as AssignmentIcon,
    Description as DescriptionIcon,
    ErrorOutline as ErrorOutlineIcon,
    HourglassTop as HourglassTopIcon,
    PlaylistAddCheckCircle as PlaylistAddCheckCircleIcon,
} from '@mui/icons-material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import { getAppLocale, getRequestPriorityLabel, getRequestStatusLabel, requestPriorityColors, requestStatusColors } from '../utils/serviceRequestI18n';

interface RequestListItem {
    id: string;
    request_number: string;
    priority: string;
    status: string;
    client: { name: string };
    site: { site_code: string; site_name?: string | null };
    assigned_technicians: string[];
    reported_at: string;
}

interface ServiceDashboardSummary {
    total_requests: number;
    active_requests: number;
    new_requests: number;
    urgent_requests: number;
    in_progress_requests: number;
    unassigned_requests: number;
    status_breakdown: Record<string, number>;
    recent_requests: RequestListItem[];
}

interface OffersStats {
    offers_by_status: Record<string, number>;
    recent_offers: Array<{
        id: string;
        offer_number: string;
        client_name: string;
        project_name: string;
        status: string;
        total_price?: number | string;
        created_at: string;
    }>;
}

interface StatCardProps {
    title: string;
    value?: number;
    icon: React.ReactNode;
    gradient: string;
    loading?: boolean;
}

const OFFER_STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning' | 'secondary'> = {
    DRAFT: 'secondary',
    PUBLISHED: 'primary',
    SENT: 'warning',
    ACCEPTED: 'success',
    REJECTED: 'error',
    ARCHIVED: 'default',
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, gradient, loading }) => (
    <Card
        sx={{
            height: '100%',
            border: 'none',
            color: '#fff',
            background: gradient,
            boxShadow: '0 10px 32px rgba(15, 23, 42, 0.14)',
        }}
    >
        <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Box>
                    <Typography variant="caption" sx={{ opacity: 0.82, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {title}
                    </Typography>
                    {loading ? (
                        <Skeleton variant="text" width={88} height={42} sx={{ bgcolor: 'rgba(255,255,255,0.22)' }} />
                    ) : (
                        <Typography variant="h3" sx={{ mt: 0.75, fontWeight: 800, lineHeight: 1 }}>
                            {value ?? 0}
                        </Typography>
                    )}
                </Box>
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {icon}
                </Box>
            </Stack>
        </CardContent>
    </Card>
);

const Dashboard: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    const locale = getAppLocale(i18n.resolvedLanguage);
    const canReadService = hasAnyPermission(user, ['service_requests.read_all', 'service_requests.read_assigned']);
    const canCreateService = hasPermission(user, 'service_requests.create');
    const canReadOffers = hasAnyPermission(user, ['offers.read_all', 'offers.read_own', 'offers.edit_all', 'offers.edit_own']);

    const { data: requestSummary, isLoading: requestsLoading } = useQuery<ServiceDashboardSummary>({
        queryKey: ['dashboard-service-summary'],
        enabled: canReadService,
        queryFn: async () => (await api.get('/service-requests/dashboard-summary')).data,
    });

    const { data: offersStats, isLoading: offersLoading } = useQuery<OffersStats>({
        queryKey: ['dashboard-offers-summary'],
        enabled: canReadOffers,
        queryFn: async () => (await api.get('/offers/stats')).data,
    });

    const requestCards = [
        {
            title: t('dashboardService.cards.newRequests', { defaultValue: 'Нови заявки' }),
            value: requestSummary?.new_requests,
            icon: <ErrorOutlineIcon sx={{ color: '#fff' }} />,
            gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
        },
        {
            title: t('dashboardService.cards.activeRequests', { defaultValue: 'Активни заявки' }),
            value: requestSummary?.active_requests,
            icon: <AssignmentIcon sx={{ color: '#fff' }} />,
            gradient: 'linear-gradient(135deg, #1d4ed8 0%, #0f766e 100%)',
        },
        {
            title: t('dashboardService.cards.urgentQueue', { defaultValue: 'Спешна опашка' }),
            value: requestSummary?.urgent_requests,
            icon: <HourglassTopIcon sx={{ color: '#fff' }} />,
            gradient: 'linear-gradient(135deg, #b91c1c 0%, #7c3aed 100%)',
        },
        {
            title: t('dashboardService.cards.unassigned', { defaultValue: 'Неразпределени' }),
            value: requestSummary?.unassigned_requests,
            icon: <PlaylistAddCheckCircleIcon sx={{ color: '#fff' }} />,
            gradient: 'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
        },
    ];

    return (
        <Stack spacing={3}>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                spacing={1.5}
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {t('dashboardService.title', { defaultValue: 'Сервизно табло' })}
                    </Typography>
                    <Typography color="text.secondary">
                        {t('dashboardService.subtitle', {
                            defaultValue: 'Новите и активните заявки са основният фокус тук. Офертите остават като вторичен контекст.',
                        })}
                    </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    {canReadService && (
                        <Button variant="outlined" onClick={() => navigate('/service-requests')}>
                            {t('dashboardService.openQueue', { defaultValue: 'Отвори опашката със заявки' })}
                        </Button>
                    )}
                    {canCreateService && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/service-requests')}>
                            {t('dashboardService.newRequest', { defaultValue: 'Нова заявка' })}
                        </Button>
                    )}
                </Stack>
            </Stack>

            {!canReadService ? (
                <Alert severity="warning">
                    {t('dashboardService.noPermission', {
                        defaultValue: 'Текущият профил няма право да вижда сервизните заявки.',
                    })}
                </Alert>
            ) : (
                <>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' },
                            gap: 2,
                        }}
                    >
                        {requestCards.map((card) => (
                            <StatCard key={card.title} {...card} loading={requestsLoading} />
                        ))}
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', xl: '1.8fr 1fr' },
                            gap: 2.5,
                        }}
                    >
                        <Paper sx={{ overflow: 'hidden' }}>
                            <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {t('dashboardService.latestTitle', { defaultValue: 'Последни сервизни заявки' })}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('dashboardService.latestSubtitle', {
                                        defaultValue: 'Най-новите входящи тикети и текущо разпределените техници.',
                                    })}
                                </Typography>
                            </Box>
                            <TableContainer>
                                <Table size={isMobile ? 'small' : 'medium'}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('dashboardService.table.request', { defaultValue: 'Заявка' })}</TableCell>
                                            <TableCell>{t('dashboardService.table.clientSite', { defaultValue: 'Клиент / Обект' })}</TableCell>
                                            <TableCell>{t('dashboardService.table.status', { defaultValue: 'Статус' })}</TableCell>
                                            {!isMobile && <TableCell>{t('dashboardService.table.technicians', { defaultValue: 'Техници' })}</TableCell>}
                                            <TableCell>{t('dashboardService.table.reported', { defaultValue: 'Подадена' })}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {requestsLoading
                                            ? Array.from({ length: 6 }).map((_, index) => (
                                                <TableRow key={index}>
                                                    <TableCell colSpan={isMobile ? 4 : 5}>
                                                        <Skeleton variant="text" />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                            : requestSummary?.recent_requests.map((request) => (
                                                <TableRow
                                                    key={request.id}
                                                    hover
                                                    sx={{ cursor: 'pointer' }}
                                                    onClick={() => navigate(`/service-requests/${request.id}`)}
                                                >
                                                    <TableCell>
                                                        <Stack spacing={0.75}>
                                                            <Typography sx={{ fontWeight: 700 }}>{request.request_number}</Typography>
                                                            <Chip
                                                                label={getRequestPriorityLabel(t, request.priority)}
                                                                color={requestPriorityColors[request.priority] || 'default'}
                                                                size="small"
                                                                sx={{ width: 'fit-content', textTransform: 'uppercase' }}
                                                            />
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography sx={{ fontWeight: 600 }}>{request.client.name}</Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {request.site.site_name || request.site.site_code}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={getRequestStatusLabel(t, request.status)}
                                                            color={requestStatusColors[request.status] || 'default'}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    {!isMobile && (
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {request.assigned_technicians.length > 0
                                                                    ? request.assigned_technicians.join(', ')
                                                                    : t('common.notAssigned', { defaultValue: 'Няма назначен' })}
                                                            </Typography>
                                                        </TableCell>
                                                    )}
                                                    <TableCell>{new Date(request.reported_at).toLocaleString(locale)}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        <Stack spacing={2.5}>
                            <Paper sx={{ p: 2.5 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                                    {t('dashboardService.statusOverview', { defaultValue: 'Преглед по статуси' })}
                                </Typography>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    {requestsLoading
                                        ? Array.from({ length: 6 }).map((_, index) => (
                                            <Skeleton key={index} variant="rounded" width={120} height={32} />
                                        ))
                                        : Object.entries(requestSummary?.status_breakdown || {}).map(([status, count]) => (
                                            <Box
                                                key={status}
                                                sx={{
                                                    px: 1.25,
                                                    py: 1,
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.paper',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                }}
                                            >
                                                <Chip
                                                    label={getRequestStatusLabel(t, status)}
                                                    color={requestStatusColors[status] || 'default'}
                                                    size="small"
                                                />
                                                <Typography sx={{ fontWeight: 700 }}>{count}</Typography>
                                            </Box>
                                        ))}
                                </Stack>
                            </Paper>

                            <Paper sx={{ p: 2.5 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                                    {t('dashboardService.focusTitle', { defaultValue: 'Фокус върху заявките' })}
                                </Typography>
                                <Stack spacing={1.25}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('dashboardService.focus.newRequests', {
                                            defaultValue: 'Нови заявки: {{count}}',
                                            count: requestSummary?.new_requests ?? 0,
                                        })}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('dashboardService.focus.inProgress', {
                                            defaultValue: 'В процес: {{count}}',
                                            count: requestSummary?.in_progress_requests ?? 0,
                                        })}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('dashboardService.focus.urgentQueue', {
                                            defaultValue: 'Спешна опашка: {{count}}',
                                            count: requestSummary?.urgent_requests ?? 0,
                                        })}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('dashboardService.focus.unassigned', {
                                            defaultValue: 'Неразпределени: {{count}}',
                                            count: requestSummary?.unassigned_requests ?? 0,
                                        })}
                                    </Typography>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Box>
                </>
            )}

            {canReadOffers && (
                <Paper sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {t('dashboardService.offersTitle', { defaultValue: 'Снимка на офертите' })}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('dashboardService.offersSubtitle', {
                                    defaultValue: 'Вторичен търговски контекст за същия workspace.',
                                })}
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {offersLoading
                                ? Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton key={index} variant="rounded" width={120} height={32} />
                                ))
                                : Object.entries(offersStats?.offers_by_status || {}).map(([status, count]) => (
                                    <Box
                                        key={status}
                                        sx={{
                                            px: 1.25,
                                            py: 1,
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <Chip label={status} color={OFFER_STATUS_COLOR[status] || 'default'} size="small" />
                                        <Typography sx={{ fontWeight: 700 }}>{count}</Typography>
                                    </Box>
                                ))}
                        </Stack>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('dashboardService.offersTable.offer', { defaultValue: 'Оферта' })}</TableCell>
                                        <TableCell>{t('dashboardService.offersTable.client', { defaultValue: 'Клиент' })}</TableCell>
                                        <TableCell>{t('dashboardService.offersTable.status', { defaultValue: 'Статус' })}</TableCell>
                                        <TableCell align="right">{t('dashboardService.offersTable.value', { defaultValue: 'Стойност' })}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {offersLoading
                                        ? Array.from({ length: 4 }).map((_, index) => (
                                            <TableRow key={index}>
                                                <TableCell colSpan={4}>
                                                    <Skeleton variant="text" />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                        : offersStats?.recent_offers?.slice(0, 5).map((offer) => (
                                            <TableRow
                                                key={offer.id}
                                                hover
                                                sx={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/offers/${offer.id}/view`)}
                                            >
                                                <TableCell>{offer.offer_number}</TableCell>
                                                <TableCell>{offer.client_name}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={t(`status.${offer.status.toLowerCase()}`, { defaultValue: offer.status })}
                                                        color={OFFER_STATUS_COLOR[offer.status] || 'default'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    {Number(offer.total_price || 0).toLocaleString(locale, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })} EUR
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Button
                            variant="text"
                            startIcon={<DescriptionIcon />}
                            sx={{ alignSelf: 'flex-start' }}
                            onClick={() => navigate('/offers')}
                        >
                            {t('dashboardService.openOffers', { defaultValue: 'Отвори офертите' })}
                        </Button>
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
};

export default Dashboard;
