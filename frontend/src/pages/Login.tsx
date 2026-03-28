import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    TextField,
    Typography,
    Alert,
    Link,
    Stack,
    InputAdornment,
    IconButton,
    CircularProgress,
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
    Description as LogoIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const { t } = useTranslation();
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);

    const onSubmit = async (data: any) => {
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('username', data.email);
            formData.append('password', data.password);
            const response = await api.post('/auth/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            login(response.data.access_token, response.data.refresh_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Неуспешен вход');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                bgcolor: '#f1f5f9',
            }}
        >
            {/* Left decorative panel – hidden on mobile */}
            <Box
                sx={{
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    width: '45%',
                    minHeight: '100vh',
                    p: { md: 6, lg: 10 },
                    background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative circles */}
                <Box sx={{
                    position: 'absolute', width: 400, height: 400,
                    borderRadius: '50%', top: -100, right: -150,
                    background: 'rgba(59,130,246,0.08)',
                }} />
                <Box sx={{
                    position: 'absolute', width: 300, height: 300,
                    borderRadius: '50%', bottom: -80, left: -80,
                    background: 'rgba(99,102,241,0.08)',
                }} />

                {/* Brand */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 6, position: 'relative' }}>
                    <Box sx={{
                        width: 44, height: 44, borderRadius: '12px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
                    }}>
                        <LogoIcon sx={{ color: '#fff', fontSize: 22 }} />
                    </Box>
                    <Typography variant="h5" sx={{ color: '#f1f5f9', fontWeight: 700 }}>
                        PyOffers
                    </Typography>
                </Stack>

                <Typography variant="h3" sx={{ color: '#f1f5f9', fontWeight: 800, mb: 2, lineHeight: 1.15, position: 'relative' }}>
                    Управление<br />на оферти
                </Typography>
                <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: 340, lineHeight: 1.7, position: 'relative' }}>
                    Създавайте, управлявайте и изпращайте оферти бързо и лесно. Следете статуси и генерирайте PDF с един клик.
                </Typography>
            </Box>

            {/* Right login form */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: { xs: 2, sm: 4 },
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 420,
                        bgcolor: '#fff',
                        borderRadius: '20px',
                        p: { xs: 3, sm: 4.5 },
                        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
                        border: '1px solid rgba(0,0,0,0.05)',
                    }}
                >
                    {/* Mobile brand */}
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4, display: { md: 'none' } }}>
                        <Box sx={{
                            width: 36, height: 36, borderRadius: '10px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <LogoIcon sx={{ color: '#fff', fontSize: 18 }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>PyOffers</Typography>
                    </Stack>

                    <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>Добре дошли</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
                        Влезте в акаунта си, за да продължите
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2.5 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                label={t('auth.email')}
                                id="email"
                                autoComplete="email"
                                autoFocus
                                {...register('email', { required: true })}
                                error={!!errors.email}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                fullWidth
                                label={t('auth.password')}
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                autoComplete="current-password"
                                {...register('password', { required: true })}
                                error={!!errors.password}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                            >
                                                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Box textAlign="right">
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={() => navigate('/forgot-password')}
                                    sx={{ fontSize: '0.8125rem' }}
                                >
                                    Забравена парола?
                                </Link>
                            </Box>

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={loading}
                                sx={{ py: 1.5, fontSize: '0.9375rem', mt: 0.5 }}
                            >
                                {loading ? <CircularProgress size={20} color="inherit" /> : t('auth.submit')}
                            </Button>
                        </Stack>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default Login;
