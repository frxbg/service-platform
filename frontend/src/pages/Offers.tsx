import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    TablePagination,
    Chip,
    IconButton,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    TableSortLabel
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    FileCopy as FileCopyIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatBgDate } from '../utils/dateTime';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

interface Offer {
    id: string;
    offer_number: string;
    user_id: string;
    client: { name: string };
    site?: { site_code?: string; site_name?: string };
    project_name: string;
    status: string;
    total_price?: number | string;
    created_at: string;
    user: { user_code: string };
}

const Offers: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canReadOffers = hasAnyPermission(user, ['offers.read_all', 'offers.read_own', 'offers.edit_all', 'offers.edit_own']);
    const canCreateOffer = hasAnyPermission(user, ['offers.edit_all', 'offers.edit_own']);
    const canDeleteOffer = hasPermission(user, 'offers.edit_all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortKey, setSortKey] = useState<'project_name' | 'status' | 'total_price' | 'created_at'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const { data: offers = [], isLoading } = useQuery({
        queryKey: ['offers', page, rowsPerPage, search, statusFilter, dateFrom, dateTo],
        enabled: canReadOffers,
        queryFn: async () => {
            const { data } = await api.get('/offers/', {
                params: {
                    skip: page * rowsPerPage,
                    limit: rowsPerPage,
                    search,
                    status: statusFilter || undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                }
            });
            return data;
        }
    });

    const handleDuplicate = async (offerId: string) => {
        try {
            const { data } = await api.post(`/offers/${offerId}/duplicate`);
            navigate(`/offers/${data.id}`);
        } catch (error) {
            console.error("Duplicate failed", error);
        }
    };

    const deleteOfferMutation = useMutation({
        mutationFn: async (offerId: string) => {
            await api.delete(`/offers/${offerId}`);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['offers'] });
        }
    });

    const handleDelete = async (offerId: string) => {
        const confirmed = window.confirm('Сигурен ли си, че искаш да изтриеш тази оферта?');
        if (!confirmed) return;

        try {
            await deleteOfferMutation.mutateAsync(offerId);
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const statusColors: Record<string, "default" | "primary" | "success" | "error" | "warning" | "secondary"> = {
        DRAFT: "secondary",      // purple
        PUBLISHED: "primary",    // blue
        SENT: "warning",         // yellow
        ACCEPTED: "success",     // green
        REJECTED: "error",       // red
        ARCHIVED: "default",     // light grey
        // Fallback for lowercase
        draft: "secondary",
        published: "primary",
        sent: "warning",
        accepted: "success",
        rejected: "error",
        archived: "default"
    };

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
        archived: t('offer.status.archived', { defaultValue: 'Архивирана' }),
    };


    const formatMoney = (value: number | string | undefined) => {
        const num = Number(value);
        if (Number.isFinite(num)) {
            return num.toFixed(2);
        }
        return '0.00';
    };

    const handleRequestSort = (property: typeof sortKey) => {
        const isAsc = sortKey === property && sortDirection === 'asc';
        setSortDirection(isAsc ? 'desc' : 'asc');
        setSortKey(property);
    };

    const sortedOffers = React.useMemo(() => {
        const list = [...offers];
        return list.sort((a, b) => {
            const dir = sortDirection === 'asc' ? 1 : -1;
            if (sortKey === 'total_price') {
                const aNum = Number(a.total_price) || 0;
                const bNum = Number(b.total_price) || 0;
                return (aNum - bNum) * dir;
            }
            if (sortKey === 'created_at') {
                const aDate = new Date(a.created_at).getTime();
                const bDate = new Date(b.created_at).getTime();
                return (aDate - bDate) * dir;
            }
            const aVal = (a[sortKey] as string) || '';
            const bVal = (b[sortKey] as string) || '';
            return aVal.localeCompare(bVal) * dir;
        });
    }, [offers, sortKey, sortDirection]);

    if (!canReadOffers) {
        return <Alert severity="warning">You do not have permission to view offers.</Alert>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h4">{t('nav.offers')}</Typography>
                {canCreateOffer && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/offers/new')}
                    >
                        {t('offer.new')}
                    </Button>
                )}
            </Box>

            <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    placeholder={t('common.search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ flexGrow: 1 }}
                    InputProps={{
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                    }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('offer.status')}</InputLabel>
                    <Select
                        value={statusFilter}
                        label={t('offer.status')}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <MenuItem value="">{t('status.all')}</MenuItem>
                        <MenuItem value="draft">{t('status.draft')}</MenuItem>
                        <MenuItem value="published">{t('status.published')}</MenuItem>
                        <MenuItem value="sent">{t('status.sent')}</MenuItem>
                        <MenuItem value="accepted">{t('status.accepted')}</MenuItem>
                        <MenuItem value="rejected">{t('status.rejected')}</MenuItem>
                        <MenuItem value="archived">{t('status.archived')}</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    size="small"
                    type="date"
                    label={t('offer.dateFrom', { defaultValue: 'Дата от' })}
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
                <TextField
                    size="small"
                    type="date"
                    label={t('offer.dateTo', { defaultValue: 'Дата до' })}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('offer.number')}</TableCell>
                            <TableCell>{t('offer.client')}</TableCell>
                            <TableCell sortDirection={sortKey === 'project_name' ? sortDirection : false}>
                                <TableSortLabel
                                    active={sortKey === 'project_name'}
                                    direction={sortKey === 'project_name' ? sortDirection : 'asc'}
                                    onClick={() => handleRequestSort('project_name')}
                                >
                                    {t('offer.project')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>{t('client.siteCode', { defaultValue: 'Код на обект / филиал' })}</TableCell>
                            <TableCell sortDirection={sortKey === 'status' ? sortDirection : false}>
                                <TableSortLabel
                                    active={sortKey === 'status'}
                                    direction={sortKey === 'status' ? sortDirection : 'asc'}
                                    onClick={() => handleRequestSort('status')}
                                >
                                    {t('offer.status')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sortDirection={sortKey === 'total_price' ? sortDirection : false}>
                                <TableSortLabel
                                    active={sortKey === 'total_price'}
                                    direction={sortKey === 'total_price' ? sortDirection : 'asc'}
                                    onClick={() => handleRequestSort('total_price')}
                                >
                                    {t('offer.totalPrice')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sortDirection={sortKey === 'created_at' ? sortDirection : false}>
                                <TableSortLabel
                                    active={sortKey === 'created_at'}
                                    direction={sortKey === 'created_at' ? sortDirection : 'asc'}
                                    onClick={() => handleRequestSort('created_at')}
                                >
                                    {t('offer.createdAt')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>{t('offer.actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">{t('common.loading')}</TableCell>
                            </TableRow>
                        ) : (
                            sortedOffers.map((offer: Offer) => {
                                const canEditOffer =
                                    hasPermission(user, 'offers.edit_all') ||
                                    (hasPermission(user, 'offers.edit_own') && offer.user_id === user?.id);
                                return (
                                <TableRow
                                    key={offer.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/offers/${offer.id}/view`)}
                                >
                                    <TableCell>{offer.offer_number}</TableCell>
                                    <TableCell>{offer.client?.name}</TableCell>
                                    <TableCell>{offer.project_name}</TableCell>
                                    <TableCell>{offer.site?.site_code || '-'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={statusLabels[offer.status] || offer.status}
                                            color={statusColors[offer.status] || "default"}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{formatMoney(offer.total_price)}</TableCell>
                                    <TableCell>{formatBgDate(offer.created_at)}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        {canEditOffer && (
                                            <IconButton onClick={() => navigate(`/offers/${offer.id}`)}>
                                                <EditIcon />
                                            </IconButton>
                                        )}
                                        {canEditOffer && (
                                            <IconButton onClick={() => handleDuplicate(offer.id)}>
                                                <FileCopyIcon />
                                            </IconButton>
                                        )}
                                        {canDeleteOffer && (
                                            <IconButton onClick={() => handleDelete(offer.id)} title={t('offer.delete')}>
                                                <DeleteIcon />
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={-1}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </TableContainer>
        </Box>
    );
};

export default Offers;
