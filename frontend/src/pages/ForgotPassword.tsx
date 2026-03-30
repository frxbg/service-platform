import React from 'react';
import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import api from '../api/axios';

interface FormValues {
    email: string;
}

const ForgotPassword: React.FC = () => {
    const { t } = useTranslation();
    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const navigate = useNavigate();

    const onSubmit = async (data: FormValues) => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const response = await api.post('/auth/password-reset/request', data);
            setMessage(response.data?.message || t('auth.passwordResetRequestSuccess'));
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.passwordResetRequestError'));
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
                        {t('auth.passwordResetTitle')}
                    </Typography>
                    <Typography component="h2" variant="body1" align="center" gutterBottom>
                        {t('auth.passwordResetSubtitle')}
                    </Typography>

                    {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
                    {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

                    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 2 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label={t('auth.email')}
                            autoComplete="email"
                            autoFocus
                            {...register('email', { required: true })}
                            error={!!errors.email}
                            helperText={errors.email && t('auth.passwordResetEmailRequired')}
                        />
                        <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                            {t('auth.passwordResetSendLink')}
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

export default ForgotPassword;
