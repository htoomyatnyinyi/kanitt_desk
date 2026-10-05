import { useState } from "react";
import { ArrowRight, Boxes, ClipboardList, CreditCard, RotateCcw, ShoppingCart, Store, Truck, Wallet } from "lucide-react";

type Flow = "purchasing" | "sales" | "returns" | "expenses" | "transfers";
const flows: { id: Flow; label: string; steps: { title: string; detail: string; icon: typeof Truck; effect: string }[] }[] = [
  { id: "purchasing", label: "Purchase & receive", steps: [
    { title: "Create draft", detail: "Choose supplier, product, quantity and cost.", icon: ClipboardList, effect: "No stock change" },
    { title: "Mark ordered", detail: "Confirm the purchase was sent to the supplier.", icon: Truck, effect: "PO status → Ordered" },
    { title: "Receive goods", detail: "Select the store when goods arrive.", icon: Boxes, effect: "Stock increases" },
  ] },
  { id: "sales", label: "POS sale", steps: [
    { title: "Build cart", detail: "Scan or search products and set quantities.", icon: ShoppingCart, effect: "Cart stays local" },
    { title: "Take payment", detail: "Choose payment type and enter cash received.", icon: CreditCard, effect: "Sale sent to server" },
    { title: "Complete order", detail: "Server completes the order after creation.", icon: Store, effect: "Stock decreases" },
  ] },
  { id: "returns", label: "Sales return", steps: [
    { title: "Find completed sale", detail: "Choose the order and item being returned.", icon: ClipboardList, effect: "Checks remaining qty" },
    { title: "Enter return", detail: "Set quantity, reason and refund method.", icon: RotateCcw, effect: "Refund recorded" },
    { title: "Finish return", detail: "Server records the return against the order.", icon: Boxes, effect: "Returned stock increases" },
  ] },
  { id: "expenses", label: "Expense", steps: [
    { title: "Set up category", detail: "Create an expense category once.", icon: ClipboardList, effect: "Reusable category" },
    { title: "Record expense", detail: "Choose category, store, date and amount.", icon: Wallet, effect: "Expense saved" },
    { title: "Review summary", detail: "See recent expense totals in ERP Reports.", icon: Store, effect: "Operational summary" },
  ] },
  { id: "transfers", label: "Branch transfer", steps: [
    { title: "Request transfer", detail: "Choose destination, product and quantity.", icon: ClipboardList, effect: "Transfer pending" },
    { title: "Complete transfer", detail: "Confirm the branch handoff in ERP.", icon: Truck, effect: "Source stock decreases" },
    { title: "Update destination", detail: "Server posts the matching inbound movement.", icon: Boxes, effect: "Destination stock increases" },
  ] },
];

export function WorkflowGuide() {
  const [active, setActive] = useState<Flow>("purchasing");
  const flow = flows.find((item) => item.id === active)!;
  return <details className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 open:bg-slate-900/80">
    <summary className="cursor-pointer list-none px-5 py-4"><span className="font-bold text-white">How ERP workflows work</span><span className="ml-3 text-xs text-slate-400">Step-by-step guide · expand</span></summary>
    <div className="border-t border-slate-800 p-5">
      <div className="mb-5 flex flex-wrap gap-2">{flows.map((item) => <button key={item.id} onClick={() => setActive(item.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.id === active ? "bg-violet-500/15 text-violet-200" : "bg-slate-950 text-slate-400 hover:text-white"}`}>{item.label}</button>)}</div>
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-3">{flow.steps.map(({ title, detail, icon: Icon, effect }, index) => <div key={title} className="contents lg:contents"><article className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"><span className="rounded-lg bg-violet-400/10 p-2 text-violet-300"><Icon className="h-4 w-4" /></span><div className="min-w-0"><h3 className="text-sm font-bold text-slate-100">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-emerald-300">{effect}</p></div></article>{index < flow.steps.length - 1 && <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-slate-600 lg:rotate-0" />}</div>)}</div>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">Every save is sent to kanitt_server. The server applies tenant permissions and records inventory changes. This desktop client currently requires an active connection for these workflows.</p>
    </div>
  </details>;
}
