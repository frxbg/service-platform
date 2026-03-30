export interface ReferenceUser {
    id: string;
    full_name?: string | null;
    email: string;
}

export interface ReferenceClient {
    id: string;
    name: string;
    client_number?: string | null;
}

export interface ReferenceSite {
    id: string;
    site_code: string;
    site_name?: string | null;
    address?: string | null;
}

export interface ReferenceBillingProject {
    id: string;
    client_id: string;
    site_id?: string | null;
    project_reference: string;
    project_year?: string | null;
    service_type: 'paid_service' | 'warranty' | 'maintenance' | 'installation' | 'subscription' | 'other';
    payment_mode: 'paid' | 'warranty' | 'contract' | 'internal' | 'other';
    description?: string | null;
    regular_labor_rate?: number | string | null;
    transport_rate?: number | string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    is_default: boolean;
    is_active: boolean;
    notes?: string | null;
}

export interface Warehouse {
    id: string;
    code: string;
    name: string;
    is_active: boolean;
}

export interface ServiceAssignment {
    id: string;
    request_id: string;
    assignment_status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    reject_reason?: string | null;
    assigned_at: string;
    accepted_at?: string | null;
    rejected_at?: string | null;
    is_primary: boolean;
    technician_user: ReferenceUser;
    assigned_by_user: ReferenceUser;
}

export interface WorkLog {
    id: string;
    request_id: string;
    work_date: string;
    time_from: string;
    time_to: string;
    minutes_total: number;
    minutes_regular: number;
    minutes_overtime: number;
    minutes_weekend: number;
    minutes_holiday: number;
    activity_description: string;
    repair_type_code?: string | null;
    technician_user: ReferenceUser;
    created_by_user: ReferenceUser;
    created_at: string;
}

export interface MaterialUsage {
    id: string;
    request_id: string;
    quantity: number | string;
    unit: string;
    notes?: string | null;
    used_at: string;
    material: {
        id: string;
        erp_code: string;
        name: string;
        unit: string;
    };
    warehouse: Warehouse;
    technician_user: ReferenceUser;
}

export interface EquipmentAsset {
    id: string;
    request_id?: string | null;
    client: ReferenceClient;
    site: ReferenceSite;
    equipment_type: string;
    manufacturer?: string | null;
    model?: string | null;
    serial_number?: string | null;
    asset_tag?: string | null;
    location_note?: string | null;
    refrigerant?: string | null;
    notes?: string | null;
    is_active: boolean;
}

export interface ServiceRequestListItem {
    id: string;
    request_number: string;
    client: ReferenceClient;
    site: ReferenceSite;
    billing_project?: ReferenceBillingProject | null;
    project_reference_snapshot?: string | null;
    service_type_snapshot?: ReferenceBillingProject['service_type'] | null;
    payment_mode_snapshot?: ReferenceBillingProject['payment_mode'] | null;
    priority: 'low' | 'standard' | 'high' | 'urgent';
    status:
        | 'NEW'
        | 'ASSIGNED'
        | 'PENDING_ACCEPTANCE'
        | 'ACCEPTED'
        | 'REJECTED_BY_TECHNICIAN'
        | 'IN_PROGRESS'
        | 'WAITING_PARTS'
        | 'WAITING_CLIENT'
        | 'COMPLETED'
        | 'CLOSED'
        | 'CANCELLED';
    responsible_user: ReferenceUser;
    assigned_technicians: string[];
    reported_at: string;
    created_at: string;
    is_locked: boolean;
}

export interface ServiceRequest extends ServiceRequestListItem {
    external_order_number?: string | null;
    source: 'phone' | 'email' | 'external_number' | 'onsite' | 'other';
    billing_project_id?: string | null;
    created_by_user: ReferenceUser;
    reported_problem: string;
    request_reason_code?: string | null;
    repair_type_code?: string | null;
    updated_at: string;
    discovered_during_request_id?: string | null;
    notes_internal?: string | null;
    notes_client?: string | null;
    is_locked: boolean;
    can_edit: boolean;
    can_delete: boolean;
    assignments: ServiceAssignment[];
    work_logs: WorkLog[];
    material_usages: MaterialUsage[];
    equipment_assets: EquipmentAsset[];
}

export interface ProtocolPreview {
    request_id: string;
    request_number: string;
    client_name: string;
    site_name: string;
    site_address?: string | null;
    reason_for_visit: string;
    repair_type_code?: string | null;
    execution_date?: string | null;
    worked_time_from?: string | null;
    worked_time_to?: string | null;
    technicians: string[];
    technician_time_breakdown: Array<{
        technician_name: string;
        regular_minutes: number;
        overtime_minutes: number;
        weekend_minutes: number;
        holiday_minutes: number;
        total_minutes: number;
    }>;
    total_regular_minutes: number;
    total_overtime_minutes: number;
    total_weekend_minutes: number;
    total_holiday_minutes: number;
    total_minutes: number;
    work_description: string;
    materials: Array<{
        material_code: string;
        material_name: string;
        quantity: number | string;
        unit: string;
        warehouse_code: string;
        warehouse_name: string;
    }>;
}
