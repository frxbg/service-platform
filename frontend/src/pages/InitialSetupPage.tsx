import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';

import api from '../api/axios';

interface FormValues {
    email: string;
    full_name: string;
    password: string;
    user_code: string;
}

export const InitialSetupPage: React.FC = () => {
    const { t } = useTranslation();
    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const navigate = useNavigate();

    const onSubmit = async (data: FormValues) => {
        setError(null);
        try {
            await api.post('/auth/bootstrap-superuser', data);
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail ?? t('auth.passwordResetRequestError'));
        }
    };

    if (success) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f5f5f5',
                }}
            >
                <Container maxWidth="sm">
                    <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="h4" gutterBottom color="success.main">
                            {t('auth.initialSetupSuccessTitle')}
                        </Typography>
                        <Typography variant="h6" gutterBottom>
                            {t('auth.initialSetupSuccessSubtitle')}
                        </Typography>
                        <Typography color="text.secondary">
                            {t('auth.loginContinue')}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                            {t('auth.initialSetupRedirecting')}
                        </Typography>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
            }}
        >
            <Container maxWidth="sm">
                <Paper elevation={3} sx={{ p: 4 }}>
                    <Typography variant="h4" gutterBottom align="center" color="primary">
                        {t('app.brandName')}
                    </Typography>
                    <Typography variant="h5" gutterBottom align="center">
                        {t('auth.initialSetupTitle')}
                    </Typography>
                    <Typography variant="body1" gutterBottom align="center" color="text.secondary" sx={{ mb: 3 }}>
                        {t('auth.initialSetupSubtitle')}
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                        <TextField
                            label={t('auth.email')}
                            type="email"
                            fullWidth
                            margin="normal"
                            {...register('email', { required: t('auth.emailRequired') })}
                            error={!!errors.email}
                            helperText={errors.email?.message}
                        />
                        <TextField
                            label={t('auth.fullName')}
                            fullWidth
                            margin="normal"
                            {...register('full_name', { required: t('auth.fullNameRequired') })}
                            error={!!errors.full_name}
                            helperText={errors.full_name?.message}
                        />
                        <TextField
                            label={t('auth.userCode')}
                            fullWidth
                            margin="normal"
                            helperText={errors.user_code?.message || t('auth.userCodeHint')}
                            {...register('user_code', {
                                required: t('auth.userCodeRequired'),
                                minLength: { value: 2, message: t('auth.userCodeMin') },
                                maxLength: { value: 10, message: t('auth.userCodeMax') },
                            })}
                            error={!!errors.user_code}
                        />
                        <TextField
                            label={t('auth.password')}
                            type="password"
                            fullWidth
                            margin="normal"
                            {...register('password', {
                                required: t('auth.passwordRequired'),
                                minLength: { value: 6, message: t('auth.passwordMin') },
                            })}
                            error={!!errors.password}
                            helperText={errors.password?.message}
                        />

                        {error ? (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        ) : null}

                        <Button variant="contained" type="submit" fullWidth size="large" sx={{ mt: 3 }}>
                            {t('auth.initialSetupCreateAdmin')}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default InitialSetupPage;
