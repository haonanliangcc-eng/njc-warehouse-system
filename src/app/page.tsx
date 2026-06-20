"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";
import type {
  AppRole,
  Carrier,
  Incident,
  Profile,
  ReportBundle,
  ShipmentRecord,
  TaskRecord,
  UserContext
} from "@/lib/types";

const carriers: Carrier[] = ["GOFO", "SPX", "DD301", "UNI", "TEMU", "OTHER"];
const today = new Date().toISOString().slice(0, 10);

function defaultBundle(): ReportBundle {
  return {
    report: {
      report_date: today,
      shift: "早班",
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
    labor: [
      {
        labor_company: "",
        headcount: 0,
        work_hours: 0,
        processed_quantity: 0,
        notes: ""
      }
    ],
    tasks: [
      { shift: "早班", task_name: "NJC仓派送货装车完成", assigned_to: "", completed: false, completed_at: null, notes: "" },
      { shift: "早班", task_name: "GOFO司机取货完成", assigned_to: "", completed: false, completed_at: null, notes: "" },
      { shift: "早班", task_name: "SPX司机取货完成", assigned_to: "", completed: false, completed_at: null, notes: "" },
      { shift: "早班", task_name: "DD301司机取货完成", assigned_to: "", completed: false, completed_at: null, notes: "" },
      { shift: "早班", task_name: "UNI司机取货完成", assigned_to: "", completed: false, completed_at: null, notes: "" },
      { shift: "早班", task_name: "Temu退货接收登记完成", assigned_to: "", completed: false, completed_at: null, notes: "" },
      { shift: "早班", task_name: "异常包裹登记完成", assigned_to: "", completed: false, completed_at: null, notes: "" }
    ],
    incidents: [],
    handovers: [],
    signatures: [
      { signature_type: "handover", signer_id: null, signer_name: "", signed_at: null, storage_path: null },
      { signature_type: "receiver", signer_id: null, signer_name: "", signed_at: null, storage_path: null },
      { signature_type: "supervisor", signer_id: null, signer_name: "", signed_at: null, storage_path: null },
      { signature_type: "manager", signer_id: null, signer_name: "", signed_at: null, storage_path: null }
    ]
  };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function Home() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserContext | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("正在加载...");
  const [activeView, setActiveView] = useState<"daily" | "history" | "admin">("daily");
  const [bundle, setBundle] = useState<ReportBundle>(() => defaultBundle());
  const [reports, setReports] = useState<ReportBundle["report"][]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const canEdit = user?.role === "admin" || user?.role === "supervisor";
  const isAdmin = user?.role === "admin";

  const metrics = useMemo(() => {
    return {
      totalShipments: bundle.shipments.reduce((sum, row) => sum + row.package_count, 0),
      totalPallets: bundle.shipments.reduce((sum, row) => sum + row.pallet_count, 0),
      laborCount: bundle.labor.reduce((sum, row) => sum + row.headcount, 0),
      incidentCount: bundle.incidents.length,
      unfinishedCount: bundle.tasks.filter((task) => !task.completed).length
    };
  }, [bundle]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadMe(data.session.access_token);
      else setStatus("请登录");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadMe(nextSession.access_token);
      else {
        setUser(null);
        setStatus("请登录");
      }
    });
    return () => data.subscription.unsubscribe();
    // Authentication bootstraps once per Supabase client instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function apiFetch(path: string, init: RequestInit = {}) {
    if (!session?.access_token) throw new Error("请先登录。");
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers ?? {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || "操作失败";
      const error = new Error(message);
      error.name = String(response.status);
      throw error;
    }
    return data;
  }

  async function loadMe(token: string) {
    try {
      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法读取用户信息");
      setUser(data.user);
      setStatus("已登录");
      await loadReports(token);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "登录状态异常");
    }
  }

  async function loadReports(token = session?.access_token) {
    if (!token) return;
    const response = await fetch("/api/daily-reports", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取日报");
    setReports(data.reports);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setStatus("登录中...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? error.message : "已登录");
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setBundle(defaultBundle());
    setReports([]);
  }

  function updateBundle(next: Partial<ReportBundle>) {
    setBundle((current) => ({ ...current, ...next }));
  }

  async function saveReport() {
    if (!canEdit) return;
    try {
      setStatus("保存中...");
      const isExisting = Boolean(bundle.report.id);
      const data = await apiFetch(isExisting ? `/api/daily-reports/${bundle.report.id}` : "/api/daily-reports", {
        method: isExisting ? "PUT" : "POST",
        body: JSON.stringify(bundle)
      });
      setBundle(data.bundle);
      await loadReports();
      setStatus("已保存");
    } catch (error) {
      if (error instanceof Error && error.name === "409") {
        setStatus("该日报已被其他用户修改，请刷新后重新提交。");
      } else {
        setStatus(error instanceof Error ? error.message : "保存失败");
      }
    }
  }

  async function loadReport(id: string) {
    try {
      setStatus("读取中...");
      const data = await apiFetch(`/api/daily-reports/${id}`);
      setBundle(data.bundle);
      setStatus("已读取");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取失败");
    }
  }

  async function pushDingTalk() {
    try {
      setStatus("推送钉钉中...");
      await apiFetch("/api/dingtalk/send", {
        method: "POST",
        body: JSON.stringify({
          report_date: bundle.report.report_date,
          warehouse: "NJC仓",
          total_shipments: metrics.totalShipments,
          total_pallets: metrics.totalPallets,
          labor_count: metrics.laborCount,
          incident_count: metrics.incidentCount,
          unfinished_count: metrics.unfinishedCount
        })
      });
      setStatus("已推送钉钉");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "钉钉推送失败");
    }
  }

  async function uploadIncidentPhoto(incident: Incident, file: File) {
    if (!bundle.report.id || !incident.id) {
      setStatus("请先保存日报，再上传异常照片。");
      return;
    }
    try {
      setUploading(incident.id);
      const formData = new FormData();
      formData.set("report_id", bundle.report.id);
      formData.set("incident_id", incident.id);
      formData.set("file", file);
      const response = await fetch("/api/uploads/incident-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "上传失败");
      setBundle((current) => ({
        ...current,
        incidents: current.incidents.map((row) =>
          row.id === incident.id ? { ...row, photos: [...(row.photos ?? []), data.photo] } : row
        )
      }));
      setStatus("照片已上传");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(null);
    }
  }

  function exportExcel() {
    const rows = [
      ["日期", bundle.report.report_date],
      ["班次", bundle.report.shift],
      ["总发货量", metrics.totalShipments],
      ["总板数", metrics.totalPallets],
      ["劳务人数", metrics.laborCount],
      [],
      ["承运商", "包裹数", "板数", "提货时间", "备注"],
      ...bundle.shipments.map((row) => [row.carrier, row.package_count, row.pallet_count, row.pickup_time ?? "", row.notes])
    ];
    const html = `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `NJC日报-${bundle.report.report_date}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadProfiles() {
    try {
      const data = await apiFetch("/api/profiles");
      setProfiles(data.profiles);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法读取用户");
    }
  }

  async function saveProfile(profile: Profile) {
    try {
      await apiFetch("/api/profiles", {
        method: "PUT",
        body: JSON.stringify(profile)
      });
      await loadProfiles();
      setStatus("用户已更新");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "用户更新失败");
    }
  }

  if (!supabase) {
    return <SetupMissing />;
  }

  if (!session || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <form onSubmit={login} className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-panel">
          <h1 className="text-2xl font-semibold">NJC仓运营数据中心</h1>
          <p className="mt-2 text-sm text-slate-600">{status}</p>
          <input type="email" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-5 w-full rounded border border-line px-3 py-2" />
          <input type="password" placeholder="密码" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-3 w-full rounded border border-line px-3 py-2" />
          <button className="mt-5 w-full rounded bg-brand px-4 py-2 font-semibold text-white">登录</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">NJC仓运营数据中心</h1>
            <p className="mt-1 text-sm text-slate-600">
              {user.full_name || user.email} · {user.role} · {status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <button onClick={saveReport} className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">保存</button>}
            <button onClick={exportExcel} className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold">导出 Excel</button>
            <button onClick={() => window.print()} className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold">导出 PDF</button>
            {canEdit && <button onClick={pushDingTalk} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white">推送钉钉</button>}
            <button onClick={logout} className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold">退出登录</button>
          </div>
        </div>
      </header>

      <section className="no-print mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="今日总发货量" value={metrics.totalShipments} />
          <Metric label="今日总板数" value={metrics.totalPallets} />
          <Metric label="今日劳务人数" value={metrics.laborCount} />
          <Metric label="今日异常事件数量" value={metrics.incidentCount} />
          <Metric label="未完成事项数量" value={metrics.unfinishedCount} />
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto rounded-lg border border-line bg-white p-2">
          {[
            ["daily", "日报填写"],
            ["history", "历史记录"],
            ...(isAdmin ? [["admin", "用户管理"]] : [])
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveView(key as "daily" | "history" | "admin");
                if (key === "admin") void loadProfiles();
              }}
              className={`whitespace-nowrap rounded px-4 py-2 text-sm font-semibold ${activeView === key ? "bg-ink text-white" : "bg-white text-ink"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeView === "daily" && (
          <DailyEditor
            bundle={bundle}
            canEdit={canEdit}
            setBundle={setBundle}
            updateBundle={updateBundle}
            uploadIncidentPhoto={uploadIncidentPhoto}
            uploading={uploading}
          />
        )}

        {activeView === "history" && (
          <Panel title="历史日报">
            <div className="mb-3 flex justify-between gap-3">
              <button onClick={() => void loadReports()} className="rounded border border-line bg-white px-3 py-2 text-sm font-semibold">刷新</button>
              {canEdit && <button onClick={() => setBundle(defaultBundle())} className="rounded bg-brand px-3 py-2 text-sm font-semibold text-white">新建日报</button>}
            </div>
            <Table headers={["日期", "班次", "状态", "版本", "更新时间", "操作"]}>
              {reports.map((report) => (
                <tr key={report.id}>
                  <Cell>{report.report_date}</Cell>
                  <Cell>{report.shift}</Cell>
                  <Cell>{report.status}</Cell>
                  <Cell>{report.version}</Cell>
                  <Cell>{report.updated_at ?? ""}</Cell>
                  <Cell><button onClick={() => report.id && loadReport(report.id)} className="rounded bg-ink px-3 py-1 text-white">打开</button></Cell>
                </tr>
              ))}
            </Table>
          </Panel>
        )}

        {activeView === "admin" && isAdmin && (
          <Panel title="用户管理">
            <Table headers={["邮箱", "姓名", "角色", "启用", "操作"]}>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <Cell>{profile.email}</Cell>
                  <Cell><input value={profile.full_name} onChange={(event) => setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, full_name: event.target.value } : item))} className="w-full rounded border border-line px-2 py-1" /></Cell>
                  <Cell>
                    <select value={profile.role} onChange={(event) => setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, role: event.target.value as AppRole } : item))} className="w-full rounded border border-line px-2 py-1">
                      {["admin", "supervisor", "viewer"].map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </Cell>
                  <Cell><input type="checkbox" checked={profile.is_active} onChange={(event) => setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, is_active: event.target.checked } : item))} /></Cell>
                  <Cell><button onClick={() => void saveProfile(profile)} className="rounded bg-brand px-3 py-1 text-white">保存</button></Cell>
                </tr>
              ))}
            </Table>
          </Panel>
        )}
      </section>
    </main>
  );
}

function DailyEditor({
  bundle,
  canEdit,
  setBundle,
  updateBundle,
  uploadIncidentPhoto,
  uploading
}: {
  bundle: ReportBundle;
  canEdit: boolean;
  setBundle: React.Dispatch<React.SetStateAction<ReportBundle>>;
  updateBundle: (next: Partial<ReportBundle>) => void;
  uploadIncidentPhoto: (incident: Incident, file: File) => Promise<void>;
  uploading: string | null;
}) {
  function updateShipment(index: number, next: Partial<ShipmentRecord>) {
    updateBundle({ shipments: bundle.shipments.map((row, i) => i === index ? { ...row, ...next } : row) });
  }

  function updateTask(index: number, next: Partial<TaskRecord>) {
    updateBundle({ tasks: bundle.tasks.map((row, i) => i === index ? { ...row, ...next } : row) });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-5">
        <Panel title="日报基础信息">
          <div className="grid gap-3 sm:grid-cols-3">
            <Label label="日期"><input disabled={!canEdit} type="date" value={bundle.report.report_date} onChange={(event) => updateBundle({ report: { ...bundle.report, report_date: event.target.value } })} className="w-full rounded border border-line px-3 py-2" /></Label>
            <Label label="班次"><input disabled={!canEdit} value={bundle.report.shift} onChange={(event) => updateBundle({ report: { ...bundle.report, shift: event.target.value } })} className="w-full rounded border border-line px-3 py-2" /></Label>
            <Label label="状态">
              <select disabled={!canEdit} value={bundle.report.status} onChange={(event) => updateBundle({ report: { ...bundle.report, status: event.target.value as ReportBundle["report"]["status"] } })} className="w-full rounded border border-line px-3 py-2">
                <option value="draft">draft</option>
                <option value="submitted">submitted</option>
                <option value="locked">locked</option>
              </select>
            </Label>
          </div>
          <textarea disabled={!canEdit} placeholder="备注" value={bundle.report.general_notes} onChange={(event) => updateBundle({ report: { ...bundle.report, general_notes: event.target.value } })} className="mt-3 min-h-24 w-full rounded border border-line px-3 py-2" />
          <p className="mt-2 text-sm text-slate-600">当前版本：{bundle.report.version}</p>
        </Panel>

        <Panel title="发货记录">
          <Table headers={["承运商", "包裹数", "板数", "提货时间", "备注"]}>
            {bundle.shipments.map((row, index) => (
              <tr key={`${row.carrier}-${index}`}>
                <Cell>{row.carrier}</Cell>
                <Cell><NumberInput disabled={!canEdit} value={row.package_count} onChange={(value) => updateShipment(index, { package_count: value })} /></Cell>
                <Cell><NumberInput disabled={!canEdit} value={row.pallet_count} onChange={(value) => updateShipment(index, { pallet_count: value })} /></Cell>
                <Cell><input disabled={!canEdit} type="datetime-local" value={row.pickup_time?.slice(0, 16) ?? ""} onChange={(event) => updateShipment(index, { pickup_time: event.target.value ? new Date(event.target.value).toISOString() : null })} className="w-full rounded border border-line px-2 py-1" /></Cell>
                <Cell><input disabled={!canEdit} value={row.notes} onChange={(event) => updateShipment(index, { notes: event.target.value })} className="w-full rounded border border-line px-2 py-1" /></Cell>
              </tr>
            ))}
          </Table>
        </Panel>

        <Panel title="员工职责清单">
          <div className="space-y-2">
            {bundle.tasks.map((task, index) => (
              <label key={`${task.task_name}-${index}`} className="grid grid-cols-[auto_1fr] gap-3 rounded border border-line p-3 text-sm">
                <input disabled={!canEdit} type="checkbox" checked={task.completed} onChange={(event) => updateTask(index, { completed: event.target.checked, completed_at: event.target.checked ? new Date().toISOString() : null })} className="mt-1 h-4 w-4" />
                <span>
                  <span className="block font-semibold">{task.task_name}</span>
                  <input disabled={!canEdit} placeholder="责任人" value={task.assigned_to} onChange={(event) => updateTask(index, { assigned_to: event.target.value })} className="mt-2 w-full rounded border border-line px-2 py-1" />
                </span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="劳务记录">
          {bundle.labor.map((row, index) => (
            <div key={index} className="grid gap-2 rounded border border-line p-3 sm:grid-cols-2">
              <input disabled={!canEdit} placeholder="劳务公司" value={row.labor_company} onChange={(event) => updateBundle({ labor: bundle.labor.map((item, i) => i === index ? { ...item, labor_company: event.target.value } : item) })} className="rounded border border-line px-2 py-1" />
              <NumberInput disabled={!canEdit} value={row.headcount} onChange={(value) => updateBundle({ labor: bundle.labor.map((item, i) => i === index ? { ...item, headcount: value } : item) })} />
              <NumberInput disabled={!canEdit} value={row.work_hours} onChange={(value) => updateBundle({ labor: bundle.labor.map((item, i) => i === index ? { ...item, work_hours: value } : item) })} />
              <NumberInput disabled={!canEdit} value={row.processed_quantity} onChange={(value) => updateBundle({ labor: bundle.labor.map((item, i) => i === index ? { ...item, processed_quantity: value } : item) })} />
            </div>
          ))}
        </Panel>

        <Panel title="异常事件">
          {canEdit && <button onClick={() => setBundle((current) => ({ ...current, incidents: [...current.incidents, { id: crypto.randomUUID(), category: "general", description: "", severity: "medium", action_taken: "", owner_id: null, status: "open", photos: [] }] }))} className="mb-3 rounded bg-ink px-3 py-2 text-sm font-semibold text-white">新增异常</button>}
          <div className="space-y-3">
            {bundle.incidents.map((incident, index) => (
              <div key={incident.id ?? index} className="rounded border border-line p-3">
                <select disabled={!canEdit} value={incident.severity} onChange={(event) => updateBundle({ incidents: bundle.incidents.map((item, i) => i === index ? { ...item, severity: event.target.value as Incident["severity"] } : item) })} className="rounded border border-line px-2 py-1">
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
                <textarea disabled={!canEdit} placeholder="异常描述" value={incident.description} onChange={(event) => updateBundle({ incidents: bundle.incidents.map((item, i) => i === index ? { ...item, description: event.target.value } : item) })} className="mt-2 min-h-20 w-full rounded border border-line px-3 py-2" />
                <textarea disabled={!canEdit} placeholder="处理措施" value={incident.action_taken} onChange={(event) => updateBundle({ incidents: bundle.incidents.map((item, i) => i === index ? { ...item, action_taken: event.target.value } : item) })} className="mt-2 min-h-16 w-full rounded border border-line px-3 py-2" />
                {canEdit && (
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading === incident.id} onChange={(event) => event.target.files?.[0] && void uploadIncidentPhoto(incident, event.target.files[0])} className="mt-2 text-sm" />
                )}
                {uploading === incident.id && <p className="mt-1 text-sm text-slate-600">上传中...</p>}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(incident.photos ?? []).map((photo) => photo.signed_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={photo.id} src={photo.signed_url} alt={photo.file_name} className="h-20 w-full rounded object-cover" />
                  ) : null)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SetupMissing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-lg rounded-lg border border-line bg-white p-6 shadow-panel">
        <h1 className="text-2xl font-semibold">缺少 Supabase 配置</h1>
        <p className="mt-3 text-sm text-slate-600">请复制 .env.example 为 .env.local，并填写 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。</p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-left">
            {headers.map((head) => <th key={head} className="border border-line p-2">{head}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="border border-line p-2">{children}</td>;
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold">{label}<span className="mt-1 block">{children}</span></label>;
}

function NumberInput({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <input disabled={disabled} type="number" value={value} onChange={(event) => onChange(toNumber(event.target.value))} className="w-full rounded border border-line px-2 py-1" />;
}
