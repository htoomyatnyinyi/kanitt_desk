import { useEffect, useState } from "react";
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
  ClipboardCheck,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  User,
  Users,
  Menu, // Added for mobile menu
  X, // Added for closing mobile drawer
  type LucideIcon,
} from "lucide-react";
import { Store as ApiStore } from "../store/apiSlice";
import { decodeAuthToken } from "../services/secureStorage";
import { apiService } from "../services/api";
import {
  useGetNotificationUnreadCountQuery,
  useGetStockRequestsQuery,
} from "../store/apiSlice";

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
  onLogout,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false); // Mobile Drawer State

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

  const openStockRequestCount = visibleStockRequests.filter((request: any) =>
    ["PENDING", "ACKNOWLEDGED"].includes(request.status),
  ).length;

  const isCompact = collapsed;

  // Mobile တွင် အသုံးပြုမည့် အဓိက Menu ၄ ခု
  const mobileNavItems = [
    { id: "pos", label: "POS", icon: ShoppingBag },
    { id: "orders", label: "Orders", icon: ReceiptText },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "sessions", label: "Sessions", icon: Clock3 },
  ].filter((item) =>
    canAccessTab(item.id as Tab, userRole, currentUser?.permissions || []),
  );

  // Sidebar ၏ အတွင်းပိုင်း Content များကို ပြန်လည်အသုံးပြုနိုင်ရန် Function ဖြင့် ခွဲထုတ်ခြင်း
  const renderSidebarContent = (
    isCompactMode: boolean,
    isMobileDrawer = false,
  ) => (
    <>
      {/* Header Logo & Collapse Toggle */}
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
          {/* Mobile Drawer ဖြစ်ပါက Collapse ခလုတ်အစား Close ခလုတ်ကို ပြသမည် */}
          {isMobileDrawer ? (
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white"
            >
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
              className="hidden rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white md:flex items-center justify-center"
            >
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
                        if (isMobileDrawer) setIsMobileDrawerOpen(false); // Mobile တွင် နှိပ်ပြီးပါက Drawer ပိတ်မည်
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
          onClick={onLogout}
          title={`Sign out (${userRole})`}
          className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 ${
            isCompactMode ? "" : "md:justify-start md:px-2.5"
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCompactMode && <span className="truncate">Sign out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside
        className={`hidden md:flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-[#0b1220] py-3 transition-all duration-300 ${
          isCompact ? "w-16 px-2" : "w-52 lg:w-56 xl:w-64 px-3"
        }`}
      >
        {renderSidebarContent(isCompact)}
      </aside>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-800 bg-[#0b1220] px-2 pb-safe md:hidden">
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
        {/* More Button to open Drawer */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-1 w-16 h-full text-slate-500 hover:text-slate-300"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </nav>

      {/* ================= MOBILE DRAWER (SLIDE-OUT MENU) ================= */}
      <div
        className={`fixed inset-0 z-50 flex md:hidden ${
          isMobileDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Backdrop Overlay */}
        <div
          className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
            isMobileDrawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsMobileDrawerOpen(false)}
        />

        {/* Drawer Content */}
        <div
          className={`relative flex h-full w-64 flex-col bg-[#0b1220] p-3 shadow-xl transition-transform duration-300 ease-in-out ${
            isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {renderSidebarContent(false, true)}
        </div>
      </div>
    </>
  );
}

// import { useEffect, useState } from "react";
// import {
//   BadgePercent,
//   Bell,
//   BarChart3,
//   BriefcaseBusiness,
//   Boxes,
//   ChevronLeft,
//   ChevronRight,
//   Cloud,
//   ClipboardList,
//   Clock3,
//   LayoutDashboard,
//   LogOut,
//   MessageCircle,
//   ReceiptText,
//   RefreshCw,
//   ClipboardCheck,
//   Settings2,
//   ShieldCheck,
//   ShoppingBag,
//   Store as StoreIcon,
//   User,
//   Users,
//   type LucideIcon,
// } from "lucide-react";
// import { Store as ApiStore } from "../store/apiSlice";
// import { decodeAuthToken } from "../services/secureStorage";
// import { apiService } from "../services/api";
// import {
//   useGetNotificationUnreadCountQuery,
//   useGetStockRequestsQuery,
// } from "../store/apiSlice";

// export type Tab =
//   | "dashboard"
//   | "pos"
//   | "orders"
//   | "inventory"
//   | "requests"
//   | "notifications"
//   | "chat"
//   | "sessions"
//   | "manage"
//   | "erp"
//   | "reports"
//   | "commerce"
//   | "activity"
//   | "sync"
//   | "settings"
//   | "admin";
// export function canAccessTab(
//   tab: Tab,
//   role: string,
//   permissions: string[] = [],
// ) {
//   if (role === "ACCOUNTANT") {
//     return [
//       "dashboard",
//       "orders",
//       "inventory",
//       "reports",
//       "sync",
//       "chat",
//     ].includes(tab);
//   }
//   if (tab === "erp" && role === "MANAGER") {
//     return permissions.includes("MANAGE_INVENTORY");
//   }
//   const roleAllowed: Partial<Record<Tab, string[]>> = {
//     dashboard: ["ADMIN", "MANAGER", "CASHIER", "ACCOUNTANT", "SUPER_ADMIN"],
//     erp: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//     commerce: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//     settings: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//     admin: ["ADMIN", "SUPER_ADMIN"],
//   };
//   const permissionAllowed: Partial<Record<Tab, string[]>> = {
//     dashboard: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
//     reports: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
//     manage: ["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES"],
//     activity: ["VIEW_AUDIT_LOGS"],
//   };
//   if (permissionAllowed[tab])
//     return permissions.some((permission) =>
//       permissionAllowed[tab]!.includes(permission),
//     );
//   if (roleAllowed[tab]) return roleAllowed[tab]!.includes(role);
//   return true;
// }
// interface SidebarProps {
//   activeTab: Tab;
//   setActiveTab: (tab: Tab) => void;
//   isConnected: boolean;
//   isLoading: boolean;
//   syncWithServer: () => void;
//   stores: ApiStore[];
//   selectedStore: ApiStore | null;
//   setSelectedStore: (store: ApiStore) => void;
//   storeError: boolean;
//   onLogout: () => void;
// }

// const groups: {
//   name: string;
//   items: {
//     id: Tab;
//     label: string;
//     icon: LucideIcon;
//     roles?: string[];
//     permissions?: string[];
//   }[];
// }[] = [
//   {
//     name: "Workspace",
//     items: [
//       {
//         id: "dashboard",
//         label: "Overview",
//         icon: LayoutDashboard,
//         permissions: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
//       },
//       { id: "pos", label: "Point of sale", icon: ShoppingBag },
//       // { id: "chat", label: "Store chat", icon: MessageCircle },
//       { id: "sessions", label: "Register sessions", icon: Clock3 },
//     ],
//   },
//   {
//     name: "Sales & stock",
//     items: [
//       { id: "orders", label: "Orders & returns", icon: ReceiptText },
//       { id: "inventory", label: "Inventory", icon: Boxes },
//       { id: "requests", label: "Stock requests", icon: ClipboardCheck },
//       // { id: "sessions", label: "Register sessions", icon: Clock3 },
//     ],
//   },
//   {
//     name: "Operations",
//     items: [
//       {
//         id: "reports",
//         label: "Reports & analytics",
//         icon: BarChart3,
//         permissions: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
//       },
//       {
//         id: "erp",
//         label: "ERP operations",
//         icon: BriefcaseBusiness,
//         roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//       },
//       {
//         id: "commerce",
//         label: "Configuration",
//         icon: BadgePercent,
//         roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//       },
//       {
//         id: "manage",
//         label: "Manage",
//         icon: Users,
//         roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//         permissions: ["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES"],
//       },
//       {
//         id: "activity",
//         label: "Audit trail",
//         icon: ClipboardList,
//         roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//         permissions: ["VIEW_AUDIT_LOGS"],
//       },
//       { id: "chat", label: "Store chat", icon: MessageCircle },
//     ],
//   },
//   {
//     name: "System",
//     items: [
//       {
//         id: "admin",
//         label: "Admin workspace",
//         icon: ShieldCheck,
//         roles: ["ADMIN", "SUPER_ADMIN"],
//       },
//       { id: "notifications", label: "Notifications", icon: Bell },
//       { id: "sync", label: "Sync status", icon: Cloud },
//       {
//         id: "settings",
//         label: "Settings",
//         icon: Settings2,
//         roles: ["ADMIN", "MANAGER", "SUPER_ADMIN"],
//       },
//     ],
//   },
// ];

// export function Sidebar({
//   activeTab,
//   setActiveTab,
//   isConnected,
//   isLoading,
//   syncWithServer,
//   stores,
//   selectedStore,
//   setSelectedStore,
//   storeError,
//   onLogout,
// }: SidebarProps) {
//   const [collapsed, setCollapsed] = useState(false);
//   const currentUser = decodeAuthToken();
//   const userRole = (currentUser?.role || "CASHIER").toUpperCase();
//   const { data: visibleStockRequests = [] } = useGetStockRequestsQuery(
//     {
//       storeId: ["ADMIN", "SUPER_ADMIN"].includes(userRole)
//         ? undefined
//         : selectedStore?.id,
//     },
//     {
//       pollingInterval: 15000,
//       skip:
//         (!selectedStore?.id && !["ADMIN", "SUPER_ADMIN"].includes(userRole)) ||
//         userRole === "ACCOUNTANT",
//     },
//   );
//   const { data: unreadNotifications = 0, refetch: refreshUnreadNotifications } =
//     useGetNotificationUnreadCountQuery(undefined, { pollingInterval: 30000 });
//   const realtimeRoomId = selectedStore?.id || "tenant";
//   useEffect(() => {
//     return apiService.connectRealtime(
//       realtimeRoomId,
//       (event) => {
//         if (event.type === "notification.created")
//           void refreshUnreadNotifications();
//       },
//       () => {},
//     );
//   }, [realtimeRoomId, refreshUnreadNotifications]);
//   const openStockRequestCount = visibleStockRequests.filter((request: any) =>
//     ["PENDING", "ACKNOWLEDGED"].includes(request.status),
//   ).length;

//   const isCompact = collapsed;

//   return (
//     <aside
//       className={`flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-[#0b1220] py-3 transition-all duration-300 ${isCompact ? "w-16 px-2" : "w-16 px-2 md:w-52 lg:w-56 xl:w-64 md:px-3"}`}
//     >
//       <div className="mb-4 flex h-10 items-center justify-between px-1">
//         <div className="flex items-center gap-2.5">
//           <img
//             src="/kanitt-mark.svg"
//             alt="Kanitt"
//             className="h-9 w-9 shrink-0 rounded-xl shadow-lg shadow-sky-500/20"
//           />
//           {!isCompact && (
//             <div className="hidden min-w-0 flex-1 md:block">
//               {/* business organism name */}
//               {/* here i want to show the business name and address */}
//               {/* this is under the business organism */}
//               <div className="flex flex-col">
//                 <span className="text-sm font-bold text-white">
//                   {selectedStore?.name}
//                 </span>
//                 {/* <span className="text-xs text-slate-500">
//                   {selectedStore?.id}
//                 </span> */}
//               </div>
//               {/* <h1 className="truncate text-sm font-extrabold tracking-wide text-white">
//                 KANITT
//               </h1>
//               <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
//                 Retail POS
//               </p> */}
//             </div>
//           )}
//         </div>
//         <div className="flex items-center gap-1">
//           {!isCompact && (
//             <button
//               onClick={syncWithServer}
//               disabled={isLoading}
//               title="Refresh workspace data"
//               className="hidden rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-40 md:block"
//             >
//               <RefreshCw
//                 className={`h-4 w-4 ${isLoading ? "animate-spin text-sky-300" : ""}`}
//               />
//             </button>
//           )}
//           <button
//             onClick={() => setCollapsed(!collapsed)}
//             title={
//               isCompact ? "Expand sidebar" : "Collapse sidebar (Icon mode)"
//             }
//             className="hidden rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-white md:flex items-center justify-center"
//           >
//             {isCompact ? (
//               <ChevronRight className="h-4 w-4" />
//             ) : (
//               <ChevronLeft className="h-4 w-4" />
//             )}
//           </button>
//         </div>
//       </div>

//       {/* Logged in User Profile Info Card */}
//       <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 md:p-2">
//         <div
//           className="flex items-center gap-2"
//           title={`${currentUser?.email || "User"} (${userRole})`}
//         >
//           <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-300">
//             <User className="h-4 w-4" />
//           </div>
//           {!isCompact && (
//             <div className="hidden min-w-0 flex-1 md:block">
//               <p className="truncate text-xs font-bold text-slate-100">
//                 {currentUser?.email || "Signed in"}
//               </p>
//               <div className="mt-0.5 flex items-center gap-1.5">
//                 <span
//                   className={`inline-block h-1.5 w-1.5 rounded-full ${userRole.includes("ADMIN") ? "bg-emerald-400" : userRole === "MANAGER" ? "bg-amber-400" : "bg-sky-400"}`}
//                 />
//                 <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
//                   {userRole}
//                 </span>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 p-1.5 md:p-2">
//         <div
//           className={`flex items-center gap-2 ${isCompact ? "justify-center" : "justify-center md:justify-start"}`}
//           title={isConnected ? "Server connected" : "Offline mode"}
//         >
//           <span
//             className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400"}`}
//           />
//           {!isCompact && (
//             <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-500 md:block">
//               {isConnected ? "Server connected" : "Offline mode"}
//             </span>
//           )}
//           {!isCompact && (
//             <span className="ml-auto hidden text-[10px] text-slate-600 md:block">
//               {isConnected ? "LIVE" : "LOCAL"}
//             </span>
//           )}
//         </div>
//         {!isCompact && (
//           <div className="mt-1.5 hidden items-center gap-2 border-t border-slate-800 pt-1.5 md:flex">
//             <StoreIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
//             {stores.length ? (
//               userRole === "CASHIER" || stores.length === 1 ? (
//                 <span className="w-full truncate text-xs font-semibold text-slate-200">
//                   {selectedStore?.name || stores[0]?.name}
//                 </span>
//               ) : (
//                 <select
//                   aria-label="Active store"
//                   value={selectedStore?.id || ""}
//                   onChange={(event) => {
//                     const store = stores.find(
//                       (candidate) => candidate.id === event.target.value,
//                     );
//                     if (store) setSelectedStore(store);
//                   }}
//                   className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-200 outline-none"
//                 >
//                   {stores.map((store) => (
//                     <option
//                       key={store.id}
//                       value={store.id}
//                       className="bg-slate-900"
//                     >
//                       {store.name}
//                     </option>
//                   ))}
//                 </select>
//               )
//             ) : (
//               <span className="truncate text-xs text-slate-500">
//                 {storeError ? "Stores unavailable" : "No stores"}
//               </span>
//             )}
//           </div>
//         )}
//       </div>

//       <nav
//         className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2"
//         aria-label="Main navigation"
//       >
//         {groups.map((group) => {
//           const userPermissions = currentUser?.permissions ?? [];
//           const visibleItems = group.items.filter((item) =>
//             canAccessTab(item.id, userRole, userPermissions),
//           );
//           if (visibleItems.length === 0) return null;
//           return (
//             <div key={group.name}>
//               {!isCompact && (
//                 <p className="mb-1 hidden px-2.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-600 md:block">
//                   {group.name}
//                 </p>
//               )}
//               <div className="space-y-0.5">
//                 {visibleItems.map(({ id, label, icon: Icon }) => {
//                   const active = activeTab === id;
//                   return (
//                     <button
//                       key={id}
//                       type="button"
//                       title={label}
//                       aria-current={active ? "page" : undefined}
//                       onClick={() => setActiveTab(id)}
//                       className={`group relative flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-semibold transition-all ${isCompact ? "" : "md:justify-start md:px-2.5"} ${active ? "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-300/15" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"}`}
//                     >
//                       <span
//                         className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-sky-300 ${active ? "opacity-100" : "opacity-0"}`}
//                       />
//                       <Icon
//                         className={`h-4 w-4 shrink-0 ${active ? "text-sky-300" : "text-slate-500 group-hover:text-slate-300"}`}
//                       />
//                       {!isCompact && (
//                         <span className="hidden flex-1 truncate md:block">
//                           {label}
//                         </span>
//                       )}
//                       {id === "requests" && openStockRequestCount > 0 && (
//                         <span
//                           className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-950 ${isCompact ? "absolute -right-1 -top-1" : ""}`}
//                           aria-label={`${openStockRequestCount} open stock requests`}
//                         >
//                           {openStockRequestCount > 99
//                             ? "99+"
//                             : openStockRequestCount}
//                         </span>
//                       )}
//                       {id === "notifications" && unreadNotifications > 0 && (
//                         <span
//                           className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-sky-400 px-1 text-[9px] font-black text-slate-950 ${isCompact ? "absolute -right-1 -top-1" : ""}`}
//                           aria-label={`${unreadNotifications} unread notifications`}
//                         >
//                           {unreadNotifications > 99
//                             ? "99+"
//                             : unreadNotifications}
//                         </span>
//                       )}
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>
//           );
//         })}
//       </nav>

//       <div className="border-t border-slate-800 pt-2">
//         <button
//           onClick={onLogout}
//           title={`Sign out (${userRole})`}
//           className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 ${isCompact ? "" : "md:justify-start md:px-2.5"}`}
//         >
//           <LogOut className="h-4 w-4 shrink-0" />
//           {!isCompact && (
//             <span className="hidden truncate md:block">Sign out</span>
//           )}
//         </button>
//       </div>
//     </aside>
//   );
// }
