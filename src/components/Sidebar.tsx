import { ShoppingBag, Package, Clock, Settings, Store as StoreIcon, Wifi, WifiOff, RefreshCw, LogOut } from "lucide-react";
import { Store as ApiStore } from "../store/apiSlice";

interface SidebarProps {
  activeTab: "pos" | "inventory" | "sessions" | "settings";
  setActiveTab: (tab: "pos" | "inventory" | "sessions" | "settings") => void;
  isConnected: boolean;
  isLoading: boolean;
  syncWithServer: () => void;
  stores: ApiStore[];
  selectedStore: ApiStore | null;
  setSelectedStore: (store: ApiStore) => void;
  onLogout: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  isConnected,
  isLoading,
  syncWithServer,
  stores,
  selectedStore,
  setSelectedStore,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="w-20 lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4">
      <div>
        {/* App Brand Header */}
        <div className="flex items-center justify-between px-2 py-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 font-bold text-xl">
              K
            </div>
            <div className="hidden lg:block">
              <h1 className="font-bold text-lg text-white leading-tight">KANITT POS</h1>
              <p className="text-xs text-sky-400 font-medium">Desktop Pro v2.1</p>
            </div>
          </div>

          {/* Sync Refresh Button */}
          <button
            onClick={syncWithServer}
            disabled={isLoading}
            title="Sync with Server"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          <button
            onClick={() => setActiveTab("pos")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium transition-all ${
              activeTab === "pos"
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="hidden lg:inline">Point of Sale</span>
          </button>

          <button
            onClick={() => setActiveTab("inventory")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium transition-all ${
              activeTab === "inventory"
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="hidden lg:inline">Products & Stock</span>
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium transition-all ${
              activeTab === "sessions"
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="hidden lg:inline">Session Logs</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium transition-all ${
              activeTab === "settings"
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="hidden lg:inline">Store Settings</span>
          </button>
        </nav>
      </div>

      {/* Server Connection & Store Badge Footer */}
      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 hidden lg:block space-y-2">
        {/* Server Connection Indicator */}
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-400 flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            kanitt_server
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              isConnected
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
            }`}
          >
            {isConnected ? "Connected" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
          <StoreIcon className="w-3.5 h-3.5 text-sky-400" />
          {stores.length > 0 ? (
            <select
              value={selectedStore?.id || ""}
              onChange={(e) => {
                const found = stores.find((s) => s.id === e.target.value);
                if (found) setSelectedStore(found);
              }}
              className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer w-full"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-slate-300 truncate">Main Store (Yangon)</span>
          )}
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full mt-2 px-2 py-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all text-xs font-semibold"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
