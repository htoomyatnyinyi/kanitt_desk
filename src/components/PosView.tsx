import { Search, Plus } from "lucide-react";
import { Product } from "../types";

interface PosViewProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[];
  filteredProducts: Product[];
  addToCart: (product: Product) => void;
}

export function PosView({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  filteredProducts,
  addToCart,
}: PosViewProps) {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      {/* Top Bar Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Scan barcode or search product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? "bg-slate-800 text-sky-400 border border-sky-500/40"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800/60 hover:bg-slate-800"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
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
              <p className="text-xs text-slate-400 font-mono">SKU: {product.sku}</p>
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
    </div>
  );
}
