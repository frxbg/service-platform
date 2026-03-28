import React from 'react';
import { Box, Button, Card, CardContent, Divider, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import offerTemplate from '../../assets/offer_template.html?raw';

const sampleValues: Record<string, string> = {
    'offer.offer_number': '2025/001',
    offer_date: '12.04.2025',
    'client.name': 'Клиент ООД',
    client_contact: 'Иван Иванов',
    client_contact_short: 'Иван',
    'offer.project_name': 'Поддръжка на охладителна система',
    'offer.site_address': 'София, бул. България 12',
    offer_short_description: 'доставка и монтаж',
    company_name: 'Cool4',
    company_address: 'гр. София, ул. Дружба 1',
    company_phone: '+359 888 123 456',
    company_email: 'office@company.com',
    company_footer_address: 'гр. София, ул. Дружба 1',
    company_website: 'cool4.bg',
    company_linkedin: 'linkedin.com/company/cool4',
    currency: '€',
    parts_total: '5 430.00',
    labour_total: '480.00',
    total_without_vat: '5 910.00',
    vat_percent: '20',
    vat_amount: '1 182.00',
    total_with_vat: '7 092.00',
    fx_rate: '1.95583',
    total_in_eur: '3 627.78',
    warranty_text: '12 месеца за оборудването',
    delivery_term_text: '30 дни',
    payment_terms_text: '50% аванс, 50% при доставка',
    extra_info: 'Посочените срокове са ориентировъчни.',
    coolant_note: 'Цената не включва хладилен агент.',
    author_name: 'Петър Петров',
    author_position: 'Търговски представител',
    environment_paragraph_1: 'Работим по устойчиви практики.',
    environment_paragraph_2: 'Рециклираме и минимизираме отпадъците.',
    environment_paragraph_3: 'С екип от сертифицирани специалисти.',
    'line.description': 'Примерен ред',
    'line.unit': 'бр.',
    'line.quantity': '2',
    'line.price': '120.00',
};

const buildPreview = (html: string) => {
    let rendered = html.replace(/{%[\s\S]*?%}/g, '');
    rendered = rendered.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
        const value = sampleValues[key.trim()];
        return value !== undefined ? value : '—';
    });
    return rendered;
};

const PdfTemplate: React.FC = () => {
    const { t } = useTranslation();
    const [template, setTemplate] = React.useState<string>(offerTemplate);
    const [previewHtml, setPreviewHtml] = React.useState<string>(buildPreview(offerTemplate));

    React.useEffect(() => {
        setPreviewHtml(buildPreview(template));
    }, [template]);

    const handleReset = () => setTemplate(offerTemplate);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h4">
                {t('settings.pdfTemplate', { defaultValue: 'PDF шаблон' })}
            </Typography>
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button variant="contained">
                            {t('common.save', { defaultValue: 'Запази' })}
                        </Button>
                        <Button variant="outlined" onClick={handleReset}>
                            {t('common.cancel', { defaultValue: 'Отказ' })}
                        </Button>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('settings.pdfTemplateHint', {
                            defaultValue: 'Оформление на PDF изгледа. Редактирайте HTML/CSS по желание.',
                        })}
                    </Typography>

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('settings.pdfTemplatePreview', { defaultValue: 'Преглед' })}
                    </Typography>
                    <Box
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            overflow: 'hidden',
                            background: '#f5f5f5',
                            position: 'relative',
                            mb: 2,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
                            gap: 2,
                            alignItems: 'stretch',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                overflow: 'hidden',
                                minHeight: 320,
                            }}
                        >
                            <iframe
                                title="PDF template preview"
                                srcDoc={previewHtml}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    transform: 'scale(0.7)',
                                    transformOrigin: '0 0',
                                }}
                            />
                        </Box>
                        <Box sx={{ p: 2, backgroundColor: '#fff', borderLeft: { md: '1px solid #e0e0e0' } }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                {t('settings.pdfTemplateInstructions', { defaultValue: 'Инструкция' })}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Редактирай HTML/CSS по-долу; placeholders като <code>{'{ offer.offer_number }'}</code> се заместват с реални данни при генериране.<br />
                                • Прегледът е с примерни стойности и е само ориентировъчен.<br />
                                • Запазване изисква бекенд ендпойнт; сега е само локален preview.
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('settings.pdfTemplate', { defaultValue: 'HTML/CSS код' })}
                    </Typography>
                    <Box sx={{ maxHeight: 800, overflow: 'auto' }}>
                        <TextField
                            multiline
                            minRows={12}
                            fullWidth
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            placeholder="<html>...</html>"
                        />
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default PdfTemplate;
