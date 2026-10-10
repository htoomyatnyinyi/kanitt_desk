import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Product } from "../types";

interface InventoryViewProps {
  products: Product[];
}

export function InventoryView({ products }: InventoryViewProps) {
  const [query, setQuery] = useState("");
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) => [product.name, product.sku, product.barcode].some((value) => value.toLowerCase().includes(normalized)));
  }, [products, query]);
  return (
    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">Products & Stock</h2>
          <p className="text-xs text-slate-400 mt-1">
            {products.length} products loaded from the selected store
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, SKU, barcode..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Product Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Product</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Price</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Stock</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => (
              <tr
                key={product.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3">
                  <span className="font-semibold text-slate-100">{product.name}</span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-400">{product.sku}</td>
                <td className="px-5 py-3">
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                    {product.category}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-white">
                  {product.price.toLocaleString()}{" "}
                  <span className="text-slate-500 font-normal text-xs">MMK</span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-white">
                  {product.stock}
                  {product.inventories?.some((inventory) => inventory.lot) && <div className="mt-1 space-y-1 text-[10px] font-medium text-slate-400">
                    {product.inventories.filter((inventory) => inventory.lot).map((inventory, index) => <div key={`${inventory.lot?.number}-${index}`}>Lot {inventory.lot?.number} · {inventory.quantity} {inventory.lot?.expiryDate ? `· Exp ${new Date(inventory.lot.expiryDate).toLocaleDateString()}` : ""}</div>)}
                  </div>}
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      product.stock > 20
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : product.stock > 5
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {product.stock > 20 ? "In Stock" : product.stock > 5 ? "Low" : "Critical"}
                  </span>
                </td>
              </tr>
            ))}
            {visibleProducts.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No matching products found.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
