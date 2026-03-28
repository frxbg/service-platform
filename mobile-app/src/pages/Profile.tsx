import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '../api/axios';
import MobileLayout from '../components/MobileLayout';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    full_name: user?.full_name || '',
    position: user?.position || '',
  });
  const [passwordDraft, setPasswordDraft] = useState({
    current_password: '',
    new_password: '',
  });

  const profileMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch('/auth/me', profileDraft);
      return data;
    },
    onSuccess: () => {
      setToastMessage(t('profilePage.profileSaved'));
    },
    onError: () => {
      setToastMessage(t('common.error'));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/me/change-password', passwordDraft);
      return data;
    },
    onSuccess: () => {
      setPasswordDraft({ current_password: '', new_password: '' });
      setToastMessage(t('profilePage.passwordChanged'));
    },
    onError: () => {
      setToastMessage(t('common.error'));
    },
  });

  return (
    <MobileLayout title={t('navigation.profile')}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">{t('profilePage.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('profilePage.subtitle')}
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={2} alignItems="flex-start">
              <Avatar sx={{ width: 64, height: 64, bgcolor: '#0f766e', fontWeight: 800 }}>
                {(user?.full_name || user?.email || 'SP').slice(0, 2).toUpperCase()}
              </Avatar>
              <Alert severity="info">{t('profilePage.photoPending')}</Alert>
              <TextField
                label={t('profilePage.fullName')}
                value={profileDraft.full_name}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, full_name: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label={t('profilePage.position')}
                value={profileDraft.position}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, position: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label={t('profilePage.userCode')}
                value={user?.user_code || ''}
                disabled
                fullWidth
              />
              <TextField
                label={t('profilePage.email')}
                value={user?.email || ''}
                disabled
                fullWidth
              />
              <Button variant="contained" onClick={() => profileMutation.mutate()}>
                {t('profilePage.saveProfile')}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {t('profilePage.passwordSection')}
              </Typography>
              <TextField
                label={t('profilePage.currentPassword')}
                type="password"
                value={passwordDraft.current_password}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label={t('profilePage.newPassword')}
                type="password"
                value={passwordDraft.new_password}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
                fullWidth
              />
              <Button
                variant="outlined"
                disabled={!passwordDraft.current_password || !passwordDraft.new_password}
                onClick={() => passwordMutation.mutate()}
              >
                {t('profilePage.changePassword')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3500}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </MobileLayout>
  );
}
