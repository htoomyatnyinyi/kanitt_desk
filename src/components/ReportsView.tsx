import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  DollarSign,
  Package,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ApiOrder } from "../store/apiSlice";
import { Product } from "../types";

interface ReportsViewProps {
  orders: ApiOrder[];
  products: Product[];
  expenses?: any[];
  returns?: any[];
  purchaseOrders?: any[];
  isLoading?: boolean;
}

const fmt = (num: number) => `${Math.round(num).toLocaleString()} MMK`;

export function ReportsView({
  orders = [],
  products = [],
  expenses = [],
}: ReportsViewProps) {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [activeTab, setActiveTab] = useState<"sales" | "profit" | "stock" | "products">("sales");

  // Date filtering logic
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();

    if (range === "today") {
      cutoff.setHours(0, 0, 0, 0);
    } else if (range === "7d") {
      cutoff.setDate(now.getDate() - 7);
    } else if (range === "30d") {
      cutoff.setDate(now.getDate() - 30);
    } else {
      return orders.filter((o) => o.status === "COMPLETED" || o.paymentStatus === "PAID");
    }

    return orders.filter((o) => {
      const isPaid = o.status === "COMPLETED" || o.paymentStatus === "PAID";
      return isPaid && new Date(o.createdAt) >= cutoff;
    });
  }, [orders, range]);

  // Key Financial Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const totalDiscounts = filteredOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const totalTax = filteredOrders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const totalOrderCount = filteredOrders.length;
    const avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

    // Filter expenses in range
    const cutoff = new Date();
    if (range === "today") cutoff.setHours(0, 0, 0, 0);
    else if (range === "7d") cutoff.setDate(cutoff.getDate() - 7);
    else if (range === "30d") cutoff.setDate(cutoff.getDate() - 30);
    else cutoff.setTime(0);

    const periodExpenses = expenses
      .filter((e) => range === "all" || new Date(e.expenseDate || e.createdAt) >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Calculate COGS estimated from catalog unit costs if available, or estimated 70% cost basis
    let estimatedCost = 0;
    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item: any) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod?.costPrice ?? item.unitPrice * 0.7;
        estimatedCost += unitCost * item.quantity;
      });
    });

    const grossProfit = totalRevenue - estimatedCost;
    const netProfit = grossProfit - periodExpenses;

    // Stock Valuation Metrics
    const totalStockQty = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalStockRetailVal = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);
    const totalStockCostVal = products.reduce((sum, p) => sum + (p.costPrice ?? p.price * 0.7) * (p.stock || 0), 0);

    return {
      totalRevenue,
      totalDiscounts,
      totalTax,
      totalOrderCount,
      avgOrderValue,
      periodExpenses,
      estimatedCost,
      grossProfit,
      netProfit,
      totalStockQty,
      totalStockRetailVal,
      totalStockCostVal,
    };
  }, [filteredOrders, expenses, products, range]);

  // Product sales ranking breakdown
  const productRanking = useMemo(() => {
    const map: Record<string, { name: string; sku: string; qty: number; revenue: number }> = {};
    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item: any) => {
        const id = item.productId || item.product?.id || "unknown";
        const name = item.product?.name || "Product " + id.slice(0, 6);
        const sku = item.product?.sku || "—";
        if (!map[id]) {
          map[id] = { name, sku, qty: 0, revenue: 0 };
        }
        map[id].qty += item.quantity || 1;
        map[id].revenue += item.subTotal || item.unitPrice * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Daily Trend Breakdown (for chart view)
  const dailyTrends = useMemo(() => {
    const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 14;
    const list = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toISOString().slice(0, 10);

      const dayOrders = filteredOrders.filter(
        (o) => new Date(o.createdAt).toISOString().slice(0, 10) === dateStr
      );
      const rev = dayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      return {
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: rev,
        count: dayOrders.length,
      };
    });
    const maxRev = Math.max(1, ...list.map((l) => l.revenue));
    return { list, maxRev };
  }, [filteredOrders, range]);

  // CSV Export handler
  const exportCSV = () => {
    const headers = ["Order Number", "Date", "Items Count", "Subtotal", "Tax", "Discount", "Grand Total", "Payment Method"];
    const rows = filteredOrders.map((o) => [
      o.orderNumber || o.id,
      new Date(o.createdAt).toLocaleString(),
      o.items?.length || 0,
      o.subTotal || 0,
      o.taxAmount || 0,
      o.discountAmount || 0,
      o.grandTotal,
      o.paymentMethod || "CASH",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kanitt_sales_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#0b1220] p-6 text-slate-100 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Header & Range Controls */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-400">Analytics & Insights</p>
            <h1 className="mt-1 text-3xl font-black text-white">Reports & Financial Breakdown</h1>
            <p className="mt-1 text-sm text-slate-400">Track revenue, margins, stock valuation, and operational profitability.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Time range selector */}
            <div className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1">
              {(["today", "7d", "30d", "all"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    range === r ? "bg-sky-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r === "today" ? "Today" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
                </button>
              ))}
            </div>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </header>

        {/* Primary Metric KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
              <span className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300">
                <Wallet className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-black text-white">{fmt(metrics.totalRevenue)}</p>
            <p className="mt-1 text-xs text-slate-500">{metrics.totalOrderCount} completed transactions</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Profit</span>
              <span className={`rounded-xl p-2 ${metrics.netProfit >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
                <TrendingUp className="h-5 w-5" />
              </span>
            </div>
            <p className={`mt-4 text-2xl font-black ${metrics.netProfit >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
              {fmt(metrics.netProfit)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Gross {fmt(metrics.grossProfit)} - Exp {fmt(metrics.periodExpenses)}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg. Order Value</span>
              <span className="rounded-xl bg-sky-400/10 p-2 text-sky-300">
                <DollarSign className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-black text-white">{fmt(metrics.avgOrderValue)}</p>
            <p className="mt-1 text-xs text-slate-500">Per basket average</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Stock Retail Value</span>
              <span className="rounded-xl bg-amber-400/10 p-2 text-amber-300">
                <Package className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-black text-white">{fmt(metrics.totalStockRetailVal)}</p>
            <p className="mt-1 text-xs text-slate-500">{metrics.totalStockQty.toLocaleString()} units in inventory</p>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav className="flex gap-2 border-b border-slate-800 pb-3">
          {[
            { id: "sales", label: "Sales Trend", icon: BarChart3 },
            { id: "profit", label: "Profit & Margins", icon: TrendingUp },
            { id: "stock", label: "Stock Valuation", icon: Package },
            { id: "products", label: "Top Selling Items", icon: PieChart },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                activeTab === id ? "bg-sky-400/10 text-sky-200 ring-1 ring-sky-400/20" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        {/* Tab Content Section */}
        {activeTab === "sales" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Daily Revenue Trend</h3>
                <p className="text-xs text-slate-400">Sales volume performance across selected timeframe</p>
              </div>
            </div>

            <div className="flex h-56 items-end gap-3 border-b border-slate-800 pb-4 pt-6">
              {dailyTrends.list.map((day) => (
                <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="truncate text-[10px] text-slate-400">
                    {day.revenue ? `${Math.round(day.revenue / 1000)}k` : ""}
                  </span>
                  <div
                    className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-sky-600 to-emerald-400 transition-all hover:brightness-110"
                    style={{ height: `${Math.max(day.revenue ? 6 : 2, (day.revenue / dailyTrends.maxRev) * 85)}%` }}
                    title={`${day.label}: ${fmt(day.revenue)} (${day.count} orders)`}
                  />
                  <span className="text-[10px] font-semibold text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                <p className="text-[10px] font-bold uppercase text-slate-500">Gross Sales</p>
                <p className="mt-1 text-lg font-extrabold text-white">{fmt(metrics.totalRevenue + metrics.totalDiscounts)}</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                <p className="text-[10px] font-bold uppercase text-slate-500">Total Discounts Granted</p>
                <p className="mt-1 text-lg font-extrabold text-amber-300">-{fmt(metrics.totalDiscounts)}</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                <p className="text-[10px] font-bold uppercase text-slate-500">Total Tax Collected</p>
                <p className="mt-1 text-lg font-extrabold text-sky-300">+{fmt(metrics.totalTax)}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "profit" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Profitability Breakdown</h3>

            <div className="divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-slate-300">Net Sales Revenue</span>
                <span className="font-mono text-sm font-bold text-white">{fmt(metrics.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-900/30">
                <span className="text-sm text-slate-400">Estimated Cost of Goods Sold (COGS)</span>
                <span className="font-mono text-sm font-bold text-rose-300">-{fmt(metrics.estimatedCost)}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-bold text-sky-300">Gross Profit</span>
                <span className="font-mono text-sm font-extrabold text-sky-300">{fmt(metrics.grossProfit)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-900/30">
                <span className="text-sm text-slate-400">Operating Expenses</span>
                <span className="font-mono text-sm font-bold text-rose-300">-{fmt(metrics.periodExpenses)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-400/[0.04]">
                <span className="text-base font-black text-white">Estimated Net Operating Income</span>
                <span className={`font-mono text-lg font-black ${metrics.netProfit >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                  {fmt(metrics.netProfit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "stock" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Inventory Valuation & Assets</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-xs text-slate-500">Retail Inventory Value</p>
                <p className="mt-2 text-xl font-bold text-emerald-300">{fmt(metrics.totalStockRetailVal)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-xs text-slate-500">Asset Cost Basis</p>
                <p className="mt-2 text-xl font-bold text-sky-300">{fmt(metrics.totalStockCostVal)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-xs text-slate-500">Potential Retail Margin</p>
                <p className="mt-2 text-xl font-bold text-amber-300">{fmt(metrics.totalStockRetailVal - metrics.totalStockCostVal)}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Top Performing Products</h3>
              <p className="text-xs text-slate-400">Ranked by revenue contributed</p>
            </div>
            {productRanking.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No product sales in selected timeframe.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {productRanking.slice(0, 15).map((item, idx) => (
                  <div key={item.name + idx} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30">
                    <div className="flex items-center gap-4">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-800 font-mono text-xs font-bold text-slate-300">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-emerald-300">{fmt(item.revenue)}</p>
                      <p className="text-xs text-slate-400">{item.qty} units sold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
