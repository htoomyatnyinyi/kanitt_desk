import { useEffect, useMemo, useState } from "react";
import {
BadgePercent,
Bell,
BarChart3,
BriefcaseBusiness,
Boxes,
ChevronLeft,
ChevronRight,
Cloud,
ClipboardList,
Clock3,
LayoutDashboard,
LogOut,
MessageCircle,
ReceiptText,
RefreshCw,
Search,
ClipboardCheck,
Settings2,
ShieldCheck,
ShoppingBag,
Store as StoreIcon,
User,
Users,
Menu,
X,
AlertTriangle,
Printer,
Loader2,
type LucideIcon,
} from "lucide-react";
import { Store as ApiStore } from "../store/apiSlice";
import { decodeAuthToken } from "../services/secureStorage";
import { apiService } from "../services/api";
import {
useGetNotificationUnreadCountQuery,
useGetStockRequestsQuery,
useGetSessionsQuery,
useGetStoreSettingsQuery,
useCloseSessionMutation,
useGetOrdersQuery,
} from "../store/apiSlice";
import { useSystemBack } from "../hooks/SystemBackProvider";

export type Tab =
| "dashboard"
| "pos"
| "orders"
| "inventory"
| "requests"
| "notifications"
| "chat"
| "sessions"
| "manage"
| "erp"
| "reports"
| "commerce"
| "activity"
| "sync"
| "settings"
| "admin";

export function canAccessTab(
tab: Tab,
role: string,
permissions: string[] = [],
) {
if (role === "ACCOUNTANT") {
return [
"dashboard",
"orders",
"inventory",
"reports",
"sync",
"chat",
].includes(tab);
}
if (tab === "erp" && role === "MANAGER") {
return permissions.includes("MANAGE_INVENTORY");
}
const roleAllowed: Partial<Record<Tab, string[]>> = {
dashboard: ["ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT", "SUPER_ADMIN"],
erp: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
commerce: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
settings: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
admin: ["ADMIN", "SUPER_ADMIN"],
};
const permissionAllowed: Partial<Record<Tab, string[]>> = {
dashboard: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
reports: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
manage: ["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES"],
activity: ["VIEW_AUDIT_LOGS"],
};
if (permissionAllowed[tab])
return permissions.some((permission) =>
permissionAllowed[tab]!.includes(permission),
);
if (roleAllowed[tab]) return roleAllowed[tab]!.includes(role);
return true;
}

interface SidebarProps {
activeTab: Tab;
setActiveTab: (tab: Tab) => void;
isConnected: boolean;
isLoading: boolean;
syncWithServer: () => void;
stores: ApiStore[];
selectedStore: ApiStore | null;
setSelectedStore: (store: ApiStore) => void;
storeError: boolean;
hasQueuedSales?: boolean;
onLogout: () => void;
}

const groups: {
name: string;
items: {
id: Tab;
label: string;
icon: LucideIcon;
roles?: string[];
permissions?: string[];
}[];
}[] = [
{
name: "Workspace",
items: [
{
id: "dashboard",
label: "Overview",
icon: LayoutDashboard,
permissions: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
},
{ id: "pos", label: "Point of sale", icon: ShoppingBag },
{ id: "sessions", label: "Register sessions", icon: Clock3 },
],
},
{
name: "Sales & stock",
items: [
{ id: "orders", label: "Orders & returns", icon: ReceiptText },
{ id: "inventory", label: "Inventory", icon: Boxes },
{ id: "requests", label: "Stock requests", icon: ClipboardCheck },
],
},
{
name: "Operations",
items: [
{
id: "reports",
label: "Reports & analytics",
icon: BarChart3,
permissions: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
},
{
id: "erp",
label: "ERP operations",
icon: BriefcaseBusiness,
roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
},
{
id: "commerce",
label: "Configuration",
icon: BadgePercent,
roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
},
{
id: "manage",
label: "Manage",
icon: Users,
roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
permissions: ["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES"],
},
{
id: "activity",
label: "Audit trail",
icon: ClipboardList,
roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
permissions: ["VIEW_AUDIT_LOGS"],
},
{ id: "chat", label: "Store chat", icon: MessageCircle },
],
},
{
name: "System",
items: [
{
id: "admin",
label: "Admin workspace",
icon: ShieldCheck,
roles: ["ADMIN", "SUPER_ADMIN"],
},
{ id: "notifications", label: "Notifications", icon: Bell },
{ id: "sync", label: "Sync status", icon: Cloud },
{
id: "settings",
label: "Settings",
icon: Settings2,
roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
},
],
},
];

/_ ------------------------------------------------------------------ _/
/_ X-Report helpers _/
/_ ------------------------------------------------------------------ _/

interface XReportParams {
session: any;
storeName: string;
staffName: string;
staffRole?: string;
orders?: any[];
currencySymbol?: string;
}

const fmtMoney = (n: number, sym = "MMK") =>
`${Math.round(Number(n) || 0).toLocaleString()} ${sym}`;

function buildXReportHtml({
session,
storeName,
staffName,
staffRole,
orders = [],
currencySymbol = "MMK",
}: XReportParams): string {
const opening = Number(session?.openingBalance || 0);
const cashSales = Number(session?.cashSales || 0);
const cardSales = Number(session?.cardSales || 0);
const digitalSales = Number(session?.digitalSales || 0);
const totalSales = cashSales + cardSales + digitalSales;
const expected = opening + cashSales;
const orderCount = orders.length;
const generatedAt = new Date().toLocaleString();

const sessionIdShort = String(session?.id || "")
.slice(-8)
.toUpperCase();
const openedAt = session?.openedAt
? new Date(session.openedAt).toLocaleString()
: "—";

// Group order payment methods for footer summary
const paymentRows =
orders.length > 0
? orders
.slice(0, 40)
.map((o: any) => {
const num = o.orderNumber || String(o.id || "").slice(-8) || "Sale";
const time = new Date(
o.createdAt || Date.now(),
).toLocaleTimeString();
const method = String(
o.paymentMethod ||
(Array.isArray(o.paymentBreakdown) &&
o.paymentBreakdown[0]?.method) ||
"—",
).replace(/\_/g, " ");
const total = Number(o.grandTotal || 0);
return `<div class="row"><span>${num} · ${method} · ${time}</span><span>${fmtMoney(total, currencySymbol)}</span></div>`;
})
.join("")
: `<div class="row" style="opacity:0.5;"><span>No orders in this session yet</span><span>—</span></div>`;

return `<!doctype html>

<html>
  <head>
    <meta charset="utf-8" />
    <title>X-Report · ${storeName}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 18px; max-width: 400px; margin: 0 auto; color: #111; }
      .center { text-align: center; }
      .brand { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
      .title { font-size: 15px; font-weight: 900; margin: 8px 0; letter-spacing: 3px; }
      .subtitle { font-size: 10px; color: #555; margin-top: 2px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .thin { border-top: 1px dotted #444; margin: 5px 0; }
      .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
      .row span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bold { font-weight: 700; }
      .big { font-size: 16px; font-weight: 900; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #fff4cc; border: 1px solid #b58900; font-size: 9px; font-weight: 900; letter-spacing: 1.5px; }
      .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #333; margin-top: 8px; }
      .total-box { border: 2px solid #000; padding: 6px 8px; margin: 8px 0; }
      .total-box .label { font-size: 11px; letter-spacing: 1px; }
      .total-box .value { font-size: 18px; font-weight: 900; }
      .footer { margin-top: 14px; font-size: 10px; color: #666; text-align: center; }
      @media print {
        body { padding: 0; }
        .no-print { display: none !important; }
      }
      .no-print { text-align: center; margin-bottom: 12px; }
      .no-print button {
        font-family: inherit; font-size: 12px; font-weight: 700;
        padding: 8px 16px; border-radius: 8px; border: 1px solid #333;
        background: #111; color: #fff; cursor: pointer; margin: 0 4px;
      }
      .no-print button.ghost { background: #fff; color: #111; }
    </style>
  </head>
  <body>
    <div class="no-print">
      <button onclick="window.print()">Print X-Report</button>
      <button class="ghost" onclick="window.close()">Close</button>
    </div>

    <div class="center">
      <div class="brand">${storeName}</div>
      <div class="divider"></div>
      <div class="title">X-REPORT</div>
      <div class="badge">MID-SHIFT · SESSION OPEN</div>
      <div class="subtitle">Interim snapshot · not end of shift</div>
    </div>

    <div class="thin"></div>
    <div class="row"><span>Session ID:</span><span>#${sessionIdShort}</span></div>
    <div class="row"><span>Cashier:</span><span>${staffName}</span></div>
    ${staffRole ? `<div class="row"><span>Role:</span><span>${staffRole}</span></div>` : ""}
    <div class="row"><span>Opened:</span><span>${openedAt}</span></div>
    <div class="row"><span>Generated:</span><span>${generatedAt}</span></div>

    <div class="divider"></div>
    <div class="section-title">Cash drawer</div>
    <div class="row"><span>Opening cash:</span><span>${fmtMoney(opening, currencySymbol)}</span></div>
    <div class="row"><span>+ Cash sales:</span><span>${fmtMoney(cashSales, currencySymbol)}</span></div>
    <div class="row bold"><span>= Expected in drawer:</span><span>${fmtMoney(expected, currencySymbol)}</span></div>

    <div class="divider"></div>
    <div class="section-title">Sales breakdown</div>
    <div class="row"><span>Card sales:</span><span>${fmtMoney(cardSales, currencySymbol)}</span></div>
    <div class="row"><span>Digital sales:</span><span>${fmtMoney(digitalSales, currencySymbol)}</span></div>
    <div class="total-box">
      <div class="label">TOTAL SALES</div>
      <div class="value">${fmtMoney(totalSales, currencySymbol)}</div>
    </div>

    <div class="divider"></div>
    <div class="row"><span>Transactions:</span><span>${orderCount}</span></div>
    <div class="thin"></div>
    <div class="section-title">Recent orders</div>
    ${paymentRows}

    <div class="divider"></div>
    <div class="footer">
      <div>— END OF X-REPORT —</div>
      <div style="margin-top:4px;">Generated by Kanitt POS</div>
    </div>

    <script>
      // Auto-focus so keyboard shortcuts work
      window.focus();
    </script>

  </body>
</html>`;
}

function openXReport(params: XReportParams): boolean {
try {
const html = buildXReportHtml(params);
const win = window.open(
"",
"\_blank",
"width=440,height=760,menubar=no,toolbar=no,location=no",
);
if (!win) {
// Popup blocked — fallback to blob URL
const blob = new Blob([html], { type: "text/html;charset=utf-8" });
const url = URL.createObjectURL(blob);
const fallback = window.open(url, "\_blank");
if (!fallback) {
// Last resort — download as HTML file
const a = document.createElement("a");
a.href = url;
a.download = `x-report-${Date.now()}.html`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 60000);
return false;
}
setTimeout(() => URL.revokeObjectURL(url), 60000);
return true;
}
win.document.open();
win.document.write(html);
win.document.close();
// Give the browser a moment, then auto-trigger print
setTimeout(() => {
try {
win.focus();
win.print();
} catch {
/_ user can click Print button _/
}
}, 400);
return true;
} catch (error) {
console.error("Failed to open X-report:", error);
return false;
}
}

/_ ------------------------------------------------------------------ _/
/_ Logout confirmation modal _/
/_ ------------------------------------------------------------------ _/

interface LogoutConfirmModalProps {
open: boolean;
activeSession: any | null;
canCloseSession: boolean;
isProcessing: boolean;
error: string | null;
onCancel: () => void;
onCloseSessionAndLogout: () => void;
onForceLogout: () => void;
}

function LogoutConfirmModal({
open,
activeSession,
canCloseSession,
isProcessing,
error,
onCancel,
onCloseSessionAndLogout,
onForceLogout,
}: LogoutConfirmModalProps) {
useSystemBack(
open,
() => {
if (!isProcessing) onCancel();
},
100,
);

if (!open) return null;

const hasSession = !!activeSession;
const sessionId = activeSession?.id
? `#${String(activeSession.id).slice(-8).toUpperCase()}`
: "";
const opening = Number(activeSession?.openingBalance || 0);
const cashSales = Number(activeSession?.cashSales || 0);
const expected = opening + cashSales;

return (
<div
className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
onMouseDown={(e) => {
if (e.target === e.currentTarget && !isProcessing) onCancel();
}}
role="presentation" >
<div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
      >
{/_ Header _/}
<div className="flex items-start gap-3 border-b border-slate-800 p-5">
<span
className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              hasSession
                ? "bg-amber-500/15 text-amber-300"
                : "bg-rose-500/15 text-rose-300"
            }`} >
{hasSession ? (
<AlertTriangle className="h-5 w-5" />
) : (
<LogOut className="h-5 w-5" />
)}
</span>
<div className="min-w-0 flex-1">
<h3 id="logout-title" className="text-base font-black text-white">
{hasSession ? "Active session is open" : "Sign out?"}
</h3>
<p className="mt-1 text-xs text-slate-400">
{hasSession
? canCloseSession
? "You have an open register session. Close it before signing out to keep your cash report accurate."
: "This shared register was opened by another staff member. Signing out will leave that session open."
: "You will be signed out of the current workspace. Any unsaved changes will be lost."}
</p>
</div>
</div>

        {/* Body */}
        <div className="space-y-3 p-5">
          {hasSession && canCloseSession && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Session
                </span>
                <span className="font-mono text-[10px] font-bold text-amber-200">
                  {sessionId}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Opening cash</span>
                  <span className="font-mono font-bold text-slate-200">
                    {opening.toLocaleString()} MMK
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Cash sales</span>
                  <span className="font-mono font-bold text-emerald-300">
                    +{cashSales.toLocaleString()} MMK
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-amber-500/20 pt-1.5 text-xs">
                  <span className="text-slate-300">Expected in drawer</span>
                  <span className="font-mono text-sm font-black text-amber-200">
                    {expected.toLocaleString()} MMK
                  </span>
                </div>
              </div>
            </div>
          )}

          {hasSession && (
            <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-[11px] text-sky-200">
              <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Closing your session will print an{" "}
                <strong className="text-sky-100">X-Report</strong> for your
                current shift. Keep it for reference.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] font-semibold text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-800 bg-slate-950/60 p-4 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>

          {hasSession && canCloseSession ? (
            <>
              <button
                type="button"
                onClick={onForceLogout}
                disabled={isProcessing}
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
              >
                Force logout
              </button>
              <button
                type="button"
                onClick={onCloseSessionAndLogout}
                disabled={isProcessing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Closing & printing…
                  </>
                ) : (
                  <>
                    <LogOut className="h-3.5 w-3.5" />
                    Close session & logout
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onForceLogout}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-rose-400 disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Signing out…
                </>
              ) : (
                <>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>

);
}

/_ ------------------------------------------------------------------ _/
/_ Sidebar _/
/_ ------------------------------------------------------------------ _/

export function Sidebar({
activeTab,
setActiveTab,
isConnected,
isLoading,
syncWithServer,
stores,
selectedStore,
setSelectedStore,
storeError,
hasQueuedSales = false,
onLogout,
}: SidebarProps) {
const [collapsed, setCollapsed] = useState(false);
const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
const [mobileMoreQuery, setMobileMoreQuery] = useState("");
useSystemBack(isMobileDrawerOpen, () => setIsMobileDrawerOpen(false), 10);

const currentUser = decodeAuthToken();
const userRole = (currentUser?.role || "CASHIER").toUpperCase();

const { data: visibleStockRequests = [] } = useGetStockRequestsQuery(
{
storeId: ["ADMIN", "SUPER_ADMIN"].includes(userRole)
? undefined
: selectedStore?.id,
},
{
pollingInterval: 15000,
skip:
(!selectedStore?.id && !["ADMIN", "SUPER_ADMIN"].includes(userRole)) ||
userRole === "ACCOUNTANT",
},
);

const { data: unreadNotifications = 0, refetch: refreshUnreadNotifications } =
useGetNotificationUnreadCountQuery(undefined, { pollingInterval: 30000 });

const realtimeRoomId = selectedStore?.id || "tenant";

useEffect(() => {
return apiService.connectRealtime(
realtimeRoomId,
(event) => {
if (event.type === "notification.created")
void refreshUnreadNotifications();
},
() => {},
);
}, [realtimeRoomId, refreshUnreadNotifications]);

/_ ---------------------- logout + session flow ---------------- _/

const [logoutOpen, setLogoutOpen] = useState(false);
const [logoutProcessing, setLogoutProcessing] = useState(false);
const [logoutError, setLogoutError] = useState<string | null>(null);

// Active sessions for current store
const { data: allSessions = [], refetch: refetchSessions } =
useGetSessionsQuery(
{ storeId: selectedStore?.id },
{
skip: !selectedStore?.id,
pollingInterval: 30000,
},
);

const { data: storeSettings = [] } = useGetStoreSettingsQuery(
{ storeId: selectedStore?.id },
{ skip: !selectedStore?.id },
);
const registerSessionMode =
String(
(storeSettings as any[]).find(
(setting) => setting.settingKey === "register_session_mode",
)?.settingValue ?? "SHARED",
).toUpperCase() === "INDIVIDUAL"
? "INDIVIDUAL"
: "SHARED";
const isAdministrator = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

const activeSession = useMemo(
() =>
(allSessions as any[]).find(
(session) =>
String(session?.status || "").toUpperCase() === "OPEN" &&
(registerSessionMode === "SHARED" ||
session.userId === currentUser?.id),
) || null,
[allSessions, registerSessionMode, currentUser?.id],
);
const canCloseActiveSession = Boolean(
activeSession &&
(isAdministrator || activeSession.userId === currentUser?.id),
);

// Recent orders (used to build X-report)
const { data: allOrders = [] } = useGetOrdersQuery(
{ storeId: selectedStore?.id },
{ skip: !selectedStore?.id || !logoutOpen },
);

const [closeSession] = useCloseSessionMutation();

const sessionOrders = useMemo(() => {
if (!activeSession) return [];
return (allOrders as any[]).filter(
(o) =>
o.sessionId === activeSession.id || o.session_id === activeSession.id,
);
}, [allOrders, activeSession]);

const openLogoutModal = () => {
setLogoutError(null);
setLogoutProcessing(false);
// Refresh sessions right before opening — so we don't miss a new one
void refetchSessions();
setLogoutOpen(true);
};

const closeLogoutModal = () => {
if (logoutProcessing) return;
setLogoutOpen(false);
setLogoutError(null);
};

const handleCloseSessionAndLogout = async () => {
if (!activeSession || !canCloseActiveSession) {
handleForceLogout();
return;
}
if (hasQueuedSales) {
setLogoutError(
"Sync offline sales before closing this register session. You can sign out and sync later.",
);
return;
}
setLogoutProcessing(true);
setLogoutError(null);

    // Compute totals from orders for a fresh, accurate X-report
    const counted = sessionOrders.filter((o: any) => {
      const status = String(o?.status || "").toUpperCase();
      const paymentStatus = String(o?.paymentStatus || "").toUpperCase();
      return (
        !["VOIDED", "CANCELLED", "REFUNDED"].includes(status) &&
        (status === "COMPLETED" || paymentStatus === "PAID")
      );
    });

    let cashSales = 0;
    for (const o of counted) {
      const breakdown = Array.isArray(o.paymentBreakdown)
        ? o.paymentBreakdown
        : [];
      if (breakdown.length) {
        for (const t of breakdown) {
          const m = String(t?.method || "DIGITAL").toUpperCase();
          const amt = Number(t?.amount || 0);
          if (m === "CASH") cashSales += amt;
        }
      } else {
        const m = String(o.paymentMethod || "DIGITAL").toUpperCase();
        const amt = Number(o.grandTotal || 0);
        if (m === "CASH") cashSales += amt;
      }
    }
    const opening = Number(activeSession.openingBalance || 0);
    const expected = opening + cashSales;

    try {
      await closeSession({
        sessionId: activeSession.id,
        closingBalance: expected, // mid-shift: assume exact = expected
      }).unwrap();
    } catch (err: any) {
      // Show error but still allow user to force logout
      setLogoutError(
        err?.data?.message ||
          "Could not close session. You can retry or force logout.",
      );
      setLogoutProcessing(false);
      return;
    }

    // Print X-report (non-blocking)
    openXReport({
      session: activeSession,
      storeName: selectedStore?.name || "Store",
      staffName: currentUser?.email || "User",
      staffRole: userRole,
      orders: sessionOrders,
      currencySymbol: "MMK",
    });

    // Small delay so the print window has a chance to open before nav
    setTimeout(() => {
      setLogoutProcessing(false);
      setLogoutOpen(false);
      onLogout();
    }, 600);

};

const handleForceLogout = () => {
setLogoutProcessing(true);
setLogoutError(null);
setTimeout(() => {
setLogoutProcessing(false);
setLogoutOpen(false);
onLogout();
}, 150);
};

/_ ------------------------------------------------------------ _/

const openStockRequestCount = visibleStockRequests.filter((request: any) =>
["PENDING", "ACKNOWLEDGED"].includes(request.status),
).length;

const isCompact = collapsed;

const mobileNavItems = [
{ id: "pos", label: "POS", icon: ShoppingBag },
{ id: "orders", label: "Orders", icon: ReceiptText },
{ id: "inventory", label: "Inventory", icon: Boxes },
{ id: "sessions", label: "Sessions", icon: Clock3 },
].filter((item) =>
canAccessTab(item.id as Tab, userRole, currentUser?.permissions || []),
);
const primaryMobileTabs = new Set(mobileNavItems.map((item) => item.id));
const mobileMoreGroups = groups
.map((group) => ({
...group,
items: group.items.filter(
(item) =>
!primaryMobileTabs.has(item.id) &&
canAccessTab(item.id, userRole, currentUser?.permissions || []) &&
item.label
.toLowerCase()
.includes(mobileMoreQuery.trim().toLowerCase()),
),
}))
.filter((group) => group.items.length > 0);
const moreIsActive = !primaryMobileTabs.has(activeTab);
const activeMoreLabel = groups
.flatMap((group) => group.items)
.find((item) => item.id === activeTab)?.label;

const renderSidebarContent = (
isCompactMode: boolean,
isMobileDrawer = false,
) => (
<>
{/_ Header Logo & Collapse Toggle _/}
<div className="mb-4 flex h-10 items-center justify-between px-1">
<div className="flex items-center gap-2.5">
<img
            src="/kanitt-mark.svg"
            alt="Kanitt"
            className="h-9 w-9 shrink-0 rounded-xl shadow-lg shadow-sky-500/20"
          />
{!isCompactMode && (
<div className="min-w-0 flex-1">
<div className="flex flex-col">
<span className="text-sm font-bold text-white">
{selectedStore?.name}
</span>
</div>
</div>
)}
</div>
<div className="flex items-center gap-1">
{!isCompactMode && (
<button
              onClick={syncWithServer}
              disabled={isLoading}
              title="Refresh workspace data"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
            >
<RefreshCw
className={`h-4 w-4 ${isLoading ? "animate-spin text-sky-300" : ""}`}
/>
</button>
)}
{isMobileDrawer ? (
<button
onClick={() => setIsMobileDrawerOpen(false)}
className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white" >
<X className="h-4 w-4" />
</button>
) : (
<button
onClick={() => setCollapsed(!collapsed)}
title={
isCompactMode
? "Expand sidebar"
: "Collapse sidebar (Icon mode)"
}
className="hidden rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white md:flex items-center justify-center" >
{isCompactMode ? (
<ChevronRight className="h-4 w-4" />
) : (
<ChevronLeft className="h-4 w-4" />
)}
</button>
)}
</div>
</div>

      {/* User Profile Info Card */}
      <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 md:p-2">
        <div
          className="flex items-center gap-2"
          title={`${currentUser?.email || "User"} (${userRole})`}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-300">
            <User className="h-4 w-4" />
          </div>
          {!isCompactMode && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-100">
                {currentUser?.email || "Signed in"}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    userRole.includes("ADMIN")
                      ? "bg-emerald-400"
                      : userRole === "MANAGER"
                        ? "bg-amber-400"
                        : "bg-sky-400"
                  }`}
                />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
                  {userRole}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection & Store Selector */}
      <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 p-1.5 md:p-2">
        <div
          className={`flex items-center gap-2 ${
            isCompactMode ? "justify-center" : "justify-center md:justify-start"
          }`}
          title={isConnected ? "Server connected" : "Offline mode"}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected
                ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                : "bg-amber-400"
            }`}
          />
          {!isCompactMode && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {isConnected ? "Server connected" : "Offline mode"}
            </span>
          )}
          {!isCompactMode && (
            <span className="ml-auto text-[10px] text-slate-600">
              {isConnected ? "LIVE" : "LOCAL"}
            </span>
          )}
        </div>
        {!isCompactMode && (
          <div className="mt-1.5 flex items-center gap-2 border-t border-slate-800 pt-1.5">
            <StoreIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            {stores.length ? (
              userRole === "CASHIER" || stores.length === 1 ? (
                <span className="w-full truncate text-xs font-semibold text-slate-200">
                  {selectedStore?.name || stores[0]?.name}
                </span>
              ) : (
                <select
                  aria-label="Active store"
                  value={selectedStore?.id || ""}
                  onChange={(event) => {
                    const store = stores.find(
                      (candidate) => candidate.id === event.target.value,
                    );
                    if (store) setSelectedStore(store);
                  }}
                  className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-200 outline-none"
                >
                  {stores.map((store) => (
                    <option
                      key={store.id}
                      value={store.id}
                      className="bg-slate-900"
                    >
                      {store.name}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <span className="truncate text-xs text-slate-500">
                {storeError ? "Stores unavailable" : "No stores"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2"
        aria-label="Main navigation"
      >
        {groups.map((group) => {
          const userPermissions = currentUser?.permissions ?? [];
          const visibleItems = group.items.filter((item) =>
            canAccessTab(item.id, userRole, userPermissions),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.name}>
              {!isCompactMode && (
                <p className="mb-1 px-2.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-600">
                  {group.name}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={label}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setActiveTab(id);
                        if (isMobileDrawer) setIsMobileDrawerOpen(false);
                      }}
                      className={`group relative flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-semibold transition-all ${
                        isCompactMode ? "" : "md:justify-start md:px-2.5"
                      } ${
                        active
                          ? "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-300/15"
                          : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                      }`}
                    >
                      <span
                        className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-sky-300 ${
                          active ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active
                            ? "text-sky-300"
                            : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                      {!isCompactMode && (
                        <span className="flex-1 truncate">{label}</span>
                      )}
                      {id === "requests" && openStockRequestCount > 0 && (
                        <span
                          className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-950 ${
                            isCompactMode ? "absolute -right-1 -top-1" : ""
                          }`}
                          aria-label={`${openStockRequestCount} open stock requests`}
                        >
                          {openStockRequestCount > 99
                            ? "99+"
                            : openStockRequestCount}
                        </span>
                      )}
                      {id === "notifications" && unreadNotifications > 0 && (
                        <span
                          className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-sky-400 px-1 text-[9px] font-black text-slate-950 ${
                            isCompactMode ? "absolute -right-1 -top-1" : ""
                          }`}
                          aria-label={`${unreadNotifications} unread notifications`}
                        >
                          {unreadNotifications > 99
                            ? "99+"
                            : unreadNotifications}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="border-t border-slate-800 pt-2">
        <button
          onClick={() => {
            if (isMobileDrawer) setIsMobileDrawerOpen(false);
            openLogoutModal();
          }}
          title={`Sign out (${userRole})`}
          className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 ${
            isCompactMode ? "" : "md:justify-start md:px-2.5"
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCompactMode && <span className="truncate">Sign out</span>}
          {activeSession && !isCompactMode && (
            <span
              className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]"
              title="Active session open"
            />
          )}
        </button>
      </div>
    </>

);

return (
<>
{/_ ================= DESKTOP SIDEBAR ================= _/}
<aside
className={`hidden md:flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-[#0b1220] py-3 transition-all duration-300 ${
          isCompact ? "w-16 px-2" : "w-52 lg:w-56 xl:w-64 px-3"
        }`} >
{renderSidebarContent(isCompact)}
</aside>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav
        aria-label="Quick navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-slate-800 bg-[#0b1220] px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-full ${
                active ? "text-sky-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => {
            setMobileMoreQuery("");
            setIsMobileDrawerOpen(true);
          }}
          aria-expanded={isMobileDrawerOpen}
          aria-current={moreIsActive ? "page" : undefined}
          className={`relative flex h-full w-16 flex-col items-center justify-center gap-1 ${moreIsActive ? "text-sky-300" : "text-slate-500 hover:text-slate-300"}`}
        >
          <Menu className="h-5 w-5" />
          <span className="max-w-16 truncate text-[10px] font-semibold">
            {moreIsActive && activeMoreLabel ? activeMoreLabel : "More"}
          </span>
          {moreIsActive && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky-300" />
          )}
        </button>
      </nav>

      {/* ================= MOBILE MORE MENU ================= */}
      <div
        aria-hidden={!isMobileDrawerOpen}
        className={`fixed inset-0 z-50 flex md:hidden ${
          isMobileDrawerOpen
            ? "visible pointer-events-auto"
            : "invisible pointer-events-none"
        }`}
      >
        <div
          className={`fixed inset-0 bg-black/65 transition-opacity duration-200 ${
            isMobileDrawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
          className={`relative ml-auto flex h-full w-[min(88vw,24rem)] flex-col border-l border-slate-700/70 bg-[#0b1220] shadow-2xl transition-transform duration-200 ease-out ${
            isMobileDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="shrink-0 border-b border-slate-800 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/kanitt-mark.svg"
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl"
                />
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white">More</h2>
                  <p className="truncate text-xs text-slate-400">
                    {selectedStore?.name || "Workspace menu"} · {userRole}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {stores.length > 1 && userRole !== "CASHIER" && (
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active store
                <select
                  aria-label="Active store"
                  value={selectedStore?.id || ""}
                  onChange={(event) => {
                    const store = stores.find(
                      (candidate) => candidate.id === event.target.value,
                    );
                    if (store) setSelectedStore(store);
                  }}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-sky-400"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-900/80 px-3 py-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`}
              />
              <span className="text-slate-300">
                {isConnected ? "Connected" : "Offline mode"}
              </span>
              {hasQueuedSales && (
                <span className="ml-auto rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                  Sales waiting to sync
                </span>
              )}
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">Search menu</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={mobileMoreQuery}
                onChange={(event) => setMobileMoreQuery(event.target.value)}
                placeholder="Find a page…"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400"
              />
            </label>
          </header>
          <nav
            aria-label="More pages"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4"
          >
            {mobileMoreGroups.length ? (
              mobileMoreGroups.map((group) => (
                <section key={group.name}>
                  <h3 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
                    {group.name}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map(({ id, label, icon: Icon }) => {
                      const active = activeTab === id;
                      const badge =
                        id === "requests"
                          ? openStockRequestCount
                          : id === "notifications"
                            ? unreadNotifications
                            : 0;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-current={active ? "page" : undefined}
                          onClick={() => {
                            setActiveTab(id);
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition ${active ? "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-300/20" : "text-slate-300 active:bg-slate-800"}`}
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? "bg-sky-400/10 text-sky-300" : "bg-slate-800 text-slate-400"}`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-semibold">
                            {label}
                          </span>
                          {badge > 0 && (
                            <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-sky-400 px-1.5 text-[10px] font-black text-slate-950">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="px-3 py-12 text-center">
                <p className="text-sm font-semibold text-slate-300">
                  No matching pages
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Try another search or check your role access.
                </p>
              </div>
            )}
          </nav>
          <footer className="shrink-0 border-t border-slate-800 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={() => {
                setIsMobileDrawerOpen(false);
                openLogoutModal();
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-rose-200 active:bg-rose-500/10"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-500/10">
                <LogOut className="h-4 w-4" />
              </span>
              Sign out
            </button>
          </footer>
        </section>
      </div>

      {/* ================= LOGOUT CONFIRM MODAL ================= */}
      <LogoutConfirmModal
        open={logoutOpen}
        activeSession={activeSession}
        canCloseSession={canCloseActiveSession}
        isProcessing={logoutProcessing}
        error={logoutError}
        onCancel={closeLogoutModal}
        onCloseSessionAndLogout={handleCloseSessionAndLogout}
        onForceLogout={handleForceLogout}
      />
    </>

);
}

// import { useEffect, useState } from "react";
// import {
// BadgePercent,
// Bell,
// BarChart3,
// BriefcaseBusiness,
// Boxes,
// ChevronLeft,
// ChevronRight,
// Cloud,
// ClipboardList,
// Clock3,
// LayoutDashboard,
// LogOut,
// MessageCircle,
// ReceiptText,
// RefreshCw,
// ClipboardCheck,
// Settings2,
// ShieldCheck,
// ShoppingBag,
// Store as StoreIcon,
// User,
// Users,
// Menu, // Added for mobile menu
// X, // Added for closing mobile drawer
// type LucideIcon,
// } from "lucide-react";
// import { Store as ApiStore } from "../store/apiSlice";
// import { decodeAuthToken } from "../services/secureStorage";
// import { apiService } from "../services/api";
// import {
// useGetNotificationUnreadCountQuery,
// useGetStockRequestsQuery,
// } from "../store/apiSlice";

// export type Tab =
// | "dashboard"
// | "pos"
// | "orders"
// | "inventory"
// | "requests"
// | "notifications"
// | "chat"
// | "sessions"
// | "manage"
// | "erp"
// | "reports"
// | "commerce"
// | "activity"
// | "sync"
// | "settings"
// | "admin";

// export function canAccessTab(
// tab: Tab,
// role: string,
// permissions: string[] = [],
// ) {
// if (role === "ACCOUNTANT") {
// return [
// "dashboard",
// "orders",
// "inventory",
// "reports",
// "sync",
// "chat",
// ].includes(tab);
// }
// if (tab === "erp" && role === "MANAGER") {
// return permissions.includes("MANAGE_INVENTORY");
// }
// const roleAllowed: Partial<Record<Tab, string[]>> = {
// dashboard: ["ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT", "SUPER_ADMIN"],
// erp: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// commerce: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// settings: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// admin: ["ADMIN", "SUPER_ADMIN"],
// };
// const permissionAllowed: Partial<Record<Tab, string[]>> = {
// dashboard: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
// reports: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
// manage: ["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES"],
// activity: ["VIEW_AUDIT_LOGS"],
// };
// if (permissionAllowed[tab])
// return permissions.some((permission) =>
// permissionAllowed[tab]!.includes(permission),
// );
// if (roleAllowed[tab]) return roleAllowed[tab]!.includes(role);
// return true;
// }

// interface SidebarProps {
// activeTab: Tab;
// setActiveTab: (tab: Tab) => void;
// isConnected: boolean;
// isLoading: boolean;
// syncWithServer: () => void;
// stores: ApiStore[];
// selectedStore: ApiStore | null;
// setSelectedStore: (store: ApiStore) => void;
// storeError: boolean;
// onLogout: () => void;
// }

// const groups: {
// name: string;
// items: {
// id: Tab;
// label: string;
// icon: LucideIcon;
// roles?: string[];
// permissions?: string[];
// }[];
// }[] = [
// {
// name: "Workspace",
// items: [
// {
// id: "dashboard",
// label: "Overview",
// icon: LayoutDashboard,
// permissions: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
// },
// { id: "pos", label: "Point of sale", icon: ShoppingBag },
// { id: "sessions", label: "Register sessions", icon: Clock3 },
// ],
// },
// {
// name: "Sales & stock",
// items: [
// { id: "orders", label: "Orders & returns", icon: ReceiptText },
// { id: "inventory", label: "Inventory", icon: Boxes },
// { id: "requests", label: "Stock requests", icon: ClipboardCheck },
// ],
// },
// {
// name: "Operations",
// items: [
// {
// id: "reports",
// label: "Reports & analytics",
// icon: BarChart3,
// permissions: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
// },
// {
// id: "erp",
// label: "ERP operations",
// icon: BriefcaseBusiness,
// roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// },
// {
// id: "commerce",
// label: "Configuration",
// icon: BadgePercent,
// roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// },
// {
// id: "manage",
// label: "Manage",
// icon: Users,
// roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// permissions: ["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES"],
// },
// {
// id: "activity",
// label: "Audit trail",
// icon: ClipboardList,
// roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// permissions: ["VIEW_AUDIT_LOGS"],
// },
// { id: "chat", label: "Store chat", icon: MessageCircle },
// ],
// },
// {
// name: "System",
// items: [
// {
// id: "admin",
// label: "Admin workspace",
// icon: ShieldCheck,
// roles: ["ADMIN", "SUPER_ADMIN"],
// },
// { id: "notifications", label: "Notifications", icon: Bell },
// { id: "sync", label: "Sync status", icon: Cloud },
// {
// id: "settings",
// label: "Settings",
// icon: Settings2,
// roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
// },
// ],
// },
// ];

// export function Sidebar({
// activeTab,
// setActiveTab,
// isConnected,
// isLoading,
// syncWithServer,
// stores,
// selectedStore,
// setSelectedStore,
// storeError,
// onLogout,
// }: SidebarProps) {
// const [collapsed, setCollapsed] = useState(false);
// const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false); // Mobile Drawer State

// const currentUser = decodeAuthToken();
// const userRole = (currentUser?.role || "CASHIER").toUpperCase();

// const { data: visibleStockRequests = [] } = useGetStockRequestsQuery(
// {
// storeId: ["ADMIN", "SUPER_ADMIN"].includes(userRole)
// ? undefined
// : selectedStore?.id,
// },
// {
// pollingInterval: 15000,
// skip:
// (!selectedStore?.id && !["ADMIN", "SUPER_ADMIN"].includes(userRole)) ||
// userRole === "ACCOUNTANT",
// },
// );

// const { data: unreadNotifications = 0, refetch: refreshUnreadNotifications } =
// useGetNotificationUnreadCountQuery(undefined, { pollingInterval: 30000 });

// const realtimeRoomId = selectedStore?.id || "tenant";

// useEffect(() => {
// return apiService.connectRealtime(
// realtimeRoomId,
// (event) => {
// if (event.type === "notification.created")
// void refreshUnreadNotifications();
// },
// () => {},
// );
// }, [realtimeRoomId, refreshUnreadNotifications]);

// const openStockRequestCount = visibleStockRequests.filter((request: any) =>
// ["PENDING", "ACKNOWLEDGED"].includes(request.status),
// ).length;

// const isCompact = collapsed;

// // Mobile တွင် အသုံးပြုမည့် အဓိက Menu ၄ ခု
// const mobileNavItems = [
// { id: "pos", label: "POS", icon: ShoppingBag },
// { id: "orders", label: "Orders", icon: ReceiptText },
// { id: "inventory", label: "Inventory", icon: Boxes },
// { id: "sessions", label: "Sessions", icon: Clock3 },
// ].filter((item) =>
// canAccessTab(item.id as Tab, userRole, currentUser?.permissions || []),
// );

// // Sidebar ၏ အတွင်းပိုင်း Content များကို ပြန်လည်အသုံးပြုနိုင်ရန် Function ဖြင့် ခွဲထုတ်ခြင်း
// const renderSidebarContent = (
// isCompactMode: boolean,
// isMobileDrawer = false,
// ) => (
// <>
// {/_ Header Logo & Collapse Toggle _/}
// <div className="mb-4 flex h-10 items-center justify-between px-1">
// <div className="flex items-center gap-2.5">
// <img
// src="/kanitt-mark.svg"
// alt="Kanitt"
// className="h-9 w-9 shrink-0 rounded-xl shadow-lg shadow-sky-500/20"
// />
// {!isCompactMode && (
// <div className="min-w-0 flex-1">
// <div className="flex flex-col">
// <span className="text-sm font-bold text-white">
// {selectedStore?.name}
// </span>
// </div>
// </div>
// )}
// </div>
// <div className="flex items-center gap-1">
// {!isCompactMode && (
// <button
// onClick={syncWithServer}
// disabled={isLoading}
// title="Refresh workspace data"
// className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
// >
// <RefreshCw
// className={`h-4 w-4 ${isLoading ? "animate-spin text-sky-300" : ""}`}
// />
// </button>
// )}
// {/_ Mobile Drawer ဖြစ်ပါက Collapse ခလုတ်အစား Close ခလုတ်ကို ပြသမည် _/}
// {isMobileDrawer ? (
// <button
// onClick={() => setIsMobileDrawerOpen(false)}
// className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white"
// >
// <X className="h-4 w-4" />
// </button>
// ) : (
// <button
// onClick={() => setCollapsed(!collapsed)}
// title={
// isCompactMode
// ? "Expand sidebar"
// : "Collapse sidebar (Icon mode)"
// }
// className="hidden rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white md:flex items-center justify-center"
// >
// {isCompactMode ? (
// <ChevronRight className="h-4 w-4" />
// ) : (
// <ChevronLeft className="h-4 w-4" />
// )}
// </button>
// )}
// </div>
// </div>

// {/_ User Profile Info Card _/}
// <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 md:p-2">
// <div
// className="flex items-center gap-2"
// title={`${currentUser?.email || "User"} (${userRole})`}
// >
// <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-300">
// <User className="h-4 w-4" />
// </div>
// {!isCompactMode && (
// <div className="min-w-0 flex-1">
// <p className="truncate text-xs font-bold text-slate-100">
// {currentUser?.email || "Signed in"}
// </p>
// <div className="mt-0.5 flex items-center gap-1.5">
// <span
// className={`inline-block h-1.5 w-1.5 rounded-full ${
//                     userRole.includes("ADMIN")
//                       ? "bg-emerald-400"
//                       : userRole === "MANAGER"
//                         ? "bg-amber-400"
//                         : "bg-sky-400"
//                   }`}
// />
// <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
// {userRole}
// </span>
// </div>
// </div>
// )}
// </div>
// </div>

// {/_ Connection & Store Selector _/}
// <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 p-1.5 md:p-2">
// <div
// className={`flex items-center gap-2 ${
//             isCompactMode ? "justify-center" : "justify-center md:justify-start"
//           }`}
// title={isConnected ? "Server connected" : "Offline mode"}
// >
// <span
// className={`h-2 w-2 rounded-full ${
//               isConnected
//                 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
//                 : "bg-amber-400"
//             }`}
// />
// {!isCompactMode && (
// <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
// {isConnected ? "Server connected" : "Offline mode"}
// </span>
// )}
// {!isCompactMode && (
// <span className="ml-auto text-[10px] text-slate-600">
// {isConnected ? "LIVE" : "LOCAL"}
// </span>
// )}
// </div>
// {!isCompactMode && (
// <div className="mt-1.5 flex items-center gap-2 border-t border-slate-800 pt-1.5">
// <StoreIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
// {stores.length ? (
// userRole === "CASHIER" || stores.length === 1 ? (
// <span className="w-full truncate text-xs font-semibold text-slate-200">
// {selectedStore?.name || stores[0]?.name}
// </span>
// ) : (
// <select
// aria-label="Active store"
// value={selectedStore?.id || ""}
// onChange={(event) => {
// const store = stores.find(
// (candidate) => candidate.id === event.target.value,
// );
// if (store) setSelectedStore(store);
// }}
// className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-200 outline-none"
// >
// {stores.map((store) => (
// <option
// key={store.id}
// value={store.id}
// className="bg-slate-900"
// >
// {store.name}
// </option>
// ))}
// </select>
// )
// ) : (
// <span className="truncate text-xs text-slate-500">
// {storeError ? "Stores unavailable" : "No stores"}
// </span>
// )}
// </div>
// )}
// </div>

// {/_ Navigation Items _/}
// <nav
// className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2"
// aria-label="Main navigation"
// >
// {groups.map((group) => {
// const userPermissions = currentUser?.permissions ?? [];
// const visibleItems = group.items.filter((item) =>
// canAccessTab(item.id, userRole, userPermissions),
// );
// if (visibleItems.length === 0) return null;
// return (
// <div key={group.name}>
// {!isCompactMode && (
// <p className="mb-1 px-2.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-600">
// {group.name}
// </p>
// )}
// <div className="space-y-0.5">
// {visibleItems.map(({ id, label, icon: Icon }) => {
// const active = activeTab === id;
// return (
// <button
// key={id}
// type="button"
// title={label}
// aria-current={active ? "page" : undefined}
// onClick={() => {
// setActiveTab(id);
// if (isMobileDrawer) setIsMobileDrawerOpen(false); // Mobile တွင် နှိပ်ပြီးပါက Drawer ပိတ်မည်
// }}
// className={`group relative flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-semibold transition-all ${
//                         isCompactMode ? "" : "md:justify-start md:px-2.5"
//                       } ${
//                         active
//                           ? "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-300/15"
//                           : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
//                       }`}
// >
// <span
// className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-sky-300 ${
//                           active ? "opacity-100" : "opacity-0"
//                         }`}
// />
// <Icon
// className={`h-4 w-4 shrink-0 ${
//                           active
//                             ? "text-sky-300"
//                             : "text-slate-500 group-hover:text-slate-300"
//                         }`}
// />
// {!isCompactMode && (
// <span className="flex-1 truncate">{label}</span>
// )}
// {id === "requests" && openStockRequestCount > 0 && (
// <span
// className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-950 ${
//                             isCompactMode ? "absolute -right-1 -top-1" : ""
//                           }`}
// aria-label={`${openStockRequestCount} open stock requests`}
// >
// {openStockRequestCount > 99
// ? "99+"
// : openStockRequestCount}
// </span>
// )}
// {id === "notifications" && unreadNotifications > 0 && (
// <span
// className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-sky-400 px-1 text-[9px] font-black text-slate-950 ${
//                             isCompactMode ? "absolute -right-1 -top-1" : ""
//                           }`}
// aria-label={`${unreadNotifications} unread notifications`}
// >
// {unreadNotifications > 99
// ? "99+"
// : unreadNotifications}
// </span>
// )}
// </button>
// );
// })}
// </div>
// </div>
// );
// })}
// </nav>

// {/_ Logout Button _/}
// <div className="border-t border-slate-800 pt-2">
// <button
// onClick={onLogout}
// title={`Sign out (${userRole})`}
// className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 ${
//             isCompactMode ? "" : "md:justify-start md:px-2.5"
//           }`}
// >
// <LogOut className="h-4 w-4 shrink-0" />
// {!isCompactMode && <span className="truncate">Sign out</span>}
// </button>
// </div>
// </>
// );

// return (
// <>
// {/_ ================= DESKTOP SIDEBAR ================= _/}
// <aside
// className={`hidden md:flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-[#0b1220] py-3 transition-all duration-300 ${
//           isCompact ? "w-16 px-2" : "w-52 lg:w-56 xl:w-64 px-3"
//         }`}
// >
// {renderSidebarContent(isCompact)}
// </aside>

// {/_ ================= MOBILE BOTTOM NAVIGATION ================= _/}
// <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-800 bg-[#0b1220] px-2 pb-safe md:hidden">
// {mobileNavItems.map((item) => {
// const Icon = item.icon;
// const active = activeTab === item.id;
// return (
// <button
// key={item.id}
// onClick={() => setActiveTab(item.id as Tab)}
// className={`flex flex-col items-center justify-center gap-1 w-16 h-full ${
//                 active ? "text-sky-300" : "text-slate-500 hover:text-slate-300"
//               }`}
// >
// <Icon className="h-5 w-5" />
// <span className="text-[10px] font-semibold">{item.label}</span>
// </button>
// );
// })}
// {/_ More Button to open Drawer _/}
// <button
// onClick={() => setIsMobileDrawerOpen(true)}
// className="flex flex-col items-center justify-center gap-1 w-16 h-full text-slate-500 hover:text-slate-300"
// >
// <Menu className="h-5 w-5" />
// <span className="text-[10px] font-semibold">More</span>
// </button>
// </nav>

// {/_ ================= MOBILE DRAWER (SLIDE-OUT MENU) ================= _/}
// <div
// className={`fixed inset-0 z-50 flex md:hidden ${
//           isMobileDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
//         }`}
// >
// {/_ Backdrop Overlay _/}
// <div
// className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
//             isMobileDrawerOpen ? "opacity-100" : "opacity-0"
//           }`}
// onClick={() => setIsMobileDrawerOpen(false)}
// />

// {/_ Drawer Content _/}
// <div
// className={`relative flex h-full w-64 flex-col bg-[#0b1220] p-3 shadow-xl transition-transform duration-300 ease-in-out ${
//             isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
//           }`}
// >
// {renderSidebarContent(false, true)}
// </div>
// </div>
// </>
// );
// }
