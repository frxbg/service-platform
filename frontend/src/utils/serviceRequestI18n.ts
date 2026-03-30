import type { TFunction } from 'i18next';

export const requestPriorityValues = ['low', 'standard', 'high', 'urgent'] as const;
export const requestStatusValues = [
    'NEW',
    'ASSIGNED',
    'PENDING_ACCEPTANCE',
    'ACCEPTED',
    'REJECTED_BY_TECHNICIAN',
    'IN_PROGRESS',
    'WAITING_PARTS',
    'WAITING_CLIENT',
    'COMPLETED',
    'CLOSED',
    'CANCELLED',
] as const;
export const requestSourceValues = ['phone', 'email', 'external_number', 'onsite', 'other'] as const;
export const billingServiceTypeValues = ['paid_service', 'warranty', 'maintenance', 'installation', 'subscription', 'other'] as const;
export const billingPaymentModeValues = ['paid', 'warranty', 'contract', 'internal', 'other'] as const;

const translateOrRaw = (t: TFunction, key: string, rawValue: string) => {
    const translated = t(key);
    return translated === key ? rawValue : translated;
};

export const requestPriorityColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
    low: 'default',
    standard: 'primary',
    high: 'warning',
    urgent: 'error',
};

export const requestStatusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning' | 'secondary'> = {
    NEW: 'error',
    ASSIGNED: 'secondary',
    PENDING_ACCEPTANCE: 'warning',
    ACCEPTED: 'primary',
    REJECTED_BY_TECHNICIAN: 'error',
    IN_PROGRESS: 'primary',
    WAITING_PARTS: 'warning',
    WAITING_CLIENT: 'warning',
    COMPLETED: 'success',
    CLOSED: 'default',
    CANCELLED: 'default',
};

export const getRequestPriorityLabel = (t: TFunction, priority: string) =>
    translateOrRaw(t, `serviceRequests.priority.${priority}`, priority);

export const getRequestStatusLabel = (t: TFunction, status: string) =>
    translateOrRaw(t, `serviceRequests.status.${status}`, status);

export const getRequestSourceLabel = (t: TFunction, source: string) =>
    translateOrRaw(t, `serviceRequests.source.${source}`, source);

export const getAssignmentStatusLabel = (t: TFunction, status: string) =>
    translateOrRaw(t, `serviceRequests.assignmentStatus.${status}`, status);

export const getBillingServiceTypeLabel = (t: TFunction, serviceType: string) =>
    translateOrRaw(t, `serviceRequests.billing.serviceTypeValues.${serviceType}`, serviceType);

export const getBillingPaymentModeLabel = (t: TFunction, paymentMode: string) =>
    translateOrRaw(t, `serviceRequests.billing.paymentModeValues.${paymentMode}`, paymentMode);

export const getAppLocale = (language?: string) => (language === 'bg' ? 'bg-BG' : 'en-US');
