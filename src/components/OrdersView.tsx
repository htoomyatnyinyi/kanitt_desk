import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { ApiOrder } from "../store/apiSlice";
import { ReceiptModal, ReceiptData } from "./ReceiptModal";

export function OrdersView({
  orders,
  isLoading,
}: {
  orders: ApiOrder[];
  isLoading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(
    null,
  );
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const visible = useMemo(
    () =>
      orders.filter((order) => {
        const matchesStatus = status === "ALL" || order.status === status;
        const query = search.trim().toLowerCase();
        return (
          matchesStatus &&
          (!query ||
            `${order.orderNumber ?? ""} ${order.user?.name ?? ""} ${order.user?.email ?? ""}`
              .toLowerCase()
              .includes(query))
        );
      }),
    [orders, search, status],
  );

  const totalItems = visible.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    if (pageSize <= 0) return visible;
    const start = (activePage - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, activePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const endItem =
    pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

  const printOrderReceipt = (order: ApiOrder) => {
    const data: ReceiptData = {
      orderNumber: order.orderNumber || order.id.slice(0, 8),
      createdAt: order.createdAt,
      storeId: order.storeId,
      storeName: order.store?.name,
      storeAddress: order.store?.address,
      storePhone: order.store?.phone,
      items: (order.items || []).map((item) => ({
        name: item.product?.name || "Product",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subTotal: item.subTotal,
      })),
      subTotal: order.subTotal ?? order.grandTotal,
      taxAmount: order.taxAmount ?? 0,
      discountAmount: order.discountAmount ?? 0,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod || "CASH",
      payments: order.paymentBreakdown?.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
      })),
      cashierName: order.user?.name || order.user?.email,
    };
    setSelectedReceipt(data);
  };

  return (
    // Mobile တွင် Padding လျှော့ချခြင်း
    <main className="flex-1 overflow-y-auto p-4 md:p-7">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
          Sales
        </p>
        <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
          Orders
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Search and review orders from this store.
        </p>
      </header>

      {/* Filters Section - Mobile တွင် အောက်ခြေချင်း စုပုံပြသမည် */}
      <section className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-1">
          <label className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search order number or cashier..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-sky-500"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 outline-none md:w-auto"
          >
            <option value="ALL">All statuses</option>
            {[...new Set(orders.map((order) => order.status))].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between md:justify-end">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Per page:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-sky-500"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        {/* Desktop အတွက်သာ ပြသမည့် Table Header */}
        <div className="hidden md:grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>Order</span>
          <span>Date</span>
          <span>Cashier</span>
          <span className="text-right">Total</span>
          <span>Status</span>
        </div>

        {isLoading ? (
          <p className="p-10 text-center text-sm text-slate-400">
            Loading orders…
          </p>
        ) : paginatedOrders.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            No orders match these filters.
          </p>
        ) : (
          paginatedOrders.map((order) => (
            <div
              key={order.id}
              className="border-b border-slate-800/70 last:border-0"
            >
              {/* Order Row - Mobile တွင် Card ပုံစံ၊ Desktop တွင် Grid ပုံစံပြောင်းလဲခြင်း */}
              <button
                onClick={() =>
                  setExpanded(expanded === order.id ? null : order.id)
                }
                className="flex w-full flex-col gap-3 p-4 text-left hover:bg-slate-800/40 md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center md:gap-4 md:px-5 md:py-4"
              >
                {/* Mobile View: အပေါ်တန်း (Order No နှင့် Total) */}
                <div className="flex items-center justify-between md:contents">
                  <span className="truncate text-sm font-semibold text-white">
                    {order.orderNumber || order.id.slice(0, 8)}
                  </span>
                  <span className="text-sm font-bold text-white md:hidden">
                    {order.grandTotal.toLocaleString()} MMK
                  </span>
                </div>

                {/* Desktop View: Date, Cashier, Total Columns */}
                <span className="hidden md:block text-xs text-slate-400">
                  {new Date(order.createdAt).toLocaleString()}
                </span>
                <span className="hidden md:block truncate text-xs text-slate-300">
                  {order.user?.name || order.user?.email || "—"}
                </span>
                <span className="hidden md:block text-right text-sm font-bold text-white">
                  {order.grandTotal.toLocaleString()} MMK
                </span>

                {/* Mobile View: အောက်တန်း (Date, Cashier နှင့် Status) */}
                <div className="flex items-end justify-between md:contents">
                  <div className="flex flex-col gap-1 md:hidden">
                    <span className="text-[10px] text-slate-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      {order.user?.name || order.user?.email || "—"}
                    </span>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${order.status === "COMPLETED" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}
                  >
                    {order.status}
                  </span>
                </div>
              </button>

              {/* Expanded Details */}
              {expanded === order.id && (
                <div className="bg-slate-950/60 px-4 py-4 md:px-5">
                  {order.items?.length ? (
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-4 text-xs"
                        >
                          <span className="text-slate-300">
                            {item.product?.name || "Product"} × {item.quantity}
                          </span>
                          <span className="text-slate-400">
                            {Number(item.subTotal).toLocaleString()} MMK
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No line item detail returned.
                    </p>
                  )}
                  <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-800 pt-3 text-xs text-slate-500 md:flex-row md:items-center">
                    <span>
                      Payment: {order.paymentMethod || "—"} ·{" "}
                      {order.paymentStatus || order.status}
                    </span>
                    <button
                      onClick={() => printOrderReceipt(order)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-slate-700 hover:text-white md:w-auto md:py-1.5"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print receipt
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* Pagination - Mobile တွင် အောက်ခြေချင်း စုပုံပြသမည် */}
      {totalItems > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 px-2 md:flex-row md:gap-4">
          <p className="text-center text-xs text-slate-400 md:text-left">
            Showing{" "}
            <strong className="text-white">{startItem.toLocaleString()}</strong>{" "}
            to{" "}
            <strong className="text-white">{endItem.toLocaleString()}</strong>{" "}
            of{" "}
            <strong className="text-white">
              {totalItems.toLocaleString()}
            </strong>{" "}
            orders
          </p>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-400 px-2">
                Page <strong className="text-white">{activePage}</strong> of{" "}
                {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={activePage >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <ReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </main>
  );
}
