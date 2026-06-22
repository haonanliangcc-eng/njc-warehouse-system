export type AppRole = "admin" | "supervisor" | "viewer";
export type Carrier = "GOFO" | "SPX" | "DD301" | "UNI" | "TEMU" | "OTHER";
export type ReportStatus = "draft" | "submitted" | "locked";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "in_progress" | "resolved" | "closed";
export type SignatureType = "handover" | "receiver" | "supervisor" | "manager";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyReport = {
  id?: string;
  report_date: string;
  shift: string;
  status: ReportStatus;
  general_notes: string;
  version: number;
  created_by?: string;
  updated_by?: string | null;
  last_saved_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ShipmentRecord = {
  id?: string;
  report_id?: string;
  carrier: Carrier;
  package_count: number;
  pallet_count: number;
  pickup_time: string | null;
  notes: string;
  created_at?: string;
  updated_at?: string;
};

export type CustomsRecord = {
  id?: string;
  report_id?: string;
  broker_name: string;
  status: string;
  quantity: number;
  cleared_at: string | null;
  notes: string;
  created_at?: string;
  updated_at?: string;
};

export type LaborRecord = {
  id?: string;
  report_id?: string;
  labor_company: string;
  headcount: number;
  work_hours: number;
  processed_quantity: number;
  notes: string;
};

export type TaskRecord = {
  id?: string;
  report_id?: string;
  shift: string;
  task_name: string;
  assigned_to: string;
  completed: boolean;
  completed_at: string | null;
  notes: string;
};

export type Incident = {
  id?: string;
  report_id?: string;
  category: string;
  description: string;
  severity: IncidentSeverity;
  action_taken: string;
  owner_id: string | null;
  status: IncidentStatus;
  created_at?: string;
  updated_at?: string;
  photos?: IncidentPhoto[];
};

export type IncidentPhoto = {
  id: string;
  incident_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  signed_url?: string;
  created_at: string;
};

export type HandoverItem = {
  id?: string;
  report_id?: string;
  description: string;
  priority: string;
  assigned_to: string;
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
};

export type Signature = {
  id?: string;
  report_id?: string;
  signature_type: SignatureType;
  signer_id: string | null;
  signer_name: string;
  signed_at: string | null;
  storage_path: string | null;
};

export type ReportBundle = {
  report: DailyReport;
  shipments: ShipmentRecord[];
  customs: CustomsRecord[];
  labor: LaborRecord[];
  tasks: TaskRecord[];
  incidents: Incident[];
  handovers: HandoverItem[];
  signatures: Signature[];
};

export type UserContext = {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
};
