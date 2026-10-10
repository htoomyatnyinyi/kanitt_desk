import { X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface PaymentModalProps {
  paymentModalOpen: boolean;
  setPaymentModalOpen: (open: boolean) => void;
  total: number;
  paymentMethod: "cash" | "kpay" | "wave" | "card";
  setPaymentMethod: (method: "cash" | "kpay" | "wave" | "card") => void;
  receivedAmount: string;
  setReceivedAmount: (amount: string) => void;
  changeAmount: number;
  handleCheckoutSuccess: (payments?: { method: string; amount: number }[]) => void;
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
}

export function PaymentModal({
  paymentModalOpen,
  setPaymentModalOpen,
  total,
  paymentMethod,
  setPaymentMethod,
  receivedAmount,
  setReceivedAmount,
  changeAmount,
  handleCheckoutSuccess,
  isLoading,
  error,
  onDismissError,
}: PaymentModalProps) {
  const [split, setSplit] = useState(false);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState("");
  const [secondMethod, setSecondMethod] = useState<"cash" | "kpay" | "wave" | "card">("wave");
  useEffect(() => setFirstPaymentAmount(String(Math.floor(total / 2))), [total]);
  const firstAmount = Number(firstPaymentAmount) || 0;
  const remainingAmount = Math.max(0, total - firstAmount);
  const toPaymentMethod = (method: string) => ({ cash: "CASH", kpay: "KBZ_PAY", wave: "WAVE_PAY", card: "CARD" })[method] || "CASH";
  useEffect(() => {
    if (secondMethod === paymentMethod) setSecondMethod((["cash", "kpay", "wave", "card"] as const).find((method) => method !== paymentMethod) || "wave");
  }, [paymentMethod, secondMethod]);
  if (!paymentModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl text-white">Payment Checkout</h3>
          <button
            onClick={() => setPaymentModalOpen(false)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {error && <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span><button type="button" onClick={onDismissError} className="ml-auto text-rose-200">×</button></div>}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Payable</span>
            <h2 className="text-3xl font-black text-sky-400 mt-1">{total.toLocaleString()} MMK</h2>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={split} onChange={(event) => setSplit(event.target.checked)} className="accent-sky-500" />
            Split payment across two methods
          </label>
          {split && <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <label className="text-xs text-slate-400">First amount (MMK)
              <input type="number" min="0.01" max={total} step="0.01" value={firstPaymentAmount} onChange={(event) => setFirstPaymentAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
              <span className="mt-1 block text-[10px]">{paymentMethod.toUpperCase()}</span>
            </label>
            <label className="text-xs text-slate-400">Remaining ({remainingAmount.toLocaleString()} MMK)
              <select value={secondMethod} onChange={(event) => setSecondMethod(event.target.value as typeof secondMethod)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                {(["cash", "kpay", "wave", "card"] as const).filter((method) => method !== paymentMethod).map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
              </select>
              <span className="mt-1 block text-[10px]">Applied automatically</span>
            </label>
          </div>}

          {/* Payment Methods */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Select Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["cash", "kpay", "wave", "card"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-xl font-bold text-xs uppercase border flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === method
                      ? "bg-sky-500/20 border-sky-500 text-sky-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Cash tendered input */}
          {paymentMethod === "cash" && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Received Amount (MMK)
              </label>
              <input
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                placeholder="Enter cash received..."
                min={total}
                step="1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-sky-500"
              />
              {Number(receivedAmount) > 0 && (
                <div className="flex justify-between items-center mt-2 px-1 text-sm font-semibold">
                  <span className="text-slate-400">Change Due:</span>
                  <span className="text-emerald-400 font-bold">{changeAmount.toLocaleString()} MMK</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => handleCheckoutSuccess(split ? [
              { method: toPaymentMethod(paymentMethod), amount: Math.round(firstAmount * 100) / 100 },
              { method: toPaymentMethod(secondMethod), amount: Math.round(remainingAmount * 100) / 100 },
            ] : [{ method: toPaymentMethod(paymentMethod), amount: total }])}
            disabled={isLoading || (split ? firstAmount <= 0 || remainingAmount <= 0 || secondMethod === paymentMethod : paymentMethod === "cash" && Number(receivedAmount) < total)}
            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>{isLoading ? "Saving sale…" : "Complete Order"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
