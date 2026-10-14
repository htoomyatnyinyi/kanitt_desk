import { useEffect, useRef, useCallback, useState } from "react";
import { Printer, X, Check } from "lucide-react";
import { printIsolatedHtml, printToDefaultPrinter } from "../services/print";

export interface ReceiptData {
  orderNumber: string;
  createdAt: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeId?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  allowAutoPrint?: boolean;
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
  payments?: { method: string; amount: number }[];
  receivedAmount?: number;
  changeAmount?: number;
  cashierName?: string;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

/* Print a dedicated iframe document so the POS shell can never appear on paper. */

type PrintFormat = "receipt" | "a4";

function cleanPrintText(value: string) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function wrapPrintText(value: string, width: number) {
  const words = cleanPrintText(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const chunks = word.length > width
      ? word.match(new RegExp(`.{1,${width}}`, "gu")) || [word]
      : [word];
    for (const chunk of chunks) {
      if (line && line.length + chunk.length + 1 > width) {
        lines.push(line);
        line = chunk;
      } else {
        line = line ? `${line} ${chunk}` : chunk;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatReceiptText(receipt: ReceiptData, format: PrintFormat, paperWidth: string) {
  const columns = format === "a4" ? 90 : paperWidth === "58" ? 32 : 48;
  const separator = "-".repeat(columns);
  const center = (value: string) => {
    const text = cleanPrintText(value);
    return text.length >= columns ? text : " ".repeat(Math.floor((columns - text.length) / 2)) + text;
  };
  const pair = (label: string, value: string) => {
    const left = cleanPrintText(label);
    const right = cleanPrintText(value);
    return left.length + right.length + 1 <= columns
      ? `${left}${" ".repeat(columns - left.length - right.length)}${right}`
      : `${left}\n${right.padStart(columns)}`;
  };
  const lines = [
    center(receipt.receiptHeader || receipt.storeName || "KANITT RETAIL"),
    ...(receipt.storeName && receipt.storeName !== receipt.receiptHeader ? wrapPrintText(receipt.storeName, columns).map(center) : []),
    ...wrapPrintText(receipt.storeAddress || "", columns).map(center),
    receipt.storePhone ? center(receipt.storePhone) : "",
    separator,
    pair("Receipt", receipt.orderNumber),
    pair("Date", new Date(receipt.createdAt).toLocaleString()),
    pair("Cashier", receipt.cashierName || "Staff"),
    separator,
    ...receipt.items.flatMap((item) => [
      ...wrapPrintText(item.name, columns),
      pair(`${item.quantity} x ${item.unitPrice.toLocaleString()}`, `${item.subTotal.toLocaleString()} MMK`),
    ]),
    separator,
    pair("Subtotal", `${receipt.subTotal.toLocaleString()} MMK`),
    ...(receipt.discountAmount > 0 ? [pair("Discount", `-${receipt.discountAmount.toLocaleString()} MMK`)] : []),
    ...(receipt.taxAmount > 0 ? [pair("Tax", `${receipt.taxAmount.toLocaleString()} MMK`)] : []),
    pair("TOTAL", `${receipt.grandTotal.toLocaleString()} MMK`),
    ...(receipt.payments?.length
      ? receipt.payments.map((payment) => pair(payment.method.replace(/_/g, " "), `${payment.amount.toLocaleString()} MMK`))
      : [pair("Payment", receipt.paymentMethod)]),
    ...(receipt.receivedAmount !== undefined ? [pair("Received", `${receipt.receivedAmount.toLocaleString()} MMK`)] : []),
    ...(receipt.changeAmount !== undefined ? [pair("Change", `${receipt.changeAmount.toLocaleString()} MMK`)] : []),
    separator,
    ...wrapPrintText(receipt.receiptFooter || "Thank you for shopping with us!", columns).map(center),
    "",
  ];
  return lines.filter((line, index) => line || (index > 0 && lines[index - 1] !== "")).join("\n");
}

async function printReceiptElement(sourceEl: HTMLElement, receipt: ReceiptData, paperWidth: string, format: PrintFormat, printerName?: string) {
  try {
    if (await printToDefaultPrinter(formatReceiptText(receipt, format, paperWidth), printerName)) return;
  } catch {
    // If the native spooler is unavailable, fall back to the OS print dialog.
  }
  const pageSize = format === "a4" ? "A4 portrait" : `${paperWidth}mm auto`;
  const contentWidth = format === "a4" ? "190mm" : `${paperWidth}mm`;
  printIsolatedHtml(`<main id="kanitt-print-root">${sourceEl.innerHTML}</main>`, `
    @page { size: ${pageSize}; margin: ${format === "a4" ? "10mm" : "0"}; }
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    #kanitt-print-root {
        box-sizing: border-box !important;
        width: ${contentWidth} !important;
        max-width: ${contentWidth} !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        padding: ${format === "a4" ? "8mm" : "2mm"} !important;
        margin: 0 !important;
        background: #fff !important;
        color: #000 !important;
        font-family: monospace !important;
        font-size: ${format === "a4" ? "10pt" : "12px"} !important;
        line-height: 1.4 !important;
    }
    #kanitt-print-root * { color: #000 !important; visibility: visible !important; }
    #kanitt-print-root h2 { font-size: ${format === "a4" ? "22pt" : "16px"} !important; font-weight: 900 !important; }
  `);
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const autoPrintedReceipt = useRef<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [previewFormat, setPreviewFormat] = useState<PrintFormat>("receipt");

  const printerProfile = receipt?.storeId
    ? localStorage.getItem("kanitt:printer-profile:" + receipt.storeId)
    : null;
  let paperWidth: "58" | "80" = "80";
  let defaultFormat: PrintFormat = "receipt";
  let printerName = "";
  let autoPrintReceipt = false;
  try {
    const preferences = printerProfile ? JSON.parse(printerProfile) : {};
    paperWidth = preferences.paperWidth === "58" ? "58" : "80";
    defaultFormat = preferences.defaultFormat === "a4" ? "a4" : "receipt";
    printerName = typeof preferences.printerName === "string" ? preferences.printerName : "";
    autoPrintReceipt = preferences.autoPrintReceipt === true;
  } catch {}

  const handlePrint = useCallback((format: PrintFormat = defaultFormat) => {
    if (receiptRef.current && receipt) {
      void printReceiptElement(receiptRef.current, receipt, paperWidth, format, printerName);
    }
  }, [receipt, paperWidth, defaultFormat, printerName]);

  useEffect(() => {
    setPreviewFormat(defaultFormat);
  }, [receipt?.orderNumber, defaultFormat]);

  useEffect(() => {
    if (
      !receipt ||
      !receipt.allowAutoPrint ||
      !autoPrintReceipt ||
      autoPrintedReceipt.current === receipt.orderNumber
    )
      return;
    autoPrintedReceipt.current = receipt.orderNumber;
    // Delay to allow DOM to render
    window.setTimeout(() => handlePrint(defaultFormat), 300);
  }, [receipt?.orderNumber, autoPrintReceipt, defaultFormat, handlePrint]);

  if (!receipt) return null;
  const receiptHeading = receipt.receiptHeader || "KANITT RETAIL";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex flex-col max-h-[90vh] w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
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

        {/* Receipt Preview Area (also used as source for printing) */}
        <div
          ref={receiptRef}
          className="my-4 min-h-0 flex-1 overflow-y-auto self-center rounded-2xl bg-white p-5 font-mono text-xs text-slate-900 shadow-inner"
          style={{ width: previewFormat === "a4" ? "100%" : paperWidth + "mm", maxWidth: "100%" }}
        >
          {/* Header & Logo */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">
              {receiptHeading}
            </h2>
            {receipt.storeName && receipt.storeName !== receiptHeading && (
              <p className="text-[11px] font-semibold text-slate-700">
                {receipt.storeName}
              </p>
            )}
            {receipt.storeAddress && (
              <p className="text-[10px] text-slate-500">
                {receipt.storeAddress}
              </p>
            )}
            {receipt.storePhone && (
              <p className="text-[10px] text-slate-500">{receipt.storePhone}</p>
            )}
            <p className="text-[10px] text-slate-500">
              Receipt #{receipt.orderNumber}
            </p>
            <p className="text-[10px] text-slate-500">
              {new Date(receipt.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Customer / Cashier Info */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-0.5 text-[10px] text-slate-700">
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="font-semibold">
                {receipt.cashierName || "Staff"}
              </span>
            </div>
            {receipt.payments?.map((payment, index) => (
              <div
                key={payment.method + index}
                className="flex justify-between"
              >
                <span>{payment.method.replace(/_/g, " ")}:</span>
                <span className="font-semibold">
                  {payment.amount.toLocaleString()} MMK
                </span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>Payment:</span>
              <span className="font-semibold uppercase">
                {receipt.paymentMethod}
              </span>
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
                  <span>
                    {item.quantity} x {item.unitPrice.toLocaleString()}
                  </span>
                  <span className="font-semibold">
                    {item.subTotal.toLocaleString()}
                  </span>
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
            {receipt.receivedAmount !== undefined &&
              receipt.receivedAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-700 pt-1">
                    <span>Received:</span>
                    <span>{receipt.receivedAmount.toLocaleString()} MMK</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold">
                    <span>Change:</span>
                    <span>
                      {(receipt.changeAmount || 0).toLocaleString()} MMK
                    </span>
                  </div>
                </>
              )}
          </div>

          {/* Footer Message */}
          <div className="pt-4 text-center space-y-1 text-[10px] text-slate-600">
            <p className="font-semibold">
              {receipt.receiptFooter || "Thank you for shopping with us!"}
            </p>
            <p>Please keep this receipt for returns/warranty.</p>
            <p className="text-[9px] text-slate-400 pt-2">
              Powered by Kanitt POS Systems
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            Close
          </button>
          <div className="flex flex-1 gap-2">
            <button
              onClick={() => { setPreviewFormat("receipt"); handlePrint("receipt"); }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-400 py-3 text-xs font-bold text-slate-950 transition hover:bg-sky-300"
            >
              <Printer className="h-4 w-4" /> Receipt {paperWidth}mm{defaultFormat === "receipt" ? " · Default" : ""}
            </button>
            <button
              onClick={() => { setPreviewFormat("a4"); handlePrint("a4"); }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-slate-800 py-3 text-xs font-bold text-sky-200 transition hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" /> A4 page{defaultFormat === "a4" ? " · Default" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
