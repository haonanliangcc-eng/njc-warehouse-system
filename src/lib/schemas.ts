import { z } from "zod";

export const carrierSchema = z.enum(["GOFO", "SPX", "DD301", "UNI", "TEMU", "OTHER"]);
export const roleSchema = z.enum(["admin", "supervisor", "viewer"]);

export const dailyReportSchema = z.object({
  id: z.string().uuid().optional(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.string().min(1).max(40),
  status: z.enum(["draft", "submitted", "locked"]).default("draft"),
  general_notes: z.string().max(5000).default(""),
  version: z.number().int().positive().default(1)
});

export const shipmentSchema = z.object({
  id: z.string().uuid().optional(),
  carrier: carrierSchema,
  package_count: z.number().int().min(0).default(0),
  pallet_count: z.number().int().min(0).default(0),
  pickup_time: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).default("")
});

export const customsSchema = z.object({
  id: z.string().uuid().optional(),
  broker_name: z.string().max(120).default(""),
  status: z.string().max(80).default(""),
  quantity: z.number().int().min(0).default(0),
  cleared_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).default("")
});

export const laborSchema = z.object({
  id: z.string().uuid().optional(),
  labor_company: z.string().max(120).default(""),
  headcount: z.number().int().min(0).default(0),
  work_hours: z.number().min(0).default(0),
  processed_quantity: z.number().int().min(0).default(0),
  notes: z.string().max(2000).default("")
});

export const taskSchema = z.object({
  id: z.string().uuid().optional(),
  shift: z.string().min(1).max(40).default("早班"),
  task_name: z.string().min(1).max(300),
  assigned_to: z.string().max(120).default(""),
  completed: z.boolean().default(false),
  completed_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).default("")
});

export const incidentSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1).max(120).default("general"),
  description: z.string().min(1).max(5000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  action_taken: z.string().max(5000).default(""),
  owner_id: z.string().uuid().nullable().optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).default("open")
});

export const handoverSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1).max(3000),
  priority: z.string().max(40).default("normal"),
  assigned_to: z.string().max(120).default(""),
  due_at: z.string().datetime().nullable().optional(),
  completed: z.boolean().default(false),
  completed_at: z.string().datetime().nullable().optional()
});

export const signatureSchema = z.object({
  id: z.string().uuid().optional(),
  signature_type: z.enum(["handover", "receiver", "supervisor", "manager"]),
  signer_id: z.string().uuid().nullable().optional(),
  signer_name: z.string().max(120).default(""),
  signed_at: z.string().datetime().nullable().optional(),
  storage_path: z.string().nullable().optional()
});

export const reportBundleSchema = z.object({
  report: dailyReportSchema,
  shipments: z.array(shipmentSchema).default([]),
  customs: z.array(customsSchema).default([]),
  labor: z.array(laborSchema).default([]),
  tasks: z.array(taskSchema).default([]),
  incidents: z.array(incidentSchema).default([]),
  handovers: z.array(handoverSchema).default([]),
  signatures: z.array(signatureSchema).default([])
});

export const reportSectionSchema = z.enum([
  "report",
  "shipments",
  "customs",
  "labor",
  "tasks",
  "incidents",
  "morning_returns",
  "evening_logistics",
  "handovers",
  "signatures"
]);

export const reportSectionUpdateSchema = z.object({
  section: reportSectionSchema,
  bundle: reportBundleSchema
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1).max(120),
  role: roleSchema,
  is_active: z.boolean()
});

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(120)
});
