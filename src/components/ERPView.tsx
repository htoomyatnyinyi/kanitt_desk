import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart2,
  Loader2,
  Plus,
  Receipt,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import { ApiOrder } from "../store/apiSlice";
import { Product } from "../types";
import { WorkflowGuide } from "./WorkflowGuide";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Module =
  | "purchasing"
  | "expenses"
  | "supplierPayments"
  | "transfers"
  | "returns"
  | "reports";

type Fields = Record<string, string>;

interface Props {
  selectedStoreId?: string;
  userRole?: string;
  stores: { id: string; name: string }[];
  transferDestinationStores: { id: string; name: string }[];
  products: Product[];
  suppliers: any[];
  orders: ApiOrder[];
  purchaseOrders: any[];
  expenses: any[];
  expenseCategories: any[];
  supplierPayments: any[];
  transfers: any[];
  returns: any[];
  loading: boolean;
  onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>;
  onUpdatePurchaseOrder: (
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<unknown>;
  onReceivePurchaseOrder: (
    id: string,
    storeId: string,
    lots?: {
      purchaseOrderItemId: string;
      number: string;
      expiryDate?: string;
    }[],
  ) => Promise<unknown>;
  onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>;
  onCreateExpenseCategory: (name: string) => Promise<unknown>;
  onCreateSupplierPayment: (
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
  onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>;
  onCompleteTransfer: (id: string) => Promise<unknown>;
  onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
}

interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const MODULES: { id: Module; label: string; icon: typeof Truck }[] = [
  { id: "purchasing", label: "Purchasing", icon: Truck },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
  { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
  { id: "returns", label: "Sales returns", icon: Undo2 },
  { id: "reports", label: "Reports", icon: FileBarChart2 },
];

const COLUMNS: Record<Module, string[]> = {
  purchasing: [
    "PO number",
    "Supplier",
    "Store",
    "Order date",
    "Total",
    "Status",
    "Actions",
  ],
  expenses: ["Category", "Description", "Date", "Store", "Amount"],
  supplierPayments: ["Supplier", "Paid at", "Method", "Reference", "Amount"],
  transfers: [
    "Transfer",
    "From → To",
    "Requested",
    "Items",
    "Status",
    "Actions",
  ],
  returns: ["Return", "Order", "Customer", "Date", "Refund", "Status"],
  reports: [],
};

const PAYMENT_METHODS = [
  "CASH",
  "KBZ_PAY",
  "CB_PAY",
  "WAVE_PAY",
  "CARD",
  "BANK_TRANSFER",
];

const RECEIVABLE_STATUSES = ["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"];
const COMPLETABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

const today = () => new Date().toISOString().slice(0, 10);

const initialFields = (): Fields => ({
  storeId: "",
  supplierId: "",
  productId: "",
  variantId: "",
  quantity: "1",
  unitCost: "",
  expectedDate: "",
  notes: "",
  categoryId: "",
  amount: "",
  description: "",
  expenseDate: today(),
  paymentMethod: "CASH",
  referenceNumber: "",
  toStoreId: "",
  orderId: "",
  orderItemId: "",
  reason: "",
  refundMethod: "CASH",
});

const errorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  const value = error as { data?: { message?: string }; message?: string };
  return (
    value?.data?.message ||
    value?.message ||
    "The server could not save this operation."
  );
};

const dateText = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";

const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

const transferStatusLabel = (status: string) =>
  status === "RECEIVED" ? "COMPLETED" : status;

/** Safe accessor for variant arrays on a product. */
const getVariants = (product: Product | undefined): any[] => {
  const value = (product as { variants?: unknown } | undefined)?.variants;
  return Array.isArray(value) ? value : [];
};

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export function ERPView(props: Props) {
  const {
    selectedStoreId,
    userRole,
    stores,
    transferDestinationStores,
    products,
    suppliers,
    orders,
    purchaseOrders,
    expenses,
    expenseCategories,
    supplierPayments,
    transfers,
    returns,
    loading,
    onCreatePurchaseOrder,
    onUpdatePurchaseOrder,
    onReceivePurchaseOrder,
    onCreateExpense,
    onCreateExpenseCategory,
    onCreateSupplierPayment,
    onCreateTransfer,
    onCompleteTransfer,
    onCreateReturn,
  } = props;

  /* ---------------------------- state ---------------------------- */

  const [module, setModule] = useState<Module>("purchasing");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [dialog, setDialog] = useState(false);
  const [fields, setFields] = useState<Fields>(initialFields);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState("");

  const [receiveTarget, setReceiveTarget] = useState<any>(null);
  const [receiveStoreId, setReceiveStoreId] = useState("");
  const [trackReceivedLots, setTrackReceivedLots] = useState(false);
  const [receiveLots, setReceiveLots] = useState<
    Record<string, { number: string; expiryDate: string }>
  >({});
  const [receiveError, setReceiveError] = useState("");
  const [receiving, setReceiving] = useState(false);

  const [transferTarget, setTransferTarget] = useState<any>(null);
  const [transferError, setTransferError] = useState("");
  const [completing, setCompleting] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const toastTimers = useRef<number[]>([]);

  const pushToast = useCallback((tone: Toast["tone"], message: string) => {
    const id = ++toastSeq.current;
    setToasts((current) => [...current, { id, tone, message }]);
    const timer = window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      5000,
    );
    toastTimers.current.push(timer);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(
    () => () => {
      toastTimers.current.forEach(window.clearTimeout);
    },
    [],
  );

  /* -------------------------- derived data ------------------------ */

  const selectedProduct = products.find(
    (product) => product.id === fields.productId,
  );
  const selectedProductVariants = getVariants(selectedProduct);
  const selectedOrder = orders.find((order) => order.id === fields.orderId);
  const orderItem = selectedOrder?.items?.find(
    (item) => item.id === fields.orderItemId,
  );
  const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
  const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
  const poTotal = quantity * Number(fields.unitCost || 0);
  const isReturnable = (order: ApiOrder) =>
    order.status === "COMPLETED" || order.paymentStatus === "PAID";

  const records = useMemo(() => {
    const values = (
      {
        purchasing: purchaseOrders,
        expenses: expenses,
        supplierPayments: supplierPayments,
        transfers: transfers,
        returns: returns,
        reports: [],
      } as Record<Module, any[]>
    )[module];

    const normalized = search.trim().toLowerCase();
    if (!normalized) return values;

    return values.filter((item) =>
      JSON.stringify([
        item.poNumber,
        item.transferNumber,
        item.returnNumber,
        item.order?.orderNumber,
        item.supplier?.name,
        item.customer?.name,
        item.description,
        item.notes,
        item.reason,
        item.referenceNumber,
        item.category?.name,
        item.store?.name,
        item.fromStore?.name,
        item.toStore?.name,
        item.status,
        item.refundStatus,
      ])
        .toLowerCase()
        .includes(normalized),
    );
  }, [
    module,
    purchaseOrders,
    expenses,
    supplierPayments,
    transfers,
    returns,
    search,
  ]);

  const statusOptions = useMemo(() => {
    if (
      module === "reports" ||
      module === "expenses" ||
      module === "supplierPayments"
    )
      return [];
    const set = new Set<string>();
    records.forEach((record: any) => {
      const status = module === "returns" ? record.refundStatus : record.status;
      if (status) set.add(status);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [records, module]);

  const visibleRecords = useMemo(() => {
    if (statusFilter === "ALL") return records;
    return records.filter((record: any) => {
      const status = module === "returns" ? record.refundStatus : record.status;
      return status === statusFilter;
    });
  }, [records, statusFilter, module]);

  const cols = COLUMNS[module];
  const gridStyle = useMemo(
    () => ({ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }),
    [cols.length],
  );

  /* ---------------------------- actions --------------------------- */

  const resetMessages = () => {
    setFormError("");
    setReceiveError("");
    setTransferError("");
  };

  const switchModule = (next: Module) => {
    setModule(next);
    setSearch("");
    setStatusFilter("ALL");
    resetMessages();
  };

  const openDialog = () => {
    const firstOrder = orders.find(isReturnable);
    const firstProduct = products[0];
    setFields({
      ...initialFields(),
      // Purchase order: default to the active store, first supplier, first product
      storeId: selectedStoreId || stores[0]?.id || "",
      supplierId: suppliers[0]?.id || "",
      productId: firstProduct?.id || "",
      variantId: getVariants(firstProduct)[0]?.id || "",
      categoryId: expenseCategories[0]?.id || "",
      toStoreId: transferDestinationStores.find((store) => store.id !== selectedStoreId)?.id || "",
      orderId: firstOrder?.id || "",
      orderItemId: firstOrder?.items?.[0]?.id || "",
    });
    resetMessages();
    setDialog(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      if (module === "purchasing") {
        if (
          !fields.storeId ||
          !fields.supplierId ||
          !fields.productId ||
          quantity < 1 ||
          fields.unitCost === "" ||
          Number(fields.unitCost) < 0
        ) {
          throw new Error(
            "Select a store, supplier, and product, and enter a valid quantity and unit cost.",
          );
        }
        const product = products.find(
          (entry) => entry.id === fields.productId,
        )!;
        const variants = getVariants(product);
        await onCreatePurchaseOrder({
          storeId: fields.storeId,
          supplierId: fields.supplierId,
          status: "DRAFT",
          currencyCode: "MMK",
          expectedDate: fields.expectedDate || undefined,
          subTotal: poTotal,
          taxAmount: 0,
          grandTotal: poTotal,
          notes: fields.notes || undefined,
          items: [
            {
              productId: product.id,
              variantId: fields.variantId || variants[0]?.id || null,
              quantity,
              unitCost: Number(fields.unitCost),
              totalCost: poTotal,
            },
          ],
        });
        pushToast("success", "Purchase order created as draft.");
      } else if (module === "expenses") {
        if (!selectedStoreId)
          throw new Error(
            "Select a store from the top bar before recording an expense.",
          );
        if (!fields.categoryId || Number(fields.amount) <= 0)
          throw new Error(
            "Select an expense category and enter an amount greater than zero.",
          );
        await onCreateExpense({
          storeId: selectedStoreId,
          categoryId: fields.categoryId,
          amount: Number(fields.amount),
          currencyCode: "MMK",
          description: fields.description || undefined,
          expenseDate: fields.expenseDate || undefined,
        });
        pushToast("success", "Expense recorded.");
      } else if (module === "supplierPayments") {
        if (!fields.supplierId || Number(fields.amount) <= 0)
          throw new Error("Select a supplier and enter a payment amount.");
        await onCreateSupplierPayment({
          supplierId: fields.supplierId,
          amount: Number(fields.amount),
          currencyCode: "MMK",
          paymentMethod: fields.paymentMethod,
          referenceNumber: fields.referenceNumber || undefined,
          note: fields.notes || undefined,
        });
        pushToast("success", "Supplier payment recorded.");
      } else if (module === "transfers") {
        if (!selectedStoreId)
          throw new Error("Select a source store from the top bar first.");
        if (!fields.toStoreId || !fields.productId || quantity < 1) {
          throw new Error("Choose a destination store, product, and quantity.");
        }
        if (fields.toStoreId === selectedStoreId)
          throw new Error("Source and destination stores must be different.");
        const product = products.find(
          (entry) => entry.id === fields.productId,
        )!;
        const variants = getVariants(product);
        await onCreateTransfer({
          fromStoreId: selectedStoreId,
          toStoreId: fields.toStoreId,
          notes: fields.notes || undefined,
          items: [
            {
              productId: product.id,
              variantId: fields.variantId || variants[0]?.id || null,
              quantity,
            },
          ],
        });
        pushToast("success", "Transfer requested.");
      } else if (module === "returns") {
        if (!selectedOrder || !orderItem)
          throw new Error("Choose a completed order and an item to return.");
        if (quantity < 1 || !fields.reason.trim())
          throw new Error("Enter a quantity and a return reason.");
        const remaining =
          orderItem.quantity - Number(orderItem.returnedQuantity || 0);
        if (quantity > remaining) {
          throw new Error(
            `Only ${remaining} unit(s) remain returnable on this line.`,
          );
        }
        await onCreateReturn({
          orderId: selectedOrder.id,
          totalAmount: itemTotal,
          refundMethod: fields.refundMethod,
          refundStatus: "COMPLETED",
          reason: fields.reason.trim(),
          items: [
            {
              orderItemId: orderItem.id,
              quantity,
              refundAmount: itemTotal,
              reason: fields.reason.trim(),
            },
          ],
        });
        pushToast("success", "Sales return processed.");
      }

      setDialog(false);
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const markOrdered = async (po: any) => {
    setBusyId(`po:${po.id}`);
    try {
      await onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
      pushToast("success", `${po.poNumber} marked as ordered.`);
    } catch (cause) {
      pushToast("error", errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const openReceive = (po: any) => {
    // Prefer the store on the PO itself — fall back to the active store.
    const target = po.storeId || selectedStoreId || stores[0]?.id || "";
    setReceiveStoreId(target);
    setReceiveError("");
    setTrackReceivedLots(false);
    setReceiveLots(
      Object.fromEntries(
        (po.items ?? []).map((item: any) => [
          item.id,
          { number: "", expiryDate: "" },
        ]),
      ),
    );
    setReceiveTarget(po);
  };

  const confirmReceive = async () => {
    if (!receiveTarget) return;
    const targetStore =
      receiveStoreId || selectedStoreId || stores[0]?.id || "";
    if (!targetStore) {
      setReceiveError("Select a store to receive the stock into.");
      return;
    }

    let lots:
      | { purchaseOrderItemId: string; number: string; expiryDate?: string }[]
      | undefined;

    if (trackReceivedLots) {
      const lines = (receiveTarget.items ?? []).map((item: any) => ({
        id: item.id,
        name: item.product?.name || "Product",
        number: (receiveLots[item.id]?.number ?? "").trim(),
        expiryDate: receiveLots[item.id]?.expiryDate || "",
      }));
      const missing = lines.find((line: any) => !line.number);
      if (missing) {
        setReceiveError(
          `Enter a batch / lot number for “${missing.name}”, or turn lot tracking off.`,
        );
        return;
      }
      lots = lines.map((line: any) => ({
        purchaseOrderItemId: line.id,
        number: line.number,
        expiryDate: line.expiryDate || undefined,
      }));
    }

    setReceiving(true);
    setReceiveError("");
    try {
      await onReceivePurchaseOrder(receiveTarget.id, targetStore, lots);
      pushToast(
        "success",
        `${receiveTarget.poNumber} received. Inventory has been updated.`,
      );
      setReceiveTarget(null);
    } catch (cause) {
      setReceiveError(errorMessage(cause));
    } finally {
      setReceiving(false);
    }
  };

  const openCompleteTransfer = (transfer: any) => {
    setTransferError("");
    setTransferTarget(transfer);
  };

  const executeCompleteTransfer = async () => {
    if (!transferTarget) return;
    setCompleting(true);
    setTransferError("");
    try {
      await onCompleteTransfer(transferTarget.id);
      pushToast(
        "success",
        `Transfer ${transferTarget.transferNumber} completed. Inventories have been updated.`,
      );
      setTransferTarget(null);
    } catch (cause) {
      setTransferError(errorMessage(cause));
    } finally {
      setCompleting(false);
    }
  };

  const addExpenseCategory = async (event: FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) {
      setFormError("Enter a category name.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onCreateExpenseCategory(name);
      setCategoryDialog(false);
      setCategoryName("");
      pushToast("success", "Expense category created.");
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------- render --------------------------- */

  return (
    <main className="flex-1 overflow-y-auto p-7">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Enterprise operations
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">ERP</h1>
        <p className="mt-1 text-sm text-slate-400">
          Purchasing, costs, supplier settlement, branch stock and returns.
        </p>
      </header>

      <WorkflowGuide />

      {/* Toasts */}
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 leading-5">{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <nav className="mb-5 flex flex-wrap gap-2">
        {MODULES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchModule(id)}
            aria-current={module === id}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors ${
              module === id
                ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {module === "reports" ? (
        <Reports
          orders={orders}
          expenses={expenses}
          purchaseOrders={purchaseOrders}
        />
      ) : (
        <>
          <section className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search records"
              aria-label="Search records"
              className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />

            {module === "expenses" && (
              <button
                type="button"
                onClick={() => {
                  setCategoryName("");
                  setFormError("");
                  setCategoryDialog(true);
                }}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                Expense categories
              </button>
            )}

            <button
              type="button"
              onClick={openDialog}
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400"
            >
              <Plus className="h-4 w-4" />
              {module === "purchasing"
                ? "New purchase order"
                : module === "expenses"
                  ? "Record expense"
                  : module === "supplierPayments"
                    ? "Record payment"
                    : module === "transfers"
                      ? "Request transfer"
                      : "Process return"}
            </button>
          </section>

          {statusOptions.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                    statusFilter === status
                      ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
                      : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {status === "ALL" ? "All" : status.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <ListHeader cols={cols} />

                {loading ? (
                  <p className="flex items-center justify-center gap-2 p-10 text-center text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading ERP records…
                  </p>
                ) : visibleRecords.length === 0 ? (
                  <p className="p-10 text-center text-sm text-slate-400">
                    {records.length === 0
                      ? "No records found."
                      : "No records match the current filter."}
                  </p>
                ) : (
                  visibleRecords.map((record: any) => (
                    <div
                      key={record.id}
                      style={gridStyle}
                      className="grid items-center gap-4 border-b border-slate-800/70 px-5 py-4 text-xs last:border-0"
                    >
                      {module === "purchasing" ? (
                        <>
                          <span className="font-bold text-white">
                            {record.poNumber}
                          </span>
                          <span className="truncate text-slate-300">
                            {record.supplier?.name || "—"}
                          </span>
                          <span className="truncate text-slate-300">
                            {record.store?.name ||
                              stores.find((s) => s.id === record.storeId)
                                ?.name ||
                              "—"}
                          </span>
                          <span className="text-slate-400">
                            {dateText(record.orderDate)}
                          </span>
                          <span className="font-semibold text-white">
                            {amount(record.grandTotal)}
                          </span>
                          <span className="text-amber-300">
                            {record.status?.replace(/_/g, " ")}
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {record.status === "DRAFT" && (
                              <button
                                type="button"
                                onClick={() => void markOrdered(record)}
                                disabled={busyId === `po:${record.id}`}
                                className="flex items-center gap-1 rounded-lg bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                              >
                                {busyId === `po:${record.id}` && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                Mark ordered
                              </button>
                            )}
                            {RECEIVABLE_STATUSES.includes(record.status) && (
                              <button
                                type="button"
                                onClick={() => openReceive(record)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                Receive
                              </button>
                            )}
                            {record.status === "RECEIVED" && (
                              <span className="text-[11px] font-medium text-emerald-400/80">
                                ✓ Received
                              </span>
                            )}
                          </span>
                        </>
                      ) : module === "expenses" ? (
                        <>
                          <span className="font-semibold text-white">
                            {record.category?.name || "—"}
                          </span>
                          <span className="truncate text-slate-300">
                            {record.description || "—"}
                          </span>
                          <span className="text-slate-400">
                            {dateText(record.expenseDate)}
                          </span>
                          <span className="truncate text-slate-400">
                            {record.store?.name || "—"}
                          </span>
                          <span className="text-right font-bold text-white">
                            {amount(record.amount)}
                          </span>
                        </>
                      ) : module === "supplierPayments" ? (
                        <>
                          <span className="truncate font-semibold text-white">
                            {record.supplier?.name || "—"}
                          </span>
                          <span className="text-slate-400">
                            {dateText(record.paidAt)}
                          </span>
                          <span className="text-slate-300">
                            {record.paymentMethod?.replace(/_/g, " ")}
                          </span>
                          <span className="truncate text-slate-400">
                            {record.referenceNumber || "—"}
                          </span>
                          <span className="text-right font-bold text-white">
                            {amount(record.amount)}
                          </span>
                        </>
                      ) : module === "transfers" ? (
                        <>
                          <span className="font-bold text-white">
                            {record.transferNumber}
                          </span>
                          <span className="truncate text-slate-300">
                            {record.fromStore?.name} → {record.toStore?.name}
                          </span>
                          <span className="text-slate-400">
                            {dateText(record.requestedAt)}
                          </span>
                          <span className="text-slate-400">
                            {record.items?.length || 0} lines
                          </span>
                          <span
                            className={
                              record.status === "RECEIVED"
                                ? "font-bold text-emerald-400"
                                : "font-bold text-amber-300"
                            }
                          >
                            {transferStatusLabel(record.status)}
                          </span>
                          <span>
                            {COMPLETABLE_TRANSFER_STATUSES.includes(record.status) &&
                            (userRole !== "MANAGER" || record.toStoreId === selectedStoreId) ? (
                              <button
                                type="button"
                                onClick={() => openCompleteTransfer(record)}
                                disabled={
                                  completing ||
                                  busyId === `transfer:${record.id}`
                                }
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                {busyId === `transfer:${record.id}` && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                Accept &amp; Complete
                              </button>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                {record.status === "RECEIVED" ? "✓ Received" : "Awaiting destination store"}
                              </span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-white">
                            {record.returnNumber}
                          </span>
                          <span className="text-slate-300">
                            {record.order?.orderNumber ||
                              record.orderId?.slice(0, 8) ||
                              "—"}
                          </span>
                          <span className="truncate text-slate-400">
                            {record.customer?.name || "Walk-in"}
                          </span>
                          <span className="text-slate-400">
                            {dateText(record.createdAt)}
                          </span>
                          <span className="font-bold text-white">
                            {amount(record.totalAmount)}
                          </span>
                          <span className="text-emerald-300">
                            {record.refundStatus}
                          </span>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Receive purchase order modal                                 */}
      {/* ------------------------------------------------------------ */}
      <Modal
        open={Boolean(receiveTarget)}
        onClose={() => !receiving && setReceiveTarget(null)}
        labelledBy="receive-modal-title"
      >
        {receiveTarget && (
          <>
            <h2
              id="receive-modal-title"
              className="text-xl font-bold text-white"
            >
              Receive {receiveTarget.poNumber}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Record delivered products into the purchase order’s destination store.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Destination store / branch
              </label>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                {stores.find((store) => store.id === receiveStoreId)?.name ||
                  receiveTarget.store?.name || "Assigned destination"}
              </div>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={trackReceivedLots}
                onChange={(event) => setTrackReceivedLots(event.target.checked)}
                className="accent-emerald-500"
              />
              Track batch / lot numbers and expiry
            </label>

            {trackReceivedLots && (
              <div className="mt-4 space-y-3">
                {(receiveTarget.items ?? []).map((item: any) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-800 p-3"
                  >
                    <p className="mb-3 text-sm font-semibold text-white">
                      {item.product?.name || "Product"}
                      {item.variant?.name ? ` · ${item.variant.name}` : ""}{" "}
                      <span className="text-slate-400">× {item.quantity}</span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Batch / lot number"
                        value={receiveLots[item.id]?.number ?? ""}
                        onChange={(value) =>
                          setReceiveLots((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], number: value },
                          }))
                        }
                        required
                      />
                      <Field
                        label="Expiry date (optional)"
                        type="date"
                        value={receiveLots[item.id]?.expiryDate ?? ""}
                        onChange={(value) =>
                          setReceiveLots((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              expiryDate: value,
                            },
                          }))
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}

            <ErrorNote message={receiveError} />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReceiveTarget(null)}
                disabled={receiving}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReceive()}
                disabled={receiving}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {receiving && <Loader2 className="h-4 w-4 animate-spin" />}
                {receiving ? "Receiving…" : "Receive stock"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ------------------------------------------------------------ */}
      {/*  Complete transfer modal                                      */}
      {/* ------------------------------------------------------------ */}
      <Modal
        open={Boolean(transferTarget)}
        onClose={() => !completing && setTransferTarget(null)}
        labelledBy="transfer-modal-title"
        maxWidth="max-w-lg"
      >
        {transferTarget && (
          <>
            <div className="mb-2 flex items-center gap-3 text-emerald-400">
              <ArrowLeftRight className="h-6 w-6" />
              <h2
                id="transfer-modal-title"
                className="text-xl font-bold text-white"
              >
                Accept transfer {transferTarget.transferNumber}
              </h2>
            </div>
            <p className="text-xs text-slate-300">
              Confirm receiving and applying this stock transfer between
              branches.
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <div className="flex justify-between border-b border-slate-900 py-1">
                <span className="text-slate-400">Source (deducting from):</span>
                <span className="font-semibold text-rose-300">
                  {transferTarget.fromStore?.name || "Source store"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-900 py-1">
                <span className="text-slate-400">Destination (adding to):</span>
                <span className="font-semibold text-emerald-300">
                  {transferTarget.toStore?.name || "Destination store"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-900 py-1">
                <span className="text-slate-400">Requested:</span>
                <span className="text-slate-200">
                  {dateText(transferTarget.requestedAt)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Total lines:</span>
                <span className="font-semibold text-slate-200">
                  {transferTarget.items?.length || 0} items
                </span>
              </div>
            </div>

            {transferTarget.items?.length > 0 && (
              <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs">
                <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">
                  Items to transfer:
                </p>
                {transferTarget.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex justify-between border-b border-slate-900/60 py-0.5 text-slate-300 last:border-0"
                  >
                    <span className="truncate pr-2">
                      {item.product?.name || "Product"}
                      {item.variant?.name ? ` (${item.variant.name})` : ""}
                    </span>
                    <span className="shrink-0 font-bold text-white">
                      × {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <ErrorNote message={transferError} />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTransferTarget(null)}
                disabled={completing}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeCompleteTransfer()}
                disabled={completing}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {completing && <Loader2 className="h-4 w-4 animate-spin" />}
                {completing ? "Processing…" : "Confirm & receive stock"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ------------------------------------------------------------ */}
      {/*  Create / category dialog                                     */}
      {/* ------------------------------------------------------------ */}
      <Modal
        open={dialog || categoryDialog}
        onClose={() => {
          if (saving) return;
          setDialog(false);
          setCategoryDialog(false);
        }}
        labelledBy="erp-form-title"
      >
        <form onSubmit={categoryDialog ? addExpenseCategory : submit}>
          <h2 id="erp-form-title" className="text-xl font-bold text-white">
            {categoryDialog
              ? "Add expense category"
              : module === "purchasing"
                ? "New purchase order"
                : module === "expenses"
                  ? "Record expense"
                  : module === "supplierPayments"
                    ? "Record supplier payment"
                    : module === "transfers"
                      ? "Request stock transfer"
                      : "Process sales return"}
          </h2>
          <p className="mb-5 mt-1 text-xs text-slate-400">
            This action is recorded on the server and may update inventory or
            balances.
          </p>

          {categoryDialog ? (
            <Field
              label="Category name"
              value={categoryName}
              onChange={setCategoryName}
              required
              disabled={saving}
            />
          ) : module === "purchasing" ? (
            <div className="space-y-3">
              {/* Destination store — required so received stock lands in the right branch */}
              <Select
                label="Destination store"
                value={fields.storeId}
                onChange={(value) => setFields({ ...fields, storeId: value })}
                options={stores.map((item) => [item.id, item.name])}
              />

              <Select
                label="Supplier"
                value={fields.supplierId}
                onChange={(value) =>
                  setFields({ ...fields, supplierId: value })
                }
                options={suppliers.map((item) => [
                  item.id,
                  `${item.name} (${item.code ?? "—"})`,
                ])}
              />

              <Select
                label="Product"
                value={fields.productId}
                onChange={(value) => {
                  const next = products.find((p) => p.id === value);
                  setFields({
                    ...fields,
                    productId: value,
                    variantId: getVariants(next)[0]?.id || "",
                  });
                }}
                options={products.map((item) => [
                  item.id,
                  `${item.name} · ${item.sku}`,
                ])}
              />

              {selectedProductVariants.length > 0 && (
                <Select
                  label="Variant"
                  value={fields.variantId}
                  onChange={(value) =>
                    setFields({ ...fields, variantId: value })
                  }
                  options={selectedProductVariants.map((variant) => [
                    variant.id,
                    `${variant.name}${variant.sku ? ` · ${variant.sku}` : ""}`,
                  ])}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Quantity"
                  type="number"
                  min="1"
                  value={fields.quantity}
                  onChange={(value) =>
                    setFields({ ...fields, quantity: value })
                  }
                  required
                />
                <Field
                  label="Unit cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fields.unitCost}
                  onChange={(value) =>
                    setFields({ ...fields, unitCost: value })
                  }
                  required
                />
              </div>
              <p className="text-right text-sm font-bold text-white">
                Subtotal {amount(poTotal)}
              </p>
              <Field
                label="Expected date"
                type="date"
                value={fields.expectedDate}
                onChange={(value) =>
                  setFields({ ...fields, expectedDate: value })
                }
              />
              <Field
                label="Notes"
                value={fields.notes}
                onChange={(value) => setFields({ ...fields, notes: value })}
              />
            </div>
          ) : module === "expenses" ? (
            <div className="space-y-3">
              {!selectedStoreId && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
                  Select a store in the top bar before recording an expense.
                </p>
              )}
              <Select
                label="Expense category"
                value={fields.categoryId}
                onChange={(value) =>
                  setFields({ ...fields, categoryId: value })
                }
                options={expenseCategories.map((item) => [item.id, item.name])}
              />
              <Field
                label="Amount"
                type="number"
                min="0.01"
                step="0.01"
                value={fields.amount}
                onChange={(value) => setFields({ ...fields, amount: value })}
                required
              />
              <Field
                label="Date"
                type="date"
                value={fields.expenseDate}
                onChange={(value) =>
                  setFields({ ...fields, expenseDate: value })
                }
                required
              />
              <Field
                label="Description"
                value={fields.description}
                onChange={(value) =>
                  setFields({ ...fields, description: value })
                }
              />
            </div>
          ) : module === "supplierPayments" ? (
            <div className="space-y-3">
              <Select
                label="Supplier"
                value={fields.supplierId}
                onChange={(value) =>
                  setFields({ ...fields, supplierId: value })
                }
                options={suppliers.map((item) => [item.id, item.name])}
              />
              <Field
                label="Amount"
                type="number"
                min="0.01"
                step="0.01"
                value={fields.amount}
                onChange={(value) => setFields({ ...fields, amount: value })}
                required
              />
              <Select
                label="Payment method"
                value={fields.paymentMethod}
                onChange={(value) =>
                  setFields({ ...fields, paymentMethod: value })
                }
                options={PAYMENT_METHODS.map((value) => [
                  value,
                  value.split("_").join(" "),
                ])}
              />
              <Field
                label="Reference number"
                value={fields.referenceNumber}
                onChange={(value) =>
                  setFields({ ...fields, referenceNumber: value })
                }
              />
              <Field
                label="Note"
                value={fields.notes}
                onChange={(value) => setFields({ ...fields, notes: value })}
              />
            </div>
          ) : module === "transfers" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Source store:{" "}
                <strong className="text-white">
                  {stores.find((item) => item.id === selectedStoreId)?.name ||
                    "Select a store first"}
                </strong>
              </p>
              <Select
                label="Destination"
                value={fields.toStoreId}
                onChange={(value) => setFields({ ...fields, toStoreId: value })}
                options={transferDestinationStores
                  .filter((item) => item.id !== selectedStoreId)
                  .map((item) => [item.id, item.name])}
              />
              <Select
                label="Product"
                value={fields.productId}
                onChange={(value) => {
                  const next = products.find((p) => p.id === value);
                  setFields({
                    ...fields,
                    productId: value,
                    variantId: getVariants(next)[0]?.id || "",
                  });
                }}
                options={products.map((item) => [
                  item.id,
                  `${item.name} · ${item.sku}`,
                ])}
              />
              {selectedProductVariants.length > 0 && (
                <Select
                  label="Variant"
                  value={fields.variantId}
                  onChange={(value) =>
                    setFields({ ...fields, variantId: value })
                  }
                  options={selectedProductVariants.map((variant) => [
                    variant.id,
                    variant.name,
                  ])}
                />
              )}
              <Field
                label="Quantity"
                type="number"
                min="1"
                value={fields.quantity}
                onChange={(value) => setFields({ ...fields, quantity: value })}
                required
              />
              <Field
                label="Notes"
                value={fields.notes}
                onChange={(value) => setFields({ ...fields, notes: value })}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Select
                label="Completed order"
                value={fields.orderId}
                onChange={(value) => {
                  const order = orders.find((entry) => entry.id === value);
                  setFields({
                    ...fields,
                    orderId: value,
                    orderItemId: order?.items?.[0]?.id || "",
                  });
                }}
                options={orders
                  .filter(isReturnable)
                  .map((order) => [
                    order.id,
                    `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
                  ])}
              />
              <Select
                label="Returned item"
                value={fields.orderItemId}
                onChange={(value) =>
                  setFields({ ...fields, orderItemId: value })
                }
                options={(selectedOrder?.items || []).map((item) => [
                  item.id,
                  `${item.product?.name || "Product"} · qty ${item.quantity}`,
                ])}
              />
              {orderItem && (
                <p className="text-xs text-slate-400">
                  Remaining returnable:{" "}
                  <strong className="text-white">
                    {orderItem.quantity -
                      Number(orderItem.returnedQuantity || 0)}
                  </strong>
                </p>
              )}
              <Field
                label="Quantity"
                type="number"
                min="1"
                max={Math.max(
                  1,
                  (orderItem?.quantity || 1) -
                    Number(orderItem?.returnedQuantity || 0),
                )}
                value={fields.quantity}
                onChange={(value) => setFields({ ...fields, quantity: value })}
                required
              />
              <p className="text-right text-sm font-bold text-white">
                Refund total {amount(itemTotal)}
              </p>
              <Select
                label="Refund method"
                value={fields.refundMethod}
                onChange={(value) =>
                  setFields({ ...fields, refundMethod: value })
                }
                options={PAYMENT_METHODS.map((value) => [
                  value,
                  value.split("_").join(" "),
                ])}
              />
              <Field
                label="Reason"
                value={fields.reason}
                onChange={(value) => setFields({ ...fields, reason: value })}
                required
              />
            </div>
          )}

          <ErrorNote message={formError} />

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setDialog(false);
                setCategoryDialog(false);
              }}
              disabled={saving}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                             */
/* ------------------------------------------------------------------ */

/**
 * Modal — the `onClose` handler is stored in a ref so that inline
 * callbacks from the parent don't re-run the effect on every keystroke.
 * This is what previously stole focus from text inputs after one character.
 */
function Modal({
  open,
  onClose,
  labelledBy,
  children,
  maxWidth = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest handler without re-running the effect.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the panel only once, when the modal opens.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]); // <-- ONLY `open`, not `onClose`

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function ListHeader({ cols }: { cols: string[] }) {
  return (
    <div
      className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
      style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
    >
      {cols.map((col) => (
        <span key={col}>{col}</span>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: number;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        required={required}
        type={type}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400 disabled:opacity-60"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
      >
        <option value="">Choose…</option>
        {options.map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
      {options.length === 0 && (
        <span className="mt-1 block text-amber-300">
          Create the required record first.
        </span>
      )}
    </label>
  );
}

function Reports({
  orders,
  expenses,
  purchaseOrders,
}: {
  orders: ApiOrder[];
  expenses: any[];
  purchaseOrders: any[];
}) {
  const revenue = orders
    .filter(
      (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
    )
    .reduce((sum, order) => sum + order.grandTotal, 0);

  const operatingExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );

  const receivedOrders = purchaseOrders.filter(
    (po) => po.status === "RECEIVED",
  );
  const procurement = receivedOrders.reduce(
    (sum, po) => sum + Number(po.grandTotal || 0),
    0,
  );

  const cards = [
    [
      "Recent completed sales",
      amount(revenue),
      `${orders.length} recent order records loaded`,
    ],
    [
      "Recorded expenses",
      amount(operatingExpenses),
      `${expenses.length} expense records loaded`,
    ],
    [
      "Received purchasing",
      amount(procurement),
      `${receivedOrders.length} purchase orders received`,
    ],
  ];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        {cards.map(([title, total, note]) => (
          <article
            key={title}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <p className="text-xs text-slate-400">{title}</p>
            <p className="mt-3 text-2xl font-black text-white">{total}</p>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>
      <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
        Operational summary only. This is not a profit-and-loss statement:
        purchase values, unpaid liabilities, taxes, refunds and accounting
        journals are not fully reconciled here. Sales are limited to recent
        orders returned by the API.
      </p>
    </>
  );
}

// import {
//   FormEvent,
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";
// import { createPortal } from "react-dom";
// import {
//   AlertTriangle,
//   ArrowLeftRight,
//   BadgeDollarSign,
//   CheckCircle2,
//   ClipboardCheck,
//   FileBarChart2,
//   Loader2,
//   Plus,
//   Receipt,
//   Truck,
//   Undo2,
//   X,
// } from "lucide-react";
// import { ApiOrder } from "../store/apiSlice";
// import { Product } from "../types";
// import { WorkflowGuide } from "./WorkflowGuide";

// /* ------------------------------------------------------------------ */
// /*  Types                                                              */
// /* ------------------------------------------------------------------ */

// type Module =
//   | "purchasing"
//   | "expenses"
//   | "supplierPayments"
//   | "transfers"
//   | "returns"
//   | "reports";

// type Fields = Record<string, string>;

// interface Props {
//   selectedStoreId?: string;
//   stores: { id: string; name: string }[];
//   products: Product[];
//   suppliers: any[];
//   orders: ApiOrder[];
//   purchaseOrders: any[];
//   expenses: any[];
//   expenseCategories: any[];
//   supplierPayments: any[];
//   transfers: any[];
//   returns: any[];
//   loading: boolean;
//   onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>;
//   onUpdatePurchaseOrder: (
//     id: string,
//     patch: Record<string, unknown>,
//   ) => Promise<unknown>;
//   onReceivePurchaseOrder: (
//     id: string,
//     storeId: string,
//     lots?: {
//       purchaseOrderItemId: string;
//       number: string;
//       expiryDate?: string;
//     }[],
//   ) => Promise<unknown>;
//   onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>;
//   onCreateExpenseCategory: (name: string) => Promise<unknown>;
//   onCreateSupplierPayment: (
//     payload: Record<string, unknown>,
//   ) => Promise<unknown>;
//   onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>;
//   onCompleteTransfer: (id: string) => Promise<unknown>;
//   onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
// }

// interface Toast {
//   id: number;
//   tone: "success" | "error";
//   message: string;
// }

// /* ------------------------------------------------------------------ */
// /*  Constants & helpers                                                */
// /* ------------------------------------------------------------------ */

// const MODULES: { id: Module; label: string; icon: typeof Truck }[] = [
//   { id: "purchasing", label: "Purchasing", icon: Truck },
//   { id: "expenses", label: "Expenses", icon: Receipt },
//   { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
//   { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
//   { id: "returns", label: "Sales returns", icon: Undo2 },
//   { id: "reports", label: "Reports", icon: FileBarChart2 },
// ];

// /** Single source of truth for table columns — header and rows always agree. */
// const COLUMNS: Record<Module, string[]> = {
//   purchasing: [
//     "PO number",
//     "Supplier",
//     "Order date",
//     "Total",
//     "Status",
//     "Actions",
//   ],
//   expenses: ["Category", "Description", "Date", "Store", "Amount"],
//   supplierPayments: ["Supplier", "Paid at", "Method", "Reference", "Amount"],
//   transfers: [
//     "Transfer",
//     "From → To",
//     "Requested",
//     "Items",
//     "Status",
//     "Actions",
//   ],
//   returns: ["Return", "Order", "Customer", "Date", "Refund", "Status"],
//   reports: [],
// };

// const PAYMENT_METHODS = [
//   "CASH",
//   "KBZ_PAY",
//   "CB_PAY",
//   "WAVE_PAY",
//   "CARD",
//   "BANK_TRANSFER",
// ];

// const RECEIVABLE_STATUSES = ["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"];
// const COMPLETABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

// const today = () => new Date().toISOString().slice(0, 10);

// const initialFields = (): Fields => ({
//   supplierId: "",
//   productId: "",
//   variantId: "",
//   quantity: "1",
//   unitCost: "",
//   expectedDate: "",
//   notes: "",
//   categoryId: "",
//   amount: "",
//   description: "",
//   expenseDate: today(),
//   paymentMethod: "CASH",
//   referenceNumber: "",
//   toStoreId: "",
//   orderId: "",
//   orderItemId: "",
//   reason: "",
//   refundMethod: "CASH",
// });

// const errorMessage = (error: unknown) => {
//   if (typeof error === "string") return error;
//   const value = error as { data?: { message?: string }; message?: string };
//   return (
//     value?.data?.message ||
//     value?.message ||
//     "The server could not save this operation."
//   );
// };

// const dateText = (value?: string) =>
//   value ? new Date(value).toLocaleString() : "—";

// const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

// const transferStatusLabel = (status: string) =>
//   status === "RECEIVED" ? "COMPLETED" : status;

// /* ------------------------------------------------------------------ */
// /*  Main view                                                          */
// /* ------------------------------------------------------------------ */

// export function ERPView(props: Props) {
//   const {
//     selectedStoreId,
//     stores,
//     products,
//     suppliers,
//     orders,
//     purchaseOrders,
//     expenses,
//     expenseCategories,
//     supplierPayments,
//     transfers,
//     returns,
//     loading,
//     onCreatePurchaseOrder,
//     onUpdatePurchaseOrder,
//     onReceivePurchaseOrder,
//     onCreateExpense,
//     onCreateExpenseCategory,
//     onCreateSupplierPayment,
//     onCreateTransfer,
//     onCompleteTransfer,
//     onCreateReturn,
//   } = props;

//   /* ---------------------------- state ---------------------------- */

//   const [module, setModule] = useState<Module>("purchasing");
//   const [search, setSearch] = useState("");
//   const [statusFilter, setStatusFilter] = useState("ALL");

//   // create / edit dialog
//   const [dialog, setDialog] = useState(false);
//   const [fields, setFields] = useState<Fields>(initialFields);
//   const [formError, setFormError] = useState("");
//   const [saving, setSaving] = useState(false);

//   // expense-category dialog
//   const [categoryDialog, setCategoryDialog] = useState(false);
//   const [categoryName, setCategoryName] = useState("");

//   // receive purchase-order dialog
//   const [receiveTarget, setReceiveTarget] = useState<any>(null);
//   const [receiveStoreId, setReceiveStoreId] = useState("");
//   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
//   const [receiveLots, setReceiveLots] = useState<
//     Record<string, { number: string; expiryDate: string }>
//   >({});
//   const [receiveError, setReceiveError] = useState("");
//   const [receiving, setReceiving] = useState(false);

//   // complete-transfer dialog
//   const [transferTarget, setTransferTarget] = useState<any>(null);
//   const [transferError, setTransferError] = useState("");
//   const [completing, setCompleting] = useState(false);

//   // per-row busy marker (e.g. "po:<id>", "transfer:<id>")
//   const [busyId, setBusyId] = useState<string | null>(null);

//   // toasts
//   const [toasts, setToasts] = useState<Toast[]>([]);
//   const toastSeq = useRef(0);
//   const toastTimers = useRef<number[]>([]);

//   const pushToast = useCallback((tone: Toast["tone"], message: string) => {
//     const id = ++toastSeq.current;
//     setToasts((current) => [...current, { id, tone, message }]);
//     const timer = window.setTimeout(
//       () => setToasts((current) => current.filter((toast) => toast.id !== id)),
//       5000,
//     );
//     toastTimers.current.push(timer);
//   }, []);

//   const dismissToast = useCallback((id: number) => {
//     setToasts((current) => current.filter((toast) => toast.id !== id));
//   }, []);

//   useEffect(
//     () => () => {
//       toastTimers.current.forEach(window.clearTimeout);
//     },
//     [],
//   );

//   /* -------------------------- derived data ------------------------ */

//   const selectedProduct = products.find(
//     (product) => product.id === fields.productId,
//   );
//   const selectedOrder = orders.find((order) => order.id === fields.orderId);
//   const orderItem = selectedOrder?.items?.find(
//     (item) => item.id === fields.orderItemId,
//   );
//   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
//   const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
//   const poTotal = quantity * Number(fields.unitCost || 0);
//   const isReturnable = (order: ApiOrder) =>
//     order.status === "COMPLETED" || order.paymentStatus === "PAID";

//   const records = useMemo(() => {
//     const values = (
//       {
//         purchasing: purchaseOrders,
//         expenses: expenses,
//         supplierPayments: supplierPayments,
//         transfers: transfers,
//         returns: returns,
//         reports: [],
//       } as Record<Module, any[]>
//     )[module];

//     const normalized = search.trim().toLowerCase();
//     if (!normalized) return values;

//     return values.filter((item) =>
//       JSON.stringify([
//         item.poNumber,
//         item.transferNumber,
//         item.returnNumber,
//         item.order?.orderNumber,
//         item.supplier?.name,
//         item.customer?.name,
//         item.description,
//         item.notes,
//         item.reason,
//         item.referenceNumber,
//         item.category?.name,
//         item.store?.name,
//         item.fromStore?.name,
//         item.toStore?.name,
//         item.status,
//         item.refundStatus,
//       ])
//         .toLowerCase()
//         .includes(normalized),
//     );
//   }, [
//     module,
//     purchaseOrders,
//     expenses,
//     supplierPayments,
//     transfers,
//     returns,
//     search,
//   ]);

//   const statusOptions = useMemo(() => {
//     if (
//       module === "reports" ||
//       module === "expenses" ||
//       module === "supplierPayments"
//     )
//       return [];
//     const set = new Set<string>();
//     records.forEach((record: any) => {
//       const status = module === "returns" ? record.refundStatus : record.status;
//       if (status) set.add(status);
//     });
//     return ["ALL", ...Array.from(set).sort()];
//   }, [records, module]);

//   const visibleRecords = useMemo(() => {
//     if (statusFilter === "ALL") return records;
//     return records.filter((record: any) => {
//       const status = module === "returns" ? record.refundStatus : record.status;
//       return status === statusFilter;
//     });
//   }, [records, statusFilter, module]);

//   const cols = COLUMNS[module];
//   const gridStyle = useMemo(
//     () => ({ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }),
//     [cols.length],
//   );

//   /* ---------------------------- actions --------------------------- */

//   const resetMessages = () => {
//     setFormError("");
//     setReceiveError("");
//     setTransferError("");
//   };

//   const switchModule = (next: Module) => {
//     setModule(next);
//     setSearch("");
//     setStatusFilter("ALL");
//     resetMessages();
//   };

//   const openDialog = () => {
//     const firstOrder = orders.find(isReturnable);
//     setFields({
//       ...initialFields(),
//       supplierId: suppliers[0]?.id || "",
//       productId: products[0]?.id || "",
//       variantId: products[0]?.variants?.[0]?.id || "",
//       categoryId: expenseCategories[0]?.id || "",
//       toStoreId: stores.find((store) => store.id !== selectedStoreId)?.id || "",
//       orderId: firstOrder?.id || "",
//       orderItemId: firstOrder?.items?.[0]?.id || "",
//     });
//     resetMessages();
//     setDialog(true);
//   };

//   const submit = async (event: FormEvent) => {
//     event.preventDefault();
//     setSaving(true);
//     setFormError("");

//     try {
//       if (module === "purchasing") {
//         if (
//           !fields.supplierId ||
//           !fields.productId ||
//           quantity < 1 ||
//           Number(fields.unitCost) < 0 ||
//           fields.unitCost === ""
//         ) {
//           throw new Error(
//             "Select a supplier and product, and enter a valid quantity and unit cost.",
//           );
//         }
//         const product = products.find(
//           (entry) => entry.id === fields.productId,
//         )!;
//         await onCreatePurchaseOrder({
//           supplierId: fields.supplierId,
//           status: "DRAFT",
//           currencyCode: "MMK",
//           expectedDate: fields.expectedDate || undefined,
//           subTotal: poTotal,
//           taxAmount: 0,
//           grandTotal: poTotal,
//           notes: fields.notes || undefined,
//           items: [
//             {
//               productId: product.id,
//               variantId: fields.variantId || product.variants?.[0]?.id,
//               quantity,
//               unitCost: Number(fields.unitCost),
//               totalCost: poTotal,
//             },
//           ],
//         });
//         pushToast("success", "Purchase order created as draft.");
//       } else if (module === "expenses") {
//         if (!selectedStoreId)
//           throw new Error(
//             "Select a store from the top bar before recording an expense.",
//           );
//         if (!fields.categoryId || Number(fields.amount) <= 0)
//           throw new Error(
//             "Select an expense category and enter an amount greater than zero.",
//           );
//         await onCreateExpense({
//           storeId: selectedStoreId,
//           categoryId: fields.categoryId,
//           amount: Number(fields.amount),
//           currencyCode: "MMK",
//           description: fields.description || undefined,
//           expenseDate: fields.expenseDate || undefined,
//         });
//         pushToast("success", "Expense recorded.");
//       } else if (module === "supplierPayments") {
//         if (!fields.supplierId || Number(fields.amount) <= 0)
//           throw new Error("Select a supplier and enter a payment amount.");
//         await onCreateSupplierPayment({
//           supplierId: fields.supplierId,
//           amount: Number(fields.amount),
//           currencyCode: "MMK",
//           paymentMethod: fields.paymentMethod,
//           referenceNumber: fields.referenceNumber || undefined,
//           note: fields.notes || undefined,
//         });
//         pushToast("success", "Supplier payment recorded.");
//       } else if (module === "transfers") {
//         if (!selectedStoreId)
//           throw new Error("Select a source store from the top bar first.");
//         if (!fields.toStoreId || !fields.productId || quantity < 1) {
//           throw new Error("Choose a destination store, product, and quantity.");
//         }
//         if (fields.toStoreId === selectedStoreId)
//           throw new Error("Source and destination stores must be different.");
//         const product = products.find(
//           (entry) => entry.id === fields.productId,
//         )!;
//         await onCreateTransfer({
//           fromStoreId: selectedStoreId,
//           toStoreId: fields.toStoreId,
//           notes: fields.notes || undefined,
//           items: [
//             {
//               productId: product.id,
//               variantId: fields.variantId || product.variants?.[0]?.id,
//               quantity,
//             },
//           ],
//         });
//         pushToast("success", "Transfer requested.");
//       } else if (module === "returns") {
//         if (!selectedOrder || !orderItem)
//           throw new Error("Choose a completed order and an item to return.");
//         if (quantity < 1 || !fields.reason.trim())
//           throw new Error("Enter a quantity and a return reason.");
//         const remaining =
//           orderItem.quantity - Number(orderItem.returnedQuantity || 0);
//         if (quantity > remaining) {
//           throw new Error(
//             `Only ${remaining} unit(s) remain returnable on this line.`,
//           );
//         }
//         await onCreateReturn({
//           orderId: selectedOrder.id,
//           totalAmount: itemTotal,
//           refundMethod: fields.refundMethod,
//           refundStatus: "COMPLETED",
//           reason: fields.reason.trim(),
//           items: [
//             {
//               orderItemId: orderItem.id,
//               quantity,
//               refundAmount: itemTotal,
//               reason: fields.reason.trim(),
//             },
//           ],
//         });
//         pushToast("success", "Sales return processed.");
//       }

//       setDialog(false);
//     } catch (cause) {
//       setFormError(errorMessage(cause));
//     } finally {
//       setSaving(false);
//     }
//   };

//   const markOrdered = async (po: any) => {
//     setBusyId(`po:${po.id}`);
//     try {
//       await onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
//       pushToast("success", `${po.poNumber} marked as ordered.`);
//     } catch (cause) {
//       pushToast("error", errorMessage(cause));
//     } finally {
//       setBusyId(null);
//     }
//   };

//   const openReceive = (po: any) => {
//     setReceiveStoreId(selectedStoreId || stores[0]?.id || "");
//     setReceiveError("");
//     setTrackReceivedLots(false);
//     setReceiveLots(
//       Object.fromEntries(
//         (po.items ?? []).map((item: any) => [
//           item.id,
//           { number: "", expiryDate: "" },
//         ]),
//       ),
//     );
//     setReceiveTarget(po);
//   };

//   const confirmReceive = async () => {
//     if (!receiveTarget) return;
//     const targetStore =
//       receiveStoreId || selectedStoreId || stores[0]?.id || "";
//     if (!targetStore) {
//       setReceiveError("Select a store to receive the stock into.");
//       return;
//     }

//     let lots:
//       | { purchaseOrderItemId: string; number: string; expiryDate?: string }[]
//       | undefined;

//     if (trackReceivedLots) {
//       const lines = (receiveTarget.items ?? []).map((item: any) => ({
//         id: item.id,
//         name: item.product?.name || "Product",
//         number: (receiveLots[item.id]?.number ?? "").trim(),
//         expiryDate: receiveLots[item.id]?.expiryDate || "",
//       }));
//       const missing = lines.find((line: any) => !line.number);
//       if (missing) {
//         setReceiveError(
//           `Enter a batch / lot number for “${missing.name}”, or turn lot tracking off.`,
//         );
//         return;
//       }
//       lots = lines.map((line: any) => ({
//         purchaseOrderItemId: line.id,
//         number: line.number,
//         expiryDate: line.expiryDate || undefined,
//       }));
//     }

//     setReceiving(true);
//     setReceiveError("");
//     try {
//       await onReceivePurchaseOrder(receiveTarget.id, targetStore, lots);
//       pushToast(
//         "success",
//         `${receiveTarget.poNumber} received. Inventory has been updated.`,
//       );
//       setReceiveTarget(null);
//     } catch (cause) {
//       setReceiveError(errorMessage(cause));
//     } finally {
//       setReceiving(false);
//     }
//   };

//   const openCompleteTransfer = (transfer: any) => {
//     setTransferError("");
//     setTransferTarget(transfer);
//   };

//   const executeCompleteTransfer = async () => {
//     if (!transferTarget) return;
//     setCompleting(true);
//     setTransferError("");
//     try {
//       await onCompleteTransfer(transferTarget.id);
//       pushToast(
//         "success",
//         `Transfer ${transferTarget.transferNumber} completed. Inventories have been updated.`,
//       );
//       setTransferTarget(null);
//     } catch (cause) {
//       setTransferError(errorMessage(cause));
//     } finally {
//       setCompleting(false);
//     }
//   };

//   const addExpenseCategory = async (event: FormEvent) => {
//     event.preventDefault();
//     const name = categoryName.trim();
//     if (!name) {
//       setFormError("Enter a category name.");
//       return;
//     }
//     setSaving(true);
//     setFormError("");
//     try {
//       await onCreateExpenseCategory(name);
//       setCategoryDialog(false);
//       setCategoryName("");
//       pushToast("success", "Expense category created.");
//     } catch (cause) {
//       setFormError(errorMessage(cause));
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* ----------------------------- render --------------------------- */

//   return (
//     <main className="flex-1 overflow-y-auto p-7">
//       <header className="mb-6">
//         <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
//           Enterprise operations
//         </p>
//         <h1 className="mt-2 text-3xl font-black text-white">ERP</h1>
//         <p className="mt-1 text-sm text-slate-400">
//           Purchasing, costs, supplier settlement, branch stock and returns.
//         </p>
//       </header>

//       <WorkflowGuide />

//       {/* Toasts */}
//       <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-80 flex-col gap-2">
//         {toasts.map((toast) => (
//           <div
//             key={toast.id}
//             role="status"
//             className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
//               toast.tone === "success"
//                 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
//                 : "border-rose-500/30 bg-rose-500/10 text-rose-200"
//             }`}
//           >
//             {toast.tone === "success" ? (
//               <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
//             ) : (
//               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
//             )}
//             <span className="flex-1 leading-5">{toast.message}</span>
//             <button
//               type="button"
//               aria-label="Dismiss notification"
//               onClick={() => dismissToast(toast.id)}
//               className="opacity-60 transition-opacity hover:opacity-100"
//             >
//               <X className="h-4 w-4" />
//             </button>
//           </div>
//         ))}
//       </div>

//       <nav className="mb-5 flex flex-wrap gap-2">
//         {MODULES.map(({ id, label, icon: Icon }) => (
//           <button
//             key={id}
//             type="button"
//             onClick={() => switchModule(id)}
//             aria-current={module === id}
//             className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors ${
//               module === id
//                 ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
//                 : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
//             }`}
//           >
//             <Icon className="h-4 w-4" />
//             {label}
//           </button>
//         ))}
//       </nav>

//       {module === "reports" ? (
//         <Reports
//           orders={orders}
//           expenses={expenses}
//           purchaseOrders={purchaseOrders}
//         />
//       ) : (
//         <>
//           <section className="mb-4 flex flex-wrap items-center gap-3">
//             <input
//               value={search}
//               onChange={(event) => setSearch(event.target.value)}
//               placeholder="Search records"
//               aria-label="Search records"
//               className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
//             />

//             {module === "expenses" && (
//               <button
//                 type="button"
//                 onClick={() => {
//                   setCategoryName("");
//                   setFormError("");
//                   setCategoryDialog(true);
//                 }}
//                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
//               >
//                 Expense categories
//               </button>
//             )}

//             <button
//               type="button"
//               onClick={openDialog}
//               className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400"
//             >
//               <Plus className="h-4 w-4" />
//               {module === "purchasing"
//                 ? "New purchase order"
//                 : module === "expenses"
//                   ? "Record expense"
//                   : module === "supplierPayments"
//                     ? "Record payment"
//                     : module === "transfers"
//                       ? "Request transfer"
//                       : "Process return"}
//             </button>
//           </section>

//           {statusOptions.length > 1 && (
//             <div className="mb-4 flex flex-wrap items-center gap-2">
//               {statusOptions.map((status) => (
//                 <button
//                   key={status}
//                   type="button"
//                   onClick={() => setStatusFilter(status)}
//                   className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
//                     statusFilter === status
//                       ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
//                       : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
//                   }`}
//                 >
//                   {status === "ALL" ? "All" : status.replace(/_/g, " ")}
//                 </button>
//               ))}
//             </div>
//           )}

//           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
//             <div className="overflow-x-auto">
//               <div className="min-w-[880px]">
//                 <ListHeader cols={cols} />

//                 {loading ? (
//                   <p className="flex items-center justify-center gap-2 p-10 text-center text-sm text-slate-400">
//                     <Loader2 className="h-4 w-4 animate-spin" />
//                     Loading ERP records…
//                   </p>
//                 ) : visibleRecords.length === 0 ? (
//                   <p className="p-10 text-center text-sm text-slate-400">
//                     {records.length === 0
//                       ? "No records found."
//                       : "No records match the current filter."}
//                   </p>
//                 ) : (
//                   visibleRecords.map((record: any) => (
//                     <div
//                       key={record.id}
//                       style={gridStyle}
//                       className="grid items-center gap-4 border-b border-slate-800/70 px-5 py-4 text-xs last:border-0"
//                     >
//                       {module === "purchasing" ? (
//                         <>
//                           <span className="font-bold text-white">
//                             {record.poNumber}
//                           </span>
//                           <span className="truncate text-slate-300">
//                             {record.supplier?.name || "—"}
//                           </span>
//                           <span className="text-slate-400">
//                             {dateText(record.orderDate)}
//                           </span>
//                           <span className="font-semibold text-white">
//                             {amount(record.grandTotal)}
//                           </span>
//                           <span className="text-amber-300">
//                             {record.status?.replace(/_/g, " ")}
//                           </span>
//                           <span className="flex flex-wrap gap-1">
//                             {record.status === "DRAFT" && (
//                               <button
//                                 type="button"
//                                 onClick={() => void markOrdered(record)}
//                                 disabled={busyId === `po:${record.id}`}
//                                 className="flex items-center gap-1 rounded-lg bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
//                               >
//                                 {busyId === `po:${record.id}` && (
//                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
//                                 )}
//                                 Mark ordered
//                               </button>
//                             )}
//                             {RECEIVABLE_STATUSES.includes(record.status) && (
//                               <button
//                                 type="button"
//                                 onClick={() => openReceive(record)}
//                                 className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
//                               >
//                                 <ClipboardCheck className="h-3.5 w-3.5" />
//                                 Receive
//                               </button>
//                             )}
//                             {record.status === "RECEIVED" && (
//                               <span className="text-[11px] font-medium text-emerald-400/80">
//                                 ✓ Received
//                               </span>
//                             )}
//                           </span>
//                         </>
//                       ) : module === "expenses" ? (
//                         <>
//                           <span className="font-semibold text-white">
//                             {record.category?.name || "—"}
//                           </span>
//                           <span className="truncate text-slate-300">
//                             {record.description || "—"}
//                           </span>
//                           <span className="text-slate-400">
//                             {dateText(record.expenseDate)}
//                           </span>
//                           <span className="truncate text-slate-400">
//                             {record.store?.name || "—"}
//                           </span>
//                           <span className="text-right font-bold text-white">
//                             {amount(record.amount)}
//                           </span>
//                         </>
//                       ) : module === "supplierPayments" ? (
//                         <>
//                           <span className="truncate font-semibold text-white">
//                             {record.supplier?.name || "—"}
//                           </span>
//                           <span className="text-slate-400">
//                             {dateText(record.paidAt)}
//                           </span>
//                           <span className="text-slate-300">
//                             {record.paymentMethod?.replace(/_/g, " ")}
//                           </span>
//                           <span className="truncate text-slate-400">
//                             {record.referenceNumber || "—"}
//                           </span>
//                           <span className="text-right font-bold text-white">
//                             {amount(record.amount)}
//                           </span>
//                         </>
//                       ) : module === "transfers" ? (
//                         <>
//                           <span className="font-bold text-white">
//                             {record.transferNumber}
//                           </span>
//                           <span className="truncate text-slate-300">
//                             {record.fromStore?.name} → {record.toStore?.name}
//                           </span>
//                           <span className="text-slate-400">
//                             {dateText(record.requestedAt)}
//                           </span>
//                           <span className="text-slate-400">
//                             {record.items?.length || 0} lines
//                           </span>
//                           <span
//                             className={
//                               record.status === "RECEIVED"
//                                 ? "font-bold text-emerald-400"
//                                 : "font-bold text-amber-300"
//                             }
//                           >
//                             {transferStatusLabel(record.status)}
//                           </span>
//                           <span>
//                             {COMPLETABLE_TRANSFER_STATUSES.includes(
//                               record.status,
//                             ) ? (
//                               <button
//                                 type="button"
//                                 onClick={() => openCompleteTransfer(record)}
//                                 disabled={
//                                   completing ||
//                                   busyId === `transfer:${record.id}`
//                                 }
//                                 className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
//                               >
//                                 {busyId === `transfer:${record.id}` && (
//                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
//                                 )}
//                                 Accept &amp; Complete
//                               </button>
//                             ) : (
//                               <span className="text-[11px] font-medium text-emerald-400/80">
//                                 ✓ Received
//                               </span>
//                             )}
//                           </span>
//                         </>
//                       ) : (
//                         <>
//                           <span className="font-bold text-white">
//                             {record.returnNumber}
//                           </span>
//                           <span className="text-slate-300">
//                             {record.order?.orderNumber ||
//                               record.orderId?.slice(0, 8) ||
//                               "—"}
//                           </span>
//                           <span className="truncate text-slate-400">
//                             {record.customer?.name || "Walk-in"}
//                           </span>
//                           <span className="text-slate-400">
//                             {dateText(record.createdAt)}
//                           </span>
//                           <span className="font-bold text-white">
//                             {amount(record.totalAmount)}
//                           </span>
//                           <span className="text-emerald-300">
//                             {record.refundStatus}
//                           </span>
//                         </>
//                       )}
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>
//           </section>
//         </>
//       )}

//       {/* ------------------------------------------------------------ */}
//       {/*  Receive purchase order modal                                 */}
//       {/* ------------------------------------------------------------ */}
//       <Modal
//         open={Boolean(receiveTarget)}
//         onClose={() => !receiving && setReceiveTarget(null)}
//         labelledBy="receive-modal-title"
//       >
//         {receiveTarget && (
//           <>
//             <h2
//               id="receive-modal-title"
//               className="text-xl font-bold text-white"
//             >
//               Receive {receiveTarget.poNumber}
//             </h2>
//             <p className="mt-1 text-xs text-slate-400">
//               Record delivered products into inventory. Select the warehouse or
//               store receiving this delivery.
//             </p>

//             <div className="mt-4">
//               <label className="mb-1.5 block text-xs font-medium text-slate-300">
//                 Destination store / branch
//               </label>
//               <select
//                 value={receiveStoreId}
//                 onChange={(event) => setReceiveStoreId(event.target.value)}
//                 className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
//               >
//                 {stores.map((store) => (
//                   <option key={store.id} value={store.id}>
//                     {store.name}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
//               <input
//                 type="checkbox"
//                 checked={trackReceivedLots}
//                 onChange={(event) => setTrackReceivedLots(event.target.checked)}
//                 className="accent-emerald-500"
//               />
//               Track batch / lot numbers and expiry
//             </label>

//             {trackReceivedLots && (
//               <div className="mt-4 space-y-3">
//                 {(receiveTarget.items ?? []).map((item: any) => (
//                   <article
//                     key={item.id}
//                     className="rounded-xl border border-slate-800 p-3"
//                   >
//                     <p className="mb-3 text-sm font-semibold text-white">
//                       {item.product?.name || "Product"}
//                       {item.variant?.name ? ` · ${item.variant.name}` : ""}{" "}
//                       <span className="text-slate-400">× {item.quantity}</span>
//                     </p>
//                     <div className="grid gap-3 sm:grid-cols-2">
//                       <Field
//                         label="Batch / lot number"
//                         value={receiveLots[item.id]?.number ?? ""}
//                         onChange={(value) =>
//                           setReceiveLots((current) => ({
//                             ...current,
//                             [item.id]: { ...current[item.id], number: value },
//                           }))
//                         }
//                         required
//                       />
//                       <Field
//                         label="Expiry date (optional)"
//                         type="date"
//                         value={receiveLots[item.id]?.expiryDate ?? ""}
//                         onChange={(value) =>
//                           setReceiveLots((current) => ({
//                             ...current,
//                             [item.id]: {
//                               ...current[item.id],
//                               expiryDate: value,
//                             },
//                           }))
//                         }
//                       />
//                     </div>
//                   </article>
//                 ))}
//               </div>
//             )}

//             <ErrorNote message={receiveError} />

//             <div className="mt-6 flex justify-end gap-3">
//               <button
//                 type="button"
//                 onClick={() => setReceiveTarget(null)}
//                 disabled={receiving}
//                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="button"
//                 onClick={() => void confirmReceive()}
//                 disabled={receiving}
//                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
//               >
//                 {receiving && <Loader2 className="h-4 w-4 animate-spin" />}
//                 {receiving ? "Receiving…" : "Receive stock"}
//               </button>
//             </div>
//           </>
//         )}
//       </Modal>

//       {/* ------------------------------------------------------------ */}
//       {/*  Complete transfer modal                                      */}
//       {/* ------------------------------------------------------------ */}
//       <Modal
//         open={Boolean(transferTarget)}
//         onClose={() => !completing && setTransferTarget(null)}
//         labelledBy="transfer-modal-title"
//         maxWidth="max-w-lg"
//       >
//         {transferTarget && (
//           <>
//             <div className="mb-2 flex items-center gap-3 text-emerald-400">
//               <ArrowLeftRight className="h-6 w-6" />
//               <h2
//                 id="transfer-modal-title"
//                 className="text-xl font-bold text-white"
//               >
//                 Accept transfer {transferTarget.transferNumber}
//               </h2>
//             </div>
//             <p className="text-xs text-slate-300">
//               Confirm receiving and applying this stock transfer between
//               branches.
//             </p>

//             <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
//               <div className="flex justify-between border-b border-slate-900 py-1">
//                 <span className="text-slate-400">Source (deducting from):</span>
//                 <span className="font-semibold text-rose-300">
//                   {transferTarget.fromStore?.name || "Source store"}
//                 </span>
//               </div>
//               <div className="flex justify-between border-b border-slate-900 py-1">
//                 <span className="text-slate-400">Destination (adding to):</span>
//                 <span className="font-semibold text-emerald-300">
//                   {transferTarget.toStore?.name || "Destination store"}
//                 </span>
//               </div>
//               <div className="flex justify-between border-b border-slate-900 py-1">
//                 <span className="text-slate-400">Requested:</span>
//                 <span className="text-slate-200">
//                   {dateText(transferTarget.requestedAt)}
//                 </span>
//               </div>
//               <div className="flex justify-between py-1">
//                 <span className="text-slate-400">Total lines:</span>
//                 <span className="font-semibold text-slate-200">
//                   {transferTarget.items?.length || 0} items
//                 </span>
//               </div>
//             </div>

//             {transferTarget.items?.length > 0 && (
//               <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs">
//                 <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">
//                   Items to transfer:
//                 </p>
//                 {transferTarget.items.map((item: any) => (
//                   <div
//                     key={item.id}
//                     className="flex justify-between border-b border-slate-900/60 py-0.5 text-slate-300 last:border-0"
//                   >
//                     <span className="truncate pr-2">
//                       {item.product?.name || "Product"}
//                       {item.variant?.name ? ` (${item.variant.name})` : ""}
//                     </span>
//                     <span className="shrink-0 font-bold text-white">
//                       × {item.quantity}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             )}

//             <ErrorNote message={transferError} />

//             <div className="mt-6 flex justify-end gap-3">
//               <button
//                 type="button"
//                 onClick={() => setTransferTarget(null)}
//                 disabled={completing}
//                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="button"
//                 onClick={() => void executeCompleteTransfer()}
//                 disabled={completing}
//                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
//               >
//                 {completing && <Loader2 className="h-4 w-4 animate-spin" />}
//                 {completing ? "Processing…" : "Confirm & receive stock"}
//               </button>
//             </div>
//           </>
//         )}
//       </Modal>

//       {/* ------------------------------------------------------------ */}
//       {/*  Create / category dialog                                     */}
//       {/* ------------------------------------------------------------ */}
//       <Modal
//         open={dialog || categoryDialog}
//         onClose={() => {
//           if (saving) return;
//           setDialog(false);
//           setCategoryDialog(false);
//         }}
//         labelledBy="erp-form-title"
//       >
//         <form onSubmit={categoryDialog ? addExpenseCategory : submit}>
//           <h2 id="erp-form-title" className="text-xl font-bold text-white">
//             {categoryDialog
//               ? "Add expense category"
//               : module === "purchasing"
//                 ? "New purchase order"
//                 : module === "expenses"
//                   ? "Record expense"
//                   : module === "supplierPayments"
//                     ? "Record supplier payment"
//                     : module === "transfers"
//                       ? "Request stock transfer"
//                       : "Process sales return"}
//           </h2>
//           <p className="mb-5 mt-1 text-xs text-slate-400">
//             This action is recorded on the server and may update inventory or
//             balances.
//           </p>

//           {categoryDialog ? (
//             <Field
//               label="Category name"
//               value={categoryName}
//               onChange={setCategoryName}
//               required
//               disabled={saving}
//             />
//           ) : module === "purchasing" ? (
//             <div className="space-y-3">
//               <Select
//                 label="Supplier"
//                 value={fields.supplierId}
//                 onChange={(value) =>
//                   setFields({ ...fields, supplierId: value })
//                 }
//                 options={suppliers.map((item) => [
//                   item.id,
//                   `${item.name} (${item.code ?? "—"})`,
//                 ])}
//               />
//               <Select
//                 label="Product"
//                 value={fields.productId}
//                 onChange={(value) =>
//                   setFields({
//                     ...fields,
//                     productId: value,
//                     variantId:
//                       products.find((product) => product.id === value)
//                         ?.variants?.[0]?.id || "",
//                   })
//                 }
//                 options={products.map((item) => [
//                   item.id,
//                   `${item.name} · ${item.sku}`,
//                 ])}
//               />
//               <Select
//                 label="Variant"
//                 value={fields.variantId}
//                 onChange={(value) => setFields({ ...fields, variantId: value })}
//                 options={(selectedProduct?.variants || []).map((variant) => [
//                   variant.id,
//                   variant.name,
//                 ])}
//               />
//               <div className="grid grid-cols-2 gap-3">
//                 <Field
//                   label="Quantity"
//                   type="number"
//                   min="1"
//                   value={fields.quantity}
//                   onChange={(value) =>
//                     setFields({ ...fields, quantity: value })
//                   }
//                   required
//                 />
//                 <Field
//                   label="Unit cost"
//                   type="number"
//                   min="0"
//                   step="0.01"
//                   value={fields.unitCost}
//                   onChange={(value) =>
//                     setFields({ ...fields, unitCost: value })
//                   }
//                   required
//                 />
//               </div>
//               <p className="text-right text-sm font-bold text-white">
//                 Subtotal {amount(poTotal)}
//               </p>
//               <Field
//                 label="Expected date"
//                 type="date"
//                 value={fields.expectedDate}
//                 onChange={(value) =>
//                   setFields({ ...fields, expectedDate: value })
//                 }
//               />
//               <Field
//                 label="Notes"
//                 value={fields.notes}
//                 onChange={(value) => setFields({ ...fields, notes: value })}
//               />
//             </div>
//           ) : module === "expenses" ? (
//             <div className="space-y-3">
//               {!selectedStoreId && (
//                 <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
//                   Select a store in the top bar before recording an expense.
//                 </p>
//               )}
//               <Select
//                 label="Expense category"
//                 value={fields.categoryId}
//                 onChange={(value) =>
//                   setFields({ ...fields, categoryId: value })
//                 }
//                 options={expenseCategories.map((item) => [item.id, item.name])}
//               />
//               <Field
//                 label="Amount"
//                 type="number"
//                 min="0.01"
//                 step="0.01"
//                 value={fields.amount}
//                 onChange={(value) => setFields({ ...fields, amount: value })}
//                 required
//               />
//               <Field
//                 label="Date"
//                 type="date"
//                 value={fields.expenseDate}
//                 onChange={(value) =>
//                   setFields({ ...fields, expenseDate: value })
//                 }
//                 required
//               />
//               <Field
//                 label="Description"
//                 value={fields.description}
//                 onChange={(value) =>
//                   setFields({ ...fields, description: value })
//                 }
//               />
//             </div>
//           ) : module === "supplierPayments" ? (
//             <div className="space-y-3">
//               <Select
//                 label="Supplier"
//                 value={fields.supplierId}
//                 onChange={(value) =>
//                   setFields({ ...fields, supplierId: value })
//                 }
//                 options={suppliers.map((item) => [item.id, item.name])}
//               />
//               <Field
//                 label="Amount"
//                 type="number"
//                 min="0.01"
//                 step="0.01"
//                 value={fields.amount}
//                 onChange={(value) => setFields({ ...fields, amount: value })}
//                 required
//               />
//               <Select
//                 label="Payment method"
//                 value={fields.paymentMethod}
//                 onChange={(value) =>
//                   setFields({ ...fields, paymentMethod: value })
//                 }
//                 options={PAYMENT_METHODS.map((value) => [
//                   value,
//                   value.split("_").join(" "),
//                 ])}
//               />
//               <Field
//                 label="Reference number"
//                 value={fields.referenceNumber}
//                 onChange={(value) =>
//                   setFields({ ...fields, referenceNumber: value })
//                 }
//               />
//               <Field
//                 label="Note"
//                 value={fields.notes}
//                 onChange={(value) => setFields({ ...fields, notes: value })}
//               />
//             </div>
//           ) : module === "transfers" ? (
//             <div className="space-y-3">
//               <p className="text-xs text-slate-400">
//                 Source store:{" "}
//                 <strong className="text-white">
//                   {stores.find((item) => item.id === selectedStoreId)?.name ||
//                     "Select a store first"}
//                 </strong>
//               </p>
//               <Select
//                 label="Destination"
//                 value={fields.toStoreId}
//                 onChange={(value) => setFields({ ...fields, toStoreId: value })}
//                 options={stores
//                   .filter((item) => item.id !== selectedStoreId)
//                   .map((item) => [item.id, item.name])}
//               />
//               <Select
//                 label="Product"
//                 value={fields.productId}
//                 onChange={(value) =>
//                   setFields({
//                     ...fields,
//                     productId: value,
//                     variantId:
//                       products.find((product) => product.id === value)
//                         ?.variants?.[0]?.id || "",
//                   })
//                 }
//                 options={products.map((item) => [
//                   item.id,
//                   `${item.name} · ${item.sku}`,
//                 ])}
//               />
//               <Select
//                 label="Variant"
//                 value={fields.variantId}
//                 onChange={(value) => setFields({ ...fields, variantId: value })}
//                 options={(selectedProduct?.variants || []).map((variant) => [
//                   variant.id,
//                   variant.name,
//                 ])}
//               />
//               <Field
//                 label="Quantity"
//                 type="number"
//                 min="1"
//                 value={fields.quantity}
//                 onChange={(value) => setFields({ ...fields, quantity: value })}
//                 required
//               />
//               <Field
//                 label="Notes"
//                 value={fields.notes}
//                 onChange={(value) => setFields({ ...fields, notes: value })}
//               />
//             </div>
//           ) : (
//             <div className="space-y-3">
//               <Select
//                 label="Completed order"
//                 value={fields.orderId}
//                 onChange={(value) => {
//                   const order = orders.find((entry) => entry.id === value);
//                   setFields({
//                     ...fields,
//                     orderId: value,
//                     orderItemId: order?.items?.[0]?.id || "",
//                   });
//                 }}
//                 options={orders
//                   .filter(isReturnable)
//                   .map((order) => [
//                     order.id,
//                     `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
//                   ])}
//               />
//               <Select
//                 label="Returned item"
//                 value={fields.orderItemId}
//                 onChange={(value) =>
//                   setFields({ ...fields, orderItemId: value })
//                 }
//                 options={(selectedOrder?.items || []).map((item) => [
//                   item.id,
//                   `${item.product?.name || "Product"} · qty ${item.quantity}`,
//                 ])}
//               />
//               {orderItem && (
//                 <p className="text-xs text-slate-400">
//                   Remaining returnable:{" "}
//                   <strong className="text-white">
//                     {orderItem.quantity -
//                       Number(orderItem.returnedQuantity || 0)}
//                   </strong>
//                 </p>
//               )}
//               <Field
//                 label="Quantity"
//                 type="number"
//                 min="1"
//                 max={Math.max(
//                   1,
//                   (orderItem?.quantity || 1) -
//                     Number(orderItem?.returnedQuantity || 0),
//                 )}
//                 value={fields.quantity}
//                 onChange={(value) => setFields({ ...fields, quantity: value })}
//                 required
//               />
//               <p className="text-right text-sm font-bold text-white">
//                 Refund total {amount(itemTotal)}
//               </p>
//               <Select
//                 label="Refund method"
//                 value={fields.refundMethod}
//                 onChange={(value) =>
//                   setFields({ ...fields, refundMethod: value })
//                 }
//                 options={PAYMENT_METHODS.map((value) => [
//                   value,
//                   value.split("_").join(" "),
//                 ])}
//               />
//               <Field
//                 label="Reason"
//                 value={fields.reason}
//                 onChange={(value) => setFields({ ...fields, reason: value })}
//                 required
//               />
//             </div>
//           )}

//           <ErrorNote message={formError} />

//           <div className="mt-6 flex justify-end gap-3">
//             <button
//               type="button"
//               onClick={() => {
//                 setDialog(false);
//                 setCategoryDialog(false);
//               }}
//               disabled={saving}
//               className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               disabled={saving}
//               className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
//             >
//               {saving && <Loader2 className="h-4 w-4 animate-spin" />}
//               {saving ? "Saving…" : "Save"}
//             </button>
//           </div>
//         </form>
//       </Modal>
//     </main>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  Presentational helpers                                             */
// /* ------------------------------------------------------------------ */

// function Modal({
//   open,
//   onClose,
//   labelledBy,
//   children,
//   maxWidth = "max-w-xl",
// }: {
//   open: boolean;
//   onClose: () => void;
//   labelledBy: string;
//   children: React.ReactNode;
//   maxWidth?: string;
// }) {
//   const panelRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (!open) return;

//     const handleKey = (event: KeyboardEvent) => {
//       if (event.key === "Escape") onClose();
//     };
//     document.addEventListener("keydown", handleKey);

//     const previousOverflow = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     panelRef.current?.focus();

//     return () => {
//       document.removeEventListener("keydown", handleKey);
//       document.body.style.overflow = previousOverflow;
//     };
//   }, [open, onClose]);

//   if (!open) return null;

//   return createPortal(
//     <div
//       className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
//       onMouseDown={onClose}
//       role="presentation"
//     >
//       <div
//         ref={panelRef}
//         role="dialog"
//         aria-modal="true"
//         aria-labelledby={labelledBy}
//         tabIndex={-1}
//         onMouseDown={(event) => event.stopPropagation()}
//         className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl outline-none`}
//       >
//         {children}
//       </div>
//     </div>,
//     document.body,
//   );
// }

// function ErrorNote({ message }: { message: string }) {
//   if (!message) return null;
//   return (
//     <p
//       role="alert"
//       className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
//     >
//       <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
//       <span>{message}</span>
//     </p>
//   );
// }

// function ListHeader({ cols }: { cols: string[] }) {
//   return (
//     <div
//       className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
//       style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
//     >
//       {cols.map((col) => (
//         <span key={col}>{col}</span>
//       ))}
//     </div>
//   );
// }

// function Field({
//   label,
//   value,
//   onChange,
//   type = "text",
//   required,
//   min,
//   max,
//   step,
//   disabled,
// }: {
//   label: string;
//   value: string;
//   onChange: (value: string) => void;
//   type?: string;
//   required?: boolean;
//   min?: string;
//   max?: number;
//   step?: string;
//   disabled?: boolean;
// }) {
//   return (
//     <label className="block text-xs text-slate-400">
//       {label}
//       <input
//         required={required}
//         type={type}
//         min={min}
//         max={max}
//         step={step}
//         disabled={disabled}
//         value={value}
//         onChange={(event) => onChange(event.target.value)}
//         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400 disabled:opacity-60"
//       />
//     </label>
//   );
// }

// function Select({
//   label,
//   value,
//   onChange,
//   options,
// }: {
//   label: string;
//   value: string;
//   onChange: (value: string) => void;
//   options: string[][];
// }) {
//   return (
//     <label className="block text-xs text-slate-400">
//       {label}
//       <select
//         required
//         value={value}
//         onChange={(event) => onChange(event.target.value)}
//         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
//       >
//         <option value="">Choose…</option>
//         {options.map(([id, title]) => (
//           <option key={id} value={id}>
//             {title}
//           </option>
//         ))}
//       </select>
//       {options.length === 0 && (
//         <span className="mt-1 block text-amber-300">
//           Create the required record first.
//         </span>
//       )}
//     </label>
//   );
// }

// function Reports({
//   orders,
//   expenses,
//   purchaseOrders,
// }: {
//   orders: ApiOrder[];
//   expenses: any[];
//   purchaseOrders: any[];
// }) {
//   const revenue = orders
//     .filter(
//       (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
//     )
//     .reduce((sum, order) => sum + order.grandTotal, 0);

//   const operatingExpenses = expenses.reduce(
//     (sum, expense) => sum + Number(expense.amount || 0),
//     0,
//   );

//   const receivedOrders = purchaseOrders.filter(
//     (po) => po.status === "RECEIVED",
//   );
//   const procurement = receivedOrders.reduce(
//     (sum, po) => sum + Number(po.grandTotal || 0),
//     0,
//   );

//   const cards = [
//     [
//       "Recent completed sales",
//       amount(revenue),
//       `${orders.length} recent order records loaded`,
//     ],
//     [
//       "Recorded expenses",
//       amount(operatingExpenses),
//       `${expenses.length} expense records loaded`,
//     ],
//     [
//       "Received purchasing",
//       amount(procurement),
//       `${receivedOrders.length} purchase orders received`,
//     ],
//   ];

//   return (
//     <>
//       <section className="grid gap-4 md:grid-cols-3">
//         {cards.map(([title, total, note]) => (
//           <article
//             key={title}
//             className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
//           >
//             <p className="text-xs text-slate-400">{title}</p>
//             <p className="mt-3 text-2xl font-black text-white">{total}</p>
//             <p className="mt-2 text-xs text-slate-500">{note}</p>
//           </article>
//         ))}
//       </section>
//       <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
//         Operational summary only. This is not a profit-and-loss statement:
//         purchase values, unpaid liabilities, taxes, refunds and accounting
//         journals are not fully reconciled here. Sales are limited to recent
//         orders returned by the API.
//       </p>
//     </>
//   );
// }

// // import { FormEvent, useMemo, useState } from "react";
// // import {
// //   ArrowLeftRight,
// //   BadgeDollarSign,
// //   ClipboardCheck,
// //   FileBarChart2,
// //   Plus,
// //   Receipt,
// //   Truck,
// //   Undo2,
// // } from "lucide-react";
// // import { ApiOrder } from "../store/apiSlice";
// // import { Product } from "../types";
// // import { WorkflowGuide } from "./WorkflowGuide";

// // type Module =
// //   | "purchasing"
// //   | "expenses"
// //   | "supplierPayments"
// //   | "transfers"
// //   | "returns"
// //   | "reports";
// // type Fields = Record<string, string>;
// // interface Props {
// //   selectedStoreId?: string;
// //   stores: { id: string; name: string }[];
// //   products: Product[];
// //   suppliers: any[];
// //   orders: ApiOrder[];
// //   purchaseOrders: any[];
// //   expenses: any[];
// //   expenseCategories: any[];
// //   supplierPayments: any[];
// //   transfers: any[];
// //   returns: any[];
// //   loading: boolean;
// //   onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>;
// //   onUpdatePurchaseOrder: (
// //     id: string,
// //     patch: Record<string, unknown>,
// //   ) => Promise<unknown>;
// //   onReceivePurchaseOrder: (
// //     id: string,
// //     storeId: string,
// //     lots?: {
// //       purchaseOrderItemId: string;
// //       number: string;
// //       expiryDate?: string;
// //     }[],
// //   ) => Promise<unknown>;
// //   onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>;
// //   onCreateExpenseCategory: (name: string) => Promise<unknown>;
// //   onCreateSupplierPayment: (
// //     payload: Record<string, unknown>,
// //   ) => Promise<unknown>;
// //   onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>;
// //   onCompleteTransfer: (id: string) => Promise<unknown>;
// //   onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
// // }

// // const modules: { id: Module; label: string; icon: typeof Truck }[] = [
// //   { id: "purchasing", label: "Purchasing", icon: Truck },
// //   { id: "expenses", label: "Expenses", icon: Receipt },
// //   { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
// //   { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
// //   { id: "returns", label: "Sales returns", icon: Undo2 },
// //   { id: "reports", label: "Reports", icon: FileBarChart2 },
// // ];
// // const initial: Fields = {
// //   supplierId: "",
// //   productId: "",
// //   variantId: "",
// //   quantity: "1",
// //   unitCost: "",
// //   expectedDate: "",
// //   notes: "",
// //   categoryId: "",
// //   amount: "",
// //   description: "",
// //   expenseDate: new Date().toISOString().slice(0, 10),
// //   paymentMethod: "CASH",
// //   referenceNumber: "",
// //   toStoreId: "",
// //   orderId: "",
// //   orderItemId: "",
// //   reason: "",
// //   refundMethod: "CASH",
// // };
// // const errorMessage = (error: unknown) => {
// //   const value = error as { data?: { message?: string }; message?: string };
// //   return (
// //     value.data?.message ||
// //     value.message ||
// //     "The server could not save this operation."
// //   );
// // };
// // const dateText = (value?: string) =>
// //   value ? new Date(value).toLocaleString() : "—";
// // const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

// // export function ERPView(props: Props) {
// //   const [module, setModule] = useState<Module>("purchasing");
// //   const [dialog, setDialog] = useState(false);
// //   const [categoryDialog, setCategoryDialog] = useState(false);
// //   const [categoryName, setCategoryName] = useState("");
// //   const [fields, setFields] = useState<Fields>({ ...initial });
// //   const [busy, setBusy] = useState(false);
// //   const [error, setError] = useState("");
// //   const [notice, setNotice] = useState("");
// //   const [search, setSearch] = useState("");
// //   const [receiveTarget, setReceiveTarget] = useState<any>(null);
// //   const [receiveStoreId, setReceiveStoreId] = useState("");
// //   const [confirmTransferTarget, setConfirmTransferTarget] = useState<any>(null);
// //   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
// //   const [receiveLots, setReceiveLots] = useState<
// //     Record<string, { number: string; expiryDate: string }>
// //   >({});
// //   const selectedProduct = props.products.find(
// //     (product) => product.id === fields.productId,
// //   );
// //   const selectedOrder = props.orders.find(
// //     (order) => order.id === fields.orderId,
// //   );
// //   const orderItem = selectedOrder?.items?.find(
// //     (item) => item.id === fields.orderItemId,
// //   );
// //   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
// //   const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
// //   const poTotal = quantity * Number(fields.unitCost || 0);

// //   const records = useMemo(() => {
// //     const values = (
// //       {
// //         purchasing: props.purchaseOrders,
// //         expenses: props.expenses,
// //         supplierPayments: props.supplierPayments,
// //         transfers: props.transfers,
// //         returns: props.returns,
// //         reports: [],
// //       } as Record<Module, any[]>
// //     )[module];
// //     const normalized = search.trim().toLowerCase();
// //     if (!normalized) return values;
// //     return values.filter((item) =>
// //       JSON.stringify([
// //         item.poNumber,
// //         item.transferNumber,
// //         item.returnNumber,
// //         item.supplier?.name,
// //         item.description,
// //         item.notes,
// //         item.category?.name,
// //         item.store?.name,
// //         item.fromStore?.name,
// //         item.toStore?.name,
// //       ])
// //         .toLowerCase()
// //         .includes(normalized),
// //     );
// //   }, [
// //     module,
// //     props.purchaseOrders,
// //     props.expenses,
// //     props.supplierPayments,
// //     props.transfers,
// //     props.returns,
// //     search,
// //   ]);

// //   const openDialog = () => {
// //     setFields({
// //       ...initial,
// //       supplierId: props.suppliers[0]?.id || "",
// //       productId: props.products[0]?.id || "",
// //       categoryId: props.expenseCategories[0]?.id || "",
// //       toStoreId:
// //         props.stores.find((store) => store.id !== props.selectedStoreId)?.id ||
// //         "",
// //       orderId:
// //         props.orders.find((order) => order.status === "COMPLETED")?.id || "",
// //     });
// //     setError("");
// //     setNotice("");
// //     setDialog(true);
// //   };
// //   const submit = async (event: FormEvent) => {
// //     event.preventDefault();
// //     setBusy(true);
// //     setError("");
// //     try {
// //       if (module === "purchasing") {
// //         if (
// //           !fields.supplierId ||
// //           !fields.productId ||
// //           quantity < 1 ||
// //           Number(fields.unitCost) < 0
// //         )
// //           throw new Error(
// //             "Select a supplier and product, quantity, and unit cost.",
// //           );
// //         const product = props.products.find(
// //           (entry) => entry.id === fields.productId,
// //         )!;
// //         await props.onCreatePurchaseOrder({
// //           supplierId: fields.supplierId,
// //           status: "DRAFT",
// //           currencyCode: "MMK",
// //           expectedDate: fields.expectedDate || undefined,
// //           subTotal: poTotal,
// //           taxAmount: 0,
// //           grandTotal: poTotal,
// //           notes: fields.notes || undefined,
// //           items: [
// //             {
// //               productId: product.id,
// //               variantId: fields.variantId || product.variants?.[0]?.id,
// //               quantity,
// //               unitCost: Number(fields.unitCost),
// //               totalCost: poTotal,
// //             },
// //           ],
// //         });
// //       } else if (module === "expenses") {
// //         if (
// //           !props.selectedStoreId ||
// //           !fields.categoryId ||
// //           Number(fields.amount) <= 0
// //         )
// //           throw new Error(
// //             "Select a store and expense category, and enter an amount.",
// //           );
// //         await props.onCreateExpense({
// //           storeId: props.selectedStoreId,
// //           categoryId: fields.categoryId,
// //           amount: Number(fields.amount),
// //           currencyCode: "MMK",
// //           description: fields.description || undefined,
// //           expenseDate: fields.expenseDate || undefined,
// //         });
// //       } else if (module === "supplierPayments") {
// //         if (!fields.supplierId || Number(fields.amount) <= 0)
// //           throw new Error("Select a supplier and enter a payment amount.");
// //         await props.onCreateSupplierPayment({
// //           supplierId: fields.supplierId,
// //           amount: Number(fields.amount),
// //           currencyCode: "MMK",
// //           paymentMethod: fields.paymentMethod,
// //           referenceNumber: fields.referenceNumber || undefined,
// //           note: fields.notes || undefined,
// //         });
// //       } else if (module === "transfers") {
// //         if (
// //           !props.selectedStoreId ||
// //           !fields.toStoreId ||
// //           !fields.productId ||
// //           quantity < 1
// //         )
// //           throw new Error(
// //             "Choose source and destination stores, product, and quantity.",
// //           );
// //         const product = props.products.find(
// //           (entry) => entry.id === fields.productId,
// //         )!;
// //         await props.onCreateTransfer({
// //           fromStoreId: props.selectedStoreId,
// //           toStoreId: fields.toStoreId,
// //           notes: fields.notes || undefined,
// //           items: [
// //             {
// //               productId: product.id,
// //               variantId: fields.variantId || product.variants?.[0]?.id,
// //               quantity,
// //             },
// //           ],
// //         });
// //       } else if (module === "returns") {
// //         if (
// //           !selectedOrder ||
// //           !orderItem ||
// //           quantity < 1 ||
// //           !fields.reason.trim()
// //         )
// //           throw new Error("Choose an order item, quantity and return reason.");
// //         if (
// //           quantity >
// //           orderItem.quantity - Number(orderItem.returnedQuantity || 0)
// //         )
// //           throw new Error(
// //             "Return quantity exceeds the remaining quantity on this order item.",
// //           );
// //         await props.onCreateReturn({
// //           orderId: selectedOrder.id,
// //           totalAmount: itemTotal,
// //           refundMethod: fields.refundMethod,
// //           refundStatus: "COMPLETED",
// //           reason: fields.reason,
// //           items: [
// //             {
// //               orderItemId: orderItem.id,
// //               quantity,
// //               refundAmount: itemTotal,
// //               reason: fields.reason,
// //             },
// //           ],
// //         });
// //       }
// //       setDialog(false);
// //       setNotice("Operation saved successfully.");
// //     } catch (cause) {
// //       setError(errorMessage(cause));
// //     } finally {
// //       setBusy(false);
// //     }
// //   };

// //   const receive = async (po: any) => {
// //     const store = props.selectedStoreId || props.stores[0]?.id || "";
// //     setReceiveStoreId(store);
// //     setError("");
// //     setNotice("");
// //     setTrackReceivedLots(false);
// //     setReceiveLots(
// //       Object.fromEntries(
// //         (po.items ?? []).map((item: any) => [
// //           item.id,
// //           { number: "", expiryDate: "" },
// //         ]),
// //       ),
// //     );
// //     setReceiveTarget(po);
// //   };
// //   const confirmReceive = async () => {
// //     const targetStore =
// //       receiveStoreId || props.selectedStoreId || props.stores[0]?.id;
// //     if (!receiveTarget || !targetStore) {
// //       setError("Please select a store to receive the stock into.");
// //       return;
// //     }
// //     const lots = trackReceivedLots
// //       ? (receiveTarget.items ?? []).map((item: any) => ({
// //           purchaseOrderItemId: item.id,
// //           ...receiveLots[item.id],
// //         }))
// //       : undefined;
// //     if (lots?.some((lot: any) => !lot.number.trim())) {
// //       setError(
// //         "Enter the batch or lot number for every received product, or turn lot tracking off for this delivery.",
// //       );
// //       return;
// //     }
// //     setBusy(true);
// //     setError("");
// //     try {
// //       await props.onReceivePurchaseOrder(
// //         receiveTarget.id,
// //         targetStore,
// //         lots?.map((lot: any) => ({
// //           ...lot,
// //           number: lot.number.trim(),
// //           expiryDate: lot.expiryDate || undefined,
// //         })),
// //       );
// //       setNotice(
// //         `${receiveTarget.poNumber} received. Inventory has been updated.`,
// //       );
// //       setReceiveTarget(null);
// //     } catch (cause) {
// //       setError(errorMessage(cause));
// //     } finally {
// //       setBusy(false);
// //     }
// //   };
// //   const markOrdered = async (po: any) => {
// //     try {
// //       await props.onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
// //       setNotice(`${po.poNumber} marked as ordered.`);
// //     } catch (cause) {
// //       setError(errorMessage(cause));
// //     }
// //   };
// //   const completeTransfer = (transfer: any) => {
// //     setError("");
// //     setNotice("");
// //     setConfirmTransferTarget(transfer);
// //   };

// //   const executeCompleteTransfer = async () => {
// //     if (!confirmTransferTarget) return;
// //     setBusy(true);
// //     setError("");
// //     setNotice("");
// //     try {
// //       await props.onCompleteTransfer(confirmTransferTarget.id);
// //       setNotice(
// //         `Branch transfer ${confirmTransferTarget.transferNumber} completed successfully. Inventories have been updated.`,
// //       );
// //       setConfirmTransferTarget(null);
// //     } catch (cause) {
// //       setError(errorMessage(cause));
// //     } finally {
// //       setBusy(false);
// //     }
// //   };
// //   const addExpenseCategory = async (event: FormEvent) => {
// //     event.preventDefault();
// //     setBusy(true);
// //     setError("");
// //     try {
// //       await props.onCreateExpenseCategory(categoryName.trim());
// //       setCategoryDialog(false);
// //       setCategoryName("");
// //       setNotice("Expense category created.");
// //     } catch (cause) {
// //       setError(errorMessage(cause));
// //     } finally {
// //       setBusy(false);
// //     }
// //   };

// //   return (
// //     <main className="flex-1 overflow-y-auto p-7">
// //       <header className="mb-6">
// //         <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
// //           Enterprise operations
// //         </p>
// //         <h1 className="mt-2 text-3xl font-black text-white">ERP</h1>
// //         <p className="mt-1 text-sm text-slate-400">
// //           Purchasing, costs, supplier settlement, branch stock and returns.
// //         </p>
// //       </header>
// //       <WorkflowGuide />
// //       <nav className="mb-5 flex flex-wrap gap-2">
// //         {modules.map(({ id, label, icon: Icon }) => (
// //           <button
// //             key={id}
// //             onClick={() => {
// //               setModule(id);
// //               setSearch("");
// //               setError("");
// //               setNotice("");
// //             }}
// //             className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${module === id ? "border-violet-400/50 bg-violet-400/10 text-violet-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"}`}
// //           >
// //             <Icon className="h-4 w-4" />
// //             {label}
// //           </button>
// //         ))}
// //       </nav>
// //       {error && !dialog && !categoryDialog && (
// //         <p
// //           role="alert"
// //           className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
// //         >
// //           {error}
// //         </p>
// //       )}
// //       {notice && !dialog && !categoryDialog && (
// //         <p
// //           role="status"
// //           className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
// //         >
// //           {notice}
// //         </p>
// //       )}
// //       {module === "reports" ? (
// //         <Reports
// //           orders={props.orders}
// //           expenses={props.expenses}
// //           purchaseOrders={props.purchaseOrders}
// //         />
// //       ) : (
// //         <>
// //           <section className="mb-4 flex flex-wrap items-center gap-3">
// //             <input
// //               value={search}
// //               onChange={(event) => setSearch(event.target.value)}
// //               placeholder="Search records"
// //               className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
// //             />
// //             {module === "expenses" && (
// //               <button
// //                 onClick={() => {
// //                   setCategoryName("");
// //                   setCategoryDialog(true);
// //                   setError("");
// //                 }}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
// //               >
// //                 Expense categories
// //               </button>
// //             )}
// //             <button
// //               onClick={openDialog}
// //               className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400"
// //             >
// //               <Plus className="h-4 w-4" />
// //               {module === "purchasing"
// //                 ? "New purchase order"
// //                 : module === "expenses"
// //                   ? "Record expense"
// //                   : module === "supplierPayments"
// //                     ? "Record payment"
// //                     : module === "transfers"
// //                       ? "Request transfer"
// //                       : "Process return"}
// //             </button>
// //           </section>
// //           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// //             {module === "purchasing" ? (
// //               <ListHeader
// //                 cols={[
// //                   "PO number",
// //                   "Supplier",
// //                   "Order date",
// //                   "Total",
// //                   "Status",
// //                   "Actions",
// //                 ]}
// //               />
// //             ) : module === "expenses" ? (
// //               <ListHeader
// //                 cols={["Category", "Description", "Date", "Store", "Amount"]}
// //               />
// //             ) : module === "supplierPayments" ? (
// //               <ListHeader
// //                 cols={["Supplier", "Paid at", "Method", "Reference", "Amount"]}
// //               />
// //             ) : module === "transfers" ? (
// //               <ListHeader
// //                 cols={[
// //                   "Transfer",
// //                   "From → To",
// //                   "Requested",
// //                   "Items",
// //                   "Status",
// //                   "Actions",
// //                 ]}
// //               />
// //             ) : (
// //               <ListHeader
// //                 cols={[
// //                   "Return",
// //                   "Order",
// //                   "Customer",
// //                   "Date",
// //                   "Refund",
// //                   "Status",
// //                 ]}
// //               />
// //             )}
// //             {props.loading ? (
// //               <p className="p-10 text-center text-sm text-slate-400">
// //                 Loading ERP records…
// //               </p>
// //             ) : records.length === 0 ? (
// //               <p className="p-10 text-center text-sm text-slate-400">
// //                 No records found.
// //               </p>
// //             ) : (
// //               records.map((record: any) => (
// //                 <div
// //                   key={record.id}
// //                   className={`grid ${module === "expenses" || module === "supplierPayments" ? "grid-cols-5" : "grid-cols-6"} items-center gap-4 border-b border-slate-800/70 px-5 py-4 last:border-0 text-xs`}
// //                 >
// //                   {module === "purchasing" ? (
// //                     <>
// //                       <span className="font-bold text-white">
// //                         {record.poNumber}
// //                       </span>
// //                       <span className="text-slate-300">
// //                         {record.supplier?.name || "—"}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {dateText(record.orderDate)}
// //                       </span>
// //                       <span className="font-semibold text-white">
// //                         {amount(record.grandTotal)}
// //                       </span>
// //                       <span className="text-amber-300">{record.status}</span>
// //                       <span className="flex gap-1">
// //                         {record.status === "DRAFT" && (
// //                           <button
// //                             onClick={() => markOrdered(record)}
// //                             className="rounded-lg bg-sky-500/15 px-2 py-1.5 font-bold text-sky-300"
// //                           >
// //                             Mark ordered
// //                           </button>
// //                         )}
// //                         {["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"].includes(
// //                           record.status,
// //                         ) && (
// //                           <button
// //                             onClick={() => receive(record)}
// //                             className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300"
// //                           >
// //                             <ClipboardCheck className="h-3.5 w-3.5" />
// //                             Receive
// //                           </button>
// //                         )}
// //                       </span>
// //                     </>
// //                   ) : module === "expenses" ? (
// //                     <>
// //                       <span className="font-semibold text-white">
// //                         {record.category?.name || "—"}
// //                       </span>
// //                       <span className="truncate text-slate-300">
// //                         {record.description || "—"}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {dateText(record.expenseDate)}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {record.store?.name || "—"}
// //                       </span>
// //                       <span className="text-right font-bold text-white">
// //                         {amount(record.amount)}
// //                       </span>
// //                     </>
// //                   ) : module === "supplierPayments" ? (
// //                     <>
// //                       <span className="font-semibold text-white">
// //                         {record.supplier?.name || "—"}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {dateText(record.paidAt)}
// //                       </span>
// //                       <span className="text-slate-300">
// //                         {record.paymentMethod}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {record.referenceNumber || "—"}
// //                       </span>
// //                       <span className="text-right font-bold text-white">
// //                         {amount(record.amount)}
// //                       </span>
// //                     </>
// //                   ) : module === "transfers" ? (
// //                     <>
// //                       <span className="font-bold text-white">
// //                         {record.transferNumber}
// //                       </span>
// //                       <span className="text-slate-300">
// //                         {record.fromStore?.name} → {record.toStore?.name}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {dateText(record.requestedAt)}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {record.items?.length || 0} lines
// //                       </span>
// //                       <span
// //                         className={
// //                           record.status === "RECEIVED"
// //                             ? "font-bold text-emerald-400"
// //                             : "font-bold text-amber-300"
// //                         }
// //                       >
// //                         {record.status === "RECEIVED"
// //                           ? "COMPLETED"
// //                           : record.status}
// //                       </span>
// //                       <span>
// //                         {["PENDING", "APPROVED", "IN_TRANSIT"].includes(
// //                           record.status,
// //                         ) ? (
// //                           <button
// //                             onClick={() => completeTransfer(record)}
// //                             disabled={busy}
// //                             className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
// //                           >
// //                             {busy ? "Completing…" : "Accept & Complete"}
// //                           </button>
// //                         ) : (
// //                           <span className="text-emerald-400/80 font-medium text-[11px]">
// //                             ✓ Received
// //                           </span>
// //                         )}
// //                       </span>
// //                     </>
// //                   ) : (
// //                     <>
// //                       <span className="font-bold text-white">
// //                         {record.returnNumber}
// //                       </span>
// //                       <span className="text-slate-300">
// //                         {record.order?.orderNumber ||
// //                           record.orderId?.slice(0, 8)}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {record.customer?.name || "Walk-in"}
// //                       </span>
// //                       <span className="text-slate-400">
// //                         {dateText(record.createdAt)}
// //                       </span>
// //                       <span className="font-bold text-white">
// //                         {amount(record.totalAmount)}
// //                       </span>
// //                       <span className="text-emerald-300">
// //                         {record.refundStatus}
// //                       </span>
// //                     </>
// //                   )}
// //                 </div>
// //               ))
// //             )}
// //           </section>
// //         </>
// //       )}

// //       {receiveTarget && (
// //         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
// //           <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
// //             <h2 className="text-xl font-bold text-white">
// //               Receive {receiveTarget.poNumber}
// //             </h2>
// //             <p className="mt-1 text-xs text-slate-400">
// //               Record delivered products into inventory. Select the warehouse or
// //               store receiving this delivery.
// //             </p>

// //             <div className="mt-4">
// //               <label className="block text-xs font-medium text-slate-300 mb-1.5">
// //                 Destination Store / Branch
// //               </label>
// //               <select
// //                 value={receiveStoreId}
// //                 onChange={(e) => setReceiveStoreId(e.target.value)}
// //                 className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
// //               >
// //                 {props.stores.map((s) => (
// //                   <option key={s.id} value={s.id}>
// //                     {s.name}
// //                   </option>
// //                 ))}
// //               </select>
// //             </div>

// //             <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
// //               <input
// //                 type="checkbox"
// //                 checked={trackReceivedLots}
// //                 onChange={(event) => setTrackReceivedLots(event.target.checked)}
// //                 className="accent-emerald-500"
// //               />
// //               Track batch / lot numbers and expiry
// //             </label>
// //             {trackReceivedLots && (
// //               <div className="mt-4 space-y-3">
// //                 {(receiveTarget.items ?? []).map((item: any) => (
// //                   <article
// //                     key={item.id}
// //                     className="rounded-xl border border-slate-800 p-3"
// //                   >
// //                     <p className="mb-3 text-sm font-semibold text-white">
// //                       {item.product?.name || "Product"}
// //                       {item.variant?.name ? ` · ${item.variant.name}` : ""}{" "}
// //                       <span className="text-slate-400">× {item.quantity}</span>
// //                     </p>
// //                     <div className="grid gap-3 sm:grid-cols-2">
// //                       <Field
// //                         label="Batch / lot number"
// //                         value={receiveLots[item.id]?.number ?? ""}
// //                         onChange={(value) =>
// //                           setReceiveLots((current) => ({
// //                             ...current,
// //                             [item.id]: { ...current[item.id], number: value },
// //                           }))
// //                         }
// //                         required
// //                       />
// //                       <Field
// //                         label="Expiry date (optional)"
// //                         type="date"
// //                         value={receiveLots[item.id]?.expiryDate ?? ""}
// //                         onChange={(value) =>
// //                           setReceiveLots((current) => ({
// //                             ...current,
// //                             [item.id]: {
// //                               ...current[item.id],
// //                               expiryDate: value,
// //                             },
// //                           }))
// //                         }
// //                       />
// //                     </div>
// //                   </article>
// //                 ))}
// //               </div>
// //             )}
// //             {error && (
// //               <p
// //                 role="alert"
// //                 className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
// //               >
// //                 {error}
// //               </p>
// //             )}
// //             <div className="mt-6 flex justify-end gap-3">
// //               <button
// //                 type="button"
// //                 onClick={() => setReceiveTarget(null)}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="button"
// //                 onClick={() => void confirmReceive()}
// //                 disabled={busy}
// //                 className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
// //               >
// //                 {busy ? "Receiving…" : "Receive stock"}
// //               </button>
// //             </div>
// //           </div>
// //       {confirmTransferTarget && (
// //         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 animate-in">
// //           <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
// //             <div className="flex items-center gap-3 text-emerald-400 mb-2">
// //               <ArrowLeftRight className="h-6 w-6" />
// //               <h2 className="text-xl font-bold text-white">
// //                 Accept Transfer {confirmTransferTarget.transferNumber}
// //               </h2>
// //             </div>
// //             <p className="text-xs text-slate-300">
// //               Confirm receiving and applying this stock transfer between branches.
// //             </p>

// //             <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
// //               <div className="flex justify-between py-1 border-b border-slate-900">
// //                 <span className="text-slate-400">Source (Deducting from):</span>
// //                 <span className="font-semibold text-rose-300">
// //                   {confirmTransferTarget.fromStore?.name || "Source Store"}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between py-1 border-b border-slate-900">
// //                 <span className="text-slate-400">Destination (Adding to):</span>
// //                 <span className="font-semibold text-emerald-300">
// //                   {confirmTransferTarget.toStore?.name || "Destination Store"}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between py-1 border-b border-slate-900">
// //                 <span className="text-slate-400">Requested:</span>
// //                 <span className="text-slate-200">
// //                   {dateText(confirmTransferTarget.requestedAt)}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between py-1">
// //                 <span className="text-slate-400">Total lines:</span>
// //                 <span className="text-slate-200 font-semibold">
// //                   {confirmTransferTarget.items?.length || 0} items
// //                 </span>
// //               </div>
// //             </div>

// //             {confirmTransferTarget.items?.length > 0 && (
// //               <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs space-y-1.5">
// //                 <p className="text-[11px] font-bold uppercase text-slate-400 mb-1">
// //                   Items to Transfer:
// //                 </p>
// //                 {confirmTransferTarget.items.map((it: any) => (
// //                   <div key={it.id} className="flex justify-between text-slate-300 py-0.5 border-b border-slate-900/60 last:border-0">
// //                     <span className="truncate pr-2">
// //                       {it.product?.name || "Product"}
// //                       {it.variant?.name ? ` (${it.variant.name})` : ""}
// //                     </span>
// //                     <span className="font-bold text-white shrink-0">
// //                       × {it.quantity}
// //                     </span>
// //                   </div>
// //                 ))}
// //               </div>
// //             )}

// //             {error && (
// //               <p
// //                 role="alert"
// //                 className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300"
// //               >
// //                 {error}
// //               </p>
// //             )}

// //             <div className="mt-6 flex justify-end gap-3">
// //               <button
// //                 type="button"
// //                 onClick={() => setConfirmTransferTarget(null)}
// //                 disabled={busy}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="button"
// //                 onClick={() => void executeCompleteTransfer()}
// //                 disabled={busy}
// //                 className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2"
// //               >
// //                 {busy ? "Processing…" : "Confirm & Receive Stock"}
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}

// //       {(dialog || categoryDialog) && (
// //         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
// //           <form
// //             onSubmit={categoryDialog ? addExpenseCategory : submit}
// //             className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
// //           >
// //             <h2 className="text-xl font-bold text-white">
// //               {categoryDialog
// //                 ? "Add expense category"
// //                 : module === "purchasing"
// //                   ? "New purchase order"
// //                   : module === "expenses"
// //                     ? "Record expense"
// //                     : module === "supplierPayments"
// //                       ? "Record supplier payment"
// //                       : module === "transfers"
// //                         ? "Request stock transfer"
// //                         : "Process sales return"}
// //             </h2>
// //             <p className="mb-5 mt-1 text-xs text-slate-400">
// //               This action is recorded on the server and may update inventory or
// //               balances.
// //             </p>
// //             {categoryDialog ? (
// //               <Field
// //                 label="Category name"
// //                 value={categoryName}
// //                 onChange={setCategoryName}
// //                 required
// //               />
// //             ) : module === "purchasing" ? (
// //               <div className="space-y-3">
// //                 <Select
// //                   label="Supplier"
// //                   value={fields.supplierId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, supplierId: value })
// //                   }
// //                   options={props.suppliers.map((item) => [
// //                     item.id,
// //                     `${item.name} (${item.code})`,
// //                   ])}
// //                 />
// //                 <Select
// //                   label="Product"
// //                   value={fields.productId}
// //                   onChange={(value) =>
// //                     setFields({
// //                       ...fields,
// //                       productId: value,
// //                       variantId:
// //                         props.products.find((product) => product.id === value)
// //                           ?.variants?.[0]?.id || "",
// //                     })
// //                   }
// //                   options={props.products.map((item) => [
// //                     item.id,
// //                     `${item.name} · ${item.sku}`,
// //                   ])}
// //                 />
// //                 <Select
// //                   label="Variant"
// //                   value={fields.variantId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, variantId: value })
// //                   }
// //                   options={(selectedProduct?.variants || []).map((variant) => [
// //                     variant.id,
// //                     variant.name,
// //                   ])}
// //                 />
// //                 <div className="grid grid-cols-2 gap-3">
// //                   <Field
// //                     label="Quantity"
// //                     type="number"
// //                     min="1"
// //                     value={fields.quantity}
// //                     onChange={(value) =>
// //                       setFields({ ...fields, quantity: value })
// //                     }
// //                     required
// //                   />
// //                   <Field
// //                     label="Unit cost"
// //                     type="number"
// //                     min="0"
// //                     step="0.01"
// //                     value={fields.unitCost}
// //                     onChange={(value) =>
// //                       setFields({ ...fields, unitCost: value })
// //                     }
// //                     required
// //                   />
// //                 </div>
// //                 <p className="text-right text-sm font-bold text-white">
// //                   Subtotal {amount(poTotal)}
// //                 </p>
// //                 <Field
// //                   label="Expected date"
// //                   type="date"
// //                   value={fields.expectedDate}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, expectedDate: value })
// //                   }
// //                 />
// //                 <Field
// //                   label="Notes"
// //                   value={fields.notes}
// //                   onChange={(value) => setFields({ ...fields, notes: value })}
// //                 />
// //               </div>
// //             ) : module === "expenses" ? (
// //               <div className="space-y-3">
// //                 <Select
// //                   label="Expense category"
// //                   value={fields.categoryId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, categoryId: value })
// //                   }
// //                   options={props.expenseCategories.map((item) => [
// //                     item.id,
// //                     item.name,
// //                   ])}
// //                 />
// //                 <Field
// //                   label="Amount"
// //                   type="number"
// //                   min="0.01"
// //                   step="0.01"
// //                   value={fields.amount}
// //                   onChange={(value) => setFields({ ...fields, amount: value })}
// //                   required
// //                 />
// //                 <Field
// //                   label="Date"
// //                   type="date"
// //                   value={fields.expenseDate}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, expenseDate: value })
// //                   }
// //                   required
// //                 />
// //                 <Field
// //                   label="Description"
// //                   value={fields.description}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, description: value })
// //                   }
// //                 />
// //               </div>
// //             ) : module === "supplierPayments" ? (
// //               <div className="space-y-3">
// //                 <Select
// //                   label="Supplier"
// //                   value={fields.supplierId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, supplierId: value })
// //                   }
// //                   options={props.suppliers.map((item) => [item.id, item.name])}
// //                 />
// //                 <Field
// //                   label="Amount"
// //                   type="number"
// //                   min="0.01"
// //                   step="0.01"
// //                   value={fields.amount}
// //                   onChange={(value) => setFields({ ...fields, amount: value })}
// //                   required
// //                 />
// //                 <Select
// //                   label="Payment method"
// //                   value={fields.paymentMethod}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, paymentMethod: value })
// //                   }
// //                   options={[
// //                     "CASH",
// //                     "KBZ_PAY",
// //                     "CB_PAY",
// //                     "WAVE_PAY",
// //                     "CARD",
// //                     "BANK_TRANSFER",
// //                   ].map((value) => [value, value.split("_").join(" ")])}
// //                 />
// //                 <Field
// //                   label="Reference number"
// //                   value={fields.referenceNumber}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, referenceNumber: value })
// //                   }
// //                 />
// //                 <Field
// //                   label="Note"
// //                   value={fields.notes}
// //                   onChange={(value) => setFields({ ...fields, notes: value })}
// //                 />
// //               </div>
// //             ) : module === "transfers" ? (
// //               <div className="space-y-3">
// //                 <p className="text-xs text-slate-400">
// //                   Source store:{" "}
// //                   <strong className="text-white">
// //                     {props.stores.find(
// //                       (item) => item.id === props.selectedStoreId,
// //                     )?.name || "Select a store"}
// //                   </strong>
// //                 </p>
// //                 <Select
// //                   label="Destination"
// //                   value={fields.toStoreId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, toStoreId: value })
// //                   }
// //                   options={props.stores
// //                     .filter((item) => item.id !== props.selectedStoreId)
// //                     .map((item) => [item.id, item.name])}
// //                 />
// //                 <Select
// //                   label="Product"
// //                   value={fields.productId}
// //                   onChange={(value) =>
// //                     setFields({
// //                       ...fields,
// //                       productId: value,
// //                       variantId:
// //                         props.products.find((product) => product.id === value)
// //                           ?.variants?.[0]?.id || "",
// //                     })
// //                   }
// //                   options={props.products.map((item) => [item.id, item.name])}
// //                 />
// //                 <Select
// //                   label="Variant"
// //                   value={fields.variantId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, variantId: value })
// //                   }
// //                   options={(selectedProduct?.variants || []).map((variant) => [
// //                     variant.id,
// //                     variant.name,
// //                   ])}
// //                 />
// //                 <Field
// //                   label="Quantity"
// //                   type="number"
// //                   min="1"
// //                   value={fields.quantity}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, quantity: value })
// //                   }
// //                   required
// //                 />
// //                 <Field
// //                   label="Notes"
// //                   value={fields.notes}
// //                   onChange={(value) => setFields({ ...fields, notes: value })}
// //                 />
// //               </div>
// //             ) : (
// //               <div className="space-y-3">
// //                 <Select
// //                   label="Completed order"
// //                   value={fields.orderId}
// //                   onChange={(value) => {
// //                     const order = props.orders.find(
// //                       (entry) => entry.id === value,
// //                     );
// //                     setFields({
// //                       ...fields,
// //                       orderId: value,
// //                       orderItemId: order?.items?.[0]?.id || "",
// //                     });
// //                   }}
// //                   options={props.orders
// //                     .filter(
// //                       (order) =>
// //                         order.status === "COMPLETED" ||
// //                         order.paymentStatus === "PAID",
// //                     )
// //                     .map((order) => [
// //                       order.id,
// //                       `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
// //                     ])}
// //                 />
// //                 <Select
// //                   label="Returned item"
// //                   value={fields.orderItemId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, orderItemId: value })
// //                   }
// //                   options={(selectedOrder?.items || []).map((item) => [
// //                     item.id,
// //                     `${item.product?.name || "Product"} · qty ${item.quantity}`,
// //                   ])}
// //                 />
// //                 <Field
// //                   label="Quantity"
// //                   type="number"
// //                   min="1"
// //                   max={orderItem?.quantity || 1}
// //                   value={fields.quantity}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, quantity: value })
// //                   }
// //                   required
// //                 />
// //                 <p className="text-right text-sm font-bold text-white">
// //                   Refund total {amount(itemTotal)}
// //                 </p>
// //                 <Select
// //                   label="Refund method"
// //                   value={fields.refundMethod}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, refundMethod: value })
// //                   }
// //                   options={[
// //                     "CASH",
// //                     "KBZ_PAY",
// //                     "CB_PAY",
// //                     "WAVE_PAY",
// //                     "CARD",
// //                     "BANK_TRANSFER",
// //                   ].map((value) => [value, value.split("_").join(" ")])}
// //                 />
// //                 <Field
// //                   label="Reason"
// //                   value={fields.reason}
// //                   onChange={(value) => setFields({ ...fields, reason: value })}
// //                   required
// //                 />
// //               </div>
// //             )}
// //             {error && (
// //               <p
// //                 role="alert"
// //                 className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
// //               >
// //                 {error}
// //               </p>
// //             )}
// //             <div className="mt-6 flex justify-end gap-3">
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setDialog(false);
// //                   setCategoryDialog(false);
// //                 }}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 disabled={busy}
// //                 className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
// //               >
// //                 {busy ? "Saving…" : "Save"}
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       )}
// //     </main>
// //   );
// // }

// // function ListHeader({ cols }: { cols: string[] }) {
// //   return (
// //     <div
// //       className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
// //       style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
// //     >
// //       {cols.map((col) => (
// //         <span key={col}>{col}</span>
// //       ))}
// //     </div>
// //   );
// // }
// // function Field({
// //   label,
// //   value,
// //   onChange,
// //   type = "text",
// //   required,
// //   min,
// //   max,
// //   step,
// // }: {
// //   label: string;
// //   value: string;
// //   onChange: (value: string) => void;
// //   type?: string;
// //   required?: boolean;
// //   min?: string;
// //   max?: number;
// //   step?: string;
// // }) {
// //   return (
// //     <label className="block text-xs text-slate-400">
// //       {label}
// //       <input
// //         required={required}
// //         type={type}
// //         min={min}
// //         max={max}
// //         step={step}
// //         value={value}
// //         onChange={(event) => onChange(event.target.value)}
// //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
// //       />
// //     </label>
// //   );
// // }
// // function Select({
// //   label,
// //   value,
// //   onChange,
// //   options,
// // }: {
// //   label: string;
// //   value: string;
// //   onChange: (value: string) => void;
// //   options: string[][];
// // }) {
// //   return (
// //     <label className="block text-xs text-slate-400">
// //       {label}
// //       <select
// //         required
// //         value={value}
// //         onChange={(event) => onChange(event.target.value)}
// //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
// //       >
// //         <option value="">Choose…</option>
// //         {options.map(([id, title]) => (
// //           <option key={id} value={id}>
// //             {title}
// //           </option>
// //         ))}
// //       </select>
// //       {options.length === 0 && (
// //         <span className="mt-1 block text-amber-300">
// //           Create the required record first.
// //         </span>
// //       )}
// //     </label>
// //   );
// // }
// // function Reports({
// //   orders,
// //   expenses,
// //   purchaseOrders,
// // }: {
// //   orders: ApiOrder[];
// //   expenses: any[];
// //   purchaseOrders: any[];
// // }) {
// //   const revenue = orders
// //     .filter(
// //       (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
// //     )
// //     .reduce((sum, order) => sum + order.grandTotal, 0);
// //   const operatingExpenses = expenses.reduce(
// //     (sum, expense) => sum + Number(expense.amount || 0),
// //     0,
// //   );
// //   const procurement = purchaseOrders
// //     .filter((po) => po.status === "RECEIVED")
// //     .reduce((sum, po) => sum + Number(po.grandTotal || 0), 0);
// //   const cards = [
// //     [
// //       "Recent completed sales",
// //       amount(revenue),
// //       `${orders.length} recent order records loaded`,
// //     ],
// //     [
// //       "Recorded expenses",
// //       amount(operatingExpenses),
// //       `${expenses.length} expense records loaded`,
// //     ],
// //     [
// //       "Received purchasing",
// //       amount(procurement),
// //       `${purchaseOrders.filter((po) => po.status === "RECEIVED").length} purchase orders received`,
// //     ],
// //   ];
// //   return (
// //     <>
// //       <section className="grid gap-4 md:grid-cols-3">
// //         {cards.map(([title, total, note]) => (
// //           <article
// //             key={title}
// //             className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
// //           >
// //             <p className="text-xs text-slate-400">{title}</p>
// //             <p className="mt-3 text-2xl font-black text-white">{total}</p>
// //             <p className="mt-2 text-xs text-slate-500">{note}</p>
// //           </article>
// //         ))}
// //       </section>
// //       <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
// //         Operational summary only. This is not a profit-and-loss statement:
// //         purchase values, unpaid liabilities, taxes, refunds and accounting
// //         journals are not fully reconciled here. Sales are limited to recent
// //         orders returned by the API.
// //       </p>
// //     </>
// //   );
// // }
