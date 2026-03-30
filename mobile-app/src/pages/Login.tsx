import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        setError(t('auth.serverConnectionError'));
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        setError(t('auth.invalidCredentials'));
      } else {
        setError(t('common.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(circle at top, rgba(15,118,110,0.18), transparent 40%), linear-gradient(180deg, #f5faf9 0%, #eef4f7 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              <Box>
                <Typography variant="h5">{t('auth.loginTitle')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {t('auth.loginSubtitle')}
                </Typography>
              </Box>
              <Select
                size="small"
                value={i18n.resolvedLanguage || i18n.language}
                onChange={(event) => void i18n.changeLanguage(event.target.value)}
                inputProps={{ 'aria-label': t('common.language') }}
              >
                <MenuItem value="bg">{t('common.bulgarian')}</MenuItem>
                <MenuItem value="en">{t('common.english')}</MenuItem>
              </Select>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
              fullWidth
            />
            <TextField
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? t('auth.loggingIn') : t('auth.submit')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
