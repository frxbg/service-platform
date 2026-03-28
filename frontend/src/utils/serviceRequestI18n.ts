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

const priorityDefaults: Record<string, string> = {
    low: 'Нисък',
    standard: 'Стандартен',
    high: 'Висок',
    urgent: 'Спешен',
};

const statusDefaults: Record<string, string> = {
    NEW: 'Нова',
    ASSIGNED: 'Разпределена',
    PENDING_ACCEPTANCE: 'Чака приемане',
    ACCEPTED: 'Приета',
    REJECTED_BY_TECHNICIAN: 'Отказана от техник',
    IN_PROGRESS: 'В процес',
    WAITING_PARTS: 'Чака части',
    WAITING_CLIENT: 'Чака клиент',
    COMPLETED: 'Завършена',
    CLOSED: 'Затворена',
    CANCELLED: 'Отказана',
};

const sourceDefaults: Record<string, string> = {
    phone: 'Телефон',
    email: 'Имейл',
    external_number: 'Външен номер',
    onsite: 'На място',
    other: 'Друго',
};

const assignmentStatusDefaults: Record<string, string> = {
    pending: 'Изчаква',
    accepted: 'Приета',
    rejected: 'Отхвърлена',
};

const billingServiceTypeDefaults: Record<string, string> = {
    paid_service: 'Платен сервиз',
    warranty: 'Гаранция',
    maintenance: 'Поддръжка',
    installation: 'Инсталация',
    subscription: 'Абонамент',
    other: 'Друго',
};

const billingPaymentModeDefaults: Record<string, string> = {
    paid: 'Платено',
    warranty: 'Гаранционно',
    contract: 'По договор',
    internal: 'Вътрешно',
    other: 'Друго',
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
    t(`serviceRequests.priority.${priority}`, { defaultValue: priorityDefaults[priority] || priority });

export const getRequestStatusLabel = (t: TFunction, status: string) =>
    t(`serviceRequests.status.${status}`, { defaultValue: statusDefaults[status] || status });

export const getRequestSourceLabel = (t: TFunction, source: string) =>
    t(`serviceRequests.source.${source}`, { defaultValue: sourceDefaults[source] || source });

export const getAssignmentStatusLabel = (t: TFunction, status: string) =>
    t(`serviceRequests.assignmentStatus.${status}`, { defaultValue: assignmentStatusDefaults[status] || status });

export const getBillingServiceTypeLabel = (t: TFunction, serviceType: string) =>
    t(`serviceRequests.billing.serviceTypeValues.${serviceType}`, {
        defaultValue: billingServiceTypeDefaults[serviceType] || serviceType,
    });

export const getBillingPaymentModeLabel = (t: TFunction, paymentMode: string) =>
    t(`serviceRequests.billing.paymentModeValues.${paymentMode}`, {
        defaultValue: billingPaymentModeDefaults[paymentMode] || paymentMode,
    });

export const getAppLocale = (language?: string) => (language === 'bg' ? 'bg-BG' : 'en-US');
