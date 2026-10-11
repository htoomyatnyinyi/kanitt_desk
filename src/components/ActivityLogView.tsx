import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Filter, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useGetAuditLogsQuery } from "../store/apiSlice";

const actions = ["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT", "EXPORT", "PRINT", "VOID", "REFUND", "APPROVE", "REJECT"];
const tone: Record<string, string> = { CREATE: "text-emerald-300 bg-emerald-400/10", UPDATE: "text-sky-300 bg-sky-400/10", DELETE: "text-rose-300 bg-rose-400/10", VOID: "text-rose-300 bg-rose-400/10", REFUND: "text-amber-300 bg-amber-400/10", LOGIN: "text-violet-300 bg-violet-400/10", LOGOUT: "text-slate-300 bg-slate-400/10", APPROVE: "text-emerald-300 bg-emerald-400/10", REJECT: "text-rose-300 bg-rose-400/10" };
const pretty = (value: unknown) => {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};

export function ActivityLogView() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isFetching, isError, refetch } = useGetAuditLogsQuery({ page, limit: 30, ...(action ? { action } : {}), ...(entity.trim() ? { entity: entity.trim() } : {}) });
  const logs = data?.logs ?? [];
  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? logs.filter((log) => [log.user?.name, log.user?.email, log.entity, log.entityId, log.action].some((value) => String(value ?? "").toLowerCase().includes(term))) : logs;
  }, [logs, search]);

  return <main className="flex-1 overflow-y-auto bg-slate-950 p-5 text-slate-100 lg:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Governance · ERP</p><h1 className="mt-2 text-3xl font-bold text-white">Audit & activity log</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">A tenant scoped, time ordered record of changes made by staff and managers. Open an entry to inspect its recorded details.</p></div>
        <button onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-sky-500"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</button>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-sky-400/10 p-2.5 text-sky-300"><ClipboardList className="h-5 w-5" /></div><div><p className="text-xs text-slate-400">Matching records</p><p className="text-xl font-bold text-white">{data?.meta.total ?? "—"}</p></div></div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs text-slate-400">Access scope</p><p className="text-sm font-bold text-white">Managers · current business</p></div></div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300"><Filter className="h-5 w-5" /></div><div><p className="text-xs text-slate-400">Page</p><p className="text-xl font-bold text-white">{data?.meta.page ?? page} <span className="text-sm font-medium text-slate-500">/ {Math.max(1, data?.meta.totalPages ?? 1)}</span></p></div></div></div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, record type or reference" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-500" /></label>
          <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"><option value="">All actions</option>{actions.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} placeholder="Entity type (e.g. Product)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500" />
        </div>
      </section>
      {isError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Could not load audit log activity</span>
          </div>
          <p className="text-xs text-rose-300/80 pl-6">
            Viewing audit trails requires <strong>ADMIN</strong> or <strong>MANAGER</strong> access privileges. If you are signed in as a Cashier, please sign out and sign in with an Admin/Manager account.
          </p>
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="hidden grid-cols-[minmax(180px,1.2fr)_120px_minmax(120px,.8fr)_minmax(130px,1fr)_34px] gap-4 border-b border-slate-800 bg-slate-900 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid"><span>Activity</span><span>Action</span><span>Record</span><span>When</span><span /></div>
        {isLoading ? <div className="p-10 text-center text-sm text-slate-400">Loading audit history…</div> : visibleLogs.length === 0 ? <div className="p-12 text-center"><ClipboardList className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-semibold text-slate-200">No activity entries found</p><p className="mt-1 text-sm text-slate-500">Try changing your filters, or check again after staff activity is recorded.</p></div> : <div className="divide-y divide-slate-800/80">{visibleLogs.map((log) => <details key={log.id} open={selected === log.id} onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setSelected(log.id); else if (selected === log.id) setSelected(null); }} className="group"><summary className="grid cursor-pointer list-none grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-slate-800/40 md:grid-cols-[minmax(180px,1.2fr)_120px_minmax(120px,.8fr)_minmax(130px,1fr)_34px] md:gap-4"><span><span className="block font-semibold text-slate-100">{log.user?.name || log.user?.email || "Unknown staff"}</span><span className="mt-1 block truncate text-xs text-slate-500">{log.entityId}</span></span><span><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${tone[log.action] || "bg-slate-700 text-slate-300"}`}>{log.action}</span></span><span className="text-sm text-slate-300">{log.entity}</span><span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span><ChevronDown className="hidden h-4 w-4 text-slate-500 transition group-open:rotate-180 md:block" /></summary><div className="grid gap-4 border-t border-slate-800 bg-slate-950/50 px-5 py-4 md:grid-cols-2"><div><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Recorded changes</h3><pre className="max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs leading-relaxed text-slate-300">{pretty(log.changes ?? { oldData: log.oldData, newData: log.newData })}</pre></div><div className="space-y-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff / role</p><p className="mt-1 text-sm text-slate-200">{log.user?.name || "Unknown"}{log.user?.role ? ` · ${log.user.role}` : ""}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reference</p><p className="mt-1 break-all text-sm text-slate-300">{log.entity} · {log.entityId}</p></div>{log.ipAddress && <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Network address</p><p className="mt-1 text-sm text-slate-300">{log.ipAddress}</p></div>}{log.userAgent && <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</p><p className="mt-1 break-all text-xs text-slate-400">{log.userAgent}</p></div>}</div></div></details>)}</div>}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3"><p className="text-xs text-slate-500">Showing {visibleLogs.length} of {data?.meta.total ?? 0} records</p><div className="flex gap-2"><button disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button disabled={page >= (data?.meta.totalPages ?? 1) || isFetching} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
      </section>
      <p className="text-xs leading-relaxed text-slate-500">Audit entries depend on the server operation writing an audit record. The view displays recorded history and does not create missing records retroactively.</p>
    </div>
  </main>;
}
