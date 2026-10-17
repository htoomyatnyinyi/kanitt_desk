import {
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Banknote,
  CreditCard,
  QrCode,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "KBZ_PAY" | "WAVE_PAY" | "CARD"
  >("CASH");

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
  const canComplete = isCash ? received >= total && !isLoading : !isLoading;

  // Smart cash suggestions
  const quickCashOptions = [
    total,
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
  ].filter((val, idx, self) => val >= total && self.indexOf(val) === idx);

  if (quickCashOptions.length < 5) {
    for (const common of [10000, 20000, 50000, 100000]) {
      if (common > total && !quickCashOptions.includes(common)) {
        quickCashOptions.push(common);
      }
    }
  }

  const handleKeypadPress = (val: string) => {
    if (val === "+1k") {
      setReceivedAmount(String((Number(receivedAmount) || 0) + 1000));
    } else if (val === "+5k") {
      setReceivedAmount(String((Number(receivedAmount) || 0) + 5000));
    } else if (val === "+10k") {
      setReceivedAmount(String((Number(receivedAmount) || 0) + 10000));
    }
  };

  const handleComplete = () => {
    if (!canComplete) return;
    handleCheckoutSuccess([{ method: paymentMethod, amount: total }]);
  };

  const paymentMethods = [
    {
      id: "CASH" as const,
      label: "Cash",
      desc: "Instant counter tender",
      icon: Banknote,
      accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-400",
    },
    {
      id: "KBZ_PAY" as const,
      label: "KBZPay",
      desc: "QR / Mobile transfer",
      icon: QrCode,
      accent: "from-sky-500/20 to-blue-600/10 border-sky-500/40 text-sky-400",
    },
    {
      id: "WAVE_PAY" as const,
      label: "WavePay",
      desc: "E-wallet QR code",
      icon: QrCode,
      accent: "from-amber-500/20 to-yellow-600/10 border-amber-500/40 text-amber-400",
    },
    {
      id: "CARD" as const,
      label: "Card / POS",
      desc: "Credit / Debit terminal",
      icon: CreditCard,
      accent: "from-violet-500/20 to-purple-600/10 border-violet-500/40 text-violet-400",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-xl sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) setPaymentModalOpen(false);
      }}
    >
      <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl shadow-black/70 animate-in">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Modal Top Bar */}
        <header className="relative flex items-center justify-between border-b border-slate-800/80 px-6 py-4.5 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 border border-sky-400/30 text-sky-400 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white sm:text-lg">
                  Complete Payment
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Secure POS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose settlement channel & verify tendered funds
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !isLoading && setPaymentModalOpen(false)}
            disabled={isLoading}
            className="group flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-400 transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div className="flex-1">
                <p className="font-bold text-rose-200">Checkout Error</p>
                <p className="text-xs text-rose-300/90">{error}</p>
              </div>
              <button
                type="button"
                onClick={onDismissError}
                className="text-rose-400 hover:text-white p-1 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Premium Payable Display */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Payable Amount
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {total.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-sky-400 tracking-wider">
                    MMK
                  </span>
                </div>
              </div>

              {/* Status pill on the right */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300">
                  Method: <strong className="text-white">{paymentMethod.replace(/_/g, " ")}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Grid */}
          <div>
            <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Payment Channel
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {paymentMethods.map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id);
                      if (m.id !== "CASH") setReceivedAmount(String(total));
                    }}
                    className={`group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                      active
                        ? `bg-gradient-to-b ${m.accent} shadow-lg shadow-sky-500/10 ring-1 ring-sky-400/30 scale-[1.02]`
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between mb-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                          active
                            ? "bg-slate-950/80 text-white shadow-sm"
                            : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-sky-400 ring-4 ring-sky-400/20" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight">
                      {m.label}
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">
                      {m.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Settlement Panel with Quick Suggestions & Number Pad */}
          {isCash ? (
            <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-4 sm:p-5 space-y-4">
              {/* Tendered Amount Input & Quick Fill */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Received Cash Tendered
                  </label>
                  <button
                    type="button"
                    onClick={() => setReceivedAmount(String(total))}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-400 hover:bg-sky-500/20 transition-colors"
                  >
                    Exact Amount ({total.toLocaleString()})
                  </button>
                </div>

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
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3.5 pl-4 pr-16 font-mono text-2xl font-black text-white focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/15 transition-all shadow-inner"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    MMK
                  </span>
                </div>
              </div>

              {/* Quick Cash Chips */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Denominations
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickCashOptions.slice(0, 5).map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReceivedAmount(String(amt))}
                      className="rounded-xl border border-slate-700/80 bg-slate-800/90 px-3 py-2 font-mono text-xs font-bold text-slate-200 hover:border-sky-400/60 hover:bg-slate-700 hover:text-white active:scale-95 transition-all shadow-sm"
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("+1k")}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-2.5 py-2 text-[11px] font-bold text-sky-300 hover:bg-slate-700"
                  >
                    +1,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("+5k")}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-2.5 py-2 text-[11px] font-bold text-sky-300 hover:bg-slate-700"
                  >
                    +5,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("+10k")}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-2.5 py-2 text-[11px] font-bold text-sky-300 hover:bg-slate-700"
                  >
                    +10,000
                  </button>
                </div>
              </div>

              {/* Premium Change Due Display */}
              <div
                className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                  changeAmount < 0
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    : changeAmount === 0
                      ? "border-slate-800 bg-slate-900/80 text-slate-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                    {changeAmount < 0 ? "Underpaid By" : "Change to Return"}
                  </span>
                  <p className="text-xs opacity-70">
                    {changeAmount < 0
                      ? "Received amount is less than total"
                      : changeAmount === 0
                        ? "Exact tender provided"
                        : "Hand over to customer"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black tracking-tight">
                    {Math.abs(changeAmount).toLocaleString()}
                  </span>
                  <span className="ml-1 text-xs font-bold">MMK</span>
                </div>
              </div>
            </div>
          ) : (
            /* Digital / Terminal Channel Instructions */
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <QrCode className="h-7 w-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Customer Transfer: {paymentMethod.replace(/_/g, " ")}
                </h4>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Ask customer to scan merchant QR or swipe POS terminal for exactly{" "}
                  <strong className="text-white font-mono">{total.toLocaleString()} MMK</strong>.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/5 px-3 py-1 text-[11px] font-medium text-sky-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Check notification on your store receiver phone before finalizing
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="border-t border-slate-800/80 bg-slate-900/80 px-6 py-4 backdrop-blur-md flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setPaymentModalOpen(false)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white active:scale-95 disabled:opacity-50"
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={handleComplete}
            disabled={!canComplete}
            className="group relative flex flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
            )}
            <span>
              {isLoading
                ? "Finalising sale…"
                : `Complete Sale · ${total.toLocaleString()} MMK`}
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </footer>
      </div>
    </div>
  );
}
