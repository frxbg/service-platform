import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import Roles from './Roles';

type UserRoleValue = 'admin' | 'office' | 'technician' | 'custom';

interface User {
    id: string;
    email: string;
    full_name: string;
    user_code: string;
    role: UserRoleValue;
    role_template_id?: string | null;
    is_active: boolean;
    permissions: string[];
}

interface RoleTemplate {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    role: UserRoleValue;
    permission_codes: string[];
    is_system: boolean;
    is_active: boolean;
}

interface UserFormData {
    email: string;
    full_name: string;
    user_code: string;
    password: string;
    role_template_id: string;
    is_active: boolean;
}

interface CreateUserPayload extends Omit<UserFormData, 'role_template_id'> {
    role_template_id: string | null;
}

const Users: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentUser } = useAuth();
    const canManageUsers = hasPermission(currentUser, 'users.manage');
    const queryClient = useQueryClient();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<UserFormData>({
        defaultValues: {
            role_template_id: '',
            is_active: true,
        },
    });

    const selectedRoleTemplateId = watch('role_template_id');
    const activeSection = searchParams.get('section') === 'roles' ? 'roles' : 'users';

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', page, rowsPerPage, search],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users/', {
                params: { skip: page * rowsPerPage, limit: rowsPerPage, search: search || undefined },
            });
            return data as User[];
        },
    });

    const { data: roleTemplates = [] } = useQuery({
        queryKey: ['role-templates'],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users/roles');
            return data as RoleTemplate[];
        },
    });

    const activeRoleTemplates = useMemo(
        () => roleTemplates.filter((entry) => entry.is_active || entry.id === editingUser?.role_template_id),
        [editingUser?.role_template_id, roleTemplates],
    );

    const selectedRoleTemplate = useMemo(
        () => roleTemplates.find((entry) => entry.id === selectedRoleTemplateId),
        [roleTemplates, selectedRoleTemplateId],
    );

    const createMutation = useMutation({
        mutationFn: (newUser: CreateUserPayload) => api.post('/users/', newUser),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            handleClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.dialog.createFailed'));
        },
    });

    const updateMutation = useMutation({
        mutationFn: (payload: Partial<UserFormData> & { id: string }) => api.patch(`/users/${payload.id}`, payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            handleClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.dialog.updateFailed'));
        },
    });

    const handleOpen = (user?: User) => {
        if (user) {
            setEditingUser(user);
            reset({
                email: user.email,
                full_name: user.full_name,
                user_code: user.user_code,
                role_template_id: user.role_template_id || '',
                is_active: user.is_active,
                password: '',
            });
        } else {
            setEditingUser(null);
            const defaultRoleTemplate =
                roleTemplates.find((entry) => entry.code === 'technician') ||
                roleTemplates.find((entry) => entry.role === 'technician' && entry.is_active) ||
                activeRoleTemplates[0];
            reset({
                email: '',
                full_name: '',
                user_code: '',
                password: '',
                role_template_id: defaultRoleTemplate?.id || '',
                is_active: true,
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingUser(null);
        reset({
            email: '',
            full_name: '',
            user_code: '',
            password: '',
            role_template_id: '',
            is_active: true,
        });
    };

    const onSubmit = (data: UserFormData) => {
        const payload = {
            ...data,
            role_template_id: data.role_template_id || null,
        };

        if (editingUser) {
            const updateData: Partial<UserFormData> & { id: string } = {
                id: editingUser.id,
                email: payload.email,
                full_name: payload.full_name,
                user_code: payload.user_code,
                role_template_id: payload.role_template_id || '',
                is_active: payload.is_active,
            };
            if (payload.password) {
                updateData.password = payload.password;
            }
            updateMutation.mutate(updateData);
            return;
        }

        createMutation.mutate(payload);
    };

    const getRoleLabel = (roleValue: UserRoleValue) => t(`usersPage.roles.${roleValue}`);

    const handleSectionChange = (_event: React.SyntheticEvent, nextValue: 'users' | 'roles') => {
        if (nextValue === 'roles') {
            setSearchParams({ section: 'roles' });
            return;
        }
        setSearchParams({});
    };

    if (!canManageUsers) {
        return <Alert severity="warning">{t('usersPage.noPermission')}</Alert>;
    }

    return (
        <Stack spacing={3}>
            <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h4">{t('usersPage.title')}</Typography>
                    {activeSection === 'users' && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
                            {t('usersPage.newUser')}
                        </Button>
                    )}
                </Box>

                <Tabs value={activeSection} onChange={handleSectionChange}>
                    <Tab value="users" label={t('usersPage.sections.users')} />
                    <Tab value="roles" label={t('usersPage.sections.roles')} />
                </Tabs>
            </Stack>

            {activeSection === 'roles' ? (
                <Roles embedded />
            ) : (
                <>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            size="small"
                            placeholder={t('usersPage.searchPlaceholder')}
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
                                    <TableCell>{t('usersPage.table.name')}</TableCell>
                                    <TableCell>{t('usersPage.table.email')}</TableCell>
                                    <TableCell>{t('usersPage.table.code')}</TableCell>
                                    <TableCell>{t('usersPage.table.role')}</TableCell>
                                    <TableCell>{t('usersPage.table.permissions')}</TableCell>
                                    <TableCell>{t('usersPage.table.status')}</TableCell>
                                    <TableCell>{t('usersPage.table.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">{t('usersPage.loading')}</TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => {
                                        const userRoleTemplate = roleTemplates.find((entry) => entry.id === user.role_template_id);
                                        return (
                                            <TableRow key={user.id}>
                                                <TableCell>{user.full_name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>{user.user_code}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Chip
                                                            label={userRoleTemplate?.name || getRoleLabel(user.role)}
                                                            color={user.role === 'admin' ? 'primary' : 'default'}
                                                            size="small"
                                                        />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {getRoleLabel(user.role)}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={user.role === 'admin'
                                                            ? t('usersPage.permissions.all')
                                                            : t('usersPage.permissions.selected', {
                                                                count: user.permissions?.length || 0,
                                                            })}
                                                        size="small"
                                                        variant="outlined"
                                                        color={user.role === 'admin' ? 'primary' : 'default'}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={user.is_active
                                                            ? t('usersPage.statusValues.active')
                                                            : t('usersPage.statusValues.inactive')}
                                                        color={user.is_active ? 'success' : 'default'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <IconButton onClick={() => handleOpen(user)}>
                                                        <EditIcon />
                                                    </IconButton>
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
                            onRowsPerPageChange={(event) => {
                                setRowsPerPage(parseInt(event.target.value, 10));
                                setPage(0);
                            }}
                        />
                    </TableContainer>

                    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
                        <DialogTitle>
                            {editingUser ? t('usersPage.dialog.editTitle') : t('usersPage.dialog.createTitle')}
                        </DialogTitle>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <DialogContent>
                                <Stack spacing={2} sx={{ pt: 1 }}>
                                    <TextField
                                        label={t('usersPage.dialog.email')}
                                        type="email"
                                        fullWidth
                                        {...register('email', { required: true })}
                                        error={!!errors.email}
                                        helperText={errors.email && t('usersPage.dialog.emailRequired')}
                                    />
                                    <TextField
                                        label={t('usersPage.dialog.fullName')}
                                        fullWidth
                                        {...register('full_name')}
                                    />
                                    <TextField
                                        label={t('usersPage.dialog.userCode')}
                                        fullWidth
                                        {...register('user_code', { required: true })}
                                        error={!!errors.user_code}
                                        helperText={errors.user_code && t('usersPage.dialog.userCodeRequired')}
                                    />
                                    <TextField
                                        label={editingUser ? t('usersPage.dialog.newPasswordOptional') : t('usersPage.dialog.password')}
                                        type="password"
                                        fullWidth
                                        {...register('password', { required: !editingUser })}
                                        error={!!errors.password}
                                        helperText={errors.password && t('usersPage.dialog.passwordRequired')}
                                    />
                                    <TextField
                                        label={t('usersPage.dialog.assignedRole')}
                                        select
                                        fullWidth
                                        {...register('role_template_id', { required: true })}
                                        error={!!errors.role_template_id}
                                        helperText={errors.role_template_id ? t('usersPage.dialog.roleRequired') : t('usersPage.dialog.roleHelp')}
                                    >
                                        {activeRoleTemplates.map((roleTemplate) => (
                                            <MenuItem key={roleTemplate.id} value={roleTemplate.id}>
                                                {roleTemplate.name} ({getRoleLabel(roleTemplate.role)})
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    {selectedRoleTemplate && (
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Stack spacing={1}>
                                                <Typography variant="subtitle2">{selectedRoleTemplate.name}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {selectedRoleTemplate.description || t('usersPage.rolesSection.noDescription')}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {selectedRoleTemplate.role === 'admin'
                                                        ? t('usersPage.permissions.inheritedAll')
                                                        : t('usersPage.permissions.inheritedCount', {
                                                            count: selectedRoleTemplate.permission_codes.length,
                                                        })}
                                                </Typography>
                                            </Stack>
                                        </Paper>
                                    )}
                                    <FormControlLabel
                                        control={<Checkbox {...register('is_active')} defaultChecked />}
                                        label={t('usersPage.dialog.active')}
                                    />
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose}>{t('usersPage.dialog.cancel')}</Button>
                                <Button type="submit" variant="contained">
                                    {editingUser ? t('usersPage.dialog.save') : t('usersPage.dialog.create')}
                                </Button>
                            </DialogActions>
                        </form>
                    </Dialog>
                </>
            )}
        </Stack>
    );
};

export default Users;
