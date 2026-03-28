import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

interface User {
    id: string;
    email: string;
    full_name: string;
    user_code: string;
    role: 'admin' | 'user';
    is_active: boolean;
    permissions: string[];
}

interface UserFormData {
    email: string;
    full_name: string;
    user_code: string;
    password: string;
    role: 'admin' | 'user';
    is_active: boolean;
    permissions: string[];
}

const Users: React.FC = () => {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const canManageUsers = hasPermission(currentUser, 'users.manage');
    const queryClient = useQueryClient();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<UserFormData>({
        defaultValues: {
            role: 'user',
            is_active: true,
            permissions: [],
        },
    });

    const watchedRole = watch('role');

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', page, rowsPerPage, search],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users', {
                params: { skip: page * rowsPerPage, limit: rowsPerPage, search: search || undefined },
            });
            return data as User[];
        },
    });

    const { data: permissionCatalog = [] } = useQuery({
        queryKey: ['permissions-catalog'],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users/permissions-catalog');
            return data as string[];
        },
    });

    const createMutation = useMutation({
        mutationFn: (newUser: UserFormData) => api.post('/users', newUser),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            handleClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.dialog.createFailed', { defaultValue: 'Неуспешно създаване на потребител' }));
        },
    });

    const updateMutation = useMutation({
        mutationFn: (user: Partial<UserFormData> & { id: string }) => api.patch(`/users/${user.id}`, user),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            handleClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.dialog.updateFailed', { defaultValue: 'Неуспешно обновяване на потребител' }));
        },
    });

    const handleOpen = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setSelectedPermissions(user.permissions || []);
            reset({
                email: user.email,
                full_name: user.full_name,
                user_code: user.user_code,
                role: user.role,
                is_active: user.is_active,
                password: '',
                permissions: user.permissions || [],
            });
        } else {
            setEditingUser(null);
            setSelectedPermissions([]);
            reset({
                email: '',
                full_name: '',
                user_code: '',
                password: '',
                role: 'user',
                is_active: true,
                permissions: [],
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingUser(null);
        setSelectedPermissions([]);
        reset();
    };

    const togglePermission = (permission: string) => {
        setSelectedPermissions((current) =>
            current.includes(permission)
                ? current.filter((entry) => entry !== permission)
                : [...current, permission]
        );
    };

    const onSubmit = (data: UserFormData) => {
        const payload = {
            ...data,
            permissions: data.role === 'admin' ? [] : selectedPermissions,
        };

        if (editingUser) {
            const updateData: Partial<UserFormData> & { id: string } = {
                id: editingUser.id,
                email: payload.email,
                full_name: payload.full_name,
                user_code: payload.user_code,
                role: payload.role,
                is_active: payload.is_active,
                permissions: payload.permissions,
            };
            if (payload.password) {
                updateData.password = payload.password;
            }
            updateMutation.mutate(updateData);
        } else {
            createMutation.mutate(payload);
        }
    };

    if (!canManageUsers) {
        return <Alert severity="warning">{t('usersPage.noPermission', { defaultValue: 'Нямате право да управлявате потребители.' })}</Alert>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h4">{t('usersPage.title', { defaultValue: 'Потребители' })}</Typography>
                {canManageUsers && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
                        {t('usersPage.newUser', { defaultValue: 'Нов потребител' })}
                    </Button>
                )}
            </Box>

            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <TextField
                    size="small"
                    placeholder={t('usersPage.searchPlaceholder', { defaultValue: 'Търсене...' })}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    InputProps={{
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                    }}
                />
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('usersPage.table.name', { defaultValue: 'Име' })}</TableCell>
                            <TableCell>{t('usersPage.table.email', { defaultValue: 'Имейл' })}</TableCell>
                            <TableCell>{t('usersPage.table.code', { defaultValue: 'Код' })}</TableCell>
                            <TableCell>{t('usersPage.table.role', { defaultValue: 'Роля' })}</TableCell>
                            <TableCell>{t('usersPage.table.permissions', { defaultValue: 'Права' })}</TableCell>
                            <TableCell>{t('usersPage.table.status', { defaultValue: 'Статус' })}</TableCell>
                            {canManageUsers && <TableCell>{t('usersPage.table.actions', { defaultValue: 'Действия' })}</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center">{t('usersPage.loading', { defaultValue: 'Зареждане...' })}</TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.full_name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{user.user_code}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={user.role === 'admin'
                                                ? t('usersPage.roles.admin', { defaultValue: 'Админ' })
                                                : t('usersPage.roles.user', { defaultValue: 'Потребител' })}
                                            color={user.role === 'admin' ? 'primary' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {user.role === 'admin' ? (
                                            <Chip label={t('usersPage.permissions.all', { defaultValue: 'Всички' })} color="primary" size="small" variant="outlined" />
                                        ) : (
                                            <Chip
                                                label={t('usersPage.permissions.selected', {
                                                    defaultValue: '{{count}} избрани',
                                                    count: user.permissions?.length || 0,
                                                })}
                                                size="small"
                                                variant="outlined"
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={user.is_active
                                                ? t('usersPage.statusValues.active', { defaultValue: 'Активен' })
                                                : t('usersPage.statusValues.inactive', { defaultValue: 'Неактивен' })}
                                            color={user.is_active ? 'success' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    {canManageUsers && (
                                        <TableCell>
                                            <IconButton onClick={() => handleOpen(user)}>
                                                <EditIcon />
                                            </IconButton>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={-1}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                    }}
                />
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingUser
                        ? t('usersPage.dialog.editTitle', { defaultValue: 'Редакция на потребител' })
                        : t('usersPage.dialog.createTitle', { defaultValue: 'Нов потребител' })}
                </DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        <TextField
                            margin="dense"
                            label={t('usersPage.dialog.email', { defaultValue: 'Имейл' })}
                            type="email"
                            fullWidth
                            {...register('email', { required: true })}
                            error={!!errors.email}
                            helperText={errors.email && t('usersPage.dialog.emailRequired', { defaultValue: 'Имейлът е задължителен' })}
                        />
                        <TextField
                            margin="dense"
                            label={t('usersPage.dialog.fullName', { defaultValue: 'Име' })}
                            fullWidth
                            {...register('full_name')}
                        />
                        <TextField
                            margin="dense"
                            label={t('usersPage.dialog.userCode', { defaultValue: 'Потребителски код' })}
                            fullWidth
                            {...register('user_code', { required: true })}
                            error={!!errors.user_code}
                            helperText={errors.user_code && t('usersPage.dialog.userCodeRequired', { defaultValue: 'Потребителският код е задължителен' })}
                        />
                        <TextField
                            margin="dense"
                            label={editingUser
                                ? t('usersPage.dialog.newPasswordOptional', { defaultValue: 'Нова парола (по избор)' })
                                : t('usersPage.dialog.password', { defaultValue: 'Парола' })}
                            type="password"
                            fullWidth
                            {...register('password', { required: !editingUser })}
                            error={!!errors.password}
                            helperText={errors.password && t('usersPage.dialog.passwordRequired', { defaultValue: 'Паролата е задължителна' })}
                        />
                        <TextField
                            margin="dense"
                            label={t('usersPage.dialog.role', { defaultValue: 'Роля' })}
                            select
                            fullWidth
                            {...register('role')}
                            defaultValue="user"
                        >
                            <MenuItem value="user">{t('usersPage.roles.user', { defaultValue: 'Потребител' })}</MenuItem>
                            <MenuItem value="admin">{t('usersPage.roles.admin', { defaultValue: 'Админ' })}</MenuItem>
                        </TextField>
                        <FormControlLabel
                            control={<Checkbox {...register('is_active')} defaultChecked />}
                            label={t('usersPage.dialog.active', { defaultValue: 'Активен' })}
                        />

                        {watchedRole !== 'admin' && permissionCatalog.length > 0 && (
                            <Stack spacing={1.25} sx={{ mt: 2 }}>
                                <Typography variant="subtitle2">{t('usersPage.permissions.title', { defaultValue: 'Права' })}</Typography>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                        gap: 1,
                                        maxHeight: 280,
                                        overflowY: 'auto',
                                        p: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1.5,
                                    }}
                                >
                                    {permissionCatalog.map((permission) => (
                                        <FormControlLabel
                                            key={permission}
                                            control={
                                                <Checkbox
                                                    checked={selectedPermissions.includes(permission)}
                                                    onChange={() => togglePermission(permission)}
                                                />
                                            }
                                            label={permission}
                                        />
                                    ))}
                                </Box>
                            </Stack>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('usersPage.dialog.cancel', { defaultValue: 'Отказ' })}</Button>
                        <Button type="submit" variant="contained">
                            {editingUser
                                ? t('usersPage.dialog.save', { defaultValue: 'Запази' })
                                : t('usersPage.dialog.create', { defaultValue: 'Създай' })}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default Users;
