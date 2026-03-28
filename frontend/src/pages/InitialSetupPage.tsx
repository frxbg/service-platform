import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Container,
    TextField,
    Typography,
    Paper,
    Alert,
} from '@mui/material';
import api from '../api/axios';

interface FormValues {
    email: string;
    full_name: string;
    password: string;
    user_code: string;
}

export const InitialSetupPage: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const navigate = useNavigate();

    const onSubmit = async (data: FormValues) => {
        setError(null);
        try {
            await api.post('/auth/bootstrap-superuser', data);
            setSuccess(true);
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail ?? 'Грешка при създаване на администратор.');
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
                            ✓ Готово!
                        </Typography>
                        <Typography variant="h6" gutterBottom>
                            Първият администратор е създаден
                        </Typography>
                        <Typography color="text.secondary">
                            Сега можете да влезете в системата с въведения email и парола.
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                            Пренасочване към login страница...
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
                        PyOffers
                    </Typography>
                    <Typography variant="h5" gutterBottom align="center">
                        Първоначална настройка
                    </Typography>
                    <Typography variant="body1" gutterBottom align="center" color="text.secondary" sx={{ mb: 3 }}>
                        Не са намерени потребители. Моля, създайте първия администратор.
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                        <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            margin="normal"
                            {...register('email', { required: 'Email е задължителен' })}
                            error={!!errors.email}
                            helperText={errors.email?.message}
                        />
                        <TextField
                            label="Име и фамилия"
                            fullWidth
                            margin="normal"
                            {...register('full_name', { required: 'Име е задължително' })}
                            error={!!errors.full_name}
                            helperText={errors.full_name?.message}
                        />
                        <TextField
                            label="Потребителски код"
                            fullWidth
                            margin="normal"
                            helperText="Кратък код за номера на оферти, напр. ADMIN или TST"
                            {...register('user_code', {
                                required: 'Код е задължителен',
                                minLength: { value: 2, message: 'Минимум 2 символа' },
                                maxLength: { value: 10, message: 'Максимум 10 символа' },
                            })}
                            error={!!errors.user_code}
                        />
                        <TextField
                            label="Парола"
                            type="password"
                            fullWidth
                            margin="normal"
                            {...register('password', {
                                required: 'Парола е задължителна',
                                minLength: { value: 6, message: 'Минимум 6 символа' },
                            })}
                            error={!!errors.password}
                            helperText={errors.password?.message}
                        />

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        )}

                        <Button
                            variant="contained"
                            type="submit"
                            fullWidth
                            size="large"
                            sx={{ mt: 3 }}
                        >
                            Създай администратор
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default InitialSetupPage;
