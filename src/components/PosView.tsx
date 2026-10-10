import { useEffect, useRef } from "react";
import { Search, Plus, Barcode } from "lucide-react";
import { Product } from "../types";

interface PosViewProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[];
  filteredProducts: Product[];
  allProducts?: Product[];
  addToCart: (product: Product) => void;
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

  // Auto-focus search / barcode input on component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset pagination on search query or category change
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
  const endItem = pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

  // Handle Enter key on barcode scanner input for instant add-to-cart
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      const query = searchQuery.trim().toLowerCase();
      const productList = allProducts.length > 0 ? allProducts : filteredProducts;

      // Match exact barcode first, then fallback to exact SKU or name match
      const matched = productList.find(
        (p) =>
          (p.barcode || "").toLowerCase() === query ||
          (p.sku || "").toLowerCase() === query ||
          (p.name || "").toLowerCase() === query
      );

      if (matched) {
        addToCart(matched);
        setSearchQuery("");
      }
    }
  };

  return (
    <div className="min-w-0 flex-none flex flex-col overflow-visible p-4 pb-24 lg:flex-1 lg:overflow-y-auto lg:p-6 lg:pb-6">
      {/* Top Bar Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan barcode (Enter) or search product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 flex items-center gap-1">
            <Barcode className="w-4 h-4 text-sky-400" />
          </div>
        </div>

        {/* Category Pills & Per Page selector */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? "bg-slate-800 text-sky-400 border border-sky-500/40"
                    : "bg-slate-900/60 text-slate-400 border border-slate-800/60 hover:bg-slate-800"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="text-xs text-slate-400 flex items-center gap-1.5 ml-auto">
            Grid:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </label>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 lg:gap-4 flex-1">
        {paginatedProducts.map((product) => (
          <div
            key={product.id}
            onClick={() => addToCart(product)}
            className="group bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-sky-500/50 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-sky-500/5 active:scale-98"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  {product.category}
                </span>
                <span className="text-[10px] font-medium text-slate-500">Stock: {product.stock}</span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm mb-1 group-hover:text-sky-300 transition-colors line-clamp-2">
                {product.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>SKU: {product.sku}</span>
                {product.barcode && (
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                    {product.barcode}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800/50">
              <span className="font-black text-white text-base">
                {product.price.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MMK</span>
              </span>
              <button className="w-8 h-8 rounded-xl bg-slate-800 group-hover:bg-sky-500 text-slate-300 group-hover:text-white flex items-center justify-center transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {paginatedProducts.length === 0 && (
        <div className="py-16 text-center text-sm text-slate-400">
          No matching products found.
        </div>
      )}

      {/* POS Pagination Footer */}
      {totalItems > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/60 text-xs">
          <p className="text-slate-400">
            Showing <strong className="text-white">{startItem.toLocaleString()}</strong>–
            <strong className="text-white">{endItem.toLocaleString()}</strong> of{" "}
            <strong className="text-white">{totalItems.toLocaleString()}</strong> items
          </p>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-slate-400">
                Page <strong className="text-white">{activePage}</strong> / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={activePage >= totalPages}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
