import { Plus, Store as StoreIcon } from "lucide-react";
import { Session } from "../store/apiSlice";

const MOCK_SESSIONS = [
  {
    id: "#S-1092",
    status: "OPEN",
    store: "Main Store (Yangon)",
    cashier: "Admin",
    openedAt: "Today 08:30 AM",
    closedAt: null,
    opening: 50000,
    closing: null,
    expected: null,
    orders: 24,
    sales: 312500,
  },
  {
    id: "#S-1091",
    status: "CLOSED",
    store: "Main Store (Yangon)",
    cashier: "Ma Hnin",
    openedAt: "Yesterday 08:15 AM",
    closedAt: "Yesterday 06:45 PM",
    opening: 50000,
    closing: 410000,
    expected: 405000,
    orders: 38,
    sales: 485000,
  },
  {
    id: "#S-1090",
    status: "CLOSED",
    store: "Branch 2 (MDY)",
    cashier: "Admin",
    openedAt: "Oct 3, 09:00 AM",
    closedAt: "Oct 3, 07:00 PM",
    opening: 30000,
    closing: 295000,
    expected: 298000,
    orders: 31,
    sales: 380000,
  },
];

interface SessionsViewProps {
  sessions?: Session[];
}

export function SessionsView({ sessions }: SessionsViewProps) {
  const displaySessions =
    sessions && sessions.length > 0
      ? sessions.map((s) => ({
          id: s.id.slice(0, 8),
          status: s.status,
          store: s.store?.name || "—",
          cashier: s.cashierName || "Admin",
          openedAt: new Date(s.openedAt).toLocaleString(),
          closedAt: s.closedAt ? new Date(s.closedAt).toLocaleString() : null,
          opening: s.openingBalance,
          closing: s.closingBalance ?? null,
          expected: null,
          orders: 0,
          sales: 0,
        }))
      : MOCK_SESSIONS;

  return (
    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">Session Logs</h2>
          <p className="text-xs text-slate-400 mt-1">Cash register open / close history & discrepancies</p>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Open New Session
        </button>
      </div>

      <div className="space-y-3">
        {displaySessions.map((session) => {
          const diff =
            session.closing != null && session.expected != null
              ? session.closing - session.expected
              : null;
          return (
            <div
              key={session.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">{session.id}</span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      session.status === "OPEN"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-700/50 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StoreIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs text-sky-400 font-medium">{session.store}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Cashier</span>
                  <span className="text-slate-200 font-medium">{session.cashier}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Opened</span>
                  <span className="text-slate-200 font-medium">{session.openedAt}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Orders</span>
                  <span className="text-slate-200 font-bold">{session.orders}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Total Sales</span>
                  <span className="text-white font-bold">{session.sales.toLocaleString()} MMK</span>
                </div>
              </div>

              {session.status === "CLOSED" && diff !== null && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-slate-500">Opening:</span>
                    <span className="text-white font-bold ml-1">{session.opening.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Closing:</span>
                    <span className="text-white font-bold ml-1">{session.closing?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Expected:</span>
                    <span className="text-sky-400 font-bold ml-1">{session.expected?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Variance:</span>
                    <span className={`font-bold ml-1 ${diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {diff >= 0 ? "+" : ""}{diff.toLocaleString()} MMK
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
