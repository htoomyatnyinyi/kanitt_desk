import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Product } from "../types";

interface InventoryViewProps {
  products: Product[];
  isLoading?: boolean;
}

export function InventoryView({ products, isLoading = false }: InventoryViewProps) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.barcode, product.category]
        .map((val) => (val || "").toString().toLowerCase())
        .some((value) => value.includes(normalized))
    );
  }, [products, query]);

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

  return (
    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">Products & Stock</h2>
          <p className="text-xs text-slate-400 mt-1">
            {products.length.toLocaleString()} total products loaded from the selected store
          </p>
        </div>
      </div>

      {/* Search & Pagination Settings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Per page:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
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

      {/* Product Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left bg-slate-950/50">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Product</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Price</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Stock</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product) => (
              <tr
                key={product.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-100 block">{product.name}</span>
                    {(product.genericName || product.activeIngredient || product.strength || product.dosageForm) && (
                      <span className="block truncate text-[11px] font-medium text-emerald-400/90 mt-0.5">
                        {[product.genericName, product.activeIngredient, product.strength, product.dosageForm].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-400">{product.sku}</td>
                <td className="px-5 py-3">
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                    {product.category}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-white">
                  {(Number(product.price) || 0).toLocaleString()}{" "}
                  <span className="text-slate-500 font-normal text-xs">MMK</span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-white">
                  {(Number(product.stock) || 0).toLocaleString()}
                  {product.inventories?.some((inventory) => inventory.lot) && (
                    <div className="mt-1 space-y-1 text-[10px] font-medium text-slate-400">
                      {product.inventories
                        .filter((inventory) => inventory.lot)
                        .map((inventory, index) => (
                          <div key={`${inventory.lot?.number}-${index}`}>
                            Lot {inventory.lot?.number} · {Number(inventory.quantity) || 0} {inventory.lot?.expiryDate ? `· Exp ${new Date(inventory.lot.expiryDate).toLocaleDateString()}` : ""}
                          </div>
                        ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      (Number(product.stock) || 0) > 20
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : (Number(product.stock) || 0) > 5
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {(Number(product.stock) || 0) > 20 ? "In Stock" : (Number(product.stock) || 0) > 5 ? "Low" : "Critical"}
                  </span>
                </td>
              </tr>
            ))}
            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                  {isLoading ? "Loading products..." : query ? `No products matching "${query}".` : "No products found in this store."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      {totalItems > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
          <p className="text-xs text-slate-400">
            Showing <strong className="text-white">{startItem.toLocaleString()}</strong> to{" "}
            <strong className="text-white">{endItem.toLocaleString()}</strong> of{" "}
            <strong className="text-white">{totalItems.toLocaleString()}</strong> items
          </p>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="text-xs text-slate-400 px-2">
                Page <strong className="text-white">{activePage}</strong> of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={activePage >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
