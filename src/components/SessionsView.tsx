import { FormEvent, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  DoorOpen,
  Store as StoreIcon,
  X,
  FileText,
  Share2,
  Download,
  Copy,
  Printer,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ApiOrder, Session } from "../store/apiSlice";

interface SessionsViewProps {
  sessions?: Session[];
  orders?: ApiOrder[];
  storeId?: string;
  storeName?: string;
  userId?: string;
  userRole?: string;
  sessionMode?: "SHARED" | "INDIVIDUAL";
  onOpen: (storeId: string, openingBalance: number) => Promise<unknown>;
  onClose: (sessionId: string, closingBalance: number) => Promise<unknown>;
  /** Optional external X-report history (from API) */
  xReports?: XReportRecord[];
  /** Called when a new X-report is generated (to persist) */
  onXReportGenerated?: (report: XReportRecord) => void;
}

/* ------------------------------------------------------------------ */
/*  X-Report types + helpers                                           */
/* ------------------------------------------------------------------ */

export interface XReportRecord {
  id: string;
  sessionId: string;
  storeId?: string;
  storeName?: string;
  staffId?: string;
  staffName?: string;
  /** "MID_SHIFT" = X-Report while open, "FINAL" = on close */
  type: "MID_SHIFT" | "FINAL";
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  digitalSales: number;
  totalSales: number;
  expectedDrawer: number;
  orderCount: number;
  createdAt: string;
  generatedBy?: string;
  note?: string;
}

const money = (value: number, currencySymbol = "MMK") =>
  `${Number(value || 0).toLocaleString()} ${currencySymbol}`;

const errText = (error: unknown) => {
  const value = error as {
    data?: string | { message?: string; error?: string };
    message?: string;
    error?: string;
    status?: string | number;
  };
  const serverMessage =
    typeof value.data === "string"
      ? value.data
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 240)
      : value.data?.message || value.data?.error;
  return (
    serverMessage ||
    value.message ||
    value.error ||
    (value.status
      ? `Register request failed (${value.status}).`
      : "Register request failed. Check your connection and try again.")
  );
};

const isCountedSale = (order: ApiOrder) => {
  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();
  return (
    !["VOIDED", "CANCELLED", "REFUNDED"].includes(status) &&
    (status === "COMPLETED" || paymentStatus === "PAID")
  );
};

const makeXReportId = () =>
  `xr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const formatShortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
};

/* ------------------------------------------------------------------ */
/*  X-Report HTML builder                                              */
/* ------------------------------------------------------------------ */

function buildXReportHtml(
  record: XReportRecord,
  orders: ApiOrder[] = [],
  currencySymbol = "MMK",
): string {
  const sessionIdShort = String(record.sessionId || "")
    .slice(-8)
    .toUpperCase();
  const typeLabel = record.type === "FINAL" ? "Z-REPORT" : "X-REPORT";
  const typeBadge =
    record.type === "FINAL"
      ? "FINAL · END OF SHIFT"
      : "MID-SHIFT · SESSION OPEN";

  const orderRows = orders.length
    ? orders
        .slice(0, 60)
        .map((o: any) => {
          const num = o.orderNumber || String(o.id || "").slice(-8) || "Sale";
          const time = new Date(o.createdAt || Date.now()).toLocaleTimeString();
          const method = String(
            o.paymentMethod ||
              (Array.isArray(o.paymentBreakdown) &&
                o.paymentBreakdown[0]?.method) ||
              "—",
          ).replace(/_/g, " ");
          return `<div class="row"><span>${num} · ${method} · ${time}</span><span>${money(Number(o.grandTotal || 0), currencySymbol)}</span></div>`;
        })
        .join("")
    : `<div class="row" style="opacity:0.5;"><span>No orders recorded</span><span>—</span></div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${typeLabel} · ${record.storeName || "Store"}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 18px; max-width: 420px; margin: 0 auto; color: #111; }
    .center { text-align: center; }
    .brand { font-size: 20px; font-weight: 900; }
    .title { font-size: 15px; font-weight: 900; margin: 8px 0; letter-spacing: 3px; }
    .subtitle { font-size: 10px; color: #555; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #fff4cc; border: 1px solid #b58900; font-size: 9px; font-weight: 900; letter-spacing: 1.5px; margin-top: 4px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .thin { border-top: 1px dotted #444; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
    .row span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bold { font-weight: 700; }
    .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #333; margin-top: 8px; }
    .total-box { border: 2px solid #000; padding: 6px 8px; margin: 8px 0; }
    .total-box .label { font-size: 11px; letter-spacing: 1px; }
    .total-box .value { font-size: 18px; font-weight: 900; }
    .footer { margin-top: 14px; font-size: 10px; color: #666; text-align: center; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
    .no-print { text-align: center; margin-bottom: 12px; }
    .no-print button { font-family: inherit; font-size: 12px; font-weight: 700; padding: 8px 16px; border-radius: 8px; border: 1px solid #333; background: #111; color: #fff; cursor: pointer; margin: 0 4px; }
    .no-print button.ghost { background: #fff; color: #111; }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Print</button>
    <button class="ghost" onclick="window.close()">Close</button>
  </div>

  <div class="center">
    <div class="brand">${record.storeName || "Store"}</div>
    <div class="divider"></div>
    <div class="title">${typeLabel}</div>
    <div class="badge">${typeBadge}</div>
  </div>

  <div class="thin"></div>
  <div class="row"><span>Report ID:</span><span>${record.id.slice(-8).toUpperCase()}</span></div>
  <div class="row"><span>Session ID:</span><span>#${sessionIdShort}</span></div>
  <div class="row"><span>Cashier:</span><span>${record.staffName || "Staff"}</span></div>
  <div class="row"><span>Generated:</span><span>${new Date(record.createdAt).toLocaleString()}</span></div>
  ${record.note ? `<div class="row"><span>Note:</span><span>${record.note}</span></div>` : ""}

  <div class="divider"></div>
  <div class="section-title">Cash drawer</div>
  <div class="row"><span>Opening cash:</span><span>${money(record.openingBalance)}</span></div>
  <div class="row"><span>+ Cash sales:</span><span>${money(record.cashSales)}</span></div>
  <div class="row bold"><span>= Expected in drawer:</span><span>${money(record.expectedDrawer)}</span></div>

  <div class="divider"></div>
  <div class="section-title">Sales breakdown</div>
  <div class="row"><span>Card sales:</span><span>${money(record.cardSales)}</span></div>
  <div class="row"><span>Digital sales:</span><span>${money(record.digitalSales)}</span></div>
  <div class="total-box">
    <div class="label">TOTAL SALES</div>
    <div class="value">${money(record.totalSales)}</div>
  </div>

  <div class="divider"></div>
  <div class="row"><span>Transactions:</span><span>${record.orderCount}</span></div>
  <div class="thin"></div>
  <div class="section-title">Orders</div>
  ${orderRows}

  <div class="divider"></div>
  <div class="footer">
    <div>— END OF ${typeLabel} —</div>
    <div style="margin-top:4px;">Generated by Kanitt POS</div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Share / Download helpers                                           */
/* ------------------------------------------------------------------ */

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function printHtml(html: string) {
  const win = window.open(
    "",
    "_blank",
    "width=440,height=760,menubar=no,toolbar=no,location=no",
  );
  if (!win) {
    // Popup blocked → download fallback
    downloadHtml(html, `x-report-${Date.now()}.html`);
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* noop */
    }
  }, 400);
  return true;
}

async function shareXReport(
  record: XReportRecord,
  html: string,
): Promise<{ method: string; ok: boolean; message?: string }> {
  const title = `${record.type === "FINAL" ? "Z-Report" : "X-Report"} · ${record.storeName || "Store"}`;
  const text = [
    `${title}`,
    `Cashier: ${record.staffName || "Staff"}`,
    `Generated: ${new Date(record.createdAt).toLocaleString()}`,
    `Total sales: ${money(record.totalSales)}`,
    `Cash: ${money(record.cashSales)} · Card: ${money(record.cardSales)} · Digital: ${money(record.digitalSales)}`,
    `Expected drawer: ${money(record.expectedDrawer)}`,
    `Orders: ${record.orderCount}`,
  ].join("\n");

  // 1) Web Share API with file (best on mobile)
  try {
    const nav: any = navigator;
    if (nav?.share && nav?.canShare) {
      const file = new File([html], `x-report-${record.id}.html`, {
        type: "text/html",
      });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title, text });
        return { method: "files", ok: true };
      }
    }
    // 2) Web Share API text only
    if (nav?.share) {
      await nav.share({ title, text });
      return { method: "text", ok: true };
    }
  } catch (err: any) {
    // User canceled → not an error
    if (
      String(err?.name || "")
        .toLowerCase()
        .includes("abort")
    ) {
      return { method: "cancel", ok: false, message: "Share canceled" };
    }
  }

  // 3) Clipboard copy fallback
  try {
    await navigator.clipboard.writeText(text);
    return { method: "clipboard", ok: true };
  } catch {
    return { method: "none", ok: false, message: "Sharing not supported" };
  }
}

/* ------------------------------------------------------------------ */
/*  X-Report row (expandable)                                          */
/* ------------------------------------------------------------------ */

function XReportRow({
  record,
  orders,
  onPrint,
  onShare,
  onDownload,
  onDownloadJson,
  onCopy,
}: {
  record: XReportRecord;
  orders: ApiOrder[];
  onPrint: () => void;
  onShare: () => void;
  onDownload: () => void;
  onDownloadJson: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFinal = record.type === "FINAL";

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/40 transition hover:border-slate-700">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
            isFinal
              ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300"
          }`}
        >
          <FileText className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                isFinal
                  ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
                  : "border-sky-500/40 bg-sky-500/20 text-sky-300"
              }`}
            >
              {isFinal ? "Z-Report" : "X-Report"}
            </span>
            <span className="text-[10px] text-slate-500">
              {relativeTime(record.createdAt)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-100">
            {record.staffName || "Staff"}
            <span className="ml-2 font-mono text-[10px] font-normal text-slate-500">
              #{record.sessionId.slice(-8).toUpperCase()}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {formatShortDate(record.createdAt)} · {record.orderCount} orders ·{" "}
            <span className="font-bold text-emerald-300">
              {money(record.totalSales)}
            </span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-black text-emerald-300">
            {money(record.totalSales)}
          </p>
          <p className="text-[10px] text-slate-500">
            {expanded ? "Hide details" : "Show details"}
          </p>
        </div>

        <span className="shrink-0 text-slate-500">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3">
          {/* Breakdown grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-3">
            <div>
              <p className="text-slate-500">Opening</p>
              <p className="font-mono font-bold text-slate-200">
                {money(record.openingBalance)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Cash sales</p>
              <p className="font-mono font-bold text-emerald-300">
                +{money(record.cashSales)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Expected drawer</p>
              <p className="font-mono font-bold text-amber-300">
                {money(record.expectedDrawer)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Card sales</p>
              <p className="font-mono font-bold text-blue-300">
                {money(record.cardSales)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Digital sales</p>
              <p className="font-mono font-bold text-purple-300">
                {money(record.digitalSales)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Orders</p>
              <p className="font-mono font-bold text-slate-200">
                {record.orderCount}
              </p>
            </div>
          </div>

          {record.note && (
            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-500">
                Note ·{" "}
              </span>
              {record.note}
            </p>
          )}

          {orders.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sales in this report</p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {orders.slice(0, 40).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate text-slate-300">{order.orderNumber || order.id.slice(-8)} · {formatShortDate(order.createdAt)}</span>
                    <span className="shrink-0 font-mono text-slate-200">{money(Number(order.grandTotal || 0))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Printer className="h-3 w-3" />
              Print
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
            <button
              type="button"
              onClick={onDownloadJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Download className="h-3 w-3" />
              JSON
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Copy className="h-3 w-3" />
              Copy summary
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function SessionsView({
  sessions = [],
  orders = [],
  storeId,
  storeName,
  userId,
  userRole = "CASHIER",
  sessionMode = "SHARED",
  onOpen,
  onClose,
  xReports: externalXReports = [],
  onXReportGenerated,
}: SessionsViewProps) {
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Local X-report history (merged with external)
  const [localXReports, setLocalXReports] = useState<XReportRecord[]>([]);
  const [xReportTab, setXReportTab] = useState<"all" | "mid" | "final">("all");
  const [shareNotice, setShareNotice] = useState("");

  const storeSessions = useMemo(
    () => sessions.filter((s) => !storeId || s.storeId === storeId),
    [sessions, storeId],
  );
  const openSessions = storeSessions.filter((s) => s.status === "OPEN");
  const isAdministrator = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const ownOpenSession = openSessions.find((s) => s.userId === userId);
  const activeSession =
    sessionMode === "SHARED" ? openSessions[0] : ownOpenSession;
  const closableSessions = openSessions.filter(
    (s) => isAdministrator || s.userId === userId,
  );
  const closingSession = storeSessions.find((s) => s.id === sessionId);

  // Orders for the session we're closing
  const sessionOrders = orders.filter(
    (o) => o.sessionId === closingSession?.id,
  );
  const countedOrders = sessionOrders.filter(isCountedSale);
  const salesTotal = countedOrders.reduce(
    (sum, o) => sum + Number(o.grandTotal || 0),
    0,
  );

  const tenderTotals = countedOrders.reduce(
    (totals, order) => {
      const breakdown = Array.isArray(order.paymentBreakdown)
        ? order.paymentBreakdown
        : [];
      const tenders = breakdown.length
        ? breakdown
        : [{ method: order.paymentMethod || "CASH", amount: order.grandTotal }];
      tenders.forEach((payment) => {
        const method = String(payment.method || "DIGITAL").toUpperCase();
        if (method === "CASH") totals.cash += Number(payment.amount || 0);
        else if (method.includes("CARD"))
          totals.card += Number(payment.amount || 0);
        else totals.digital += Number(payment.amount || 0);
      });
      return totals;
    },
    { cash: 0, card: 0, digital: 0 },
  );

  const cashSales = tenderTotals.cash;
  const expectedCash = Number(closingSession?.openingBalance || 0) + cashSales;
  const cashDifference = (Number(balance) || 0) - expectedCash;

  /* ---------------------- X-report helpers ---------------------- */

  const allXReports = useMemo(
    () =>
      [...localXReports, ...externalXReports].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [localXReports, externalXReports],
  );

  const filteredXReports = useMemo(() => {
    if (xReportTab === "all") return allXReports;
    if (xReportTab === "mid")
      return allXReports.filter((r) => r.type === "MID_SHIFT");
    return allXReports.filter((r) => r.type === "FINAL");
  }, [allXReports, xReportTab]);

  const storeXReports = useMemo(
    () =>
      filteredXReports.filter(
        (r) => !storeId || !r.storeId || r.storeId === storeId,
      ),
    [filteredXReports, storeId],
  );

  const persistXReport = (record: XReportRecord) => {
    setLocalXReports((list) => [record, ...list]);
    onXReportGenerated?.(record);
  };

  /** Build a fresh X-report from an OPEN session */
  const buildXReportFromSession = (
    session: Session,
    type: XReportRecord["type"] = "MID_SHIFT",
    note?: string,
  ): XReportRecord => {
    const sessionOrdersAll = orders.filter((o) => o.sessionId === session.id);
    const counted = sessionOrdersAll.filter(isCountedSale);

    let cash = 0;
    let card = 0;
    let digital = 0;
    for (const o of counted) {
      const breakdown = Array.isArray(o.paymentBreakdown)
        ? o.paymentBreakdown
        : [];
      if (breakdown.length) {
        for (const t of breakdown) {
          const m = String(t.method || "DIGITAL").toUpperCase();
          const amt = Number(t.amount || 0);
          if (m === "CASH") cash += amt;
          else if (m.includes("CARD")) card += amt;
          else digital += amt;
        }
      } else {
        const m = String(o.paymentMethod || "DIGITAL").toUpperCase();
        const amt = Number(o.grandTotal || 0);
        if (m === "CASH") cash += amt;
        else if (m.includes("CARD")) card += amt;
        else digital += amt;
      }
    }

    const opening = Number(session.openingBalance || 0);
    return {
      id: makeXReportId(),
      sessionId: session.id,
      storeId: session.storeId || storeId,
      storeName,
      staffId: session.userId,
      staffName: session.cashierName || session.userId?.slice(0, 8) || "Staff",
      type,
      openingBalance: opening,
      cashSales: cash,
      cardSales: card,
      digitalSales: digital,
      totalSales: cash + card + digital,
      expectedDrawer: opening + cash,
      orderCount: counted.length,
      createdAt: new Date().toISOString(),
      generatedBy: userId,
      note,
    };
  };

  /** Generate an X-report for a session (mid-shift or final) */
  const handleGenerateXReport = (
    session: Session,
    type: XReportRecord["type"] = "MID_SHIFT",
  ) => {
    const record = buildXReportFromSession(session, type);
    persistXReport(record);

    // Print immediately
    const html = buildXReportHtml(
      record,
      orders.filter((o) => o.sessionId === session.id),
    );
    const printed = printHtml(html);

    setNotice(
      printed
        ? `${type === "FINAL" ? "Z" : "X"}-Report generated · print dialog opened.`
        : `${type === "FINAL" ? "Z" : "X"}-Report saved — popup blocked, downloaded instead.`,
    );
    setTimeout(() => setNotice(""), 3500);
  };

  /* ---------------------- share / download ---------------------- */

  const ordersForRecord = (record: XReportRecord) =>
    orders.filter((o) => o.sessionId === record.sessionId);

  const handleShareXReport = async (record: XReportRecord) => {
    const html = buildXReportHtml(record, ordersForRecord(record));
    const result = await shareXReport(record, html);

    if (result.method === "clipboard") {
      setShareNotice("Summary copied to clipboard");
    } else if (result.method === "files") {
      setShareNotice("X-report file shared");
    } else if (result.method === "text") {
      setShareNotice("Summary shared");
    } else if (result.method === "cancel") {
      setShareNotice("");
    } else {
      // Fallback to download if sharing not supported
      downloadHtml(
        html,
        `${record.type === "FINAL" ? "z" : "x"}-report-${record.sessionId.slice(-6)}.html`,
      );
      setShareNotice("Sharing unavailable — downloaded instead");
    }

    if (result.method !== "cancel") {
      setTimeout(() => setShareNotice(""), 3000);
    }
  };

  const handleDownloadXReport = (record: XReportRecord) => {
    const html = buildXReportHtml(record, ordersForRecord(record));
    downloadHtml(
      html,
      `${record.type === "FINAL" ? "z" : "x"}-report-${record.sessionId.slice(-6)}-${Date.now()}.html`,
    );
    setShareNotice("Report downloaded");
    setTimeout(() => setShareNotice(""), 2500);
  };

  const handleDownloadJsonXReport = (record: XReportRecord) => {
    downloadJson(
      record,
      `${record.type === "FINAL" ? "z" : "x"}-report-${record.sessionId.slice(-6)}.json`,
    );
    setShareNotice("JSON exported");
    setTimeout(() => setShareNotice(""), 2500);
  };

  const handleCopyXReport = async (record: XReportRecord) => {
    const text = [
      `${record.type === "FINAL" ? "Z-Report" : "X-Report"} · ${record.storeName || "Store"}`,
      `Session: #${record.sessionId.slice(-8).toUpperCase()}`,
      `Cashier: ${record.staffName || "Staff"}`,
      `Generated: ${new Date(record.createdAt).toLocaleString()}`,
      `Opening: ${money(record.openingBalance)}`,
      `Cash: ${money(record.cashSales)}`,
      `Card: ${money(record.cardSales)}`,
      `Digital: ${money(record.digitalSales)}`,
      `Total sales: ${money(record.totalSales)}`,
      `Expected drawer: ${money(record.expectedDrawer)}`,
      `Orders: ${record.orderCount}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setShareNotice("Summary copied");
      setTimeout(() => setShareNotice(""), 2500);
    } catch {
      setShareNotice("Copy failed");
      setTimeout(() => setShareNotice(""), 2500);
    }
  };

  const handlePrintXReport = (record: XReportRecord) => {
    const html = buildXReportHtml(record, ordersForRecord(record));
    printHtml(html);
  };

  /* ---------------------- open/close submit --------------------- */

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const amount = Number(balance);
      if (!Number.isFinite(amount) || amount < 0)
        throw new Error("Enter a valid cash amount of zero or more.");
      if (dialog === "open") {
        if (!storeId)
          throw new Error("Select a store before opening the register.");
        const result = (await onOpen(storeId, amount)) as { message?: string };
        setNotice(
          result?.message ||
            `Register opened for ${storeName || "the selected store"}.`,
        );
      } else {
        if (!closingSession || closingSession.status !== "OPEN")
          throw new Error("Choose an open register session.");
        await onClose(sessionId, amount);

        // Generate FINAL (Z) report before closing modal
        const finalRecord = buildXReportFromSession(
          closingSession,
          "FINAL",
          "Generated on shift close",
        );
        persistXReport(finalRecord);

        setNotice(
          "Shift closed. Z-report ready — see the X-Reports list below.",
        );
      }
      setDialog(null);
      setBalance("");
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------- render ------------------------- */

  return (
    <main className="flex-1 overflow-y-auto bg-[#0b1220] p-5 text-slate-100 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">
              Cash control
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Register sessions
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {sessionMode === "SHARED"
                ? "Cashiers at this store use the same open register session."
                : "Each staff member opens and closes their own shift."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Generate X-Report button for active session */}
            {activeSession && (
              <button
                onClick={() =>
                  handleGenerateXReport(activeSession, "MID_SHIFT")
                }
                className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5 text-sm font-bold text-sky-200 hover:bg-sky-400/20"
              >
                <FileText className="h-4 w-4" />
                Generate X-Report
              </button>
            )}

            {closableSessions[0] ? (
              <button
                onClick={() => {
                  setSessionId(closableSessions[0].id);
                  setBalance("");
                  setError("");
                  setDialog("close");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-rose-300"
              >
                <X className="h-4 w-4" />
                {isAdministrator && closableSessions[0].userId !== userId
                  ? "Close open register"
                  : "Close my register"}
              </button>
            ) : activeSession ? (
              <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2.5 text-xs font-bold text-emerald-200">
                Shared register open
              </span>
            ) : (
              <button
                disabled={!storeId}
                onClick={() => {
                  setBalance("");
                  setError("");
                  setDialog("open");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-200 disabled:opacity-40"
              >
                <DoorOpen className="h-4 w-4" />
                Open register
              </button>
            )}
          </div>
        </header>

        {/* Notices */}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200"
          >
            {notice}
          </p>
        )}
        {shareNotice && (
          <p
            role="status"
            className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-sm text-sky-200"
          >
            {shareNotice}
          </p>
        )}

        {/* Overview cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">Selected location</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
              <StoreIcon className="h-4 w-4 text-sky-300" />
              {storeName || "Select a store"}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">Current register</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
              <span
                className={`h-2 w-2 rounded-full ${activeSession ? "bg-emerald-400" : "bg-slate-600"}`}
              />
              {activeSession ? "Open" : "Closed"}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              {activeSession
                ? `Opened by ${activeSession.cashierName || "staff"}`
                : sessionMode === "INDIVIDUAL" && openSessions.length
                  ? "Other staff have an open shift"
                  : "No open session"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">Shift history</p>
            <p className="mt-2 text-sm font-bold text-white">
              {storeSessions.length} sessions
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {allXReports.length} report{allXReports.length === 1 ? "" : "s"}{" "}
              generated
            </p>
          </article>
        </section>

        {/* ================= X-REPORTS LIST ================= */}
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-sky-400" />
              <div>
                <h2 className="font-bold text-white">
                  X-Reports &amp; Z-Reports
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Mid-shift snapshots and end-of-shift reports · tap any row to
                  expand
                </p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-0.5">
              {(
                [
                  { id: "all", label: `All (${allXReports.length})` },
                  {
                    id: "mid",
                    label: `X (${allXReports.filter((r) => r.type === "MID_SHIFT").length})`,
                  },
                  {
                    id: "final",
                    label: `Z (${allXReports.filter((r) => r.type === "FINAL").length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setXReportTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                    xReportTab === tab.id
                      ? "bg-sky-400 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {storeXReports.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-sm font-semibold text-slate-400">
                No X-Reports yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Generate an X-Report from an open session, or close a shift to
                create a Z-Report.
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {storeXReports.map((record) => (
                <XReportRow
                  key={record.id}
                  record={record}
                  orders={ordersForRecord(record)}
                  onPrint={() => handlePrintXReport(record)}
                  onShare={() => handleShareXReport(record)}
                  onDownload={() => handleDownloadXReport(record)}
                  onDownloadJson={() => handleDownloadJsonXReport(record)}
                  onCopy={() => handleCopyXReport(record)}
                />
              ))}

              {/* JSON export for all */}
              {storeXReports.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    downloadJson(
                      storeXReports,
                      `x-reports-${storeId || "all"}-${new Date().toISOString().slice(0, 10)}.json`,
                    );
                    setShareNotice("All reports exported as JSON");
                    setTimeout(() => setShareNotice(""), 2500);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 py-2 text-[10px] font-bold text-slate-400 hover:border-slate-600 hover:text-white"
                >
                  <Download className="h-3 w-3" />
                  Export all {storeXReports.length} reports as JSON
                </button>
              )}
            </div>
          )}
        </section>

        {/* ================= RECENT SHIFTS ================= */}
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="font-bold text-white">Recent shifts</h2>
              <p className="mt-1 text-xs text-slate-500">
                {storeName
                  ? `History for ${storeName}`
                  : "All available store sessions"}
              </p>
            </div>
            <Clock3 className="h-4 w-4 text-slate-500" />
          </div>

          {!storeSessions.length ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No register sessions found. Open the register to begin a shift.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {storeSessions.map((session) => (
                <article
                  key={session.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="text-sm font-bold text-white">
                      {session.cashierName || "Staff member"}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      {session.id.slice(0, 12)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Opened
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {new Date(session.openedAt).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Opening float
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-200">
                      {money(session.openingBalance)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Closing count
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-200">
                      {session.closingBalance == null
                        ? "—"
                        : money(session.closingBalance)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                        session.status === "OPEN"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {session.status}
                    </span>

                    {session.status === "OPEN" && (
                      <button
                        onClick={() =>
                          handleGenerateXReport(session, "MID_SHIFT")
                        }
                        title="Generate X-Report"
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 px-2.5 py-1.5 text-[10px] font-bold text-sky-200 hover:bg-sky-400/10"
                      >
                        <FileText className="h-3 w-3" />X
                      </button>
                    )}

                    {session.status === "OPEN" &&
                      (isAdministrator || session.userId === userId) && (
                        <button
                          onClick={() => {
                            setSessionId(session.id);
                            setBalance("");
                            setError("");
                            setDialog("close");
                          }}
                          className="rounded-lg border border-rose-400/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-200 hover:bg-rose-400/10"
                        >
                          Close shift
                        </button>
                      )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Cash totals are recorded by the server during checkout. Enter the
          physical drawer count when closing so the server can calculate the
          shift discrepancy. X-Reports are mid-shift snapshots — Z-Reports are
          created on close. Reports &amp; analytics → Today shows daily sales
          across shifts.
        </p>
      </div>

      {/* ================= OPEN / CLOSE DIALOG ================= */}
      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#101a2b] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {dialog === "open" ? "Open register" : "Close register"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {dialog === "open"
                    ? `Opening float · ${storeName || "selected store"}`
                    : "Count the physical cash in the drawer."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
              >
                ×
              </button>
            </div>

            {dialog === "close" && closingSession && (
              <section className="mb-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="text-slate-400">
                    Orders{" "}
                    <strong className="float-right text-white">
                      {countedOrders.length}
                    </strong>
                  </p>
                  <p className="text-slate-400">
                    Sales{" "}
                    <strong className="float-right text-white">
                      {money(salesTotal)}
                    </strong>
                  </p>
                  <p className="text-slate-400">
                    Cash sales{" "}
                    <strong className="float-right text-white">
                      {money(cashSales)}
                    </strong>
                  </p>
                  <p className="text-slate-400">
                    Card sales{" "}
                    <strong className="float-right text-white">
                      {money(tenderTotals.card)}
                    </strong>
                  </p>
                  <p className="text-slate-400">
                    Digital sales{" "}
                    <strong className="float-right text-white">
                      {money(tenderTotals.digital)}
                    </strong>
                  </p>
                  <p className="text-slate-400">
                    Expected drawer{" "}
                    <strong className="float-right text-white">
                      {money(expectedCash)}
                    </strong>
                  </p>
                </div>

                <div className="max-h-28 overflow-y-auto border-t border-slate-800 pt-2">
                  {sessionOrders.length ? (
                    sessionOrders.map((order) => (
                      <p
                        key={order.id}
                        className="flex justify-between gap-2 py-1 text-[11px] text-slate-400"
                      >
                        <span className="truncate">
                          {order.orderNumber || order.id.slice(0, 10)} -{" "}
                          {String(order.status).toLowerCase()}
                        </span>
                        <strong className="shrink-0 text-slate-200">
                          {money(order.grandTotal)}
                        </strong>
                      </p>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No synced sales are linked to this shift.
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-400">
                  Difference after count{" "}
                  <strong className="float-right text-amber-200">
                    {balance ? money(cashDifference) : "Enter closing cash"}
                  </strong>
                </p>

                <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[10px] text-sky-200">
                  A Z-Report will be auto-generated on close and added to the
                  X-Reports list.
                </p>
              </section>
            )}

            <label className="block text-xs font-semibold text-slate-400">
              {dialog === "open"
                ? "Opening cash (MMK)"
                : "Closing cash count (MMK)"}
              <input
                autoFocus
                required
                type="number"
                min="0"
                step="1"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                placeholder="0"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-400"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200"
              >
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {busy ? (
                  "Saving…"
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {dialog === "open" ? "Start shift" : "Close shift"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

// import { FormEvent, useMemo, useState } from "react";
// import { Check, Clock3, DoorOpen, Store as StoreIcon, X } from "lucide-react";
// import { ApiOrder, Session } from "../store/apiSlice";

// interface SessionsViewProps {
//   sessions?: Session[]; orders?: ApiOrder[]; storeId?: string; storeName?: string;
//   userId?: string; userRole?: string; sessionMode?: "SHARED" | "INDIVIDUAL";
//   onOpen: (storeId: string, openingBalance: number) => Promise<unknown>;
//   onClose: (sessionId: string, closingBalance: number) => Promise<unknown>;
// }
// const money = (value: number) => `${Number(value || 0).toLocaleString()} MMK`;
// const errText = (error: unknown) => {
//   const value = error as {
//     data?: string | { message?: string; error?: string };
//     message?: string;
//     error?: string;
//     status?: string | number;
//   };
//   const serverMessage = typeof value.data === "string"
//     ? value.data.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)
//     : value.data?.message || value.data?.error;
//   return serverMessage || value.message || value.error ||
//     (value.status ? `Register request failed (${value.status}).` : "Register request failed. Check your connection and try again.");
// };
// const isCountedSale = (order: ApiOrder) => {
//   const status = String(order.status || "").toUpperCase();
//   const paymentStatus = String(order.paymentStatus || "").toUpperCase();
//   return !["VOIDED", "CANCELLED", "REFUNDED"].includes(status) &&
//     (status === "COMPLETED" || paymentStatus === "PAID");
// };

// export function SessionsView({ sessions = [], orders = [], storeId, storeName, userId, userRole = "CASHIER", sessionMode = "SHARED", onOpen, onClose }: SessionsViewProps) {
//   const [dialog, setDialog] = useState<"open" | "close" | null>(null);
//   const [sessionId, setSessionId] = useState("");
//   const [balance, setBalance] = useState("");
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState("");
//   const [notice, setNotice] = useState("");
//   const storeSessions = useMemo(() => sessions.filter((session) => !storeId || session.storeId === storeId), [sessions, storeId]);
//   const openSessions = storeSessions.filter((session) => session.status === "OPEN");
//   const isAdministrator = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
//   const ownOpenSession = openSessions.find((session) => session.userId === userId);
//   const activeSession = sessionMode === "SHARED" ? openSessions[0] : ownOpenSession;
//   const closableSessions = openSessions.filter((session) => isAdministrator || session.userId === userId);
//   const closingSession = storeSessions.find((session) => session.id === sessionId);
//   const sessionOrders = orders.filter((order) => order.sessionId === closingSession?.id);
//   const countedOrders = sessionOrders.filter(isCountedSale);
//   const salesTotal = countedOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
//   const tenderTotals = countedOrders.reduce(
//     (totals, order) => {
//       const breakdown = Array.isArray(order.paymentBreakdown) ? order.paymentBreakdown : [];
//       const tenders = breakdown.length ? breakdown : [{ method: order.paymentMethod || "CASH", amount: order.grandTotal }];
//       tenders.forEach((payment) => {
//         const method = String(payment.method || "DIGITAL").toUpperCase();
//         if (method === "CASH") totals.cash += Number(payment.amount || 0);
//         else if (method.includes("CARD")) totals.card += Number(payment.amount || 0);
//         else totals.digital += Number(payment.amount || 0);
//       });
//       return totals;
//     },
//     { cash: 0, card: 0, digital: 0 },
//   );
//   const cashSales = tenderTotals.cash;
//   const expectedCash = Number(closingSession?.openingBalance || 0) + cashSales;
//   const cashDifference = (Number(balance) || 0) - expectedCash;
//   const submit = async (event: FormEvent) => {
//     event.preventDefault(); setBusy(true); setError(""); setNotice("");
//     try {
//       const amount = Number(balance);
//       if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid cash amount of zero or more.");
//       if (dialog === "open") {
//         if (!storeId) throw new Error("Select a store before opening the register.");
//         const result = await onOpen(storeId, amount) as { message?: string };
//         setNotice(result?.message || `Register opened for ${storeName || "the selected store"}.`);
//       } else {
//         if (!closingSession || closingSession.status !== "OPEN") throw new Error("Choose an open register session.");
//         await onClose(sessionId, amount); setNotice("Shift closed. Review its sales and cash reconciliation in session history.");
//       }
//       setDialog(null); setBalance("");
//     } catch (cause) { setError(errText(cause)); }
//     finally { setBusy(false); }
//   };

//   return <main className="flex-1 overflow-y-auto bg-[#0b1220] p-5 text-slate-100 lg:p-8"><div className="mx-auto max-w-6xl space-y-6">
//     <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">Cash control</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white">Register sessions</h1><p className="mt-2 text-sm text-slate-400">{sessionMode === "SHARED" ? "Cashiers at this store use the same open register session." : "Each staff member opens and closes their own shift."}</p></div><div className="flex gap-2">{closableSessions[0] ? <button onClick={() => { setSessionId(closableSessions[0].id); setBalance(""); setError(""); setDialog("close"); }} className="inline-flex items-center gap-2 rounded-xl bg-rose-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-rose-300"><X className="h-4 w-4" />{isAdministrator && closableSessions[0].userId !== userId ? "Close open register" : "Close my register"}</button> : activeSession ? <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2.5 text-xs font-bold text-emerald-200">Shared register open</span> : <button disabled={!storeId} onClick={() => { setBalance(""); setError(""); setDialog("open"); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-200 disabled:opacity-40"><DoorOpen className="h-4 w-4" />Open register</button>}</div></header>
//     {notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</p>}
//     <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Selected location</p><div className="mt-2 flex items-center gap-2 text-sm font-bold text-white"><StoreIcon className="h-4 w-4 text-sky-300" />{storeName || "Select a store"}</div></article><article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Current register</p><div className="mt-2 flex items-center gap-2 text-sm font-bold text-white"><span className={`h-2 w-2 rounded-full ${activeSession ? "bg-emerald-400" : "bg-slate-600"}`} />{activeSession ? "Open" : "Closed"}</div><p className="mt-1 text-[10px] text-slate-500">{activeSession ? `Opened by ${activeSession.cashierName || "staff"}` : sessionMode === "INDIVIDUAL" && openSessions.length ? "Other staff have an open shift" : "No open session"}</p></article><article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs text-slate-500">Shift history</p><p className="mt-2 text-sm font-bold text-white">{storeSessions.length} sessions</p></article></section>
//     <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="font-bold text-white">Recent shifts</h2><p className="mt-1 text-xs text-slate-500">{storeName ? `History for ${storeName}` : "All available store sessions"}</p></div><Clock3 className="h-4 w-4 text-slate-500" /></div>{!storeSessions.length ? <div className="p-12 text-center text-sm text-slate-500">No register sessions found. Open the register to begin a shift.</div> : <div className="divide-y divide-slate-800/80">{storeSessions.map((session) => <article key={session.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center"><div><p className="text-sm font-bold text-white">{session.cashierName || "Staff member"}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{session.id.slice(0, 12)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Opened</p><p className="mt-1 text-xs text-slate-300">{new Date(session.openedAt).toLocaleString()}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Opening float</p><p className="mt-1 text-xs font-semibold text-slate-200">{money(session.openingBalance)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Closing count</p><p className="mt-1 text-xs font-semibold text-slate-200">{session.closingBalance == null ? "—" : money(session.closingBalance)}</p></div><div className="flex items-center gap-2"><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold ${session.status === "OPEN" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{session.status}</span>{session.status === "OPEN" && (isAdministrator || session.userId === userId) && <button onClick={() => { setSessionId(session.id); setBalance(""); setError(""); setDialog("close"); }} className="rounded-lg border border-rose-400/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-200 hover:bg-rose-400/10">Close shift</button>}</div></article>)}</div>}</section>
//     <p className="text-xs leading-5 text-slate-500">Cash totals are recorded by the server during checkout. Enter the physical drawer count when closing so the server can calculate the shift discrepancy. Reports &amp; analytics → Today shows daily sales across shifts.</p>
//   </div>
//   {dialog && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#101a2b] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold text-white">{dialog === "open" ? "Open register" : "Close register"}</h2><p className="mt-1 text-xs text-slate-500">{dialog === "open" ? `Opening float · ${storeName || "selected store"}` : "Count the physical cash in the drawer."}</p></div><button type="button" onClick={() => setDialog(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white">×</button></div>{dialog === "close" && closingSession && <section className="mb-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="grid grid-cols-2 gap-2 text-xs"><p className="text-slate-400">Orders <strong className="float-right text-white">{countedOrders.length}</strong></p><p className="text-slate-400">Sales <strong className="float-right text-white">{money(salesTotal)}</strong></p><p className="text-slate-400">Cash sales <strong className="float-right text-white">{money(cashSales)}</strong></p><p className="text-slate-400">Card sales <strong className="float-right text-white">{money(tenderTotals.card)}</strong></p><p className="text-slate-400">Digital sales <strong className="float-right text-white">{money(tenderTotals.digital)}</strong></p><p className="text-slate-400">Expected drawer <strong className="float-right text-white">{money(expectedCash)}</strong></p></div><div className="max-h-28 overflow-y-auto border-t border-slate-800 pt-2">{sessionOrders.length ? sessionOrders.map(order => <p key={order.id} className="flex justify-between gap-2 py-1 text-[11px] text-slate-400"><span className="truncate">{order.orderNumber || order.id.slice(0, 10)} - {String(order.status).toLowerCase()}</span><strong className="shrink-0 text-slate-200">{money(order.grandTotal)}</strong></p>) : <p className="text-[11px] text-slate-500">No synced sales are linked to this shift.</p>}</div><p className="text-xs text-slate-400">Difference after count <strong className="float-right text-amber-200">{balance ? money(cashDifference) : "Enter closing cash"}</strong></p></section>}<label className="block text-xs font-semibold text-slate-400">{dialog === "open" ? "Opening cash (MMK)" : "Closing cash count (MMK)"}<input autoFocus required type="number" min="0" step="1" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-400" /></label>{error && <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDialog(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">Cancel</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{busy ? "Saving…" : <><Check className="h-4 w-4" />{dialog === "open" ? "Start shift" : "Close shift"}</>}</button></div></form></div>}
//   </main>;
// }
