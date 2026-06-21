import { ApiError } from "./auth";
import { createServiceSupabase } from "./supabase";
import type {
  DailyReport,
  CustomsRecord,
  HandoverItem,
  Incident,
  IncidentPhoto,
  LaborRecord,
  ReportBundle,
  ShipmentRecord,
  Signature,
  TaskRecord,
  UserContext
} from "./types";

const childTables = [
  "shipment_records",
  "customs_records",
  "labor_records",
  "task_records",
  "handover_items",
  "signatures"
] as const;

function service() {
  return createServiceSupabase();
}

function rowForReport<T extends { id?: string; report_id?: string; created_at?: string; updated_at?: string }>(
  row: T,
  reportId: string
) {
  const { id, report_id: _reportId, created_at: _createdAt, updated_at: _updatedAt, ...rest } = row;
  return id ? { ...rest, id, report_id: reportId } : { ...rest, report_id: reportId };
}

async function auditLog(
  user: UserContext,
  action: string,
  tableName: string,
  recordId: string | null,
  oldValue: unknown,
  newValue: unknown
) {
  await service().from("audit_logs").insert({
    user_id: user.id,
    action,
    table_name: tableName,
    record_id: recordId,
    old_value: oldValue,
    new_value: newValue
  });
}

export async function listProfiles() {
  const { data, error } = await service()
    .from("profiles")
    .select("id, full_name, email, role, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function updateProfile(
  user: UserContext,
  id: string,
  next: { full_name: string; role: string; is_active: boolean }
) {
  if (id === user.id && next.role === "admin" && user.role !== "admin") {
    throw new ApiError(403, "禁止用户自行把自己的角色改为 admin。");
  }
  const { data: oldValue } = await service().from("profiles").select("*").eq("id", id).single();
  const { data, error } = await service()
    .from("profiles")
    .update(next)
    .eq("id", id)
    .select("id, full_name, email, role, is_active, created_at, updated_at")
    .single();
  if (error) throw new ApiError(500, error.message);
  await auditLog(user, "update", "profiles", id, oldValue, data);
  return data;
}

export async function createViewerProfile(input: { id: string; email: string; full_name: string }) {
  const { data, error } = await service()
    .from("profiles")
    .insert({
      id: input.id,
      email: input.email,
      full_name: input.full_name,
      role: "viewer",
      is_active: true
    })
    .select("id, full_name, email, role, is_active, created_at, updated_at")
    .single();
  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function listReportSummaries() {
  const { data, error } = await service()
    .from("daily_reports")
    .select("id, report_date, shift, status, version, general_notes, created_by, updated_by, created_at, updated_at")
    .order("report_date", { ascending: false })
    .limit(60);
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function loadReportBundle(reportId: string): Promise<ReportBundle> {
  const supabase = service();
  const { data: report, error: reportError } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new ApiError(404, "日报不存在。");

  const [shipments, customs, labor, tasks, incidents, handovers, signatures] = await Promise.all([
    supabase.from("shipment_records").select("*").eq("report_id", reportId).order("carrier"),
    supabase.from("customs_records").select("*").eq("report_id", reportId).order("created_at"),
    supabase.from("labor_records").select("*").eq("report_id", reportId).order("created_at"),
    supabase.from("task_records").select("*").eq("report_id", reportId).order("created_at"),
    supabase.from("incidents").select("*").eq("report_id", reportId).order("created_at"),
    supabase.from("handover_items").select("*").eq("report_id", reportId).order("created_at"),
    supabase.from("signatures").select("*").eq("report_id", reportId).order("signature_type")
  ]);

  for (const result of [shipments, customs, labor, tasks, incidents, handovers, signatures]) {
    if (result.error) throw new ApiError(500, result.error.message);
  }

  const incidentRows = (incidents.data ?? []) as Incident[];
  const photos =
    incidentRows.length === 0
      ? []
      : await supabase
          .from("incident_photos")
          .select("*")
          .in(
            "incident_id",
            incidentRows.map((item) => item.id)
          );
  if ("error" in photos && photos.error) throw new ApiError(500, photos.error.message);
  const photoRows = "data" in photos ? ((photos.data ?? []) as IncidentPhoto[]) : [];
  const signedPhotos = await Promise.all(
    photoRows.map(async (photo) => {
      const { data } = await supabase.storage
        .from("warehouse-files")
        .createSignedUrl(photo.storage_path, 60 * 10);
      return { ...photo, signed_url: data?.signedUrl };
    })
  );
  const incidentsWithPhotos = incidentRows.map((incident) => ({
    ...incident,
    photos: signedPhotos.filter((photo) => photo.incident_id === incident.id)
  }));

  return {
    report: report as DailyReport,
    shipments: (shipments.data ?? []) as ShipmentRecord[],
    customs: (customs.data ?? []) as CustomsRecord[],
    labor: (labor.data ?? []) as LaborRecord[],
    tasks: (tasks.data ?? []) as TaskRecord[],
    incidents: incidentsWithPhotos,
    handovers: (handovers.data ?? []) as HandoverItem[],
    signatures: (signatures.data ?? []) as Signature[]
  };
}

export async function createReportBundle(user: UserContext, bundle: ReportBundle) {
  const supabase = service();
  const { data: report, error } = await supabase
    .from("daily_reports")
    .insert({
      report_date: bundle.report.report_date,
      shift: bundle.report.shift,
      status: bundle.report.status,
      general_notes: bundle.report.general_notes,
      created_by: user.id,
      updated_by: user.id
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, error.message);

  await replaceChildren(report.id, bundle);
  await auditLog(user, "create", "daily_reports", report.id, null, report);
  return loadReportBundle(report.id);
}

export async function updateReportBundle(user: UserContext, reportId: string, bundle: ReportBundle) {
  const supabase = service();
  const { data: existing, error: existingError } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (existingError || !existing) throw new ApiError(404, "日报不存在。");

  if ((existing.status === "locked" || bundle.report.status === "locked") && user.role !== "admin") {
    throw new ApiError(403, "日报已锁定，只有管理员可以修改。");
  }

  if (existing.version !== bundle.report.version) {
    throw new ApiError(409, "该日报已被其他用户修改，请刷新后重新提交。");
  }

  const { data: updated, error } = await supabase
    .from("daily_reports")
    .update({
      report_date: bundle.report.report_date,
      shift: bundle.report.shift,
      status: bundle.report.status,
      general_notes: bundle.report.general_notes,
      version: existing.version + 1,
      updated_by: user.id
    })
    .eq("id", reportId)
    .eq("version", bundle.report.version)
    .select("*")
    .single();
  if (error || !updated) throw new ApiError(409, "该日报已被其他用户修改，请刷新后重新提交。");

  await replaceChildren(reportId, bundle);
  await auditLog(user, "update", "daily_reports", reportId, existing, updated);
  return loadReportBundle(reportId);
}

async function replaceChildren(reportId: string, bundle: ReportBundle) {
  const supabase = service();
  for (const table of childTables) {
    const { error } = await supabase.from(table).delete().eq("report_id", reportId);
    if (error) throw new ApiError(500, error.message);
  }

  const { data: existingIncidents, error: existingIncidentsError } = await supabase
    .from("incidents")
    .select("id")
    .eq("report_id", reportId);
  if (existingIncidentsError) throw new ApiError(500, existingIncidentsError.message);

  const incomingIncidentIds = new Set(bundle.incidents.map((incident) => incident.id).filter(Boolean));
  const removedIncidentIds = (existingIncidents ?? [])
    .map((incident) => incident.id as string)
    .filter((id) => !incomingIncidentIds.has(id));

  for (const incidentId of removedIncidentIds) {
    await deleteIncidentFiles(incidentId);
  }
  if (removedIncidentIds.length > 0) {
    const { error } = await supabase.from("incidents").delete().in("id", removedIncidentIds);
    if (error) throw new ApiError(500, error.message);
  }

  const incidentRows = bundle.incidents.map(({ photos: _photos, ...row }) => rowForReport(row, reportId));
  if (incidentRows.length > 0) {
    const { error } = await supabase.from("incidents").upsert(incidentRows as never[]);
    if (error) throw new ApiError(500, error.message);
  }

  const inserts = [
    {
      table: "shipment_records",
      rows: bundle.shipments.map((row) => rowForReport(row, reportId))
    },
    {
      table: "customs_records",
      rows: (bundle.customs ?? []).map((row) => rowForReport(row, reportId))
    },
    {
      table: "labor_records",
      rows: bundle.labor.map((row) => rowForReport(row, reportId))
    },
    {
      table: "task_records",
      rows: bundle.tasks.map((row) => rowForReport(row, reportId))
    },
    {
      table: "handover_items",
      rows: bundle.handovers.map((row) => rowForReport(row, reportId))
    },
    {
      table: "signatures",
      rows: bundle.signatures.map((row) => rowForReport(row, reportId))
    }
  ];

  for (const insert of inserts) {
    if (insert.rows.length === 0) continue;
    const { error } = await supabase.from(insert.table).insert(insert.rows as never[]);
    if (error) throw new ApiError(500, error.message);
  }
}

export async function deleteReport(user: UserContext, reportId: string) {
  const supabase = service();
  const { data: oldValue } = await supabase.from("daily_reports").select("*").eq("id", reportId).single();
  const { error } = await supabase.from("daily_reports").delete().eq("id", reportId);
  if (error) throw new ApiError(500, error.message);
  await auditLog(user, "delete", "daily_reports", reportId, oldValue, null);
}

export async function deleteIncidentFiles(incidentId: string) {
  const supabase = service();
  const { data: photos, error } = await supabase
    .from("incident_photos")
    .select("storage_path")
    .eq("incident_id", incidentId);
  if (error) throw new ApiError(500, error.message);
  const paths = (photos ?? []).map((photo) => photo.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from("warehouse-files").remove(paths);
  }
}
