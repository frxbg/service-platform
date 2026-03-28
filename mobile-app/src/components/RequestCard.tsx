import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { MobileRequestListItem } from '../types/mobile';
import StatusPill from './StatusPill';
import { buildDialLink, buildNavigationLink, openExternalLink } from '../utils/mobileLinks';
import { formatDateTime, translatePriority } from '../utils/requestPresentation';

interface RequestCardProps {
  item: MobileRequestListItem;
  onAccept?: (requestId: string) => void;
  acceptPending?: boolean;
}

const groupAccent: Record<MobileRequestListItem['workboard_group'], string> = {
  assigned_to_me: '#0f766e',
  available: '#ea580c',
  other: '#94a3b8',
};

export default function RequestCard({ item, onAccept, acceptPending = false }: RequestCardProps) {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const navigateLink = buildNavigationLink(item.address);
  const dialLink = buildDialLink(item.contact_phone);
  const rejectionReason = item.rejection_history[0]?.reject_reason
    ? t('requestCard.lastRejectionReason', { reason: item.rejection_history[0].reject_reason })
    : '';

  return (
    <Card
      sx={{
        borderLeft: `6px solid ${groupAccent[item.workboard_group]}`,
        background:
          item.workboard_group === 'assigned_to_me'
            ? 'linear-gradient(135deg, rgba(15,118,110,0.08), rgba(255,255,255,1))'
            : item.workboard_group === 'available'
              ? 'linear-gradient(135deg, rgba(234,88,12,0.08), rgba(255,255,255,1))'
              : undefined,
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {item.request_number}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {item.client_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.site_name || item.site_code}
                {item.city ? `, ${item.city}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(item.reported_at, i18n.resolvedLanguage || i18n.language)}
              </Typography>
            </Box>
            <StatusPill status={item.status} />
          </Stack>

          <Typography variant="body2">{item.problem_summary}</Typography>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="small" label={translatePriority(item.priority, t)} />
            {item.assigned_to_me ? <Chip size="small" color="success" label={t('requestCard.mine')} /> : null}
            {item.available_to_accept ? (
              <Chip size="small" color="warning" label={t('requestCard.available')} />
            ) : null}
            {item.has_rejection_history ? (
              <Chip size="small" color="error" label={t('requestCard.hasRejection')} />
            ) : null}
          </Stack>

          {item.has_rejection_history ? (
            <Typography variant="caption" color="error">
              {t('requestCard.lastRejection', {
                technician: item.rejection_history[0]?.technician_name || t('common.notAvailable'),
                reason: rejectionReason,
              })}
            </Typography>
          ) : null}

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="contained" onClick={() => navigate(`/requests/${item.id}`)}>
              {t('requestCard.open')}
            </Button>
            {item.available_to_accept || item.current_assignment_status === 'pending' ? (
              <Button
                variant="outlined"
                color="secondary"
                disabled={acceptPending}
                onClick={() => onAccept?.(item.id)}
              >
                {t('requestCard.accept')}
              </Button>
            ) : null}
            {navigateLink ? (
              <Button variant="text" onClick={() => openExternalLink(navigateLink)}>
                {t('requestCard.navigate')}
              </Button>
            ) : null}
            {dialLink ? (
              <Button variant="text" onClick={() => openExternalLink(dialLink)}>
                {t('requestCard.call')}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
