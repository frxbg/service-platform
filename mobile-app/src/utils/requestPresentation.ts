import type { TFunction } from 'i18next';

export function translateStatus(status: string, t: TFunction<'translation'>) {
  return t(`status.${status}`, { defaultValue: status });
}

export function translatePriority(priority: string, t: TFunction<'translation'>) {
  return t(`priority.${priority}`, { defaultValue: priority });
}

export function translateSource(source: string, t: TFunction<'translation'>) {
  return t(`source.${source}`, { defaultValue: source });
}

export function translateAssignmentStatus(status: string, t: TFunction<'translation'>) {
  return t(`assignmentStatus.${status}`, { defaultValue: status });
}

export function formatDateTime(value: string | null | undefined, language: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatMinutes(minutes: number | null | undefined, t: TFunction<'translation'>) {
  if (minutes == null || Number.isNaN(minutes)) {
    return t('common.notAvailable');
  }

  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return t('common.hoursShort', { value: hours.toFixed(0) });
  }

  return t('common.hoursShort', { value: hours.toFixed(1) });
}
