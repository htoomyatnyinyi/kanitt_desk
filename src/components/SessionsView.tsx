import { FormEvent, useMemo, useState } from "react";
import { Check, Clock3, DoorOpen, Store as StoreIcon, X } from "lucide-react";
import { Session } from "../store/apiSlice";

interface SessionsViewProps {
  sessions?: Session[]; storeId?: string; storeName?: string;
  onOpen: (storeId: string, openingBalance: number) => Promise<unknown>;
  onClose: (sessionId: string, closingBalance: number) => Promise<unknown>;
}
const money = (value: number) => `${Number(value || 0).toLocaleString()} MMK`;
const errText = (error: unknown) => { const value = error as { data?: { message?: string }; message?: string }; return value.data?.message || value.message || "The register operation failed."; };

export function SessionsView({ sessions = [], storeId, storeName, onOpen, onClose }: SessionsViewProps) {
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storeSessions = useMemo(() => sessions.filter((session) => !storeId || session.storeId === storeId), [sessions, storeId]);
  const activeSession = storeSessions.find((session) => session.status === "OPEN");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const amount = Number(balance);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid cash amount of zero or more.");
      if (dialog === "open") {
        if (!storeId) throw new Error("Select a store before opening the register.");
        await onOpen(storeId, amount); setNotice(`Register opened for ${storeName || "the selected store"}.`);
      } else {
        if (!sessionId) throw new Error("Choose an open register session.");
        await onClose(sessionId, amount); setNotice("Register closed and cash count saved.");
      }
      setDialog(null); setBalance("");
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  };

  return <main className="flex-1 overflow-y-auto bg-[#0b1220] p-5 text-slate-100 lg:p-8"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">Cash control</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white">Register sessions</h1><p className="mt-2 text-sm text-slate-400">Start each shift with a cash float, then close it with the counted drawer balance.</p></div><div className="flex gap-2">{activeSession ? <button onClick={() => { setSessionId(activeSession.id); setBalance(""); setError(""); setDialog("close"); }} className="inline-flex items-center gap-2 rounded-xl bg-rose-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-rose-300"><X className="h-4 w-4" />Close register</button> : <button disabled={!storeId} onClick={() => { setBalance(""); setError(""); setDialog("open"); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-200 disabled:opacity-40"><DoorOpen className="h-4 w-4" />Open register</button>}</div></header>
    {notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</p>}
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Selected location</p><div className="mt-2 flex items-center gap-2 text-sm font-bold text-white"><StoreIcon className="h-4 w-4 text-sky-300" />{storeName || "Select a store"}</div></article><article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Current register</p><div className="mt-2 flex items-center gap-2 text-sm font-bold text-white"><span className={`h-2 w-2 rounded-full ${activeSession ? "bg-emerald-400" : "bg-slate-600"}`} />{activeSession ? "Open" : "Closed"}</div></article><article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Shift history</p><p className="mt-2 text-sm font-bold text-white">{storeSessions.length} sessions</p></article></section>
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="font-bold text-white">Recent shifts</h2><p className="mt-1 text-xs text-slate-500">{storeName ? `History for ${storeName}` : "All available store sessions"}</p></div><Clock3 className="h-4 w-4 text-slate-500" /></div>{!storeSessions.length ? <div className="p-12 text-center text-sm text-slate-500">No register sessions found. Open the register to begin a shift.</div> : <div className="divide-y divide-slate-800/80">{storeSessions.map((session) => <article key={session.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center"><div><p className="text-sm font-bold text-white">{session.cashierName || "Staff member"}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{session.id.slice(0, 12)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Opened</p><p className="mt-1 text-xs text-slate-300">{new Date(session.openedAt).toLocaleString()}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Opening float</p><p className="mt-1 text-xs font-semibold text-slate-200">{money(session.openingBalance)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Closing count</p><p className="mt-1 text-xs font-semibold text-slate-200">{session.closingBalance == null ? "—" : money(session.closingBalance)}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold ${session.status === "OPEN" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{session.status}</span></article>)}</div>}</section>
    <p className="text-xs leading-5 text-slate-500">Cash totals are recorded by the server during checkout. Enter the physical drawer count when closing so the server can calculate the shift discrepancy.</p>
  </div>
  {dialog && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#101a2b] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold text-white">{dialog === "open" ? "Open register" : "Close register"}</h2><p className="mt-1 text-xs text-slate-500">{dialog === "open" ? `Opening float · ${storeName || "selected store"}` : "Count the physical cash in the drawer."}</p></div><button type="button" onClick={() => setDialog(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white">×</button></div><label className="block text-xs font-semibold text-slate-400">{dialog === "open" ? "Opening cash (MMK)" : "Closing cash count (MMK)"}<input autoFocus required type="number" min="0" step="1" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-400" /></label>{error && <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDialog(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">Cancel</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{busy ? "Saving…" : <><Check className="h-4 w-4" />{dialog === "open" ? "Start shift" : "Close shift"}</>}</button></div></form></div>}
  </main>;
}
