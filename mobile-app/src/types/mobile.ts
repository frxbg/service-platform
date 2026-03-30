export interface MobileUser {
  id: string;
  email: string;
  full_name?: string | null;
  position?: string | null;
  role: string;
  user_code: string;
  permissions: string[];
}

export interface MobileRejectionHistory {
  assignment_id: string;
  technician_name: string;
  rejected_at?: string | null;
  reject_reason?: string | null;
}

export interface MobileAssignment {
  id: string;
  request_id: string;
  assignment_status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  reject_reason?: string | null;
  assigned_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  is_primary: boolean;
  technician_user: {
    id: string;
    full_name?: string | null;
    email: string;
  };
  assigned_by_user: {
    id: string;
    full_name?: string | null;
    email: string;
  };
}

export interface MobileRequestListItem {
  id: string;
  client_id: string;
  site_id: string;
  request_number: string;
  client_name: string;
  site_name?: string | null;
  site_code: string;
  city?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
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
  reported_at: string;
  problem_summary: string;
  assigned_technicians: string[];
  assigned_to_me: boolean;
  available_to_accept: boolean;
  workboard_group: 'assigned_to_me' | 'available' | 'other';
  has_rejection_history: boolean;
  rejection_history: MobileRejectionHistory[];
  current_assignment_id?: string | null;
  current_assignment_status?: string | null;
}

export interface MobileSiteRequestListItem extends MobileRequestListItem {
  equipment_keys: string[];
}

export interface MobileRequestDetail extends MobileRequestListItem {
  external_order_number?: string | null;
  source: 'phone' | 'email' | 'external_number' | 'onsite' | 'other';
  repair_type_code?: string | null;
  request_reason_code?: string | null;
  notes_client?: string | null;
  project_reference_snapshot?: string | null;
  service_type_snapshot?: string | null;
  payment_mode_snapshot?: string | null;
  billing_project?: {
    id: string;
    project_reference: string;
    project_year?: string | null;
    service_type: string;
    payment_mode: string;
    description?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    is_default: boolean;
    is_active: boolean;
    notes?: string | null;
  } | null;
  assignments: MobileAssignment[];
  work_logs: Array<{
    id: string;
    work_date: string;
    time_from: string;
    time_to: string;
    minutes_total: number;
    activity_description: string;
    technician_user: {
      id: string;
      full_name?: string | null;
      email: string;
    };
  }>;
  travel_logs: Array<{
    id: string;
    request_id: string;
    started_at: string;
    ended_at?: string | null;
    estimated_duration_minutes?: number | null;
    final_duration_minutes?: number | null;
    estimated_distance_km?: number | string | null;
    final_distance_km?: number | string | null;
    start_latitude?: number | string | null;
    start_longitude?: number | string | null;
    end_latitude?: number | string | null;
    end_longitude?: number | string | null;
    is_gps_estimated: boolean;
    is_active: boolean;
    has_manual_adjustments: boolean;
    manual_adjustment_note?: string | null;
    technician_user: {
      id: string;
      full_name?: string | null;
      email: string;
    };
    created_by_user: {
      id: string;
      full_name?: string | null;
      email: string;
    };
    created_at: string;
    updated_at: string;
  }>;
  material_usages: Array<{
    id: string;
    quantity: number | string;
    unit: string;
    used_at: string;
    material: {
      id: string;
      erp_code: string;
      name: string;
      unit: string;
    };
    warehouse: {
      id: string;
      code: string;
      name: string;
      is_active: boolean;
    };
  }>;
  equipment_assets: Array<{
    id: string;
    equipment_type: string;
    manufacturer?: string | null;
    model?: string | null;
    serial_number?: string | null;
    asset_tag?: string | null;
    location_note?: string | null;
  }>;
  signatures: Array<{
    id: string;
    signer_role: 'technician' | 'client';
    signer_name: string;
    signed_at: string;
    signature_image_data?: string | null;
    is_refused: boolean;
    refusal_reason?: string | null;
    client_remark?: string | null;
  }>;
  can_complete: boolean;
}

export interface MobileWorkboardResponse {
  assigned_to_me: MobileRequestListItem[];
  available: MobileRequestListItem[];
  other_visible: MobileRequestListItem[];
  generated_at: string;
}

export interface MobileNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface MobileRequestMutationResponse {
  request: MobileRequestDetail;
}

export interface MobileMaterialOption {
  id: string;
  erp_code: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  unit: string;
  category?: string | null;
}

export interface MobileWarehouseOption {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface MobileSiteEquipmentOption {
  equipment_key: string;
  display_name: string;
  equipment_type: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
  location_note?: string | null;
  refrigerant?: string | null;
  notes?: string | null;
  is_active: boolean;
  request_count: number;
}

export interface MobileClientSite {
  id: string;
  site_code: string;
  site_name?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface MobileClient {
  id: string;
  name: string;
  client_number?: string | null;
  project_number?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  sites: MobileClientSite[];
}

export interface MobileSiteDetail {
  id: string;
  client_id: string;
  client_name: string;
  site_code: string;
  site_name?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  equipment: MobileSiteEquipmentOption[];
  current_requests: MobileSiteRequestListItem[];
  completed_requests: MobileSiteRequestListItem[];
}
