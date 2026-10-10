import { FormEvent, useMemo, useState } from "react";
import { ArrowLeftRight, BadgeDollarSign, ClipboardCheck, FileBarChart2, Plus, Receipt, Truck, Undo2 } from "lucide-react";
import { ApiOrder } from "../store/apiSlice";
import { Product } from "../types";
import { WorkflowGuide } from "./WorkflowGuide";

type Module = "purchasing" | "expenses" | "supplierPayments" | "transfers" | "returns" | "reports";
type Fields = Record<string, string>;
interface Props {
  selectedStoreId?: string; stores: { id: string; name: string }[]; products: Product[]; suppliers: any[]; orders: ApiOrder[];
  purchaseOrders: any[]; expenses: any[]; expenseCategories: any[]; supplierPayments: any[]; transfers: any[]; returns: any[]; loading: boolean;
  onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>; onUpdatePurchaseOrder: (id: string, patch: Record<string, unknown>) => Promise<unknown>; onReceivePurchaseOrder: (id: string, storeId: string, lots?: { purchaseOrderItemId: string; number: string; expiryDate?: string }[]) => Promise<unknown>;
  onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>; onCreateExpenseCategory: (name: string) => Promise<unknown>;
  onCreateSupplierPayment: (payload: Record<string, unknown>) => Promise<unknown>; onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>; onCompleteTransfer: (id: string) => Promise<unknown>;
  onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
}

const modules: { id: Module; label: string; icon: typeof Truck }[] = [
  { id: "purchasing", label: "Purchasing", icon: Truck }, { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign }, { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
  { id: "returns", label: "Sales returns", icon: Undo2 }, { id: "reports", label: "Reports", icon: FileBarChart2 },
];
const initial: Fields = { supplierId: "", productId: "", variantId: "", quantity: "1", unitCost: "", expectedDate: "", notes: "", categoryId: "", amount: "", description: "", expenseDate: new Date().toISOString().slice(0, 10), paymentMethod: "CASH", referenceNumber: "", toStoreId: "", orderId: "", orderItemId: "", reason: "", refundMethod: "CASH" };
const errorMessage = (error: unknown) => { const value = error as { data?: { message?: string }; message?: string }; return value.data?.message || value.message || "The server could not save this operation."; };
const dateText = (value?: string) => value ? new Date(value).toLocaleString() : "—";
const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

export function ERPView(props: Props) {
  const [module, setModule] = useState<Module>("purchasing");
  const [dialog, setDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [fields, setFields] = useState<Fields>({ ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [receiveTarget, setReceiveTarget] = useState<any>(null);
  const [trackReceivedLots, setTrackReceivedLots] = useState(false);
  const [receiveLots, setReceiveLots] = useState<Record<string, { number: string; expiryDate: string }>>({});
  const selectedProduct = props.products.find((product) => product.id === fields.productId);
  const selectedOrder = props.orders.find((order) => order.id === fields.orderId);
  const orderItem = selectedOrder?.items?.find((item) => item.id === fields.orderItemId);
  const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
  const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
  const poTotal = quantity * Number(fields.unitCost || 0);

  const records = useMemo(() => {
    const values = ({ purchasing: props.purchaseOrders, expenses: props.expenses, supplierPayments: props.supplierPayments, transfers: props.transfers, returns: props.returns, reports: [] } as Record<Module, any[]>)[module];
    const normalized = search.trim().toLowerCase();
    if (!normalized) return values;
    return values.filter((item) => JSON.stringify([item.poNumber, item.transferNumber, item.returnNumber, item.supplier?.name, item.description, item.notes, item.category?.name, item.store?.name, item.fromStore?.name, item.toStore?.name]).toLowerCase().includes(normalized));
  }, [module, props.purchaseOrders, props.expenses, props.supplierPayments, props.transfers, props.returns, search]);

  const openDialog = () => { setFields({ ...initial, supplierId: props.suppliers[0]?.id || "", productId: props.products[0]?.id || "", categoryId: props.expenseCategories[0]?.id || "", toStoreId: props.stores.find((store) => store.id !== props.selectedStoreId)?.id || "", orderId: props.orders.find((order) => order.status === "COMPLETED")?.id || "" }); setError(""); setNotice(""); setDialog(true); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (module === "purchasing") {
        if (!fields.supplierId || !fields.productId || quantity < 1 || Number(fields.unitCost) < 0) throw new Error("Select a supplier and product, quantity, and unit cost.");
        const product = props.products.find((entry) => entry.id === fields.productId)!;
        await props.onCreatePurchaseOrder({ supplierId: fields.supplierId, status: "DRAFT", currencyCode: "MMK", expectedDate: fields.expectedDate || undefined, subTotal: poTotal, taxAmount: 0, grandTotal: poTotal, notes: fields.notes || undefined, items: [{ productId: product.id, variantId: fields.variantId || product.variants?.[0]?.id, quantity, unitCost: Number(fields.unitCost), totalCost: poTotal }] });
      } else if (module === "expenses") {
        if (!props.selectedStoreId || !fields.categoryId || Number(fields.amount) <= 0) throw new Error("Select a store and expense category, and enter an amount.");
        await props.onCreateExpense({ storeId: props.selectedStoreId, categoryId: fields.categoryId, amount: Number(fields.amount), currencyCode: "MMK", description: fields.description || undefined, expenseDate: fields.expenseDate || undefined });
      } else if (module === "supplierPayments") {
        if (!fields.supplierId || Number(fields.amount) <= 0) throw new Error("Select a supplier and enter a payment amount.");
        await props.onCreateSupplierPayment({ supplierId: fields.supplierId, amount: Number(fields.amount), currencyCode: "MMK", paymentMethod: fields.paymentMethod, referenceNumber: fields.referenceNumber || undefined, note: fields.notes || undefined });
      } else if (module === "transfers") {
        if (!props.selectedStoreId || !fields.toStoreId || !fields.productId || quantity < 1) throw new Error("Choose source and destination stores, product, and quantity.");
        const product = props.products.find((entry) => entry.id === fields.productId)!;
        await props.onCreateTransfer({ fromStoreId: props.selectedStoreId, toStoreId: fields.toStoreId, notes: fields.notes || undefined, items: [{ productId: product.id, variantId: fields.variantId || product.variants?.[0]?.id, quantity }] });
      } else if (module === "returns") {
        if (!selectedOrder || !orderItem || quantity < 1 || !fields.reason.trim()) throw new Error("Choose an order item, quantity and return reason.");
        if (quantity > orderItem.quantity - Number(orderItem.returnedQuantity || 0)) throw new Error("Return quantity exceeds the remaining quantity on this order item.");
        await props.onCreateReturn({ orderId: selectedOrder.id, totalAmount: itemTotal, refundMethod: fields.refundMethod, refundStatus: "COMPLETED", reason: fields.reason, items: [{ orderItemId: orderItem.id, quantity, refundAmount: itemTotal, reason: fields.reason }] });
      }
      setDialog(false); setNotice("Operation saved successfully.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  const receive = async (po: any) => {
    if (!props.selectedStoreId) { setError("Select the destination store first."); return; }
    setError(""); setNotice(""); setTrackReceivedLots(false);
    setReceiveLots(Object.fromEntries((po.items ?? []).map((item: any) => [item.id, { number: "", expiryDate: "" }])));
    setReceiveTarget(po);
  };
  const confirmReceive = async () => {
    if (!receiveTarget || !props.selectedStoreId) return;
    const lots = trackReceivedLots ? (receiveTarget.items ?? []).map((item: any) => ({ purchaseOrderItemId: item.id, ...receiveLots[item.id] })) : undefined;
    if (lots?.some((lot: any) => !lot.number.trim())) { setError("Enter the batch or lot number for every received product, or turn lot tracking off for this delivery."); return; }
    setBusy(true); setError("");
    try {
      await props.onReceivePurchaseOrder(receiveTarget.id, props.selectedStoreId, lots?.map((lot: any) => ({ ...lot, number: lot.number.trim(), expiryDate: lot.expiryDate || undefined })));
      setNotice(`${receiveTarget.poNumber} received. Inventory has been updated.`); setReceiveTarget(null);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const markOrdered = async (po: any) => {
    try { await props.onUpdatePurchaseOrder(po.id, { status: "ORDERED" }); setNotice(`${po.poNumber} marked as ordered.`); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  const completeTransfer = async (transfer: any) => {
    if (!window.confirm(`Complete ${transfer.transferNumber}? This deducts stock from the source and adds it to the destination.`)) return;
    try { await props.onCompleteTransfer(transfer.id); setNotice(`${transfer.transferNumber} completed.`); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  const addExpenseCategory = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await props.onCreateExpenseCategory(categoryName.trim()); setCategoryDialog(false); setCategoryName(""); setNotice("Expense category created."); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  return <main className="flex-1 overflow-y-auto p-7"><header className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Enterprise operations</p><h1 className="mt-2 text-3xl font-black text-white">ERP</h1><p className="mt-1 text-sm text-slate-400">Purchasing, costs, supplier settlement, branch stock and returns.</p></header>
    <WorkflowGuide />
    <nav className="mb-5 flex flex-wrap gap-2">{modules.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setModule(id); setSearch(""); setError(""); setNotice(""); }} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${module === id ? "border-violet-400/50 bg-violet-400/10 text-violet-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {error && !dialog && !categoryDialog && <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}{notice && !dialog && !categoryDialog && <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}
    {module === "reports" ? <Reports orders={props.orders} expenses={props.expenses} purchaseOrders={props.purchaseOrders} /> : <>
      <section className="mb-4 flex flex-wrap items-center gap-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500" />{module === "expenses" && <button onClick={() => { setCategoryName(""); setCategoryDialog(true); setError(""); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">Expense categories</button>}<button onClick={openDialog} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400"><Plus className="h-4 w-4" />{module === "purchasing" ? "New purchase order" : module === "expenses" ? "Record expense" : module === "supplierPayments" ? "Record payment" : module === "transfers" ? "Request transfer" : "Process return"}</button></section>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">{module === "purchasing" ? <ListHeader cols={["PO number", "Supplier", "Order date", "Total", "Status", "Actions"]} /> : module === "expenses" ? <ListHeader cols={["Category", "Description", "Date", "Store", "Amount"]} /> : module === "supplierPayments" ? <ListHeader cols={["Supplier", "Paid at", "Method", "Reference", "Amount"]} /> : module === "transfers" ? <ListHeader cols={["Transfer", "From → To", "Requested", "Items", "Status", "Actions"]} /> : <ListHeader cols={["Return", "Order", "Customer", "Date", "Refund", "Status"]} />}
        {props.loading ? <p className="p-10 text-center text-sm text-slate-400">Loading ERP records…</p> : records.length === 0 ? <p className="p-10 text-center text-sm text-slate-400">No records found.</p> : records.map((record: any) => <div key={record.id} className={`grid ${module === "expenses" || module === "supplierPayments" ? "grid-cols-5" : "grid-cols-6"} items-center gap-4 border-b border-slate-800/70 px-5 py-4 last:border-0 text-xs`}>
          {module === "purchasing" ? <><span className="font-bold text-white">{record.poNumber}</span><span className="text-slate-300">{record.supplier?.name || "—"}</span><span className="text-slate-400">{dateText(record.orderDate)}</span><span className="font-semibold text-white">{amount(record.grandTotal)}</span><span className="text-amber-300">{record.status}</span><span className="flex gap-1">{record.status === "DRAFT" && <button onClick={() => markOrdered(record)} className="rounded-lg bg-sky-500/15 px-2 py-1.5 font-bold text-sky-300">Mark ordered</button>}{["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"].includes(record.status) && <button onClick={() => receive(record)} className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300"><ClipboardCheck className="h-3.5 w-3.5" />Receive</button>}</span></> : module === "expenses" ? <><span className="font-semibold text-white">{record.category?.name || "—"}</span><span className="truncate text-slate-300">{record.description || "—"}</span><span className="text-slate-400">{dateText(record.expenseDate)}</span><span className="text-slate-400">{record.store?.name || "—"}</span><span className="text-right font-bold text-white">{amount(record.amount)}</span></> : module === "supplierPayments" ? <><span className="font-semibold text-white">{record.supplier?.name || "—"}</span><span className="text-slate-400">{dateText(record.paidAt)}</span><span className="text-slate-300">{record.paymentMethod}</span><span className="text-slate-400">{record.referenceNumber || "—"}</span><span className="text-right font-bold text-white">{amount(record.amount)}</span></> : module === "transfers" ? <><span className="font-bold text-white">{record.transferNumber}</span><span className="text-slate-300">{record.fromStore?.name} → {record.toStore?.name}</span><span className="text-slate-400">{dateText(record.requestedAt)}</span><span className="text-slate-400">{record.items?.length || 0} lines</span><span className="text-amber-300">{record.status}</span><span>{["PENDING", "APPROVED", "IN_TRANSIT"].includes(record.status) && <button onClick={() => completeTransfer(record)} className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300">Complete</button>}</span></> : <><span className="font-bold text-white">{record.returnNumber}</span><span className="text-slate-300">{record.order?.orderNumber || record.orderId?.slice(0, 8)}</span><span className="text-slate-400">{record.customer?.name || "Walk-in"}</span><span className="text-slate-400">{dateText(record.createdAt)}</span><span className="font-bold text-white">{amount(record.totalAmount)}</span><span className="text-emerald-300">{record.refundStatus}</span></>}
        </div>)}
      </section>
    </>}

    {receiveTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"><h2 className="text-xl font-bold text-white">Receive {receiveTarget.poNumber}</h2><p className="mt-1 text-xs text-slate-400">Record delivered products and optional batches. Batch tracking supports expiry-aware stock rotation.</p><label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={trackReceivedLots} onChange={(event) => setTrackReceivedLots(event.target.checked)} className="accent-emerald-500" />Track batch / lot numbers and expiry</label>{trackReceivedLots && <div className="mt-4 space-y-3">{(receiveTarget.items ?? []).map((item: any) => <article key={item.id} className="rounded-xl border border-slate-800 p-3"><p className="mb-3 text-sm font-semibold text-white">{item.product?.name || "Product"}{item.variant?.name ? ` · ${item.variant.name}` : ""} <span className="text-slate-400">× {item.quantity}</span></p><div className="grid gap-3 sm:grid-cols-2"><Field label="Batch / lot number" value={receiveLots[item.id]?.number ?? ""} onChange={(value) => setReceiveLots((current) => ({ ...current, [item.id]: { ...current[item.id], number: value } }))} required /><Field label="Expiry date (optional)" type="date" value={receiveLots[item.id]?.expiryDate ?? ""} onChange={(value) => setReceiveLots((current) => ({ ...current, [item.id]: { ...current[item.id], expiryDate: value } }))} /></div></article>)}</div>}{error && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setReceiveTarget(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">Cancel</button><button type="button" onClick={() => void confirmReceive()} disabled={busy} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Receiving…" : "Receive stock"}</button></div></div></div>}
    {(dialog || categoryDialog) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><form onSubmit={categoryDialog ? addExpenseCategory : submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"><h2 className="text-xl font-bold text-white">{categoryDialog ? "Add expense category" : module === "purchasing" ? "New purchase order" : module === "expenses" ? "Record expense" : module === "supplierPayments" ? "Record supplier payment" : module === "transfers" ? "Request stock transfer" : "Process sales return"}</h2><p className="mb-5 mt-1 text-xs text-slate-400">This action is recorded on the server and may update inventory or balances.</p>
      {categoryDialog ? <Field label="Category name" value={categoryName} onChange={setCategoryName} required /> : module === "purchasing" ? <div className="space-y-3"><Select label="Supplier" value={fields.supplierId} onChange={(value) => setFields({ ...fields, supplierId: value })} options={props.suppliers.map((item) => [item.id, `${item.name} (${item.code})`])} /><Select label="Product" value={fields.productId} onChange={(value) => setFields({ ...fields, productId: value, variantId: props.products.find((product) => product.id === value)?.variants?.[0]?.id || "" })} options={props.products.map((item) => [item.id, `${item.name} · ${item.sku}`])} /><Select label="Variant" value={fields.variantId} onChange={(value) => setFields({ ...fields, variantId: value })} options={(selectedProduct?.variants || []).map((variant) => [variant.id, variant.name])} /><div className="grid grid-cols-2 gap-3"><Field label="Quantity" type="number" min="1" value={fields.quantity} onChange={(value) => setFields({ ...fields, quantity: value })} required /><Field label="Unit cost" type="number" min="0" step="0.01" value={fields.unitCost} onChange={(value) => setFields({ ...fields, unitCost: value })} required /></div><p className="text-right text-sm font-bold text-white">Subtotal {amount(poTotal)}</p><Field label="Expected date" type="date" value={fields.expectedDate} onChange={(value) => setFields({ ...fields, expectedDate: value })} /><Field label="Notes" value={fields.notes} onChange={(value) => setFields({ ...fields, notes: value })} /></div> : module === "expenses" ? <div className="space-y-3"><Select label="Expense category" value={fields.categoryId} onChange={(value) => setFields({ ...fields, categoryId: value })} options={props.expenseCategories.map((item) => [item.id, item.name])} /><Field label="Amount" type="number" min="0.01" step="0.01" value={fields.amount} onChange={(value) => setFields({ ...fields, amount: value })} required /><Field label="Date" type="date" value={fields.expenseDate} onChange={(value) => setFields({ ...fields, expenseDate: value })} required /><Field label="Description" value={fields.description} onChange={(value) => setFields({ ...fields, description: value })} /></div> : module === "supplierPayments" ? <div className="space-y-3"><Select label="Supplier" value={fields.supplierId} onChange={(value) => setFields({ ...fields, supplierId: value })} options={props.suppliers.map((item) => [item.id, item.name])} /><Field label="Amount" type="number" min="0.01" step="0.01" value={fields.amount} onChange={(value) => setFields({ ...fields, amount: value })} required /><Select label="Payment method" value={fields.paymentMethod} onChange={(value) => setFields({ ...fields, paymentMethod: value })} options={["CASH", "KBZ_PAY", "CB_PAY", "WAVE_PAY", "CARD", "BANK_TRANSFER"].map((value) => [value, value.split("_").join(" ")])} /><Field label="Reference number" value={fields.referenceNumber} onChange={(value) => setFields({ ...fields, referenceNumber: value })} /><Field label="Note" value={fields.notes} onChange={(value) => setFields({ ...fields, notes: value })} /></div> : module === "transfers" ? <div className="space-y-3"><p className="text-xs text-slate-400">Source store: <strong className="text-white">{props.stores.find((item) => item.id === props.selectedStoreId)?.name || "Select a store"}</strong></p><Select label="Destination" value={fields.toStoreId} onChange={(value) => setFields({ ...fields, toStoreId: value })} options={props.stores.filter((item) => item.id !== props.selectedStoreId).map((item) => [item.id, item.name])} /><Select label="Product" value={fields.productId} onChange={(value) => setFields({ ...fields, productId: value, variantId: props.products.find((product) => product.id === value)?.variants?.[0]?.id || "" })} options={props.products.map((item) => [item.id, item.name])} /><Select label="Variant" value={fields.variantId} onChange={(value) => setFields({ ...fields, variantId: value })} options={(selectedProduct?.variants || []).map((variant) => [variant.id, variant.name])} /><Field label="Quantity" type="number" min="1" value={fields.quantity} onChange={(value) => setFields({ ...fields, quantity: value })} required /><Field label="Notes" value={fields.notes} onChange={(value) => setFields({ ...fields, notes: value })} /></div> : <div className="space-y-3"><Select label="Completed order" value={fields.orderId} onChange={(value) => { const order = props.orders.find((entry) => entry.id === value); setFields({ ...fields, orderId: value, orderItemId: order?.items?.[0]?.id || "" }); }} options={props.orders.filter((order) => order.status === "COMPLETED" || order.paymentStatus === "PAID").map((order) => [order.id, `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`])} /><Select label="Returned item" value={fields.orderItemId} onChange={(value) => setFields({ ...fields, orderItemId: value })} options={(selectedOrder?.items || []).map((item) => [item.id, `${item.product?.name || "Product"} · qty ${item.quantity}`])} /><Field label="Quantity" type="number" min="1" max={orderItem?.quantity || 1} value={fields.quantity} onChange={(value) => setFields({ ...fields, quantity: value })} required /><p className="text-right text-sm font-bold text-white">Refund total {amount(itemTotal)}</p><Select label="Refund method" value={fields.refundMethod} onChange={(value) => setFields({ ...fields, refundMethod: value })} options={["CASH", "KBZ_PAY", "CB_PAY", "WAVE_PAY", "CARD", "BANK_TRANSFER"].map((value) => [value, value.split("_").join(" ")])} /><Field label="Reason" value={fields.reason} onChange={(value) => setFields({ ...fields, reason: value })} required /></div>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setDialog(false); setCategoryDialog(false); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">Cancel</button><button disabled={busy} className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div></form></div>}
  </main>;
}

function ListHeader({ cols }: { cols: string[] }) { return <div className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>{cols.map((col) => <span key={col}>{col}</span>)}</div>; }
function Field({ label, value, onChange, type = "text", required, min, max, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: number; step?: string }) { return <label className="block text-xs text-slate-400">{label}<input required={required} type={type} min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="block text-xs text-slate-400">{label}<select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"><option value="">Choose…</option>{options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>{options.length === 0 && <span className="mt-1 block text-amber-300">Create the required record first.</span>}</label>; }
function Reports({ orders, expenses, purchaseOrders }: { orders: ApiOrder[]; expenses: any[]; purchaseOrders: any[] }) {
  const revenue = orders.filter((order) => order.status === "COMPLETED" || order.paymentStatus === "PAID").reduce((sum, order) => sum + order.grandTotal, 0);
  const operatingExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const procurement = purchaseOrders.filter((po) => po.status === "RECEIVED").reduce((sum, po) => sum + Number(po.grandTotal || 0), 0);
  const cards = [["Recent completed sales", amount(revenue), `${orders.length} recent order records loaded`], ["Recorded expenses", amount(operatingExpenses), `${expenses.length} expense records loaded`], ["Received purchasing", amount(procurement), `${purchaseOrders.filter((po) => po.status === "RECEIVED").length} purchase orders received`]];
  return <><section className="grid gap-4 md:grid-cols-3">{cards.map(([title, total, note]) => <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-400">{title}</p><p className="mt-3 text-2xl font-black text-white">{total}</p><p className="mt-2 text-xs text-slate-500">{note}</p></article>)}</section><p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">Operational summary only. This is not a profit-and-loss statement: purchase values, unpaid liabilities, taxes, refunds and accounting journals are not fully reconciled here. Sales are limited to recent orders returned by the API.</p></>;
}
