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

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function formatBgDate(value: string | null | undefined) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value || '';
  }
  return dateFormatter.format(parsed);
}

export function formatBgDateTime(value: string | null | undefined) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value || '';
  }
  return dateTimeFormatter.format(parsed);
}

export function formatBgTime(value: string | null | undefined) {
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

export function formatBgTimeRange(from: string | null | undefined, to: string | null | undefined) {
  const fromLabel = formatBgTime(from);
  const toLabel = formatBgTime(to);
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

export function toLocalDateTimeInputValue(date = new Date()) {
  return `${buildLocalDate(date)}T${buildLocalTime(date)}`;
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
