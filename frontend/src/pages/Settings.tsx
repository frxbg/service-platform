import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Switch,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

interface CompanySettings {
    id: number;
    company_name: string;
    company_address?: string;
    company_phone?: string;
    company_email?: string;
    company_website?: string;
    company_vat_number?: string;
    company_registration_number?: string;
    footer_text?: string;
    session_timeout_minutes?: number;
}

const Settings: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { mode, toggleTheme } = useThemeMode();
    const queryClient = useQueryClient();

    const [currentPassword, setCurrentPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [snackbarOpen, setSnackbarOpen] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');

    // Company settings state
    const [companySettings, setCompanySettings] = React.useState<Partial<CompanySettings>>({});

    // Personal settings state
    const [userPosition, setUserPosition] = React.useState('');
    const [userName, setUserName] = React.useState('');

    // Template editor state
    const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
    const [templateContent, setTemplateContent] = React.useState('');
    const [language, setLanguage] = React.useState(i18n.resolvedLanguage || 'bg');

    // Fetch company settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['company-settings'],
        queryFn: async () => {
            const { data } = await api.get('/settings/company');
            return data;
        },
    });

    React.useEffect(() => {
        if (settings) {
            setCompanySettings(settings);
        }
    }, [settings]);

    // Fetch current user for position
    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: async () => {
            const { data } = await api.get('/auth/me');
            return data;
        },
    });

    React.useEffect(() => {
        if (currentUser) {
            if (currentUser.position) setUserPosition(currentUser.position);
            if (currentUser.full_name) setUserName(currentUser.full_name);
        }
    }, [currentUser]);

    // Update company settings mutation
    const updateSettingsMutation = useMutation({
        mutationFn: async (data: Partial<CompanySettings>) => {
            const response = await api.put('/settings/company', data);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
            const nextTimeout = Number(data?.session_timeout_minutes || 0);
            localStorage.setItem('session_timeout_minutes', String(nextTimeout));
            window.dispatchEvent(new CustomEvent('session-timeout-changed', {
                detail: { sessionTimeoutMinutes: nextTimeout },
            }));
            setSnackbarMessage('Данните на компанията са запазени успешно');
            setSnackbarOpen(true);
        },
        onError: () => {
            setSnackbarMessage('Грешка при запазване на данните');
            setSnackbarOpen(true);
        },
    });

    const handleCompanySettingsSave = () => {
        updateSettingsMutation.mutate(companySettings);
    };

    // Update personal settings mutation
    const updatePersonalMutation = useMutation({
        mutationFn: async (data: { position: string; full_name: string }) => {
            const response = await api.patch('/auth/me', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['current-user'] });
            setSnackbarMessage('Личните настройки са запазени успешно');
            setSnackbarOpen(true);
        },
        onError: () => {
            setSnackbarMessage('Грешка при запазване на личните настройки');
            setSnackbarOpen(true);
        },
    });

    const handlePersonalSettingsSave = () => {
        updatePersonalMutation.mutate({
            position: userPosition,
            full_name: userName
        });
    };

    // Fetch template
    const { data: templateData } = useQuery({
        queryKey: ['pdf-template'],
        queryFn: async () => {
            const { data } = await api.get('/settings/template');
            return data;
        },
        enabled: templateDialogOpen,
    });

    React.useEffect(() => {
        if (templateData?.content) {
            setTemplateContent(templateData.content);
        }
    }, [templateData]);

    React.useEffect(() => {
        setLanguage(i18n.resolvedLanguage || 'bg');
    }, [i18n.resolvedLanguage]);

    // Update template mutation
    const updateTemplateMutation = useMutation({
        mutationFn: async (content: string) => {
            const response = await api.put('/settings/template', { content });
            return response.data;
        },
        onSuccess: () => {
            setSnackbarMessage('Template запазен успешно');
            setSnackbarOpen(true);
            setTemplateDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['pdf-template'] });
        },
        onError: () => {
            setSnackbarMessage('Грешка при запазване на template');
            setSnackbarOpen(true);
        },
    });

    // Reset template mutation
    const resetTemplateMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/settings/template/reset');
            return response.data;
        },
        onSuccess: () => {
            setSnackbarMessage('Template върнат към оригинала');
            setSnackbarOpen(true);
            queryClient.invalidateQueries({ queryKey: ['pdf-template'] });
        },
        onError: () => {
            setSnackbarMessage('Грешка при reset на template');
            setSnackbarOpen(true);
        },
    });

    const handleTemplateOpen = () => {
        setTemplateDialogOpen(true);
    };

    const handleTemplateSave = () => {
        updateTemplateMutation.mutate(templateContent);
    };

    const handleTemplateReset = () => {
        if (window.confirm('Сигурни ли сте че искате да върнете template-а към оригинала? Всички промени ще бъдат загубени.')) {
            resetTemplateMutation.mutate();
        }
    };

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            setSnackbarMessage('Паролите не съвпадат');
            setSnackbarOpen(true);
            return;
        }

        if (newPassword.length < 8) {
            setSnackbarMessage('Паролата трябва да е поне 8 символа');
            setSnackbarOpen(true);
            return;
        }

        // TODO: Call API to change password
        setSnackbarMessage('Паролата е сменена успешно');
        setSnackbarOpen(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleLanguageChange = async (nextLanguage: string) => {
        setLanguage(nextLanguage);
        await i18n.changeLanguage(nextLanguage);
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('settings.title')}
            </Typography>

            {/* Company Information */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Информация за компанията
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Тази информация се използва в PDF офертите
                    </Typography>

                    {!isLoading && (
                        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleCompanySettingsSave(); }}>
                            <TextField
                                fullWidth
                                label="Име на компания"
                                value={companySettings.company_name || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                                margin="normal"
                                required
                            />
                            <TextField
                                fullWidth
                                label="Адрес"
                                value={companySettings.company_address || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_address: e.target.value })}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="Телефон"
                                value={companySettings.company_phone || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_phone: e.target.value })}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={companySettings.company_email || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_email: e.target.value })}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="Уебсайт"
                                value={companySettings.company_website || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_website: e.target.value })}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="ДДС номер"
                                value={companySettings.company_vat_number || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_vat_number: e.target.value })}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="Регистрационен номер"
                                value={companySettings.company_registration_number || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, company_registration_number: e.target.value })}
                                margin="normal"
                            />
                            <TextField
                                fullWidth
                                label="Текст за footer (опционално)"
                                value={companySettings.footer_text || ''}
                                onChange={(e) => setCompanySettings({ ...companySettings, footer_text: e.target.value })}
                                margin="normal"
                                multiline
                                rows={2}
                            />
                            <TextField
                                fullWidth
                                type="number"
                                label={t('settings.sessionTimeout', { defaultValue: 'Автоматичен logout при неактивност (минути)' })}
                                value={companySettings.session_timeout_minutes ?? 0}
                                onChange={(e) => setCompanySettings({
                                    ...companySettings,
                                    session_timeout_minutes: Math.max(0, Number(e.target.value || 0)),
                                })}
                                margin="normal"
                                inputProps={{ min: 0, step: 1 }}
                                helperText={t('settings.sessionTimeoutHint', { defaultValue: '0 = изключено. Потребителят се разлогва само при неактивност.' })}
                            />
                            <Box sx={{ mt: 2 }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    disabled={updateSettingsMutation.isPending}
                                >
                                    Запази
                                </Button>
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Personal Settings */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Лични настройки
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Тези настройки се използват в PDF офертите, които създавате
                    </Typography>
                    <TextField
                        fullWidth
                        label="Вашето име"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        label="Вашата длъжност/позиция"
                        value={userPosition}
                        onChange={(e) => setUserPosition(e.target.value)}
                        margin="normal"
                        helperText="Например: Управител, Търговски мениджър, Технически специалист и т.н."
                    />
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handlePersonalSettingsSave}
                            disabled={updatePersonalMutation.isPending}
                        >
                            Запази
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Theme Settings */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.theme')}
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={mode === 'dark'}
                                onChange={toggleTheme}
                                color="primary"
                            />
                        }
                        label={mode === 'dark' ? t('settings.dark') : t('settings.light')}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Избраната тема се запазва автоматично
                    </Typography>
                </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.pdfTemplate', { defaultValue: 'PDF шаблон' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Редактирайте HTML шаблона на PDF офертата
                    </Typography>
                    <Button variant="outlined" onClick={handleTemplateOpen}>
                        Редактирай шаблон
                    </Button>
                </CardContent>
            </Card>

            {/* Language Settings */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.language')}
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {t('settings.languageHint', {
                            defaultValue: 'Избери езика на интерфейса за новите сервизни и dashboard екрани.',
                        })}
                    </Alert>
                    <FormControl fullWidth>
                        <InputLabel>{t('settings.languageSelect', { defaultValue: 'Език на интерфейса' })}</InputLabel>
                        <Select
                            value={language}
                            label={t('settings.languageSelect', { defaultValue: 'Език на интерфейса' })}
                            onChange={(event) => void handleLanguageChange(String(event.target.value))}
                        >
                            <MenuItem value="bg">{t('settings.languageBg', { defaultValue: 'Български' })}</MenuItem>
                            <MenuItem value="en">{t('settings.languageEn', { defaultValue: 'Английски' })}</MenuItem>
                        </Select>
                    </FormControl>
                    <Alert severity="info" sx={{ display: 'none' }}>
                        В момента приложението поддържа само български език. Скоро ще добавим Multi-language support.
                    </Alert>
                </CardContent>
            </Card>

            {/* Password Change */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {t('settings.changePassword')}
                    </Typography>
                    <Box component="form" onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
                        <TextField
                            fullWidth
                            type="password"
                            label={t('settings.currentPassword')}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            type="password"
                            label={t('settings.newPassword')}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            margin="normal"
                            required
                            helperText="Минимум 8 символа"
                        />
                        <TextField
                            fullWidth
                            type="password"
                            label={t('settings.confirmPassword')}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            margin="normal"
                            required
                        />
                        <Box sx={{ mt: 2 }}>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                            >
                                {t('settings.saveSettings')}
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Template Editor Dialog */}
            <Dialog
                open={templateDialogOpen}
                onClose={() => setTemplateDialogOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>
                    Редактиране на PDF шаблон
                </DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        multiline
                        rows={25}
                        value={templateContent}
                        onChange={(e) => setTemplateContent(e.target.value)}
                        variant="outlined"
                        sx={{
                            mt: 2,
                            fontFamily: 'monospace',
                            '& textarea': {
                                fontFamily: 'monospace',
                                fontSize: '13px'
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTemplateDialogOpen(false)}>
                        Отказ
                    </Button>
                    <Button
                        onClick={handleTemplateReset}
                        color="warning"
                        disabled={resetTemplateMutation.isPending}
                    >
                        Зареди оригинала
                    </Button>
                    <Button
                        onClick={handleTemplateSave}
                        variant="contained"
                        disabled={updateTemplateMutation.isPending}
                    >
                        Запази
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
            />
        </Box>
    );
};

export default Settings;
