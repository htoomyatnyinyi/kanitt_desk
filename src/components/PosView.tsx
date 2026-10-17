import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Search, Plus, Barcode, X, Layers, ImageOff, CheckCircle2 } from "lucide-react";
import { Product } from "../types";
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
  /** Show product name faintly over the bottom of the image */
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
        className={`relative flex items-center justify-center overflow-hidden rounded-xl ${className}`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 55% 22%) 0%, hsl(${hue + 30} 45% 12%) 100%)`,
        }}
        aria-label={alt || product.name}
      >
        {/* subtle pattern */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, hsl(${hue} 90% 70%) 0%, transparent 40%), radial-gradient(circle at 80% 70%, hsl(${hue + 60} 90% 70%) 0%, transparent 45%)`,
          }}
        />
        <span className="relative flex select-none flex-col items-center gap-1 text-white/85">
          <span className="text-3xl" aria-hidden="true">{preset.emoji}</span>
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
      className={`relative overflow-hidden rounded-xl bg-slate-800 ${className}`}
    >
      <img
        src={src}
        alt={alt || product.name}
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
      {/* Bottom gradient only — keeps text readable without blurring the whole image */}
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
  addToCart: (product: Product, variant?: Variant) => void;
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
}: PosViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Variant picker
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);
  const [variantQuery, setVariantQuery] = useState("");

  // Toast feedback when item is added to cart
  const [lastAddedToast, setLastAddedToast] = useState<{
    name: string;
    price: number;
    timestamp: number;
  } | null>(null);

  const showAddedToast = useCallback((name: string, price: number) => {
    setLastAddedToast({ name, price, timestamp: Date.now() });
  }, []);

  useEffect(() => {
    if (!lastAddedToast) return;
    const timer = setTimeout(() => {
      setLastAddedToast(null);
    }, 2400);
    return () => clearTimeout(timer);
  }, [lastAddedToast?.timestamp]);

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
        if (Number(variants[0].availableStock ?? variants[0].stock ?? 0) <= 0)
          return;
        addToCart(product, variants[0]);
        showAddedToast(
          `${product.name} ${variants[0].name ? `(${variants[0].name})` : ""}`,
          Number(variants[0].price ?? product.price ?? 0),
        );
        return;
      }
      setVariantPicker(product);
      setVariantQuery("");
    },
    [addToCart, showAddedToast],
  );

  const pickVariant = useCallback(
    (product: Product, variant: Variant) => {
      addToCart(product, variant);
      showAddedToast(
        `${product.name} (${variant.name})`,
        Number(variant.price ?? product.price ?? 0),
      );
      closePicker();
    },
    [addToCart, closePicker, showAddedToast],
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
        if (Number(variantHit.availableStock ?? variantHit.stock ?? 0) > 0) {
          addToCart(product, variantHit);
          showAddedToast(
            `${product.name} (${variantHit.name})`,
            Number(variantHit.price ?? product.price ?? 0),
          );
        }
        setSearchQuery("");
        return;
      }
    }
  };

  /* ----------------------------- render ------------------------- */

  return (
    <div className="relative flex min-w-0 flex-none flex-col overflow-visible p-4 pb-24 lg:flex-1 lg:overflow-y-auto lg:p-6 lg:pb-6">
      {/* Real-time Added-to-Cart Toast */}
      {lastAddedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 text-white shadow-2xl shadow-emerald-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Added to Cart
            </p>
            <p className="max-w-[220px] truncate text-xs font-bold text-slate-100">
              {lastAddedToast.name}
            </p>
          </div>
          <span className="shrink-0 text-xs font-black text-sky-400">
            {lastAddedToast.price.toLocaleString()} MMK
          </span>
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
          const isOutOfStock =
            variantCount > 0 &&
            variants.every(
              (v) => Number(v.availableStock ?? v.stock ?? 0) <= 0,
            );
          const disabled = variantCount === 0 || isOutOfStock;

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
              <div className="relative overflow-hidden">
                <ProductThumb product={product} className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-105" />
                {variantCount > 1 && (
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-violet-300 backdrop-blur-md border border-violet-500/30">
                    <Layers className="h-3 w-3" />
                    {variantCount} options
                  </span>
                )}
                {isOutOfStock ? (
                  <span className="absolute top-2 right-2 rounded-md bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    Out of stock
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
                  className="h-12 w-12 shrink-0"
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
                  Number(variant.availableStock ?? variant.stock) || 0;
                const outOfStock = vStock <= 0;
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
                            outOfStock
                              ? "text-rose-400"
                              : vStock <= 5
                                ? "text-amber-400"
                                : "text-emerald-400"
                          }`}
                        >
                          {outOfStock ? "Out of stock" : `${vStock} in stock`}
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

// import { useEffect, useRef, useState, useMemo, useCallback } from "react";
// import { Search, Plus, Barcode, X, Layers } from "lucide-react";
// import { Product } from "../types";
// import { resolveMediaUrl } from "../services/api";

// /* ------------------------------------------------------------------ */
// /*  Variant helpers                                                    */
// /* ------------------------------------------------------------------ */

// /** Variant shape — edit to match your real `../types` definition. */
// export type Variant = {
//   id: string;
//   name: string;
//   sku?: string;
//   barcode?: string;
//   price?: number;
//   costPrice?: number;
//   stock?: number;
//   availableStock?: number;
// };

// /**
//  * Safe accessor: returns [] if `variants` is missing or not an array.
//  * Keeps this component working even if `Product` isn't fully typed yet.
//  */
// const getVariants = (product: Product): Variant[] => {
//   const value = (product as { variants?: unknown }).variants;
//   return Array.isArray(value) ? (value as Variant[]) : [];
// };

// const variantSubtitle = (variant: Variant) =>
//   [variant.sku, variant.barcode].filter(Boolean).join(" · ");

// interface PosViewProps {
//   searchQuery: string;
//   setSearchQuery: (query: string) => void;
//   selectedCategory: string;
//   setSelectedCategory: (category: string) => void;
//   categories: string[];
//   filteredProducts: Product[];
//   allProducts?: Product[];
//   /**
//    * Optional second argument for variant-aware carts.
//    * Calls with a single argument keep working exactly as before.
//    */
//   addToCart: (product: Product, variant?: Variant) => void;
// }

// export function PosView({
//   searchQuery,
//   setSearchQuery,
//   selectedCategory,
//   setSelectedCategory,
//   categories,
//   filteredProducts,
//   allProducts = [],
//   addToCart,
// }: PosViewProps) {
//   const inputRef = useRef<HTMLInputElement>(null);
//   const [pageSize, setPageSize] = useState<number>(100);
//   const [currentPage, setCurrentPage] = useState<number>(1);

//   // Variant picker state
//   const [variantPicker, setVariantPicker] = useState<Product | null>(null);
//   const [variantQuery, setVariantQuery] = useState("");

//   /* --------------------------- focus / paging ------------------- */

//   useEffect(() => {
//     inputRef.current?.focus();
//   }, []);

//   useEffect(() => {
//     setCurrentPage(1);
//   }, [searchQuery, selectedCategory]);

//   const totalItems = filteredProducts.length;
//   const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
//   const activePage = Math.min(currentPage, totalPages);

//   const paginatedProducts = useMemo(() => {
//     if (pageSize <= 0) return filteredProducts;
//     const start = (activePage - 1) * pageSize;
//     return filteredProducts.slice(start, start + pageSize);
//   }, [filteredProducts, activePage, pageSize]);

//   const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
//   const endItem =
//     pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

//   /* ------------------------- variant picker --------------------- */

//   const pickerVariants = useMemo(
//     () => (variantPicker ? getVariants(variantPicker) : []),
//     [variantPicker],
//   );

//   const filteredVariants = useMemo(() => {
//     const q = variantQuery.trim().toLowerCase();
//     if (!q) return pickerVariants;
//     return pickerVariants.filter((variant) =>
//       [variant.name, variant.sku, variant.barcode]
//         .map((value) => (value || "").toLowerCase())
//         .some((value) => value.includes(q)),
//     );
//   }, [pickerVariants, variantQuery]);

//   const closePicker = useCallback(() => {
//     setVariantPicker(null);
//     setVariantQuery("");
//     // Return focus to the scanner input so the next scan works immediately.
//     requestAnimationFrame(() => inputRef.current?.focus());
//   }, []);

//   // Escape closes the picker
//   useEffect(() => {
//     if (!variantPicker) return;
//     const handler = (event: KeyboardEvent) => {
//       if (event.key === "Escape") closePicker();
//     };
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [variantPicker, closePicker]);

//   /* --------------------------- add-to-cart ---------------------- */

//   /**
//    * Decides what to do when a product is chosen:
//    *  - no variants  → unavailable until a sellable option is configured
//    *  - one variant  → add that variant directly (skip the picker)
//    *  - many variants → open the picker
//    */
//   const handleProductClick = useCallback(
//     (product: Product) => {
//       const variants = getVariants(product);

//       if (variants.length === 0) {
//         return;
//       }
//       if (variants.length === 1) {
//         if (Number(variants[0].availableStock ?? variants[0].stock ?? 0) <= 0)
//           return;
//         addToCart(product, variants[0]);
//         return;
//       }
//       setVariantPicker(product);
//       setVariantQuery("");
//     },
//     [addToCart],
//   );

//   const pickVariant = useCallback(
//     (product: Product, variant: Variant) => {
//       addToCart(product, variant);
//       closePicker();
//     },
//     [addToCart, closePicker],
//   );

//   /* --------------------------- scanner -------------------------- */

//   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
//     if (event.key !== "Enter" || !searchQuery.trim()) return;
//     event.preventDefault();

//     const query = searchQuery.trim().toLowerCase();
//     const list = allProducts.length > 0 ? allProducts : filteredProducts;

//     for (const product of list) {
//       // 1. Exact product match (barcode → SKU → name)
//       const productHit =
//         (product.barcode || "").toLowerCase() === query ||
//         (product.sku || "").toLowerCase() === query ||
//         (product.name || "").toLowerCase() === query;

//       if (productHit) {
//         handleProductClick(product);
//         setSearchQuery("");
//         return;
//       }

//       // 2. Exact variant match (barcode or SKU)
//       const variantHit = getVariants(product).find(
//         (variant) =>
//           (variant.barcode || "").toLowerCase() === query ||
//           (variant.sku || "").toLowerCase() === query,
//       );
//       if (variantHit) {
//         if (Number(variantHit.availableStock ?? variantHit.stock ?? 0) > 0) {
//           addToCart(product, variantHit);
//         }
//         setSearchQuery("");
//         return;
//       }
//     }
//   };

//   /* ----------------------------- render ------------------------- */

//   return (
//     <div className="min-w-0 flex-none flex flex-col overflow-visible p-4 pb-24 lg:flex-1 lg:overflow-y-auto lg:p-6 lg:pb-6">
//       {/* Top bar */}
//       <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
//         <div className="relative w-full sm:w-80 md:w-96">
//           <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//           <input
//             ref={inputRef}
//             type="text"
//             placeholder="Scan barcode (Enter) or search product..."
//             value={searchQuery}
//             onChange={(event) => setSearchQuery(event.target.value)}
//             onKeyDown={handleKeyDown}
//             className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
//           />
//           <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 flex items-center gap-1">
//             <Barcode className="w-4 h-4 text-sky-400" />
//           </div>
//         </div>

//         <div className="flex items-center gap-3 w-full sm:flex-1 sm:min-w-0">
//           <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
//             {categories.map((category) => (
//               <button
//                 key={category}
//                 type="button"
//                 onClick={() => setSelectedCategory(category)}
//                 className={`px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
//                   selectedCategory === category
//                     ? "bg-slate-800 text-sky-400 border border-sky-500/40"
//                     : "bg-slate-900/60 text-slate-400 border border-slate-800/60 hover:bg-slate-800"
//                 }`}
//               >
//                 {category}
//               </button>
//             ))}
//           </div>

//           <label className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
//             Grid:
//             <select
//               value={pageSize}
//               onChange={(event) => {
//                 setPageSize(Number(event.target.value));
//                 setCurrentPage(1);
//               }}
//               className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500"
//             >
//               <option value={100}>100</option>
//               <option value={250}>250</option>
//               <option value={500}>500</option>
//               <option value={0}>All ({totalItems})</option>
//             </select>
//           </label>
//         </div>
//       </div>

//       {/* Product grid */}
//       {/* အပေါ်က Comment ဖြုတ်ပြီး ဒီလိုပြင်ပါ */}
//       <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3.5 lg:gap-4 flex-1 content-start">
//         {/* <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 lg:gap-4 flex-1"> */}
//         {paginatedProducts.map((product) => {
//           const variants = getVariants(product);
//           const variantCount = variants.length;
//           const isOutOfStock =
//             variantCount > 0 &&
//             variants.every(
//               (variant) =>
//                 Number(variant.availableStock ?? variant.stock ?? 0) <= 0,
//             );

//           return (
//             <div
//               key={product.id}
//               onClick={() =>
//                 variants.length > 0 &&
//                 !isOutOfStock &&
//                 handleProductClick(product)
//               }
//               className={`group bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 ${variantCount === 0 ? "opacity-50" : isOutOfStock ? "opacity-60" : "hover:bg-slate-900 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/5"} ${variantCount > 0 && !isOutOfStock ? "cursor-pointer active:scale-[0.98]" : ""}`}
//             >
//               {(product.imageUrl || product.image) && (
//                 <img
//                   src={resolveMediaUrl(product.imageUrl || product.image)}
//                   alt=""
//                   loading="lazy"
//                   className="mb-3 aspect-4/3 w-full rounded-xl bg-slate-800 object-cover"
//                 />
//               )}
//               <div>
//                 <div className="flex justify-between items-start gap-2 mb-2">
//                   <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 truncate max-w-[60%]">
//                     {product.category || "Uncategorised"}
//                   </span>

//                   {isOutOfStock ? (
//                     <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
//                       Out of stock
//                     </span>
//                   ) : variantCount > 0 ? (
//                     <span className="flex items-center gap-1 text-[10px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full shrink-0">
//                       <Layers className="w-3 h-3" />
//                       {variantCount}
//                     </span>
//                   ) : (
//                     <span className="text-[10px] font-medium text-slate-500 shrink-0">
//                       No sellable options
//                     </span>
//                   )}
//                 </div>

//                 <h3 className="font-bold text-slate-100 text-sm mb-1 group-hover:text-sky-300 transition-colors line-clamp-2">
//                   {product.name || "Unnamed Product"}
//                 </h3>

//                 <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
//                   <span className="truncate">SKU: {product.sku || "—"}</span>
//                   {product.barcode && (
//                     <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
//                       {product.barcode}
//                     </span>
//                   )}
//                 </div>

//                 {variantCount > 0 && (
//                   <p className="mt-1.5 text-[10px] font-medium text-slate-500">
//                     {variantCount} sellable option
//                     {variantCount === 1 ? "" : "s"}
//                   </p>
//                 )}
//               </div>

//               <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800/50">
//                 <span className="font-black text-white text-base">
//                   {(Number(product.price) || 0).toLocaleString()}{" "}
//                   <span className="text-xs text-slate-400 font-normal">
//                     MMK
//                   </span>
//                 </span>
//                 <button
//                   type="button"
//                   aria-label={`Add ${product.name} to cart`}
//                   disabled={isOutOfStock || variantCount === 0}
//                   className="w-8 h-8 rounded-xl bg-slate-800 group-hover:bg-sky-500 text-slate-300 group-hover:text-white flex items-center justify-center transition-all disabled:cursor-not-allowed disabled:opacity-40"
//                 >
//                   <Plus className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       {paginatedProducts.length === 0 && (
//         <div className="py-16 text-center text-sm text-slate-400">
//           No matching products found.
//         </div>
//       )}

//       {/* Pagination */}
//       {totalItems > 0 && (
//         <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/60 text-xs">
//           <p className="text-slate-400">
//             Showing{" "}
//             <strong className="text-white">{startItem.toLocaleString()}</strong>
//             –<strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
//             of{" "}
//             <strong className="text-white">
//               {totalItems.toLocaleString()}
//             </strong>{" "}
//             items
//           </p>

//           {pageSize > 0 && totalPages > 1 && (
//             <div className="flex items-center gap-2">
//               <button
//                 type="button"
//                 onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
//                 disabled={activePage <= 1}
//                 className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
//               >
//                 ← Prev
//               </button>
//               <span className="text-slate-400">
//                 Page <strong className="text-white">{activePage}</strong> /{" "}
//                 {totalPages}
//               </span>
//               <button
//                 type="button"
//                 onClick={() =>
//                   setCurrentPage((page) => Math.min(totalPages, page + 1))
//                 }
//                 disabled={activePage >= totalPages}
//                 className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
//               >
//                 Next →
//               </button>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ---------------------- Variant picker -------------------- */}
//       {variantPicker && (
//         <div
//           className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
//           onClick={closePicker}
//           role="presentation"
//         >
//           <div
//             role="dialog"
//             aria-modal="true"
//             aria-label={`Choose a variant of ${variantPicker.name}`}
//             onClick={(event) => event.stopPropagation()}
//             className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
//           >
//             {/* Header */}
//             <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
//               <div className="min-w-0">
//                 <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
//                   Choose a variant
//                 </p>
//                 <h3 className="mt-1 truncate text-lg font-black text-white">
//                   {variantPicker.name}
//                 </h3>
//                 <p className="mt-0.5 text-xs text-slate-400">
//                   {pickerVariants.length} variants available
//                 </p>
//               </div>
//               <button
//                 type="button"
//                 onClick={closePicker}
//                 aria-label="Close variant picker"
//                 className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
//               >
//                 <X className="h-4 w-4" />
//               </button>
//             </div>

//             {/* Search (only when many variants) */}
//             {pickerVariants.length > 6 && (
//               <div className="border-b border-slate-800 p-3">
//                 <div className="relative">
//                   <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
//                   <input
//                     autoFocus
//                     type="text"
//                     value={variantQuery}
//                     onChange={(event) => setVariantQuery(event.target.value)}
//                     placeholder="Filter variants…"
//                     className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
//                   />
//                 </div>
//               </div>
//             )}

//             {/* Variant list */}
//             <ul className="flex-1 overflow-y-auto p-2">
//               {filteredVariants.map((variant) => {
//                 const vStock =
//                   Number(variant.availableStock ?? variant.stock) || 0;
//                 const outOfStock = vStock <= 0;
//                 const price = Number(variant.price ?? variantPicker.price) || 0;
//                 const subtitle = variantSubtitle(variant);

//                 return (
//                   <li key={variant.id}>
//                     <button
//                       type="button"
//                       disabled={outOfStock}
//                       onClick={() => pickVariant(variantPicker, variant)}
//                       className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
//                     >
//                       <div className="min-w-0">
//                         <p className="truncate text-sm font-semibold text-slate-100">
//                           {variant.name}
//                         </p>
//                         {subtitle && (
//                           <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
//                             {subtitle}
//                           </p>
//                         )}
//                         <p
//                           className={`mt-1 text-[11px] font-medium ${
//                             outOfStock
//                               ? "text-rose-400"
//                               : vStock <= 5
//                                 ? "text-amber-400"
//                                 : "text-emerald-400"
//                           }`}
//                         >
//                           {outOfStock ? "Out of stock" : `${vStock} in stock`}
//                         </p>
//                       </div>
//                       <div className="shrink-0 text-right">
//                         <p className="text-sm font-bold text-white">
//                           {price.toLocaleString()}
//                         </p>
//                         <p className="text-[10px] text-slate-500">MMK</p>
//                       </div>
//                     </button>
//                   </li>
//                 );
//               })}

//               {filteredVariants.length === 0 && (
//                 <li className="p-6 text-center text-xs text-slate-400">
//                   No variants match "{variantQuery}".
//                 </li>
//               )}
//             </ul>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
