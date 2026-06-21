import type {
  Carrier,
  CustomsRecord,
  HandoverItem,
  LaborRecord,
  ReportBundle,
  ShipmentRecord,
  TaskRecord
} from "./types";

export const carriers: Carrier[] = ["GOFO", "SPX", "DD301", "UNI", "TEMU", "OTHER"];

export const shifts = ["早班", "晚班"];

export const forwardWarehouses = [
  "UniJFK仓库",
  "IMUSPSJFK仓库",
  "GofoJFK仓库",
  "SPXJFK仓库",
  "华盛顿提货仓02",
  "费城提货仓01",
  "华盛顿提货仓01",
  "肯尼迪提货仓03",
  "肯尼迪提货仓01",
  "纽约中心仓01"
];

export const customsBrokerPresets = [
  { broker_name: "AGS", notes: "184-54 149th Ave, Springfield Gardens, NY 11413" },
  { broker_name: "IMG", notes: "147-06 176th St, Jamaica, NY 11434" },
  { broker_name: "Mirage", notes: "179-20 149th Ave, Jamaica, NY 11434" },
  { broker_name: "Yuejie1", notes: "167-17 146th Rd, Jamaica, NY 11434" },
  { broker_name: "Yuejie2", notes: "165-15 145th Dr, Jamaica, NY 11434" },
  { broker_name: "YiYou", notes: "152-31 135th Ave, Jamaica, NY 11434" },
  { broker_name: "R&T", notes: "148-36 Guy R Brewer Blvd, Jamaica, NY 11434" },
  { broker_name: "六脉", notes: "145-11 155th St, Jamaica, NY 11434" },
  { broker_name: "Tolead", notes: "107 Charles Lindbergh Blvd, Garden City, NY 11530" },
  { broker_name: "JFK86空运", notes: "Cargo Bldg 21, Jamaica, NY 11430" },
  { broker_name: "SF1", notes: "14808 Guy R Brewer Blvd, Jamaica, NY 11434" },
  { broker_name: "SF2", notes: "15344 S Conduit Ave, Jamaica, NY 11434" }
];

export const presetCustomsNames = new Set(customsBrokerPresets.map((item) => item.broker_name));
const deprecatedCustomsNames = new Set(["ISP", "JFK"]);

export const laborCompanyPresets = ["Han", "Delin"];

export const taskTemplates = [
  "NJC仓派送货装车完成",
  "GOFO司机取货完成",
  "SPX司机取货完成",
  "DD301司机取货完成",
  "UNI司机取货完成",
  "Temu发货/退货交接完成",
  "DD301空运交航完成",
  "异常包裹登记完成"
];

export function todayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDefaultReportBundle(date = todayKey(), shift = "早班"): ReportBundle {
  return {
    report: {
      report_date: date,
      shift,
      status: "draft",
      general_notes: "",
      version: 1
    },
    shipments: carriers.map((carrier) => ({
      carrier,
      package_count: 0,
      pallet_count: 0,
      pickup_time: null,
      notes: ""
    })),
    customs: customsBrokerPresets.map((broker) => ({
      broker_name: broker.broker_name,
      status: "",
      quantity: 0,
      cleared_at: null,
      notes: broker.notes
    })),
    labor: laborCompanyPresets.map((labor_company) => ({
      labor_company,
      headcount: 0,
      work_hours: 0,
      processed_quantity: 0,
      notes: ""
    })),
    tasks: taskTemplates.map((task_name) => ({
      shift,
      task_name,
      assigned_to: "",
      completed: false,
      completed_at: null,
      notes: ""
    })),
    incidents: [],
    handovers: [
      {
        description: "早班拉回NJC物资",
        priority: "morning_return",
        assigned_to: "",
        due_at: null,
        completed: false,
        completed_at: null
      },
      {
        description: "晚间揽收回仓",
        priority: "evening_pickup",
        assigned_to: "",
        due_at: null,
        completed: false,
        completed_at: null
      },
      ...forwardWarehouses.map((warehouse) => ({
        description: warehouse,
        priority: "evening_dispatch",
        assigned_to: "",
        due_at: null,
        completed: false,
        completed_at: null
      }))
    ],
    signatures: [
      { signature_type: "handover", signer_id: null, signer_name: "", signed_at: null, storage_path: null },
      { signature_type: "receiver", signer_id: null, signer_name: "", signed_at: null, storage_path: null },
      { signature_type: "supervisor", signer_id: null, signer_name: "", signed_at: null, storage_path: null },
      { signature_type: "manager", signer_id: null, signer_name: "", signed_at: null, storage_path: null }
    ]
  };
}

function mergeByCarrier(defaultRows: ShipmentRecord[], rows: ShipmentRecord[]) {
  return defaultRows.map((defaultRow) => rows.find((row) => row.carrier === defaultRow.carrier) ?? defaultRow);
}

function mergeByName<T extends { [key: string]: unknown }>(defaultRows: T[], rows: T[], field: keyof T) {
  const merged = defaultRows.map((defaultRow) => rows.find((row) => row[field] === defaultRow[field]) ?? defaultRow);
  const extraRows = rows.filter((row) => !defaultRows.some((defaultRow) => defaultRow[field] === row[field]));
  return [...merged, ...extraRows];
}

function mergeHandovers(defaultRows: HandoverItem[], rows: HandoverItem[]) {
  const key = (row: HandoverItem) => `${row.priority}:${row.description}`;
  const merged = defaultRows.map((defaultRow) => rows.find((row) => key(row) === key(defaultRow)) ?? defaultRow);
  const extraRows = rows.filter((row) => !defaultRows.some((defaultRow) => key(defaultRow) === key(row)));
  return [...merged, ...extraRows];
}

function normalizeDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeReportBundle(bundle: ReportBundle): ReportBundle {
  const defaults = createDefaultReportBundle(bundle.report.report_date, bundle.report.shift);
  const shipments = mergeByCarrier(defaults.shipments, bundle.shipments ?? []).map((row) => ({
    ...row,
    pickup_time: normalizeDateTime(row.pickup_time)
  }));
  const customs = mergeByName<CustomsRecord>(
    defaults.customs,
    (bundle.customs ?? []).filter((row) => !deprecatedCustomsNames.has(row.broker_name)),
    "broker_name"
  ).map((row) => ({
    ...row,
    cleared_at: normalizeDateTime(row.cleared_at)
  }));
  const tasks = mergeByName<TaskRecord>(defaults.tasks, bundle.tasks ?? [], "task_name").map((row) => ({
    ...row,
    completed_at: normalizeDateTime(row.completed_at)
  }));
  const handovers = mergeHandovers(defaults.handovers, bundle.handovers ?? []).map((row) => ({
    ...row,
    due_at: normalizeDateTime(row.due_at),
    completed_at: normalizeDateTime(row.completed_at)
  }));
  const signatures = (bundle.signatures?.length ? bundle.signatures : defaults.signatures).map((row) => ({
    ...row,
    signed_at: normalizeDateTime(row.signed_at)
  }));

  return {
    ...defaults,
    ...bundle,
    shipments,
    customs,
    labor: mergeByName<LaborRecord>(defaults.labor, bundle.labor ?? [], "labor_company"),
    tasks,
    incidents: bundle.incidents ?? [],
    handovers,
    signatures
  };
}
