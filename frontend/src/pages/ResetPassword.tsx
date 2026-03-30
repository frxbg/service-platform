import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import api from '../api/axios';

interface FormValues {
    new_password: string;
    confirm_password: string;
}

const ResetPassword: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>();
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    const onSubmit = async (data: FormValues) => {
        if (!token) {
            setError(t('auth.resetPasswordMissingToken'));
            return;
        }
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const response = await api.post('/auth/password-reset/confirm', {
                token,
                new_password: data.new_password,
            });
            setMessage(response.data?.message || t('auth.resetPasswordSuccess'));
            setTimeout(() => navigate('/login'), 1500);
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.resetPasswordError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                width: '100vw',
            }}
        >
            <Container component="main" maxWidth="sm" sx={{ width: '100%', maxWidth: 500 }}>
                <Paper elevation={3} sx={{ p: 4, m: 2 }}>
                    <Typography component="h1" variant="h4" align="center" gutterBottom color="primary">
                        {t('auth.resetPasswordTitle')}
                    </Typography>
                    <Typography component="h2" variant="body1" align="center" gutterBottom>
                        {t('auth.resetPasswordSubtitle')}
                    </Typography>

                    {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
                    {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

                    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 2 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="new_password"
                            label={t('auth.resetPasswordNew')}
                            type="password"
                            autoComplete="new-password"
                            {...register('new_password', { required: true, minLength: 6 })}
                            error={!!errors.new_password}
                            helperText={errors.new_password && t('auth.resetPasswordMinLength')}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="confirm_password"
                            label={t('auth.resetPasswordConfirm')}
                            type="password"
                            autoComplete="new-password"
                            {...register('confirm_password', {
                                required: true,
                                validate: (value) => value === watch('new_password') || t('auth.resetPasswordMismatch'),
                            })}
                            error={!!errors.confirm_password}
                            helperText={errors.confirm_password && (errors.confirm_password.message || t('auth.resetPasswordRequired'))}
                        />
                        <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                            {t('auth.resetPasswordSubmit')}
                        </Button>
                        <Button fullWidth variant="text" onClick={() => navigate('/login')}>
                            {t('auth.passwordResetBackToLogin')}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default ResetPassword;
