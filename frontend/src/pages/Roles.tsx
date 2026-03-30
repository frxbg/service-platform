import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
    Divider,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

type UserRoleValue = 'admin' | 'office' | 'technician' | 'custom';

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

interface RoleCatalogEntry {
    value: UserRoleValue;
    label: string;
}

interface RoleFormData {
    code: string;
    name: string;
    description: string;
    role: UserRoleValue;
    is_active: boolean;
}

interface RolesProps {
    embedded?: boolean;
}

const emptyRoleForm: RoleFormData = {
    code: '',
    name: '',
    description: '',
    role: 'custom',
    is_active: true,
};

const Roles: React.FC<RolesProps> = ({ embedded = false }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const canManageUsers = hasPermission(currentUser, 'users.manage');
    const queryClient = useQueryClient();
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleTemplate | null>(null);
    const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<RoleFormData>({
        defaultValues: emptyRoleForm,
    });

    const watchedRoleType = watch('role');

    const { data: permissionCatalog = [] } = useQuery({
        queryKey: ['permissions-catalog'],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users/permissions-catalog');
            return data as string[];
        },
    });

    const { data: roleTemplates = [], isLoading } = useQuery({
        queryKey: ['role-templates'],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users/roles');
            return data as RoleTemplate[];
        },
    });

    const { data: roleCatalog = [] } = useQuery({
        queryKey: ['roles-catalog'],
        enabled: canManageUsers,
        queryFn: async () => {
            const { data } = await api.get('/users/roles-catalog');
            return data as RoleCatalogEntry[];
        },
    });

    const createRoleMutation = useMutation({
        mutationFn: (payload: RoleFormData & { permission_codes: string[] }) => api.post('/users/roles', payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['role-templates'] });
            handleRoleClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.roleDialog.createFailed'));
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: (payload: RoleFormData & { permission_codes: string[]; id: string }) =>
            api.patch(`/users/roles/${payload.id}`, payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['role-templates'] });
            await queryClient.invalidateQueries({ queryKey: ['users'] });
            handleRoleClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.roleDialog.updateFailed'));
        },
    });

    const deleteRoleMutation = useMutation({
        mutationFn: (roleId: string) => api.delete(`/users/roles/${roleId}`),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['role-templates'] });
            await queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || t('usersPage.roleDialog.deleteFailed'));
        },
    });

    const handleRoleOpen = (roleTemplate?: RoleTemplate) => {
        if (roleTemplate) {
            setEditingRole(roleTemplate);
            setSelectedRolePermissions(roleTemplate.permission_codes || []);
            reset({
                code: roleTemplate.code,
                name: roleTemplate.name,
                description: roleTemplate.description || '',
                role: roleTemplate.role,
                is_active: roleTemplate.is_active,
            });
        } else {
            setEditingRole(null);
            setSelectedRolePermissions([]);
            reset(emptyRoleForm);
        }
        setRoleDialogOpen(true);
    };

    const handleRoleClose = () => {
        setRoleDialogOpen(false);
        setEditingRole(null);
        setSelectedRolePermissions([]);
        reset(emptyRoleForm);
    };

    const toggleRolePermission = (permission: string) => {
        setSelectedRolePermissions((current) =>
            current.includes(permission)
                ? current.filter((entry) => entry !== permission)
                : [...current, permission],
        );
    };

    const onRoleSubmit = (data: RoleFormData) => {
        const payload = {
            ...data,
            code: data.code.trim().toLowerCase(),
            name: data.name.trim(),
            description: data.description.trim(),
            permission_codes: data.role === 'admin' ? [] : selectedRolePermissions,
        };

        if (editingRole) {
            updateRoleMutation.mutate({
                id: editingRole.id,
                ...payload,
            });
            return;
        }

        createRoleMutation.mutate(payload);
    };

    const getRoleLabel = (roleValue: UserRoleValue) => t(`usersPage.roles.${roleValue}`);
    const getPermissionLabel = (permission: string) =>
        t(`usersPage.permissionLabels.${permission}`, { defaultValue: permission });

    const canDeleteRole = (roleTemplate: RoleTemplate) => roleTemplate.role !== 'admin';

    const handleRoleDelete = (roleTemplate: RoleTemplate) => {
        if (!canDeleteRole(roleTemplate)) {
            return;
        }

        const confirmed = window.confirm(
            t('usersPage.roleDialog.confirmDelete', { name: roleTemplate.name }),
        );
        if (!confirmed) {
            return;
        }

        deleteRoleMutation.mutate(roleTemplate.id);
    };

    if (!canManageUsers) {
        return <Alert severity="warning">{t('usersPage.noPermission')}</Alert>;
    }

    return (
        <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box>
                    <Typography variant={embedded ? 'h5' : 'h4'}>{t('usersPage.rolesSection.title')}</Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('usersPage.rolesSection.subtitle')}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                    {!embedded && (
                        <Button variant="outlined" onClick={() => navigate('/users')}>
                            {t('usersPage.backToUsers')}
                        </Button>
                    )}
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleRoleOpen()}>
                        {t('usersPage.rolesSection.newRole')}
                    </Button>
                </Stack>
            </Box>

            <Stack spacing={1.5}>
                {isLoading ? (
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                        <Typography>{t('usersPage.loading')}</Typography>
                    </Paper>
                ) : roleTemplates.length === 0 ? (
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                        <Typography color="text.secondary">{t('usersPage.rolesSection.empty')}</Typography>
                    </Paper>
                ) : (
                    roleTemplates.map((roleTemplate) => (
                        <Paper key={roleTemplate.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={2}
                                alignItems={{ xs: 'flex-start', md: 'center' }}
                                justifyContent="space-between"
                            >
                                <Box>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                            {roleTemplate.name}
                                        </Typography>
                                        <Chip
                                            size="small"
                                            label={getRoleLabel(roleTemplate.role)}
                                            color={roleTemplate.role === 'admin' ? 'primary' : 'default'}
                                        />
                                        {roleTemplate.is_system && (
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label={t('usersPage.rolesSection.systemRole')}
                                            />
                                        )}
                                        <Chip
                                            size="small"
                                            color={roleTemplate.is_active ? 'success' : 'default'}
                                            label={roleTemplate.is_active
                                                ? t('usersPage.statusValues.active')
                                                : t('usersPage.statusValues.inactive')}
                                        />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {roleTemplate.description || t('usersPage.rolesSection.noDescription')}
                                    </Typography>
                                    <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap">
                                        <Typography variant="caption" color="text.secondary">
                                            {t('usersPage.roleDialog.code')}: {roleTemplate.code}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('usersPage.rolesSection.permissionCount', {
                                                count: roleTemplate.role === 'admin'
                                                    ? permissionCatalog.length
                                                    : roleTemplate.permission_codes.length,
                                            })}
                                        </Typography>
                                    </Stack>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    {canDeleteRole(roleTemplate) && (
                                        <IconButton
                                            color="error"
                                            disabled={deleteRoleMutation.isPending}
                                            onClick={() => handleRoleDelete(roleTemplate)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    )}
                                    <IconButton onClick={() => handleRoleOpen(roleTemplate)}>
                                        <EditIcon />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        </Paper>
                    ))
                )}
            </Stack>

            <Dialog open={roleDialogOpen} onClose={handleRoleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingRole ? t('usersPage.roleDialog.editTitle') : t('usersPage.roleDialog.createTitle')}
                </DialogTitle>
                <form onSubmit={handleSubmit(onRoleSubmit)}>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <TextField
                                label={t('usersPage.roleDialog.code')}
                                fullWidth
                                disabled={editingRole?.is_system}
                                {...register('code', { required: true })}
                                error={!!errors.code}
                                helperText={errors.code && t('usersPage.roleDialog.codeRequired')}
                            />
                            <TextField
                                label={t('usersPage.roleDialog.name')}
                                fullWidth
                                {...register('name', { required: true })}
                                error={!!errors.name}
                                helperText={errors.name && t('usersPage.roleDialog.nameRequired')}
                            />
                            <TextField
                                label={t('usersPage.roleDialog.description')}
                                fullWidth
                                multiline
                                minRows={2}
                                {...register('description')}
                            />
                            <TextField
                                label={t('usersPage.roleDialog.baseRole')}
                                select
                                fullWidth
                                disabled={editingRole?.is_system}
                                {...register('role')}
                            >
                                {roleCatalog.map((entry) => (
                                    <MenuItem key={entry.value} value={entry.value}>
                                        {getRoleLabel(entry.value)}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <FormControlLabel
                                control={<Checkbox {...register('is_active')} defaultChecked />}
                                label={t('usersPage.roleDialog.active')}
                            />

                            <Divider />

                            <Stack spacing={1.25}>
                                <Typography variant="subtitle2">{t('usersPage.permissions.title')}</Typography>
                                {watchedRoleType === 'admin' ? (
                                    <Alert severity="info" variant="outlined">
                                        {t('usersPage.roleDialog.adminHasAllPermissions')}
                                    </Alert>
                                ) : (
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                            gap: 1,
                                            maxHeight: 320,
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
                                                        checked={selectedRolePermissions.includes(permission)}
                                                        onChange={() => toggleRolePermission(permission)}
                                                    />
                                                }
                                                label={getPermissionLabel(permission)}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Stack>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleRoleClose}>{t('usersPage.dialog.cancel')}</Button>
                        <Button type="submit" variant="contained">
                            {editingRole ? t('usersPage.dialog.save') : t('usersPage.dialog.create')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Stack>
    );
};

export default Roles;
