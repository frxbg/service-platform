import type { TFunction } from 'i18next';

const BG_DATE_LOCALE = 'bg-BG';

const dateFormatter = new Intl.DateTimeFormat(BG_DATE_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(BG_DATE_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat(BG_DATE_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function translateOrRaw(t: TFunction<'translation'>, key: string, rawValue: string) {
  const translated = t(key);
  return translated === key ? rawValue : translated;
}

export function translateStatus(status: string, t: TFunction<'translation'>) {
  return translateOrRaw(t, `status.${status}`, status);
}

export function translatePriority(priority: string, t: TFunction<'translation'>) {
  return translateOrRaw(t, `priority.${priority}`, priority);
}

export function translateSource(source: string, t: TFunction<'translation'>) {
  return translateOrRaw(t, `source.${source}`, source);
}

export function translateAssignmentStatus(status: string, t: TFunction<'translation'>) {
  return translateOrRaw(t, `assignmentStatus.${status}`, status);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function buildLocalDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function buildLocalTime(value: Date) {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatDate(value: string | null | undefined) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value || '';
  }

  return dateFormatter.format(parsed);
}

export function formatDateTime(value: string | null | undefined, _language: string) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value || '';
  }

  return dateTimeFormatter.format(parsed);
}

export function formatTime(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const timeMatch = value.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }

  const parsed = parseDateValue(value);
  if (!parsed) {
    return value;
  }

  return timeFormatter.format(parsed);
}

export function formatTimeRange(from: string | null | undefined, to: string | null | undefined) {
  const fromLabel = formatTime(from);
  const toLabel = formatTime(to);
  if (!fromLabel && !toLabel) {
    return '-';
  }
  if (!fromLabel) {
    return toLabel;
  }
  if (!toLabel) {
    return fromLabel;
  }
  return `${fromLabel} - ${toLabel}`;
}

export function toLocalDateInputValue(date = new Date()) {
  return buildLocalDate(date);
}

export function getSuggestedWorkLogTiming(reference = new Date()) {
  const end = new Date(reference);
  end.setSeconds(0, 0);

  const start = new Date(end.getTime() - 60 * 60 * 1000);
  const dayStart = new Date(end);
  dayStart.setHours(0, 0, 0, 0);

  if (start < dayStart) {
    start.setTime(dayStart.getTime());
  }

  if (start >= end) {
    end.setMinutes(end.getMinutes() + 5);
  }

  return {
    work_date: toLocalDateInputValue(end),
    time_from: buildLocalTime(start),
    time_to: buildLocalTime(end),
  };
}

export function isValidTimeRange(timeFrom: string | null | undefined, timeTo: string | null | undefined) {
  if (!timeFrom || !timeTo) {
    return false;
  }

  return timeFrom < timeTo;
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

export function formatEquipmentLabel(equipment: {
  display_name?: string | null;
  equipment_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
}) {
  if (equipment.display_name?.trim()) {
    return equipment.display_name.trim();
  }

  const parts = [
    equipment.equipment_type,
    equipment.manufacturer,
    equipment.model,
    equipment.serial_number,
    equipment.asset_tag,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.join(' / ');
}
