import { useState } from "react";
import {
  BadgePercent,
  CreditCard,
  Plus,
  Minus,
  Trash2,
  Receipt,
} from "lucide-react";
import { CartItem } from "../types";
import { useSystemBack } from "../hooks/SystemBackProvider";

interface CartViewProps {
  cart: CartItem[];
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  setCart: (cart: CartItem[]) => void;
  subtotal: number;
  tax: number;
  total: number;
  setPaymentModalOpen: (open: boolean) => void;
  discount: number;
  promotionCode: string;
  promotionInput: string;
  setPromotionInput: (value: string) => void;
  applyPromotion: () => void;
  pricingLoading: boolean;
  pricingError: string | null;
  mobileCartOpen?: boolean;
  setMobileCartOpen?: (open: boolean) => void;
}

export function CartView({
  cart,
  updateQuantity,
  removeFromCart,
  setCart,
  subtotal,
  tax,
  total,
  setPaymentModalOpen,
  discount,
  promotionCode,
  promotionInput,
  setPromotionInput,
  applyPromotion,
  pricingLoading,
  pricingError,
  mobileCartOpen: controlledMobileOpen,
  setMobileCartOpen: controlledSetMobileOpen,
}: CartViewProps) {
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileCartOpen = controlledMobileOpen ?? internalMobileOpen;
  const setMobileCartOpen = controlledSetMobileOpen ?? setInternalMobileOpen;

  useSystemBack(mobileCartOpen, () => setMobileCartOpen(false), 10);
  const cartPanel = (
    <div className="flex h-full w-full flex-col justify-between bg-slate-900/95 backdrop-blur-xl p-4 lg:p-5 border-l border-slate-800/80 shadow-2xl">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm tracking-wide">Current Order</h2>
              <p className="text-[10px] font-semibold text-slate-400">
                {cart.length} {cart.length === 1 ? "line item" : "line items"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mobileCartOpen && (
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white lg:hidden"
              >
                Close
              </button>
            )}
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                title="Clear all items in cart"
              >
                Clear Cart
              </button>
            )}
          </div>
        </div>

        {/* Cart Item List */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-slate-500 space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/40 border border-slate-700/30 text-slate-600">
                <ShoppingBagIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-300">Cart is empty</p>
                <p className="text-xs text-slate-500 max-w-[200px]">
                  Click products from the grid or scan a barcode to add.
                </p>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="group relative bg-slate-950/80 hover:bg-slate-950 border border-slate-800/70 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-2.5 transition-all shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-100 truncate group-hover:text-sky-300 transition-colors">
                    {item.name}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="font-extrabold text-sky-400">
                      {(item.price * item.quantity).toLocaleString()}{" "}
                      <span className="text-[9px] font-normal text-slate-400">MMK</span>
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        ({item.price.toLocaleString()} × {item.quantity})
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 shadow-inner">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-black text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Checkout Calculation Footer */}
      <div className="shrink-0 pt-3.5 border-t border-slate-800 space-y-3 bg-slate-900/90">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400 font-medium">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-200">
              {subtotal.toLocaleString()} MMK
            </span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-400 font-medium">
              <span>Promotion {promotionCode ? `(${promotionCode})` : ""}</span>
              <span className="font-bold">
                −{discount.toLocaleString()} MMK
              </span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-slate-400 font-medium">
              <span>Tax</span>
              <span className="font-semibold text-slate-200">
                {tax.toLocaleString()} MMK
              </span>
            </div>
          )}

          {/* Promotion Code Input */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-2 focus-within:border-violet-500/60 transition-colors">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-4 w-4 shrink-0 text-violet-400" />
              <input
                value={promotionInput}
                onChange={(event) => setPromotionInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyPromotion();
                  }
                }}
                placeholder="Promo code (optional)"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
              />
              <button
                onClick={applyPromotion}
                disabled={pricingLoading || cart.length === 0}
                className="rounded-lg bg-slate-800 hover:bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-slate-200 hover:text-white disabled:opacity-40 transition-colors"
              >
                {pricingLoading
                  ? "Checking…"
                  : promotionCode
                    ? "Update"
                    : "Apply"}
              </button>
            </div>
            {pricingError ? (
              <p className="mt-1.5 text-[10px] leading-4 text-rose-300 font-medium">
                {pricingError}
              </p>
            ) : promotionCode ? (
              <p className="mt-1.5 text-[10px] text-emerald-400 font-medium">
                {promotionCode} applied successfully.
              </p>
            ) : null}
          </div>

          {/* Total Payable */}
          <div className="flex items-baseline justify-between pt-2.5 border-t border-slate-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Total Payable
              </span>
              <span className="text-[10px] text-slate-500">Shortcut: Press [F2]</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-sky-400 tracking-tight">
                {total.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-400 ml-1">MMK</span>
            </div>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          disabled={
            cart.length === 0 || pricingLoading || Boolean(pricingError)
          }
          onClick={() => {
            setMobileCartOpen(false);
            setPaymentModalOpen(true);
          }}
          className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-black py-3.5 rounded-xl shadow-lg shadow-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] text-sm tracking-wide"
        >
          <CreditCard className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          <span>Proceed to Checkout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full w-80 shrink-0 border-l border-slate-800 bg-slate-900 lg:block xl:w-96">
        {cartPanel}
      </aside>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="fixed inset-x-0 bottom-15 z-40 flex items-center justify-between border-t border-slate-700 bg-slate-900 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-left shadow-[0_-10px_30px_rgba(0,0,0,0.35)]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
              <Receipt className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">
                View cart · {cart.length} {cart.length === 1 ? "item" : "items"}
              </span>
              <span className="block text-xs text-slate-400">
                {total.toLocaleString()} MMK
              </span>
            </span>
          </span>
          <span className="ml-3 shrink-0 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white">
            Checkout
          </span>
        </button>
        {mobileCartOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/70"
            onClick={(event) => {
              if (event.target === event.currentTarget)
                setMobileCartOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Shopping cart"
              className="h-[88dvh] w-full overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 pb-[env(safe-area-inset-bottom)] shadow-2xl"
            >
              {cartPanel}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function ShoppingBagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
      />
    </svg>
  );
}
