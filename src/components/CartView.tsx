import { useState } from "react";
import { BadgePercent, CreditCard, Plus, Minus, Trash2, Receipt } from "lucide-react";
import { CartItem } from "../types";

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
}: CartViewProps) {
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const cartPanel = (
    <div className="flex h-full w-full flex-col justify-between bg-slate-900 p-4 lg:p-5">
      <div className="min-h-0 flex-1">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-slate-100 text-lg">Current Order</h2>
          </div>
          <div className="flex items-center gap-3">
            {mobileCartOpen && <button type="button" onClick={() => setMobileCartOpen(false)} className="text-xs font-semibold text-slate-300 lg:hidden">Close</button>}
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="text-xs text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ShoppingBagIcon className="w-12 h-12 mx-auto opacity-20" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs opacity-70">
                Scan barcode or tap items to add
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-semibold text-xs text-slate-200 truncate">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-sky-400 font-bold mt-0.5">
                    {item.price.toLocaleString()} MMK
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Checkout Calculation Footer */}
      <div className="shrink-0 pt-4 border-t border-slate-800 space-y-3 bg-slate-900">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-200">
              {subtotal.toLocaleString()} MMK
            </span>
          </div>
          {discount > 0 && <div className="flex justify-between text-emerald-300"><span>Promotion {promotionCode ? `· ${promotionCode}` : ""}</span><span className="font-semibold">−{discount.toLocaleString()} MMK</span></div>}
          <div className="flex justify-between text-slate-400">
            <span>Configured tax</span>
            <span className="font-semibold text-slate-200">
              {tax.toLocaleString()} MMK
            </span>
          </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="flex items-center gap-2"><BadgePercent className="h-4 w-4 shrink-0 text-violet-300" /><input value={promotionInput} onChange={(event) => setPromotionInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyPromotion(); } }} placeholder="Promotion code" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /><button onClick={applyPromotion} disabled={pricingLoading || cart.length === 0} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-violet-300/40 hover:text-white disabled:opacity-40">{pricingLoading ? "Checking…" : promotionCode ? "Update" : "Apply"}</button></div>
          {pricingError ? <p className="mt-2 text-[10px] leading-4 text-rose-300">{pricingError}</p> : promotionCode ? <p className="mt-2 text-[10px] text-emerald-300">{promotionCode} will be revalidated at checkout.</p> : null}
        </div>
          <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800/80">
            <span>Total Payable</span>
            <span className="text-sky-400 font-black text-lg">
              {total.toLocaleString()} MMK
            </span>
          </div>
        </div>

        <button
          disabled={cart.length === 0 || pricingLoading || Boolean(pricingError)}
          onClick={() => setPaymentModalOpen(true)}
          className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <CreditCard className="w-5 h-5" />
          <span>Pay Now ({total.toLocaleString()} MMK)</span>
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
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-slate-700 bg-slate-900 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-left shadow-[0_-10px_30px_rgba(0,0,0,0.35)]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Receipt className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-sm font-bold text-white">View cart · {cart.length} {cart.length === 1 ? "item" : "items"}</span><span className="block text-xs text-slate-400">{total.toLocaleString()} MMK</span></span>
          </span>
          <span className="ml-3 shrink-0 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white">Checkout</span>
        </button>
        {mobileCartOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/70"
            onClick={(event) => { if (event.target === event.currentTarget) setMobileCartOpen(false); }}
          >
            <section role="dialog" aria-modal="true" aria-label="Shopping cart" className="h-[88dvh] w-full overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 pb-[env(safe-area-inset-bottom)] shadow-2xl">
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
