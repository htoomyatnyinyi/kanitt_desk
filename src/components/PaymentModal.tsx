import { X, CheckCircle2, Loader2, AlertCircle, Banknote, CreditCard, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

interface PaymentModalProps {
  paymentModalOpen: boolean;
  setPaymentModalOpen: (open: boolean) => void;
  total: number;
  receivedAmount: string;
  setReceivedAmount: (amount: string) => void;
  changeAmount: number;
  handleCheckoutSuccess: (
    payments?: { method: string; amount: number }[],
  ) => void;
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
}

export function PaymentModal({
  paymentModalOpen,
  setPaymentModalOpen,
  total,
  receivedAmount,
  setReceivedAmount,
  changeAmount,
  handleCheckoutSuccess,
  isLoading,
  error,
  onDismissError,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "KBZ_PAY" | "WAVE_PAY" | "CARD">("CASH");

  // Reset received amount and method whenever the modal opens or total changes
  useEffect(() => {
    if (paymentModalOpen) {
      setPaymentMethod("CASH");
      setReceivedAmount(String(total));
    }
  }, [paymentModalOpen, total, setReceivedAmount]);

  if (!paymentModalOpen) return null;

  const received = Number(receivedAmount) || 0;
  const isCash = paymentMethod === "CASH";
  const canComplete = isCash ? (received >= total && !isLoading) : !isLoading;

  // Calculate smart cash denominations (rounded up to nearest 1,000 / 5,000 / 10,000 / 50,000)
  const quickCashOptions = [
    total,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
  ].filter((val, idx, self) => val >= total && self.indexOf(val) === idx);

  // If there are fewer than 4 unique suggestions, add common denominations
  if (quickCashOptions.length < 4) {
    for (const common of [10000, 20000, 50000, 100000]) {
      if (common > total && !quickCashOptions.includes(common)) {
        quickCashOptions.push(common);
      }
    }
  }

  const handleComplete = () => {
    if (!canComplete) return;
    const finalMethod = paymentMethod;
    handleCheckoutSuccess([{ method: finalMethod, amount: total }]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) setPaymentModalOpen(false);
      }}
    >
      <div className="flex max-h-[96dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-slate-700/80 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment Checkout</h3>
              <p className="text-xs text-slate-400">Select method and complete sale</p>
            </div>
          </div>
          <button
            onClick={() => !isLoading && setPaymentModalOpen(false)}
            disabled={isLoading}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={onDismissError}
                className="text-rose-200 hover:text-white font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Total Payable Card */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900/90 p-4 text-center shadow-inner">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Amount to Pay
            </span>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">
                {total.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-sky-400">MMK</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "CASH", label: "Cash", icon: Banknote },
                { id: "KBZ_PAY", label: "KPay", icon: QrCode },
                { id: "WAVE_PAY", label: "WavePay", icon: QrCode },
                { id: "CARD", label: "Card", icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id as any);
                      if (m.id !== "CASH") setReceivedAmount(String(total));
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                      active
                        ? "border-sky-500 bg-sky-500/15 text-sky-200 shadow-md shadow-sky-500/10"
                        : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-sky-400" : "text-slate-400"}`} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Payment Section */}
          {isCash ? (
            <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-3.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Received Cash (MMK)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canComplete) {
                      e.preventDefault();
                      handleComplete();
                    }
                  }}
                  placeholder="0"
                  min={total}
                  step="1"
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xl font-black text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
                <button
                  type="button"
                  onClick={() => setReceivedAmount(String(total))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-sky-400 hover:bg-slate-700"
                >
                  Exact
                </button>
              </div>

              {/* Quick Cash Buttons */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Quick Cash / Exact Amounts:
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {quickCashOptions.slice(0, 4).map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReceivedAmount(String(amt))}
                      className="rounded-lg border border-slate-800 bg-slate-900/90 py-2 text-xs font-bold text-slate-200 hover:border-sky-400/50 hover:bg-slate-800 active:scale-95 transition-all"
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change calculation */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold">
                <span className="text-slate-400 text-xs">Change Due:</span>
                <span
                  className={
                    changeAmount < 0
                      ? "font-bold text-rose-400"
                      : "font-black text-emerald-400 text-base"
                  }
                >
                  {changeAmount < 0 ? "Underpaid" : `${changeAmount.toLocaleString()} MMK`}
                </span>
              </div>

              {received > 0 && received < total && (
                <p className="text-xs text-rose-400 font-medium">
                  Received cash is { (total - received).toLocaleString() } MMK short.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center space-y-1.5">
              <QrCode className="h-8 w-8 mx-auto text-sky-400" />
              <p className="text-xs font-bold text-slate-200">
                Customer transfers {total.toLocaleString()} MMK via {paymentMethod.replace(/_/g, " ")}.
              </p>
              <p className="text-[11px] text-slate-500">
                Verify receipt on the shop terminal before clicking Complete.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-4 font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] text-sm tracking-wide"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
            )}
            <span>{isLoading ? "Finalising sale…" : `Complete Order · ${total.toLocaleString()} MMK`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
