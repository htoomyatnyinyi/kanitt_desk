import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Keyboard,
  Package,
  RotateCcw,
  Search,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../types";
import { useCreateStockRequestMutation, useGetStockRequestsQuery } from "../store/apiSlice";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

/** Stock thresholds (inclusive upper bounds). */
const LOW_THRESHOLD = 20;
const CRITICAL_THRESHOLD = 5;

/** Lots expiring within this many days are flagged. */
const EXPIRY_SOON_DAYS = 90;

type SortKey = "name" | "sku" | "category" | "price" | "stock";
type SortDir = "asc" | "desc";
type StockFilter = "all" | "in" | "low" | "critical" | "out" | "expiring" | "reorder";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const num = (value: unknown) => Number(value) || 0;

/** Whole days from today until `date` (negative = already expired). */
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

/** All lots for a product, flattened, with days-to-expiry attached. */
const getLots = (product: Product) =>
  (product.inventories ?? [])
    .filter((inventory) => inventory.lot)
    .map((inventory, index) => ({
      key: `${inventory.lot?.number ?? "lot"}-${index}`,
      number: inventory.lot?.number ?? "—",
      expiryDate: inventory.lot?.expiryDate,
      quantity: num(inventory.quantity),
      days: daysUntil(inventory.lot?.expiryDate ?? undefined),
    }));

const hasExpiryRisk = (product: Product) =>
  getLots(product).some((lot) => lot.days <= EXPIRY_SOON_DAYS);
const reorderPoint = (product: Product) => {
  const values = (product.inventories ?? []).map((row) => num(row.reorderPoint)).filter((value) => value > 0);
  return values.length ? Math.max(...values) : 10;
};
const suggestedReorder = (product: Product) => {
  const quantities = (product.inventories ?? []).map((row) => num(row.reorderQty));
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface InventoryViewProps {
  products: Product[];
  storeId?: string;
  userRole?: string;
  isLoading?: boolean;
  onRequestSubmitted?: () => void;
}

export function InventoryView({
  products,
  storeId,
  userRole = "CASHIER",
  isLoading = false,
  onRequestSubmitted,
}: InventoryViewProps) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selected, setSelected] = useState<Product | null>(null);
  const [requestTarget, setRequestTarget] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestReason, setRequestReason] = useState("");
  const requestQueryStoreId = ["ADMIN", "SUPER_ADMIN"].includes(userRole) ? undefined : storeId;
  const { data: stockRequests = [] } = useGetStockRequestsQuery({ storeId: requestQueryStoreId }, { pollingInterval: 15000, skip: !storeId && !["ADMIN", "SUPER_ADMIN"].includes(userRole) });
  const [createStockRequest, { isLoading: isRequesting }] = useCreateStockRequestMutation();
  const canCreateRequests = ["CASHIER", "MANAGER"].includes(userRole);

  const searchRef = useRef<HTMLInputElement>(null);

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
    if (stockFilter === "reorder") return searchFiltered.filter((product) => num(product.stock) <= reorderPoint(product));
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
      reorder: 0,
      stockValue: 0,
      units: 0,
    };
    for (const product of searchFiltered) {
      const stock = num(product.stock);
      result[getTone(stock)] += 1;
      result.units += stock;
      result.stockValue += stock * num(product.price);
      if (hasExpiryRisk(product)) result.expiring += 1;
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
      "Expiring soon",
    ];
    const rows = sortedProducts.map((product) => {
      const stock = num(product.stock);
      const tone = getTone(stock);
      return [
        product.name,
        product.sku,
        product.barcode ?? "",
        product.category ?? "",
        num(product.price),
        stock,
        TONE_META[tone].label,
        hasExpiryRisk(product) ? "Yes" : "No",
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
        setSelected(null);
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  /* ---------------------------- render ------------------------- */

  return (
    <main className="flex flex-1 flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">
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

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-500 lg:flex">
            <Keyboard className="h-3.5 w-3.5" />
            <kbd className="font-sans font-semibold text-slate-300">/</kbd>
            or
            <kbd className="font-sans font-semibold text-slate-300">⌘K</kbd>
            to search
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={sortedProducts.length === 0}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          note={`Lots expiring within ${EXPIRY_SOON_DAYS} days`}
          tone={stats.expiring > 0 ? "amber" : "slate"}
        />
      </section>

      {/* Search / filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
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

        <div className="ml-auto flex items-center gap-3">
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
      <div className="mb-4 flex flex-wrap gap-2">
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
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
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

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/70">
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
                label="Stock"
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
              const lots = getLots(product);
              const expiring = hasExpiryRisk(product);

              return (
                <tr
                  key={product.id}
                  onClick={() => setSelected(product)}
                  className="cursor-pointer border-b border-slate-800/50 transition-colors last:border-0 hover:bg-slate-800/30"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      {expiring && (
                        <AlertTriangle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
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

                  <td className="px-5 py-3 text-right font-bold tabular-nums text-white">
                    {stock.toLocaleString()}
                    {stock <= reorderPoint(product) && (
                      <div className="mt-1 text-[10px] font-semibold text-amber-300">
                        Reorder {suggestedReorder(product)} · min {reorderPoint(product)}
                      </div>
                    )}
                    {lots.length > 0 && (
                      <div className="mt-1 space-y-1 text-[10px] font-medium text-slate-400">
                        {lots.slice(0, 3).map((lot) => (
                          <div key={lot.key} className="truncate">
                            Lot {lot.number} · {lot.quantity}
                            {lot.expiryDate && (
                              <span
                                className={
                                  lot.days < 0
                                    ? " text-rose-400"
                                    : lot.days <= EXPIRY_SOON_DAYS
                                      ? " text-amber-400"
                                      : ""
                                }
                              >
                                {" · "}
                                {lot.days < 0 ? "Expired " : "Exp "}
                                {new Date(lot.expiryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))}
                        {lots.length > 3 && (
                          <div className="text-slate-500">
                            +{lots.length - 3} more lot
                            {lots.length - 3 === 1 ? "" : "s"}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3 text-center">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.className}`}
                    >
                      {tone.label}
                    </span>
                    {canCreateRequests && storeId && stock <= reorderPoint(product) && (
                      (() => {
                        const existingRequest = stockRequests.find((request: any) => request.storeId === storeId && request.productId === product.productId && request.variantId === product.variantId && ["PENDING", "ACKNOWLEDGED"].includes(request.status));
                        return <button type="button" disabled={!!existingRequest} onClick={(event) => { event.stopPropagation(); setRequestTarget(product); setRequestQuantity(String(suggestedReorder(product))); }} className="mt-2 block w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-80">{existingRequest ? `Request ${existingRequest.status.toLowerCase()}` : "Request stock"}</button>;
                      })()
                    )}
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

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
          <p className="text-xs text-slate-400">
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
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
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

      {/* Detail drawer */}
      {selected && (
        <ProductDrawer product={selected} onClose={() => setSelected(null)} />
      )}
      {requestTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRequestTarget(null); }}>
          <form className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl" onSubmit={async (event) => {
            event.preventDefault();
            const quantity = Number(requestQuantity);
            if (!storeId || !requestTarget.productId || !requestTarget.variantId || !Number.isInteger(quantity) || quantity < 1) return;
            try {
              const result = await createStockRequest({ storeId, productId: requestTarget.productId, variantId: requestTarget.variantId, quantity, reason: requestReason }).unwrap();
              setRequestTarget(null); setRequestReason("");
              if (result?.duplicate) window.alert("A request for this variant is already open. You can track it under Stock requests.");
              onRequestSubmitted?.();
            } catch (error: any) { window.alert(error?.data?.message || "Could not submit stock request."); }
          }}>
            <h3 className="text-lg font-bold text-white">Request stock</h3>
            <p className="mt-1 text-sm text-slate-400">{requestTarget.name} · Current stock {num(requestTarget.stock)}</p>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Quantity needed<input autoFocus min="1" step="1" type="number" value={requestQuantity} onChange={(event) => setRequestQuantity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500" /></label>
            <label className="mt-3 block text-xs font-semibold text-slate-300">Note (optional)<textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} maxLength={500} rows={3} placeholder="Low stock, customer demand…" className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500" /></label>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setRequestTarget(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white">Cancel</button><button disabled={isRequesting} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{isRequesting ? "Sending…" : "Send request"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
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
    <article className={`rounded-2xl border p-4 ${TONES[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
          {label}
        </p>
      </div>
      <p className="mt-2 truncate text-xl font-black text-white">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-400">{note}</p>
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

function ProductDrawer({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const stock = num(product.stock);
  const tone = TONE_META[getTone(stock)];
  const subtitle = productSubtitle(product);
  const lots = getLots(product);

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
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">{product.name}</h3>
            {subtitle && (
              <p className="mt-1 text-xs font-medium text-emerald-400/90">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <span
          className={`mt-4 inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-bold ${tone.className}`}
        >
          {tone.label}
        </span>

        <dl className="mt-5 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/50">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
            >
              <dt className="text-slate-400">{label}</dt>
              <dd className="truncate font-semibold text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>

        {lots.length > 0 && (
          <section className="mt-5">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Batches &amp; lots ({lots.length})
            </h4>
            <ul className="space-y-2">
              {lots.map((lot) => {
                const risk =
                  lot.days < 0
                    ? "border-rose-500/30 bg-rose-500/5"
                    : lot.days <= EXPIRY_SOON_DAYS
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-slate-800 bg-slate-950/50";
                return (
                  <li
                    key={lot.key}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${risk}`}
                  >
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
                              ).toLocaleDateString()} · ${lot.days} day(s) left`
                          : "No expiry recorded"}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-white">
                      {lot.quantity.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {product.variants && product.variants.length > 0 && (
          <section className="mt-5">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Variants ({product.variants.length})
            </h4>
            <ul className="flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <li
                  key={variant.id}
                  className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[11px] font-semibold text-slate-300"
                >
                  {variant.name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
