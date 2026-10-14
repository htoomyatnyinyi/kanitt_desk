import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  History,
  Keyboard,
  Package,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  TrendingDown,
  Truck,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../types";
import {
  useCreateStockRequestMutation,
  useGetStockRequestsQuery,
} from "../store/apiSlice";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const LOW_THRESHOLD = 20;
const CRITICAL_THRESHOLD = 5;
const EXPIRY_CRITICAL_DAYS = 30;
const EXPIRY_SOON_DAYS = 90;

type SortKey = "name" | "sku" | "category" | "price" | "stock";
type SortDir = "asc" | "desc";
type StockFilter =
  | "all"
  | "in"
  | "low"
  | "critical"
  | "out"
  | "expiring"
  | "expired"
  | "reorder";
type ExpiryTier = "expired" | "critical" | "soon" | "ok" | "none";
type DrawerTab = "overview" | "batches" | "history";
type RequestUrgency = "low" | "normal" | "urgent" | "critical";

type MovementType =
  | "SALE"
  | "PURCHASE"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "ADJUST_IN"
  | "ADJUST_OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "DISPOSE"
  | "QUARANTINE";

interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku?: string;
  type: MovementType;
  quantity: number;
  balanceAfter?: number;
  reason?: string;
  notes?: string;
  reference?: string;
  fromStoreId?: string;
  toStoreId?: string;
  storeId?: string;
  userId?: string;
  userName?: string;
  lotNumber?: string;
  expiryDate?: string;
  createdAt: string;
}

type MovementFilter = "all" | "in" | "out" | "transfer" | "adjust";

export interface StoreOption {
  id: string;
  name: string;
}

export interface SupplierOption {
  id: string;
  name: string;
  leadTimeDays?: number;
}

export interface AdjustPayload {
  productId: string;
  variantId: string;
  lotId?: string;
  quantityIsBaseUnit?: boolean;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface TransferPayload {
  productId: string;
  variantId: string;
  fromStoreId: string;
  toStoreId: string;
  quantity: number;
  notes?: string;
}

export interface PurchaseLine {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitCost: number;
  expiryDate?: string;
  lotNumber?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  storeId: string;
  storeName: string;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "ORDERED"
    | "RECEIVED"
    | "CANCELLED";
  lines: PurchaseLine[];
  expectedDate?: string;
  notes?: string;
  subtotal: number;
  tax?: number;
  shipping?: number;
  total: number;
  createdAt: string;
  createdBy?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const num = (value: unknown) => Number(value) || 0;

const daysUntil = (date?: string) => {
  if (!date) return Infinity;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return Infinity;
  return Math.ceil((time - Date.now()) / 86_400_000);
};

type Tone = "in" | "low" | "critical" | "out";

const getTone = (stock: number): Tone => {
  if (stock <= 0) return "out";
  if (stock <= CRITICAL_THRESHOLD) return "critical";
  if (stock <= LOW_THRESHOLD) return "low";
  return "in";
};

const TONE_META: Record<Tone, { label: string; className: string }> = {
  in: {
    label: "In Stock",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  low: {
    label: "Low",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  critical: {
    label: "Critical",
    className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
  out: {
    label: "Out of Stock",
    className: "bg-slate-600/20 text-slate-400 border-slate-600/40",
  },
};

const getExpiryTier = (days: number): ExpiryTier => {
  if (!Number.isFinite(days)) return "none";
  if (days < 0) return "expired";
  if (days <= EXPIRY_CRITICAL_DAYS) return "critical";
  if (days <= EXPIRY_SOON_DAYS) return "soon";
  return "ok";
};

const EXPIRY_TIER_META: Record<
  ExpiryTier,
  { label: string; chip: string; border: string }
> = {
  expired: {
    label: "Expired",
    chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    border: "border-rose-500/30 bg-rose-500/5",
  },
  critical: {
    label: `≤${EXPIRY_CRITICAL_DAYS}d`,
    chip: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    border: "border-orange-500/30 bg-orange-500/5",
  },
  soon: {
    label: `≤${EXPIRY_SOON_DAYS}d`,
    chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    border: "border-amber-500/30 bg-amber-500/5",
  },
  ok: {
    label: "OK",
    chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    border: "border-slate-800 bg-slate-950/50",
  },
  none: {
    label: "No expiry",
    chip: "bg-slate-700/30 text-slate-400 border-slate-700",
    border: "border-slate-800 bg-slate-950/50",
  },
};

const MOVEMENT_META: Record<
  MovementType,
  {
    label: string;
    chip: string;
    icon: typeof Package;
    direction: "in" | "out";
  }
> = {
  SALE: {
    label: "Sale",
    chip: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    icon: ShoppingCart,
    direction: "out",
  },
  PURCHASE: {
    label: "Purchase",
    chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: Truck,
    direction: "in",
  },
  RETURN_IN: {
    label: "Return in",
    chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: Undo2,
    direction: "in",
  },
  RETURN_OUT: {
    label: "Return out",
    chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    icon: Undo2,
    direction: "out",
  },
  ADJUST_IN: {
    label: "Adjust +",
    chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: Plus,
    direction: "in",
  },
  ADJUST_OUT: {
    label: "Adjust −",
    chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    icon: Trash2,
    direction: "out",
  },
  TRANSFER_IN: {
    label: "Transfer in",
    chip: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    icon: ArrowDownToLine,
    direction: "in",
  },
  TRANSFER_OUT: {
    label: "Transfer out",
    chip: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    icon: ArrowUpFromLine,
    direction: "out",
  },
  DISPOSE: {
    label: "Dispose",
    chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    icon: Trash2,
    direction: "out",
  },
  QUARANTINE: {
    label: "Quarantine",
    chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    icon: AlertTriangle,
    direction: "out",
  },
};

const formatRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const getLots = (product: Product) =>
  (product.inventories ?? [])
    .filter((inventory) => inventory.lot)
    .map((inventory, index) => ({
      key: `${inventory.lot?.number ?? "lot"}-${index}`,
      lotId: inventory.lot?.id,
      number: inventory.lot?.number ?? "—",
      expiryDate: inventory.lot?.expiryDate,
      quantity: num(inventory.quantity),
      days: daysUntil(inventory.lot?.expiryDate ?? undefined),
    }))
    .sort((a, b) => {
      if (!Number.isFinite(a.days)) return 1;
      if (!Number.isFinite(b.days)) return -1;
      return a.days - b.days;
    });

const getExpirySummary = (product: Product) => {
  const lots = getLots(product);
  const expired = lots.filter((l) => l.days < 0);
  const critical = lots.filter(
    (l) => l.days >= 0 && l.days <= EXPIRY_CRITICAL_DAYS,
  );
  const soon = lots.filter(
    (l) => l.days > EXPIRY_CRITICAL_DAYS && l.days <= EXPIRY_SOON_DAYS,
  );
  return {
    lots,
    expiredCount: expired.length,
    criticalCount: critical.length,
    soonCount: soon.length,
    soonest: lots[0] ?? null,
    hasRisk: expired.length + critical.length + soon.length > 0,
    totalAtRisk: [...expired, ...critical, ...soon].reduce(
      (s, l) => s + l.quantity,
      0,
    ),
  };
};

const hasExpiryRisk = (product: Product) => getExpirySummary(product).hasRisk;

const reorderPoint = (product: Product) => {
  const values = (product.inventories ?? [])
    .map((row) => num(row.reorderPoint))
    .filter((value) => value > 0);
  return values.length ? Math.max(...values) : 10;
};

const suggestedReorder = (product: Product) => {
  const quantities = (product.inventories ?? []).map((row) =>
    num(row.reorderQty),
  );
  const reorderQty = quantities.length ? Math.max(...quantities) : 0;
  return Math.max(reorderQty, reorderPoint(product) - num(product.stock));
};

const productSubtitle = (product: Product) =>
  [
    product.genericName,
    product.activeIngredient,
    product.strength,
    product.dosageForm,
  ]
    .filter(Boolean)
    .join(" · ");

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

/* ------------------------------------------------------------------ */
/*  Mobile Back — history stack guard                                  */
/* ------------------------------------------------------------------ */

/**
 * Pushes a history state when `active` becomes true.
 * When user presses the browser back button (mobile back), we intercept
 * `popstate` and call `onBack` instead of leaving the page.
 */
function useMobileBack(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    // Push a dummy state so pressing back triggers popstate
    const marker = { __modalGuard: true, ts: Date.now() };
    window.history.pushState(marker, "");

    const handlePop = () => {
      // Back pressed → close modal and re-push guard so the next back
      // press still doesn't leave the page
      onBackRef.current();
    };
    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
    };
  }, [active]);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface InventoryViewProps {
  products: Product[];
  storeId?: string;
  userRole?: string;
  userPermissions?: string[];
  isLoading?: boolean;
  onRequestSubmitted?: () => void;
  onAdjustStock?: (payload: AdjustPayload) => Promise<void>;
  onTransferStock?: (payload: TransferPayload) => Promise<void>;
  stores?: StoreOption[];
  suppliers?: SupplierOption[];
  movements?: StockMovement[];
  onCreatePurchaseOrder?: (
    po: Omit<PurchaseOrder, "id" | "createdAt">,
  ) => Promise<void>;
  onDisposeStock?: (payload: AdjustPayload) => Promise<void>;
}

export function InventoryView({
  products,
  storeId,
  userRole = "CASHIER",
  userPermissions = [],
  isLoading = false,
  onRequestSubmitted,
  onAdjustStock,
  onTransferStock,
  stores = [],
  suppliers = [],
  movements: externalMovements = [],
  onCreatePurchaseOrder,
  onDisposeStock,
}: InventoryViewProps) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selected, setSelected] = useState<Product | null>(null);
  const [requestTarget, setRequestTarget] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [transferTarget, setTransferTarget] = useState<Product | null>(null);
  const [purchaseTarget, setPurchaseTarget] = useState<Product | null>(null);

  const [movementsOpen, setMovementsOpen] = useState(false);

  const requestQueryStoreId = ["ADMIN", "SUPER_ADMIN"].includes(userRole)
    ? undefined
    : storeId;

  const { data: stockRequests = [] } = useGetStockRequestsQuery(
    { storeId: requestQueryStoreId },
    {
      pollingInterval: 15000,
      skip: !storeId && !["ADMIN", "SUPER_ADMIN"].includes(userRole),
    },
  );

  const [createStockRequest, { isLoading: isRequesting }] =
    useCreateStockRequestMutation();

  const canCreateRequests = ["CASHIER", "MANAGER"].includes(userRole);
  const canManageStock = ["ADMIN", "SUPER_ADMIN"].includes(userRole) ||
    (userRole === "MANAGER" && userPermissions.includes("MANAGE_INVENTORY"));
  const searchRef = useRef<HTMLInputElement>(null);

  const storeName = useMemo(
    () => stores.find((s) => s.id === storeId)?.name,
    [stores, storeId],
  );

  /* ---------------------- mobile back guards ------------------- */

  const closeTopmost = useCallback(() => {
    if (movementsOpen) {
      setMovementsOpen(false);
      return true;
    }
    if (purchaseTarget) {
      setPurchaseTarget(null);
      return true;
    }
    if (transferTarget) {
      setTransferTarget(null);
      return true;
    }
    if (adjustTarget) {
      setAdjustTarget(null);
      return true;
    }
    if (requestTarget) {
      setRequestTarget(null);
      return true;
    }
    if (selected) {
      setSelected(null);
      return true;
    }
    return false;
  }, [
    movementsOpen,
    purchaseTarget,
    transferTarget,
    adjustTarget,
    requestTarget,
    selected,
  ]);

  const anyOverlayOpen =
    !!selected ||
    !!requestTarget ||
    !!adjustTarget ||
    !!transferTarget ||
    !!purchaseTarget ||
    movementsOpen;

  useMobileBack(anyOverlayOpen, closeTopmost);

  /* ---------------------- merged movements --------------------- */

  const allMovements = useMemo(
    () => [...externalMovements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    [externalMovements],
  );

  /* ------------------------- filtering ------------------------- */

  const searchFiltered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.barcode, product.category]
        .map((value) => (value || "").toString().toLowerCase())
        .some((value) => value.includes(normalized)),
    );
  }, [products, query]);

  const filteredProducts = useMemo(() => {
    if (stockFilter === "all") return searchFiltered;
    if (stockFilter === "expiring") return searchFiltered.filter(hasExpiryRisk);
    if (stockFilter === "expired")
      return searchFiltered.filter((product) => {
        const summary = getExpirySummary(product);
        return summary.expiredCount > 0;
      });
    if (stockFilter === "reorder")
      return searchFiltered.filter(
        (product) => num(product.stock) <= reorderPoint(product),
      );
    return searchFiltered.filter(
      (product) => getTone(num(product.stock)) === stockFilter,
    );
  }, [searchFiltered, stockFilter]);

  /* -------------------------- sorting -------------------------- */

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProducts];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "price") cmp = num(a.price) - num(b.price);
      else if (sortKey === "stock") cmp = num(a.stock) - num(b.stock);
      else
        cmp = String(a[sortKey] ?? "").localeCompare(
          String(b[sortKey] ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredProducts, sortKey, sortDir]);

  /* ------------------------ pagination ------------------------- */

  const totalItems = sortedProducts.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize <= 0) return sortedProducts;
    const start = (activePage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, activePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const endItem =
    pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

  /* --------------------------- stats --------------------------- */

  const stats = useMemo(() => {
    const result = {
      total: searchFiltered.length,
      in: 0,
      low: 0,
      critical: 0,
      out: 0,
      expiring: 0,
      expired: 0,
      expiryCritical: 0,
      expirySoon: 0,
      unitsAtRisk: 0,
      reorder: 0,
      stockValue: 0,
      units: 0,
    };
    for (const product of searchFiltered) {
      const stock = num(product.stock);
      result[getTone(stock)] += 1;
      result.units += stock;
      result.stockValue += stock * num(product.price);

      const summary = getExpirySummary(product);
      if (summary.expiredCount > 0) result.expired += 1;
      if (summary.criticalCount > 0) result.expiryCritical += 1;
      if (summary.soonCount > 0) result.expirySoon += 1;
      if (summary.hasRisk) {
        result.expiring += 1;
        result.unitsAtRisk += summary.totalAtRisk;
      }
      if (stock <= reorderPoint(product)) result.reorder += 1;
    }
    return result;
  }, [searchFiltered]);

  const chips: { id: StockFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "in", label: "In stock", count: stats.in },
    { id: "low", label: "Low", count: stats.low },
    { id: "critical", label: "Critical", count: stats.critical },
    { id: "out", label: "Out of stock", count: stats.out },
    {
      id: "expiring",
      label: `Expiring ≤${EXPIRY_SOON_DAYS}d`,
      count: stats.expiring,
    },
    { id: "expired", label: "Expired", count: stats.expired },
    { id: "reorder", label: "Reorder", count: stats.reorder },
  ];

  const filtersActive = query !== "" || stockFilter !== "all";

  /* -------------------------- handlers ------------------------- */

  const resetPage = useCallback(() => setCurrentPage(1), []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "price" || key === "stock" ? "desc" : "asc");
    }
    resetPage();
  };

  const resetFilters = () => {
    setQuery("");
    setStockFilter("all");
    setSortKey("name");
    setSortDir("asc");
    resetPage();
  };

  const exportCsv = () => {
    const headers = [
      "Name",
      "SKU",
      "Barcode",
      "Category",
      "Price (MMK)",
      "Stock",
      "Status",
      "Expired lots",
      "Expiring ≤30d",
      "Expiring ≤90d",
    ];
    const rows = sortedProducts.map((product) => {
      const stock = num(product.stock);
      const tone = getTone(stock);
      const summary = getExpirySummary(product);
      return [
        product.name,
        product.sku,
        product.barcode ?? "",
        product.category ?? "",
        num(product.price),
        stock,
        TONE_META[tone].label,
        summary.expiredCount,
        summary.criticalCount,
        summary.soonCount,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ---------------------- keyboard shortcuts ------------------- */

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (
        !typing &&
        (event.key === "/" ||
          ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"))
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (event.key === "Escape") {
        closeTopmost();
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeTopmost]);

  /* ---------------------------- render ------------------------- */

  return (
    <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white md:text-3xl">
            Products &amp; Stock
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {products.length.toLocaleString()} products loaded from the selected
            store
            {filtersActive && (
              <>
                {" · "}
                <span className="text-sky-400">
                  {stats.total.toLocaleString()} matching filters
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-500 lg:flex">
            <Keyboard className="h-3.5 w-3.5" />
            <kbd className="font-sans font-semibold text-slate-300">/</kbd>
            or
            <kbd className="font-sans font-semibold text-slate-300">⌘K</kbd>
            to search
          </span>

          <button
            type="button"
            onClick={() => setMovementsOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
          >
            <History className="h-3.5 w-3.5" />
            Movements
            {allMovements.length > 0 && (
              <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                {allMovements.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={sortedProducts.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Package}
          label="Products"
          value={stats.total.toLocaleString()}
          note={`${stats.units.toLocaleString()} units on hand`}
          tone="sky"
        />
        <StatCard
          icon={Wallet}
          label="Stock value"
          value={`${Math.round(stats.stockValue).toLocaleString()} MMK`}
          note="Retail price × quantity"
          tone="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label="Needs attention"
          value={(stats.low + stats.critical + stats.out).toLocaleString()}
          note={`${stats.critical} critical · ${stats.out} out of stock`}
          tone={stats.critical + stats.out > 0 ? "rose" : "amber"}
        />
        <StatCard
          icon={CalendarClock}
          label="Expiry risk"
          value={stats.expiring.toLocaleString()}
          note={
            stats.expired > 0
              ? `${stats.expired} expired · ${stats.unitsAtRisk} units at risk`
              : `Lots expiring within ${EXPIRY_SOON_DAYS} days`
          }
          tone={
            stats.expired > 0 ? "rose" : stats.expiring > 0 ? "amber" : "slate"
          }
        />
      </section>

      {/* Search / filter bar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name, SKU, barcode…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white placeholder-slate-500 transition-colors focus:border-sky-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                resetPage();
                searchRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 md:ml-auto md:justify-end">
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Per page:
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                resetPage();
              }}
              className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </label>
        </div>
      </div>

      {/* Quick filter chips */}
      <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-2 md:flex-wrap md:pb-0">
        {chips.map((chip) => {
          const active = stockFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setStockFilter(chip.id);
                resetPage();
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                active
                  ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active
                    ? "bg-sky-500/25 text-sky-100"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {chip.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* ================= DESKTOP TABLE ================= */}
      <div className="hidden md:block flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/70">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
            <tr className="border-b border-slate-800 text-left">
              <SortableHeader
                label="Product"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="SKU"
                sortKey="sku"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Category"
                sortKey="category"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Price"
                sortKey="price"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableHeader
                label="Stock & Expiry"
                sortKey="stock"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product) => {
              const stock = num(product.stock);
              const tone = TONE_META[getTone(stock)];
              const subtitle = productSubtitle(product);
              const summary = getExpirySummary(product);
              const soonest = summary.soonest;
              const soonestTier = soonest
                ? getExpiryTier(soonest.days)
                : "none";
              const soonestMeta = EXPIRY_TIER_META[soonestTier];

              return (
                <tr
                  key={product.id}
                  onClick={() => setSelected(product)}
                  className="cursor-pointer border-b border-slate-800/50 transition-colors last:border-0 hover:bg-slate-800/30"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      {summary.hasRisk && (
                        <AlertTriangle
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            summary.expiredCount > 0
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                          aria-label="Expiry risk"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="block font-semibold text-slate-100">
                          {product.name}
                        </span>
                        {subtitle && (
                          <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-400/90">
                            {subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3 font-mono text-xs text-slate-400">
                    {product.sku}
                  </td>

                  <td className="px-5 py-3">
                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                      {product.category || "Uncategorised"}
                    </span>
                  </td>

                  <td className="px-5 py-3 text-right font-bold tabular-nums text-white">
                    {num(product.price).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      MMK
                    </span>
                  </td>

                  <td className="px-5 py-3 text-right">
                    <div className="font-bold tabular-nums text-white">
                      {stock.toLocaleString()}
                    </div>

                    {stock <= reorderPoint(product) && (
                      <div className="mt-1 text-[10px] font-semibold text-amber-300">
                        Reorder {suggestedReorder(product)} · min{" "}
                        {reorderPoint(product)}
                      </div>
                    )}

                    {summary.lots.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                        {summary.expiredCount > 0 && (
                          <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                            {summary.expiredCount} expired
                          </span>
                        )}
                        {summary.criticalCount > 0 && (
                          <span className="rounded-full border border-orange-500/40 bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
                            {summary.criticalCount} ≤{EXPIRY_CRITICAL_DAYS}d
                          </span>
                        )}
                        {summary.soonCount > 0 && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                            {summary.soonCount} ≤{EXPIRY_SOON_DAYS}d
                          </span>
                        )}
                      </div>
                    )}

                    {soonest?.expiryDate && (
                      <div
                        className={`mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${soonestMeta.chip}`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {soonest.days < 0
                          ? `Exp ${Math.abs(soonest.days)}d ago`
                          : `Exp in ${soonest.days}d`}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3 text-center">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.className}`}
                    >
                      {tone.label}
                    </span>
                    {canCreateRequests &&
                      storeId &&
                      stock <= reorderPoint(product) &&
                      (() => {
                        const existingRequest = stockRequests.find(
                          (request: any) =>
                            request.storeId === storeId &&
                            request.productId === product.productId &&
                            request.variantId === product.variantId &&
                            ["PENDING", "ACKNOWLEDGED"].includes(
                              request.status,
                            ),
                        );
                        return (
                          <button
                            type="button"
                            disabled={!!existingRequest}
                            onClick={(event) => {
                              event.stopPropagation();
                              setRequestTarget(product);
                            }}
                            className="mt-2 block w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
                          >
                            {existingRequest
                              ? `Request ${existingRequest.status.toLowerCase()}`
                              : "Request stock"}
                          </button>
                        );
                      })()}
                  </td>
                </tr>
              );
            })}

            {paginatedProducts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  {isLoading
                    ? "Loading products…"
                    : filtersActive
                      ? "No products match the current filters."
                      : "No products found in this store."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MOBILE CARDS ================= */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <p className="p-10 text-center text-sm text-slate-400">
            Loading products…
          </p>
        ) : paginatedProducts.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            {filtersActive
              ? "No products match the current filters."
              : "No products found in this store."}
          </p>
        ) : (
          paginatedProducts.map((product) => {
            const stock = num(product.stock);
            const tone = TONE_META[getTone(stock)];
            const subtitle = productSubtitle(product);
            const summary = getExpirySummary(product);
            const soonest = summary.soonest;
            const soonestMeta = soonest
              ? EXPIRY_TIER_META[getExpiryTier(soonest.days)]
              : null;

            const existingRequest =
              canCreateRequests && storeId && stock <= reorderPoint(product)
                ? stockRequests.find(
                    (request: any) =>
                      request.storeId === storeId &&
                      request.productId === product.productId &&
                      request.variantId === product.variantId &&
                      ["PENDING", "ACKNOWLEDGED"].includes(request.status),
                  )
                : null;

            return (
              <div
                key={product.id}
                onClick={() => setSelected(product)}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {summary.hasRisk && (
                        <AlertTriangle
                          className={`h-3.5 w-3.5 shrink-0 ${
                            summary.expiredCount > 0
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                        />
                      )}
                      <span className="font-semibold text-slate-100 truncate">
                        {product.name}
                      </span>
                    </div>
                    {subtitle && (
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-400/90 truncate">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.className}`}
                  >
                    {tone.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">
                    {product.sku}
                  </span>
                  <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                    {product.category || "Uncategorised"}
                  </span>
                </div>

                {soonest?.expiryDate && soonestMeta && (
                  <div
                    className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${soonestMeta.border}`}
                  >
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {soonest.days < 0
                        ? `Expired ${Math.abs(soonest.days)}d ago`
                        : `Expires in ${soonest.days}d`}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${soonestMeta.chip}`}
                    >
                      {soonestMeta.label}
                    </span>
                  </div>
                )}

                <div className="flex items-end justify-between border-t border-slate-800/80 pt-3">
                  <div>
                    <p className="text-[10px] text-slate-500">Price</p>
                    <p className="text-sm font-bold text-white">
                      {num(product.price).toLocaleString()} MMK
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Stock</p>
                    <p className="text-sm font-bold text-white">
                      {stock.toLocaleString()}
                    </p>
                    {stock <= reorderPoint(product) && (
                      <p className="text-[10px] font-semibold text-amber-300 mt-0.5">
                        Reorder {suggestedReorder(product)} · min{" "}
                        {reorderPoint(product)}
                      </p>
                    )}
                  </div>
                </div>

                {canCreateRequests &&
                  storeId &&
                  stock <= reorderPoint(product) && (
                    <button
                      type="button"
                      disabled={!!existingRequest}
                      onClick={(event) => {
                        event.stopPropagation();
                        setRequestTarget(product);
                      }}
                      className="mt-1 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
                    >
                      {existingRequest
                        ? `Request ${existingRequest.status.toLowerCase()}`
                        : "Request stock"}
                    </button>
                  )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 px-2 md:flex-row md:gap-4">
          <p className="text-center text-xs text-slate-400 md:text-left">
            Showing{" "}
            <strong className="text-white">{startItem.toLocaleString()}</strong>{" "}
            to{" "}
            <strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
            of{" "}
            <strong className="text-white">
              {totalItems.toLocaleString()}
            </strong>{" "}
            items
          </p>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <PageButton
                onClick={() => setCurrentPage(1)}
                disabled={activePage <= 1}
                label="First page"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </PageButton>
              <PageButton
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={activePage <= 1}
                label="Previous page"
                wide
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </PageButton>

              <span className="px-2 text-xs text-slate-400">
                Page <strong className="text-white">{activePage}</strong> of{" "}
                {totalPages}
              </span>

              <PageButton
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={activePage >= totalPages}
                label="Next page"
                wide
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </PageButton>
              <PageButton
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage >= totalPages}
                label="Last page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </PageButton>
            </div>
          )}
        </div>
      )}

      {/* ======================= DRAWER ======================= */}
      {selected && (
        <ProductDrawer
          product={selected}
          onClose={() => setSelected(null)}
          canManage={canManageStock}
          movements={allMovements}
          onAdjust={(p) => {
            setAdjustTarget(p);
            setSelected(null);
          }}
          onTransfer={(p) => {
            setTransferTarget(p);
            setSelected(null);
          }}
          onRequest={(p) => {
            setRequestTarget(p);
            setSelected(null);
          }}
          onPurchase={(p) => {
            setPurchaseTarget(p);
            setSelected(null);
          }}
          onDispose={(p, lot, mode) => {
            void (async () => {
              try {
                if (!onDisposeStock || !p.productId || !p.variantId || !lot.lotId) {
                  throw new Error("This batch cannot be adjusted because its inventory link is missing.");
                }
                await onDisposeStock({
                  productId: p.productId,
                  variantId: p.baseUnitVariantId || p.variantId,
                  lotId: lot.lotId,
                  quantityIsBaseUnit: true,
                  quantity: -lot.quantity,
                  reason: mode === "DISPOSE" ? "expired_disposal" : "quarantine",
                  notes: `Lot ${lot.number}${lot.expiryDate ? ` · expiry ${lot.expiryDate}` : ""}`,
                });
                setSelected(null);
              } catch (error: any) {
                window.alert(error?.data?.message || error?.message || "Could not update this batch.");
              }
            })();
          }}
        />
      )}

      {/* ======================= REQUEST MODAL ======================= */}
      {requestTarget && (
        <RequestStockModal
          product={requestTarget}
          storeName={storeName}
          suggestedQty={suggestedReorder(requestTarget)}
          isSubmitting={isRequesting}
          onClose={() => setRequestTarget(null)}
          onSubmit={async (payload) => {
            if (
              !storeId ||
              !requestTarget.productId ||
              !requestTarget.variantId
            )
              return;
            try {
              const result = await createStockRequest({
                storeId,
                productId: requestTarget.productId,
                variantId: requestTarget.variantId,
                quantity: payload.quantity,
                reason: `${payload.reason}${payload.urgency !== "normal" ? ` [${payload.urgency}]` : ""}${payload.neededBy ? ` · by ${payload.neededBy}` : ""}${payload.notes ? ` · ${payload.notes}` : ""}`,
              }).unwrap();
              setRequestTarget(null);
              if (result?.duplicate)
                window.alert(
                  "A request for this variant is already open. You can track it under Stock requests.",
                );
              onRequestSubmitted?.();
            } catch (error: any) {
              window.alert(
                error?.data?.message || "Could not submit stock request.",
              );
            }
          }}
        />
      )}

      {/* ======================= ADJUST MODAL ======================= */}
      {adjustTarget && (
        <AdjustStockModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSubmit={async (payload) => {
            try {
              if (!onAdjustStock) throw new Error("Stock adjustment is unavailable for this account.");
              await onAdjustStock(payload);
              setAdjustTarget(null);
            } catch (error: any) {
              window.alert(error?.data?.message || "Could not adjust stock.");
            }
          }}
        />
      )}

      {/* ======================= TRANSFER MODAL ======================= */}
      {transferTarget && (
        <TransferStockModal
          product={transferTarget}
          stores={stores}
          fromStoreId={storeId}
          onClose={() => setTransferTarget(null)}
          onSubmit={async (payload) => {
            try {
              if (!onTransferStock) throw new Error("Stock transfer is unavailable for this account.");
              await onTransferStock(payload);
              setTransferTarget(null);
            } catch (error: any) {
              window.alert(error?.data?.message || "Could not transfer stock.");
            }
          }}
        />
      )}

      {/* ======================= PURCHASE ORDER MODAL ======================= */}
      {purchaseTarget && (
        <PurchaseOrderModal
          product={purchaseTarget}
          storeId={storeId}
          storeName={storeName}
          suppliers={suppliers}
          suggestedQty={suggestedReorder(purchaseTarget)}
          onClose={() => setPurchaseTarget(null)}
          onSubmit={async (po) => {
            try {
              if (!onCreatePurchaseOrder) throw new Error("Purchase orders are unavailable for this account.");
              await onCreatePurchaseOrder(po);
              setPurchaseTarget(null);
            } catch (error: any) {
              window.alert(
                error?.data?.message || "Could not create purchase order.",
              );
            }
          }}
        />
      )}

      {/* ======================= MOVEMENTS MODAL ======================= */}
      {movementsOpen && (
        <StockMovementsModal
          movements={allMovements}
          stores={stores}
          onClose={() => setMovementsOpen(false)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

const TONES: Record<string, string> = {
  sky: "border-sky-500/20 bg-sky-500/5 text-sky-300",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/5 text-amber-300",
  rose: "border-rose-500/20 bg-rose-500/5 text-rose-300",
  slate: "border-slate-800 bg-slate-900 text-slate-300",
};

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  note: string;
  tone: keyof typeof TONES;
}) {
  return (
    <article className={`rounded-2xl border p-3 md:p-4 ${TONES[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider opacity-80 truncate">
          {label}
        </p>
      </div>
      <p className="mt-2 truncate text-lg md:text-xl font-black text-white">
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] md:text-[11px] text-slate-400">
        {note}
      </p>
    </article>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wider ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-200 ${
          active ? "text-sky-400" : "text-slate-400"
        }`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  label,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40 ${
        wide ? "px-3" : "px-2"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable pickers                                                   */
/* ------------------------------------------------------------------ */

function StorePicker({
  stores,
  value,
  onChange,
  exclude,
  label = "Select store",
  emptyText = "No stores available",
}: {
  stores: StoreOption[];
  value: string;
  onChange: (id: string) => void;
  exclude?: string;
  label?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const list = exclude ? stores.filter((s) => s.id !== exclude) : stores;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [stores, exclude, query]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-300">
        {label}
      </label>

      {stores.length > 4 && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
      )}

      <div
        className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-1.5"
        role="radiogroup"
      >
        {options.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">{emptyText}</p>
        ) : (
          options.map((store) => {
            const active = value === store.id;
            return (
              <button
                key={store.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(store.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-sky-500/50 bg-sky-500/15"
                    : "border-transparent hover:border-slate-700 hover:bg-slate-800/40"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                    active
                      ? "border-sky-400/40 bg-sky-400/15 text-sky-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-bold ${
                      active ? "text-sky-200" : "text-slate-200"
                    }`}
                  >
                    {store.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-slate-500">
                    {store.id}
                  </span>
                </span>
                {active && (
                  <span className="shrink-0 rounded-md bg-sky-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                    ✓
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function RadioCards<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: {
    value: T;
    label: string;
    description?: string;
    tone?: "in" | "out" | "neutral";
  }[];
}) {
  const toneMeta = {
    in: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    out: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    neutral: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  } as const;

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-semibold text-slate-300">{label}</p>
      )}
      <div className="grid gap-1.5" role="radiogroup">
        {options.map((opt) => {
          const active = value === opt.value;
          const tone = opt.tone ?? "neutral";
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? toneMeta[tone]
                  : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
              }`}
            >
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-current" : "border-slate-600"
                }`}
              >
                {active && <span className="h-2 w-2 rounded-full bg-current" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{opt.label}</span>
                {opt.description && (
                  <span className="mt-0.5 block text-[11px] opacity-70">
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: {
    value: T;
    label: string;
    tone?: "in" | "warn" | "out" | "neutral";
  }[];
}) {
  const toneMeta = {
    in: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
    warn: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40",
    out: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40",
    neutral: "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40",
  } as const;

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-semibold text-slate-300">{label}</p>
      )}
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-lg py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                active
                  ? toneMeta[opt.tone ?? "neutral"]
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  unit = "units",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const clamp = (n: number) =>
    Math.max(min, Math.min(max ?? Number.MAX_SAFE_INTEGER, n));

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-300">Quantity</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-30"
        >
          <span className="text-lg font-black leading-none">−</span>
        </button>

        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 pr-14 text-center text-lg font-black text-white outline-none focus:border-sky-500"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-500">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={max != null && value >= max}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-30"
        >
          <span className="text-lg font-black leading-none">+</span>
        </button>
      </div>

      <div className="mt-2 flex gap-1.5">
        {[5, 10, 25, 50, 100]
          .filter((n) => max == null || n <= max)
          .map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(clamp(n))}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-[10px] font-bold text-slate-400 hover:border-slate-700 hover:text-white"
            >
              {n}
            </button>
          ))}
      </div>
    </div>
  );
}

function ExpiryBadge({ product }: { product: Product }) {
  const summary = getExpirySummary(product);
  if (summary.lots.length === 0) return null;

  const soonest = summary.soonest;
  const meta = soonest ? EXPIRY_TIER_META[getExpiryTier(soonest.days)] : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <CalendarClock className="h-3 w-3" />
          Expiry Status
        </span>
        {summary.expiredCount > 0 && (
          <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-300">
            {summary.expiredCount} expired
          </span>
        )}
      </div>

      {soonest?.expiryDate && meta && (
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">
              Lot {soonest.number}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {soonest.days < 0
                ? `Expired ${Math.abs(soonest.days)} days ago`
                : `Expires in ${soonest.days} days`}
              {" · "}
              {new Date(soonest.expiryDate).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
          >
            {meta.label}
          </span>
        </div>
      )}

      {summary.lots.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800 pt-2">
          {summary.lots.slice(0, 4).map((lot) => {
            const m = EXPIRY_TIER_META[getExpiryTier(lot.days)];
            return (
              <span
                key={lot.key}
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${m.chip}`}
              >
                {lot.number} · {lot.quantity}
              </span>
            );
          })}
          {summary.lots.length > 4 && (
            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
              +{summary.lots.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drawer                                                             */
/* ------------------------------------------------------------------ */

function ProductDrawer({
  product,
  onClose,
  canManage = false,
  movements = [],
  onAdjust,
  onTransfer,
  onRequest,
  onPurchase,
  onDispose,
}: {
  product: Product;
  onClose: () => void;
  canManage?: boolean;
  movements?: StockMovement[];
  onAdjust?: (p: Product) => void;
  onTransfer?: (p: Product) => void;
  onRequest?: (p: Product) => void;
  onPurchase?: (p: Product) => void;
  onDispose?: (
    p: Product,
    lot: ReturnType<typeof getLots>[number],
    mode: "DISPOSE" | "QUARANTINE",
  ) => void;
}) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const stock = num(product.stock);
  const tone = TONE_META[getTone(stock)];
  const subtitle = productSubtitle(product);
  const summary = getExpirySummary(product);

  const productMovements = useMemo(
    () =>
      movements
        .filter(
          (m) =>
            m.productId === product.productId ||
            m.productId === (product as any).id,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [movements, product],
  );

  const rows: [string, string][] = [
    ["SKU", product.sku || "—"],
    ["Barcode", product.barcode || "—"],
    ["Category", product.category || "Uncategorised"],
    ["Unit price", `${num(product.price).toLocaleString()} MMK`],
    ["On hand", `${stock.toLocaleString()} units`],
    ["Reorder point", `${reorderPoint(product)} units`],
    ["Suggested reorder", `${suggestedReorder(product)} units`],
    ["Stock value", `${(stock * num(product.price)).toLocaleString()} MMK`],
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${product.name}`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-slate-800 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4 md:p-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {/* Mobile back button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 md:hidden"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-white">{product.name}</h3>
              {subtitle && (
                <p className="mt-1 text-xs font-medium text-emerald-400/90">
                  {subtitle}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tone.className}`}
                >
                  {tone.label}
                </span>
                {summary.expiredCount > 0 && (
                  <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    {summary.expiredCount} expired
                  </span>
                )}
                {summary.criticalCount + summary.soonCount > 0 && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {summary.criticalCount + summary.soonCount} expiring soon
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="hidden rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick actions */}
        {canManage && (
          <div className="grid grid-cols-4 gap-2 border-b border-slate-800 bg-slate-950/50 p-3">
            <button
              type="button"
              onClick={() => onAdjust?.(product)}
              className="flex flex-col items-center gap-1 rounded-xl border border-sky-500/30 bg-sky-500/10 px-1.5 py-2.5 text-[10px] font-bold text-sky-200 transition hover:bg-sky-500/20"
            >
              <Package className="h-4 w-4" />
              Adjust
            </button>
            <button
              type="button"
              onClick={() => onTransfer?.(product)}
              className="flex flex-col items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-1.5 py-2.5 text-[10px] font-bold text-violet-200 transition hover:bg-violet-500/20"
            >
              <Truck className="h-4 w-4" />
              Transfer
            </button>
            <button
              type="button"
              onClick={() => onRequest?.(product)}
              className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-1.5 py-2.5 text-[10px] font-bold text-amber-200 transition hover:bg-amber-500/20"
            >
              <Send className="h-4 w-4" />
              Request
            </button>
            <button
              type="button"
              onClick={() => onPurchase?.(product)}
              className="flex flex-col items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-2.5 text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <ShoppingCart className="h-4 w-4" />
              Purchase
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-800 px-3">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "batches", label: `Batches (${summary.lots.length})` },
              { id: "history", label: "History" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-3 text-xs font-bold transition ${
                tab === t.id
                  ? "text-sky-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {tab === "overview" && (
            <>
              <dl className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                {rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
                  >
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="truncate font-semibold text-slate-100">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {product.variants && product.variants.length > 0 && (
                <section className="mt-5">
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Variants ({product.variants.length})
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <li
                        key={v.id}
                        className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[11px] font-semibold text-slate-300"
                      >
                        {v.name}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {tab === "batches" && (
            <>
              {summary.lots.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  No batch/lot records for this product.
                </p>
              ) : (
                <ul className="space-y-2">
                  {summary.lots.map((lot) => {
                    const tier = getExpiryTier(lot.days);
                    const meta = EXPIRY_TIER_META[tier];
                    return (
                      <li
                        key={lot.key}
                        className={`rounded-xl border p-3 ${meta.border}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-100">
                              Lot {lot.number}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {lot.expiryDate
                                ? lot.days < 0
                                  ? `Expired ${Math.abs(lot.days)} day(s) ago`
                                  : `Expires ${new Date(
                                      lot.expiryDate,
                                    ).toLocaleDateString()} · ${lot.days}d left`
                                : "No expiry recorded"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="font-bold tabular-nums text-white">
                              {lot.quantity.toLocaleString()}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.chip}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </div>

                        {canManage && tier !== "ok" && tier !== "none" && (
                          <div className="mt-2 flex gap-1.5 border-t border-white/5 pt-2">
                            <button
                              type="button"
                              onClick={() =>
                                onDispose?.(product, lot, "DISPOSE")
                              }
                              className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20"
                            >
                              Dispose
                            </button>
                            <button
                              type="button"
                              className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"
                            >
                              Return
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDispose?.(product, lot, "QUARANTINE")
                              }
                              className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-800"
                            >
                              Quarantine
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {productMovements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
                  <History className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-3 text-sm font-semibold text-slate-400">
                    No stock movements yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Adjustments, transfers, and sales will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    {productMovements.length} movement
                    {productMovements.length === 1 ? "" : "s"} recorded
                  </p>
                  <ul className="space-y-1.5">
                    {productMovements.slice(0, 30).map((m) => {
                      const meta = MOVEMENT_META[m.type];
                      const Icon = meta.icon;
                      const isPositive = m.quantity > 0;
                      return (
                        <li
                          key={m.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.chip}`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}
                                >
                                  {meta.label}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatRelativeTime(m.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-xs text-slate-200">
                                {m.reference ||
                                  m.notes ||
                                  m.reason ||
                                  meta.label}
                              </p>
                              {m.lotNumber && (
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  Lot {m.lotNumber}
                                  {m.expiryDate &&
                                    ` · exp ${new Date(
                                      m.expiryDate,
                                    ).toLocaleDateString()}`}
                                </p>
                              )}
                              {m.userName && (
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  by {m.userName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={`font-mono text-sm font-bold ${
                                isPositive
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {m.quantity}
                            </p>
                            {m.balanceAfter != null && (
                              <p className="text-[10px] text-slate-500">
                                → {m.balanceAfter}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {productMovements.length > 30 && (
                      <li className="pt-1 text-center text-[10px] text-slate-500">
                        Showing latest 30 of {productMovements.length}
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Adjust Stock Modal                                                 */
/* ------------------------------------------------------------------ */

const ADJUST_REASONS = [
  {
    value: "damage",
    label: "Damaged / broken",
    description: "Items broken in transit or handling",
    tone: "out" as const,
  },
  {
    value: "expired",
    label: "Expired / destroyed",
    description: "Past expiry or destroyed per policy",
    tone: "out" as const,
  },
  {
    value: "miscount",
    label: "Inventory miscount",
    description: "Physical count differs from system",
    tone: "neutral" as const,
  },
  {
    value: "found",
    label: "Found / recovered",
    description: "Missing items located",
    tone: "in" as const,
  },
  {
    value: "theft",
    label: "Theft / loss",
    description: "Suspected theft or unexplained loss",
    tone: "out" as const,
  },
  {
    value: "sample",
    label: "Sample / giveaway",
    description: "Given as sample or promotional",
    tone: "neutral" as const,
  },
  {
    value: "other",
    label: "Other",
    description: "Specify in notes",
    tone: "neutral" as const,
  },
];

function AdjustStockModal({
  product,
  onClose,
  onSubmit,
}: {
  product: Product;
  onClose: () => void;
  onSubmit: (payload: AdjustPayload) => Promise<void>;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("damage");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentStock = num(product.stock);
  const signedDelta = direction === "in" ? quantity : -quantity;
  const newStock = currentStock + signedDelta;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!product.productId || !product.variantId) return;
    if (quantity < 1) return;
    setSubmitting(true);
    try {
      await onSubmit({
        productId: product.productId,
        variantId: product.variantId,
        quantity: signedDelta,
        reason,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 md:hidden"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div>
              <h3 className="text-lg font-bold text-white">Adjust stock</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {product.name} · {currentStock} on hand
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:text-white md:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <ExpiryBadge product={product} />

          <SegmentedControl<"in" | "out">
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "in", label: "Increase", tone: "in" },
              { value: "out", label: "Decrease", tone: "out" },
            ]}
          />

          <QuantityStepper value={quantity} onChange={setQuantity} min={1} />

          <RadioCards
            label="Reason"
            value={reason}
            onChange={setReason}
            options={ADJUST_REASONS}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-500">
              Preview
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {currentStock} →{" "}
              <span
                className={`font-bold ${
                  newStock < 0
                    ? "text-rose-400"
                    : signedDelta >= 0
                      ? "text-emerald-300"
                      : "text-amber-300"
                }`}
              >
                {newStock}
              </span>{" "}
              <span className="text-xs text-slate-500">
                ({signedDelta >= 0 ? "+" : ""}
                {signedDelta})
              </span>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/60 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || newStock < 0 || quantity < 1}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Apply adjustment"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Transfer Stock Modal                                               */
/* ------------------------------------------------------------------ */

function TransferStockModal({
  product,
  stores,
  fromStoreId,
  onClose,
  onSubmit,
}: {
  product: Product;
  stores: StoreOption[];
  fromStoreId?: string;
  onClose: () => void;
  onSubmit: (payload: TransferPayload) => Promise<void>;
}) {
  const [toStoreId, setToStoreId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stock = num(product.stock);
  const fromStore = stores.find((s) => s.id === fromStoreId);
  const toStore = stores.find((s) => s.id === toStoreId);
  const remaining = stock - quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.productId || !product.variantId) return;
    if (!toStoreId || !fromStoreId) return;
    if (quantity < 1 || quantity > stock) return;
    setSubmitting(true);
    try {
      await onSubmit({
        productId: product.productId,
        variantId: product.variantId,
        fromStoreId,
        toStoreId,
        quantity,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 md:hidden"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div>
              <h3 className="text-lg font-bold text-white">Transfer stock</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {product.name} · {stock} on hand
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:text-white md:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* FROM → TO visual */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">
                From
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-200">
                {fromStore?.name ?? "Current store"}
              </p>
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-full bg-violet-500/20 text-violet-300">
              <ArrowUpFromLine className="h-3.5 w-3.5" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                To
              </p>
              <p
                className={`mt-0.5 truncate text-sm font-bold ${
                  toStore ? "text-violet-200" : "text-slate-500"
                }`}
              >
                {toStore?.name ?? "— Select below —"}
              </p>
            </div>
          </div>

          <ExpiryBadge product={product} />

          <StorePicker
            label="Destination store"
            stores={stores}
            value={toStoreId}
            onChange={setToStoreId}
            exclude={fromStoreId}
            emptyText="No other stores available for transfer"
          />

          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={stock}
          />

          {toStoreId && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <p className="text-[10px] font-bold uppercase text-violet-300">
                After transfer
              </p>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-slate-400">{fromStore?.name}</p>
                  <p className="text-sm font-bold text-slate-200">
                    {stock} →{" "}
                    <span
                      className={
                        remaining < 0 ? "text-rose-400" : "text-amber-300"
                      }
                    >
                      {remaining}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{toStore?.name}</p>
                  <p className="text-sm font-bold text-emerald-300">
                    +{quantity}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Driver name, dispatch time, etc…"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/60 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              submitting || !toStoreId || quantity < 1 || quantity > stock
            }
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            <Truck className="h-3.5 w-3.5" />
            {submitting ? "Transferring…" : "Confirm transfer"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Request Stock Modal                                                */
/* ------------------------------------------------------------------ */

function RequestStockModal({
  product,
  storeName,
  suggestedQty,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  product: Product;
  storeName?: string;
  suggestedQty: number;
  onClose: () => void;
  onSubmit: (payload: {
    quantity: number;
    urgency: RequestUrgency;
    reason: string;
    neededBy?: string;
    notes?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}) {
  const [quantity, setQuantity] = useState(suggestedQty || 1);
  const [urgency, setUrgency] = useState<RequestUrgency>("normal");
  const [reason, setReason] = useState("low_stock");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");

  const stock = num(product.stock);
  const reorder = reorderPoint(product);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      quantity,
      urgency,
      reason,
      neededBy: neededBy || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 md:hidden"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div>
              <h3 className="text-lg font-bold text-white">Request Stock</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {product.name}
                {storeName && ` · ${storeName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:text-white md:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                On hand
              </p>
              <p className="mt-1 text-base font-black text-white">{stock}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Min
              </p>
              <p className="mt-1 text-base font-black text-amber-300">
                {reorder}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Suggest
              </p>
              <p className="mt-1 text-base font-black text-emerald-300">
                {suggestedQty}
              </p>
            </div>
          </div>

          <ExpiryBadge product={product} />

          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            unit="units"
          />

          <SegmentedControl<RequestUrgency>
            label="Urgency"
            value={urgency}
            onChange={setUrgency}
            options={[
              { value: "low", label: "Low", tone: "neutral" },
              { value: "normal", label: "Normal", tone: "neutral" },
              { value: "urgent", label: "Urgent", tone: "warn" },
              { value: "critical", label: "Critical", tone: "out" },
            ]}
          />

          <RadioCards
            label="Reason"
            value={reason}
            onChange={setReason}
            options={[
              {
                value: "low_stock",
                label: "Low stock",
                description: "Below reorder point",
                tone: "in",
              },
              {
                value: "out_of_stock",
                label: "Out of stock",
                description: "Sold out — urgent refill",
                tone: "out",
              },
              {
                value: "high_demand",
                label: "High demand",
                description: "Selling faster than usual",
                tone: "in",
              },
              {
                value: "expired",
                label: "Expired stock",
                description: "Current batch unusable",
                tone: "out",
              },
              {
                value: "new_order",
                label: "Customer order",
                description: "Specific customer request",
                tone: "neutral",
              },
              {
                value: "other",
                label: "Other",
                description: "Specify in notes",
                tone: "neutral",
              },
            ]}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Needed by (optional)
            </label>
            <input
              type="date"
              value={neededBy}
              min={todayISO()}
              onChange={(e) => setNeededBy(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Add context, batch preference, etc…"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
            <p className="mt-1 text-right text-[10px] text-slate-500">
              {notes.length}/500
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/60 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || quantity < 1}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Purchase Order Modal                                               */
/* ------------------------------------------------------------------ */

function PurchaseOrderModal({
  product,
  storeId,
  storeName,
  suppliers = [],
  suggestedQty,
  onClose,
  onSubmit,
}: {
  product: Product;
  storeId?: string;
  storeName?: string;
  suppliers?: SupplierOption[];
  suggestedQty: number;
  onClose: () => void;
  onSubmit: (po: Omit<PurchaseOrder, "id" | "createdAt">) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState(suggestedQty || 50);
  const [unitCost, setUnitCost] = useState<number>(
    (product as any).costPrice ?? 0,
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const total = quantity * unitCost;
  const supplier = suppliers.find((s) => s.id === supplierId);

  useEffect(() => {
    if (supplier?.leadTimeDays && !expectedDate) {
      const d = new Date();
      d.setDate(d.getDate() + supplier.leadTimeDays);
      setExpectedDate(d.toISOString().slice(0, 10));
    }
  }, [supplier, expectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !storeId || quantity < 1) return;
    setSubmitting(true);
    try {
      const line: PurchaseLine = {
        id: `pl-${Date.now()}`,
        productId: product.productId ?? "",
        variantId: product.variantId ?? "",
        productName: product.name,
        sku: product.sku,
        quantity,
        unitCost,
      };
      await onSubmit({
        supplierId,
        supplierName: supplier?.name ?? supplierId,
        storeId,
        storeName: storeName ?? storeId,
        status: "DRAFT",
        lines: [line],
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        subtotal: total,
        total,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 md:hidden"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Purchase Order</h3>
                <p className="text-xs text-slate-400">
                  {storeName ?? "Store"} · Draft
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:text-white md:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <StorePicker
            label="Supplier"
            stores={suppliers.map((s) => ({ id: s.id, name: s.name }))}
            value={supplierId}
            onChange={setSupplierId}
            emptyText="No suppliers configured"
          />

          {supplier?.leadTimeDays && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-300">
              ⏱ Lead time: {supplier.leadTimeDays} days
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-100">
                  {product.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {product.sku}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                Current: {num(product.stock)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-center text-base font-black text-white outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Unit cost
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitCost}
                  onChange={(e) =>
                    setUnitCost(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-center text-base font-black text-white outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Line total
              </span>
              <span className="font-mono text-lg font-black text-emerald-300">
                {total.toLocaleString()} MMK
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Expected delivery
            </label>
            <input
              type="date"
              value={expectedDate}
              min={todayISO()}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Supplier contact, delivery instructions…"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/60 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !supplierId || quantity < 1}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {submitting ? "Creating…" : "Create draft PO"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stock Movements Modal                                              */
/* ------------------------------------------------------------------ */

function StockMovementsModal({
  movements,
  stores,
  onClose,
}: {
  movements: StockMovement[];
  stores: StoreOption[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<MovementFilter>("all");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState<"today" | "7d" | "30d" | "all">("7d");

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      days === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : days === "7d"
          ? now - 7 * 86_400_000
          : days === "30d"
            ? now - 30 * 86_400_000
            : 0;

    const q = query.trim().toLowerCase();

    return movements.filter((m) => {
      if (new Date(m.createdAt).getTime() < cutoff) return false;
      if (filter === "in" && m.quantity <= 0) return false;
      if (filter === "out" && m.quantity >= 0) return false;
      if (filter === "transfer" && !m.type.startsWith("TRANSFER")) return false;
      if (filter === "adjust" && !m.type.startsWith("ADJUST")) return false;

      if (q) {
        const haystack = [
          m.productName,
          m.sku,
          m.reference,
          m.notes,
          m.reason,
          m.lotNumber,
        ]
          .map((v) => (v ?? "").toString().toLowerCase())
          .join(" ");
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [movements, filter, query, days]);

  const totals = useMemo(() => {
    let inQty = 0;
    let outQty = 0;
    for (const m of filtered) {
      if (m.quantity > 0) inQty += m.quantity;
      else outQty += Math.abs(m.quantity);
    }
    return { inQty, outQty, count: filtered.length };
  }, [filtered]);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 md:hidden"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <span className="hidden h-9 w-9 place-items-center rounded-xl bg-sky-500/15 text-sky-300 md:grid">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">
                Stock Movements
              </h3>
              <p className="text-[11px] text-slate-400">
                {totals.count} record{totals.count === 1 ? "" : "s"} · +
                {totals.inQty} in · −{totals.outQty} out
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-800 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product, SKU, reference…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-0.5">
            {(["all", "in", "out", "transfer", "adjust"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                  filter === f
                    ? "bg-sky-400 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-0.5">
            {(["today", "7d", "30d", "all"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                  days === d
                    ? "bg-sky-400 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <History className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-3 text-sm font-semibold text-slate-400">
                  No movements match
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different filter or date range.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((m) => {
                const meta = MOVEMENT_META[m.type];
                const Icon = meta.icon;
                const isPositive = m.quantity > 0;
                const fromName = m.fromStoreId
                  ? (stores.find((s) => s.id === m.fromStoreId)?.name ??
                    m.fromStoreId)
                  : null;
                const toName = m.toStoreId
                  ? (stores.find((s) => s.id === m.toStoreId)?.name ??
                    m.toStoreId)
                  : null;

                return (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-3 transition hover:border-slate-700"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.chip}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatRelativeTime(m.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                          {m.productName}
                          {m.sku && (
                            <span className="ml-2 font-mono text-[10px] font-normal text-slate-500">
                              {m.sku}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {m.reference ||
                            m.notes ||
                            (m.reason ? `Reason: ${m.reason}` : meta.label)}
                        </p>
                        {(fromName || toName) && (
                          <p className="mt-0.5 text-[10px] text-violet-300/80">
                            {fromName && `From ${fromName}`}
                            {fromName && toName && " → "}
                            {toName && `To ${toName}`}
                          </p>
                        )}
                        {m.lotNumber && (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Lot {m.lotNumber}
                            {m.expiryDate &&
                              ` · exp ${new Date(
                                m.expiryDate,
                              ).toLocaleDateString()}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`font-mono text-base font-black ${
                          isPositive ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {m.quantity}
                      </p>
                      {m.balanceAfter != null && (
                        <p className="text-[10px] text-slate-500">
                          bal {m.balanceAfter}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-[11px] text-slate-500">
          <span>
            Showing {filtered.length} of {movements.length} movements
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-300 hover:border-slate-600 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// import {
//   AlertTriangle,
//   ArrowDown,
//   ArrowUp,
//   ArrowUpDown,
//   ArrowDownToLine,
//   ArrowUpFromLine,
//   CalendarClock,
//   ChevronLeft,
//   ChevronRight,
//   ChevronsLeft,
//   ChevronsRight,
//   Download,
//   History,
//   Keyboard,
//   Package,
//   Plus,
//   RotateCcw,
//   Search,
//   Send,
//   ShoppingCart,
//   Trash2,
//   TrendingDown,
//   Truck,
//   Undo2,
//   Wallet,
//   X,
// } from "lucide-react";
// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { Product } from "../types";
// import {
//   useCreateStockRequestMutation,
//   useGetStockRequestsQuery,
// } from "../store/apiSlice";

// /* ------------------------------------------------------------------ */
// /*  Config                                                             */
// /* ------------------------------------------------------------------ */

// const LOW_THRESHOLD = 20;
// const CRITICAL_THRESHOLD = 5;
// const EXPIRY_CRITICAL_DAYS = 30;
// const EXPIRY_SOON_DAYS = 90;

// type SortKey = "name" | "sku" | "category" | "price" | "stock";
// type SortDir = "asc" | "desc";
// type StockFilter =
//   | "all"
//   | "in"
//   | "low"
//   | "critical"
//   | "out"
//   | "expiring"
//   | "expired"
//   | "reorder";
// type ExpiryTier = "expired" | "critical" | "soon" | "ok" | "none";
// type DrawerTab = "overview" | "batches" | "history";

// type MovementType =
//   | "SALE"
//   | "PURCHASE"
//   | "RETURN_IN"
//   | "RETURN_OUT"
//   | "ADJUST_IN"
//   | "ADJUST_OUT"
//   | "TRANSFER_IN"
//   | "TRANSFER_OUT"
//   | "DISPOSE"
//   | "QUARANTINE";

// interface StockMovement {
//   id: string;
//   productId: string;
//   variantId?: string;
//   productName: string;
//   sku?: string;
//   type: MovementType;
//   quantity: number; // signed: + for IN, - for OUT
//   balanceAfter?: number;
//   reason?: string;
//   notes?: string;
//   reference?: string;
//   fromStoreId?: string;
//   toStoreId?: string;
//   storeId?: string;
//   userId?: string;
//   userName?: string;
//   lotNumber?: string;
//   expiryDate?: string;
//   createdAt: string;
// }

// type MovementFilter = "all" | "in" | "out" | "transfer" | "adjust";

// /* ------------------------------------------------------------------ */
// /*  Helpers                                                            */
// /* ------------------------------------------------------------------ */

// const num = (value: unknown) => Number(value) || 0;

// const daysUntil = (date?: string) => {
//   if (!date) return Infinity;
//   const time = new Date(date).getTime();
//   if (Number.isNaN(time)) return Infinity;
//   return Math.ceil((time - Date.now()) / 86_400_000);
// };

// type Tone = "in" | "low" | "critical" | "out";

// const getTone = (stock: number): Tone => {
//   if (stock <= 0) return "out";
//   if (stock <= CRITICAL_THRESHOLD) return "critical";
//   if (stock <= LOW_THRESHOLD) return "low";
//   return "in";
// };

// const TONE_META: Record<Tone, { label: string; className: string }> = {
//   in: {
//     label: "In Stock",
//     className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
//   },
//   low: {
//     label: "Low",
//     className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
//   },
//   critical: {
//     label: "Critical",
//     className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
//   },
//   out: {
//     label: "Out of Stock",
//     className: "bg-slate-600/20 text-slate-400 border-slate-600/40",
//   },
// };

// const getExpiryTier = (days: number): ExpiryTier => {
//   if (!Number.isFinite(days)) return "none";
//   if (days < 0) return "expired";
//   if (days <= EXPIRY_CRITICAL_DAYS) return "critical";
//   if (days <= EXPIRY_SOON_DAYS) return "soon";
//   return "ok";
// };

// const EXPIRY_TIER_META: Record<
//   ExpiryTier,
//   { label: string; chip: string; border: string }
// > = {
//   expired: {
//     label: "Expired",
//     chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
//     border: "border-rose-500/30 bg-rose-500/5",
//   },
//   critical: {
//     label: `≤${EXPIRY_CRITICAL_DAYS}d`,
//     chip: "bg-orange-500/20 text-orange-300 border-orange-500/40",
//     border: "border-orange-500/30 bg-orange-500/5",
//   },
//   soon: {
//     label: `≤${EXPIRY_SOON_DAYS}d`,
//     chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
//     border: "border-amber-500/30 bg-amber-500/5",
//   },
//   ok: {
//     label: "OK",
//     chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
//     border: "border-slate-800 bg-slate-950/50",
//   },
//   none: {
//     label: "No expiry",
//     chip: "bg-slate-700/30 text-slate-400 border-slate-700",
//     border: "border-slate-800 bg-slate-950/50",
//   },
// };

// const MOVEMENT_META: Record<
//   MovementType,
//   {
//     label: string;
//     chip: string;
//     icon: typeof Package;
//     direction: "in" | "out";
//   }
// > = {
//   SALE: {
//     label: "Sale",
//     chip: "bg-sky-500/20 text-sky-300 border-sky-500/40",
//     icon: ShoppingCart,
//     direction: "out",
//   },
//   PURCHASE: {
//     label: "Purchase",
//     chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
//     icon: Truck,
//     direction: "in",
//   },
//   RETURN_IN: {
//     label: "Return in",
//     chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
//     icon: Undo2,
//     direction: "in",
//   },
//   RETURN_OUT: {
//     label: "Return out",
//     chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
//     icon: Undo2,
//     direction: "out",
//   },
//   ADJUST_IN: {
//     label: "Adjust +",
//     chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
//     icon: Plus,
//     direction: "in",
//   },
//   ADJUST_OUT: {
//     label: "Adjust −",
//     chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
//     icon: Trash2,
//     direction: "out",
//   },
//   TRANSFER_IN: {
//     label: "Transfer in",
//     chip: "bg-violet-500/20 text-violet-300 border-violet-500/40",
//     icon: ArrowDownToLine,
//     direction: "in",
//   },
//   TRANSFER_OUT: {
//     label: "Transfer out",
//     chip: "bg-violet-500/20 text-violet-300 border-violet-500/40",
//     icon: ArrowUpFromLine,
//     direction: "out",
//   },
//   DISPOSE: {
//     label: "Dispose",
//     chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
//     icon: Trash2,
//     direction: "out",
//   },
//   QUARANTINE: {
//     label: "Quarantine",
//     chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
//     icon: AlertTriangle,
//     direction: "out",
//   },
// };

// const makeMovementId = () =>
//   `mv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// const formatRelativeTime = (iso: string) => {
//   const diff = Date.now() - new Date(iso).getTime();
//   const minutes = Math.floor(diff / 60000);
//   if (minutes < 1) return "just now";
//   if (minutes < 60) return `${minutes}m ago`;
//   const hours = Math.floor(minutes / 60);
//   if (hours < 24) return `${hours}h ago`;
//   const days = Math.floor(hours / 24);
//   if (days < 7) return `${days}d ago`;
//   return new Date(iso).toLocaleDateString();
// };

// // FEFO — sort lots so soonest expiry shows first
// const getLots = (product: Product) =>
//   (product.inventories ?? [])
//     .filter((inventory) => inventory.lot)
//     .map((inventory, index) => ({
//       key: `${inventory.lot?.number ?? "lot"}-${index}`,
//       number: inventory.lot?.number ?? "—",
//       expiryDate: inventory.lot?.expiryDate,
//       quantity: num(inventory.quantity),
//       days: daysUntil(inventory.lot?.expiryDate ?? undefined),
//     }))
//     .sort((a, b) => {
//       if (!Number.isFinite(a.days)) return 1;
//       if (!Number.isFinite(b.days)) return -1;
//       return a.days - b.days;
//     });

// const getExpirySummary = (product: Product) => {
//   const lots = getLots(product);
//   const expired = lots.filter((l) => l.days < 0);
//   const critical = lots.filter(
//     (l) => l.days >= 0 && l.days <= EXPIRY_CRITICAL_DAYS,
//   );
//   const soon = lots.filter(
//     (l) => l.days > EXPIRY_CRITICAL_DAYS && l.days <= EXPIRY_SOON_DAYS,
//   );
//   return {
//     lots,
//     expiredCount: expired.length,
//     criticalCount: critical.length,
//     soonCount: soon.length,
//     soonest: lots[0] ?? null,
//     hasRisk: expired.length + critical.length + soon.length > 0,
//     totalAtRisk: [...expired, ...critical, ...soon].reduce(
//       (s, l) => s + l.quantity,
//       0,
//     ),
//   };
// };

// const hasExpiryRisk = (product: Product) => getExpirySummary(product).hasRisk;

// const reorderPoint = (product: Product) => {
//   const values = (product.inventories ?? [])
//     .map((row) => num(row.reorderPoint))
//     .filter((value) => value > 0);
//   return values.length ? Math.max(...values) : 10;
// };

// const suggestedReorder = (product: Product) => {
//   const quantities = (product.inventories ?? []).map((row) =>
//     num(row.reorderQty),
//   );
//   const reorderQty = quantities.length ? Math.max(...quantities) : 0;
//   return Math.max(reorderQty, reorderPoint(product) - num(product.stock));
// };

// const productSubtitle = (product: Product) =>
//   [
//     product.genericName,
//     product.activeIngredient,
//     product.strength,
//     product.dosageForm,
//   ]
//     .filter(Boolean)
//     .join(" · ");

// const csvCell = (value: unknown) =>
//   `"${String(value ?? "").replace(/"/g, '""')}"`;

// /* ------------------------------------------------------------------ */
// /*  Public interfaces                                                  */
// /* ------------------------------------------------------------------ */

// export interface StoreOption {
//   id: string;
//   name: string;
// }

// export interface AdjustPayload {
//   productId: string;
//   variantId: string;
//   quantity: number;
//   reason: string;
//   notes?: string;
// }

// export interface TransferPayload {
//   productId: string;
//   variantId: string;
//   fromStoreId: string;
//   toStoreId: string;
//   quantity: number;
//   notes?: string;
// }

// interface InventoryViewProps {
//   products: Product[];
//   storeId?: string;
//   userRole?: string;
//   isLoading?: boolean;
//   onRequestSubmitted?: () => void;
//   onAdjustStock?: (payload: AdjustPayload) => Promise<void>;
//   onTransferStock?: (payload: TransferPayload) => Promise<void>;
//   stores?: StoreOption[];
//   /** External movements from server (local ones are merged on top) */
//   movements?: StockMovement[];
//   /** Called whenever a local movement is recorded */
//   onMovementRecorded?: (movement: StockMovement) => void;
// }

// /* ------------------------------------------------------------------ */
// /*  Main component                                                     */
// /* ------------------------------------------------------------------ */

// export function InventoryView({
//   products,
//   storeId,
//   userRole = "CASHIER",
//   isLoading = false,
//   onRequestSubmitted,
//   onAdjustStock,
//   onTransferStock,
//   stores = [],
//   movements: externalMovements = [],
//   onMovementRecorded,
// }: InventoryViewProps) {
//   const [query, setQuery] = useState("");
//   const [stockFilter, setStockFilter] = useState<StockFilter>("all");
//   const [sortKey, setSortKey] = useState<SortKey>("name");
//   const [sortDir, setSortDir] = useState<SortDir>("asc");
//   const [pageSize, setPageSize] = useState<number>(100);
//   const [currentPage, setCurrentPage] = useState<number>(1);
//   const [selected, setSelected] = useState<Product | null>(null);
//   const [requestTarget, setRequestTarget] = useState<Product | null>(null);
//   const [requestQuantity, setRequestQuantity] = useState("1");
//   const [requestReason, setRequestReason] = useState("");
//   const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
//   const [transferTarget, setTransferTarget] = useState<Product | null>(null);

//   // Movements state
//   const [localMovements, setLocalMovements] = useState<StockMovement[]>([]);
//   const [movementsOpen, setMovementsOpen] = useState(false);

//   const requestQueryStoreId = ["ADMIN", "SUPER_ADMIN"].includes(userRole)
//     ? undefined
//     : storeId;

//   const { data: stockRequests = [] } = useGetStockRequestsQuery(
//     { storeId: requestQueryStoreId },
//     {
//       pollingInterval: 15000,
//       skip: !storeId && !["ADMIN", "SUPER_ADMIN"].includes(userRole),
//     },
//   );

//   const [createStockRequest, { isLoading: isRequesting }] =
//     useCreateStockRequestMutation();

//   const canCreateRequests = ["CASHIER", "MANAGER"].includes(userRole);
//   const canManageStock = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(userRole);
//   const searchRef = useRef<HTMLInputElement>(null);

//   /* ---------------------- merged movements --------------------- */

//   const allMovements = useMemo(
//     () =>
//       [...localMovements, ...externalMovements].sort(
//         (a, b) =>
//           new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
//       ),
//     [localMovements, externalMovements],
//   );

//   const recordMovement = useCallback(
//     (movement: StockMovement) => {
//       setLocalMovements((list) => [movement, ...list]);
//       onMovementRecorded?.(movement);
//     },
//     [onMovementRecorded],
//   );

//   /* ------------------------- filtering ------------------------- */

//   const searchFiltered = useMemo(() => {
//     const normalized = query.trim().toLowerCase();
//     if (!normalized) return products;
//     return products.filter((product) =>
//       [product.name, product.sku, product.barcode, product.category]
//         .map((value) => (value || "").toString().toLowerCase())
//         .some((value) => value.includes(normalized)),
//     );
//   }, [products, query]);

//   const filteredProducts = useMemo(() => {
//     if (stockFilter === "all") return searchFiltered;
//     if (stockFilter === "expiring") return searchFiltered.filter(hasExpiryRisk);
//     if (stockFilter === "expired")
//       return searchFiltered.filter((product) => {
//         const summary = getExpirySummary(product);
//         return summary.expiredCount > 0;
//       });
//     if (stockFilter === "reorder")
//       return searchFiltered.filter(
//         (product) => num(product.stock) <= reorderPoint(product),
//       );
//     return searchFiltered.filter(
//       (product) => getTone(num(product.stock)) === stockFilter,
//     );
//   }, [searchFiltered, stockFilter]);

//   /* -------------------------- sorting -------------------------- */

//   const sortedProducts = useMemo(() => {
//     const copy = [...filteredProducts];
//     copy.sort((a, b) => {
//       let cmp = 0;
//       if (sortKey === "price") cmp = num(a.price) - num(b.price);
//       else if (sortKey === "stock") cmp = num(a.stock) - num(b.stock);
//       else
//         cmp = String(a[sortKey] ?? "").localeCompare(
//           String(b[sortKey] ?? ""),
//           undefined,
//           { numeric: true, sensitivity: "base" },
//         );
//       return sortDir === "asc" ? cmp : -cmp;
//     });
//     return copy;
//   }, [filteredProducts, sortKey, sortDir]);

//   /* ------------------------ pagination ------------------------- */

//   const totalItems = sortedProducts.length;
//   const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
//   const activePage = Math.min(currentPage, totalPages);

//   const paginatedProducts = useMemo(() => {
//     if (pageSize <= 0) return sortedProducts;
//     const start = (activePage - 1) * pageSize;
//     return sortedProducts.slice(start, start + pageSize);
//   }, [sortedProducts, activePage, pageSize]);

//   const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
//   const endItem =
//     pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

//   /* --------------------------- stats --------------------------- */

//   const stats = useMemo(() => {
//     const result = {
//       total: searchFiltered.length,
//       in: 0,
//       low: 0,
//       critical: 0,
//       out: 0,
//       expiring: 0,
//       expired: 0,
//       expiryCritical: 0,
//       expirySoon: 0,
//       unitsAtRisk: 0,
//       reorder: 0,
//       stockValue: 0,
//       units: 0,
//     };
//     for (const product of searchFiltered) {
//       const stock = num(product.stock);
//       result[getTone(stock)] += 1;
//       result.units += stock;
//       result.stockValue += stock * num(product.price);

//       const summary = getExpirySummary(product);
//       if (summary.expiredCount > 0) result.expired += 1;
//       if (summary.criticalCount > 0) result.expiryCritical += 1;
//       if (summary.soonCount > 0) result.expirySoon += 1;
//       if (summary.hasRisk) {
//         result.expiring += 1;
//         result.unitsAtRisk += summary.totalAtRisk;
//       }
//       if (stock <= reorderPoint(product)) result.reorder += 1;
//     }
//     return result;
//   }, [searchFiltered]);

//   const chips: { id: StockFilter; label: string; count: number }[] = [
//     { id: "all", label: "All", count: stats.total },
//     { id: "in", label: "In stock", count: stats.in },
//     { id: "low", label: "Low", count: stats.low },
//     { id: "critical", label: "Critical", count: stats.critical },
//     { id: "out", label: "Out of stock", count: stats.out },
//     {
//       id: "expiring",
//       label: `Expiring ≤${EXPIRY_SOON_DAYS}d`,
//       count: stats.expiring,
//     },
//     { id: "expired", label: "Expired", count: stats.expired },
//     { id: "reorder", label: "Reorder", count: stats.reorder },
//   ];

//   const filtersActive = query !== "" || stockFilter !== "all";

//   /* -------------------------- handlers ------------------------- */

//   const resetPage = useCallback(() => setCurrentPage(1), []);

//   const handleSort = (key: SortKey) => {
//     if (key === sortKey) {
//       setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
//     } else {
//       setSortKey(key);
//       setSortDir(key === "price" || key === "stock" ? "desc" : "asc");
//     }
//     resetPage();
//   };

//   const resetFilters = () => {
//     setQuery("");
//     setStockFilter("all");
//     setSortKey("name");
//     setSortDir("asc");
//     resetPage();
//   };

//   const exportCsv = () => {
//     const headers = [
//       "Name",
//       "SKU",
//       "Barcode",
//       "Category",
//       "Price (MMK)",
//       "Stock",
//       "Status",
//       "Expired lots",
//       "Expiring ≤30d",
//       "Expiring ≤90d",
//     ];
//     const rows = sortedProducts.map((product) => {
//       const stock = num(product.stock);
//       const tone = getTone(stock);
//       const summary = getExpirySummary(product);
//       return [
//         product.name,
//         product.sku,
//         product.barcode ?? "",
//         product.category ?? "",
//         num(product.price),
//         stock,
//         TONE_META[tone].label,
//         summary.expiredCount,
//         summary.criticalCount,
//         summary.soonCount,
//       ];
//     });
//     const csv = [headers, ...rows]
//       .map((row) => row.map(csvCell).join(","))
//       .join("\r\n");

//     const blob = new Blob(["\uFEFF" + csv], {
//       type: "text/csv;charset=utf-8;",
//     });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     URL.revokeObjectURL(url);
//   };

//   /* ---------------------- keyboard shortcuts ------------------- */

//   useEffect(() => {
//     const handleKey = (event: KeyboardEvent) => {
//       const target = event.target as HTMLElement | null;
//       const typing =
//         target &&
//         (target.tagName === "INPUT" ||
//           target.tagName === "TEXTAREA" ||
//           target.tagName === "SELECT" ||
//           target.isContentEditable);

//       if (
//         !typing &&
//         (event.key === "/" ||
//           ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"))
//       ) {
//         event.preventDefault();
//         searchRef.current?.focus();
//         searchRef.current?.select();
//       }
//       if (event.key === "Escape") {
//         setSelected(null);
//         if (document.activeElement === searchRef.current) {
//           searchRef.current?.blur();
//         }
//       }
//     };
//     window.addEventListener("keydown", handleKey);
//     return () => window.removeEventListener("keydown", handleKey);
//   }, []);

//   /* ---------------------------- render ------------------------- */

//   return (
//     <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
//       {/* Header */}
//       <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
//         <div>
//           <h2 className="text-2xl font-black text-white md:text-3xl">
//             Products &amp; Stock
//           </h2>
//           <p className="mt-1 text-xs text-slate-400">
//             {products.length.toLocaleString()} products loaded from the selected
//             store
//             {filtersActive && (
//               <>
//                 {" · "}
//                 <span className="text-sky-400">
//                   {stats.total.toLocaleString()} matching filters
//                 </span>
//               </>
//             )}
//           </p>
//         </div>

//         <div className="flex flex-wrap items-center gap-2">
//           <span className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-500 lg:flex">
//             <Keyboard className="h-3.5 w-3.5" />
//             <kbd className="font-sans font-semibold text-slate-300">/</kbd>
//             or
//             <kbd className="font-sans font-semibold text-slate-300">⌘K</kbd>
//             to search
//           </span>

//           <button
//             type="button"
//             onClick={() => setMovementsOpen(true)}
//             className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
//           >
//             <History className="h-3.5 w-3.5" />
//             Movements
//             {allMovements.length > 0 && (
//               <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
//                 {allMovements.length}
//               </span>
//             )}
//           </button>

//           <button
//             type="button"
//             onClick={exportCsv}
//             disabled={sortedProducts.length === 0}
//             className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-40"
//           >
//             <Download className="h-3.5 w-3.5" />
//             Export CSV
//           </button>
//         </div>
//       </div>

//       {/* KPI cards */}
//       <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
//         <StatCard
//           icon={Package}
//           label="Products"
//           value={stats.total.toLocaleString()}
//           note={`${stats.units.toLocaleString()} units on hand`}
//           tone="sky"
//         />
//         <StatCard
//           icon={Wallet}
//           label="Stock value"
//           value={`${Math.round(stats.stockValue).toLocaleString()} MMK`}
//           note="Retail price × quantity"
//           tone="emerald"
//         />
//         <StatCard
//           icon={TrendingDown}
//           label="Needs attention"
//           value={(stats.low + stats.critical + stats.out).toLocaleString()}
//           note={`${stats.critical} critical · ${stats.out} out of stock`}
//           tone={stats.critical + stats.out > 0 ? "rose" : "amber"}
//         />
//         <StatCard
//           icon={CalendarClock}
//           label="Expiry risk"
//           value={stats.expiring.toLocaleString()}
//           note={
//             stats.expired > 0
//               ? `${stats.expired} expired · ${stats.unitsAtRisk} units at risk`
//               : `Lots expiring within ${EXPIRY_SOON_DAYS} days`
//           }
//           tone={
//             stats.expired > 0 ? "rose" : stats.expiring > 0 ? "amber" : "slate"
//           }
//         />
//       </section>

//       {/* Search / filter bar */}
//       <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
//         <div className="relative w-full md:max-w-sm">
//           <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//           <input
//             ref={searchRef}
//             type="text"
//             placeholder="Search by name, SKU, barcode…"
//             value={query}
//             onChange={(event) => {
//               setQuery(event.target.value);
//               resetPage();
//             }}
//             className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white placeholder-slate-500 transition-colors focus:border-sky-500 focus:outline-none"
//           />
//           {query && (
//             <button
//               type="button"
//               aria-label="Clear search"
//               onClick={() => {
//                 setQuery("");
//                 resetPage();
//                 searchRef.current?.focus();
//               }}
//               className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:text-white"
//             >
//               <X className="h-3.5 w-3.5" />
//             </button>
//           )}
//         </div>

//         <div className="flex items-center justify-between gap-3 md:ml-auto md:justify-end">
//           {filtersActive && (
//             <button
//               type="button"
//               onClick={resetFilters}
//               className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
//             >
//               <RotateCcw className="h-3.5 w-3.5" />
//               Reset
//             </button>
//           )}
//           <label className="flex items-center gap-2 text-xs text-slate-400">
//             Per page:
//             <select
//               value={pageSize}
//               onChange={(event) => {
//                 setPageSize(Number(event.target.value));
//                 resetPage();
//               }}
//               className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
//             >
//               <option value={50}>50</option>
//               <option value={100}>100</option>
//               <option value={250}>250</option>
//               <option value={500}>500</option>
//               <option value={0}>All ({totalItems})</option>
//             </select>
//           </label>
//         </div>
//       </div>

//       {/* Quick filter chips */}
//       <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-2 md:flex-wrap md:pb-0">
//         {chips.map((chip) => {
//           const active = stockFilter === chip.id;
//           return (
//             <button
//               key={chip.id}
//               type="button"
//               onClick={() => {
//                 setStockFilter(chip.id);
//                 resetPage();
//               }}
//               className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
//                 active
//                   ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
//                   : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
//               }`}
//             >
//               {chip.label}
//               <span
//                 className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
//                   active
//                     ? "bg-sky-500/25 text-sky-100"
//                     : "bg-slate-800 text-slate-400"
//                 }`}
//               >
//                 {chip.count.toLocaleString()}
//               </span>
//             </button>
//           );
//         })}
//       </div>

//       {/* ================= DESKTOP TABLE ================= */}
//       <div className="hidden md:block flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/70">
//         <table className="w-full text-sm">
//           <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
//             <tr className="border-b border-slate-800 text-left">
//               <SortableHeader
//                 label="Product"
//                 sortKey="name"
//                 activeKey={sortKey}
//                 dir={sortDir}
//                 onSort={handleSort}
//               />
//               <SortableHeader
//                 label="SKU"
//                 sortKey="sku"
//                 activeKey={sortKey}
//                 dir={sortDir}
//                 onSort={handleSort}
//               />
//               <SortableHeader
//                 label="Category"
//                 sortKey="category"
//                 activeKey={sortKey}
//                 dir={sortDir}
//                 onSort={handleSort}
//               />
//               <SortableHeader
//                 label="Price"
//                 sortKey="price"
//                 activeKey={sortKey}
//                 dir={sortDir}
//                 onSort={handleSort}
//                 align="right"
//               />
//               <SortableHeader
//                 label="Stock & Expiry"
//                 sortKey="stock"
//                 activeKey={sortKey}
//                 dir={sortDir}
//                 onSort={handleSort}
//                 align="right"
//               />
//               <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
//                 Status
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {paginatedProducts.map((product) => {
//               const stock = num(product.stock);
//               const tone = TONE_META[getTone(stock)];
//               const subtitle = productSubtitle(product);
//               const summary = getExpirySummary(product);
//               const soonest = summary.soonest;
//               const soonestTier = soonest
//                 ? getExpiryTier(soonest.days)
//                 : "none";
//               const soonestMeta = EXPIRY_TIER_META[soonestTier];

//               return (
//                 <tr
//                   key={product.id}
//                   onClick={() => setSelected(product)}
//                   className="cursor-pointer border-b border-slate-800/50 transition-colors last:border-0 hover:bg-slate-800/30"
//                 >
//                   <td className="px-5 py-3">
//                     <div className="flex items-start gap-2">
//                       {summary.hasRisk && (
//                         <AlertTriangle
//                           className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
//                             summary.expiredCount > 0
//                               ? "text-rose-400"
//                               : "text-amber-400"
//                           }`}
//                           aria-label="Expiry risk"
//                         />
//                       )}
//                       <div className="min-w-0">
//                         <span className="block font-semibold text-slate-100">
//                           {product.name}
//                         </span>
//                         {subtitle && (
//                           <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-400/90">
//                             {subtitle}
//                           </span>
//                         )}
//                       </div>
//                     </div>
//                   </td>

//                   <td className="px-5 py-3 font-mono text-xs text-slate-400">
//                     {product.sku}
//                   </td>

//                   <td className="px-5 py-3">
//                     <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
//                       {product.category || "Uncategorised"}
//                     </span>
//                   </td>

//                   <td className="px-5 py-3 text-right font-bold tabular-nums text-white">
//                     {num(product.price).toLocaleString()}{" "}
//                     <span className="text-xs font-normal text-slate-500">
//                       MMK
//                     </span>
//                   </td>

//                   <td className="px-5 py-3 text-right">
//                     <div className="font-bold tabular-nums text-white">
//                       {stock.toLocaleString()}
//                     </div>

//                     {stock <= reorderPoint(product) && (
//                       <div className="mt-1 text-[10px] font-semibold text-amber-300">
//                         Reorder {suggestedReorder(product)} · min{" "}
//                         {reorderPoint(product)}
//                       </div>
//                     )}

//                     {summary.lots.length > 0 && (
//                       <div className="mt-1.5 flex flex-wrap justify-end gap-1">
//                         {summary.expiredCount > 0 && (
//                           <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
//                             {summary.expiredCount} expired
//                           </span>
//                         )}
//                         {summary.criticalCount > 0 && (
//                           <span className="rounded-full border border-orange-500/40 bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
//                             {summary.criticalCount} ≤{EXPIRY_CRITICAL_DAYS}d
//                           </span>
//                         )}
//                         {summary.soonCount > 0 && (
//                           <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
//                             {summary.soonCount} ≤{EXPIRY_SOON_DAYS}d
//                           </span>
//                         )}
//                       </div>
//                     )}

//                     {soonest?.expiryDate && (
//                       <div
//                         className={`mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${soonestMeta.chip}`}
//                       >
//                         <CalendarClock className="h-3 w-3" />
//                         {soonest.days < 0
//                           ? `Exp ${Math.abs(soonest.days)}d ago`
//                           : `Exp in ${soonest.days}d`}
//                       </div>
//                     )}
//                   </td>

//                   <td className="px-5 py-3 text-center">
//                     <span
//                       className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.className}`}
//                     >
//                       {tone.label}
//                     </span>
//                     {canCreateRequests &&
//                       storeId &&
//                       stock <= reorderPoint(product) &&
//                       (() => {
//                         const existingRequest = stockRequests.find(
//                           (request: any) =>
//                             request.storeId === storeId &&
//                             request.productId === product.productId &&
//                             request.variantId === product.variantId &&
//                             ["PENDING", "ACKNOWLEDGED"].includes(
//                               request.status,
//                             ),
//                         );
//                         return (
//                           <button
//                             type="button"
//                             disabled={!!existingRequest}
//                             onClick={(event) => {
//                               event.stopPropagation();
//                               setRequestTarget(product);
//                               setRequestQuantity(
//                                 String(suggestedReorder(product)),
//                               );
//                             }}
//                             className="mt-2 block w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
//                           >
//                             {existingRequest
//                               ? `Request ${existingRequest.status.toLowerCase()}`
//                               : "Request stock"}
//                           </button>
//                         );
//                       })()}
//                   </td>
//                 </tr>
//               );
//             })}

//             {paginatedProducts.length === 0 && (
//               <tr>
//                 <td
//                   colSpan={6}
//                   className="px-5 py-12 text-center text-sm text-slate-400"
//                 >
//                   {isLoading
//                     ? "Loading products…"
//                     : filtersActive
//                       ? "No products match the current filters."
//                       : "No products found in this store."}
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {/* ================= MOBILE CARDS ================= */}
//       <div className="md:hidden space-y-3">
//         {isLoading ? (
//           <p className="p-10 text-center text-sm text-slate-400">
//             Loading products…
//           </p>
//         ) : paginatedProducts.length === 0 ? (
//           <p className="p-10 text-center text-sm text-slate-400">
//             {filtersActive
//               ? "No products match the current filters."
//               : "No products found in this store."}
//           </p>
//         ) : (
//           paginatedProducts.map((product) => {
//             const stock = num(product.stock);
//             const tone = TONE_META[getTone(stock)];
//             const subtitle = productSubtitle(product);
//             const summary = getExpirySummary(product);
//             const soonest = summary.soonest;
//             const soonestMeta = soonest
//               ? EXPIRY_TIER_META[getExpiryTier(soonest.days)]
//               : null;

//             const existingRequest =
//               canCreateRequests && storeId && stock <= reorderPoint(product)
//                 ? stockRequests.find(
//                     (request: any) =>
//                       request.storeId === storeId &&
//                       request.productId === product.productId &&
//                       request.variantId === product.variantId &&
//                       ["PENDING", "ACKNOWLEDGED"].includes(request.status),
//                   )
//                 : null;

//             return (
//               <div
//                 key={product.id}
//                 onClick={() => setSelected(product)}
//                 className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
//               >
//                 <div className="flex items-start justify-between gap-3">
//                   <div className="min-w-0">
//                     <div className="flex items-center gap-1.5">
//                       {summary.hasRisk && (
//                         <AlertTriangle
//                           className={`h-3.5 w-3.5 shrink-0 ${
//                             summary.expiredCount > 0
//                               ? "text-rose-400"
//                               : "text-amber-400"
//                           }`}
//                         />
//                       )}
//                       <span className="font-semibold text-slate-100 truncate">
//                         {product.name}
//                       </span>
//                     </div>
//                     {subtitle && (
//                       <p className="mt-0.5 text-[11px] font-medium text-emerald-400/90 truncate">
//                         {subtitle}
//                       </p>
//                     )}
//                   </div>
//                   <span
//                     className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.className}`}
//                   >
//                     {tone.label}
//                   </span>
//                 </div>

//                 <div className="flex items-center justify-between text-xs">
//                   <span className="font-mono text-slate-400">
//                     {product.sku}
//                   </span>
//                   <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
//                     {product.category || "Uncategorised"}
//                   </span>
//                 </div>

//                 {soonest?.expiryDate && soonestMeta && (
//                   <div
//                     className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${soonestMeta.border}`}
//                   >
//                     <span className="flex items-center gap-1.5 text-slate-300">
//                       <CalendarClock className="h-3.5 w-3.5" />
//                       {soonest.days < 0
//                         ? `Expired ${Math.abs(soonest.days)}d ago`
//                         : `Expires in ${soonest.days}d`}
//                     </span>
//                     <span
//                       className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${soonestMeta.chip}`}
//                     >
//                       {soonestMeta.label}
//                     </span>
//                   </div>
//                 )}

//                 <div className="flex items-end justify-between border-t border-slate-800/80 pt-3">
//                   <div>
//                     <p className="text-[10px] text-slate-500">Price</p>
//                     <p className="text-sm font-bold text-white">
//                       {num(product.price).toLocaleString()} MMK
//                     </p>
//                   </div>
//                   <div className="text-right">
//                     <p className="text-[10px] text-slate-500">Stock</p>
//                     <p className="text-sm font-bold text-white">
//                       {stock.toLocaleString()}
//                     </p>
//                     {stock <= reorderPoint(product) && (
//                       <p className="text-[10px] font-semibold text-amber-300 mt-0.5">
//                         Reorder {suggestedReorder(product)} · min{" "}
//                         {reorderPoint(product)}
//                       </p>
//                     )}
//                   </div>
//                 </div>

//                 {canCreateRequests &&
//                   storeId &&
//                   stock <= reorderPoint(product) && (
//                     <button
//                       type="button"
//                       disabled={!!existingRequest}
//                       onClick={(event) => {
//                         event.stopPropagation();
//                         setRequestTarget(product);
//                         setRequestQuantity(String(suggestedReorder(product)));
//                       }}
//                       className="mt-1 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
//                     >
//                       {existingRequest
//                         ? `Request ${existingRequest.status.toLowerCase()}`
//                         : "Request stock"}
//                     </button>
//                   )}
//               </div>
//             );
//           })
//         )}
//       </div>

//       {/* Pagination */}
//       {totalItems > 0 && (
//         <div className="mt-4 flex flex-col items-center justify-between gap-3 px-2 md:flex-row md:gap-4">
//           <p className="text-center text-xs text-slate-400 md:text-left">
//             Showing{" "}
//             <strong className="text-white">{startItem.toLocaleString()}</strong>{" "}
//             to{" "}
//             <strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
//             of{" "}
//             <strong className="text-white">
//               {totalItems.toLocaleString()}
//             </strong>{" "}
//             items
//           </p>

//           {pageSize > 0 && totalPages > 1 && (
//             <div className="flex items-center gap-1.5">
//               <PageButton
//                 onClick={() => setCurrentPage(1)}
//                 disabled={activePage <= 1}
//                 label="First page"
//               >
//                 <ChevronsLeft className="h-3.5 w-3.5" />
//               </PageButton>
//               <PageButton
//                 onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
//                 disabled={activePage <= 1}
//                 label="Previous page"
//                 wide
//               >
//                 <ChevronLeft className="h-3.5 w-3.5" /> Prev
//               </PageButton>

//               <span className="px-2 text-xs text-slate-400">
//                 Page <strong className="text-white">{activePage}</strong> of{" "}
//                 {totalPages}
//               </span>

//               <PageButton
//                 onClick={() =>
//                   setCurrentPage((page) => Math.min(totalPages, page + 1))
//                 }
//                 disabled={activePage >= totalPages}
//                 label="Next page"
//                 wide
//               >
//                 Next <ChevronRight className="h-3.5 w-3.5" />
//               </PageButton>
//               <PageButton
//                 onClick={() => setCurrentPage(totalPages)}
//                 disabled={activePage >= totalPages}
//                 label="Last page"
//               >
//                 <ChevronsRight className="h-3.5 w-3.5" />
//               </PageButton>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ======================= DRAWER ======================= */}
//       {selected && (
//         <ProductDrawer
//           product={selected}
//           onClose={() => setSelected(null)}
//           canManage={canManageStock}
//           movements={allMovements}
//           onAdjust={(p) => {
//             setAdjustTarget(p);
//             setSelected(null);
//           }}
//           onTransfer={(p) => {
//             setTransferTarget(p);
//             setSelected(null);
//           }}
//           onRequest={(p) => {
//             setRequestTarget(p);
//             setRequestQuantity(String(suggestedReorder(p)));
//             setSelected(null);
//           }}
//           onDispose={(p, lot, mode) => {
//             recordMovement({
//               id: makeMovementId(),
//               productId: p.productId ?? "",
//               variantId: p.variantId,
//               productName: p.name,
//               sku: p.sku,
//               type: mode === "DISPOSE" ? "DISPOSE" : "QUARANTINE",
//               quantity: -lot.quantity,
//               balanceAfter: num(p.stock) - lot.quantity,
//               reason: mode === "DISPOSE" ? "expired" : "quarantine",
//               lotNumber: lot.number,
//               expiryDate: lot.expiryDate,
//               storeId,
//               createdAt: new Date().toISOString(),
//             });
//           }}
//         />
//       )}

//       {/* ======================= STOCK REQUEST MODAL ======================= */}
//       {requestTarget && (
//         <div
//           className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
//           onMouseDown={(event) => {
//             if (event.target === event.currentTarget) setRequestTarget(null);
//           }}
//         >
//           <form
//             className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
//             onSubmit={async (event) => {
//               event.preventDefault();
//               const quantity = Number(requestQuantity);
//               if (
//                 !storeId ||
//                 !requestTarget.productId ||
//                 !requestTarget.variantId ||
//                 !Number.isInteger(quantity) ||
//                 quantity < 1
//               )
//                 return;
//               try {
//                 const result = await createStockRequest({
//                   storeId,
//                   productId: requestTarget.productId,
//                   variantId: requestTarget.variantId,
//                   quantity,
//                   reason: requestReason,
//                 }).unwrap();
//                 setRequestTarget(null);
//                 setRequestReason("");
//                 if (result?.duplicate)
//                   window.alert(
//                     "A request for this variant is already open. You can track it under Stock requests.",
//                   );
//                 onRequestSubmitted?.();
//               } catch (error: any) {
//                 window.alert(
//                   error?.data?.message || "Could not submit stock request.",
//                 );
//               }
//             }}
//           >
//             <h3 className="text-lg font-bold text-white">Request stock</h3>
//             <p className="mt-1 text-sm text-slate-400">
//               {requestTarget.name} · Current stock {num(requestTarget.stock)}
//             </p>
//             <label className="mt-4 block text-xs font-semibold text-slate-300">
//               Quantity needed
//               <input
//                 autoFocus
//                 min="1"
//                 step="1"
//                 type="number"
//                 value={requestQuantity}
//                 onChange={(event) => setRequestQuantity(event.target.value)}
//                 className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//               />
//             </label>
//             <label className="mt-3 block text-xs font-semibold text-slate-300">
//               Note (optional)
//               <textarea
//                 value={requestReason}
//                 onChange={(event) => setRequestReason(event.target.value)}
//                 maxLength={500}
//                 rows={3}
//                 placeholder="Low stock, customer demand…"
//                 className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//               />
//             </label>
//             <div className="mt-4 flex justify-end gap-2">
//               <button
//                 type="button"
//                 onClick={() => setRequestTarget(null)}
//                 className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
//               >
//                 Cancel
//               </button>
//               <button
//                 disabled={isRequesting}
//                 className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
//               >
//                 {isRequesting ? "Sending…" : "Send request"}
//               </button>
//             </div>
//           </form>
//         </div>
//       )}

//       {/* ======================= ADJUST MODAL ======================= */}
//       {adjustTarget && (
//         <AdjustStockModal
//           product={adjustTarget}
//           onClose={() => setAdjustTarget(null)}
//           onSubmit={async (payload) => {
//             try {
//               if (onAdjustStock) await onAdjustStock(payload);
//               else console.log("Stock adjustment:", payload);

//               recordMovement({
//                 id: makeMovementId(),
//                 productId: adjustTarget.productId ?? "",
//                 variantId: adjustTarget.variantId,
//                 productName: adjustTarget.name,
//                 sku: adjustTarget.sku,
//                 type: payload.quantity >= 0 ? "ADJUST_IN" : "ADJUST_OUT",
//                 quantity: payload.quantity,
//                 balanceAfter: num(adjustTarget.stock) + payload.quantity,
//                 reason: payload.reason,
//                 notes: payload.notes,
//                 storeId,
//                 createdAt: new Date().toISOString(),
//               });

//               setAdjustTarget(null);
//             } catch (error: any) {
//               window.alert(error?.data?.message || "Could not adjust stock.");
//             }
//           }}
//         />
//       )}

//       {/* ======================= TRANSFER MODAL ======================= */}
//       {transferTarget && (
//         <TransferStockModal
//           product={transferTarget}
//           stores={stores}
//           fromStoreId={storeId}
//           onClose={() => setTransferTarget(null)}
//           onSubmit={async (payload) => {
//             try {
//               if (onTransferStock) await onTransferStock(payload);
//               else console.log("Stock transfer:", payload);

//               const now = new Date().toISOString();
//               const sourceName =
//                 stores.find((s) => s.id === payload.fromStoreId)?.name ??
//                 payload.fromStoreId;
//               const destName =
//                 stores.find((s) => s.id === payload.toStoreId)?.name ??
//                 payload.toStoreId;

//               recordMovement({
//                 id: makeMovementId(),
//                 productId: transferTarget.productId ?? "",
//                 variantId: transferTarget.variantId,
//                 productName: transferTarget.name,
//                 sku: transferTarget.sku,
//                 type: "TRANSFER_OUT",
//                 quantity: -payload.quantity,
//                 balanceAfter: num(transferTarget.stock) - payload.quantity,
//                 notes: payload.notes,
//                 reference: `To ${destName}`,
//                 fromStoreId: payload.fromStoreId,
//                 toStoreId: payload.toStoreId,
//                 storeId: payload.fromStoreId,
//                 createdAt: now,
//               });

//               recordMovement({
//                 id: makeMovementId(),
//                 productId: transferTarget.productId ?? "",
//                 variantId: transferTarget.variantId,
//                 productName: transferTarget.name,
//                 sku: transferTarget.sku,
//                 type: "TRANSFER_IN",
//                 quantity: payload.quantity,
//                 notes: payload.notes,
//                 reference: `From ${sourceName}`,
//                 fromStoreId: payload.fromStoreId,
//                 toStoreId: payload.toStoreId,
//                 storeId: payload.toStoreId,
//                 createdAt: now,
//               });

//               setTransferTarget(null);
//             } catch (error: any) {
//               window.alert(error?.data?.message || "Could not transfer stock.");
//             }
//           }}
//         />
//       )}

//       {/* ======================= MOVEMENTS MODAL ======================= */}
//       {movementsOpen && (
//         <StockMovementsModal
//           movements={allMovements}
//           stores={stores}
//           onClose={() => setMovementsOpen(false)}
//         />
//       )}
//     </main>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  Small building blocks                                              */
// /* ------------------------------------------------------------------ */

// const TONES: Record<string, string> = {
//   sky: "border-sky-500/20 bg-sky-500/5 text-sky-300",
//   emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
//   amber: "border-amber-500/20 bg-amber-500/5 text-amber-300",
//   rose: "border-rose-500/20 bg-rose-500/5 text-rose-300",
//   slate: "border-slate-800 bg-slate-900 text-slate-300",
// };

// function StatCard({
//   icon: Icon,
//   label,
//   value,
//   note,
//   tone,
// }: {
//   icon: typeof Package;
//   label: string;
//   value: string;
//   note: string;
//   tone: keyof typeof TONES;
// }) {
//   return (
//     <article className={`rounded-2xl border p-3 md:p-4 ${TONES[tone]}`}>
//       <div className="flex items-center gap-2">
//         <Icon className="h-4 w-4 shrink-0" />
//         <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider opacity-80 truncate">
//           {label}
//         </p>
//       </div>
//       <p className="mt-2 truncate text-lg md:text-xl font-black text-white">
//         {value}
//       </p>
//       <p className="mt-1 truncate text-[10px] md:text-[11px] text-slate-400">
//         {note}
//       </p>
//     </article>
//   );
// }

// function SortableHeader({
//   label,
//   sortKey,
//   activeKey,
//   dir,
//   onSort,
//   align = "left",
// }: {
//   label: string;
//   sortKey: SortKey;
//   activeKey: SortKey;
//   dir: SortDir;
//   onSort: (key: SortKey) => void;
//   align?: "left" | "right";
// }) {
//   const active = activeKey === sortKey;
//   const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;

//   return (
//     <th
//       className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wider ${
//         align === "right" ? "text-right" : "text-left"
//       }`}
//     >
//       <button
//         type="button"
//         onClick={() => onSort(sortKey)}
//         aria-sort={
//           active ? (dir === "asc" ? "ascending" : "descending") : "none"
//         }
//         className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-200 ${
//           active ? "text-sky-400" : "text-slate-400"
//         }`}
//       >
//         {label}
//         <Icon className="h-3 w-3" />
//       </button>
//     </th>
//   );
// }

// function PageButton({
//   children,
//   onClick,
//   disabled,
//   label,
//   wide,
// }: {
//   children: React.ReactNode;
//   onClick: () => void;
//   disabled: boolean;
//   label: string;
//   wide?: boolean;
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       disabled={disabled}
//       aria-label={label}
//       className={`flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40 ${
//         wide ? "px-3" : "px-2"
//       }`}
//     >
//       {children}
//     </button>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  Drawer with tabs + actions + history                               */
// /* ------------------------------------------------------------------ */

// function ProductDrawer({
//   product,
//   onClose,
//   canManage = false,
//   movements = [],
//   onAdjust,
//   onTransfer,
//   onRequest,
//   onDispose,
// }: {
//   product: Product;
//   onClose: () => void;
//   canManage?: boolean;
//   movements?: StockMovement[];
//   onAdjust?: (p: Product) => void;
//   onTransfer?: (p: Product) => void;
//   onRequest?: (p: Product) => void;
//   onDispose?: (
//     p: Product,
//     lot: ReturnType<typeof getLots>[number],
//     mode: "DISPOSE" | "QUARANTINE",
//   ) => void;
// }) {
//   const [tab, setTab] = useState<DrawerTab>("overview");
//   const stock = num(product.stock);
//   const tone = TONE_META[getTone(stock)];
//   const subtitle = productSubtitle(product);
//   const summary = getExpirySummary(product);

//   const productMovements = useMemo(
//     () =>
//       movements
//         .filter(
//           (m) =>
//             m.productId === product.productId ||
//             m.productId === (product as any).id,
//         )
//         .sort(
//           (a, b) =>
//             new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
//         ),
//     [movements, product],
//   );

//   const rows: [string, string][] = [
//     ["SKU", product.sku || "—"],
//     ["Barcode", product.barcode || "—"],
//     ["Category", product.category || "Uncategorised"],
//     ["Unit price", `${num(product.price).toLocaleString()} MMK`],
//     ["On hand", `${stock.toLocaleString()} units`],
//     ["Reorder point", `${reorderPoint(product)} units`],
//     ["Suggested reorder", `${suggestedReorder(product)} units`],
//     ["Stock value", `${(stock * num(product.price)).toLocaleString()} MMK`],
//   ];

//   return (
//     <div
//       className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm"
//       onClick={onClose}
//       role="presentation"
//     >
//       <aside
//         role="dialog"
//         aria-modal="true"
//         aria-label={`Details for ${product.name}`}
//         onClick={(event) => event.stopPropagation()}
//         className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-slate-800 bg-slate-900 shadow-2xl"
//       >
//         {/* Header */}
//         <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4 md:p-6">
//           <div className="min-w-0">
//             <h3 className="text-lg font-black text-white">{product.name}</h3>
//             {subtitle && (
//               <p className="mt-1 text-xs font-medium text-emerald-400/90">
//                 {subtitle}
//               </p>
//             )}
//             <div className="mt-2 flex flex-wrap gap-1.5">
//               <span
//                 className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tone.className}`}
//               >
//                 {tone.label}
//               </span>
//               {summary.expiredCount > 0 && (
//                 <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
//                   {summary.expiredCount} expired
//                 </span>
//               )}
//               {summary.criticalCount + summary.soonCount > 0 && (
//                 <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
//                   {summary.criticalCount + summary.soonCount} expiring soon
//                 </span>
//               )}
//             </div>
//           </div>
//           <button
//             type="button"
//             onClick={onClose}
//             aria-label="Close details"
//             className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
//           >
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         {/* Quick actions */}
//         {canManage && (
//           <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/50 p-3">
//             <button
//               type="button"
//               onClick={() => onAdjust?.(product)}
//               className="flex flex-col items-center gap-1 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2 py-2.5 text-[10px] font-bold text-sky-200 transition hover:bg-sky-500/20"
//             >
//               <Package className="h-4 w-4" />
//               Adjust
//             </button>
//             <button
//               type="button"
//               onClick={() => onTransfer?.(product)}
//               className="flex flex-col items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2 py-2.5 text-[10px] font-bold text-violet-200 transition hover:bg-violet-500/20"
//             >
//               <Truck className="h-4 w-4" />
//               Transfer
//             </button>
//             <button
//               type="button"
//               onClick={() => onRequest?.(product)}
//               className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2.5 text-[10px] font-bold text-amber-200 transition hover:bg-amber-500/20"
//             >
//               <Send className="h-4 w-4" />
//               Request
//             </button>
//           </div>
//         )}

//         {/* Tabs */}
//         <div className="flex gap-1 border-b border-slate-800 px-3">
//           {(
//             [
//               { id: "overview", label: "Overview" },
//               { id: "batches", label: `Batches (${summary.lots.length})` },
//               { id: "history", label: "History" },
//             ] as const
//           ).map((t) => (
//             <button
//               key={t.id}
//               type="button"
//               onClick={() => setTab(t.id)}
//               className={`relative px-3 py-3 text-xs font-bold transition ${
//                 tab === t.id
//                   ? "text-sky-300"
//                   : "text-slate-400 hover:text-slate-200"
//               }`}
//             >
//               {t.label}
//               {tab === t.id && (
//                 <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" />
//               )}
//             </button>
//           ))}
//         </div>

//         {/* Body */}
//         <div className="flex-1 overflow-y-auto p-4 md:p-6">
//           {tab === "overview" && (
//             <>
//               <dl className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
//                 {rows.map(([label, value]) => (
//                   <div
//                     key={label}
//                     className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
//                   >
//                     <dt className="text-slate-400">{label}</dt>
//                     <dd className="truncate font-semibold text-slate-100">
//                       {value}
//                     </dd>
//                   </div>
//                 ))}
//               </dl>

//               {product.variants && product.variants.length > 0 && (
//                 <section className="mt-5">
//                   <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
//                     Variants ({product.variants.length})
//                   </h4>
//                   <ul className="flex flex-wrap gap-2">
//                     {product.variants.map((v) => (
//                       <li
//                         key={v.id}
//                         className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[11px] font-semibold text-slate-300"
//                       >
//                         {v.name}
//                       </li>
//                     ))}
//                   </ul>
//                 </section>
//               )}
//             </>
//           )}

//           {tab === "batches" && (
//             <>
//               {summary.lots.length === 0 ? (
//                 <p className="p-6 text-center text-sm text-slate-500">
//                   No batch/lot records for this product.
//                 </p>
//               ) : (
//                 <ul className="space-y-2">
//                   {summary.lots.map((lot) => {
//                     const tier = getExpiryTier(lot.days);
//                     const meta = EXPIRY_TIER_META[tier];
//                     return (
//                       <li
//                         key={lot.key}
//                         className={`rounded-xl border p-3 ${meta.border}`}
//                       >
//                         <div className="flex items-start justify-between gap-3">
//                           <div className="min-w-0">
//                             <p className="truncate font-semibold text-slate-100">
//                               Lot {lot.number}
//                             </p>
//                             <p className="mt-0.5 text-[11px] text-slate-400">
//                               {lot.expiryDate
//                                 ? lot.days < 0
//                                   ? `Expired ${Math.abs(lot.days)} day(s) ago`
//                                   : `Expires ${new Date(
//                                       lot.expiryDate,
//                                     ).toLocaleDateString()} · ${lot.days}d left`
//                                 : "No expiry recorded"}
//                             </p>
//                           </div>
//                           <div className="flex flex-col items-end gap-1.5">
//                             <span className="font-bold tabular-nums text-white">
//                               {lot.quantity.toLocaleString()}
//                             </span>
//                             <span
//                               className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.chip}`}
//                             >
//                               {meta.label}
//                             </span>
//                           </div>
//                         </div>

//                         {canManage && tier !== "ok" && tier !== "none" && (
//                           <div className="mt-2 flex gap-1.5 border-t border-white/5 pt-2">
//                             <button
//                               type="button"
//                               onClick={() =>
//                                 onDispose?.(product, lot, "DISPOSE")
//                               }
//                               className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20"
//                             >
//                               Dispose
//                             </button>
//                             <button
//                               type="button"
//                               className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"
//                             >
//                               Return
//                             </button>
//                             <button
//                               type="button"
//                               onClick={() =>
//                                 onDispose?.(product, lot, "QUARANTINE")
//                               }
//                               className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-800"
//                             >
//                               Quarantine
//                             </button>
//                           </div>
//                         )}
//                       </li>
//                     );
//                   })}
//                 </ul>
//               )}
//             </>
//           )}

//           {tab === "history" && (
//             <div className="space-y-3">
//               {productMovements.length === 0 ? (
//                 <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
//                   <History className="mx-auto h-8 w-8 text-slate-600" />
//                   <p className="mt-3 text-sm font-semibold text-slate-400">
//                     No stock movements yet
//                   </p>
//                   <p className="mt-1 text-xs text-slate-500">
//                     Adjustments, transfers, and sales will appear here.
//                   </p>
//                 </div>
//               ) : (
//                 <>
//                   <p className="text-xs text-slate-500">
//                     {productMovements.length} movement
//                     {productMovements.length === 1 ? "" : "s"} recorded
//                   </p>
//                   <ul className="space-y-1.5">
//                     {productMovements.slice(0, 30).map((m) => {
//                       const meta = MOVEMENT_META[m.type];
//                       const Icon = meta.icon;
//                       const isPositive = m.quantity > 0;
//                       return (
//                         <li
//                           key={m.id}
//                           className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5"
//                         >
//                           <div className="flex min-w-0 items-start gap-2.5">
//                             <span
//                               className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.chip}`}
//                             >
//                               <Icon className="h-3.5 w-3.5" />
//                             </span>
//                             <div className="min-w-0">
//                               <div className="flex flex-wrap items-center gap-1.5">
//                                 <span
//                                   className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}
//                                 >
//                                   {meta.label}
//                                 </span>
//                                 <span className="text-[10px] text-slate-500">
//                                   {formatRelativeTime(m.createdAt)}
//                                 </span>
//                               </div>
//                               <p className="mt-1 truncate text-xs text-slate-200">
//                                 {m.reference ||
//                                   m.notes ||
//                                   m.reason ||
//                                   meta.label}
//                               </p>
//                               {m.lotNumber && (
//                                 <p className="mt-0.5 text-[10px] text-slate-500">
//                                   Lot {m.lotNumber}
//                                   {m.expiryDate &&
//                                     ` · exp ${new Date(
//                                       m.expiryDate,
//                                     ).toLocaleDateString()}`}
//                                 </p>
//                               )}
//                               {m.userName && (
//                                 <p className="mt-0.5 text-[10px] text-slate-500">
//                                   by {m.userName}
//                                 </p>
//                               )}
//                             </div>
//                           </div>
//                           <div className="shrink-0 text-right">
//                             <p
//                               className={`font-mono text-sm font-bold ${
//                                 isPositive
//                                   ? "text-emerald-300"
//                                   : "text-rose-300"
//                               }`}
//                             >
//                               {isPositive ? "+" : ""}
//                               {m.quantity}
//                             </p>
//                             {m.balanceAfter != null && (
//                               <p className="text-[10px] text-slate-500">
//                                 → {m.balanceAfter}
//                               </p>
//                             )}
//                           </div>
//                         </li>
//                       );
//                     })}
//                     {productMovements.length > 30 && (
//                       <li className="pt-1 text-center text-[10px] text-slate-500">
//                         Showing latest 30 of {productMovements.length}
//                       </li>
//                     )}
//                   </ul>
//                 </>
//               )}
//             </div>
//           )}
//         </div>
//       </aside>
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  Adjust Stock Modal                                                 */
// /* ------------------------------------------------------------------ */

// const ADJUST_REASONS = [
//   { value: "damage", label: "Damaged / broken" },
//   { value: "expired", label: "Expired / destroyed" },
//   { value: "miscount", label: "Inventory miscount" },
//   { value: "found", label: "Found / recovered" },
//   { value: "theft", label: "Theft / loss" },
//   { value: "sample", label: "Sample / giveaway" },
//   { value: "other", label: "Other" },
// ];

// function AdjustStockModal({
//   product,
//   onClose,
//   onSubmit,
// }: {
//   product: Product;
//   onClose: () => void;
//   onSubmit: (payload: AdjustPayload) => Promise<void>;
// }) {
//   const [direction, setDirection] = useState<"in" | "out">("in");
//   const [quantity, setQuantity] = useState("1");
//   const [reason, setReason] = useState("damage");
//   const [notes, setNotes] = useState("");
//   const [submitting, setSubmitting] = useState(false);

//   const currentStock = num(product.stock);
//   const delta = Number(quantity) || 0;
//   const signedDelta = direction === "in" ? delta : -delta;
//   const newStock = currentStock + signedDelta;

//   const handleSubmit = async (event: React.FormEvent) => {
//     event.preventDefault();
//     if (!product.productId || !product.variantId) return;
//     if (!Number.isInteger(delta) || delta < 1) return;
//     setSubmitting(true);
//     try {
//       await onSubmit({
//         productId: product.productId,
//         variantId: product.variantId,
//         quantity: signedDelta,
//         reason,
//         notes: notes.trim() || undefined,
//       });
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div
//       className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
//       onMouseDown={(e) => {
//         if (e.target === e.currentTarget) onClose();
//       }}
//     >
//       <form
//         onSubmit={handleSubmit}
//         className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
//       >
//         <div className="flex items-start justify-between">
//           <div>
//             <h3 className="text-lg font-bold text-white">Adjust stock</h3>
//             <p className="mt-1 text-sm text-slate-400">
//               {product.name} · {currentStock} on hand
//             </p>
//           </div>
//           <button
//             type="button"
//             onClick={onClose}
//             className="rounded-lg p-1.5 text-slate-400 hover:text-white"
//           >
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1">
//           <button
//             type="button"
//             onClick={() => setDirection("in")}
//             className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
//               direction === "in"
//                 ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
//                 : "text-slate-400 hover:text-white"
//             }`}
//           >
//             <Plus className="h-3.5 w-3.5" /> Increase
//           </button>
//           <button
//             type="button"
//             onClick={() => setDirection("out")}
//             className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
//               direction === "out"
//                 ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
//                 : "text-slate-400 hover:text-white"
//             }`}
//           >
//             <Trash2 className="h-3.5 w-3.5" /> Decrease
//           </button>
//         </div>

//         <label className="mt-4 block text-xs font-semibold text-slate-300">
//           Quantity
//           <input
//             autoFocus
//             min="1"
//             step="1"
//             type="number"
//             value={quantity}
//             onChange={(e) => setQuantity(e.target.value)}
//             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//           />
//         </label>

//         <label className="mt-3 block text-xs font-semibold text-slate-300">
//           Reason
//           <select
//             value={reason}
//             onChange={(e) => setReason(e.target.value)}
//             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//           >
//             {ADJUST_REASONS.map((r) => (
//               <option key={r.value} value={r.value}>
//                 {r.label}
//               </option>
//             ))}
//           </select>
//         </label>

//         <label className="mt-3 block text-xs font-semibold text-slate-300">
//           Notes (optional)
//           <textarea
//             value={notes}
//             onChange={(e) => setNotes(e.target.value)}
//             maxLength={500}
//             rows={2}
//             className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//           />
//         </label>

//         <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
//           <p className="text-[10px] font-bold uppercase text-slate-500">
//             Preview
//           </p>
//           <p className="mt-1 text-sm text-slate-300">
//             {currentStock} →{" "}
//             <span
//               className={`font-bold ${
//                 newStock < 0
//                   ? "text-rose-400"
//                   : signedDelta >= 0
//                     ? "text-emerald-300"
//                     : "text-amber-300"
//               }`}
//             >
//               {newStock}
//             </span>{" "}
//             <span className="text-xs text-slate-500">
//               ({signedDelta >= 0 ? "+" : ""}
//               {signedDelta})
//             </span>
//           </p>
//         </div>

//         <div className="mt-4 flex justify-end gap-2">
//           <button
//             type="button"
//             onClick={onClose}
//             className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
//           >
//             Cancel
//           </button>
//           <button
//             type="submit"
//             disabled={submitting || newStock < 0 || delta < 1}
//             className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
//           >
//             {submitting ? "Saving…" : "Apply adjustment"}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  Transfer Stock Modal                                               */
// /* ------------------------------------------------------------------ */

// function TransferStockModal({
//   product,
//   stores,
//   fromStoreId,
//   onClose,
//   onSubmit,
// }: {
//   product: Product;
//   stores: StoreOption[];
//   fromStoreId?: string;
//   onClose: () => void;
//   onSubmit: (payload: TransferPayload) => Promise<void>;
// }) {
//   const [toStoreId, setToStoreId] = useState("");
//   const [quantity, setQuantity] = useState("1");
//   const [notes, setNotes] = useState("");
//   const [submitting, setSubmitting] = useState(false);

//   const currentStock = num(product.stock);
//   const delta = Number(quantity) || 0;
//   const remaining = currentStock - delta;
//   const destinations = stores.filter((s) => s.id !== fromStoreId);

//   const handleSubmit = async (event: React.FormEvent) => {
//     event.preventDefault();
//     if (!product.productId || !product.variantId) return;
//     if (!toStoreId || !fromStoreId) return;
//     if (!Number.isInteger(delta) || delta < 1 || delta > currentStock) return;
//     setSubmitting(true);
//     try {
//       await onSubmit({
//         productId: product.productId,
//         variantId: product.variantId,
//         fromStoreId,
//         toStoreId,
//         quantity: delta,
//         notes: notes.trim() || undefined,
//       });
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div
//       className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
//       onMouseDown={(e) => {
//         if (e.target === e.currentTarget) onClose();
//       }}
//     >
//       <form
//         onSubmit={handleSubmit}
//         className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
//       >
//         <div className="flex items-start justify-between">
//           <div>
//             <h3 className="text-lg font-bold text-white">Transfer stock</h3>
//             <p className="mt-1 text-sm text-slate-400">
//               {product.name} · {currentStock} on hand
//             </p>
//           </div>
//           <button
//             type="button"
//             onClick={onClose}
//             className="rounded-lg p-1.5 text-slate-400 hover:text-white"
//           >
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
//           <span className="rounded-md bg-slate-800 px-2 py-1 font-mono font-bold text-slate-300">
//             FROM
//           </span>
//           <span className="text-slate-300">
//             {stores.find((s) => s.id === fromStoreId)?.name ??
//               fromStoreId ??
//               "Current store"}
//           </span>
//         </div>

//         <label className="mt-3 block text-xs font-semibold text-slate-300">
//           Transfer to
//           <select
//             autoFocus
//             value={toStoreId}
//             onChange={(e) => setToStoreId(e.target.value)}
//             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//           >
//             <option value="">— Select destination —</option>
//             {destinations.map((s) => (
//               <option key={s.id} value={s.id}>
//                 {s.name}
//               </option>
//             ))}
//           </select>
//         </label>

//         <label className="mt-3 block text-xs font-semibold text-slate-300">
//           Quantity
//           <input
//             min="1"
//             max={currentStock}
//             step="1"
//             type="number"
//             value={quantity}
//             onChange={(e) => setQuantity(e.target.value)}
//             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//           />
//         </label>

//         <label className="mt-3 block text-xs font-semibold text-slate-300">
//           Notes (optional)
//           <textarea
//             value={notes}
//             onChange={(e) => setNotes(e.target.value)}
//             maxLength={500}
//             rows={2}
//             className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//           />
//         </label>

//         <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
//           <p className="text-[10px] font-bold uppercase text-slate-500">
//             Preview
//           </p>
//           <p className="mt-1 text-sm text-slate-300">
//             {currentStock} →{" "}
//             <span
//               className={`font-bold ${
//                 remaining < 0 ? "text-rose-400" : "text-amber-300"
//               }`}
//             >
//               {remaining}
//             </span>{" "}
//             <span className="text-xs text-slate-500">(-{delta})</span>
//           </p>
//         </div>

//         <div className="mt-4 flex justify-end gap-2">
//           <button
//             type="button"
//             onClick={onClose}
//             className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
//           >
//             Cancel
//           </button>
//           <button
//             type="submit"
//             disabled={
//               submitting ||
//               !toStoreId ||
//               !fromStoreId ||
//               delta < 1 ||
//               delta > currentStock
//             }
//             className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
//           >
//             {submitting ? "Transferring…" : "Confirm transfer"}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  Global Stock Movements Modal                                       */
// /* ------------------------------------------------------------------ */

// function StockMovementsModal({
//   movements,
//   stores,
//   onClose,
// }: {
//   movements: StockMovement[];
//   stores: StoreOption[];
//   onClose: () => void;
// }) {
//   const [filter, setFilter] = useState<MovementFilter>("all");
//   const [query, setQuery] = useState("");
//   const [days, setDays] = useState<"today" | "7d" | "30d" | "all">("7d");

//   const filtered = useMemo(() => {
//     const now = Date.now();
//     const cutoff =
//       days === "today"
//         ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
//         : days === "7d"
//           ? now - 7 * 86_400_000
//           : days === "30d"
//             ? now - 30 * 86_400_000
//             : 0;

//     const q = query.trim().toLowerCase();

//     return movements.filter((m) => {
//       if (new Date(m.createdAt).getTime() < cutoff) return false;

//       if (filter === "in" && m.quantity <= 0) return false;
//       if (filter === "out" && m.quantity >= 0) return false;
//       if (filter === "transfer" && !m.type.startsWith("TRANSFER")) return false;
//       if (filter === "adjust" && !m.type.startsWith("ADJUST")) return false;

//       if (q) {
//         const haystack = [
//           m.productName,
//           m.sku,
//           m.reference,
//           m.notes,
//           m.reason,
//           m.lotNumber,
//         ]
//           .map((v) => (v ?? "").toString().toLowerCase())
//           .join(" ");
//         if (!haystack.includes(q)) return false;
//       }
//       return true;
//     });
//   }, [movements, filter, query, days]);

//   const totals = useMemo(() => {
//     let inQty = 0;
//     let outQty = 0;
//     for (const m of filtered) {
//       if (m.quantity > 0) inQty += m.quantity;
//       else outQty += Math.abs(m.quantity);
//     }
//     return { inQty, outQty, count: filtered.length };
//   }, [filtered]);

//   return (
//     <div
//       className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"
//       onMouseDown={(e) => {
//         if (e.target === e.currentTarget) onClose();
//       }}
//     >
//       <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
//         {/* Header */}
//         <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
//           <div className="flex items-center gap-3">
//             <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
//               <History className="h-4 w-4" />
//             </span>
//             <div>
//               <h3 className="text-base font-bold text-white">
//                 Stock Movements
//               </h3>
//               <p className="text-[11px] text-slate-400">
//                 {totals.count} record{totals.count === 1 ? "" : "s"} · +
//                 {totals.inQty} in · −{totals.outQty} out
//               </p>
//             </div>
//           </div>
//           <button
//             type="button"
//             onClick={onClose}
//             className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
//           >
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         {/* Filters */}
//         <div className="flex flex-col gap-2 border-b border-slate-800 p-3 md:flex-row md:items-center">
//           <div className="relative flex-1">
//             <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
//             <input
//               type="text"
//               placeholder="Search product, SKU, reference…"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
//             />
//             {query && (
//               <button
//                 type="button"
//                 onClick={() => setQuery("")}
//                 className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
//               >
//                 <X className="h-3 w-3" />
//               </button>
//             )}
//           </div>

//           <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
//             {(["all", "in", "out", "transfer", "adjust"] as const).map((f) => (
//               <button
//                 key={f}
//                 type="button"
//                 onClick={() => setFilter(f)}
//                 className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
//                   filter === f
//                     ? "bg-sky-400 text-slate-950"
//                     : "text-slate-400 hover:text-white"
//                 }`}
//               >
//                 {f}
//               </button>
//             ))}
//           </div>

//           <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
//             {(["today", "7d", "30d", "all"] as const).map((d) => (
//               <button
//                 key={d}
//                 type="button"
//                 onClick={() => setDays(d)}
//                 className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
//                   days === d
//                     ? "bg-sky-400 text-slate-950"
//                     : "text-slate-400 hover:text-white"
//                 }`}
//               >
//                 {d}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* List */}
//         <div className="flex-1 overflow-y-auto p-3">
//           {filtered.length === 0 ? (
//             <div className="grid h-full place-items-center text-center">
//               <div>
//                 <History className="mx-auto h-10 w-10 text-slate-700" />
//                 <p className="mt-3 text-sm font-semibold text-slate-400">
//                   No movements match
//                 </p>
//                 <p className="mt-1 text-xs text-slate-500">
//                   Try a different filter or date range.
//                 </p>
//               </div>
//             </div>
//           ) : (
//             <ul className="space-y-1.5">
//               {filtered.map((m) => {
//                 const meta = MOVEMENT_META[m.type];
//                 const Icon = meta.icon;
//                 const isPositive = m.quantity > 0;
//                 const fromName = m.fromStoreId
//                   ? (stores.find((s) => s.id === m.fromStoreId)?.name ??
//                     m.fromStoreId)
//                   : null;
//                 const toName = m.toStoreId
//                   ? (stores.find((s) => s.id === m.toStoreId)?.name ??
//                     m.toStoreId)
//                   : null;

//                 return (
//                   <li
//                     key={m.id}
//                     className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-3 transition hover:border-slate-700"
//                   >
//                     <div className="flex min-w-0 flex-1 items-start gap-3">
//                       <span
//                         className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.chip}`}
//                       >
//                         <Icon className="h-4 w-4" />
//                       </span>
//                       <div className="min-w-0">
//                         <div className="flex flex-wrap items-center gap-1.5">
//                           <span
//                             className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}
//                           >
//                             {meta.label}
//                           </span>
//                           <span className="text-[10px] text-slate-500">
//                             {formatRelativeTime(m.createdAt)}
//                           </span>
//                         </div>
//                         <p className="mt-1 truncate text-sm font-semibold text-slate-100">
//                           {m.productName}
//                           {m.sku && (
//                             <span className="ml-2 font-mono text-[10px] font-normal text-slate-500">
//                               {m.sku}
//                             </span>
//                           )}
//                         </p>
//                         <p className="mt-0.5 truncate text-[11px] text-slate-400">
//                           {m.reference ||
//                             m.notes ||
//                             (m.reason ? `Reason: ${m.reason}` : meta.label)}
//                         </p>
//                         {(fromName || toName) && (
//                           <p className="mt-0.5 text-[10px] text-violet-300/80">
//                             {fromName && `From ${fromName}`}
//                             {fromName && toName && " → "}
//                             {toName && `To ${toName}`}
//                           </p>
//                         )}
//                         {m.lotNumber && (
//                           <p className="mt-0.5 text-[10px] text-slate-500">
//                             Lot {m.lotNumber}
//                             {m.expiryDate &&
//                               ` · exp ${new Date(
//                                 m.expiryDate,
//                               ).toLocaleDateString()}`}
//                           </p>
//                         )}
//                       </div>
//                     </div>

//                     <div className="shrink-0 text-right">
//                       <p
//                         className={`font-mono text-base font-black ${
//                           isPositive ? "text-emerald-300" : "text-rose-300"
//                         }`}
//                       >
//                         {isPositive ? "+" : ""}
//                         {m.quantity}
//                       </p>
//                       {m.balanceAfter != null && (
//                         <p className="text-[10px] text-slate-500">
//                           bal {m.balanceAfter}
//                         </p>
//                       )}
//                     </div>
//                   </li>
//                 );
//               })}
//             </ul>
//           )}
//         </div>

//         {/* Footer */}
//         <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-[11px] text-slate-500">
//           <span>
//             Showing {filtered.length} of {movements.length} movements
//           </span>
//           <button
//             type="button"
//             onClick={onClose}
//             className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-300 hover:border-slate-600 hover:text-white"
//           >
//             Close
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // import {
// //   AlertTriangle,
// //   ArrowDown,
// //   ArrowUp,
// //   ArrowUpDown,
// //   CalendarClock,
// //   ChevronLeft,
// //   ChevronRight,
// //   ChevronsLeft,
// //   ChevronsRight,
// //   Download,
// //   Keyboard,
// //   Package,
// //   Plus,
// //   RotateCcw,
// //   Search,
// //   Send,
// //   Trash2,
// //   TrendingDown,
// //   Truck,
// //   Undo2,
// //   Wallet,
// //   X,
// // } from "lucide-react";
// // import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// // import { Product } from "../types";
// // import {
// //   useCreateStockRequestMutation,
// //   useGetStockRequestsQuery,
// // } from "../store/apiSlice";

// // /* ------------------------------------------------------------------ */
// // /*  Config                                                             */
// // /* ------------------------------------------------------------------ */

// // const LOW_THRESHOLD = 20;
// // const CRITICAL_THRESHOLD = 5;
// // const EXPIRY_CRITICAL_DAYS = 30;
// // const EXPIRY_SOON_DAYS = 90;

// // type SortKey = "name" | "sku" | "category" | "price" | "stock";
// // type SortDir = "asc" | "desc";
// // type StockFilter =
// //   | "all"
// //   | "in"
// //   | "low"
// //   | "critical"
// //   | "out"
// //   | "expiring"
// //   | "expired"
// //   | "reorder";
// // type ExpiryTier = "expired" | "critical" | "soon" | "ok" | "none";
// // type DrawerTab = "overview" | "batches" | "history";

// // /* ------------------------------------------------------------------ */
// // /*  Helpers                                                            */
// // /* ------------------------------------------------------------------ */

// // const num = (value: unknown) => Number(value) || 0;

// // const daysUntil = (date?: string) => {
// //   if (!date) return Infinity;
// //   const time = new Date(date).getTime();
// //   if (Number.isNaN(time)) return Infinity;
// //   return Math.ceil((time - Date.now()) / 86_400_000);
// // };

// // type Tone = "in" | "low" | "critical" | "out";

// // const getTone = (stock: number): Tone => {
// //   if (stock <= 0) return "out";
// //   if (stock <= CRITICAL_THRESHOLD) return "critical";
// //   if (stock <= LOW_THRESHOLD) return "low";
// //   return "in";
// // };

// // const TONE_META: Record<Tone, { label: string; className: string }> = {
// //   in: {
// //     label: "In Stock",
// //     className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
// //   },
// //   low: {
// //     label: "Low",
// //     className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
// //   },
// //   critical: {
// //     label: "Critical",
// //     className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
// //   },
// //   out: {
// //     label: "Out of Stock",
// //     className: "bg-slate-600/20 text-slate-400 border-slate-600/40",
// //   },
// // };

// // const getExpiryTier = (days: number): ExpiryTier => {
// //   if (!Number.isFinite(days)) return "none";
// //   if (days < 0) return "expired";
// //   if (days <= EXPIRY_CRITICAL_DAYS) return "critical";
// //   if (days <= EXPIRY_SOON_DAYS) return "soon";
// //   return "ok";
// // };

// // const EXPIRY_TIER_META: Record<
// //   ExpiryTier,
// //   { label: string; chip: string; border: string }
// // > = {
// //   expired: {
// //     label: "Expired",
// //     chip: "bg-rose-500/20 text-rose-300 border-rose-500/40",
// //     border: "border-rose-500/30 bg-rose-500/5",
// //   },
// //   critical: {
// //     label: `≤${EXPIRY_CRITICAL_DAYS}d`,
// //     chip: "bg-orange-500/20 text-orange-300 border-orange-500/40",
// //     border: "border-orange-500/30 bg-orange-500/5",
// //   },
// //   soon: {
// //     label: `≤${EXPIRY_SOON_DAYS}d`,
// //     chip: "bg-amber-500/20 text-amber-300 border-amber-500/40",
// //     border: "border-amber-500/30 bg-amber-500/5",
// //   },
// //   ok: {
// //     label: "OK",
// //     chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
// //     border: "border-slate-800 bg-slate-950/50",
// //   },
// //   none: {
// //     label: "No expiry",
// //     chip: "bg-slate-700/30 text-slate-400 border-slate-700",
// //     border: "border-slate-800 bg-slate-950/50",
// //   },
// // };

// // // FEFO — sort lots so soonest expiry shows first
// // const getLots = (product: Product) =>
// //   (product.inventories ?? [])
// //     .filter((inventory) => inventory.lot)
// //     .map((inventory, index) => ({
// //       key: `${inventory.lot?.number ?? "lot"}-${index}`,
// //       number: inventory.lot?.number ?? "—",
// //       expiryDate: inventory.lot?.expiryDate,
// //       quantity: num(inventory.quantity),
// //       days: daysUntil(inventory.lot?.expiryDate ?? undefined),
// //     }))
// //     .sort((a, b) => {
// //       if (!Number.isFinite(a.days)) return 1;
// //       if (!Number.isFinite(b.days)) return -1;
// //       return a.days - b.days;
// //     });

// // const getExpirySummary = (product: Product) => {
// //   const lots = getLots(product);
// //   const expired = lots.filter((l) => l.days < 0);
// //   const critical = lots.filter(
// //     (l) => l.days >= 0 && l.days <= EXPIRY_CRITICAL_DAYS,
// //   );
// //   const soon = lots.filter(
// //     (l) => l.days > EXPIRY_CRITICAL_DAYS && l.days <= EXPIRY_SOON_DAYS,
// //   );
// //   return {
// //     lots,
// //     expiredCount: expired.length,
// //     criticalCount: critical.length,
// //     soonCount: soon.length,
// //     soonest: lots[0] ?? null,
// //     hasRisk: expired.length + critical.length + soon.length > 0,
// //     totalAtRisk: [...expired, ...critical, ...soon].reduce(
// //       (s, l) => s + l.quantity,
// //       0,
// //     ),
// //   };
// // };

// // const hasExpiryRisk = (product: Product) => getExpirySummary(product).hasRisk;

// // const reorderPoint = (product: Product) => {
// //   const values = (product.inventories ?? [])
// //     .map((row) => num(row.reorderPoint))
// //     .filter((value) => value > 0);
// //   return values.length ? Math.max(...values) : 10;
// // };

// // const suggestedReorder = (product: Product) => {
// //   const quantities = (product.inventories ?? []).map((row) =>
// //     num(row.reorderQty),
// //   );
// //   const reorderQty = quantities.length ? Math.max(...quantities) : 0;
// //   return Math.max(reorderQty, reorderPoint(product) - num(product.stock));
// // };

// // const productSubtitle = (product: Product) =>
// //   [
// //     product.genericName,
// //     product.activeIngredient,
// //     product.strength,
// //     product.dosageForm,
// //   ]
// //     .filter(Boolean)
// //     .join(" · ");

// // const csvCell = (value: unknown) =>
// //   `"${String(value ?? "").replace(/"/g, '""')}"`;

// // /* ------------------------------------------------------------------ */
// // /*  Component                                                          */
// // /* ------------------------------------------------------------------ */

// // interface StoreOption {
// //   id: string;
// //   name: string;
// // }

// // interface AdjustPayload {
// //   productId: string;
// //   variantId: string;
// //   quantity: number;
// //   reason: string;
// //   notes?: string;
// // }

// // interface TransferPayload {
// //   productId: string;
// //   variantId: string;
// //   fromStoreId: string;
// //   toStoreId: string;
// //   quantity: number;
// //   notes?: string;
// // }

// // interface InventoryViewProps {
// //   products: Product[];
// //   storeId?: string;
// //   userRole?: string;
// //   isLoading?: boolean;
// //   onRequestSubmitted?: () => void;
// //   /** Optional external handler for stock adjustment */
// //   onAdjustStock?: (payload: AdjustPayload) => Promise<void>;
// //   /** Optional external handler for stock transfer */
// //   onTransferStock?: (payload: TransferPayload) => Promise<void>;
// //   /** Stores available for transfer destination */
// //   stores?: StoreOption[];
// // }

// // export function InventoryView({
// //   products,
// //   storeId,
// //   userRole = "CASHIER",
// //   isLoading = false,
// //   onRequestSubmitted,
// //   onAdjustStock,
// //   onTransferStock,
// //   stores = [],
// // }: InventoryViewProps) {
// //   const [query, setQuery] = useState("");
// //   const [stockFilter, setStockFilter] = useState<StockFilter>("all");
// //   const [sortKey, setSortKey] = useState<SortKey>("name");
// //   const [sortDir, setSortDir] = useState<SortDir>("asc");
// //   const [pageSize, setPageSize] = useState<number>(100);
// //   const [currentPage, setCurrentPage] = useState<number>(1);
// //   const [selected, setSelected] = useState<Product | null>(null);
// //   const [requestTarget, setRequestTarget] = useState<Product | null>(null);
// //   const [requestQuantity, setRequestQuantity] = useState("1");
// //   const [requestReason, setRequestReason] = useState("");
// //   const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
// //   const [transferTarget, setTransferTarget] = useState<Product | null>(null);

// //   const requestQueryStoreId = ["ADMIN", "SUPER_ADMIN"].includes(userRole)
// //     ? undefined
// //     : storeId;

// //   const { data: stockRequests = [] } = useGetStockRequestsQuery(
// //     { storeId: requestQueryStoreId },
// //     {
// //       pollingInterval: 15000,
// //       skip: !storeId && !["ADMIN", "SUPER_ADMIN"].includes(userRole),
// //     },
// //   );

// //   const [createStockRequest, { isLoading: isRequesting }] =
// //     useCreateStockRequestMutation();

// //   const canCreateRequests = ["CASHIER", "MANAGER"].includes(userRole);
// //   const canManageStock = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(userRole);
// //   const searchRef = useRef<HTMLInputElement>(null);

// //   /* ------------------------- filtering ------------------------- */

// //   const searchFiltered = useMemo(() => {
// //     const normalized = query.trim().toLowerCase();
// //     if (!normalized) return products;
// //     return products.filter((product) =>
// //       [product.name, product.sku, product.barcode, product.category]
// //         .map((value) => (value || "").toString().toLowerCase())
// //         .some((value) => value.includes(normalized)),
// //     );
// //   }, [products, query]);

// //   const filteredProducts = useMemo(() => {
// //     if (stockFilter === "all") return searchFiltered;
// //     if (stockFilter === "expiring") return searchFiltered.filter(hasExpiryRisk);
// //     if (stockFilter === "expired")
// //       return searchFiltered.filter((product) => {
// //         const summary = getExpirySummary(product);
// //         return summary.expiredCount > 0;
// //       });
// //     if (stockFilter === "reorder")
// //       return searchFiltered.filter(
// //         (product) => num(product.stock) <= reorderPoint(product),
// //       );
// //     return searchFiltered.filter(
// //       (product) => getTone(num(product.stock)) === stockFilter,
// //     );
// //   }, [searchFiltered, stockFilter]);

// //   /* -------------------------- sorting -------------------------- */

// //   const sortedProducts = useMemo(() => {
// //     const copy = [...filteredProducts];
// //     copy.sort((a, b) => {
// //       let cmp = 0;
// //       if (sortKey === "price") cmp = num(a.price) - num(b.price);
// //       else if (sortKey === "stock") cmp = num(a.stock) - num(b.stock);
// //       else
// //         cmp = String(a[sortKey] ?? "").localeCompare(
// //           String(b[sortKey] ?? ""),
// //           undefined,
// //           { numeric: true, sensitivity: "base" },
// //         );
// //       return sortDir === "asc" ? cmp : -cmp;
// //     });
// //     return copy;
// //   }, [filteredProducts, sortKey, sortDir]);

// //   /* ------------------------ pagination ------------------------- */

// //   const totalItems = sortedProducts.length;
// //   const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
// //   const activePage = Math.min(currentPage, totalPages);

// //   const paginatedProducts = useMemo(() => {
// //     if (pageSize <= 0) return sortedProducts;
// //     const start = (activePage - 1) * pageSize;
// //     return sortedProducts.slice(start, start + pageSize);
// //   }, [sortedProducts, activePage, pageSize]);

// //   const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
// //   const endItem =
// //     pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

// //   /* --------------------------- stats --------------------------- */

// //   const stats = useMemo(() => {
// //     const result = {
// //       total: searchFiltered.length,
// //       in: 0,
// //       low: 0,
// //       critical: 0,
// //       out: 0,
// //       expiring: 0,
// //       expired: 0,
// //       expiryCritical: 0,
// //       expirySoon: 0,
// //       unitsAtRisk: 0,
// //       reorder: 0,
// //       stockValue: 0,
// //       units: 0,
// //     };
// //     for (const product of searchFiltered) {
// //       const stock = num(product.stock);
// //       result[getTone(stock)] += 1;
// //       result.units += stock;
// //       result.stockValue += stock * num(product.price);

// //       const summary = getExpirySummary(product);
// //       if (summary.expiredCount > 0) result.expired += 1;
// //       if (summary.criticalCount > 0) result.expiryCritical += 1;
// //       if (summary.soonCount > 0) result.expirySoon += 1;
// //       if (summary.hasRisk) {
// //         result.expiring += 1;
// //         result.unitsAtRisk += summary.totalAtRisk;
// //       }
// //       if (stock <= reorderPoint(product)) result.reorder += 1;
// //     }
// //     return result;
// //   }, [searchFiltered]);

// //   const chips: { id: StockFilter; label: string; count: number }[] = [
// //     { id: "all", label: "All", count: stats.total },
// //     { id: "in", label: "In stock", count: stats.in },
// //     { id: "low", label: "Low", count: stats.low },
// //     { id: "critical", label: "Critical", count: stats.critical },
// //     { id: "out", label: "Out of stock", count: stats.out },
// //     {
// //       id: "expiring",
// //       label: `Expiring ≤${EXPIRY_SOON_DAYS}d`,
// //       count: stats.expiring,
// //     },
// //     { id: "expired", label: "Expired", count: stats.expired },
// //     { id: "reorder", label: "Reorder", count: stats.reorder },
// //   ];

// //   const filtersActive = query !== "" || stockFilter !== "all";

// //   /* -------------------------- handlers ------------------------- */

// //   const resetPage = useCallback(() => setCurrentPage(1), []);

// //   const handleSort = (key: SortKey) => {
// //     if (key === sortKey) {
// //       setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
// //     } else {
// //       setSortKey(key);
// //       setSortDir(key === "price" || key === "stock" ? "desc" : "asc");
// //     }
// //     resetPage();
// //   };

// //   const resetFilters = () => {
// //     setQuery("");
// //     setStockFilter("all");
// //     setSortKey("name");
// //     setSortDir("asc");
// //     resetPage();
// //   };

// //   const exportCsv = () => {
// //     const headers = [
// //       "Name",
// //       "SKU",
// //       "Barcode",
// //       "Category",
// //       "Price (MMK)",
// //       "Stock",
// //       "Status",
// //       "Expired lots",
// //       "Expiring ≤30d",
// //       "Expiring ≤90d",
// //     ];
// //     const rows = sortedProducts.map((product) => {
// //       const stock = num(product.stock);
// //       const tone = getTone(stock);
// //       const summary = getExpirySummary(product);
// //       return [
// //         product.name,
// //         product.sku,
// //         product.barcode ?? "",
// //         product.category ?? "",
// //         num(product.price),
// //         stock,
// //         TONE_META[tone].label,
// //         summary.expiredCount,
// //         summary.criticalCount,
// //         summary.soonCount,
// //       ];
// //     });
// //     const csv = [headers, ...rows]
// //       .map((row) => row.map(csvCell).join(","))
// //       .join("\r\n");

// //     const blob = new Blob(["\uFEFF" + csv], {
// //       type: "text/csv;charset=utf-8;",
// //     });
// //     const url = URL.createObjectURL(blob);
// //     const link = document.createElement("a");
// //     link.href = url;
// //     link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
// //     document.body.appendChild(link);
// //     link.click();
// //     document.body.removeChild(link);
// //     URL.revokeObjectURL(url);
// //   };

// //   /* ---------------------- keyboard shortcuts ------------------- */

// //   useEffect(() => {
// //     const handleKey = (event: KeyboardEvent) => {
// //       const target = event.target as HTMLElement | null;
// //       const typing =
// //         target &&
// //         (target.tagName === "INPUT" ||
// //           target.tagName === "TEXTAREA" ||
// //           target.tagName === "SELECT" ||
// //           target.isContentEditable);

// //       if (
// //         !typing &&
// //         (event.key === "/" ||
// //           ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"))
// //       ) {
// //         event.preventDefault();
// //         searchRef.current?.focus();
// //         searchRef.current?.select();
// //       }
// //       if (event.key === "Escape") {
// //         setSelected(null);
// //         if (document.activeElement === searchRef.current) {
// //           searchRef.current?.blur();
// //         }
// //       }
// //     };
// //     window.addEventListener("keydown", handleKey);
// //     return () => window.removeEventListener("keydown", handleKey);
// //   }, []);

// //   /* ---------------------------- render ------------------------- */

// //   return (
// //     <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
// //       {/* Header */}
// //       <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
// //         <div>
// //           <h2 className="text-2xl font-black text-white md:text-3xl">
// //             Products &amp; Stock
// //           </h2>
// //           <p className="mt-1 text-xs text-slate-400">
// //             {products.length.toLocaleString()} products loaded from the selected
// //             store
// //             {filtersActive && (
// //               <>
// //                 {" · "}
// //                 <span className="text-sky-400">
// //                   {stats.total.toLocaleString()} matching filters
// //                 </span>
// //               </>
// //             )}
// //           </p>
// //         </div>

// //         <div className="flex items-center gap-2">
// //           <span className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-500 lg:flex">
// //             <Keyboard className="h-3.5 w-3.5" />
// //             <kbd className="font-sans font-semibold text-slate-300">/</kbd>
// //             or
// //             <kbd className="font-sans font-semibold text-slate-300">⌘K</kbd>
// //             to search
// //           </span>
// //           <button
// //             type="button"
// //             onClick={exportCsv}
// //             disabled={sortedProducts.length === 0}
// //             className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-40 md:w-auto"
// //           >
// //             <Download className="h-3.5 w-3.5" />
// //             Export CSV
// //           </button>
// //         </div>
// //       </div>

// //       {/* KPI cards */}
// //       <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
// //         <StatCard
// //           icon={Package}
// //           label="Products"
// //           value={stats.total.toLocaleString()}
// //           note={`${stats.units.toLocaleString()} units on hand`}
// //           tone="sky"
// //         />
// //         <StatCard
// //           icon={Wallet}
// //           label="Stock value"
// //           value={`${Math.round(stats.stockValue).toLocaleString()} MMK`}
// //           note="Retail price × quantity"
// //           tone="emerald"
// //         />
// //         <StatCard
// //           icon={TrendingDown}
// //           label="Needs attention"
// //           value={(stats.low + stats.critical + stats.out).toLocaleString()}
// //           note={`${stats.critical} critical · ${stats.out} out of stock`}
// //           tone={stats.critical + stats.out > 0 ? "rose" : "amber"}
// //         />
// //         <StatCard
// //           icon={CalendarClock}
// //           label="Expiry risk"
// //           value={stats.expiring.toLocaleString()}
// //           note={
// //             stats.expired > 0
// //               ? `${stats.expired} expired · ${stats.unitsAtRisk} units at risk`
// //               : `Lots expiring within ${EXPIRY_SOON_DAYS} days`
// //           }
// //           tone={
// //             stats.expired > 0 ? "rose" : stats.expiring > 0 ? "amber" : "slate"
// //           }
// //         />
// //       </section>

// //       {/* Search / filter bar */}
// //       <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
// //         <div className="relative w-full md:max-w-sm">
// //           <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
// //           <input
// //             ref={searchRef}
// //             type="text"
// //             placeholder="Search by name, SKU, barcode…"
// //             value={query}
// //             onChange={(event) => {
// //               setQuery(event.target.value);
// //               resetPage();
// //             }}
// //             className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white placeholder-slate-500 transition-colors focus:border-sky-500 focus:outline-none"
// //           />
// //           {query && (
// //             <button
// //               type="button"
// //               aria-label="Clear search"
// //               onClick={() => {
// //                 setQuery("");
// //                 resetPage();
// //                 searchRef.current?.focus();
// //               }}
// //               className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:text-white"
// //             >
// //               <X className="h-3.5 w-3.5" />
// //             </button>
// //           )}
// //         </div>

// //         <div className="flex items-center justify-between gap-3 md:ml-auto md:justify-end">
// //           {filtersActive && (
// //             <button
// //               type="button"
// //               onClick={resetFilters}
// //               className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
// //             >
// //               <RotateCcw className="h-3.5 w-3.5" />
// //               Reset
// //             </button>
// //           )}
// //           <label className="flex items-center gap-2 text-xs text-slate-400">
// //             Per page:
// //             <select
// //               value={pageSize}
// //               onChange={(event) => {
// //                 setPageSize(Number(event.target.value));
// //                 resetPage();
// //               }}
// //               className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
// //             >
// //               <option value={50}>50</option>
// //               <option value={100}>100</option>
// //               <option value={250}>250</option>
// //               <option value={500}>500</option>
// //               <option value={0}>All ({totalItems})</option>
// //             </select>
// //           </label>
// //         </div>
// //       </div>

// //       {/* Quick filter chips */}
// //       <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-2 md:flex-wrap md:pb-0">
// //         {chips.map((chip) => {
// //           const active = stockFilter === chip.id;
// //           return (
// //             <button
// //               key={chip.id}
// //               type="button"
// //               onClick={() => {
// //                 setStockFilter(chip.id);
// //                 resetPage();
// //               }}
// //               className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
// //                 active
// //                   ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
// //                   : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
// //               }`}
// //             >
// //               {chip.label}
// //               <span
// //                 className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
// //                   active
// //                     ? "bg-sky-500/25 text-sky-100"
// //                     : "bg-slate-800 text-slate-400"
// //                 }`}
// //               >
// //                 {chip.count.toLocaleString()}
// //               </span>
// //             </button>
// //           );
// //         })}
// //       </div>

// //       {/* ================= DESKTOP TABLE VIEW ================= */}
// //       <div className="hidden md:block flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/70">
// //         <table className="w-full text-sm">
// //           <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
// //             <tr className="border-b border-slate-800 text-left">
// //               <SortableHeader
// //                 label="Product"
// //                 sortKey="name"
// //                 activeKey={sortKey}
// //                 dir={sortDir}
// //                 onSort={handleSort}
// //               />
// //               <SortableHeader
// //                 label="SKU"
// //                 sortKey="sku"
// //                 activeKey={sortKey}
// //                 dir={sortDir}
// //                 onSort={handleSort}
// //               />
// //               <SortableHeader
// //                 label="Category"
// //                 sortKey="category"
// //                 activeKey={sortKey}
// //                 dir={sortDir}
// //                 onSort={handleSort}
// //               />
// //               <SortableHeader
// //                 label="Price"
// //                 sortKey="price"
// //                 activeKey={sortKey}
// //                 dir={sortDir}
// //                 onSort={handleSort}
// //                 align="right"
// //               />
// //               <SortableHeader
// //                 label="Stock & Expiry"
// //                 sortKey="stock"
// //                 activeKey={sortKey}
// //                 dir={sortDir}
// //                 onSort={handleSort}
// //                 align="right"
// //               />
// //               <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
// //                 Status
// //               </th>
// //             </tr>
// //           </thead>
// //           <tbody>
// //             {paginatedProducts.map((product) => {
// //               const stock = num(product.stock);
// //               const tone = TONE_META[getTone(stock)];
// //               const subtitle = productSubtitle(product);
// //               const summary = getExpirySummary(product);
// //               const soonest = summary.soonest;
// //               const soonestTier = soonest
// //                 ? getExpiryTier(soonest.days)
// //                 : "none";
// //               const soonestMeta = EXPIRY_TIER_META[soonestTier];

// //               return (
// //                 <tr
// //                   key={product.id}
// //                   onClick={() => setSelected(product)}
// //                   className="cursor-pointer border-b border-slate-800/50 transition-colors last:border-0 hover:bg-slate-800/30"
// //                 >
// //                   <td className="px-5 py-3">
// //                     <div className="flex items-start gap-2">
// //                       {summary.hasRisk && (
// //                         <AlertTriangle
// //                           className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
// //                             summary.expiredCount > 0
// //                               ? "text-rose-400"
// //                               : "text-amber-400"
// //                           }`}
// //                           aria-label="Expiry risk"
// //                         />
// //                       )}
// //                       <div className="min-w-0">
// //                         <span className="block font-semibold text-slate-100">
// //                           {product.name}
// //                         </span>
// //                         {subtitle && (
// //                           <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-400/90">
// //                             {subtitle}
// //                           </span>
// //                         )}
// //                       </div>
// //                     </div>
// //                   </td>

// //                   <td className="px-5 py-3 font-mono text-xs text-slate-400">
// //                     {product.sku}
// //                   </td>

// //                   <td className="px-5 py-3">
// //                     <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
// //                       {product.category || "Uncategorised"}
// //                     </span>
// //                   </td>

// //                   <td className="px-5 py-3 text-right font-bold tabular-nums text-white">
// //                     {num(product.price).toLocaleString()}{" "}
// //                     <span className="text-xs font-normal text-slate-500">
// //                       MMK
// //                     </span>
// //                   </td>

// //                   <td className="px-5 py-3 text-right">
// //                     <div className="font-bold tabular-nums text-white">
// //                       {stock.toLocaleString()}
// //                     </div>

// //                     {stock <= reorderPoint(product) && (
// //                       <div className="mt-1 text-[10px] font-semibold text-amber-300">
// //                         Reorder {suggestedReorder(product)} · min{" "}
// //                         {reorderPoint(product)}
// //                       </div>
// //                     )}

// //                     {/* Expiry chips */}
// //                     {summary.lots.length > 0 && (
// //                       <div className="mt-1.5 flex flex-wrap justify-end gap-1">
// //                         {summary.expiredCount > 0 && (
// //                           <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
// //                             {summary.expiredCount} expired
// //                           </span>
// //                         )}
// //                         {summary.criticalCount > 0 && (
// //                           <span className="rounded-full border border-orange-500/40 bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
// //                             {summary.criticalCount} ≤{EXPIRY_CRITICAL_DAYS}d
// //                           </span>
// //                         )}
// //                         {summary.soonCount > 0 && (
// //                           <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
// //                             {summary.soonCount} ≤{EXPIRY_SOON_DAYS}d
// //                           </span>
// //                         )}
// //                       </div>
// //                     )}

// //                     {soonest?.expiryDate && (
// //                       <div
// //                         className={`mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${soonestMeta.chip}`}
// //                       >
// //                         <CalendarClock className="h-3 w-3" />
// //                         {soonest.days < 0
// //                           ? `Exp ${Math.abs(soonest.days)}d ago`
// //                           : `Exp in ${soonest.days}d`}
// //                       </div>
// //                     )}
// //                   </td>

// //                   <td className="px-5 py-3 text-center">
// //                     <span
// //                       className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.className}`}
// //                     >
// //                       {tone.label}
// //                     </span>
// //                     {canCreateRequests &&
// //                       storeId &&
// //                       stock <= reorderPoint(product) &&
// //                       (() => {
// //                         const existingRequest = stockRequests.find(
// //                           (request: any) =>
// //                             request.storeId === storeId &&
// //                             request.productId === product.productId &&
// //                             request.variantId === product.variantId &&
// //                             ["PENDING", "ACKNOWLEDGED"].includes(
// //                               request.status,
// //                             ),
// //                         );
// //                         return (
// //                           <button
// //                             type="button"
// //                             disabled={!!existingRequest}
// //                             onClick={(event) => {
// //                               event.stopPropagation();
// //                               setRequestTarget(product);
// //                               setRequestQuantity(
// //                                 String(suggestedReorder(product)),
// //                               );
// //                             }}
// //                             className="mt-2 block w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
// //                           >
// //                             {existingRequest
// //                               ? `Request ${existingRequest.status.toLowerCase()}`
// //                               : "Request stock"}
// //                           </button>
// //                         );
// //                       })()}
// //                   </td>
// //                 </tr>
// //               );
// //             })}

// //             {paginatedProducts.length === 0 && (
// //               <tr>
// //                 <td
// //                   colSpan={6}
// //                   className="px-5 py-12 text-center text-sm text-slate-400"
// //                 >
// //                   {isLoading
// //                     ? "Loading products…"
// //                     : filtersActive
// //                       ? "No products match the current filters."
// //                       : "No products found in this store."}
// //                 </td>
// //               </tr>
// //             )}
// //           </tbody>
// //         </table>
// //       </div>

// //       {/* ================= MOBILE CARD VIEW ================= */}
// //       <div className="md:hidden space-y-3">
// //         {isLoading ? (
// //           <p className="p-10 text-center text-sm text-slate-400">
// //             Loading products…
// //           </p>
// //         ) : paginatedProducts.length === 0 ? (
// //           <p className="p-10 text-center text-sm text-slate-400">
// //             {filtersActive
// //               ? "No products match the current filters."
// //               : "No products found in this store."}
// //           </p>
// //         ) : (
// //           paginatedProducts.map((product) => {
// //             const stock = num(product.stock);
// //             const tone = TONE_META[getTone(stock)];
// //             const subtitle = productSubtitle(product);
// //             const summary = getExpirySummary(product);
// //             const soonest = summary.soonest;
// //             const soonestMeta = soonest
// //               ? EXPIRY_TIER_META[getExpiryTier(soonest.days)]
// //               : null;

// //             const existingRequest =
// //               canCreateRequests && storeId && stock <= reorderPoint(product)
// //                 ? stockRequests.find(
// //                     (request: any) =>
// //                       request.storeId === storeId &&
// //                       request.productId === product.productId &&
// //                       request.variantId === product.variantId &&
// //                       ["PENDING", "ACKNOWLEDGED"].includes(request.status),
// //                   )
// //                 : null;

// //             return (
// //               <div
// //                 key={product.id}
// //                 onClick={() => setSelected(product)}
// //                 className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
// //               >
// //                 <div className="flex items-start justify-between gap-3">
// //                   <div className="min-w-0">
// //                     <div className="flex items-center gap-1.5">
// //                       {summary.hasRisk && (
// //                         <AlertTriangle
// //                           className={`h-3.5 w-3.5 shrink-0 ${
// //                             summary.expiredCount > 0
// //                               ? "text-rose-400"
// //                               : "text-amber-400"
// //                           }`}
// //                         />
// //                       )}
// //                       <span className="font-semibold text-slate-100 truncate">
// //                         {product.name}
// //                       </span>
// //                     </div>
// //                     {subtitle && (
// //                       <p className="mt-0.5 text-[11px] font-medium text-emerald-400/90 truncate">
// //                         {subtitle}
// //                       </p>
// //                     )}
// //                   </div>
// //                   <span
// //                     className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.className}`}
// //                   >
// //                     {tone.label}
// //                   </span>
// //                 </div>

// //                 <div className="flex items-center justify-between text-xs">
// //                   <span className="font-mono text-slate-400">
// //                     {product.sku}
// //                   </span>
// //                   <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
// //                     {product.category || "Uncategorised"}
// //                   </span>
// //                 </div>

// //                 {/* Expiry row */}
// //                 {soonest?.expiryDate && soonestMeta && (
// //                   <div
// //                     className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] ${soonestMeta.border}`}
// //                   >
// //                     <span className="flex items-center gap-1.5 text-slate-300">
// //                       <CalendarClock className="h-3.5 w-3.5" />
// //                       {soonest.days < 0
// //                         ? `Expired ${Math.abs(soonest.days)}d ago`
// //                         : `Expires in ${soonest.days}d`}
// //                     </span>
// //                     <span
// //                       className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${soonestMeta.chip}`}
// //                     >
// //                       {soonestMeta.label}
// //                     </span>
// //                   </div>
// //                 )}

// //                 <div className="flex items-end justify-between border-t border-slate-800/80 pt-3">
// //                   <div>
// //                     <p className="text-[10px] text-slate-500">Price</p>
// //                     <p className="text-sm font-bold text-white">
// //                       {num(product.price).toLocaleString()} MMK
// //                     </p>
// //                   </div>
// //                   <div className="text-right">
// //                     <p className="text-[10px] text-slate-500">Stock</p>
// //                     <p className="text-sm font-bold text-white">
// //                       {stock.toLocaleString()}
// //                     </p>
// //                     {stock <= reorderPoint(product) && (
// //                       <p className="text-[10px] font-semibold text-amber-300 mt-0.5">
// //                         Reorder {suggestedReorder(product)} · min{" "}
// //                         {reorderPoint(product)}
// //                       </p>
// //                     )}
// //                   </div>
// //                 </div>

// //                 {canCreateRequests &&
// //                   storeId &&
// //                   stock <= reorderPoint(product) && (
// //                     <button
// //                       type="button"
// //                       disabled={!!existingRequest}
// //                       onClick={(event) => {
// //                         event.stopPropagation();
// //                         setRequestTarget(product);
// //                         setRequestQuantity(String(suggestedReorder(product)));
// //                       }}
// //                       className="mt-1 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
// //                     >
// //                       {existingRequest
// //                         ? `Request ${existingRequest.status.toLowerCase()}`
// //                         : "Request stock"}
// //                     </button>
// //                   )}
// //               </div>
// //             );
// //           })
// //         )}
// //       </div>

// //       {/* Pagination */}
// //       {totalItems > 0 && (
// //         <div className="mt-4 flex flex-col items-center justify-between gap-3 px-2 md:flex-row md:gap-4">
// //           <p className="text-center text-xs text-slate-400 md:text-left">
// //             Showing{" "}
// //             <strong className="text-white">{startItem.toLocaleString()}</strong>{" "}
// //             to{" "}
// //             <strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
// //             of{" "}
// //             <strong className="text-white">
// //               {totalItems.toLocaleString()}
// //             </strong>{" "}
// //             items
// //           </p>

// //           {pageSize > 0 && totalPages > 1 && (
// //             <div className="flex items-center gap-1.5">
// //               <PageButton
// //                 onClick={() => setCurrentPage(1)}
// //                 disabled={activePage <= 1}
// //                 label="First page"
// //               >
// //                 <ChevronsLeft className="h-3.5 w-3.5" />
// //               </PageButton>
// //               <PageButton
// //                 onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
// //                 disabled={activePage <= 1}
// //                 label="Previous page"
// //                 wide
// //               >
// //                 <ChevronLeft className="h-3.5 w-3.5" /> Prev
// //               </PageButton>

// //               <span className="px-2 text-xs text-slate-400">
// //                 Page <strong className="text-white">{activePage}</strong> of{" "}
// //                 {totalPages}
// //               </span>

// //               <PageButton
// //                 onClick={() =>
// //                   setCurrentPage((page) => Math.min(totalPages, page + 1))
// //                 }
// //                 disabled={activePage >= totalPages}
// //                 label="Next page"
// //                 wide
// //               >
// //                 Next <ChevronRight className="h-3.5 w-3.5" />
// //               </PageButton>
// //               <PageButton
// //                 onClick={() => setCurrentPage(totalPages)}
// //                 disabled={activePage >= totalPages}
// //                 label="Last page"
// //               >
// //                 <ChevronsRight className="h-3.5 w-3.5" />
// //               </PageButton>
// //             </div>
// //           )}
// //         </div>
// //       )}

// //       {/* ======================= DRAWER ======================= */}
// //       {selected && (
// //         <ProductDrawer
// //           product={selected}
// //           onClose={() => setSelected(null)}
// //           canManage={canManageStock}
// //           onAdjust={(p) => {
// //             setAdjustTarget(p);
// //             setSelected(null);
// //           }}
// //           onTransfer={(p) => {
// //             setTransferTarget(p);
// //             setSelected(null);
// //           }}
// //           onRequest={(p) => {
// //             setRequestTarget(p);
// //             setRequestQuantity(String(suggestedReorder(p)));
// //             setSelected(null);
// //           }}
// //         />
// //       )}

// //       {/* ======================= STOCK REQUEST MODAL ======================= */}
// //       {requestTarget && (
// //         <div
// //           className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
// //           onMouseDown={(event) => {
// //             if (event.target === event.currentTarget) setRequestTarget(null);
// //           }}
// //         >
// //           <form
// //             className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
// //             onSubmit={async (event) => {
// //               event.preventDefault();
// //               const quantity = Number(requestQuantity);
// //               if (
// //                 !storeId ||
// //                 !requestTarget.productId ||
// //                 !requestTarget.variantId ||
// //                 !Number.isInteger(quantity) ||
// //                 quantity < 1
// //               )
// //                 return;
// //               try {
// //                 const result = await createStockRequest({
// //                   storeId,
// //                   productId: requestTarget.productId,
// //                   variantId: requestTarget.variantId,
// //                   quantity,
// //                   reason: requestReason,
// //                 }).unwrap();
// //                 setRequestTarget(null);
// //                 setRequestReason("");
// //                 if (result?.duplicate)
// //                   window.alert(
// //                     "A request for this variant is already open. You can track it under Stock requests.",
// //                   );
// //                 onRequestSubmitted?.();
// //               } catch (error: any) {
// //                 window.alert(
// //                   error?.data?.message || "Could not submit stock request.",
// //                 );
// //               }
// //             }}
// //           >
// //             <h3 className="text-lg font-bold text-white">Request stock</h3>
// //             <p className="mt-1 text-sm text-slate-400">
// //               {requestTarget.name} · Current stock {num(requestTarget.stock)}
// //             </p>
// //             <label className="mt-4 block text-xs font-semibold text-slate-300">
// //               Quantity needed
// //               <input
// //                 autoFocus
// //                 min="1"
// //                 step="1"
// //                 type="number"
// //                 value={requestQuantity}
// //                 onChange={(event) => setRequestQuantity(event.target.value)}
// //                 className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //               />
// //             </label>
// //             <label className="mt-3 block text-xs font-semibold text-slate-300">
// //               Note (optional)
// //               <textarea
// //                 value={requestReason}
// //                 onChange={(event) => setRequestReason(event.target.value)}
// //                 maxLength={500}
// //                 rows={3}
// //                 placeholder="Low stock, customer demand…"
// //                 className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //               />
// //             </label>
// //             <div className="mt-4 flex justify-end gap-2">
// //               <button
// //                 type="button"
// //                 onClick={() => setRequestTarget(null)}
// //                 className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 disabled={isRequesting}
// //                 className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
// //               >
// //                 {isRequesting ? "Sending…" : "Send request"}
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       )}

// //       {/* ======================= ADJUST MODAL ======================= */}
// //       {adjustTarget && (
// //         <AdjustStockModal
// //           product={adjustTarget}
// //           onClose={() => setAdjustTarget(null)}
// //           onSubmit={async (payload) => {
// //             try {
// //               if (onAdjustStock) {
// //                 await onAdjustStock(payload);
// //               } else {
// //                 // Fallback: log only (wire to your API)
// //                 console.log("Stock adjustment:", payload);
// //               }
// //               setAdjustTarget(null);
// //             } catch (error: any) {
// //               window.alert(error?.data?.message || "Could not adjust stock.");
// //             }
// //           }}
// //         />
// //       )}

// //       {/* ======================= TRANSFER MODAL ======================= */}
// //       {transferTarget && (
// //         <TransferStockModal
// //           product={transferTarget}
// //           stores={stores}
// //           fromStoreId={storeId}
// //           onClose={() => setTransferTarget(null)}
// //           onSubmit={async (payload) => {
// //             try {
// //               if (onTransferStock) {
// //                 await onTransferStock(payload);
// //               } else {
// //                 console.log("Stock transfer:", payload);
// //               }
// //               setTransferTarget(null);
// //             } catch (error: any) {
// //               window.alert(error?.data?.message || "Could not transfer stock.");
// //             }
// //           }}
// //         />
// //       )}
// //     </main>
// //   );
// // }

// // /* ------------------------------------------------------------------ */
// // /*  Sub-components                                                     */
// // /* ------------------------------------------------------------------ */

// // const TONES: Record<string, string> = {
// //   sky: "border-sky-500/20 bg-sky-500/5 text-sky-300",
// //   emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
// //   amber: "border-amber-500/20 bg-amber-500/5 text-amber-300",
// //   rose: "border-rose-500/20 bg-rose-500/5 text-rose-300",
// //   slate: "border-slate-800 bg-slate-900 text-slate-300",
// // };

// // function StatCard({
// //   icon: Icon,
// //   label,
// //   value,
// //   note,
// //   tone,
// // }: {
// //   icon: typeof Package;
// //   label: string;
// //   value: string;
// //   note: string;
// //   tone: keyof typeof TONES;
// // }) {
// //   return (
// //     <article className={`rounded-2xl border p-3 md:p-4 ${TONES[tone]}`}>
// //       <div className="flex items-center gap-2">
// //         <Icon className="h-4 w-4 shrink-0" />
// //         <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider opacity-80 truncate">
// //           {label}
// //         </p>
// //       </div>
// //       <p className="mt-2 truncate text-lg md:text-xl font-black text-white">
// //         {value}
// //       </p>
// //       <p className="mt-1 truncate text-[10px] md:text-[11px] text-slate-400">
// //         {note}
// //       </p>
// //     </article>
// //   );
// // }

// // function SortableHeader({
// //   label,
// //   sortKey,
// //   activeKey,
// //   dir,
// //   onSort,
// //   align = "left",
// // }: {
// //   label: string;
// //   sortKey: SortKey;
// //   activeKey: SortKey;
// //   dir: SortDir;
// //   onSort: (key: SortKey) => void;
// //   align?: "left" | "right";
// // }) {
// //   const active = activeKey === sortKey;
// //   const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;

// //   return (
// //     <th
// //       className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wider ${
// //         align === "right" ? "text-right" : "text-left"
// //       }`}
// //     >
// //       <button
// //         type="button"
// //         onClick={() => onSort(sortKey)}
// //         aria-sort={
// //           active ? (dir === "asc" ? "ascending" : "descending") : "none"
// //         }
// //         className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-200 ${
// //           active ? "text-sky-400" : "text-slate-400"
// //         }`}
// //       >
// //         {label}
// //         <Icon className="h-3 w-3" />
// //       </button>
// //     </th>
// //   );
// // }

// // function PageButton({
// //   children,
// //   onClick,
// //   disabled,
// //   label,
// //   wide,
// // }: {
// //   children: React.ReactNode;
// //   onClick: () => void;
// //   disabled: boolean;
// //   label: string;
// //   wide?: boolean;
// // }) {
// //   return (
// //     <button
// //       type="button"
// //       onClick={onClick}
// //       disabled={disabled}
// //       aria-label={label}
// //       className={`flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40 ${
// //         wide ? "px-3" : "px-2"
// //       }`}
// //     >
// //       {children}
// //     </button>
// //   );
// // }

// // /* ------------------------------------------------------------------ */
// // /*  Drawer with tabs + actions                                         */
// // /* ------------------------------------------------------------------ */

// // function ProductDrawer({
// //   product,
// //   onClose,
// //   canManage = false,
// //   onAdjust,
// //   onTransfer,
// //   onRequest,
// // }: {
// //   product: Product;
// //   onClose: () => void;
// //   canManage?: boolean;
// //   onAdjust?: (p: Product) => void;
// //   onTransfer?: (p: Product) => void;
// //   onRequest?: (p: Product) => void;
// // }) {
// //   const [tab, setTab] = useState<DrawerTab>("overview");
// //   const stock = num(product.stock);
// //   const tone = TONE_META[getTone(stock)];
// //   const subtitle = productSubtitle(product);
// //   const summary = getExpirySummary(product);

// //   const rows: [string, string][] = [
// //     ["SKU", product.sku || "—"],
// //     ["Barcode", product.barcode || "—"],
// //     ["Category", product.category || "Uncategorised"],
// //     ["Unit price", `${num(product.price).toLocaleString()} MMK`],
// //     ["On hand", `${stock.toLocaleString()} units`],
// //     ["Reorder point", `${reorderPoint(product)} units`],
// //     ["Suggested reorder", `${suggestedReorder(product)} units`],
// //     ["Stock value", `${(stock * num(product.price)).toLocaleString()} MMK`],
// //   ];

// //   return (
// //     <div
// //       className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm"
// //       onClick={onClose}
// //       role="presentation"
// //     >
// //       <aside
// //         role="dialog"
// //         aria-modal="true"
// //         aria-label={`Details for ${product.name}`}
// //         onClick={(event) => event.stopPropagation()}
// //         className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-slate-800 bg-slate-900 shadow-2xl"
// //       >
// //         {/* Header */}
// //         <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4 md:p-6">
// //           <div className="min-w-0">
// //             <h3 className="text-lg font-black text-white">{product.name}</h3>
// //             {subtitle && (
// //               <p className="mt-1 text-xs font-medium text-emerald-400/90">
// //                 {subtitle}
// //               </p>
// //             )}
// //             <div className="mt-2 flex flex-wrap gap-1.5">
// //               <span
// //                 className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tone.className}`}
// //               >
// //                 {tone.label}
// //               </span>
// //               {summary.expiredCount > 0 && (
// //                 <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
// //                   {summary.expiredCount} expired
// //                 </span>
// //               )}
// //               {summary.criticalCount + summary.soonCount > 0 && (
// //                 <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
// //                   {summary.criticalCount + summary.soonCount} expiring soon
// //                 </span>
// //               )}
// //             </div>
// //           </div>
// //           <button
// //             type="button"
// //             onClick={onClose}
// //             aria-label="Close details"
// //             className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
// //           >
// //             <X className="h-4 w-4" />
// //           </button>
// //         </div>

// //         {/* Quick actions */}
// //         {canManage && (
// //           <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/50 p-3">
// //             <button
// //               type="button"
// //               onClick={() => onAdjust?.(product)}
// //               className="flex flex-col items-center gap-1 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2 py-2.5 text-[10px] font-bold text-sky-200 transition hover:bg-sky-500/20"
// //             >
// //               <Package className="h-4 w-4" />
// //               Adjust
// //             </button>
// //             <button
// //               type="button"
// //               onClick={() => onTransfer?.(product)}
// //               className="flex flex-col items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2 py-2.5 text-[10px] font-bold text-violet-200 transition hover:bg-violet-500/20"
// //             >
// //               <Truck className="h-4 w-4" />
// //               Transfer
// //             </button>
// //             <button
// //               type="button"
// //               onClick={() => onRequest?.(product)}
// //               className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2.5 text-[10px] font-bold text-amber-200 transition hover:bg-amber-500/20"
// //             >
// //               <Send className="h-4 w-4" />
// //               Request
// //             </button>
// //           </div>
// //         )}

// //         {/* Tabs */}
// //         <div className="flex gap-1 border-b border-slate-800 px-3">
// //           {(
// //             [
// //               { id: "overview", label: "Overview" },
// //               { id: "batches", label: `Batches (${summary.lots.length})` },
// //               { id: "history", label: "History" },
// //             ] as const
// //           ).map((t) => (
// //             <button
// //               key={t.id}
// //               type="button"
// //               onClick={() => setTab(t.id)}
// //               className={`relative px-3 py-3 text-xs font-bold transition ${
// //                 tab === t.id
// //                   ? "text-sky-300"
// //                   : "text-slate-400 hover:text-slate-200"
// //               }`}
// //             >
// //               {t.label}
// //               {tab === t.id && (
// //                 <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" />
// //               )}
// //             </button>
// //           ))}
// //         </div>

// //         {/* Body */}
// //         <div className="flex-1 overflow-y-auto p-4 md:p-6">
// //           {tab === "overview" && (
// //             <>
// //               <dl className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
// //                 {rows.map(([label, value]) => (
// //                   <div
// //                     key={label}
// //                     className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
// //                   >
// //                     <dt className="text-slate-400">{label}</dt>
// //                     <dd className="truncate font-semibold text-slate-100">
// //                       {value}
// //                     </dd>
// //                   </div>
// //                 ))}
// //               </dl>

// //               {product.variants && product.variants.length > 0 && (
// //                 <section className="mt-5">
// //                   <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
// //                     Variants ({product.variants.length})
// //                   </h4>
// //                   <ul className="flex flex-wrap gap-2">
// //                     {product.variants.map((v) => (
// //                       <li
// //                         key={v.id}
// //                         className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[11px] font-semibold text-slate-300"
// //                       >
// //                         {v.name}
// //                       </li>
// //                     ))}
// //                   </ul>
// //                 </section>
// //               )}
// //             </>
// //           )}

// //           {tab === "batches" && (
// //             <>
// //               {summary.lots.length === 0 ? (
// //                 <p className="p-6 text-center text-sm text-slate-500">
// //                   No batch/lot records for this product.
// //                 </p>
// //               ) : (
// //                 <ul className="space-y-2">
// //                   {summary.lots.map((lot) => {
// //                     const tier = getExpiryTier(lot.days);
// //                     const meta = EXPIRY_TIER_META[tier];
// //                     return (
// //                       <li
// //                         key={lot.key}
// //                         className={`rounded-xl border p-3 ${meta.border}`}
// //                       >
// //                         <div className="flex items-start justify-between gap-3">
// //                           <div className="min-w-0">
// //                             <p className="truncate font-semibold text-slate-100">
// //                               Lot {lot.number}
// //                             </p>
// //                             <p className="mt-0.5 text-[11px] text-slate-400">
// //                               {lot.expiryDate
// //                                 ? lot.days < 0
// //                                   ? `Expired ${Math.abs(lot.days)} day(s) ago`
// //                                   : `Expires ${new Date(
// //                                       lot.expiryDate,
// //                                     ).toLocaleDateString()} · ${lot.days}d left`
// //                                 : "No expiry recorded"}
// //                             </p>
// //                           </div>
// //                           <div className="flex flex-col items-end gap-1.5">
// //                             <span className="font-bold tabular-nums text-white">
// //                               {lot.quantity.toLocaleString()}
// //                             </span>
// //                             <span
// //                               className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.chip}`}
// //                             >
// //                               {meta.label}
// //                             </span>
// //                           </div>
// //                         </div>

// //                         {canManage && tier !== "ok" && tier !== "none" && (
// //                           <div className="mt-2 flex gap-1.5 border-t border-white/5 pt-2">
// //                             <button
// //                               type="button"
// //                               className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20"
// //                             >
// //                               Dispose
// //                             </button>
// //                             <button
// //                               type="button"
// //                               className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"
// //                             >
// //                               Return
// //                             </button>
// //                             <button
// //                               type="button"
// //                               className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-800"
// //                             >
// //                               Quarantine
// //                             </button>
// //                           </div>
// //                         )}
// //                       </li>
// //                     );
// //                   })}
// //                 </ul>
// //               )}
// //             </>
// //           )}

// //           {tab === "history" && (
// //             <div className="space-y-3">
// //               <p className="text-xs text-slate-500">
// //                 Movement log — latest stock changes for this product.
// //               </p>
// //               <ul className="space-y-1.5">
// //                 {[
// //                   {
// //                     type: "IN",
// //                     qty: 50,
// //                     note: "Purchase order #PO-1024",
// //                     when: "2d ago",
// //                   },
// //                   { type: "OUT", qty: -12, note: "Sale", when: "1d ago" },
// //                   {
// //                     type: "ADJUST",
// //                     qty: -3,
// //                     note: "Damaged",
// //                     when: "8h ago",
// //                   },
// //                   {
// //                     type: "TRANSFER",
// //                     qty: -20,
// //                     note: "To Branch B",
// //                     when: "3h ago",
// //                   },
// //                 ].map((h, i) => (
// //                   <li
// //                     key={i}
// //                     className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs"
// //                   >
// //                     <div className="flex items-center gap-2">
// //                       <span
// //                         className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
// //                           h.type === "IN"
// //                             ? "bg-emerald-500/20 text-emerald-300"
// //                             : h.type === "OUT"
// //                               ? "bg-sky-500/20 text-sky-300"
// //                               : h.type === "ADJUST"
// //                                 ? "bg-amber-500/20 text-amber-300"
// //                                 : "bg-violet-500/20 text-violet-300"
// //                         }`}
// //                       >
// //                         {h.type}
// //                       </span>
// //                       <div>
// //                         <p className="text-slate-200">{h.note}</p>
// //                         <p className="text-[10px] text-slate-500">{h.when}</p>
// //                       </div>
// //                     </div>
// //                     <span
// //                       className={`font-mono text-xs font-bold ${
// //                         h.qty > 0 ? "text-emerald-300" : "text-rose-300"
// //                       }`}
// //                     >
// //                       {h.qty > 0 ? "+" : ""}
// //                       {h.qty}
// //                     </span>
// //                   </li>
// //                 ))}
// //               </ul>
// //             </div>
// //           )}
// //         </div>
// //       </aside>
// //     </div>
// //   );
// // }

// // /* ------------------------------------------------------------------ */
// // /*  Adjust Stock Modal                                                 */
// // /* ------------------------------------------------------------------ */

// // const ADJUST_REASONS = [
// //   { value: "damage", label: "Damaged / broken" },
// //   { value: "expired", label: "Expired / destroyed" },
// //   { value: "miscount", label: "Inventory miscount" },
// //   { value: "found", label: "Found / recovered" },
// //   { value: "theft", label: "Theft / loss" },
// //   { value: "sample", label: "Sample / giveaway" },
// //   { value: "other", label: "Other" },
// // ];

// // function AdjustStockModal({
// //   product,
// //   onClose,
// //   onSubmit,
// // }: {
// //   product: Product;
// //   onClose: () => void;
// //   onSubmit: (payload: AdjustPayload) => Promise<void>;
// // }) {
// //   const [direction, setDirection] = useState<"in" | "out">("in");
// //   const [quantity, setQuantity] = useState("1");
// //   const [reason, setReason] = useState("damage");
// //   const [notes, setNotes] = useState("");
// //   const [submitting, setSubmitting] = useState(false);

// //   const currentStock = num(product.stock);
// //   const delta = Number(quantity) || 0;
// //   const signedDelta = direction === "in" ? delta : -delta;
// //   const newStock = currentStock + signedDelta;

// //   const handleSubmit = async (event: React.FormEvent) => {
// //     event.preventDefault();
// //     if (!product.productId || !product.variantId) return;
// //     if (!Number.isInteger(delta) || delta < 1) return;
// //     setSubmitting(true);
// //     try {
// //       await onSubmit({
// //         productId: product.productId,
// //         variantId: product.variantId,
// //         quantity: signedDelta,
// //         reason,
// //         notes: notes.trim() || undefined,
// //       });
// //     } finally {
// //       setSubmitting(false);
// //     }
// //   };

// //   return (
// //     <div
// //       className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
// //       onMouseDown={(e) => {
// //         if (e.target === e.currentTarget) onClose();
// //       }}
// //     >
// //       <form
// //         onSubmit={handleSubmit}
// //         className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
// //       >
// //         <div className="flex items-start justify-between">
// //           <div>
// //             <h3 className="text-lg font-bold text-white">Adjust stock</h3>
// //             <p className="mt-1 text-sm text-slate-400">
// //               {product.name} · {currentStock} on hand
// //             </p>
// //           </div>
// //           <button
// //             type="button"
// //             onClick={onClose}
// //             className="rounded-lg p-1.5 text-slate-400 hover:text-white"
// //           >
// //             <X className="h-4 w-4" />
// //           </button>
// //         </div>

// //         {/* Direction toggle */}
// //         <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1">
// //           <button
// //             type="button"
// //             onClick={() => setDirection("in")}
// //             className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
// //               direction === "in"
// //                 ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
// //                 : "text-slate-400 hover:text-white"
// //             }`}
// //           >
// //             <Plus className="h-3.5 w-3.5" /> Increase
// //           </button>
// //           <button
// //             type="button"
// //             onClick={() => setDirection("out")}
// //             className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
// //               direction === "out"
// //                 ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
// //                 : "text-slate-400 hover:text-white"
// //             }`}
// //           >
// //             <Trash2 className="h-3.5 w-3.5" /> Decrease
// //           </button>
// //         </div>

// //         <label className="mt-4 block text-xs font-semibold text-slate-300">
// //           Quantity
// //           <input
// //             autoFocus
// //             min="1"
// //             step="1"
// //             type="number"
// //             value={quantity}
// //             onChange={(e) => setQuantity(e.target.value)}
// //             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //           />
// //         </label>

// //         <label className="mt-3 block text-xs font-semibold text-slate-300">
// //           Reason
// //           <select
// //             value={reason}
// //             onChange={(e) => setReason(e.target.value)}
// //             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //           >
// //             {ADJUST_REASONS.map((r) => (
// //               <option key={r.value} value={r.value}>
// //                 {r.label}
// //               </option>
// //             ))}
// //           </select>
// //         </label>

// //         <label className="mt-3 block text-xs font-semibold text-slate-300">
// //           Notes (optional)
// //           <textarea
// //             value={notes}
// //             onChange={(e) => setNotes(e.target.value)}
// //             maxLength={500}
// //             rows={2}
// //             className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //           />
// //         </label>

// //         <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
// //           <p className="text-[10px] font-bold uppercase text-slate-500">
// //             Preview
// //           </p>
// //           <p className="mt-1 text-sm text-slate-300">
// //             {currentStock} →{" "}
// //             <span
// //               className={`font-bold ${
// //                 newStock < 0
// //                   ? "text-rose-400"
// //                   : signedDelta >= 0
// //                     ? "text-emerald-300"
// //                     : "text-amber-300"
// //               }`}
// //             >
// //               {newStock}
// //             </span>{" "}
// //             <span className="text-xs text-slate-500">
// //               ({signedDelta >= 0 ? "+" : ""}
// //               {signedDelta})
// //             </span>
// //           </p>
// //         </div>

// //         <div className="mt-4 flex justify-end gap-2">
// //           <button
// //             type="button"
// //             onClick={onClose}
// //             className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
// //           >
// //             Cancel
// //           </button>
// //           <button
// //             type="submit"
// //             disabled={submitting || newStock < 0 || delta < 1}
// //             className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
// //           >
// //             {submitting ? "Saving…" : "Apply adjustment"}
// //           </button>
// //         </div>
// //       </form>
// //     </div>
// //   );
// // }

// // /* ------------------------------------------------------------------ */
// // /*  Transfer Stock Modal                                               */
// // /* ------------------------------------------------------------------ */

// // function TransferStockModal({
// //   product,
// //   stores,
// //   fromStoreId,
// //   onClose,
// //   onSubmit,
// // }: {
// //   product: Product;
// //   stores: StoreOption[];
// //   fromStoreId?: string;
// //   onClose: () => void;
// //   onSubmit: (payload: TransferPayload) => Promise<void>;
// // }) {
// //   const [toStoreId, setToStoreId] = useState("");
// //   const [quantity, setQuantity] = useState("1");
// //   const [notes, setNotes] = useState("");
// //   const [submitting, setSubmitting] = useState(false);

// //   const currentStock = num(product.stock);
// //   const delta = Number(quantity) || 0;
// //   const remaining = currentStock - delta;
// //   const destinations = stores.filter((s) => s.id !== fromStoreId);

// //   const handleSubmit = async (event: React.FormEvent) => {
// //     event.preventDefault();
// //     if (!product.productId || !product.variantId) return;
// //     if (!toStoreId || !fromStoreId) return;
// //     if (!Number.isInteger(delta) || delta < 1 || delta > currentStock) return;
// //     setSubmitting(true);
// //     try {
// //       await onSubmit({
// //         productId: product.productId,
// //         variantId: product.variantId,
// //         fromStoreId,
// //         toStoreId,
// //         quantity: delta,
// //         notes: notes.trim() || undefined,
// //       });
// //     } finally {
// //       setSubmitting(false);
// //     }
// //   };

// //   return (
// //     <div
// //       className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
// //       onMouseDown={(e) => {
// //         if (e.target === e.currentTarget) onClose();
// //       }}
// //     >
// //       <form
// //         onSubmit={handleSubmit}
// //         className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
// //       >
// //         <div className="flex items-start justify-between">
// //           <div>
// //             <h3 className="text-lg font-bold text-white">Transfer stock</h3>
// //             <p className="mt-1 text-sm text-slate-400">
// //               {product.name} · {currentStock} on hand
// //             </p>
// //           </div>
// //           <button
// //             type="button"
// //             onClick={onClose}
// //             className="rounded-lg p-1.5 text-slate-400 hover:text-white"
// //           >
// //             <X className="h-4 w-4" />
// //           </button>
// //         </div>

// //         <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
// //           <span className="rounded-md bg-slate-800 px-2 py-1 font-mono font-bold text-slate-300">
// //             FROM
// //           </span>
// //           <span className="text-slate-300">
// //             {stores.find((s) => s.id === fromStoreId)?.name ??
// //               fromStoreId ??
// //               "Current store"}
// //           </span>
// //         </div>

// //         <label className="mt-3 block text-xs font-semibold text-slate-300">
// //           Transfer to
// //           <select
// //             autoFocus
// //             value={toStoreId}
// //             onChange={(e) => setToStoreId(e.target.value)}
// //             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //           >
// //             <option value="">— Select destination —</option>
// //             {destinations.map((s) => (
// //               <option key={s.id} value={s.id}>
// //                 {s.name}
// //               </option>
// //             ))}
// //           </select>
// //         </label>

// //         <label className="mt-3 block text-xs font-semibold text-slate-300">
// //           Quantity
// //           <input
// //             min="1"
// //             max={currentStock}
// //             step="1"
// //             type="number"
// //             value={quantity}
// //             onChange={(e) => setQuantity(e.target.value)}
// //             className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //           />
// //         </label>

// //         <label className="mt-3 block text-xs font-semibold text-slate-300">
// //           Notes (optional)
// //           <textarea
// //             value={notes}
// //             onChange={(e) => setNotes(e.target.value)}
// //             maxLength={500}
// //             rows={2}
// //             className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //           />
// //         </label>

// //         <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
// //           <p className="text-[10px] font-bold uppercase text-slate-500">
// //             Preview
// //           </p>
// //           <p className="mt-1 text-sm text-slate-300">
// //             {currentStock} →{" "}
// //             <span
// //               className={`font-bold ${
// //                 remaining < 0 ? "text-rose-400" : "text-amber-300"
// //               }`}
// //             >
// //               {remaining}
// //             </span>{" "}
// //             <span className="text-xs text-slate-500">(-{delta})</span>
// //           </p>
// //         </div>

// //         <div className="mt-4 flex justify-end gap-2">
// //           <button
// //             type="button"
// //             onClick={onClose}
// //             className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
// //           >
// //             Cancel
// //           </button>
// //           <button
// //             type="submit"
// //             disabled={
// //               submitting ||
// //               !toStoreId ||
// //               !fromStoreId ||
// //               delta < 1 ||
// //               delta > currentStock
// //             }
// //             className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
// //           >
// //             {submitting ? "Transferring…" : "Confirm transfer"}
// //           </button>
// //         </div>
// //       </form>
// //     </div>
// //   );
// // }

// // // import {
// // //   AlertTriangle,
// // //   ArrowDown,
// // //   ArrowUp,
// // //   ArrowUpDown,
// // //   CalendarClock,
// // //   ChevronLeft,
// // //   ChevronRight,
// // //   ChevronsLeft,
// // //   ChevronsRight,
// // //   Download,
// // //   Keyboard,
// // //   Package,
// // //   RotateCcw,
// // //   Search,
// // //   TrendingDown,
// // //   Wallet,
// // //   X,
// // // } from "lucide-react";
// // // import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// // // import { Product } from "../types";
// // // import {
// // //   useCreateStockRequestMutation,
// // //   useGetStockRequestsQuery,
// // // } from "../store/apiSlice";

// // // /* ------------------------------------------------------------------ */
// // // /*  Config                                                             */
// // // /* ------------------------------------------------------------------ */

// // // const LOW_THRESHOLD = 20;
// // // const CRITICAL_THRESHOLD = 5;
// // // const EXPIRY_SOON_DAYS = 90;

// // // type SortKey = "name" | "sku" | "category" | "price" | "stock";
// // // type SortDir = "asc" | "desc";
// // // type StockFilter =
// // //   | "all"
// // //   | "in"
// // //   | "low"
// // //   | "critical"
// // //   | "out"
// // //   | "expiring"
// // //   | "reorder";

// // // /* ------------------------------------------------------------------ */
// // // /*  Helpers                                                            */
// // // /* ------------------------------------------------------------------ */

// // // const num = (value: unknown) => Number(value) || 0;

// // // const daysUntil = (date?: string) => {
// // //   if (!date) return Infinity;
// // //   const time = new Date(date).getTime();
// // //   if (Number.isNaN(time)) return Infinity;
// // //   return Math.ceil((time - Date.now()) / 86_400_000);
// // // };

// // // type Tone = "in" | "low" | "critical" | "out";

// // // const getTone = (stock: number): Tone => {
// // //   if (stock <= 0) return "out";
// // //   if (stock <= CRITICAL_THRESHOLD) return "critical";
// // //   if (stock <= LOW_THRESHOLD) return "low";
// // //   return "in";
// // // };

// // // const TONE_META: Record<Tone, { label: string; className: string }> = {
// // //   in: {
// // //     label: "In Stock",
// // //     className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
// // //   },
// // //   low: {
// // //     label: "Low",
// // //     className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
// // //   },
// // //   critical: {
// // //     label: "Critical",
// // //     className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
// // //   },
// // //   out: {
// // //     label: "Out of Stock",
// // //     className: "bg-slate-600/20 text-slate-400 border-slate-600/40",
// // //   },
// // // };

// // // const getLots = (product: Product) =>
// // //   (product.inventories ?? [])
// // //     .filter((inventory) => inventory.lot)
// // //     .map((inventory, index) => ({
// // //       key: `${inventory.lot?.number ?? "lot"}-${index}`,
// // //       number: inventory.lot?.number ?? "—",
// // //       expiryDate: inventory.lot?.expiryDate,
// // //       quantity: num(inventory.quantity),
// // //       days: daysUntil(inventory.lot?.expiryDate ?? undefined),
// // //     }));

// // // const hasExpiryRisk = (product: Product) =>
// // //   getLots(product).some((lot) => lot.days <= EXPIRY_SOON_DAYS);

// // // const reorderPoint = (product: Product) => {
// // //   const values = (product.inventories ?? [])
// // //     .map((row) => num(row.reorderPoint))
// // //     .filter((value) => value > 0);
// // //   return values.length ? Math.max(...values) : 10;
// // // };

// // // const suggestedReorder = (product: Product) => {
// // //   const quantities = (product.inventories ?? []).map((row) =>
// // //     num(row.reorderQty),
// // //   );
// // //   const reorderQty = quantities.length ? Math.max(...quantities) : 0;
// // //   return Math.max(reorderQty, reorderPoint(product) - num(product.stock));
// // // };

// // // const productSubtitle = (product: Product) =>
// // //   [
// // //     product.genericName,
// // //     product.activeIngredient,
// // //     product.strength,
// // //     product.dosageForm,
// // //   ]
// // //     .filter(Boolean)
// // //     .join(" · ");

// // // const csvCell = (value: unknown) =>
// // //   `"${String(value ?? "").replace(/"/g, '""')}"`;

// // // /* ------------------------------------------------------------------ */
// // // /*  Component                                                          */
// // // /* ------------------------------------------------------------------ */

// // // interface InventoryViewProps {
// // //   products: Product[];
// // //   storeId?: string;
// // //   userRole?: string;
// // //   isLoading?: boolean;
// // //   onRequestSubmitted?: () => void;
// // // }

// // // export function InventoryView({
// // //   products,
// // //   storeId,
// // //   userRole = "CASHIER",
// // //   isLoading = false,
// // //   onRequestSubmitted,
// // // }: InventoryViewProps) {
// // //   const [query, setQuery] = useState("");
// // //   const [stockFilter, setStockFilter] = useState<StockFilter>("all");
// // //   const [sortKey, setSortKey] = useState<SortKey>("name");
// // //   const [sortDir, setSortDir] = useState<SortDir>("asc");
// // //   const [pageSize, setPageSize] = useState<number>(100);
// // //   const [currentPage, setCurrentPage] = useState<number>(1);
// // //   const [selected, setSelected] = useState<Product | null>(null);
// // //   const [requestTarget, setRequestTarget] = useState<Product | null>(null);
// // //   const [requestQuantity, setRequestQuantity] = useState("1");
// // //   const [requestReason, setRequestReason] = useState("");

// // //   const requestQueryStoreId = ["ADMIN", "SUPER_ADMIN"].includes(userRole)
// // //     ? undefined
// // //     : storeId;

// // //   const { data: stockRequests = [] } = useGetStockRequestsQuery(
// // //     { storeId: requestQueryStoreId },
// // //     {
// // //       pollingInterval: 15000,
// // //       skip: !storeId && !["ADMIN", "SUPER_ADMIN"].includes(userRole),
// // //     },
// // //   );

// // //   const [createStockRequest, { isLoading: isRequesting }] =
// // //     useCreateStockRequestMutation();

// // //   const canCreateRequests = ["CASHIER", "MANAGER"].includes(userRole);
// // //   const searchRef = useRef<HTMLInputElement>(null);

// // //   /* ------------------------- filtering ------------------------- */

// // //   const searchFiltered = useMemo(() => {
// // //     const normalized = query.trim().toLowerCase();
// // //     if (!normalized) return products;
// // //     return products.filter((product) =>
// // //       [product.name, product.sku, product.barcode, product.category]
// // //         .map((value) => (value || "").toString().toLowerCase())
// // //         .some((value) => value.includes(normalized)),
// // //     );
// // //   }, [products, query]);

// // //   const filteredProducts = useMemo(() => {
// // //     if (stockFilter === "all") return searchFiltered;
// // //     if (stockFilter === "expiring") return searchFiltered.filter(hasExpiryRisk);
// // //     if (stockFilter === "reorder")
// // //       return searchFiltered.filter(
// // //         (product) => num(product.stock) <= reorderPoint(product),
// // //       );
// // //     return searchFiltered.filter(
// // //       (product) => getTone(num(product.stock)) === stockFilter,
// // //     );
// // //   }, [searchFiltered, stockFilter]);

// // //   /* -------------------------- sorting -------------------------- */

// // //   const sortedProducts = useMemo(() => {
// // //     const copy = [...filteredProducts];
// // //     copy.sort((a, b) => {
// // //       let cmp = 0;
// // //       if (sortKey === "price") cmp = num(a.price) - num(b.price);
// // //       else if (sortKey === "stock") cmp = num(a.stock) - num(b.stock);
// // //       else
// // //         cmp = String(a[sortKey] ?? "").localeCompare(
// // //           String(b[sortKey] ?? ""),
// // //           undefined,
// // //           { numeric: true, sensitivity: "base" },
// // //         );
// // //       return sortDir === "asc" ? cmp : -cmp;
// // //     });
// // //     return copy;
// // //   }, [filteredProducts, sortKey, sortDir]);

// // //   /* ------------------------ pagination ------------------------- */

// // //   const totalItems = sortedProducts.length;
// // //   const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
// // //   const activePage = Math.min(currentPage, totalPages);

// // //   const paginatedProducts = useMemo(() => {
// // //     if (pageSize <= 0) return sortedProducts;
// // //     const start = (activePage - 1) * pageSize;
// // //     return sortedProducts.slice(start, start + pageSize);
// // //   }, [sortedProducts, activePage, pageSize]);

// // //   const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
// // //   const endItem =
// // //     pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

// // //   /* --------------------------- stats --------------------------- */

// // //   const stats = useMemo(() => {
// // //     const result = {
// // //       total: searchFiltered.length,
// // //       in: 0,
// // //       low: 0,
// // //       critical: 0,
// // //       out: 0,
// // //       expiring: 0,
// // //       reorder: 0,
// // //       stockValue: 0,
// // //       units: 0,
// // //     };
// // //     for (const product of searchFiltered) {
// // //       const stock = num(product.stock);
// // //       result[getTone(stock)] += 1;
// // //       result.units += stock;
// // //       result.stockValue += stock * num(product.price);
// // //       if (hasExpiryRisk(product)) result.expiring += 1;
// // //       if (stock <= reorderPoint(product)) result.reorder += 1;
// // //     }
// // //     return result;
// // //   }, [searchFiltered]);

// // //   const chips: { id: StockFilter; label: string; count: number }[] = [
// // //     { id: "all", label: "All", count: stats.total },
// // //     { id: "in", label: "In stock", count: stats.in },
// // //     { id: "low", label: "Low", count: stats.low },
// // //     { id: "critical", label: "Critical", count: stats.critical },
// // //     { id: "out", label: "Out of stock", count: stats.out },
// // //     {
// // //       id: "expiring",
// // //       label: `Expiring ≤${EXPIRY_SOON_DAYS}d`,
// // //       count: stats.expiring,
// // //     },
// // //     { id: "reorder", label: "Reorder", count: stats.reorder },
// // //   ];

// // //   const filtersActive = query !== "" || stockFilter !== "all";

// // //   /* -------------------------- handlers ------------------------- */

// // //   const resetPage = useCallback(() => setCurrentPage(1), []);

// // //   const handleSort = (key: SortKey) => {
// // //     if (key === sortKey) {
// // //       setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
// // //     } else {
// // //       setSortKey(key);
// // //       setSortDir(key === "price" || key === "stock" ? "desc" : "asc");
// // //     }
// // //     resetPage();
// // //   };

// // //   const resetFilters = () => {
// // //     setQuery("");
// // //     setStockFilter("all");
// // //     setSortKey("name");
// // //     setSortDir("asc");
// // //     resetPage();
// // //   };

// // //   const exportCsv = () => {
// // //     const headers = [
// // //       "Name",
// // //       "SKU",
// // //       "Barcode",
// // //       "Category",
// // //       "Price (MMK)",
// // //       "Stock",
// // //       "Status",
// // //       "Expiring soon",
// // //     ];
// // //     const rows = sortedProducts.map((product) => {
// // //       const stock = num(product.stock);
// // //       const tone = getTone(stock);
// // //       return [
// // //         product.name,
// // //         product.sku,
// // //         product.barcode ?? "",
// // //         product.category ?? "",
// // //         num(product.price),
// // //         stock,
// // //         TONE_META[tone].label,
// // //         hasExpiryRisk(product) ? "Yes" : "No",
// // //       ];
// // //     });
// // //     const csv = [headers, ...rows]
// // //       .map((row) => row.map(csvCell).join(","))
// // //       .join("\r\n");

// // //     const blob = new Blob(["\uFEFF" + csv], {
// // //       type: "text/csv;charset=utf-8;",
// // //     });
// // //     const url = URL.createObjectURL(blob);
// // //     const link = document.createElement("a");
// // //     link.href = url;
// // //     link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
// // //     document.body.appendChild(link);
// // //     link.click();
// // //     document.body.removeChild(link);
// // //     URL.revokeObjectURL(url);
// // //   };

// // //   /* ---------------------- keyboard shortcuts ------------------- */

// // //   useEffect(() => {
// // //     const handleKey = (event: KeyboardEvent) => {
// // //       const target = event.target as HTMLElement | null;
// // //       const typing =
// // //         target &&
// // //         (target.tagName === "INPUT" ||
// // //           target.tagName === "TEXTAREA" ||
// // //           target.tagName === "SELECT" ||
// // //           target.isContentEditable);

// // //       if (
// // //         !typing &&
// // //         (event.key === "/" ||
// // //           ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"))
// // //       ) {
// // //         event.preventDefault();
// // //         searchRef.current?.focus();
// // //         searchRef.current?.select();
// // //       }
// // //       if (event.key === "Escape") {
// // //         setSelected(null);
// // //         if (document.activeElement === searchRef.current) {
// // //           searchRef.current?.blur();
// // //         }
// // //       }
// // //     };
// // //     window.addEventListener("keydown", handleKey);
// // //     return () => window.removeEventListener("keydown", handleKey);
// // //   }, []);

// // //   /* ---------------------------- render ------------------------- */

// // //   return (
// // //     // Mobile တွင် Padding လျှော့ချခြင်း
// // //     <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
// // //       {/* Header */}
// // //       <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
// // //         <div>
// // //           <h2 className="text-2xl font-black text-white md:text-3xl">
// // //             Products &amp; Stock
// // //           </h2>
// // //           <p className="mt-1 text-xs text-slate-400">
// // //             {products.length.toLocaleString()} products loaded from the selected
// // //             store
// // //             {filtersActive && (
// // //               <>
// // //                 {" · "}
// // //                 <span className="text-sky-400">
// // //                   {stats.total.toLocaleString()} matching filters
// // //                 </span>
// // //               </>
// // //             )}
// // //           </p>
// // //         </div>

// // //         <div className="flex items-center gap-2">
// // //           <span className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-500 lg:flex">
// // //             <Keyboard className="h-3.5 w-3.5" />
// // //             <kbd className="font-sans font-semibold text-slate-300">/</kbd>
// // //             or
// // //             <kbd className="font-sans font-semibold text-slate-300">⌘K</kbd>
// // //             to search
// // //           </span>
// // //           <button
// // //             type="button"
// // //             onClick={exportCsv}
// // //             disabled={sortedProducts.length === 0}
// // //             className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-40 md:w-auto"
// // //           >
// // //             <Download className="h-3.5 w-3.5" />
// // //             Export CSV
// // //           </button>
// // //         </div>
// // //       </div>

// // //       {/* KPI cards - Mobile တွင် 2 columns ခွဲပြသမည် */}
// // //       <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
// // //         <StatCard
// // //           icon={Package}
// // //           label="Products"
// // //           value={stats.total.toLocaleString()}
// // //           note={`${stats.units.toLocaleString()} units on hand`}
// // //           tone="sky"
// // //         />
// // //         <StatCard
// // //           icon={Wallet}
// // //           label="Stock value"
// // //           value={`${Math.round(stats.stockValue).toLocaleString()} MMK`}
// // //           note="Retail price × quantity"
// // //           tone="emerald"
// // //         />
// // //         <StatCard
// // //           icon={TrendingDown}
// // //           label="Needs attention"
// // //           value={(stats.low + stats.critical + stats.out).toLocaleString()}
// // //           note={`${stats.critical} critical · ${stats.out} out of stock`}
// // //           tone={stats.critical + stats.out > 0 ? "rose" : "amber"}
// // //         />
// // //         <StatCard
// // //           icon={CalendarClock}
// // //           label="Expiry risk"
// // //           value={stats.expiring.toLocaleString()}
// // //           note={`Lots expiring within ${EXPIRY_SOON_DAYS} days`}
// // //           tone={stats.expiring > 0 ? "amber" : "slate"}
// // //         />
// // //       </section>

// // //       {/* Search / filter bar - Mobile တွင် အောက်ခြေချင်း စုပုံပြသမည် */}
// // //       <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
// // //         <div className="relative w-full md:max-w-sm">
// // //           <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
// // //           <input
// // //             ref={searchRef}
// // //             type="text"
// // //             placeholder="Search by name, SKU, barcode…"
// // //             value={query}
// // //             onChange={(event) => {
// // //               setQuery(event.target.value);
// // //               resetPage();
// // //             }}
// // //             className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white placeholder-slate-500 transition-colors focus:border-sky-500 focus:outline-none"
// // //           />
// // //           {query && (
// // //             <button
// // //               type="button"
// // //               aria-label="Clear search"
// // //               onClick={() => {
// // //                 setQuery("");
// // //                 resetPage();
// // //                 searchRef.current?.focus();
// // //               }}
// // //               className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:text-white"
// // //             >
// // //               <X className="h-3.5 w-3.5" />
// // //             </button>
// // //           )}
// // //         </div>

// // //         <div className="flex items-center justify-between gap-3 md:ml-auto md:justify-end">
// // //           {filtersActive && (
// // //             <button
// // //               type="button"
// // //               onClick={resetFilters}
// // //               className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
// // //             >
// // //               <RotateCcw className="h-3.5 w-3.5" />
// // //               Reset
// // //             </button>
// // //           )}
// // //           <label className="flex items-center gap-2 text-xs text-slate-400">
// // //             Per page:
// // //             <select
// // //               value={pageSize}
// // //               onChange={(event) => {
// // //                 setPageSize(Number(event.target.value));
// // //                 resetPage();
// // //               }}
// // //               className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
// // //             >
// // //               <option value={50}>50</option>
// // //               <option value={100}>100</option>
// // //               <option value={250}>250</option>
// // //               <option value={500}>500</option>
// // //               <option value={0}>All ({totalItems})</option>
// // //             </select>
// // //           </label>
// // //         </div>
// // //       </div>

// // //       {/* Quick filter chips - Mobile တွင် ဘေးတိုက်ဆွဲကြည့်နိုင်ရန် overflow-x-auto သုံးထားသည် */}
// // //       <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-2 md:flex-wrap md:pb-0">
// // //         {chips.map((chip) => {
// // //           const active = stockFilter === chip.id;
// // //           return (
// // //             <button
// // //               key={chip.id}
// // //               type="button"
// // //               onClick={() => {
// // //                 setStockFilter(chip.id);
// // //                 resetPage();
// // //               }}
// // //               className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
// // //                 active
// // //                   ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
// // //                   : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
// // //               }`}
// // //             >
// // //               {chip.label}
// // //               <span
// // //                 className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
// // //                   active
// // //                     ? "bg-sky-500/25 text-sky-100"
// // //                     : "bg-slate-800 text-slate-400"
// // //                 }`}
// // //               >
// // //                 {chip.count.toLocaleString()}
// // //               </span>
// // //             </button>
// // //           );
// // //         })}
// // //       </div>

// // //       {/* ================= DESKTOP TABLE VIEW ================= */}
// // //       <div className="hidden md:block flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/70">
// // //         <table className="w-full text-sm">
// // //           <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
// // //             <tr className="border-b border-slate-800 text-left">
// // //               <SortableHeader
// // //                 label="Product"
// // //                 sortKey="name"
// // //                 activeKey={sortKey}
// // //                 dir={sortDir}
// // //                 onSort={handleSort}
// // //               />
// // //               <SortableHeader
// // //                 label="SKU"
// // //                 sortKey="sku"
// // //                 activeKey={sortKey}
// // //                 dir={sortDir}
// // //                 onSort={handleSort}
// // //               />
// // //               <SortableHeader
// // //                 label="Category"
// // //                 sortKey="category"
// // //                 activeKey={sortKey}
// // //                 dir={sortDir}
// // //                 onSort={handleSort}
// // //               />
// // //               <SortableHeader
// // //                 label="Price"
// // //                 sortKey="price"
// // //                 activeKey={sortKey}
// // //                 dir={sortDir}
// // //                 onSort={handleSort}
// // //                 align="right"
// // //               />
// // //               <SortableHeader
// // //                 label="Stock"
// // //                 sortKey="stock"
// // //                 activeKey={sortKey}
// // //                 dir={sortDir}
// // //                 onSort={handleSort}
// // //                 align="right"
// // //               />
// // //               <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
// // //                 Status
// // //               </th>
// // //             </tr>
// // //           </thead>
// // //           <tbody>
// // //             {paginatedProducts.map((product) => {
// // //               const stock = num(product.stock);
// // //               const tone = TONE_META[getTone(stock)];
// // //               const subtitle = productSubtitle(product);
// // //               const lots = getLots(product);
// // //               const expiring = hasExpiryRisk(product);

// // //               return (
// // //                 <tr
// // //                   key={product.id}
// // //                   onClick={() => setSelected(product)}
// // //                   className="cursor-pointer border-b border-slate-800/50 transition-colors last:border-0 hover:bg-slate-800/30"
// // //                 >
// // //                   <td className="px-5 py-3">
// // //                     <div className="flex items-start gap-2">
// // //                       {expiring && (
// // //                         <AlertTriangle
// // //                           className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
// // //                           aria-label="Expiry risk"
// // //                         />
// // //                       )}
// // //                       <div className="min-w-0">
// // //                         <span className="block font-semibold text-slate-100">
// // //                           {product.name}
// // //                         </span>
// // //                         {subtitle && (
// // //                           <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-400/90">
// // //                             {subtitle}
// // //                           </span>
// // //                         )}
// // //                       </div>
// // //                     </div>
// // //                   </td>

// // //                   <td className="px-5 py-3 font-mono text-xs text-slate-400">
// // //                     {product.sku}
// // //                   </td>

// // //                   <td className="px-5 py-3">
// // //                     <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
// // //                       {product.category || "Uncategorised"}
// // //                     </span>
// // //                   </td>

// // //                   <td className="px-5 py-3 text-right font-bold tabular-nums text-white">
// // //                     {num(product.price).toLocaleString()}{" "}
// // //                     <span className="text-xs font-normal text-slate-500">
// // //                       MMK
// // //                     </span>
// // //                   </td>

// // //                   <td className="px-5 py-3 text-right font-bold tabular-nums text-white">
// // //                     {stock.toLocaleString()}
// // //                     {stock <= reorderPoint(product) && (
// // //                       <div className="mt-1 text-[10px] font-semibold text-amber-300">
// // //                         Reorder {suggestedReorder(product)} · min{" "}
// // //                         {reorderPoint(product)}
// // //                       </div>
// // //                     )}
// // //                     {lots.length > 0 && (
// // //                       <div className="mt-1 space-y-1 text-[10px] font-medium text-slate-400">
// // //                         {lots.slice(0, 3).map((lot) => (
// // //                           <div key={lot.key} className="truncate">
// // //                             Lot {lot.number} · {lot.quantity}
// // //                             {lot.expiryDate && (
// // //                               <span
// // //                                 className={
// // //                                   lot.days < 0
// // //                                     ? " text-rose-400"
// // //                                     : lot.days <= EXPIRY_SOON_DAYS
// // //                                       ? " text-amber-400"
// // //                                       : ""
// // //                                 }
// // //                               >
// // //                                 {" · "}
// // //                                 {lot.days < 0 ? "Expired " : "Exp "}
// // //                                 {new Date(lot.expiryDate).toLocaleDateString()}
// // //                               </span>
// // //                             )}
// // //                           </div>
// // //                         ))}
// // //                         {lots.length > 3 && (
// // //                           <div className="text-slate-500">
// // //                             +{lots.length - 3} more lot
// // //                             {lots.length - 3 === 1 ? "" : "s"}
// // //                           </div>
// // //                         )}
// // //                       </div>
// // //                     )}
// // //                   </td>

// // //                   <td className="px-5 py-3 text-center">
// // //                     <span
// // //                       className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.className}`}
// // //                     >
// // //                       {tone.label}
// // //                     </span>
// // //                     {canCreateRequests &&
// // //                       storeId &&
// // //                       stock <= reorderPoint(product) &&
// // //                       (() => {
// // //                         const existingRequest = stockRequests.find(
// // //                           (request: any) =>
// // //                             request.storeId === storeId &&
// // //                             request.productId === product.productId &&
// // //                             request.variantId === product.variantId &&
// // //                             ["PENDING", "ACKNOWLEDGED"].includes(
// // //                               request.status,
// // //                             ),
// // //                         );
// // //                         return (
// // //                           <button
// // //                             type="button"
// // //                             disabled={!!existingRequest}
// // //                             onClick={(event) => {
// // //                               event.stopPropagation();
// // //                               setRequestTarget(product);
// // //                               setRequestQuantity(
// // //                                 String(suggestedReorder(product)),
// // //                               );
// // //                             }}
// // //                             className="mt-2 block w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
// // //                           >
// // //                             {existingRequest
// // //                               ? `Request ${existingRequest.status.toLowerCase()}`
// // //                               : "Request stock"}
// // //                           </button>
// // //                         );
// // //                       })()}
// // //                   </td>
// // //                 </tr>
// // //               );
// // //             })}

// // //             {paginatedProducts.length === 0 && (
// // //               <tr>
// // //                 <td
// // //                   colSpan={6}
// // //                   className="px-5 py-12 text-center text-sm text-slate-400"
// // //                 >
// // //                   {isLoading
// // //                     ? "Loading products…"
// // //                     : filtersActive
// // //                       ? "No products match the current filters."
// // //                       : "No products found in this store."}
// // //                 </td>
// // //               </tr>
// // //             )}
// // //           </tbody>
// // //         </table>
// // //       </div>

// // //       {/* ================= MOBILE CARD VIEW ================= */}
// // //       <div className="md:hidden space-y-3">
// // //         {isLoading ? (
// // //           <p className="p-10 text-center text-sm text-slate-400">
// // //             Loading products…
// // //           </p>
// // //         ) : paginatedProducts.length === 0 ? (
// // //           <p className="p-10 text-center text-sm text-slate-400">
// // //             {filtersActive
// // //               ? "No products match the current filters."
// // //               : "No products found in this store."}
// // //           </p>
// // //         ) : (
// // //           paginatedProducts.map((product) => {
// // //             const stock = num(product.stock);
// // //             const tone = TONE_META[getTone(stock)];
// // //             const subtitle = productSubtitle(product);
// // //             const expiring = hasExpiryRisk(product);

// // //             // Check for existing stock request for this product
// // //             const existingRequest =
// // //               canCreateRequests && storeId && stock <= reorderPoint(product)
// // //                 ? stockRequests.find(
// // //                     (request: any) =>
// // //                       request.storeId === storeId &&
// // //                       request.productId === product.productId &&
// // //                       request.variantId === product.variantId &&
// // //                       ["PENDING", "ACKNOWLEDGED"].includes(request.status),
// // //                   )
// // //                 : null;

// // //             return (
// // //               <div
// // //                 key={product.id}
// // //                 onClick={() => setSelected(product)}
// // //                 className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
// // //               >
// // //                 {/* Top Row: Product Name & Status */}
// // //                 <div className="flex items-start justify-between gap-3">
// // //                   <div className="min-w-0">
// // //                     <div className="flex items-center gap-1.5">
// // //                       {expiring && (
// // //                         <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
// // //                       )}
// // //                       <span className="font-semibold text-slate-100 truncate">
// // //                         {product.name}
// // //                       </span>
// // //                     </div>
// // //                     {subtitle && (
// // //                       <p className="mt-0.5 text-[11px] font-medium text-emerald-400/90 truncate">
// // //                         {subtitle}
// // //                       </p>
// // //                     )}
// // //                   </div>
// // //                   <span
// // //                     className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.className}`}
// // //                   >
// // //                     {tone.label}
// // //                   </span>
// // //                 </div>

// // //                 {/* Middle Row: SKU & Category */}
// // //                 <div className="flex items-center justify-between text-xs">
// // //                   <span className="font-mono text-slate-400">
// // //                     {product.sku}
// // //                   </span>
// // //                   <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
// // //                     {product.category || "Uncategorised"}
// // //                   </span>
// // //                 </div>

// // //                 {/* Bottom Row: Price & Stock */}
// // //                 <div className="flex items-end justify-between border-t border-slate-800/80 pt-3">
// // //                   <div>
// // //                     <p className="text-[10px] text-slate-500">Price</p>
// // //                     <p className="text-sm font-bold text-white">
// // //                       {num(product.price).toLocaleString()} MMK
// // //                     </p>
// // //                   </div>
// // //                   <div className="text-right">
// // //                     <p className="text-[10px] text-slate-500">Stock</p>
// // //                     <p className="text-sm font-bold text-white">
// // //                       {stock.toLocaleString()}
// // //                     </p>
// // //                     {stock <= reorderPoint(product) && (
// // //                       <p className="text-[10px] font-semibold text-amber-300 mt-0.5">
// // //                         Reorder {suggestedReorder(product)} · min{" "}
// // //                         {reorderPoint(product)}
// // //                       </p>
// // //                     )}
// // //                   </div>
// // //                 </div>

// // //                 {/* Request Stock Button for Mobile */}
// // //                 {canCreateRequests &&
// // //                   storeId &&
// // //                   stock <= reorderPoint(product) && (
// // //                     <button
// // //                       type="button"
// // //                       disabled={!!existingRequest}
// // //                       onClick={(event) => {
// // //                         event.stopPropagation();
// // //                         setRequestTarget(product);
// // //                         setRequestQuantity(String(suggestedReorder(product)));
// // //                       }}
// // //                       className="mt-1 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80"
// // //                     >
// // //                       {existingRequest
// // //                         ? `Request ${existingRequest.status.toLowerCase()}`
// // //                         : "Request stock"}
// // //                     </button>
// // //                   )}
// // //               </div>
// // //             );
// // //           })
// // //         )}
// // //       </div>

// // //       {/* Pagination - Mobile တွင် အောက်ခြေချင်း စုပုံပြသမည် */}
// // //       {totalItems > 0 && (
// // //         <div className="mt-4 flex flex-col items-center justify-between gap-3 px-2 md:flex-row md:gap-4">
// // //           <p className="text-center text-xs text-slate-400 md:text-left">
// // //             Showing{" "}
// // //             <strong className="text-white">{startItem.toLocaleString()}</strong>{" "}
// // //             to{" "}
// // //             <strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
// // //             of{" "}
// // //             <strong className="text-white">
// // //               {totalItems.toLocaleString()}
// // //             </strong>{" "}
// // //             items
// // //           </p>

// // //           {pageSize > 0 && totalPages > 1 && (
// // //             <div className="flex items-center gap-1.5">
// // //               <PageButton
// // //                 onClick={() => setCurrentPage(1)}
// // //                 disabled={activePage <= 1}
// // //                 label="First page"
// // //               >
// // //                 <ChevronsLeft className="h-3.5 w-3.5" />
// // //               </PageButton>
// // //               <PageButton
// // //                 onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
// // //                 disabled={activePage <= 1}
// // //                 label="Previous page"
// // //                 wide
// // //               >
// // //                 <ChevronLeft className="h-3.5 w-3.5" /> Prev
// // //               </PageButton>

// // //               <span className="px-2 text-xs text-slate-400">
// // //                 Page <strong className="text-white">{activePage}</strong> of{" "}
// // //                 {totalPages}
// // //               </span>

// // //               <PageButton
// // //                 onClick={() =>
// // //                   setCurrentPage((page) => Math.min(totalPages, page + 1))
// // //                 }
// // //                 disabled={activePage >= totalPages}
// // //                 label="Next page"
// // //                 wide
// // //               >
// // //                 Next <ChevronRight className="h-3.5 w-3.5" />
// // //               </PageButton>
// // //               <PageButton
// // //                 onClick={() => setCurrentPage(totalPages)}
// // //                 disabled={activePage >= totalPages}
// // //                 label="Last page"
// // //               >
// // //                 <ChevronsRight className="h-3.5 w-3.5" />
// // //               </PageButton>
// // //             </div>
// // //           )}
// // //         </div>
// // //       )}

// // //       {/* Detail drawer */}
// // //       {selected && (
// // //         <ProductDrawer product={selected} onClose={() => setSelected(null)} />
// // //       )}
// // //       {requestTarget && (
// // //         <div
// // //           className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
// // //           onMouseDown={(event) => {
// // //             if (event.target === event.currentTarget) setRequestTarget(null);
// // //           }}
// // //         >
// // //           <form
// // //             className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
// // //             onSubmit={async (event) => {
// // //               event.preventDefault();
// // //               const quantity = Number(requestQuantity);
// // //               if (
// // //                 !storeId ||
// // //                 !requestTarget.productId ||
// // //                 !requestTarget.variantId ||
// // //                 !Number.isInteger(quantity) ||
// // //                 quantity < 1
// // //               )
// // //                 return;
// // //               try {
// // //                 const result = await createStockRequest({
// // //                   storeId,
// // //                   productId: requestTarget.productId,
// // //                   variantId: requestTarget.variantId,
// // //                   quantity,
// // //                   reason: requestReason,
// // //                 }).unwrap();
// // //                 setRequestTarget(null);
// // //                 setRequestReason("");
// // //                 if (result?.duplicate)
// // //                   window.alert(
// // //                     "A request for this variant is already open. You can track it under Stock requests.",
// // //                   );
// // //                 onRequestSubmitted?.();
// // //               } catch (error: any) {
// // //                 window.alert(
// // //                   error?.data?.message || "Could not submit stock request.",
// // //                 );
// // //               }
// // //             }}
// // //           >
// // //             <h3 className="text-lg font-bold text-white">Request stock</h3>
// // //             <p className="mt-1 text-sm text-slate-400">
// // //               {requestTarget.name} · Current stock {num(requestTarget.stock)}
// // //             </p>
// // //             <label className="mt-4 block text-xs font-semibold text-slate-300">
// // //               Quantity needed
// // //               <input
// // //                 autoFocus
// // //                 min="1"
// // //                 step="1"
// // //                 type="number"
// // //                 value={requestQuantity}
// // //                 onChange={(event) => setRequestQuantity(event.target.value)}
// // //                 className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// // //               />
// // //             </label>
// // //             <label className="mt-3 block text-xs font-semibold text-slate-300">
// // //               Note (optional)
// // //               <textarea
// // //                 value={requestReason}
// // //                 onChange={(event) => setRequestReason(event.target.value)}
// // //                 maxLength={500}
// // //                 rows={3}
// // //                 placeholder="Low stock, customer demand…"
// // //                 className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// // //               />
// // //             </label>
// // //             <div className="mt-4 flex justify-end gap-2">
// // //               <button
// // //                 type="button"
// // //                 onClick={() => setRequestTarget(null)}
// // //                 className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
// // //               >
// // //                 Cancel
// // //               </button>
// // //               <button
// // //                 disabled={isRequesting}
// // //                 className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
// // //               >
// // //                 {isRequesting ? "Sending…" : "Send request"}
// // //               </button>
// // //             </div>
// // //           </form>
// // //         </div>
// // //       )}
// // //     </main>
// // //   );
// // // }

// // // /* ------------------------------------------------------------------ */
// // // /*  Sub-components                                                     */
// // // /* ------------------------------------------------------------------ */

// // // const TONES: Record<string, string> = {
// // //   sky: "border-sky-500/20 bg-sky-500/5 text-sky-300",
// // //   emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
// // //   amber: "border-amber-500/20 bg-amber-500/5 text-amber-300",
// // //   rose: "border-rose-500/20 bg-rose-500/5 text-rose-300",
// // //   slate: "border-slate-800 bg-slate-900 text-slate-300",
// // // };

// // // function StatCard({
// // //   icon: Icon,
// // //   label,
// // //   value,
// // //   note,
// // //   tone,
// // // }: {
// // //   icon: typeof Package;
// // //   label: string;
// // //   value: string;
// // //   note: string;
// // //   tone: keyof typeof TONES;
// // // }) {
// // //   return (
// // //     <article className={`rounded-2xl border p-3 md:p-4 ${TONES[tone]}`}>
// // //       <div className="flex items-center gap-2">
// // //         <Icon className="h-4 w-4 shrink-0" />
// // //         <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider opacity-80 truncate">
// // //           {label}
// // //         </p>
// // //       </div>
// // //       <p className="mt-2 truncate text-lg md:text-xl font-black text-white">
// // //         {value}
// // //       </p>
// // //       <p className="mt-1 truncate text-[10px] md:text-[11px] text-slate-400">
// // //         {note}
// // //       </p>
// // //     </article>
// // //   );
// // // }

// // // function SortableHeader({
// // //   label,
// // //   sortKey,
// // //   activeKey,
// // //   dir,
// // //   onSort,
// // //   align = "left",
// // // }: {
// // //   label: string;
// // //   sortKey: SortKey;
// // //   activeKey: SortKey;
// // //   dir: SortDir;
// // //   onSort: (key: SortKey) => void;
// // //   align?: "left" | "right";
// // // }) {
// // //   const active = activeKey === sortKey;
// // //   const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;

// // //   return (
// // //     <th
// // //       className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wider ${
// // //         align === "right" ? "text-right" : "text-left"
// // //       }`}
// // //     >
// // //       <button
// // //         type="button"
// // //         onClick={() => onSort(sortKey)}
// // //         aria-sort={
// // //           active ? (dir === "asc" ? "ascending" : "descending") : "none"
// // //         }
// // //         className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-200 ${
// // //           active ? "text-sky-400" : "text-slate-400"
// // //         }`}
// // //       >
// // //         {label}
// // //         <Icon className="h-3 w-3" />
// // //       </button>
// // //     </th>
// // //   );
// // // }

// // // function PageButton({
// // //   children,
// // //   onClick,
// // //   disabled,
// // //   label,
// // //   wide,
// // // }: {
// // //   children: React.ReactNode;
// // //   onClick: () => void;
// // //   disabled: boolean;
// // //   label: string;
// // //   wide?: boolean;
// // // }) {
// // //   return (
// // //     <button
// // //       type="button"
// // //       onClick={onClick}
// // //       disabled={disabled}
// // //       aria-label={label}
// // //       className={`flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40 ${
// // //         wide ? "px-3" : "px-2"
// // //       }`}
// // //     >
// // //       {children}
// // //     </button>
// // //   );
// // // }

// // // function ProductDrawer({
// // //   product,
// // //   onClose,
// // // }: {
// // //   product: Product;
// // //   onClose: () => void;
// // // }) {
// // //   const stock = num(product.stock);
// // //   const tone = TONE_META[getTone(stock)];
// // //   const subtitle = productSubtitle(product);
// // //   const lots = getLots(product);

// // //   const rows: [string, string][] = [
// // //     ["SKU", product.sku || "—"],
// // //     ["Barcode", product.barcode || "—"],
// // //     ["Category", product.category || "Uncategorised"],
// // //     ["Unit price", `${num(product.price).toLocaleString()} MMK`],
// // //     ["On hand", `${stock.toLocaleString()} units`],
// // //     ["Reorder point", `${reorderPoint(product)} units`],
// // //     ["Suggested reorder", `${suggestedReorder(product)} units`],
// // //     ["Stock value", `${(stock * num(product.price)).toLocaleString()} MMK`],
// // //   ];

// // //   return (
// // //     <div
// // //       className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm"
// // //       onClick={onClose}
// // //       role="presentation"
// // //     >
// // //       <aside
// // //         role="dialog"
// // //         aria-modal="true"
// // //         aria-label={`Details for ${product.name}`}
// // //         onClick={(event) => event.stopPropagation()}
// // //         className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-800 bg-slate-900 p-4 md:p-6 shadow-2xl"
// // //       >
// // //         <div className="flex items-start justify-between gap-4">
// // //           <div className="min-w-0">
// // //             <h3 className="text-lg font-black text-white">{product.name}</h3>
// // //             {subtitle && (
// // //               <p className="mt-1 text-xs font-medium text-emerald-400/90">
// // //                 {subtitle}
// // //               </p>
// // //             )}
// // //           </div>
// // //           <button
// // //             type="button"
// // //             onClick={onClose}
// // //             aria-label="Close details"
// // //             className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
// // //           >
// // //             <X className="h-4 w-4" />
// // //           </button>
// // //         </div>

// // //         <span
// // //           className={`mt-4 inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-bold ${tone.className}`}
// // //         >
// // //           {tone.label}
// // //         </span>

// // //         <dl className="mt-5 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/50">
// // //           {rows.map(([label, value]) => (
// // //             <div
// // //               key={label}
// // //               className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
// // //             >
// // //               <dt className="text-slate-400">{label}</dt>
// // //               <dd className="truncate font-semibold text-slate-100">{value}</dd>
// // //             </div>
// // //           ))}
// // //         </dl>

// // //         {lots.length > 0 && (
// // //           <section className="mt-5">
// // //             <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
// // //               Batches &amp; lots ({lots.length})
// // //             </h4>
// // //             <ul className="space-y-2">
// // //               {lots.map((lot) => {
// // //                 const risk =
// // //                   lot.days < 0
// // //                     ? "border-rose-500/30 bg-rose-500/5"
// // //                     : lot.days <= EXPIRY_SOON_DAYS
// // //                       ? "border-amber-500/30 bg-amber-500/5"
// // //                       : "border-slate-800 bg-slate-950/50";
// // //                 return (
// // //                   <li
// // //                     key={lot.key}
// // //                     className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${risk}`}
// // //                   >
// // //                     <div className="min-w-0">
// // //                       <p className="truncate font-semibold text-slate-100">
// // //                         Lot {lot.number}
// // //                       </p>
// // //                       <p className="mt-0.5 text-[11px] text-slate-400">
// // //                         {lot.expiryDate
// // //                           ? lot.days < 0
// // //                             ? `Expired ${Math.abs(lot.days)} day(s) ago`
// // //                             : `Expires ${new Date(
// // //                                 lot.expiryDate,
// // //                               ).toLocaleDateString()} · ${lot.days} day(s) left`
// // //                           : "No expiry recorded"}
// // //                       </p>
// // //                     </div>
// // //                     <span className="shrink-0 font-bold tabular-nums text-white">
// // //                       {lot.quantity.toLocaleString()}
// // //                     </span>
// // //                   </li>
// // //                 );
// // //               })}
// // //             </ul>
// // //           </section>
// // //         )}

// // //         {product.variants && product.variants.length > 0 && (
// // //           <section className="mt-5">
// // //             <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
// // //               Variants ({product.variants.length})
// // //             </h4>
// // //             <ul className="flex flex-wrap gap-2">
// // //               {product.variants.map((variant) => (
// // //                 <li
// // //                   key={variant.id}
// // //                   className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[11px] font-semibold text-slate-300"
// // //                 >
// // //                   {variant.name}
// // //                 </li>
// // //               ))}
// // //             </ul>
// // //           </section>
// // //         )}
// // //       </aside>
// // //     </div>
// // //   );
// // // }
