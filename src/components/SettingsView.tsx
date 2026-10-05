import { Server, ShieldCheck, Wifi, WifiOff } from "lucide-react";

export function SettingsView({ connected, storeName }: { connected: boolean; storeName?: string }) {
  const configuredApi = import.meta.env.VITE_API_URL || "https://pos.oasislab.de5.net";
  return (
    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white">Store Settings</h2>
        <p className="text-xs text-slate-400 mt-1">Desktop connection and workspace details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Active Workspace</h3>
          <div className="flex items-center gap-3 rounded-xl bg-slate-950 p-4"><ShieldCheck className="h-5 w-5 text-sky-400" /><div><p className="text-xs text-slate-500">Selected store</p><p className="text-sm font-semibold text-white">{storeName || "No store selected"}</p></div></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Products, stores, sessions and sales are loaded from your authenticated Kanitt workspace.</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Server Connection</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-slate-300"><Server className="h-4 w-4" /> kanitt_server</span>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${connected ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-300"}`}>{connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{connected ? "Connected" : "Unavailable"}</span>
            </div>
            <div className="rounded-xl bg-slate-950 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">API origin</p><p className="mt-1 break-all font-mono text-xs text-slate-300">{configuredApi}</p></div>
            <p className="text-[11px] leading-5 text-slate-500">Change this with VITE_API_URL in kanitt_win/.env. The app adds /api automatically.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
