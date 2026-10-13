import { X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useEffect } from "react";

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
  // Reset received amount whenever the modal opens or total changes
  useEffect(() => {
    if (paymentModalOpen) {
      setReceivedAmount(String(total));
    }
  }, [paymentModalOpen, total, setReceivedAmount]);

  if (!paymentModalOpen) return null;

  const received = Number(receivedAmount) || 0;
  const canComplete = received >= total && !isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Cash Payment</h3>
          <button
            onClick={() => setPaymentModalOpen(false)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button
                type="button"
                onClick={onDismissError}
                className="ml-auto text-rose-200"
              >
                ×
              </button>
            </div>
          )}

          {/* Total */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Payable
            </span>
            <h2 className="mt-1 text-3xl font-black text-sky-400">
              {total.toLocaleString()} MMK
            </h2>
          </div>

          {/* Received Amount */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Received Amount (MMK)
            </label>
            <input
              type="number"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              placeholder="Enter cash received..."
              min={total}
              step="1"
              autoFocus
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-lg font-bold text-white focus:border-sky-500 focus:outline-none"
            />

            {/* Quick cash buttons */}
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[total, 5000, 10000, 20000].map((amt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReceivedAmount(String(amt))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold text-slate-300 hover:border-sky-500 hover:text-white"
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>

            {received > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold">
                <span className="text-slate-400">Change Due:</span>
                <span
                  className={
                    changeAmount < 0
                      ? "font-bold text-rose-400"
                      : "font-bold text-emerald-400"
                  }
                >
                  {changeAmount.toLocaleString()} MMK
                </span>
              </div>
            )}

            {received > 0 && received < total && (
              <p className="mt-2 text-xs text-rose-300">
                Received amount is less than total payable.
              </p>
            )}
          </div>

          <button
            onClick={() =>
              handleCheckoutSuccess([{ method: "CASH", amount: total }])
            }
            disabled={!canComplete}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            <span>{isLoading ? "Saving sale…" : "Complete Order"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// import { X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
// import { useEffect, useState } from "react";
// import { ChoiceCards } from "./ChoiceCards";

// interface PaymentModalProps {
//   paymentModalOpen: boolean;
//   setPaymentModalOpen: (open: boolean) => void;
//   total: number;
//   paymentMethod: "cash" | "kpay" | "wave" | "card";
//   setPaymentMethod: (method: "cash" | "kpay" | "wave" | "card") => void;
//   receivedAmount: string;
//   setReceivedAmount: (amount: string) => void;
//   changeAmount: number;
//   handleCheckoutSuccess: (
//     payments?: { method: string; amount: number }[],
//   ) => void;
//   isLoading: boolean;
//   error: string | null;
//   onDismissError: () => void;
// }

// export function PaymentModal({
//   paymentModalOpen,
//   setPaymentModalOpen,
//   total,
//   paymentMethod,
//   setPaymentMethod,
//   receivedAmount,
//   setReceivedAmount,
//   changeAmount,
//   handleCheckoutSuccess,
//   isLoading,
//   error,
//   onDismissError,
// }: PaymentModalProps) {
//   const [split, setSplit] = useState(false);
//   const [firstPaymentAmount, setFirstPaymentAmount] = useState("");
//   const [secondMethod, setSecondMethod] = useState<
//     "cash" | "kpay" | "wave" | "card"
//   >("wave");
//   useEffect(
//     () => setFirstPaymentAmount(String(Math.floor(total / 2))),
//     [total],
//   );
//   const firstAmount = Number(firstPaymentAmount) || 0;
//   const remainingAmount = Math.max(0, total - firstAmount);
//   const toPaymentMethod = (method: string) =>
//     ({ cash: "CASH", kpay: "KBZ_PAY", wave: "WAVE_PAY", card: "CARD" })[
//       method
//     ] || "CASH";
//   useEffect(() => {
//     if (secondMethod === paymentMethod)
//       setSecondMethod(
//         (["cash", "kpay", "wave", "card"] as const).find(
//           (method) => method !== paymentMethod,
//         ) || "wave",
//       );
//   }, [paymentMethod, secondMethod]);
//   if (!paymentModalOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
//       <div className="flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl sm:p-6">
//         <div className="flex justify-between items-center mb-6">
//           <h3 className="font-bold text-xl text-white">Payment Checkout</h3>
//           <button
//             onClick={() => setPaymentModalOpen(false)}
//             className="text-slate-400 hover:text-white p-1"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         <div className="space-y-4">
//           {error && (
//             <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
//               <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
//               <span>{error}</span>
//               <button
//                 type="button"
//                 onClick={onDismissError}
//                 className="ml-auto text-rose-200"
//               >
//                 ×
//               </button>
//             </div>
//           )}
//           <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
//             <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
//               Total Payable
//             </span>
//             <h2 className="text-3xl font-black text-sky-400 mt-1">
//               {total.toLocaleString()} MMK
//             </h2>
//           </div>

//           <label className="flex items-center gap-2 text-sm text-slate-300">
//             <input
//               type="checkbox"
//               checked={split}
//               onChange={(event) => setSplit(event.target.checked)}
//               className="accent-sky-500"
//             />
//             Split payment across two methods
//           </label>
//           {split && (
//             <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:grid-cols-2">
//               <label className="text-xs text-slate-400">
//                 First amount (MMK)
//                 <input
//                   type="number"
//                   min="0.01"
//                   max={total}
//                   step="0.01"
//                   value={firstPaymentAmount}
//                   onChange={(event) =>
//                     setFirstPaymentAmount(event.target.value)
//                   }
//                   className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
//                 />
//                 <span className="mt-1 block text-[10px]">
//                   {paymentMethod.toUpperCase()}
//                 </span>
//               </label>
//               <div className="text-xs text-slate-400">
//                 <ChoiceCards
//                   label={`Payment method for remaining ${remainingAmount.toLocaleString()} MMK`}
//                   value={secondMethod}
//                   onChange={(method) =>
//                     setSecondMethod(method as typeof secondMethod)
//                   }
//                   options={(["cash", "kpay", "wave", "card"] as const)
//                     .filter((method) => method !== paymentMethod)
//                     .map((method) => ({
//                       value: method,
//                       label: method.toUpperCase(),
//                     }))}
//                 />
//                 <span className="mt-1 block text-[10px]">
//                   Remaining balance is assigned automatically.
//                 </span>
//               </div>
//             </div>
//           )}

//           {/* Payment Methods */}
//           <div>
//             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
//               Select Method
//             </label>
//             <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
//               {(["cash", "kpay", "wave", "card"] as const).map((method) => (
//                 <button
//                   key={method}
//                   onClick={() => setPaymentMethod(method)}
//                   className={`p-3 rounded-xl font-bold text-xs uppercase border flex items-center justify-center gap-2 transition-all ${
//                     paymentMethod === method
//                       ? "bg-sky-500/20 border-sky-500 text-sky-300"
//                       : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
//                   }`}
//                 >
//                   {method}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Cash tendered input */}
//           {paymentMethod === "cash" && (
//             <div>
//               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
//                 Received Amount (MMK)
//               </label>
//               <input
//                 type="number"
//                 value={receivedAmount}
//                 onChange={(e) => setReceivedAmount(e.target.value)}
//                 placeholder="Enter cash received..."
//                 min={total}
//                 step="1"
//                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-sky-500"
//               />
//               {Number(receivedAmount) > 0 && (
//                 <div className="flex justify-between items-center mt-2 px-1 text-sm font-semibold">
//                   <span className="text-slate-400">Change Due:</span>
//                   <span className="text-emerald-400 font-bold">
//                     {changeAmount.toLocaleString()} MMK
//                   </span>
//                 </div>
//               )}
//             </div>
//           )}

//           <button
//             onClick={() =>
//               handleCheckoutSuccess(
//                 split
//                   ? [
//                       {
//                         method: toPaymentMethod(paymentMethod),
//                         amount: Math.round(firstAmount * 100) / 100,
//                       },
//                       {
//                         method: toPaymentMethod(secondMethod),
//                         amount: Math.round(remainingAmount * 100) / 100,
//                       },
//                     ]
//                   : [{ method: toPaymentMethod(paymentMethod), amount: total }],
//               )
//             }
//             disabled={
//               isLoading ||
//               (split
//                 ? firstAmount <= 0 ||
//                   remainingAmount <= 0 ||
//                   secondMethod === paymentMethod
//                 : paymentMethod === "cash" && Number(receivedAmount) < total)
//             }
//             className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50"
//           >
//             {isLoading ? (
//               <Loader2 className="w-5 h-5 animate-spin" />
//             ) : (
//               <CheckCircle2 className="w-5 h-5" />
//             )}
//             <span>{isLoading ? "Saving sale…" : "Complete Order"}</span>
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
