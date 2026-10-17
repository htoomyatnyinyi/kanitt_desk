import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Search, Plus, Barcode, X, Layers, ImageOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Product, CartItem } from "../types";
import { resolveMediaUrl } from "../services/api";
import { useSystemBack } from "../hooks/SystemBackProvider";

/* ------------------------------------------------------------------ */
/*  Variant helpers                                                    */
/* ------------------------------------------------------------------ */

export type Variant = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  availableStock?: number;
};

const getVariants = (product: Product): Variant[] => {
  const value = (product as { variants?: unknown }).variants;
  return Array.isArray(value) ? (value as Variant[]) : [];
};

const variantSubtitle = (variant: Variant) =>
  [variant.sku, variant.barcode].filter(Boolean).join(" · ");

/* ------------------------------------------------------------------ */
/*  Product thumbnail with graceful fallback                           */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function categoryPreset(category: string) {
  const value = category.toLowerCase();
  if (/pharmacy|medicine|medical|drug|health/.test(value)) return { emoji: "💊", hue: 155 };
  if (/grocery|produce|fruit|vegetable|food/.test(value)) return { emoji: "🥬", hue: 105 };
  if (/drink|beverage|water|juice/.test(value)) return { emoji: "🥤", hue: 190 };
  if (/bakery|bread|cake/.test(value)) return { emoji: "🍞", hue: 35 };
  if (/beauty|cosmetic|personal care/.test(value)) return { emoji: "🧴", hue: 320 };
  if (/electronic|device|computer/.test(value)) return { emoji: "🔌", hue: 220 };
  if (/household|home|clean/.test(value)) return { emoji: "🧼", hue: 265 };
  return { emoji: "🛍️", hue: 205 };
}

function ProductThumb({
  product,
  alt,
  className = "",
  showOverlayName = true,
}: {
  product: Product;
  alt?: string;
  className?: string;
  showOverlayName?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const raw = product.imageUrl || product.image;
  const src = raw ? resolveMediaUrl(raw) : null;
  const hasImage = !!src && !errored;

  useEffect(() => setErrored(false), [src]);
  const preset = categoryPreset(product.category || "");
  const hue = preset.hue;
  const initials = getInitials(product.name || "");

  if (!hasImage) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          className || "aspect-[4/3] w-full"
        }`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 55% 22%) 0%, hsl(${hue + 30} 45% 12%) 100%)`,
        }}
        aria-label={alt || product.name}
      >
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, hsl(${hue} 90% 70%) 0%, transparent 40%), radial-gradient(circle at 80% 70%, hsl(${hue + 60} 90% 70%) 0%, transparent 45%)`,
          }}
        />
        <span className="relative flex select-none flex-col items-center gap-1 text-white/85">
          <span className="text-2xl" aria-hidden="true">{preset.emoji}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{initials}</span>
        </span>
        <ImageOff
          className="absolute right-2 top-2 h-3 w-3 text-white/30"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-800 ${
        className || "aspect-[4/3] w-full"
      }`}
    >
      <img
        src={src}
        alt={alt || product.name}
        loading="lazy"
        onError={() => setErrored(true)}
        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      {showOverlayName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PosView                                                            */
/* ------------------------------------------------------------------ */

interface PosViewProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[];
  filteredProducts: Product[];
  allProducts?: Product[];
  addToCart: (product: Product, variant?: Variant) => boolean | void;
  cart?: CartItem[];
}

export function PosView({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  filteredProducts,
  allProducts = [],
  addToCart,
  cart = [],
}: PosViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Variant picker
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);
  const [variantQuery, setVariantQuery] = useState("");

  // Toast feedback when item is added to cart or reaches limit
  const [toastFeedback, setToastFeedback] = useState<{
    name: string;
    price?: number;
    type: "success" | "warning";
    message?: string;
    timestamp: number;
  } | null>(null);

  const showAddedToast = useCallback((name: string, price: number) => {
    setToastFeedback({ name, price, type: "success", timestamp: Date.now() });
  }, []);

  const showStockWarningToast = useCallback((name: string, maxStock: number) => {
    setToastFeedback({
      name,
      type: "warning",
      message: `Stock limit reached (Max: ${maxStock})`,
      timestamp: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!toastFeedback) return;
    const timer = setTimeout(() => {
      setToastFeedback(null);
    }, 2400);
    return () => clearTimeout(timer);
  }, [toastFeedback?.timestamp]);

  /* --------------------------- focus / paging ------------------- */

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const totalItems = filteredProducts.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize <= 0) return filteredProducts;
    const start = (activePage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, activePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const endItem =
    pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

  /* ------------------------- variant picker --------------------- */

  const pickerVariants = useMemo(
    () => (variantPicker ? getVariants(variantPicker) : []),
    [variantPicker],
  );

  const filteredVariants = useMemo(() => {
    const q = variantQuery.trim().toLowerCase();
    if (!q) return pickerVariants;
    return pickerVariants.filter((v) =>
      [v.name, v.sku, v.barcode]
        .map((x) => (x || "").toLowerCase())
        .some((x) => x.includes(q)),
    );
  }, [pickerVariants, variantQuery]);

  const closePicker = useCallback(() => {
    setVariantPicker(null);
    setVariantQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  useSystemBack(!!variantPicker, closePicker, 60);

  /* --------------------------- add-to-cart ---------------------- */

  const handleProductClick = useCallback(
    (product: Product) => {
      const variants = getVariants(product);
      if (variants.length === 0) return;
      if (variants.length === 1) {
        const v = variants[0];
        const vStock = Number(v.availableStock ?? v.stock ?? product.stock ?? 0);
        if (vStock <= 0) return;

        const cartItemId = `${product.id}::variant::${v.id}`;
        const currentInCart = cart.find((item) => item.id === cartItemId)?.quantity || 0;
        if (currentInCart >= vStock) {
          showStockWarningToast(product.name, vStock);
          return;
        }

        const success = addToCart(product, v);
        if (success !== false) {
          showAddedToast(
            `${product.name} ${v.name ? `(${v.name})` : ""}`,
            Number(v.price ?? product.price ?? 0),
          );
        } else {
          showStockWarningToast(product.name, vStock);
        }
        return;
      }
      setVariantPicker(product);
      setVariantQuery("");
    },
    [addToCart, cart, showAddedToast, showStockWarningToast],
  );

  const pickVariant = useCallback(
    (product: Product, variant: Variant) => {
      const vStock = Number(variant.availableStock ?? variant.stock ?? product.stock ?? 0);
      const cartItemId = `${product.id}::variant::${variant.id}`;
      const currentInCart = cart.find((item) => item.id === cartItemId)?.quantity || 0;

      if (currentInCart >= vStock) {
        showStockWarningToast(`${product.name} (${variant.name})`, vStock);
        return;
      }

      const success = addToCart(product, variant);
      if (success !== false) {
        showAddedToast(
          `${product.name} (${variant.name})`,
          Number(variant.price ?? product.price ?? 0),
        );
        closePicker();
      } else {
        showStockWarningToast(`${product.name} (${variant.name})`, vStock);
      }
    },
    [addToCart, cart, closePicker, showAddedToast, showStockWarningToast],
  );

  /* --------------------------- scanner -------------------------- */

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !searchQuery.trim()) return;
    event.preventDefault();

    const query = searchQuery.trim().toLowerCase();
    const list = allProducts.length > 0 ? allProducts : filteredProducts;

    for (const product of list) {
      const productHit =
        (product.barcode || "").toLowerCase() === query ||
        (product.sku || "").toLowerCase() === query ||
        (product.name || "").toLowerCase() === query;

      if (productHit) {
        handleProductClick(product);
        setSearchQuery("");
        return;
      }

      const variantHit = getVariants(product).find(
        (v) =>
          (v.barcode || "").toLowerCase() === query ||
          (v.sku || "").toLowerCase() === query,
      );
      if (variantHit) {
        const vStock = Number(variantHit.availableStock ?? variantHit.stock ?? product.stock ?? 0);
        const cartItemId = `${product.id}::variant::${variantHit.id}`;
        const currentInCart = cart.find((item) => item.id === cartItemId)?.quantity || 0;

        if (currentInCart >= vStock) {
          showStockWarningToast(`${product.name} (${variantHit.name})`, vStock);
        } else {
          const success = addToCart(product, variantHit);
          if (success !== false) {
            showAddedToast(
              `${product.name} (${variantHit.name})`,
              Number(variantHit.price ?? product.price ?? 0),
            );
          } else {
            showStockWarningToast(`${product.name} (${variantHit.name})`, vStock);
          }
        }
        setSearchQuery("");
        return;
      }
    }
  };

  /* ----------------------------- render ------------------------- */

  return (
    <div className="relative flex min-w-0 flex-none flex-col overflow-visible p-4 pb-24 lg:flex-1 lg:overflow-y-auto lg:p-6 lg:pb-6">
      {/* Real-time Toast (Success / Stock Limit Warning) */}
      {toastFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200 ${
            toastFeedback.type === "warning"
              ? "border-amber-500/50 bg-slate-900/95 shadow-amber-500/20"
              : "border-emerald-500/40 bg-slate-900/95 shadow-emerald-500/20"
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              toastFeedback.type === "warning"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {toastFeedback.type === "warning" ? (
              <AlertCircle className="h-5 w-5 stroke-[2.5]" />
            ) : (
              <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
            )}
          </div>
          <div className="min-w-0 pr-2">
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                toastFeedback.type === "warning"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {toastFeedback.type === "warning"
                ? "Stock Limit Reached"
                : "Added to Cart"}
            </p>
            <p className="max-w-[220px] truncate text-xs font-bold text-slate-100">
              {toastFeedback.name}
            </p>
            {toastFeedback.message && (
              <p className="text-[11px] text-amber-300 font-medium">
                {toastFeedback.message}
              </p>
            )}
          </div>
          {toastFeedback.price !== undefined && (
            <span className="shrink-0 text-xs font-black text-sky-400">
              {toastFeedback.price.toLocaleString()} MMK
            </span>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="mb-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan barcode (Enter) or search product..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition-colors focus:border-sky-500 focus:outline-none"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-slate-500">
            <Barcode className="h-4 w-4 text-sky-400" />
          </div>
        </div>

        <div className="flex w-full items-center gap-3 sm:min-w-0 sm:flex-1">
          <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all lg:px-4 lg:py-2 ${
                  selectedCategory === category
                    ? "border border-sky-500/40 bg-slate-800 text-sky-400"
                    : "border border-slate-800/60 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-slate-400 sm:ml-0">
            Grid:
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </label>
        </div>
      </div>

      {/* Product grid */}
      <div className="grid flex-1 content-start grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 lg:gap-3.5">
        {paginatedProducts.map((product) => {
          const variants = getVariants(product);
          const variantCount = variants.length;
          const totalStock = variants.reduce(
            (sum, v) => sum + (Number(v.availableStock ?? v.stock ?? 0)),
            0,
          );
          const isSingleVariant = variantCount === 1;
          const singleVariantInCart = isSingleVariant
            ? cart.find((item) => item.id === `${product.id}::variant::${variants[0].id}`)?.quantity || 0
            : 0;
          const isLimitReached = isSingleVariant && totalStock > 0 && singleVariantInCart >= totalStock;

          const isOutOfStock =
            variantCount > 0 &&
            variants.every(
              (v) => Number(v.availableStock ?? v.stock ?? 0) <= 0,
            );
          const disabled = variantCount === 0 || isOutOfStock || isLimitReached;

          return (
            <button
              key={product.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && handleProductClick(product)}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 active:scale-[0.98] ${
                disabled
                  ? "cursor-not-allowed border-slate-800/60 bg-slate-900/40 opacity-50"
                  : "cursor-pointer border-slate-800/80 bg-slate-900/80 hover:border-sky-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              }`}
            >
              {/* Image / fallback */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800">
                <ProductThumb product={product} className="h-full w-full" />
                {variantCount > 1 && (
                  <span className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-violet-300 backdrop-blur-md border border-violet-500/30">
                    <Layers className="h-3 w-3" />
                    {variantCount} options
                  </span>
                )}
                {isOutOfStock ? (
                  <span className="absolute top-2 right-2 rounded-md bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    Out of stock
                  </span>
                ) : isLimitReached ? (
                  <span className="absolute top-2 right-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-slate-950 shadow">
                    In Cart: {singleVariantInCart}/{totalStock} (Max)
                  </span>
                ) : (
                  <span
                    className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-md ${
                      totalStock <= 5
                        ? "bg-amber-500/85 text-white"
                        : "bg-slate-950/70 text-slate-300 border border-slate-700/50"
                    }`}
                  >
                    {totalStock} in stock
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="truncate rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
                    {product.category || "General"}
                  </span>
                </div>

                {/* Name */}
                <h3 className="line-clamp-2 text-xs font-bold leading-snug text-slate-100 transition-colors group-hover:text-sky-300">
                  {product.name || "Unnamed Product"}
                </h3>

                {/* SKU */}
                <span className="mt-1 font-mono text-[10px] text-slate-500 truncate">
                  {product.sku ? `SKU: ${product.sku}` : (product.barcode ? `BC: ${product.barcode}` : "—")}
                </span>

                {/* Spacer */}
                <div className="flex-1 min-h-[8px]" />

                {/* Footer: Price + Quick add button */}
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/70 pt-2.5">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white sm:text-sm">
                      {(Number(product.price) || 0).toLocaleString()}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400">
                      MMK
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 transition-all group-hover:bg-sky-500 group-hover:text-slate-950 group-hover:shadow-md group-hover:shadow-sky-500/30"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {paginatedProducts.length === 0 && (
        <div className="py-16 text-center text-sm text-slate-400">
          No matching products found.
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/60 pt-3 text-xs">
          <p className="text-slate-400">
            Showing{" "}
            <strong className="text-white">{startItem.toLocaleString()}</strong>
            –<strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
            of{" "}
            <strong className="text-white">
              {totalItems.toLocaleString()}
            </strong>{" "}
            items
          </p>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-slate-400">
                Page <strong className="text-white">{activePage}</strong> /{" "}
                {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={activePage >= totalPages}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------------- Variant picker -------------------- */}
      {variantPicker && (
        <div
          className="fixed inset-0 z-80 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={closePicker}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Choose a variant of ${variantPicker.name}`}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <ProductThumb
                  product={variantPicker}
                  className="h-12 w-12 shrink-0 rounded-xl"
                  showOverlayName={false}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                    Choose a variant
                  </p>
                  <h3 className="mt-0.5 truncate text-lg font-black text-white">
                    {variantPicker.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {pickerVariants.length} variants available
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePicker}
                aria-label="Close variant picker"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {pickerVariants.length > 6 && (
              <div className="border-b border-slate-800 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    autoFocus
                    type="text"
                    value={variantQuery}
                    onChange={(event) => setVariantQuery(event.target.value)}
                    placeholder="Filter variants…"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <ul className="flex-1 overflow-y-auto p-2">
              {filteredVariants.map((variant) => {
                const vStock =
                  Number(variant.availableStock ?? variant.stock ?? variantPicker.stock) || 0;
                const cartItemId = `${variantPicker.id}::variant::${variant.id}`;
                const currentInCart = cart.find((item) => item.id === cartItemId)?.quantity || 0;
                const isLimitReached = vStock > 0 && currentInCart >= vStock;
                const outOfStock = vStock <= 0 || isLimitReached;
                const price = Number(variant.price ?? variantPicker.price) || 0;
                const subtitle = variantSubtitle(variant);

                return (
                  <li key={variant.id}>
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => pickVariant(variantPicker, variant)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {variant.name}
                        </p>
                        {subtitle && (
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                            {subtitle}
                          </p>
                        )}
                        <p
                          className={`mt-1 text-[11px] font-medium ${
                            vStock <= 0
                              ? "text-rose-400"
                              : isLimitReached
                                ? "text-amber-400"
                                : vStock <= 5
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                          }`}
                        >
                          {vStock <= 0
                            ? "Out of stock"
                            : isLimitReached
                              ? `In cart: ${currentInCart} / ${vStock} (Max reached)`
                              : `${vStock} in stock`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-white">
                          {price.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500">MMK</p>
                      </div>
                    </button>
                  </li>
                );
              })}

              {filteredVariants.length === 0 && (
                <li className="p-6 text-center text-xs text-slate-400">
                  No variants match "{variantQuery}".
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
