import { Activity, BadgePercent, BarChart3, BriefcaseBusiness, Boxes, Cloud, ClipboardList, Clock3, LayoutDashboard, LogOut, ReceiptText, RefreshCw, Settings2, ShieldCheck, ShoppingBag, Store as StoreIcon, User, Users, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import { Store as ApiStore } from "../store/apiSlice";
import { decodeAuthToken } from "../services/secureStorage";

type Tab = "dashboard" | "pos" | "orders" | "inventory" | "sessions" | "manage" | "erp" | "reports" | "commerce" | "activity" | "sync" | "settings" | "admin";
interface SidebarProps {
  activeTab: Tab; setActiveTab: (tab: Tab) => void; isConnected: boolean; isLoading: boolean;
  syncWithServer: () => void; stores: ApiStore[]; selectedStore: ApiStore | null;
  setSelectedStore: (store: ApiStore) => void; storeError: boolean; onLogout: () => void;
}

const groups: { name: string; items: { id: Tab; label: string; icon: LucideIcon; roles?: string[] }[] }[] = [
  { name: "Workspace", items: [{ id: "dashboard", label: "Overview", icon: LayoutDashboard }, { id: "pos", label: "Point of sale", icon: ShoppingBag }] },
  { name: "Sales & stock", items: [{ id: "orders", label: "Orders & returns", icon: ReceiptText }, { id: "inventory", label: "Inventory", icon: Boxes }, { id: "sessions", label: "Register sessions", icon: Clock3 }] },
  { name: "Operations", items: [{ id: "reports", label: "Reports & analytics", icon: BarChart3 }, { id: "erp", label: "ERP operations", icon: BriefcaseBusiness }, { id: "commerce", label: "Pricing & finance", icon: BadgePercent }, { id: "manage", label: "Catalog & people", icon: Users, roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"] }, { id: "activity", label: "Audit trail", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"] }] },
  { name: "System", items: [{ id: "admin", label: "Admin workspace", icon: ShieldCheck, roles: ["ADMIN", "SUPER_ADMIN"] }, { id: "sync", label: "Sync status", icon: Cloud }, { id: "settings", label: "Settings", icon: Settings2 }] },
];

export function Sidebar({ activeTab, setActiveTab, isConnected, isLoading, syncWithServer, stores, selectedStore, setSelectedStore, storeError, onLogout }: SidebarProps) {
  const currentUser = decodeAuthToken();
  const userRole = (currentUser?.role || "CASHIER").toUpperCase();

  return <aside className="flex h-screen w-16 shrink-0 flex-col border-r border-slate-800/80 bg-[#0b1220] px-2 py-3 md:w-52 lg:w-56 xl:w-64 md:px-3">
    <div className="mb-4 flex h-12 items-center gap-3 px-1 md:px-2">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-cyan-400 to-sky-600 text-base font-black text-slate-950 shadow-lg shadow-sky-500/20">K</div>
      <div className="hidden min-w-0 flex-1 md:block"><h1 className="truncate text-sm font-extrabold tracking-wide text-white">KANITT</h1><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Retail workspace</p></div>
      <button onClick={syncWithServer} disabled={isLoading} title="Refresh workspace data" className="hidden rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-40 md:block"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-sky-300" : ""}`} /></button>
    </div>

    {/* Logged in User Profile Info Card */}
    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 md:p-2.5">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-300"><User className="h-4 w-4" /></div>
        <div className="hidden min-w-0 flex-1 md:block">
          <p className="truncate text-xs font-bold text-slate-100">{currentUser?.email || "Signed in"}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${userRole.includes("ADMIN") ? "bg-emerald-400" : userRole === "MANAGER" ? "bg-amber-400" : "bg-sky-400"}`} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">{userRole}</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 p-1.5 md:p-2">
      <div className="flex items-center justify-center gap-2 md:justify-start"><span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400"}`} /><span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-500 md:block">{isConnected ? "Server connected" : "Offline mode"}</span><span className="ml-auto hidden text-[10px] text-slate-600 md:block">{isConnected ? "LIVE" : "LOCAL"}</span></div>
      <div className="mt-1.5 hidden items-center gap-2 border-t border-slate-800 pt-1.5 md:flex"><StoreIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />{stores.length ? <select aria-label="Active store" value={selectedStore?.id || ""} onChange={(event) => { const store = stores.find((candidate) => candidate.id === event.target.value); if (store) setSelectedStore(store); }} className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-200 outline-none">{stores.map((store) => <option key={store.id} value={store.id} className="bg-slate-900">{store.name}</option>)}</select> : <span className="truncate text-xs text-slate-500">{storeError ? "Stores unavailable" : "No stores"}</span>}</div>
    </div>

    <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2" aria-label="Main navigation">{groups.map((group) => {
      const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(userRole));
      if (visibleItems.length === 0) return null;
      return <div key={group.name}><p className="mb-1 hidden px-2.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-600 md:block">{group.name}</p><div className="space-y-0.5">{visibleItems.map(({ id, label, icon: Icon }) => { const active = activeTab === id; return <button key={id} type="button" title={label} aria-current={active ? "page" : undefined} onClick={() => setActiveTab(id)} className={`group relative flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-semibold transition-all md:justify-start md:px-2.5 ${active ? "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-300/15" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"}`}><span className={`absolute bottom-2 left-0 top-2 hidden w-[3px] rounded-r-full bg-sky-300 md:block ${active ? "opacity-100" : "opacity-0"}`} /><Icon className={`h-4 w-4 shrink-0 ${active ? "text-sky-300" : "text-slate-500 group-hover:text-slate-300"}`} /><span className="hidden flex-1 truncate md:block">{label}</span>{id === "activity" && <span className="hidden h-1.5 w-1.5 rounded-full bg-violet-400 md:block" />}</button>; })}</div></div>;
    })}</nav>

    <div className="border-t border-slate-800 pt-2"><div className="mb-1.5 flex justify-center px-2 text-[10px] text-slate-500 md:hidden">{isConnected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-400" />}</div><button onClick={onLogout} title="Sign out" className="flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 md:justify-start md:px-2.5"><LogOut className="h-4 w-4 shrink-0" /><span className="hidden truncate md:block">Sign out ({userRole})</span></button><div className="mt-1.5 hidden items-center gap-2 px-2.5 text-[9px] text-slate-600 md:flex"><Activity className="h-3 w-3" />Desktop · Kanitt POS</div></div>
  </aside>;
}
