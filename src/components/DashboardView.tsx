import { Activity, ArrowDownRight, ArrowUpRight, Package, ReceiptText, Wallet } from "lucide-react";
import { ApiOrder } from "../store/apiSlice";
import { Product } from "../types";

const money = (amount: number) => `${amount.toLocaleString()} MMK`;

export function DashboardView({ orders, products, loading, onOpenOrders, onOpenInventory }: { orders: ApiOrder[]; products: Product[]; loading: boolean; onOpenOrders: () => void; onOpenInventory: () => void }) {
  const today = new Date();
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today.toDateString());
  const paidOrders = todayOrders.filter((order) => order.status === "COMPLETED" || order.paymentStatus === "PAID");
  const revenue = paidOrders.reduce((total, order) => total + order.grandTotal, 0);
  const lowStock = products.filter((product) => product.stock <= 5);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - 6 + index);
    const dayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === day.toDateString() && (order.status === "COMPLETED" || order.paymentStatus === "PAID"));
    return { label: day.toLocaleDateString(undefined, { weekday: "short" }), amount: dayOrders.reduce((sum, order) => sum + order.grandTotal, 0) };
  });
  const maxRevenue = Math.max(1, ...week.map((day) => day.amount));
  const metrics = [
    { label: "Today's sales", value: loading ? "…" : money(revenue), detail: `${paidOrders.length} completed orders`, icon: Wallet, tone: "text-emerald-300 bg-emerald-400/10" },
    { label: "Orders today", value: loading ? "…" : todayOrders.length.toLocaleString(), detail: `${orders.length} recent orders loaded`, icon: ReceiptText, tone: "text-sky-300 bg-sky-400/10" },
    { label: "Products", value: loading ? "…" : products.length.toLocaleString(), detail: `${lowStock.length} at or below 5 units`, icon: Package, tone: "text-amber-300 bg-amber-400/10" },
  ];

  return <main className="flex-1 overflow-y-auto p-7">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Workspace overview</p><h1 className="mt-2 text-3xl font-black text-white">Good {new Date().getHours() < 12 ? "morning" : "day"}</h1><p className="mt-1 text-sm text-slate-400">A live snapshot of the selected store.</p></div>
      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">{today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
    </header>
    <section className="grid gap-4 md:grid-cols-3">
      {metrics.map(({ label, value, detail, icon: Icon, tone }) => <article key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><span className={`rounded-xl p-2 ${tone}`}><Icon className="h-5 w-5" /></span></div><p className="mt-5 text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>)}
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-white">Sales · last 7 days</h2><p className="mt-1 text-xs text-slate-500">Completed and paid orders</p></div><Activity className="h-5 w-5 text-sky-300" /></div><div className="mt-7 flex h-48 items-end gap-3 border-b border-slate-800 pb-2">{week.map((day) => <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="max-w-full truncate text-[10px] text-slate-500">{day.amount ? (day.amount / 1000).toFixed(0) + "k" : ""}</span><div className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-sky-600 to-emerald-300" style={{ height: `${Math.max(day.amount ? 8 : 2, (day.amount / maxRevenue) * 72)}%` }} /><span className="text-[10px] text-slate-500">{day.label}</span></div>)}</div></article>
      <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-white">Needs attention</h2><p className="mt-1 text-xs text-slate-500">Based on current inventory</p></div>{lowStock.length ? <ArrowDownRight className="h-5 w-5 text-amber-300" /> : <ArrowUpRight className="h-5 w-5 text-emerald-300" />}</div>{lowStock.length ? <ul className="mt-4 space-y-2">{lowStock.slice(0, 5).map((product) => <li key={product.id} className="flex justify-between gap-3 rounded-xl bg-slate-950/70 px-3 py-2.5"><span className="truncate text-sm text-slate-200">{product.name}</span><span className="shrink-0 text-xs font-bold text-amber-300">{product.stock} left</span></li>)}</ul> : <p className="mt-5 rounded-xl bg-slate-950/70 p-4 text-sm text-slate-400">No low stock products in the loaded inventory.</p>}<button onClick={onOpenInventory} className="mt-4 text-xs font-bold text-sky-300 hover:text-sky-200">Review inventory →</button></article>
    </section>
    <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-white">Recent orders</h2><p className="mt-1 text-xs text-slate-500">Latest records from the server</p></div><button onClick={onOpenOrders} className="text-xs font-bold text-sky-300 hover:text-sky-200">View orders →</button></div>{orders.slice(0, 5).length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No orders found.</p> : <div className="divide-y divide-slate-800">{orders.slice(0, 5).map((order) => <div key={order.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{order.orderNumber || order.id.slice(0, 8)}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p></div><div className="text-right"><p className="text-sm font-bold text-white">{money(order.grandTotal)}</p><p className="text-[10px] uppercase text-slate-500">{order.status}</p></div></div>)}</div>}</section>
  </main>;
}
