import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    TablePagination
} from '@mui/material';
import { Edit as EditIcon, Add as AddIcon, Search as SearchIcon, UploadFile as UploadIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface ClientSite {
    id: string;
    site_code: string;
    site_name?: string;
    city?: string;
    address?: string;
    project_number?: string;
}

interface ClientBillingProject {
    id: string;
    project_reference: string;
    is_default: boolean;
    is_active: boolean;
}

interface Client {
    id: string;
    name: string;
    client_number?: string;
    project_number?: string;
    salutation_name?: string;
    vat_number: string;
    address: string;
    city: string;
    country: string;
    email: string;
    phone: string;
    notes: string;
    sites?: ClientSite[];
    billing_projects?: ClientBillingProject[];
}

const Clients: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<Client>();

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clients', page, rowsPerPage, search],
        queryFn: async () => {
            const { data } = await api.get('/clients', {
                params: { skip: page * rowsPerPage, limit: rowsPerPage, search }
            });
            return data;
        }
    });

    const createMutation = useMutation({
        mutationFn: (newClient: Client) => api.post('/clients', newClient),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            handleClose();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (client: Client) => api.patch(`/clients/${client.id}`, client),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            handleClose();
        }
    });

    const handleOpen = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            reset(client);
        } else {
            setEditingClient(null);
            reset({});
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingClient(null);
        reset();
    };

    const onSubmit = (data: Client) => {
        if (editingClient) {
            updateMutation.mutate({ ...data, id: editingClient.id });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h4">{t('nav.clients')}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpen()}>
                        {t('client.newClient')}
                    </Button>
                    <Button variant="contained" startIcon={<UploadIcon />} onClick={() => navigate('/clients/import')}>
                        Импорт
                    </Button>
                </Box>
            </Box>

            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <TextField
                    size="small"
                    placeholder={t('common.search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                    }}
                />
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('client.name')}</TableCell>
                            <TableCell>{t('client.clientNumber')}</TableCell>
                            <TableCell>{t('clientBillingLocalized.billingProjectsSummary', { defaultValue: 'Проекти за фактуриране и сервиз' })}</TableCell>
                            <TableCell>{t('client.vat')}</TableCell>
                            <TableCell>{t('client.city')}</TableCell>
                            <TableCell>{t('client.email')}</TableCell>
                            <TableCell>{t('client.phone')}</TableCell>
                            <TableCell>{t('client.sites')}</TableCell>
                            <TableCell>{t('client.actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} align="center">{t('common.loading')}</TableCell>
                            </TableRow>
                        ) : (
                            clients.map((client: Client) => (
                                <TableRow key={client.id}>
                                    <TableCell>{client.name}</TableCell>
                                    <TableCell>{client.client_number}</TableCell>
                                    <TableCell>
                                        {(() => {
                                            const activeProjects = (client.billing_projects || []).filter((project) => project.is_active);
                                            const defaultProject =
                                                activeProjects.find((project) => project.is_default) || activeProjects[0];
                                            if (!client.billing_projects?.length) {
                                                return t('clientBillingLocalized.noBillingProjects', { defaultValue: 'Няма добавени проекти за фактуриране и сервиз.' });
                                            }
                                            return `${activeProjects.length}/${client.billing_projects.length} ${t('clientBillingLocalized.activeLabel', { defaultValue: 'активни' })}${defaultProject ? ` | ${defaultProject.project_reference}` : ''}`;
                                        })()}
                                    </TableCell>
                                    <TableCell>{client.vat_number}</TableCell>
                                    <TableCell>{client.city}</TableCell>
                                    <TableCell>{client.email}</TableCell>
                                    <TableCell>{client.phone}</TableCell>
                                    <TableCell>{client.sites?.length ?? 0}</TableCell>
                                    <TableCell>
                                        <IconButton onClick={() => navigate(`/clients/${client.id}`)}>
                                            <VisibilityIcon />
                                        </IconButton>
                                        <IconButton onClick={() => handleOpen(client)}>
                                            <EditIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={-1} // Unknown total count for now
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </TableContainer>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{editingClient ? t('client.editClient') : t('client.newClient')}</DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        <TextField
                            margin="dense"
                            label={t('client.name')}
                            fullWidth
                            {...register('name', { required: true })}
                            error={!!errors.name}
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                margin="dense"
                                label={t('client.clientNumber')}
                                fullWidth
                                {...register('client_number')}
                            />
                            <TextField
                                margin="dense"
                                label={t('client.projectNumber')}
                                fullWidth
                                {...register('project_number')}
                            />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                            {t('clientBillingLocalized.projectNumberLegacyHint', {
                                defaultValue: 'ERP проектните номера вече се управляват от Client details > Проекти за фактуриране и сервиз. Старите полета остават видими само за съвместимост.',
                            })}
                        </Typography>
                        <TextField
                            margin="dense"
                            label={t('client.vat')}
                            fullWidth
                            {...register('vat_number')}
                        />
                        <TextField
                            margin="dense"
                            label={t('client.salutationName', { defaultValue: 'Име за обръщение' })}
                            fullWidth
                            {...register('salutation_name')}
                        />
                        <TextField
                            margin="dense"
                            label={t('client.address')}
                            fullWidth
                            {...register('address')}
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                margin="dense"
                                label={t('client.city')}
                                fullWidth
                                {...register('city')}
                            />
                            <TextField
                                margin="dense"
                                label={t('client.country')}
                                fullWidth
                                {...register('country')}
                            />
                        </Box>
                        <TextField
                            margin="dense"
                            label={t('client.email')}
                            fullWidth
                            {...register('email')}
                        />
                        <TextField
                            margin="dense"
                            label={t('client.phone')}
                            fullWidth
                            {...register('phone')}
                        />
                        <TextField
                            margin="dense"
                            label={t('client.notes')}
                            fullWidth
                            multiline
                            rows={3}
                            {...register('notes')}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('common.cancel')}</Button>
                        <Button type="submit" variant="contained">{t('common.save')}</Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default Clients;
