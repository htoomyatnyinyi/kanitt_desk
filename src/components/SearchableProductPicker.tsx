import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, PackageSearch, Search } from "lucide-react";
import { Product } from "../types";

interface Props {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  label?: string;
  placeholder?: string;
}

export function SearchableProductPicker({
  products,
  value,
  onChange,
  label = "Product",
  placeholder = "Search name, SKU or barcode…",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const selected = products.find((product) => product.id === value);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized
      ? products.filter((product) => {
          const searchable = [
            product.name,
            product.sku,
            product.barcode,
            product.category,
            product.genericName,
            product.activeIngredient,
            ...(product.variants ?? []).flatMap((variant) => [variant.name, variant.sku, variant.barcode]),
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();
          return searchable.includes(normalized);
        })
      : products;
    const sorted = normalized
      ? [...matches].sort((a, b) => {
          const exact = (product: Product) =>
            [product.name, product.sku, product.barcode, ...(product.variants ?? []).flatMap((variant) => [variant.sku, variant.barcode])]
              .some((value) => value?.toLocaleLowerCase() === normalized);
          return Number(exact(b)) - Number(exact(a));
        })
      : matches;
    return { items: sorted.slice(0, 40), total: matches.length };
  }, [products, query]);

  const updatePosition = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = Math.max(0, window.innerHeight - rect.bottom - 12);
    const above = Math.max(0, rect.top - 12);
    const openAbove = below < 220 && above > below;
    const maxHeight = Math.max(80, Math.min(320, openAbove ? above : below));
    const top = openAbove ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6;
    setPosition({ top, left: rect.left, width: rect.width, maxHeight });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const choose = (product: Product) => {
    onChange(product.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs text-slate-400">
        {label}
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            value={open ? query : selected ? `${selected.name} · ${selected.sku}` : query}
            onFocus={() => {
              setQuery("");
              updatePosition();
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              updatePosition();
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && open && results.items[0]) {
                event.preventDefault();
                choose(results.items[0]);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </label>

      {open && position && createPortal(
        <div ref={listRef} role="listbox" style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }} className="fixed z-[9999] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl shadow-black/40">
          {results.items.length ? (
            <>
              {results.items.map((product) => {
                const variants = product.variants ?? [];
                const onHand = variants.reduce(
                  (sum, variant) => sum + Number(variant.stock ?? 0),
                  0,
                );
                const available = variants.reduce(
                  (sum, variant) => sum + Number(variant.availableStock ?? variant.stock ?? 0),
                  0,
                );
                const isSelected = product.id === value;
                return (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(product)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${isSelected ? "bg-sky-500/10" : "hover:bg-white/5"}`}
                  >
                    <PackageSearch className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{product.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-bold text-slate-300">{available.toLocaleString()} available</span>
                      <span className="block text-[10px] text-slate-500">{variants.length} {variants.length === 1 ? "option" : "options"} · {onHand.toLocaleString()} on hand</span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-300" />}
                  </button>
                );
              })}
              {results.total > results.items.length && (
                <p className="px-3 py-2 text-[10px] text-slate-500">Showing 40 of {results.total}. Add more letters or a SKU to narrow the list.</p>
              )}
            </>
          ) : (
            <p className="px-3 py-8 text-center text-xs text-slate-500">No matching products. Check the name, SKU, or barcode.</p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
