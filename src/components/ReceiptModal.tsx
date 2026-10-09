import { Printer, X, Check } from "lucide-react";

export interface ReceiptData {
  orderNumber: string;
  createdAt: string;
  storeName?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subTotal: number;
  }>;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  receivedAmount?: number;
  changeAmount?: number;
  cashierName?: string;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
      <div className="flex flex-col max-h-[90vh] w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl print:border-0 print:bg-white print:p-0 print:shadow-none print:max-w-none print:w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2 text-emerald-400">
            <Check className="h-5 w-5" />
            <h3 className="font-bold text-white">Order Completed</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div className="my-4 flex-1 overflow-y-auto font-mono text-xs text-slate-900 bg-white p-5 rounded-2xl shadow-inner print:p-0 print:shadow-none print:overflow-visible">
          {/* Header & Logo */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">KANITT RETAIL</h2>
            <p className="text-[11px] font-semibold text-slate-700">{receipt.storeName || "Main Branch"}</p>
            <p className="text-[10px] text-slate-500">Receipt #{receipt.orderNumber}</p>
            <p className="text-[10px] text-slate-500">{new Date(receipt.createdAt).toLocaleString()}</p>
          </div>

          {/* Customer / Cashier Info */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-0.5 text-[10px] text-slate-700">
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="font-semibold">{receipt.cashierName || "Staff"}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment:</span>
              <span className="font-semibold uppercase">{receipt.paymentMethod}</span>
            </div>
          </div>

          {/* Line Items */}
          <div className="py-3 border-b border-dashed border-slate-400 space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200 pb-1">
              <span>Item</span>
              <span>Qty x Price</span>
              <span>Total</span>
            </div>
            {receipt.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="font-bold text-black truncate">{item.name}</div>
                <div className="flex justify-between text-[11px] text-slate-700">
                  <span>{item.quantity} x {item.unitPrice.toLocaleString()}</span>
                  <span className="font-semibold">{item.subTotal.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals & Calculations */}
          <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal:</span>
              <span>{receipt.subTotal.toLocaleString()} MMK</span>
            </div>
            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Discount:</span>
                <span>-{receipt.discountAmount.toLocaleString()} MMK</span>
              </div>
            )}
            {receipt.taxAmount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Tax:</span>
                <span>+{receipt.taxAmount.toLocaleString()} MMK</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-black pt-1 border-t border-slate-300">
              <span>GRAND TOTAL:</span>
              <span>{receipt.grandTotal.toLocaleString()} MMK</span>
            </div>
            {receipt.receivedAmount !== undefined && receipt.receivedAmount > 0 && (
              <>
                <div className="flex justify-between text-slate-700 pt-1">
                  <span>Received:</span>
                  <span>{receipt.receivedAmount.toLocaleString()} MMK</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Change:</span>
                  <span>{(receipt.changeAmount || 0).toLocaleString()} MMK</span>
                </div>
              </>
            )}
          </div>

          {/* Footer Message */}
          <div className="pt-4 text-center space-y-1 text-[10px] text-slate-600">
            <p className="font-semibold">Thank you for shopping with us!</p>
            <p>Please keep this receipt for returns/warranty.</p>
            <p className="text-[9px] text-slate-400 pt-2">Powered by Kanitt POS Systems</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 py-3 text-xs font-bold text-slate-950 transition hover:bg-sky-300"
          >
            <Printer className="h-4 w-4" /> Print Thermal
          </button>
        </div>
      </div>
    </div>
  );
}
