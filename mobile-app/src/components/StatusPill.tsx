import Chip from '@mui/material/Chip';
import type { ChipProps } from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';

import { translateStatus } from '../utils/requestPresentation';

type StatusColor = ChipProps['color'];

const statusColors: Record<string, StatusColor> = {
  NEW: 'default',
  ASSIGNED: 'info',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  IN_PROGRESS: 'primary',
  WAITING_PARTS: 'warning',
  WAITING_CLIENT: 'warning',
  COMPLETED: 'success',
  CLOSED: 'default',
  CANCELLED: 'default',
  REJECTED_BY_TECHNICIAN: 'error',
};

export default function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Chip
      size="small"
      color={statusColors[status] || 'default'}
      label={translateStatus(status, t)}
    />
  );
}
