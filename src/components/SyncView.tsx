import { AlertTriangle, Check, Cloud, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { QueuedSale } from "../services/offlineSalesQueue";

export function SyncView({ connected, loading, lastSync, onSync, queuedSales }: {
  connected: boolean;
  loading: boolean;
  lastSync: Date | null;
  onSync: () => void;
  queuedSales: QueuedSale[];
}) {
  return <main className="flex-1 overflow-y-auto p-7">
    <header className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Data status</p><h1 className="mt-2 text-3xl font-black text-white">Sync</h1><p className="mt-1 text-sm text-slate-400">Refresh workspace data and retry sales waiting on the server.</p></header>
    <section className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-start gap-4"><span className={`rounded-xl p-3 ${connected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{connected ? <Cloud className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}</span><div className="flex-1"><h2 className="font-bold text-white">{connected ? "Server reachable" : "Server unavailable"}</h2><p className="mt-1 text-sm text-slate-400">{connected ? "Workspace data is served by kanitt_server." : "Check the API address and network connection, then retry."}</p></div><span className="flex items-center gap-1.5 text-xs text-slate-400">{connected ? <Wifi className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-amber-300" />}{connected ? "Online" : "Offline"}</span></div>
      <div className="my-6 border-t border-slate-800"/><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs text-slate-500">Last refresh</p><p className="mt-1 text-sm font-semibold text-slate-200">{lastSync ? lastSync.toLocaleString() : "Not refreshed this session"}</p></div><button onClick={onSync} disabled={loading} className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Syncing…" : "Sync now"}</button></div>
    </section>
    <section className="mt-5 max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6"><div className="flex items-center justify-between"><div><h2 className="font-bold text-white">Offline sales</h2><p className="mt-1 text-sm text-slate-400">Queued sales retry automatically after reconnection or when you sync.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${queuedSales.length ? "bg-amber-400/10 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`}>{queuedSales.length} waiting</span></div>
      {queuedSales.length === 0 ? <p className="mt-5 flex items-center gap-2 text-sm text-emerald-200"><Check className="h-4 w-4"/>No sales are waiting to sync.</p> : <div className="mt-5 space-y-3">{queuedSales.map((sale) => <article key={sale.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-100">{sale.payload.orderNumber}</p><p className="mt-1 text-xs text-slate-500">Queued {new Date(sale.queuedAt).toLocaleString()} · {sale.payload.grandTotal.toLocaleString()} {sale.payload.currencyCode}</p></div><span className="text-xs text-amber-200">{sale.error ? "Needs attention" : "Waiting"}</span></div>{sale.error && <p className="mt-3 flex gap-2 text-sm text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{sale.error}</p>}</article>)}</div>}
      <p className="mt-5 text-xs leading-5 text-slate-500">Sales are accepted offline only after an online price quote and an open register session. If pricing changed while disconnected, the server holds the sale here for review. Keep its register session open until it syncs.</p>
    </section>
  </main>;
}
