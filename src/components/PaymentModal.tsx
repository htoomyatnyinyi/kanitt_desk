import { X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface PaymentModalProps {
  paymentModalOpen: boolean;
  setPaymentModalOpen: (open: boolean) => void;
  total: number;
  paymentMethod: "cash" | "kpay" | "wave" | "card";
  setPaymentMethod: (method: "cash" | "kpay" | "wave" | "card") => void;
  receivedAmount: string;
  setReceivedAmount: (amount: string) => void;
  changeAmount: number;
  handleCheckoutSuccess: () => void;
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
            onClick={handleCheckoutSuccess}
            disabled={isLoading || (paymentMethod === "cash" && Number(receivedAmount) < total)}
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
