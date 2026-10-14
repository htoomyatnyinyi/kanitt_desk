import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ApiOrder } from "../store/apiSlice";
import { Product } from "../types";

const money = (amount: number) => `${amount.toLocaleString()} MMK`;

/* ---------- Area Chart (pure SVG) ---------- */
function AreaChart({
  data,
  height = 200,
}: {
  data: { label: string; amount: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const padX = 24;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const max = Math.max(1, ...data.map((d) => d.amount));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - (d.amount / max) * innerH,
    ...d,
  }));

  // Smooth cubic-bezier path
  const linePath = points
    .map((p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    padY + innerH
  } L ${points[0].x} ${padY + innerH} Z`;

  return (
    <div className="relative mt-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full overflow-visible"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="areaStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + innerH - t * innerH;
          return (
            <line
              key={t}
              x1={padX}
              x2={padX + innerW}
              y1={y}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaFill)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#areaStroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points + hover hit area */}
        {points.map((p, i) => (
          <g key={p.label + i}>
            {/* invisible hover target */}
            <rect
              x={p.x - stepX / 2}
              y={padY}
              width={stepX || innerW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 3}
              fill="#0f172a"
              stroke={hover === i ? "#34d399" : "#38bdf8"}
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>

      {/* X-axis labels */}
      <div className="mt-1 flex justify-between px-2">
        {data.map((d) => (
          <span key={d.label} className="text-[10px] text-slate-500">
            {d.label}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-center shadow-xl"
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: `${(points[hover].y / height) * 100}%`,
          }}
        >
          <p className="text-[10px] text-slate-400">{points[hover].label}</p>
          <p className="text-xs font-bold text-sky-300">
            {money(points[hover].amount)}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Dashboard ---------- */
export function DashboardView({
  orders,
  products,
  loading,
  onOpenOrders,
  onOpenInventory,
}: {
  orders: ApiOrder[];
  products: Product[];
  loading: boolean;
  onOpenOrders: () => void;
  onOpenInventory: () => void;
}) {
  const today = new Date();
  const todayOrders = orders.filter(
    (order) =>
      new Date(order.createdAt).toDateString() === today.toDateString(),
  );
  const paidOrders = todayOrders.filter(
    (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
  );
  const revenue = paidOrders.reduce(
    (total, order) => total + order.grandTotal,
    0,
  );
  const lowStock = products.flatMap((product) =>
    (product.variants ?? [])
      .filter(
        (variant) =>
          !product.baseUnitVariantId ||
          variant.id === product.baseUnitVariantId,
      )
      .filter((variant) => Number(variant.stock ?? 0) <= 5)
      .map((variant) => ({
        id: variant.id,
        name: `${product.name} · ${variant.name}`,
        stock: Number(variant.stock ?? 0),
      })),
  );

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date();
        day.setDate(day.getDate() - 6 + index);
        const dayOrders = orders.filter(
          (order) =>
            new Date(order.createdAt).toDateString() === day.toDateString() &&
            (order.status === "COMPLETED" || order.paymentStatus === "PAID"),
        );
        return {
          label: day.toLocaleDateString(undefined, { weekday: "short" }),
          amount: dayOrders.reduce((sum, order) => sum + order.grandTotal, 0),
        };
      }),
    [orders],
  );

  const weekTotal = week.reduce((sum, d) => sum + d.amount, 0);

  const metrics = [
    {
      label: "Today's sales",
      value: loading ? "…" : money(revenue),
      detail: `${paidOrders.length} completed orders`,
      icon: Wallet,
      tone: "text-emerald-300 bg-emerald-400/10",
    },
    {
      label: "Orders today",
      value: loading ? "…" : todayOrders.length.toLocaleString(),
      detail: `${orders.length} recent orders loaded`,
      icon: ReceiptText,
      tone: "text-sky-300 bg-sky-400/10",
    },
    {
      label: "Products",
      value: loading ? "…" : products.length.toLocaleString(),
      detail: `${lowStock.length} at or below 5 units`,
      icon: Package,
      tone: "text-amber-300 bg-amber-400/10",
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto p-7">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
            Workspace overview
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Good {new Date().getHours() < 12 ? "morning" : "day"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            A live snapshot of the selected store.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
          {today.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{label}</span>
              <span className={`rounded-xl p-2 ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 text-2xl font-black text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {/* ===== Area Chart ===== */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-white">
                Sales trend · last 7 days
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Completed and paid orders
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-sky-300">
                {loading ? "…" : money(weekTotal)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                7-day total
              </p>
            </div>
            <Activity className="h-5 w-5 shrink-0 text-sky-300" />
          </div>

          {loading ? (
            <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-950/70" />
          ) : (
            <AreaChart data={week} height={200} />
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white">Needs attention</h2>
              <p className="mt-1 text-xs text-slate-500">
                Based on current inventory
              </p>
            </div>
            {lowStock.length ? (
              <ArrowDownRight className="h-5 w-5 text-amber-300" />
            ) : (
              <ArrowUpRight className="h-5 w-5 text-emerald-300" />
            )}
          </div>
          {lowStock.length ? (
            <ul className="mt-4 space-y-2">
              {lowStock.slice(0, 5).map((product) => (
                <li
                  key={product.id}
                  className="flex justify-between gap-3 rounded-xl bg-slate-950/70 px-3 py-2.5"
                >
                  <span className="truncate text-sm text-slate-200">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-amber-300">
                    {product.stock} left
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-slate-950/70 p-4 text-sm text-slate-400">
              No low stock products in the loaded inventory.
            </p>
          )}
          <button
            onClick={onOpenInventory}
            className="mt-4 text-xs font-bold text-sky-300 hover:text-sky-200"
          >
            Review inventory →
          </button>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Recent orders</h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest records from the server
            </p>
          </div>
          <button
            onClick={onOpenOrders}
            className="text-xs font-bold text-sky-300 hover:text-sky-200"
          >
            View orders →
          </button>
        </div>
        {orders.slice(0, 5).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No orders found.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">
                    {order.orderNumber || order.id.slice(0, 8)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">
                    {money(order.grandTotal)}
                  </p>
                  <p className="text-[10px] uppercase text-slate-500">
                    {order.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
