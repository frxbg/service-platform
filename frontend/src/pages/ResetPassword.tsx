import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, Container, TextField, Typography, Paper, Alert } from '@mui/material';
import { useForm } from 'react-hook-form';
import api from '../api/axios';

interface FormValues {
  new_password: string;
  confirm_password: string;
}

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (data: FormValues) => {
    if (!token) {
      setError('Липсва валиден токен за възстановяване.');
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
      setMessage(response.data?.message || 'Паролата е обновена успешно.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Възникна грешка. Опитайте отново.');
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
            Задаване на нова парола
          </Typography>
          <Typography component="h2" variant="body1" align="center" gutterBottom>
            Въведете новата си парола.
          </Typography>

          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 2 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="new_password"
              label="Нова парола"
              type="password"
              autoComplete="new-password"
              {...register('new_password', { required: true, minLength: 6 })}
              error={!!errors.new_password}
              helperText={errors.new_password && 'Минимум 6 символа'}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="confirm_password"
              label="Потвърди паролата"
              type="password"
              autoComplete="new-password"
              {...register('confirm_password', {
                required: true,
                validate: (value) => value === watch('new_password') || 'Паролите трябва да съвпадат',
              })}
              error={!!errors.confirm_password}
              helperText={errors.confirm_password && (errors.confirm_password.message || 'Полето е задължително')}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              Обнови паролата
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/login')}
            >
              Назад към вход
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ResetPassword;
