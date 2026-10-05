import { CheckCircle2 } from "lucide-react";

export function SettingsView() {
  return (
    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white">Store Settings</h2>
        <p className="text-xs text-slate-400 mt-1">Configuration, receipt, tax, and sync preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
        {/* Store Info Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Store Information</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Store Name</label>
              <input
                defaultValue="Main Store (Yangon)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Address</label>
              <input
                defaultValue="No. 42, Bogyoke Road, Latha Township"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Phone</label>
              <input
                defaultValue="+95 9 123 456 789"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Tax & Currency Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Tax & Currency</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Currency Symbol</label>
              <input
                defaultValue="MMK"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Tax Rate (%)</label>
              <input
                type="number"
                defaultValue="5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Session Mode</label>
              <select
                defaultValue="individual"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 appearance-none"
              >
                <option value="individual">Individual (per cashier)</option>
                <option value="shared">Shared (one session)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Receipt Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Receipt Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Header Text</label>
              <input
                defaultValue="Thank you for visiting KANITT!"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Footer Text</label>
              <input
                defaultValue="Refunds within 7 days with receipt"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-300">Auto-print on checkout</span>
              <div className="w-10 h-5 rounded-full bg-sky-500 relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* Sync Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Sync & Data</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Cloud Sync</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Last Sync</span>
              <span className="text-xs text-slate-400 font-medium">2 minutes ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Pending Queue</span>
              <span className="text-xs text-white font-bold">0 items</span>
            </div>
            <button className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Force Sync Now
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
