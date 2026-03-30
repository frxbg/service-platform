export type OfflineDraftStatus = 'local_draft' | 'pending_sync' | 'synced' | 'sync_failed';

export type OfflineDraftKind = 'work_log' | 'material_usage' | 'equipment' | 'signature';

export interface OfflineDraftRecord<T = unknown> {
  kind: OfflineDraftKind;
  status: OfflineDraftStatus;
  updated_at: string;
  payload: T | null;
  last_error?: string | null;
}

const STORAGE_PREFIX = 'service-platform.mobile.request-draft';

export const OFFLINE_DRAFT_KINDS: OfflineDraftKind[] = [
  'work_log',
  'material_usage',
  'equipment',
  'signature',
];

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildDraftStorageKey(requestId: string, kind: OfflineDraftKind) {
  return `${STORAGE_PREFIX}.${requestId}.${kind}`;
}

export function loadOfflineDraft<T>(requestId: string, kind: OfflineDraftKind): OfflineDraftRecord<T> | null {
  if (!requestId || !canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildDraftStorageKey(requestId, kind));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as OfflineDraftRecord<T>;
    if (!parsed || parsed.kind !== kind || !parsed.status) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveOfflineDraft<T>(
  requestId: string,
  kind: OfflineDraftKind,
  payload: T | null,
  options: {
    status?: OfflineDraftStatus;
    lastError?: string | null;
  } = {},
) {
  if (!requestId || !canUseStorage()) {
    return null;
  }

  const record: OfflineDraftRecord<T> = {
    kind,
    status: options.status || 'local_draft',
    updated_at: new Date().toISOString(),
    payload,
    last_error: options.lastError || null,
  };

  window.localStorage.setItem(buildDraftStorageKey(requestId, kind), JSON.stringify(record));
  return record;
}

export function clearOfflineDraft(requestId: string, kind: OfflineDraftKind) {
  if (!requestId || !canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(buildDraftStorageKey(requestId, kind));
}

export function loadAllOfflineDrafts(requestId: string) {
  return OFFLINE_DRAFT_KINDS.reduce(
    (result, kind) => {
      const record = loadOfflineDraft(requestId, kind);
      if (record) {
        result[kind] = record;
      }
      return result;
    },
    {} as Partial<Record<OfflineDraftKind, OfflineDraftRecord>>,
  );
}
