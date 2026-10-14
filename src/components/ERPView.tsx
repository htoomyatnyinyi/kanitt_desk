// ERPView.tsx
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
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart2,
  Loader2,
  Package,
  Plus,
  Receipt,
  Truck,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { ApiOrder } from "../store/apiSlice";
import { Product } from "../types";
import { WorkflowGuide } from "./WorkflowGuide";
import { ChoiceCards } from "./ChoiceCards";

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

  /* NEW — optional inline creators for supplier / branch */
  onCreateSupplier?: (payload: {
    name: string;
    code?: string;
  }) => Promise<{ id: string; name: string } | void>;
  onCreateStore?: (payload: {
    name: string;
  }) => Promise<{ id: string; name: string } | void>;
}

interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

interface TransferLine {
  productId: string;
  variantId: string;
  quantity: number;
}

interface PurchaseLine {
  productId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
}

interface ReturnLine {
  orderItemId: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  productName: string;
  variantName?: string;
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
const RECEIVABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

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
  status === "RECEIVED"
    ? "Received"
    : status === "IN_TRANSIT"
      ? "On the way"
      : status === "PENDING"
        ? "Awaiting dispatch"
        : status === "APPROVED"
          ? "Ready to send"
          : status;

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
    onCreateSupplier,
    onCreateStore,
  } = props;

  /* ---------------------------- state ---------------------------- */

  const [module, setModule] = useState<Module>("purchasing");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [dialog, setDialog] = useState(false);
  const [fields, setFields] = useState<Fields>(initialFields);
  const [transferItems, setTransferItems] = useState<TransferLine[]>([]);
  const [poItems, setPoItems] = useState<PurchaseLine[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnLine[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
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

  const selectedOrder = orders.find((order) => order.id === fields.orderId);
  const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
  const isReturnable = (order: ApiOrder) =>
    order.status === "COMPLETED" || order.paymentStatus === "PAID";

  const transferTotalUnits = transferItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const poSubtotal = poItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );
  const poTotalUnits = poItems.reduce((sum, item) => sum + item.quantity, 0);
  const returnRefundTotal = returnItems.reduce(
    (sum, item) => sum + item.refundAmount,
    0,
  );

  const filteredSourceProducts = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      if (
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q)
      )
        return true;
      return getVariants(product).some(
        (variant) =>
          (variant.name ?? "").toLowerCase().includes(q) ||
          (variant.sku ?? "").toLowerCase().includes(q),
      );
    });
  }, [products, sourceSearch]);

  const returnableOrders = useMemo(
    () => orders.filter(isReturnable).slice(0, 50),
    [orders],
  );

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
        ...(item.items ?? []).flatMap((line: any) => [
          line.product?.name,
          line.product?.sku,
          line.variant?.name,
          line.variant?.sku,
        ]),
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
    setTransferItems([]);
    setPoItems([]);
    setReturnItems([]);
    setSourceSearch("");
  };

  const openDialog = () => {
    const firstOrder = orders.find(isReturnable);
    const firstProduct = products[0];
    setFields({
      ...initialFields(),
      storeId: selectedStoreId || stores[0]?.id || "",
      supplierId: suppliers[0]?.id || "",
      productId:
        module === "transfers" ||
        module === "purchasing" ||
        module === "returns"
          ? ""
          : firstProduct?.id || "",
      variantId:
        module === "transfers" || module === "purchasing"
          ? ""
          : getVariants(firstProduct)[0]?.id || "",
      categoryId: expenseCategories[0]?.id || "",
      toStoreId:
        transferDestinationStores.find((store) => store.id !== selectedStoreId)
          ?.id || "",
      orderId: firstOrder?.id || "",
      orderItemId: firstOrder?.items?.[0]?.id || "",
    });
    resetMessages();
    setTransferItems([]);
    setPoItems([]);
    setReturnItems([]);
    setSourceSearch("");
    setDialog(true);
  };

  /* -------- Transfer helpers -------- */
  const addTransferItem = (
    productId: string,
    variantId: string,
    qty: number = 1,
  ) => {
    if (!fields.toStoreId) {
      setFormError("Choose a destination store first.");
      return;
    }
    const product = products.find((entry) => entry.id === productId);
    const variant = getVariants(product).find(
      (entry) => entry.id === variantId,
    );
    if (!product || !variant) return;

    const available = Number(variant.availableStock ?? variant.stock ?? 0);
    const existingQuantity =
      transferItems.find(
        (item) =>
          item.productId === product.id && item.variantId === variant.id,
      )?.quantity ?? 0;

    if (existingQuantity + qty > available) {
      setFormError(
        `Only ${available} unit(s) of ${product.name} · ${variant.name} are at the source store.`,
      );
      return;
    }

    setTransferItems((current) => {
      const index = current.findIndex(
        (item) =>
          item.productId === product.id && item.variantId === variant.id,
      );
      if (index < 0)
        return [
          ...current,
          { productId: product.id, variantId: variant.id, quantity: qty },
        ];
      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: item.quantity + qty } : item,
      );
    });
    setFormError("");
  };

  const removeTransferItem = (productId: string, variantId: string) => {
    setTransferItems((current) =>
      current.filter(
        (item) => item.productId !== productId || item.variantId !== variantId,
      ),
    );
  };

  const updateTransferItemQuantity = (
    productId: string,
    variantId: string,
    qty: number,
  ) => {
    const next = Math.floor(qty);
    if (!Number.isFinite(next) || next < 1) return;
    const product = products.find((entry) => entry.id === productId);
    const variant = getVariants(product).find(
      (entry) => entry.id === variantId,
    );
    const available = Number(variant?.availableStock ?? variant?.stock ?? 0);
    if (next > available) {
      setFormError(`Only ${available} unit(s) available.`);
      return;
    }
    setTransferItems((current) =>
      current.map((item) =>
        item.productId === productId && item.variantId === variantId
          ? { ...item, quantity: next }
          : item,
      ),
    );
  };

  /* -------- Purchase Order helpers -------- */
  const addPoItem = (
    productId: string,
    variantId: string,
    qty: number,
    unitCost: number,
  ) => {
    const product = products.find((entry) => entry.id === productId);
    const variant = getVariants(product).find(
      (entry) => entry.id === variantId,
    );
    if (!product || !variant) return;
    if (!Number.isFinite(qty) || qty < 1) {
      setFormError("Quantity must be at least 1.");
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setFormError("Unit cost must be 0 or greater.");
      return;
    }

    setPoItems((current) => {
      const index = current.findIndex(
        (item) =>
          item.productId === product.id && item.variantId === variant.id,
      );
      if (index < 0)
        return [
          ...current,
          {
            productId: product.id,
            variantId: variant.id,
            quantity: qty,
            unitCost,
          },
        ];
      return current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantity: item.quantity + qty,
              unitCost,
            }
          : item,
      );
    });
    setFormError("");
    setFields((current) => ({
      ...current,
      productId: "",
      variantId: "",
      quantity: "1",
      unitCost: "",
    }));
  };

  const removePoItem = (productId: string, variantId: string) => {
    setPoItems((current) =>
      current.filter(
        (item) => item.productId !== productId || item.variantId !== variantId,
      ),
    );
  };

  const updatePoItemQty = (
    productId: string,
    variantId: string,
    qty: number,
  ) => {
    if (!Number.isFinite(qty) || qty < 1) return;
    setPoItems((current) =>
      current.map((item) =>
        item.productId === productId && item.variantId === variantId
          ? { ...item, quantity: Math.floor(qty) }
          : item,
      ),
    );
  };

  const updatePoItemCost = (
    productId: string,
    variantId: string,
    cost: number,
  ) => {
    if (!Number.isFinite(cost) || cost < 0) return;
    setPoItems((current) =>
      current.map((item) =>
        item.productId === productId && item.variantId === variantId
          ? { ...item, unitCost: cost }
          : item,
      ),
    );
  };

  /* -------- Return helpers -------- */
  const addReturnItem = (orderItem: any) => {
    const remaining =
      orderItem.quantity - Number(orderItem.returnedQuantity || 0);
    if (remaining <= 0) {
      setFormError("This item is fully returned already.");
      return;
    }
    if (returnItems.find((item) => item.orderItemId === orderItem.id)) {
      setFormError("This item is already in the return list.");
      return;
    }
    const unitPrice = Number(orderItem.unitPrice || 0);
    setReturnItems((current) => [
      ...current,
      {
        orderItemId: orderItem.id,
        quantity: 1,
        refundAmount: unitPrice,
        reason: "",
        productName: orderItem.product?.name || "Product",
        variantName: orderItem.variant?.name,
      },
    ]);
    setFormError("");
  };

  const removeReturnItem = (orderItemId: string) => {
    setReturnItems((current) =>
      current.filter((item) => item.orderItemId !== orderItemId),
    );
  };

  const updateReturnItem = (
    orderItemId: string,
    patch: Partial<ReturnLine>,
  ) => {
    setReturnItems((current) =>
      current.map((item) => {
        if (item.orderItemId !== orderItemId) return item;
        const next = { ...item, ...patch };
        if (patch.quantity !== undefined) {
          const orderItem = selectedOrder?.items?.find(
            (oi) => oi.id === orderItemId,
          );
          const unitPrice = Number(orderItem?.unitPrice || 0);
          next.refundAmount = Math.max(0, patch.quantity * unitPrice);
        }
        return next;
      }),
    );
  };

  /* ---------------------------- submit --------------------------- */

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      if (module === "purchasing") {
        if (!fields.storeId || !fields.supplierId) {
          throw new Error("Select a store and a supplier.");
        }
        if (poItems.length === 0) {
          throw new Error("Add at least one product to the purchase order.");
        }
        await onCreatePurchaseOrder({
          storeId: fields.storeId,
          supplierId: fields.supplierId,
          status: "DRAFT",
          currencyCode: "MMK",
          expectedDate: fields.expectedDate || undefined,
          subTotal: poSubtotal,
          taxAmount: 0,
          grandTotal: poSubtotal,
          notes: fields.notes || undefined,
          items: poItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
          })),
        });
        pushToast(
          "success",
          `Purchase order created with ${poItems.length} line(s).`,
        );
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
        if (!fields.toStoreId || transferItems.length === 0) {
          throw new Error(
            "Choose a destination store and add at least one item.",
          );
        }
        if (fields.toStoreId === selectedStoreId)
          throw new Error("Source and destination stores must be different.");
        for (const item of transferItems) {
          const product = products.find((entry) => entry.id === item.productId);
          const variant = getVariants(product).find(
            (entry) => entry.id === item.variantId,
          );
          if (!product || !variant)
            throw new Error(
              "One of the selected product options is no longer available.",
            );
          const available = Number(
            variant.availableStock ?? variant.stock ?? 0,
          );
          if (item.quantity > available)
            throw new Error(
              `Only ${available} unit(s) of ${product.name} remain at the source store.`,
            );
        }
        await onCreateTransfer({
          fromStoreId: selectedStoreId,
          toStoreId: fields.toStoreId,
          notes: fields.notes || undefined,
          items: transferItems,
        });
        pushToast("success", `Sent ${transferItems.length} product option(s).`);
        setTransferItems([]);
      } else if (module === "returns") {
        if (!selectedOrder) throw new Error("Choose a completed order first.");
        if (returnItems.length === 0)
          throw new Error("Add at least one item to return.");
        for (const item of returnItems) {
          if (!item.reason.trim()) {
            throw new Error(`Enter a return reason for "${item.productName}".`);
          }
          const orderItem = selectedOrder.items?.find(
            (oi) => oi.id === item.orderItemId,
          );
          const remaining =
            (orderItem?.quantity || 0) -
            Number(orderItem?.returnedQuantity || 0);
          if (item.quantity > remaining)
            throw new Error(
              `Only ${remaining} unit(s) returnable for "${item.productName}".`,
            );
        }
        await onCreateReturn({
          orderId: selectedOrder.id,
          totalAmount: returnRefundTotal,
          refundMethod: fields.refundMethod,
          refundStatus: "COMPLETED",
          reason: returnItems.map((item) => item.reason).join("; "),
          items: returnItems.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            refundAmount: item.refundAmount,
            reason: item.reason,
          })),
        });
        pushToast(
          "success",
          `Sales return processed for ${returnItems.length} item(s).`,
        );
        setReturnItems([]);
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
          `Enter a batch / lot number for "${missing.name}", or turn lot tracking off.`,
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
        `${receiveTarget.poNumber} received. Inventory updated.`,
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
        `Transfer ${transferTarget.transferNumber} received.`,
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
    <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Enterprise operations
        </p>
        <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">ERP</h1>
        <p className="mt-1 text-sm text-slate-400">
          Purchasing, costs, supplier settlement, branch stock and returns.
        </p>
      </header>

      <WorkflowGuide />

      {/* Toasts */}
      <div className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5 sm:w-80">
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
          returns={returns}
        />
      ) : (
        <>
          <section className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search records"
              aria-label="Search records"
              className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500 sm:min-w-64"
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
                            {RECEIVABLE_TRANSFER_STATUSES.includes(
                              record.status,
                            ) &&
                            (userRole === "SUPER_ADMIN" ||
                              record.toStoreId === selectedStoreId) ? (
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
                                Receive stock
                              </button>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                {record.status === "RECEIVED"
                                  ? "✓ Received"
                                  : record.status === "IN_TRANSIT"
                                    ? "Sent · awaiting receipt"
                                    : "Awaiting dispatch"}
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

      {/* ============================================================ */}
      {/*  Receive PO modal                                             */}
      {/* ============================================================ */}
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
              Record delivered products into the purchase order's destination
              store.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Destination store / branch
              </label>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                {stores.find((store) => store.id === receiveStoreId)?.name ||
                  receiveTarget.store?.name ||
                  "Assigned destination"}
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

      {/* ============================================================ */}
      {/*  Complete transfer modal                                      */}
      {/* ============================================================ */}
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
              Confirm the full shipment arrived. Stock is added to this store
              only after you receive it.
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <div className="flex justify-between border-b border-slate-900 py-1">
                <span className="text-slate-400">Source:</span>
                <span className="font-semibold text-rose-300">
                  {transferTarget.fromStore?.name || "Source store"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-900 py-1">
                <span className="text-slate-400">Destination:</span>
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
                  Items:
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

      {/* ============================================================ */}
      {/*  Create dialog                                                */}
      {/* ============================================================ */}
      <Modal
        open={dialog || categoryDialog}
        maxWidth={
          module === "transfers" ||
          module === "purchasing" ||
          module === "returns"
            ? "max-w-6xl"
            : "max-w-4xl"
        }
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
                      ? "Send stock"
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
            /* ============================================================ */
            /*  PURCHASING — Multi-item two-panel                           */
            /* ============================================================ */
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CreatableSelect
                  label="Destination store"
                  value={fields.storeId}
                  onChange={(value) => setFields({ ...fields, storeId: value })}
                  options={stores.map((item) => [item.id, item.name])}
                  createLabel="+ New branch"
                  onCreate={
                    onCreateStore
                      ? async (name) => {
                          const created = await onCreateStore({ name });
                          if (created && "id" in created) {
                            setFields((current) => ({
                              ...current,
                              storeId: created.id,
                            }));
                          }
                        }
                      : undefined
                  }
                />
                <CreatableSelect
                  label="Supplier"
                  value={fields.supplierId}
                  onChange={(value) =>
                    setFields({ ...fields, supplierId: value })
                  }
                  options={suppliers.map((item) => [
                    item.id,
                    `${item.name} (${item.code ?? "—"})`,
                  ])}
                  createLabel="+ New supplier"
                  onCreate={
                    onCreateSupplier
                      ? async (name) => {
                          const created = await onCreateSupplier({ name });
                          if (created && "id" in created) {
                            setFields((current) => ({
                              ...current,
                              supplierId: created.id,
                            }));
                          }
                        }
                      : undefined
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
                {/* Left: Product picker */}
                <div className="flex max-h-[340px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:max-h-[420px]">
                  <div className="border-b border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Products</h3>
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                        Catalog
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Search name, SKU or barcode..."
                      value={sourceSearch}
                      onChange={(event) => setSourceSearch(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {filteredSourceProducts.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        No matching products.
                      </p>
                    ) : (
                      filteredSourceProducts.map((product) => {
                        const variants = getVariants(product);
                        return (
                          <div
                            key={product.id}
                            className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-bold text-white">
                                {product.name}
                              </span>
                              <span className="shrink-0 text-[10px] text-slate-500">
                                {product.sku}
                              </span>
                            </div>

                            {variants.length === 0 ? (
                              <p className="text-[10px] italic text-slate-500">
                                No options available
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {variants.map((variant) => {
                                  const cost = Number(
                                    variant.costPrice ??
                                      variant.unitCost ??
                                      product.costPrice ??
                                      0,
                                  );
                                  return (
                                    <div
                                      key={variant.id}
                                      className="flex items-center justify-between gap-2 rounded-md border-t border-slate-800/60 pt-1.5 text-[11px] first:border-t-0 first:pt-0"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-slate-300">
                                          {variant.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          Cost ref: {cost.toLocaleString()} MMK
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addPoItem(
                                            product.id,
                                            variant.id,
                                            1,
                                            cost,
                                          )
                                        }
                                        className="shrink-0 rounded-md bg-violet-500/20 px-2 py-1 font-bold text-violet-300 transition-colors hover:bg-violet-500/30"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Middle: arrows (desktop) */}
                <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
                  <ArrowRight className="h-6 w-6 text-violet-400" />
                  <span className="text-center text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    to
                    <br />
                    order
                  </span>
                  <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
                </div>

                {/* Middle: divider (mobile) */}
                <div className="flex items-center justify-center py-1 md:hidden">
                  <div className="h-px flex-1 bg-slate-800" />
                  <ArrowRight className="mx-2 h-4 w-4 text-violet-400" />
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Right: PO items */}
                <div className="flex max-h-[340px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:max-h-[420px]">
                  <div className="border-b border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Purchase order
                      </h3>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                        List
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Items in this purchase
                    </p>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {poItems.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                        <Package className="mb-3 h-8 w-8 text-slate-700" />
                        <p className="text-xs text-slate-500">No items yet.</p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          Add products from the left panel.
                        </p>
                      </div>
                    ) : (
                      poItems.map((item) => {
                        const product = products.find(
                          (p) => p.id === item.productId,
                        );
                        const variant = getVariants(product).find(
                          (v) => v.id === item.variantId,
                        );
                        return (
                          <div
                            key={`${item.productId}:${item.variantId}`}
                            className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-slate-200">
                                  {product?.name || "Product"}
                                </p>
                                <p className="truncate text-[10px] text-slate-500">
                                  {variant?.name || "Option"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  removePoItem(item.productId, item.variantId)
                                }
                                className="shrink-0 rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <label className="text-[10px] text-slate-400">
                                Qty
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updatePoItemQty(
                                      item.productId,
                                      item.variantId,
                                      Number(event.target.value),
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                                />
                              </label>
                              <label className="text-[10px] text-slate-400">
                                Cost
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitCost}
                                  onChange={(event) =>
                                    updatePoItemCost(
                                      item.productId,
                                      item.variantId,
                                      Number(event.target.value),
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                                />
                              </label>
                            </div>
                            <p className="mt-2 text-right text-[10px] text-slate-400">
                              Line:{" "}
                              <span className="font-bold text-white">
                                {(
                                  item.quantity * item.unitCost
                                ).toLocaleString()}{" "}
                                MMK
                              </span>
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {poItems.length > 0 && (
                    <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
                      <div className="flex justify-between">
                        <span>Lines:</span>
                        <span className="font-bold text-white">
                          {poItems.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total units:</span>
                        <span className="font-bold text-white">
                          {poTotalUnits}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-slate-800 pt-1">
                        <span>Subtotal:</span>
                        <span className="font-bold text-emerald-300">
                          {poSubtotal.toLocaleString()} MMK
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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

              <ErrorNote message={formError} />
            </div>
          ) : module === "expenses" ? (
            <div className="space-y-3">
              {!selectedStoreId && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
                  Select a store in the top bar before recording an expense.
                </p>
              )}
              <CreatableSelect
                label="Expense category"
                value={fields.categoryId}
                onChange={(value) =>
                  setFields({ ...fields, categoryId: value })
                }
                options={expenseCategories.map((item) => [item.id, item.name])}
                createLabel="+ New category"
                onCreate={async (name) => {
                  await onCreateExpenseCategory(name);
                  // Parent refetch will refresh the list; user then picks it.
                }}
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
              <CreatableSelect
                label="Supplier"
                value={fields.supplierId}
                onChange={(value) =>
                  setFields({ ...fields, supplierId: value })
                }
                options={suppliers.map((item) => [item.id, item.name])}
                createLabel="+ New supplier"
                onCreate={
                  onCreateSupplier
                    ? async (name) => {
                        const created = await onCreateSupplier({ name });
                        if (created && "id" in created) {
                          setFields((current) => ({
                            ...current,
                            supplierId: created.id,
                          }));
                        }
                      }
                    : undefined
                }
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
            <div className="space-y-4">
              <ChoiceCards
                label="Destination"
                value={fields.toStoreId}
                onChange={(value) =>
                  setFields((current) => ({ ...current, toStoreId: value }))
                }
                columns={3}
                options={transferDestinationStores
                  .filter((item) => item.id !== selectedStoreId)
                  .map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: "Receiving branch",
                  }))}
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
                {/* Left: source stock */}
                <div className="flex max-h-[340px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:max-h-[440px]">
                  <div className="border-b border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Store 1:{" "}
                        {stores.find((item) => item.id === selectedStoreId)
                          ?.name || "Source"}
                      </h3>
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                        List & stock
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Search name, SKU or barcode..."
                      value={sourceSearch}
                      onChange={(event) => setSourceSearch(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {filteredSourceProducts.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        No matching products.
                      </p>
                    ) : (
                      filteredSourceProducts.map((product) => {
                        const variants = getVariants(product);
                        return (
                          <div
                            key={product.id}
                            className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-bold text-white">
                                {product.name}
                              </span>
                              <span className="shrink-0 text-[10px] text-slate-500">
                                {product.sku}
                              </span>
                            </div>

                            {variants.length === 0 ? (
                              <p className="text-[10px] italic text-slate-500">
                                No options available
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {variants.map((variant) => {
                                  const stock = Number(
                                    variant.availableStock ??
                                      variant.stock ??
                                      0,
                                  );
                                  const inCart =
                                    transferItems.find(
                                      (item) => item.variantId === variant.id,
                                    )?.quantity || 0;
                                  const remaining = stock - inCart;
                                  const disabled =
                                    remaining <= 0 || !fields.toStoreId;

                                  return (
                                    <div
                                      key={variant.id}
                                      className="flex items-center justify-between gap-2 rounded-md border-t border-slate-800/60 pt-1.5 text-[11px] first:border-t-0 first:pt-0"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-slate-300">
                                          {variant.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {stock} in stock
                                          {inCart > 0 && (
                                            <span className="text-sky-400">
                                              {" "}
                                              · {inCart} added
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addTransferItem(
                                            product.id,
                                            variant.id,
                                            1,
                                          )
                                        }
                                        disabled={disabled}
                                        className="shrink-0 rounded-md bg-violet-500/20 px-2 py-1 font-bold text-violet-300 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-30"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Middle: arrows desktop */}
                <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
                  <ArrowRight className="h-6 w-6 text-sky-400" />
                  <span className="text-center text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    to
                    <br />
                    transfer
                  </span>
                  <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
                </div>

                {/* Middle: divider mobile */}
                <div className="flex items-center justify-center py-1 md:hidden">
                  <div className="h-px flex-1 bg-slate-800" />
                  <ArrowRight className="mx-2 h-4 w-4 text-sky-400" />
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Right: transfer list */}
                <div className="flex max-h-[340px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:max-h-[440px]">
                  <div className="border-b border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Store 2:{" "}
                        {stores.find((item) => item.id === fields.toStoreId)
                          ?.name || "Destination"}
                      </h3>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                        List
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {transferItems.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                        <ArrowLeftRight className="mb-3 h-8 w-8 text-slate-700" />
                        <p className="text-xs text-slate-500">No items yet.</p>
                      </div>
                    ) : (
                      transferItems.map((item) => {
                        const product = products.find(
                          (p) => p.id === item.productId,
                        );
                        const variant = getVariants(product).find(
                          (v) => v.id === item.variantId,
                        );
                        return (
                          <div
                            key={`${item.productId}:${item.variantId}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-slate-200">
                                {product?.name || "Product"}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {variant?.name || "Option"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateTransferItemQuantity(
                                    item.productId,
                                    item.variantId,
                                    Number(event.target.value),
                                  )
                                }
                                className="w-12 rounded-md border border-slate-700 bg-slate-950 py-1 text-center text-[11px] text-white outline-none focus:border-violet-500"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  removeTransferItem(
                                    item.productId,
                                    item.variantId,
                                  )
                                }
                                className="rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {transferItems.length > 0 && (
                    <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
                      <div className="flex justify-between">
                        <span>Total options:</span>
                        <span className="font-bold text-white">
                          {transferItems.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total units:</span>
                        <span className="font-bold text-white">
                          {transferTotalUnits}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Field
                label="Notes"
                value={fields.notes}
                onChange={(value) => setFields({ ...fields, notes: value })}
              />

              <ErrorNote message={formError} />
            </div>
          ) : module === "returns" ? (
            /* ============================================================ */
            /*  RETURNS — Two-panel                                          */
            /* ============================================================ */
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
                {/* Left: orders */}
                <div className="flex max-h-[340px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:max-h-[440px]">
                  <div className="border-b border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Recent orders
                      </h3>
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                        Pick one
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Completed or paid orders only
                    </p>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {returnableOrders.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        No completed orders to return.
                      </p>
                    ) : (
                      returnableOrders.map((order) => {
                        const selected = fields.orderId === order.id;
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => {
                              setFields((current) => ({
                                ...current,
                                orderId: order.id,
                              }));
                              setReturnItems([]);
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                              selected
                                ? "border-violet-400/60 bg-violet-500/10 text-white"
                                : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                {order.orderNumber || order.id.slice(0, 8)}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {new Date(order.createdAt).toLocaleDateString()}{" "}
                                · {order.items?.length || 0} items
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] font-bold text-violet-200">
                              {amount(order.grandTotal)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Middle: arrows desktop */}
                <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
                  <ArrowRight className="h-6 w-6 text-violet-400" />
                  <span className="text-center text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    to
                    <br />
                    return
                  </span>
                  <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
                </div>

                {/* Middle: divider mobile */}
                <div className="flex items-center justify-center py-1 md:hidden">
                  <div className="h-px flex-1 bg-slate-800" />
                  <ArrowRight className="mx-2 h-4 w-4 text-violet-400" />
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Right: return items */}
                <div className="flex max-h-[340px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:max-h-[440px]">
                  <div className="border-b border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Return items
                      </h3>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                        List
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Items chosen to refund
                    </p>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {!selectedOrder ? (
                      <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                        <Undo2 className="mb-3 h-8 w-8 text-slate-700" />
                        <p className="text-xs text-slate-500">
                          Pick an order first.
                        </p>
                      </div>
                    ) : returnItems.length === 0 ? (
                      <div className="space-y-2">
                        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">
                          Tap an item to add it
                        </p>
                        {(selectedOrder.items || []).map((item) => {
                          const remaining =
                            item.quantity - Number(item.returnedQuantity || 0);
                          const disabled = remaining <= 0;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => addReturnItem(item)}
                              disabled={disabled}
                              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-left text-xs transition-colors hover:border-violet-400/60 hover:bg-violet-500/5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-200">
                                  {item.product?.name}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  Qty {item.quantity} · Returnable {remaining}
                                </p>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-violet-300">
                                {amount(item.unitPrice || 0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      returnItems.map((item) => (
                        <div
                          key={item.orderItemId}
                          className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-slate-200">
                                {item.productName}
                              </p>
                              {item.variantName && (
                                <p className="truncate text-[10px] text-slate-500">
                                  {item.variantName}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReturnItem(item.orderItemId)}
                              className="shrink-0 rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="text-[10px] text-slate-400">
                              Qty
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateReturnItem(item.orderItemId, {
                                    quantity: Math.max(
                                      1,
                                      Number(event.target.value),
                                    ),
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                              />
                            </label>
                            <div className="text-[10px] text-slate-400">
                              Refund
                              <p className="mt-1.5 text-[11px] font-bold text-emerald-300">
                                {item.refundAmount.toLocaleString()} MMK
                              </p>
                            </div>
                          </div>

                          <label className="mt-2 block text-[10px] text-slate-400">
                            Reason
                            <input
                              type="text"
                              value={item.reason}
                              onChange={(event) =>
                                updateReturnItem(item.orderItemId, {
                                  reason: event.target.value,
                                })
                              }
                              placeholder="e.g. damaged, wrong size"
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                            />
                          </label>
                        </div>
                      ))
                    )}
                  </div>

                  {returnItems.length > 0 && (
                    <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
                      <div className="flex justify-between">
                        <span>Items:</span>
                        <span className="font-bold text-white">
                          {returnItems.length}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-slate-800 pt-1">
                        <span>Refund total:</span>
                        <span className="font-bold text-emerald-300">
                          {returnRefundTotal.toLocaleString()} MMK
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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

              <ErrorNote message={formError} />
            </div>
          ) : null}

          {!(module === "transfers" && !categoryDialog) &&
            !(module === "purchasing" && !categoryDialog) &&
            !(module === "returns" && !categoryDialog) && (
              <ErrorNote message={formError} />
            )}

          <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
            <button
              type="button"
              onClick={() => {
                setDialog(false);
                setCategoryDialog(false);
              }}
              disabled={saving}
              className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:py-2.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                (module === "transfers" &&
                  !categoryDialog &&
                  (transferItems.length === 0 || !fields.toStoreId)) ||
                (module === "purchasing" &&
                  !categoryDialog &&
                  poItems.length === 0) ||
                (module === "returns" &&
                  !categoryDialog &&
                  returnItems.length === 0)
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving
                ? "Saving…"
                : module === "transfers"
                  ? `Send stock${transferTotalUnits ? ` (${transferTotalUnits})` : ""}`
                  : module === "purchasing"
                    ? `Create PO${poItems.length ? ` (${poItems.length})` : ""}`
                    : module === "returns"
                      ? `Process return${returnItems.length ? ` (${returnItems.length})` : ""}`
                      : "Save"}
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
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
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
        className={`max-h-[96dvh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-2xl sm:p-6`}
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

/* ------------------------------------------------------------------ */
/*  CreatableSelect — select + inline “create new”                     */
/* ------------------------------------------------------------------ */

function CreatableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  createLabel = "+ Create new",
  onCreate,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  placeholder?: string;
  createLabel?: string;
  onCreate?: (name: string) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Enter a name.");
      return;
    }
    if (!onCreate) {
      setErr("Creation is not available here.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onCreate(trimmed);
      setName("");
      setCreating(false);
    } catch (cause) {
      const value = cause as { data?: { message?: string }; message?: string };
      setErr(
        value?.data?.message ||
          value?.message ||
          "Could not create the record.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="block text-xs text-slate-400">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {onCreate && !creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setErr("");
            }}
            disabled={disabled}
            className="shrink-0 text-[10px] font-bold text-violet-300 transition-colors hover:text-violet-200 disabled:opacity-50"
          >
            {createLabel}
          </button>
        )}
      </div>

      {creating ? (
        <div className="mt-1.5 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
              if (event.key === "Escape") {
                setCreating(false);
                setName("");
                setErr("");
              }
            }}
            placeholder={`New ${label.toLowerCase()}`}
            className="min-w-0 flex-1 rounded-xl border border-violet-500/40 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-violet-500 px-3 text-xs font-bold text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setName("");
              setErr("");
            }}
            disabled={busy}
            className="shrink-0 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400 disabled:opacity-60"
        >
          <option value="">{placeholder}</option>
          {options.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      )}

      {err && <span className="mt-1 block text-rose-300">{err}</span>}
      {!err && options.length === 0 && !creating && (
        <span className="mt-1 block text-amber-300">
          No records yet — tap “{createLabel}” above.
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reports — Tabs + Date range + Area chart                           */
/* ------------------------------------------------------------------ */

type ReportTab = "overview" | "sales" | "expenses" | "purchasing";
type RangeKey = "today" | "7d" | "30d" | "90d";

function startOfRange(range: RangeKey): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "today") return d;
  if (range === "7d") {
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (range === "30d") {
    d.setDate(d.getDate() - 29);
    return d;
  }
  d.setDate(d.getDate() - 89);
  return d;
}

function Reports({
  orders,
  expenses,
  purchaseOrders,
  returns,
}: {
  orders: ApiOrder[];
  expenses: any[];
  purchaseOrders: any[];
  returns: any[];
}) {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [range, setRange] = useState<RangeKey>("7d");

  const from = useMemo(() => startOfRange(range), [range]);

  const inRange = (date?: string) => (date ? new Date(date) >= from : false);

  const filteredOrders = orders.filter(
    (order) =>
      inRange(order.createdAt) &&
      (order.status === "COMPLETED" || order.paymentStatus === "PAID"),
  );
  const filteredExpenses = expenses.filter((e) => inRange(e.expenseDate));
  const filteredPurchases = purchaseOrders.filter(
    (po) => inRange(po.orderDate) && po.status === "RECEIVED",
  );
  const filteredReturns = returns.filter((r) => inRange(r.createdAt));

  const revenue = filteredOrders.reduce((s, o) => s + o.grandTotal, 0);
  const expenseTotal = filteredExpenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0,
  );
  const purchaseTotal = filteredPurchases.reduce(
    (s, po) => s + Number(po.grandTotal || 0),
    0,
  );
  const refundTotal = filteredReturns.reduce(
    (s, r) => s + Number(r.totalAmount || 0),
    0,
  );
  const netRevenue = revenue - refundTotal;

  const days =
    range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;

  const series = useMemo(
    () =>
      Array.from({ length: days }, (_, i) => {
        const day = new Date(from);
        day.setDate(day.getDate() + i);
        const dayKey = day.toDateString();
        const dayTotal = filteredOrders
          .filter((o) => new Date(o.createdAt).toDateString() === dayKey)
          .reduce((s, o) => s + o.grandTotal, 0);
        return {
          label:
            days <= 7
              ? day.toLocaleDateString(undefined, { weekday: "short" })
              : day.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                }),
          amount: dayTotal,
        };
      }),
    [days, from, filteredOrders],
  );

  const cards = [
    {
      label: "Net revenue",
      value: amount(netRevenue),
      detail: `${filteredOrders.length} orders · ${filteredReturns.length} returns`,
      icon: Wallet,
      tone: "text-emerald-300 bg-emerald-400/10",
    },
    {
      label: "Expenses",
      value: amount(expenseTotal),
      detail: `${filteredExpenses.length} records`,
      icon: Receipt,
      tone: "text-rose-300 bg-rose-400/10",
    },
    {
      label: "Purchasing",
      value: amount(purchaseTotal),
      detail: `${filteredPurchases.length} POs received`,
      icon: Truck,
      tone: "text-sky-300 bg-sky-400/10",
    },
    {
      label: "Refunds",
      value: amount(refundTotal),
      detail: `${filteredReturns.length} returns`,
      icon: Undo2,
      tone: "text-amber-300 bg-amber-400/10",
    },
  ];

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "sales", label: "Sales" },
    { id: "expenses", label: "Expenses" },
    { id: "purchasing", label: "Purchasing" },
  ];

  const ranges: { id: RangeKey; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "90d", label: "90 days" },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                tab === t.id
                  ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                range === r.id
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                  : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
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

      {(tab === "overview" || tab === "sales") && (
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white">Revenue trend</h2>
              <p className="mt-1 text-xs text-slate-500">
                {range === "today" ? "Today" : `Last ${days} days`}
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-sky-300" />
          </div>
          {series.length === 1 ? (
            <div className="grid h-48 place-items-center rounded-xl bg-slate-950/70">
              <div className="text-center">
                <p className="text-xs text-slate-500">Today's revenue</p>
                <p className="mt-1 text-3xl font-black text-sky-300">
                  {amount(series[0].amount)}
                </p>
              </div>
            </div>
          ) : (
            <AreaChart data={series} height={220} />
          )}
        </article>
      )}

      {tab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <SimpleList
            title="Top selling products"
            emptyText="No sales in this range"
            rows={filteredOrders
              .flatMap((o) => o.items || [])
              .reduce<
                Record<string, { name: string; qty: number; total: number }>
              >((acc, item: any) => {
                const key = item.product?.id || item.productId || "unknown";
                if (!acc[key])
                  acc[key] = {
                    name: item.product?.name || "Product",
                    qty: 0,
                    total: 0,
                  };
                acc[key].qty += item.quantity || 0;
                acc[key].total +=
                  (item.quantity || 0) * Number(item.unitPrice || 0);
                return acc;
              }, {})}
            map={(v) => ({
              left: v.name,
              right: `${v.qty} × · ${amount(v.total)}`,
            })}
          />
          <SimpleList
            title="Expenses by category"
            emptyText="No expenses in this range"
            rows={filteredExpenses.reduce<
              Record<string, { name: string; total: number; count: number }>
            >((acc, e) => {
              const key = e.category?.id || e.categoryId || "unknown";
              if (!acc[key])
                acc[key] = {
                  name: e.category?.name || "Uncategorized",
                  total: 0,
                  count: 0,
                };
              acc[key].total += Number(e.amount || 0);
              acc[key].count += 1;
              return acc;
            }, {})}
            map={(v) => ({
              left: `${v.name} (${v.count})`,
              right: amount(v.total),
            })}
          />
        </div>
      )}

      {tab === "expenses" && (
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="mb-3 font-bold text-white">Expense records</h2>
          {filteredExpenses.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No expenses in this range.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredExpenses.slice(0, 20).map((e: any) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-200">
                      {e.category?.name || "Uncategorized"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {e.description || "—"} · {dateText(e.expenseDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-white">
                    {amount(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {tab === "purchasing" && (
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="mb-3 font-bold text-white">
            Received purchase orders
          </h2>
          {filteredPurchases.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No received POs in this range.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredPurchases.slice(0, 20).map((po: any) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between gap-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-200">
                      {po.poNumber} · {po.supplier?.name || "Supplier"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {po.store?.name} · {dateText(po.orderDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-white">
                    {amount(po.grandTotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
        Operational summary only. Not a full P&amp;L statement — taxes,
        liabilities and accounting journals are not reconciled here.
      </p>
    </div>
  );
}

/* ---------- Simple helper list for Reports ---------- */

function SimpleList({
  title,
  rows,
  emptyText,
  map,
}: {
  title: string;
  rows: Record<string, any>;
  emptyText: string;
  map: (value: any) => { left: string; right: string };
}) {
  const list = Object.entries(rows)
    .map(([k, v]) => ({ key: k, ...map(v) }))
    .sort((a, b) => b.right.localeCompare(a.right))
    .slice(0, 6);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="mb-3 font-bold text-white">{title}</h2>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {list.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 py-2.5 text-xs"
            >
              <span className="min-w-0 truncate text-slate-300">
                {row.left}
              </span>
              <span className="shrink-0 font-bold text-white">{row.right}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ---------- Pure SVG area chart ---------- */

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

  const linePath = points
    .map((p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");

  const areaPath = `${linePath} L ${
    points[points.length - 1].x
  } ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`;

  return (
    <div className="relative mt-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaFillErp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="areaStrokeErp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

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

        <path d={areaPath} fill="url(#areaFillErp)" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#areaStrokeErp)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={p.label + i}>
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

      <div className="mt-1 flex justify-between px-2">
        {data.map((d, i) => (
          <span
            key={d.label + i}
            className="text-[10px] text-slate-500"
            style={{ flex: 1, textAlign: "center" }}
          >
            {d.label}
          </span>
        ))}
      </div>

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
            {amount(points[hover].amount)}
          </p>
        </div>
      )}
    </div>
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
//   ArrowLeft,
//   ArrowLeftRight,
//   ArrowRight,
//   BadgeDollarSign,
//   BarChart3,
//   CheckCircle2,
//   ClipboardCheck,
//   FileBarChart2,
//   Loader2,
//   Package,
//   Plus,
//   Receipt,
//   Truck,
//   Undo2,
//   Wallet,
//   X,
// } from "lucide-react";
// import { ApiOrder } from "../store/apiSlice";
// import { Product } from "../types";
// import { WorkflowGuide } from "./WorkflowGuide";
// import { ChoiceCards } from "./ChoiceCards";

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
//   userRole?: string;
//   stores: { id: string; name: string }[];
//   transferDestinationStores: { id: string; name: string }[];
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

// interface TransferLine {
//   productId: string;
//   variantId: string;
//   quantity: number;
// }

// interface PurchaseLine {
//   productId: string;
//   variantId: string;
//   quantity: number;
//   unitCost: number;
// }

// interface ReturnLine {
//   orderItemId: string;
//   quantity: number;
//   refundAmount: number;
//   reason: string;
//   productName: string;
//   variantName?: string;
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

// const COLUMNS: Record<Module, string[]> = {
//   purchasing: [
//     "PO number",
//     "Supplier",
//     "Store",
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
// const RECEIVABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

// const today = () => new Date().toISOString().slice(0, 10);

// const initialFields = (): Fields => ({
//   storeId: "",
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
//   status === "RECEIVED"
//     ? "Received"
//     : status === "IN_TRANSIT"
//       ? "On the way"
//       : status === "PENDING"
//         ? "Awaiting dispatch"
//         : status === "APPROVED"
//           ? "Ready to send"
//           : status;

// const getVariants = (product: Product | undefined): any[] => {
//   const value = (product as { variants?: unknown } | undefined)?.variants;
//   return Array.isArray(value) ? value : [];
// };

// /* ------------------------------------------------------------------ */
// /*  Main view                                                          */
// /* ------------------------------------------------------------------ */

// export function ERPView(props: Props) {
//   const {
//     selectedStoreId,
//     userRole,
//     stores,
//     transferDestinationStores,
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

//   const [dialog, setDialog] = useState(false);
//   const [fields, setFields] = useState<Fields>(initialFields);
//   const [transferItems, setTransferItems] = useState<TransferLine[]>([]);
//   const [poItems, setPoItems] = useState<PurchaseLine[]>([]);
//   const [returnItems, setReturnItems] = useState<ReturnLine[]>([]);
//   const [sourceSearch, setSourceSearch] = useState("");
//   const [formError, setFormError] = useState("");
//   const [saving, setSaving] = useState(false);

//   const [categoryDialog, setCategoryDialog] = useState(false);
//   const [categoryName, setCategoryName] = useState("");

//   const [receiveTarget, setReceiveTarget] = useState<any>(null);
//   const [receiveStoreId, setReceiveStoreId] = useState("");
//   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
//   const [receiveLots, setReceiveLots] = useState<
//     Record<string, { number: string; expiryDate: string }>
//   >({});
//   const [receiveError, setReceiveError] = useState("");
//   const [receiving, setReceiving] = useState(false);

//   const [transferTarget, setTransferTarget] = useState<any>(null);
//   const [transferError, setTransferError] = useState("");
//   const [completing, setCompleting] = useState(false);

//   const [busyId, setBusyId] = useState<string | null>(null);

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

//   const selectedOrder = orders.find((order) => order.id === fields.orderId);
//   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
//   const isReturnable = (order: ApiOrder) =>
//     order.status === "COMPLETED" || order.paymentStatus === "PAID";

//   const transferTotalUnits = transferItems.reduce(
//     (sum, item) => sum + item.quantity,
//     0,
//   );
//   const poSubtotal = poItems.reduce(
//     (sum, item) => sum + item.quantity * item.unitCost,
//     0,
//   );
//   const poTotalUnits = poItems.reduce((sum, item) => sum + item.quantity, 0);
//   const returnRefundTotal = returnItems.reduce(
//     (sum, item) => sum + item.refundAmount,
//     0,
//   );

//   const filteredSourceProducts = useMemo(() => {
//     const q = sourceSearch.trim().toLowerCase();
//     if (!q) return products;
//     return products.filter((product) => {
//       if (
//         product.name.toLowerCase().includes(q) ||
//         (product.sku ?? "").toLowerCase().includes(q)
//       )
//         return true;
//       return getVariants(product).some(
//         (variant) =>
//           (variant.name ?? "").toLowerCase().includes(q) ||
//           (variant.sku ?? "").toLowerCase().includes(q),
//       );
//     });
//   }, [products, sourceSearch]);

//   const returnableOrders = useMemo(
//     () => orders.filter(isReturnable).slice(0, 50),
//     [orders],
//   );

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
//         ...(item.items ?? []).flatMap((line: any) => [
//           line.product?.name,
//           line.product?.sku,
//           line.variant?.name,
//           line.variant?.sku,
//         ]),
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
//     setTransferItems([]);
//     setPoItems([]);
//     setReturnItems([]);
//     setSourceSearch("");
//   };

//   const openDialog = () => {
//     const firstOrder = orders.find(isReturnable);
//     const firstProduct = products[0];
//     setFields({
//       ...initialFields(),
//       storeId: selectedStoreId || stores[0]?.id || "",
//       supplierId: suppliers[0]?.id || "",
//       productId:
//         module === "transfers" ||
//         module === "purchasing" ||
//         module === "returns"
//           ? ""
//           : firstProduct?.id || "",
//       variantId:
//         module === "transfers" || module === "purchasing"
//           ? ""
//           : getVariants(firstProduct)[0]?.id || "",
//       categoryId: expenseCategories[0]?.id || "",
//       toStoreId:
//         transferDestinationStores.find((store) => store.id !== selectedStoreId)
//           ?.id || "",
//       orderId: firstOrder?.id || "",
//       orderItemId: firstOrder?.items?.[0]?.id || "",
//     });
//     resetMessages();
//     setTransferItems([]);
//     setPoItems([]);
//     setReturnItems([]);
//     setSourceSearch("");
//     setDialog(true);
//   };

//   /* -------- Transfer helpers -------- */
//   const addTransferItem = (
//     productId: string,
//     variantId: string,
//     qty: number = 1,
//   ) => {
//     if (!fields.toStoreId) {
//       setFormError("Choose a destination store first.");
//       return;
//     }
//     const product = products.find((entry) => entry.id === productId);
//     const variant = getVariants(product).find(
//       (entry) => entry.id === variantId,
//     );
//     if (!product || !variant) return;

//     const available = Number(variant.availableStock ?? variant.stock ?? 0);
//     const existingQuantity =
//       transferItems.find(
//         (item) =>
//           item.productId === product.id && item.variantId === variant.id,
//       )?.quantity ?? 0;

//     if (existingQuantity + qty > available) {
//       setFormError(
//         `Only ${available} unit(s) of ${product.name} · ${variant.name} are at the source store.`,
//       );
//       return;
//     }

//     setTransferItems((current) => {
//       const index = current.findIndex(
//         (item) =>
//           item.productId === product.id && item.variantId === variant.id,
//       );
//       if (index < 0)
//         return [
//           ...current,
//           { productId: product.id, variantId: variant.id, quantity: qty },
//         ];
//       return current.map((item, itemIndex) =>
//         itemIndex === index ? { ...item, quantity: item.quantity + qty } : item,
//       );
//     });
//     setFormError("");
//   };

//   const removeTransferItem = (productId: string, variantId: string) => {
//     setTransferItems((current) =>
//       current.filter(
//         (item) => item.productId !== productId || item.variantId !== variantId,
//       ),
//     );
//   };

//   const updateTransferItemQuantity = (
//     productId: string,
//     variantId: string,
//     qty: number,
//   ) => {
//     const next = Math.floor(qty);
//     if (!Number.isFinite(next) || next < 1) return;
//     const product = products.find((entry) => entry.id === productId);
//     const variant = getVariants(product).find(
//       (entry) => entry.id === variantId,
//     );
//     const available = Number(variant?.availableStock ?? variant?.stock ?? 0);
//     if (next > available) {
//       setFormError(`Only ${available} unit(s) available.`);
//       return;
//     }
//     setTransferItems((current) =>
//       current.map((item) =>
//         item.productId === productId && item.variantId === variantId
//           ? { ...item, quantity: next }
//           : item,
//       ),
//     );
//   };

//   /* -------- Purchase Order helpers -------- */
//   const addPoItem = (
//     productId: string,
//     variantId: string,
//     qty: number,
//     unitCost: number,
//   ) => {
//     const product = products.find((entry) => entry.id === productId);
//     const variant = getVariants(product).find(
//       (entry) => entry.id === variantId,
//     );
//     if (!product || !variant) return;
//     if (!Number.isFinite(qty) || qty < 1) {
//       setFormError("Quantity must be at least 1.");
//       return;
//     }
//     if (!Number.isFinite(unitCost) || unitCost < 0) {
//       setFormError("Unit cost must be 0 or greater.");
//       return;
//     }

//     setPoItems((current) => {
//       const index = current.findIndex(
//         (item) =>
//           item.productId === product.id && item.variantId === variant.id,
//       );
//       if (index < 0)
//         return [
//           ...current,
//           {
//             productId: product.id,
//             variantId: variant.id,
//             quantity: qty,
//             unitCost,
//           },
//         ];
//       return current.map((item, itemIndex) =>
//         itemIndex === index
//           ? {
//               ...item,
//               quantity: item.quantity + qty,
//               unitCost,
//             }
//           : item,
//       );
//     });
//     setFormError("");
//     setFields((current) => ({
//       ...current,
//       productId: "",
//       variantId: "",
//       quantity: "1",
//       unitCost: "",
//     }));
//   };

//   const removePoItem = (productId: string, variantId: string) => {
//     setPoItems((current) =>
//       current.filter(
//         (item) => item.productId !== productId || item.variantId !== variantId,
//       ),
//     );
//   };

//   const updatePoItemQty = (
//     productId: string,
//     variantId: string,
//     qty: number,
//   ) => {
//     if (!Number.isFinite(qty) || qty < 1) return;
//     setPoItems((current) =>
//       current.map((item) =>
//         item.productId === productId && item.variantId === variantId
//           ? { ...item, quantity: Math.floor(qty) }
//           : item,
//       ),
//     );
//   };

//   const updatePoItemCost = (
//     productId: string,
//     variantId: string,
//     cost: number,
//   ) => {
//     if (!Number.isFinite(cost) || cost < 0) return;
//     setPoItems((current) =>
//       current.map((item) =>
//         item.productId === productId && item.variantId === variantId
//           ? { ...item, unitCost: cost }
//           : item,
//       ),
//     );
//   };

//   /* -------- Return helpers -------- */
//   const addReturnItem = (orderItem: any) => {
//     const remaining =
//       orderItem.quantity - Number(orderItem.returnedQuantity || 0);
//     if (remaining <= 0) {
//       setFormError("This item is fully returned already.");
//       return;
//     }
//     if (returnItems.find((item) => item.orderItemId === orderItem.id)) {
//       setFormError("This item is already in the return list.");
//       return;
//     }
//     const unitPrice = Number(orderItem.unitPrice || 0);
//     setReturnItems((current) => [
//       ...current,
//       {
//         orderItemId: orderItem.id,
//         quantity: 1,
//         refundAmount: unitPrice,
//         reason: "",
//         productName: orderItem.product?.name || "Product",
//         variantName: orderItem.variant?.name,
//       },
//     ]);
//     setFormError("");
//   };

//   const removeReturnItem = (orderItemId: string) => {
//     setReturnItems((current) =>
//       current.filter((item) => item.orderItemId !== orderItemId),
//     );
//   };

//   const updateReturnItem = (
//     orderItemId: string,
//     patch: Partial<ReturnLine>,
//   ) => {
//     setReturnItems((current) =>
//       current.map((item) => {
//         if (item.orderItemId !== orderItemId) return item;
//         const next = { ...item, ...patch };
//         // Recalculate refund if quantity changed
//         if (patch.quantity !== undefined) {
//           const orderItem = selectedOrder?.items?.find(
//             (oi) => oi.id === orderItemId,
//           );
//           const unitPrice = Number(orderItem?.unitPrice || 0);
//           next.refundAmount = Math.max(0, patch.quantity * unitPrice);
//         }
//         return next;
//       }),
//     );
//   };

//   /* ---------------------------- submit --------------------------- */

//   const submit = async (event: FormEvent) => {
//     event.preventDefault();
//     setSaving(true);
//     setFormError("");

//     try {
//       if (module === "purchasing") {
//         if (!fields.storeId || !fields.supplierId) {
//           throw new Error("Select a store and a supplier.");
//         }
//         if (poItems.length === 0) {
//           throw new Error("Add at least one product to the purchase order.");
//         }
//         await onCreatePurchaseOrder({
//           storeId: fields.storeId,
//           supplierId: fields.supplierId,
//           status: "DRAFT",
//           currencyCode: "MMK",
//           expectedDate: fields.expectedDate || undefined,
//           subTotal: poSubtotal,
//           taxAmount: 0,
//           grandTotal: poSubtotal,
//           notes: fields.notes || undefined,
//           items: poItems.map((item) => ({
//             productId: item.productId,
//             variantId: item.variantId,
//             quantity: item.quantity,
//             unitCost: item.unitCost,
//             totalCost: item.quantity * item.unitCost,
//           })),
//         });
//         pushToast(
//           "success",
//           `Purchase order created with ${poItems.length} line(s).`,
//         );
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
//         if (!fields.toStoreId || transferItems.length === 0) {
//           throw new Error(
//             "Choose a destination store and add at least one item.",
//           );
//         }
//         if (fields.toStoreId === selectedStoreId)
//           throw new Error("Source and destination stores must be different.");
//         for (const item of transferItems) {
//           const product = products.find((entry) => entry.id === item.productId);
//           const variant = getVariants(product).find(
//             (entry) => entry.id === item.variantId,
//           );
//           if (!product || !variant)
//             throw new Error(
//               "One of the selected product options is no longer available.",
//             );
//           const available = Number(
//             variant.availableStock ?? variant.stock ?? 0,
//           );
//           if (item.quantity > available)
//             throw new Error(
//               `Only ${available} unit(s) of ${product.name} remain at the source store.`,
//             );
//         }
//         await onCreateTransfer({
//           fromStoreId: selectedStoreId,
//           toStoreId: fields.toStoreId,
//           notes: fields.notes || undefined,
//           items: transferItems,
//         });
//         pushToast("success", `Sent ${transferItems.length} product option(s).`);
//         setTransferItems([]);
//       } else if (module === "returns") {
//         if (!selectedOrder) throw new Error("Choose a completed order first.");
//         if (returnItems.length === 0)
//           throw new Error("Add at least one item to return.");
//         for (const item of returnItems) {
//           if (!item.reason.trim()) {
//             throw new Error(`Enter a return reason for "${item.productName}".`);
//           }
//           const orderItem = selectedOrder.items?.find(
//             (oi) => oi.id === item.orderItemId,
//           );
//           const remaining =
//             (orderItem?.quantity || 0) -
//             Number(orderItem?.returnedQuantity || 0);
//           if (item.quantity > remaining)
//             throw new Error(
//               `Only ${remaining} unit(s) returnable for "${item.productName}".`,
//             );
//         }
//         await onCreateReturn({
//           orderId: selectedOrder.id,
//           totalAmount: returnRefundTotal,
//           refundMethod: fields.refundMethod,
//           refundStatus: "COMPLETED",
//           reason: returnItems.map((item) => item.reason).join("; "),
//           items: returnItems.map((item) => ({
//             orderItemId: item.orderItemId,
//             quantity: item.quantity,
//             refundAmount: item.refundAmount,
//             reason: item.reason,
//           })),
//         });
//         pushToast(
//           "success",
//           `Sales return processed for ${returnItems.length} item(s).`,
//         );
//         setReturnItems([]);
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
//     const target = po.storeId || selectedStoreId || stores[0]?.id || "";
//     setReceiveStoreId(target);
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
//           `Enter a batch / lot number for "${missing.name}", or turn lot tracking off.`,
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
//         `${receiveTarget.poNumber} received. Inventory updated.`,
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
//         `Transfer ${transferTarget.transferNumber} received.`,
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
//           returns={returns}
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
//               <div className="min-w-[980px]">
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
//                           <span className="truncate text-slate-300">
//                             {record.store?.name ||
//                               stores.find((s) => s.id === record.storeId)
//                                 ?.name ||
//                               "—"}
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
//                             {RECEIVABLE_TRANSFER_STATUSES.includes(
//                               record.status,
//                             ) &&
//                             (userRole === "SUPER_ADMIN" ||
//                               record.toStoreId === selectedStoreId) ? (
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
//                                 Receive stock
//                               </button>
//                             ) : (
//                               <span className="text-[11px] font-medium text-slate-400">
//                                 {record.status === "RECEIVED"
//                                   ? "✓ Received"
//                                   : record.status === "IN_TRANSIT"
//                                     ? "Sent · awaiting receipt"
//                                     : "Awaiting dispatch"}
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

//       {/* ============================================================ */}
//       {/*  Receive PO modal                                             */}
//       {/* ============================================================ */}
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
//               Record delivered products into the purchase order's destination
//               store.
//             </p>

//             <div className="mt-4">
//               <label className="mb-1.5 block text-xs font-medium text-slate-300">
//                 Destination store / branch
//               </label>
//               <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
//                 {stores.find((store) => store.id === receiveStoreId)?.name ||
//                   receiveTarget.store?.name ||
//                   "Assigned destination"}
//               </div>
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

//       {/* ============================================================ */}
//       {/*  Complete transfer modal                                      */}
//       {/* ============================================================ */}
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
//               Confirm the full shipment arrived. Stock is added to this store
//               only after you receive it.
//             </p>

//             <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
//               <div className="flex justify-between border-b border-slate-900 py-1">
//                 <span className="text-slate-400">Source:</span>
//                 <span className="font-semibold text-rose-300">
//                   {transferTarget.fromStore?.name || "Source store"}
//                 </span>
//               </div>
//               <div className="flex justify-between border-b border-slate-900 py-1">
//                 <span className="text-slate-400">Destination:</span>
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
//                   Items:
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

//       {/* ============================================================ */}
//       {/*  Create dialog                                                */}
//       {/* ============================================================ */}
//       <Modal
//         open={dialog || categoryDialog}
//         maxWidth={
//           module === "transfers" ||
//           module === "purchasing" ||
//           module === "returns"
//             ? "max-w-6xl"
//             : "max-w-4xl"
//         }
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
//                       ? "Send stock"
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
//             /* ============================================================ */
//             /*  PURCHASING — Multi-item two-panel                           */
//             /* ============================================================ */
//             <div className="space-y-4">
//               <div className="grid gap-3 sm:grid-cols-2">
//                 <Select
//                   label="Destination store"
//                   value={fields.storeId}
//                   onChange={(value) => setFields({ ...fields, storeId: value })}
//                   options={stores.map((item) => [item.id, item.name])}
//                 />
//                 <Select
//                   label="Supplier"
//                   value={fields.supplierId}
//                   onChange={(value) =>
//                     setFields({ ...fields, supplierId: value })
//                   }
//                   options={suppliers.map((item) => [
//                     item.id,
//                     `${item.name} (${item.code ?? "—"})`,
//                   ])}
//                 />
//               </div>

//               <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
//                 {/* Left: Product picker */}
//                 <div className="flex max-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
//                   <div className="border-b border-slate-800 bg-slate-900 p-3">
//                     <div className="flex items-center justify-between">
//                       <h3 className="text-sm font-bold text-white">Products</h3>
//                       <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
//                         Catalog
//                       </span>
//                     </div>
//                     <input
//                       type="text"
//                       placeholder="Search name, SKU or barcode..."
//                       value={sourceSearch}
//                       onChange={(event) => setSourceSearch(event.target.value)}
//                       className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
//                     />
//                   </div>

//                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
//                     {filteredSourceProducts.length === 0 ? (
//                       <p className="py-8 text-center text-xs text-slate-500">
//                         No matching products.
//                       </p>
//                     ) : (
//                       filteredSourceProducts.map((product) => {
//                         const variants = getVariants(product);
//                         return (
//                           <div
//                             key={product.id}
//                             className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
//                           >
//                             <div className="mb-2 flex items-center justify-between gap-2">
//                               <span className="truncate text-xs font-bold text-white">
//                                 {product.name}
//                               </span>
//                               <span className="shrink-0 text-[10px] text-slate-500">
//                                 {product.sku}
//                               </span>
//                             </div>

//                             {variants.length === 0 ? (
//                               <p className="text-[10px] italic text-slate-500">
//                                 No options available
//                               </p>
//                             ) : (
//                               <div className="space-y-1.5">
//                                 {variants.map((variant) => {
//                                   const cost = Number(
//                                     variant.costPrice ??
//                                       variant.unitCost ??
//                                       product.costPrice ??
//                                       0,
//                                   );
//                                   return (
//                                     <div
//                                       key={variant.id}
//                                       className="flex items-center justify-between gap-2 rounded-md border-t border-slate-800/60 pt-1.5 text-[11px] first:border-t-0 first:pt-0"
//                                     >
//                                       <div className="min-w-0 flex-1">
//                                         <p className="truncate text-slate-300">
//                                           {variant.name}
//                                         </p>
//                                         <p className="text-[10px] text-slate-500">
//                                           Cost ref: {cost.toLocaleString()} MMK
//                                         </p>
//                                       </div>
//                                       <button
//                                         type="button"
//                                         onClick={() =>
//                                           addPoItem(
//                                             product.id,
//                                             variant.id,
//                                             1,
//                                             cost,
//                                           )
//                                         }
//                                         className="shrink-0 rounded-md bg-violet-500/20 px-2 py-1 font-bold text-violet-300 transition-colors hover:bg-violet-500/30"
//                                       >
//                                         Add
//                                       </button>
//                                     </div>
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })
//                     )}
//                   </div>
//                 </div>

//                 {/* Middle: arrows */}
//                 <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
//                   <ArrowRight className="h-6 w-6 text-violet-400" />
//                   <span className="text-center text-[10px] font-bold uppercase tracking-wider text-violet-400">
//                     to
//                     <br />
//                     order
//                   </span>
//                   <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
//                 </div>

//                 {/* Right: PO items */}
//                 <div className="flex max-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
//                   <div className="border-b border-slate-800 bg-slate-900 p-3">
//                     <div className="flex items-center justify-between">
//                       <h3 className="text-sm font-bold text-white">
//                         Purchase order
//                       </h3>
//                       <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
//                         List
//                       </span>
//                     </div>
//                     <p className="mt-0.5 text-[10px] text-slate-500">
//                       Items in this purchase
//                     </p>
//                   </div>

//                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
//                     {poItems.length === 0 ? (
//                       <div className="flex h-full flex-col items-center justify-center py-10 text-center">
//                         <Package className="mb-3 h-8 w-8 text-slate-700" />
//                         <p className="text-xs text-slate-500">No items yet.</p>
//                         <p className="mt-1 text-[10px] text-slate-600">
//                           Add products from the left panel.
//                         </p>
//                       </div>
//                     ) : (
//                       poItems.map((item) => {
//                         const product = products.find(
//                           (p) => p.id === item.productId,
//                         );
//                         const variant = getVariants(product).find(
//                           (v) => v.id === item.variantId,
//                         );
//                         return (
//                           <div
//                             key={`${item.productId}:${item.variantId}`}
//                             className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
//                           >
//                             <div className="flex items-start justify-between gap-2">
//                               <div className="min-w-0 flex-1">
//                                 <p className="truncate text-xs font-bold text-slate-200">
//                                   {product?.name || "Product"}
//                                 </p>
//                                 <p className="truncate text-[10px] text-slate-500">
//                                   {variant?.name || "Option"}
//                                 </p>
//                               </div>
//                               <button
//                                 type="button"
//                                 onClick={() =>
//                                   removePoItem(item.productId, item.variantId)
//                                 }
//                                 className="shrink-0 rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
//                               >
//                                 <X className="h-3.5 w-3.5" />
//                               </button>
//                             </div>
//                             <div className="mt-2 grid grid-cols-2 gap-2">
//                               <label className="text-[10px] text-slate-400">
//                                 Qty
//                                 <input
//                                   type="number"
//                                   min="1"
//                                   value={item.quantity}
//                                   onChange={(event) =>
//                                     updatePoItemQty(
//                                       item.productId,
//                                       item.variantId,
//                                       Number(event.target.value),
//                                     )
//                                   }
//                                   className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
//                                 />
//                               </label>
//                               <label className="text-[10px] text-slate-400">
//                                 Cost
//                                 <input
//                                   type="number"
//                                   min="0"
//                                   step="0.01"
//                                   value={item.unitCost}
//                                   onChange={(event) =>
//                                     updatePoItemCost(
//                                       item.productId,
//                                       item.variantId,
//                                       Number(event.target.value),
//                                     )
//                                   }
//                                   className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
//                                 />
//                               </label>
//                             </div>
//                             <p className="mt-2 text-right text-[10px] text-slate-400">
//                               Line:{" "}
//                               <span className="font-bold text-white">
//                                 {(
//                                   item.quantity * item.unitCost
//                                 ).toLocaleString()}{" "}
//                                 MMK
//                               </span>
//                             </p>
//                           </div>
//                         );
//                       })
//                     )}
//                   </div>

//                   {poItems.length > 0 && (
//                     <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
//                       <div className="flex justify-between">
//                         <span>Lines:</span>
//                         <span className="font-bold text-white">
//                           {poItems.length}
//                         </span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span>Total units:</span>
//                         <span className="font-bold text-white">
//                           {poTotalUnits}
//                         </span>
//                       </div>
//                       <div className="mt-1 flex justify-between border-t border-slate-800 pt-1">
//                         <span>Subtotal:</span>
//                         <span className="font-bold text-emerald-300">
//                           {poSubtotal.toLocaleString()} MMK
//                         </span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <div className="grid gap-3 sm:grid-cols-2">
//                 <Field
//                   label="Expected date"
//                   type="date"
//                   value={fields.expectedDate}
//                   onChange={(value) =>
//                     setFields({ ...fields, expectedDate: value })
//                   }
//                 />
//                 <Field
//                   label="Notes"
//                   value={fields.notes}
//                   onChange={(value) => setFields({ ...fields, notes: value })}
//                 />
//               </div>

//               <ErrorNote message={formError} />
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
//             <div className="space-y-4">
//               <ChoiceCards
//                 label="Destination"
//                 value={fields.toStoreId}
//                 onChange={(value) =>
//                   setFields((current) => ({ ...current, toStoreId: value }))
//                 }
//                 columns={3}
//                 options={transferDestinationStores
//                   .filter((item) => item.id !== selectedStoreId)
//                   .map((item) => ({
//                     value: item.id,
//                     label: item.name,
//                     description: "Receiving branch",
//                   }))}
//               />

//               <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
//                 {/* Left: source stock */}
//                 <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
//                   <div className="border-b border-slate-800 bg-slate-900 p-3">
//                     <div className="flex items-center justify-between">
//                       <h3 className="text-sm font-bold text-white">
//                         Store 1:{" "}
//                         {stores.find((item) => item.id === selectedStoreId)
//                           ?.name || "Source"}
//                       </h3>
//                       <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
//                         List & stock
//                       </span>
//                     </div>
//                     <input
//                       type="text"
//                       placeholder="Search name, SKU or barcode..."
//                       value={sourceSearch}
//                       onChange={(event) => setSourceSearch(event.target.value)}
//                       className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
//                     />
//                   </div>

//                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
//                     {filteredSourceProducts.length === 0 ? (
//                       <p className="py-8 text-center text-xs text-slate-500">
//                         No matching products.
//                       </p>
//                     ) : (
//                       filteredSourceProducts.map((product) => {
//                         const variants = getVariants(product);
//                         return (
//                           <div
//                             key={product.id}
//                             className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
//                           >
//                             <div className="mb-2 flex items-center justify-between gap-2">
//                               <span className="truncate text-xs font-bold text-white">
//                                 {product.name}
//                               </span>
//                               <span className="shrink-0 text-[10px] text-slate-500">
//                                 {product.sku}
//                               </span>
//                             </div>

//                             {variants.length === 0 ? (
//                               <p className="text-[10px] italic text-slate-500">
//                                 No options available
//                               </p>
//                             ) : (
//                               <div className="space-y-1.5">
//                                 {variants.map((variant) => {
//                                   const stock = Number(
//                                     variant.availableStock ??
//                                       variant.stock ??
//                                       0,
//                                   );
//                                   const inCart =
//                                     transferItems.find(
//                                       (item) => item.variantId === variant.id,
//                                     )?.quantity || 0;
//                                   const remaining = stock - inCart;
//                                   const disabled =
//                                     remaining <= 0 || !fields.toStoreId;

//                                   return (
//                                     <div
//                                       key={variant.id}
//                                       className="flex items-center justify-between gap-2 rounded-md border-t border-slate-800/60 pt-1.5 text-[11px] first:border-t-0 first:pt-0"
//                                     >
//                                       <div className="min-w-0 flex-1">
//                                         <p className="truncate text-slate-300">
//                                           {variant.name}
//                                         </p>
//                                         <p className="text-[10px] text-slate-500">
//                                           {stock} in stock
//                                           {inCart > 0 && (
//                                             <span className="text-sky-400">
//                                               {" "}
//                                               · {inCart} added
//                                             </span>
//                                           )}
//                                         </p>
//                                       </div>
//                                       <button
//                                         type="button"
//                                         onClick={() =>
//                                           addTransferItem(
//                                             product.id,
//                                             variant.id,
//                                             1,
//                                           )
//                                         }
//                                         disabled={disabled}
//                                         className="shrink-0 rounded-md bg-violet-500/20 px-2 py-1 font-bold text-violet-300 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-30"
//                                       >
//                                         Add
//                                       </button>
//                                     </div>
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })
//                     )}
//                   </div>
//                 </div>

//                 {/* Middle: arrows */}
//                 <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
//                   <ArrowRight className="h-6 w-6 text-sky-400" />
//                   <span className="text-center text-[10px] font-bold uppercase tracking-wider text-sky-400">
//                     to
//                     <br />
//                     transfer
//                   </span>
//                   <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
//                 </div>

//                 {/* Right: transfer list */}
//                 <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
//                   <div className="border-b border-slate-800 bg-slate-900 p-3">
//                     <div className="flex items-center justify-between">
//                       <h3 className="text-sm font-bold text-white">
//                         Store 2:{" "}
//                         {stores.find((item) => item.id === fields.toStoreId)
//                           ?.name || "Destination"}
//                       </h3>
//                       <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
//                         List
//                       </span>
//                     </div>
//                   </div>

//                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
//                     {transferItems.length === 0 ? (
//                       <div className="flex h-full flex-col items-center justify-center py-10 text-center">
//                         <ArrowLeftRight className="mb-3 h-8 w-8 text-slate-700" />
//                         <p className="text-xs text-slate-500">No items yet.</p>
//                       </div>
//                     ) : (
//                       transferItems.map((item) => {
//                         const product = products.find(
//                           (p) => p.id === item.productId,
//                         );
//                         const variant = getVariants(product).find(
//                           (v) => v.id === item.variantId,
//                         );
//                         return (
//                           <div
//                             key={`${item.productId}:${item.variantId}`}
//                             className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
//                           >
//                             <div className="min-w-0 flex-1">
//                               <p className="truncate text-xs font-bold text-slate-200">
//                                 {product?.name || "Product"}
//                               </p>
//                               <p className="truncate text-[10px] text-slate-500">
//                                 {variant?.name || "Option"}
//                               </p>
//                             </div>
//                             <div className="flex shrink-0 items-center gap-1.5">
//                               <input
//                                 type="number"
//                                 min="1"
//                                 value={item.quantity}
//                                 onChange={(event) =>
//                                   updateTransferItemQuantity(
//                                     item.productId,
//                                     item.variantId,
//                                     Number(event.target.value),
//                                   )
//                                 }
//                                 className="w-12 rounded-md border border-slate-700 bg-slate-950 py-1 text-center text-[11px] text-white outline-none focus:border-violet-500"
//                               />
//                               <button
//                                 type="button"
//                                 onClick={() =>
//                                   removeTransferItem(
//                                     item.productId,
//                                     item.variantId,
//                                   )
//                                 }
//                                 className="rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
//                               >
//                                 <X className="h-3.5 w-3.5" />
//                               </button>
//                             </div>
//                           </div>
//                         );
//                       })
//                     )}
//                   </div>

//                   {transferItems.length > 0 && (
//                     <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
//                       <div className="flex justify-between">
//                         <span>Total options:</span>
//                         <span className="font-bold text-white">
//                           {transferItems.length}
//                         </span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span>Total units:</span>
//                         <span className="font-bold text-white">
//                           {transferTotalUnits}
//                         </span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <Field
//                 label="Notes"
//                 value={fields.notes}
//                 onChange={(value) => setFields({ ...fields, notes: value })}
//               />

//               <ErrorNote message={formError} />
//             </div>
//           ) : module === "returns" ? (
//             /* ============================================================ */
//             /*  RETURNS — Two-panel                                          */
//             /* ============================================================ */
//             <div className="space-y-4">
//               <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
//                 {/* Left: orders */}
//                 <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
//                   <div className="border-b border-slate-800 bg-slate-900 p-3">
//                     <div className="flex items-center justify-between">
//                       <h3 className="text-sm font-bold text-white">
//                         Recent orders
//                       </h3>
//                       <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
//                         Pick one
//                       </span>
//                     </div>
//                     <p className="mt-0.5 text-[10px] text-slate-500">
//                       Completed or paid orders only
//                     </p>
//                   </div>

//                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
//                     {returnableOrders.length === 0 ? (
//                       <p className="py-8 text-center text-xs text-slate-500">
//                         No completed orders to return.
//                       </p>
//                     ) : (
//                       returnableOrders.map((order) => {
//                         const selected = fields.orderId === order.id;
//                         return (
//                           <button
//                             key={order.id}
//                             type="button"
//                             onClick={() => {
//                               setFields((current) => ({
//                                 ...current,
//                                 orderId: order.id,
//                               }));
//                               setReturnItems([]);
//                             }}
//                             className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
//                               selected
//                                 ? "border-violet-400/60 bg-violet-500/10 text-white"
//                                 : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700"
//                             }`}
//                           >
//                             <div className="min-w-0">
//                               <p className="truncate font-bold">
//                                 {order.orderNumber || order.id.slice(0, 8)}
//                               </p>
//                               <p className="mt-0.5 text-[10px] text-slate-500">
//                                 {new Date(order.createdAt).toLocaleDateString()}{" "}
//                                 · {order.items?.length || 0} items
//                               </p>
//                             </div>
//                             <span className="shrink-0 text-[11px] font-bold text-violet-200">
//                               {amount(order.grandTotal)}
//                             </span>
//                           </button>
//                         );
//                       })
//                     )}
//                   </div>
//                 </div>

//                 {/* Middle: arrows */}
//                 <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
//                   <ArrowRight className="h-6 w-6 text-violet-400" />
//                   <span className="text-center text-[10px] font-bold uppercase tracking-wider text-violet-400">
//                     to
//                     <br />
//                     return
//                   </span>
//                   <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
//                 </div>

//                 {/* Right: return items */}
//                 <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
//                   <div className="border-b border-slate-800 bg-slate-900 p-3">
//                     <div className="flex items-center justify-between">
//                       <h3 className="text-sm font-bold text-white">
//                         Return items
//                       </h3>
//                       <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
//                         List
//                       </span>
//                     </div>
//                     <p className="mt-0.5 text-[10px] text-slate-500">
//                       Items chosen to refund
//                     </p>
//                   </div>

//                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
//                     {!selectedOrder ? (
//                       <div className="flex h-full flex-col items-center justify-center py-10 text-center">
//                         <Undo2 className="mb-3 h-8 w-8 text-slate-700" />
//                         <p className="text-xs text-slate-500">
//                           Pick an order first.
//                         </p>
//                       </div>
//                     ) : returnItems.length === 0 ? (
//                       <div className="space-y-2">
//                         <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">
//                           Tap an item to add it
//                         </p>
//                         {(selectedOrder.items || []).map((item) => {
//                           const remaining =
//                             item.quantity - Number(item.returnedQuantity || 0);
//                           const disabled = remaining <= 0;
//                           return (
//                             <button
//                               key={item.id}
//                               type="button"
//                               onClick={() => addReturnItem(item)}
//                               disabled={disabled}
//                               className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-left text-xs transition-colors hover:border-violet-400/60 hover:bg-violet-500/5 disabled:cursor-not-allowed disabled:opacity-40"
//                             >
//                               <div className="min-w-0">
//                                 <p className="truncate font-bold text-slate-200">
//                                   {item.product?.name}
//                                 </p>
//                                 <p className="mt-0.5 text-[10px] text-slate-500">
//                                   Qty {item.quantity} · Returnable {remaining}
//                                 </p>
//                               </div>
//                               <span className="shrink-0 text-[10px] font-bold text-violet-300">
//                                 {amount(item.unitPrice || 0)}
//                               </span>
//                             </button>
//                           );
//                         })}
//                       </div>
//                     ) : (
//                       returnItems.map((item) => (
//                         <div
//                           key={item.orderItemId}
//                           className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
//                         >
//                           <div className="flex items-start justify-between gap-2">
//                             <div className="min-w-0 flex-1">
//                               <p className="truncate text-xs font-bold text-slate-200">
//                                 {item.productName}
//                               </p>
//                               {item.variantName && (
//                                 <p className="truncate text-[10px] text-slate-500">
//                                   {item.variantName}
//                                 </p>
//                               )}
//                             </div>
//                             <button
//                               type="button"
//                               onClick={() => removeReturnItem(item.orderItemId)}
//                               className="shrink-0 rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10"
//                             >
//                               <X className="h-3.5 w-3.5" />
//                             </button>
//                           </div>

//                           <div className="mt-2 grid grid-cols-2 gap-2">
//                             <label className="text-[10px] text-slate-400">
//                               Qty
//                               <input
//                                 type="number"
//                                 min="1"
//                                 value={item.quantity}
//                                 onChange={(event) =>
//                                   updateReturnItem(item.orderItemId, {
//                                     quantity: Math.max(
//                                       1,
//                                       Number(event.target.value),
//                                     ),
//                                   })
//                                 }
//                                 className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
//                               />
//                             </label>
//                             <div className="text-[10px] text-slate-400">
//                               Refund
//                               <p className="mt-1.5 text-[11px] font-bold text-emerald-300">
//                                 {item.refundAmount.toLocaleString()} MMK
//                               </p>
//                             </div>
//                           </div>

//                           <label className="mt-2 block text-[10px] text-slate-400">
//                             Reason
//                             <input
//                               type="text"
//                               value={item.reason}
//                               onChange={(event) =>
//                                 updateReturnItem(item.orderItemId, {
//                                   reason: event.target.value,
//                                 })
//                               }
//                               placeholder="e.g. damaged, wrong size"
//                               className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
//                             />
//                           </label>
//                         </div>
//                       ))
//                     )}
//                   </div>

//                   {returnItems.length > 0 && (
//                     <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
//                       <div className="flex justify-between">
//                         <span>Items:</span>
//                         <span className="font-bold text-white">
//                           {returnItems.length}
//                         </span>
//                       </div>
//                       <div className="mt-1 flex justify-between border-t border-slate-800 pt-1">
//                         <span>Refund total:</span>
//                         <span className="font-bold text-emerald-300">
//                           {returnRefundTotal.toLocaleString()} MMK
//                         </span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

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

//               <ErrorNote message={formError} />
//             </div>
//           ) : null}

//           {!(module === "transfers" && !categoryDialog) &&
//             !(module === "purchasing" && !categoryDialog) &&
//             !(module === "returns" && !categoryDialog) && (
//               <ErrorNote message={formError} />
//             )}

//           <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
//             <button
//               type="button"
//               onClick={() => {
//                 setDialog(false);
//                 setCategoryDialog(false);
//               }}
//               disabled={saving}
//               className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:py-2.5"
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               disabled={
//                 saving ||
//                 (module === "transfers" &&
//                   !categoryDialog &&
//                   (transferItems.length === 0 || !fields.toStoreId)) ||
//                 (module === "purchasing" &&
//                   !categoryDialog &&
//                   poItems.length === 0) ||
//                 (module === "returns" &&
//                   !categoryDialog &&
//                   returnItems.length === 0)
//               }
//               className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
//             >
//               {saving && <Loader2 className="h-4 w-4 animate-spin" />}
//               {saving
//                 ? "Saving…"
//                 : module === "transfers"
//                   ? `Send stock${transferTotalUnits ? ` (${transferTotalUnits})` : ""}`
//                   : module === "purchasing"
//                     ? `Create PO${poItems.length ? ` (${poItems.length})` : ""}`
//                     : module === "returns"
//                       ? `Process return${returnItems.length ? ` (${returnItems.length})` : ""}`
//                       : "Save"}
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
//   const onCloseRef = useRef(onClose);

//   useEffect(() => {
//     onCloseRef.current = onClose;
//   }, [onClose]);

//   useEffect(() => {
//     if (!open) return;

//     const handleKey = (event: KeyboardEvent) => {
//       if (event.key === "Escape") onCloseRef.current();
//     };
//     document.addEventListener("keydown", handleKey);

//     const previousOverflow = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     panelRef.current?.focus();

//     return () => {
//       document.removeEventListener("keydown", handleKey);
//       document.body.style.overflow = previousOverflow;
//     };
//   }, [open]);

//   if (!open) return null;

//   return createPortal(
//     <div
//       className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
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
//         className={`max-h-[96dvh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-2xl sm:p-6`}
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

// /* ------------------------------------------------------------------ */
// /*  Reports — Tabs + Date range + Area chart                           */
// /* ------------------------------------------------------------------ */

// type ReportTab = "overview" | "sales" | "expenses" | "purchasing";
// type RangeKey = "today" | "7d" | "30d" | "90d";

// function startOfRange(range: RangeKey): Date {
//   const d = new Date();
//   d.setHours(0, 0, 0, 0);
//   if (range === "today") return d;
//   if (range === "7d") {
//     d.setDate(d.getDate() - 6);
//     return d;
//   }
//   if (range === "30d") {
//     d.setDate(d.getDate() - 29);
//     return d;
//   }
//   d.setDate(d.getDate() - 89);
//   return d;
// }

// function Reports({
//   orders,
//   expenses,
//   purchaseOrders,
//   returns,
// }: {
//   orders: ApiOrder[];
//   expenses: any[];
//   purchaseOrders: any[];
//   returns: any[];
// }) {
//   const [tab, setTab] = useState<ReportTab>("overview");
//   const [range, setRange] = useState<RangeKey>("7d");

//   const from = useMemo(() => startOfRange(range), [range]);

//   const inRange = (date?: string) => (date ? new Date(date) >= from : false);

//   const filteredOrders = orders.filter(
//     (order) =>
//       inRange(order.createdAt) &&
//       (order.status === "COMPLETED" || order.paymentStatus === "PAID"),
//   );
//   const filteredExpenses = expenses.filter((e) => inRange(e.expenseDate));
//   const filteredPurchases = purchaseOrders.filter(
//     (po) => inRange(po.orderDate) && po.status === "RECEIVED",
//   );
//   const filteredReturns = returns.filter((r) => inRange(r.createdAt));

//   const revenue = filteredOrders.reduce((s, o) => s + o.grandTotal, 0);
//   const expenseTotal = filteredExpenses.reduce(
//     (s, e) => s + Number(e.amount || 0),
//     0,
//   );
//   const purchaseTotal = filteredPurchases.reduce(
//     (s, po) => s + Number(po.grandTotal || 0),
//     0,
//   );
//   const refundTotal = filteredReturns.reduce(
//     (s, r) => s + Number(r.totalAmount || 0),
//     0,
//   );
//   const netRevenue = revenue - refundTotal;

//   const days =
//     range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;

//   const series = useMemo(
//     () =>
//       Array.from({ length: days }, (_, i) => {
//         const day = new Date(from);
//         day.setDate(day.getDate() + i);
//         const dayKey = day.toDateString();
//         const dayTotal = filteredOrders
//           .filter((o) => new Date(o.createdAt).toDateString() === dayKey)
//           .reduce((s, o) => s + o.grandTotal, 0);
//         return {
//           label:
//             days <= 7
//               ? day.toLocaleDateString(undefined, { weekday: "short" })
//               : day.toLocaleDateString(undefined, {
//                   month: "short",
//                   day: "numeric",
//                 }),
//           amount: dayTotal,
//         };
//       }),
//     [days, from, filteredOrders],
//   );

//   const cards = [
//     {
//       label: "Net revenue",
//       value: amount(netRevenue),
//       detail: `${filteredOrders.length} orders · ${filteredReturns.length} returns`,
//       icon: Wallet,
//       tone: "text-emerald-300 bg-emerald-400/10",
//     },
//     {
//       label: "Expenses",
//       value: amount(expenseTotal),
//       detail: `${filteredExpenses.length} records`,
//       icon: Receipt,
//       tone: "text-rose-300 bg-rose-400/10",
//     },
//     {
//       label: "Purchasing",
//       value: amount(purchaseTotal),
//       detail: `${filteredPurchases.length} POs received`,
//       icon: Truck,
//       tone: "text-sky-300 bg-sky-400/10",
//     },
//     {
//       label: "Refunds",
//       value: amount(refundTotal),
//       detail: `${filteredReturns.length} returns`,
//       icon: Undo2,
//       tone: "text-amber-300 bg-amber-400/10",
//     },
//   ];

//   const tabs: { id: ReportTab; label: string }[] = [
//     { id: "overview", label: "Overview" },
//     { id: "sales", label: "Sales" },
//     { id: "expenses", label: "Expenses" },
//     { id: "purchasing", label: "Purchasing" },
//   ];

//   const ranges: { id: RangeKey; label: string }[] = [
//     { id: "today", label: "Today" },
//     { id: "7d", label: "7 days" },
//     { id: "30d", label: "30 days" },
//     { id: "90d", label: "90 days" },
//   ];

//   return (
//     <div className="space-y-4">
//       <section className="flex flex-wrap items-center justify-between gap-3">
//         <div className="flex flex-wrap gap-2">
//           {tabs.map((t) => (
//             <button
//               key={t.id}
//               type="button"
//               onClick={() => setTab(t.id)}
//               className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
//                 tab === t.id
//                   ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
//                   : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
//               }`}
//             >
//               {t.label}
//             </button>
//           ))}
//         </div>
//         <div className="flex flex-wrap gap-2">
//           {ranges.map((r) => (
//             <button
//               key={r.id}
//               type="button"
//               onClick={() => setRange(r.id)}
//               className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${
//                 range === r.id
//                   ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
//                   : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
//               }`}
//             >
//               {r.label}
//             </button>
//           ))}
//         </div>
//       </section>

//       <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
//         {cards.map(({ label, value, detail, icon: Icon, tone }) => (
//           <article
//             key={label}
//             className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
//           >
//             <div className="flex items-center justify-between">
//               <span className="text-sm text-slate-400">{label}</span>
//               <span className={`rounded-xl p-2 ${tone}`}>
//                 <Icon className="h-5 w-5" />
//               </span>
//             </div>
//             <p className="mt-5 text-2xl font-black text-white">{value}</p>
//             <p className="mt-1 text-xs text-slate-500">{detail}</p>
//           </article>
//         ))}
//       </section>

//       {(tab === "overview" || tab === "sales") && (
//         <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
//           <div className="mb-4 flex items-center justify-between">
//             <div>
//               <h2 className="font-bold text-white">Revenue trend</h2>
//               <p className="mt-1 text-xs text-slate-500">
//                 {range === "today" ? "Today" : `Last ${days} days`}
//               </p>
//             </div>
//             <BarChart3 className="h-5 w-5 text-sky-300" />
//           </div>
//           {series.length === 1 ? (
//             <div className="grid h-48 place-items-center rounded-xl bg-slate-950/70">
//               <div className="text-center">
//                 <p className="text-xs text-slate-500">Today's revenue</p>
//                 <p className="mt-1 text-3xl font-black text-sky-300">
//                   {amount(series[0].amount)}
//                 </p>
//               </div>
//             </div>
//           ) : (
//             <AreaChart data={series} height={220} />
//           )}
//         </article>
//       )}

//       {tab === "overview" && (
//         <div className="grid gap-4 xl:grid-cols-2">
//           <SimpleList
//             title="Top selling products"
//             emptyText="No sales in this range"
//             rows={filteredOrders
//               .flatMap((o) => o.items || [])
//               .reduce<
//                 Record<string, { name: string; qty: number; total: number }>
//               >((acc, item: any) => {
//                 const key = item.product?.id || item.productId || "unknown";
//                 if (!acc[key])
//                   acc[key] = {
//                     name: item.product?.name || "Product",
//                     qty: 0,
//                     total: 0,
//                   };
//                 acc[key].qty += item.quantity || 0;
//                 acc[key].total +=
//                   (item.quantity || 0) * Number(item.unitPrice || 0);
//                 return acc;
//               }, {})}
//             map={(v) => ({
//               left: v.name,
//               right: `${v.qty} × · ${amount(v.total)}`,
//             })}
//           />
//           <SimpleList
//             title="Expenses by category"
//             emptyText="No expenses in this range"
//             rows={filteredExpenses.reduce<
//               Record<string, { name: string; total: number; count: number }>
//             >((acc, e) => {
//               const key = e.category?.id || e.categoryId || "unknown";
//               if (!acc[key])
//                 acc[key] = {
//                   name: e.category?.name || "Uncategorized",
//                   total: 0,
//                   count: 0,
//                 };
//               acc[key].total += Number(e.amount || 0);
//               acc[key].count += 1;
//               return acc;
//             }, {})}
//             map={(v) => ({
//               left: `${v.name} (${v.count})`,
//               right: amount(v.total),
//             })}
//           />
//         </div>
//       )}

//       {tab === "expenses" && (
//         <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
//           <h2 className="mb-3 font-bold text-white">Expense records</h2>
//           {filteredExpenses.length === 0 ? (
//             <p className="py-6 text-center text-sm text-slate-500">
//               No expenses in this range.
//             </p>
//           ) : (
//             <div className="divide-y divide-slate-800">
//               {filteredExpenses.slice(0, 20).map((e: any) => (
//                 <div
//                   key={e.id}
//                   className="flex items-center justify-between gap-4 py-3 text-xs"
//                 >
//                   <div className="min-w-0">
//                     <p className="truncate font-semibold text-slate-200">
//                       {e.category?.name || "Uncategorized"}
//                     </p>
//                     <p className="truncate text-[11px] text-slate-500">
//                       {e.description || "—"} · {dateText(e.expenseDate)}
//                     </p>
//                   </div>
//                   <span className="shrink-0 font-bold text-white">
//                     {amount(e.amount)}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}
//         </article>
//       )}

//       {tab === "purchasing" && (
//         <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
//           <h2 className="mb-3 font-bold text-white">
//             Received purchase orders
//           </h2>
//           {filteredPurchases.length === 0 ? (
//             <p className="py-6 text-center text-sm text-slate-500">
//               No received POs in this range.
//             </p>
//           ) : (
//             <div className="divide-y divide-slate-800">
//               {filteredPurchases.slice(0, 20).map((po: any) => (
//                 <div
//                   key={po.id}
//                   className="flex items-center justify-between gap-4 py-3 text-xs"
//                 >
//                   <div className="min-w-0">
//                     <p className="truncate font-semibold text-slate-200">
//                       {po.poNumber} · {po.supplier?.name || "Supplier"}
//                     </p>
//                     <p className="truncate text-[11px] text-slate-500">
//                       {po.store?.name} · {dateText(po.orderDate)}
//                     </p>
//                   </div>
//                   <span className="shrink-0 font-bold text-white">
//                     {amount(po.grandTotal)}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}
//         </article>
//       )}

//       <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
//         Operational summary only. Not a full P&amp;L statement — taxes,
//         liabilities and accounting journals are not reconciled here.
//       </p>
//     </div>
//   );
// }

// /* ---------- Simple helper list for Reports ---------- */

// function SimpleList({
//   title,
//   rows,
//   emptyText,
//   map,
// }: {
//   title: string;
//   rows: Record<string, any>;
//   emptyText: string;
//   map: (value: any) => { left: string; right: string };
// }) {
//   const list = Object.entries(rows)
//     .map(([k, v]) => ({ key: k, ...map(v) }))
//     .sort((a, b) => b.right.localeCompare(a.right))
//     .slice(0, 6);

//   return (
//     <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
//       <h2 className="mb-3 font-bold text-white">{title}</h2>
//       {list.length === 0 ? (
//         <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>
//       ) : (
//         <ul className="divide-y divide-slate-800">
//           {list.map((row) => (
//             <li
//               key={row.key}
//               className="flex items-center justify-between gap-3 py-2.5 text-xs"
//             >
//               <span className="min-w-0 truncate text-slate-300">
//                 {row.left}
//               </span>
//               <span className="shrink-0 font-bold text-white">{row.right}</span>
//             </li>
//           ))}
//         </ul>
//       )}
//     </article>
//   );
// }

// /* ---------- Pure SVG area chart ---------- */

// function AreaChart({
//   data,
//   height = 200,
// }: {
//   data: { label: string; amount: number }[];
//   height?: number;
// }) {
//   const [hover, setHover] = useState<number | null>(null);
//   const width = 600;
//   const padX = 24;
//   const padY = 20;
//   const innerW = width - padX * 2;
//   const innerH = height - padY * 2;
//   const max = Math.max(1, ...data.map((d) => d.amount));
//   const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

//   const points = data.map((d, i) => ({
//     x: padX + i * stepX,
//     y: padY + innerH - (d.amount / max) * innerH,
//     ...d,
//   }));

//   const linePath = points
//     .map((p, i, arr) => {
//       if (i === 0) return `M ${p.x} ${p.y}`;
//       const prev = arr[i - 1];
//       const cx = (prev.x + p.x) / 2;
//       return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
//     })
//     .join(" ");

//   const areaPath = `${linePath} L ${
//     points[points.length - 1].x
//   } ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`;

//   return (
//     <div className="relative mt-2">
//       <svg
//         viewBox={`0 0 ${width} ${height}`}
//         className="h-56 w-full overflow-visible"
//         preserveAspectRatio="none"
//         onMouseLeave={() => setHover(null)}
//       >
//         <defs>
//           <linearGradient id="areaFillErp" x1="0" y1="0" x2="0" y2="1">
//             <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
//             <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
//           </linearGradient>
//           <linearGradient id="areaStrokeErp" x1="0" y1="0" x2="1" y2="0">
//             <stop offset="0%" stopColor="#38bdf8" />
//             <stop offset="100%" stopColor="#34d399" />
//           </linearGradient>
//         </defs>

//         {[0, 0.25, 0.5, 0.75, 1].map((t) => {
//           const y = padY + innerH - t * innerH;
//           return (
//             <line
//               key={t}
//               x1={padX}
//               x2={padX + innerW}
//               y1={y}
//               y2={y}
//               stroke="#1e293b"
//               strokeWidth="1"
//               strokeDasharray="4 6"
//             />
//           );
//         })}

//         <path d={areaPath} fill="url(#areaFillErp)" />
//         <path
//           d={linePath}
//           fill="none"
//           stroke="url(#areaStrokeErp)"
//           strokeWidth="2.5"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />

//         {points.map((p, i) => (
//           <g key={p.label + i}>
//             <rect
//               x={p.x - stepX / 2}
//               y={padY}
//               width={stepX || innerW}
//               height={innerH}
//               fill="transparent"
//               onMouseEnter={() => setHover(i)}
//             />
//             <circle
//               cx={p.x}
//               cy={p.y}
//               r={hover === i ? 5 : 3}
//               fill="#0f172a"
//               stroke={hover === i ? "#34d399" : "#38bdf8"}
//               strokeWidth="2"
//             />
//           </g>
//         ))}
//       </svg>

//       <div className="mt-1 flex justify-between px-2">
//         {data.map((d, i) => (
//           <span
//             key={d.label + i}
//             className="text-[10px] text-slate-500"
//             style={{ flex: 1, textAlign: "center" }}
//           >
//             {d.label}
//           </span>
//         ))}
//       </div>

//       {hover !== null && (
//         <div
//           className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-center shadow-xl"
//           style={{
//             left: `${(points[hover].x / width) * 100}%`,
//             top: `${(points[hover].y / height) * 100}%`,
//           }}
//         >
//           <p className="text-[10px] text-slate-400">{points[hover].label}</p>
//           <p className="text-xs font-bold text-sky-300">
//             {amount(points[hover].amount)}
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// // // // the best
// // import {
// //   FormEvent,
// //   useCallback,
// //   useEffect,
// //   useMemo,
// //   useRef,
// //   useState,
// // } from "react";
// // import { createPortal } from "react-dom";
// // import {
// //   AlertTriangle,
// //   ArrowLeft,
// //   ArrowLeftRight,
// //   ArrowRight,
// //   BadgeDollarSign,
// //   CheckCircle2,
// //   ClipboardCheck,
// //   FileBarChart2,
// //   Loader2,
// //   Plus,
// //   Receipt,
// //   Truck,
// //   Undo2,
// //   X,
// // } from "lucide-react";
// // import { ApiOrder } from "../store/apiSlice";
// // import { Product } from "../types";
// // import { WorkflowGuide } from "./WorkflowGuide";
// // import { ChoiceCards } from "./ChoiceCards";

// // /* ------------------------------------------------------------------ */
// // /*  Types                                                              */
// // /* ------------------------------------------------------------------ */

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
// //   userRole?: string;
// //   stores: { id: string; name: string }[];
// //   transferDestinationStores: { id: string; name: string }[];
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

// // interface Toast {
// //   id: number;
// //   tone: "success" | "error";
// //   message: string;
// // }

// // interface TransferLine {
// //   productId: string;
// //   variantId: string;
// //   quantity: number;
// // }

// // /* ------------------------------------------------------------------ */
// // /*  Constants & helpers                                                */
// // /* ------------------------------------------------------------------ */

// // const MODULES: { id: Module; label: string; icon: typeof Truck }[] = [
// //   { id: "purchasing", label: "Purchasing", icon: Truck },
// //   { id: "expenses", label: "Expenses", icon: Receipt },
// //   { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
// //   { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
// //   { id: "returns", label: "Sales returns", icon: Undo2 },
// //   { id: "reports", label: "Reports", icon: FileBarChart2 },
// // ];

// // const COLUMNS: Record<Module, string[]> = {
// //   purchasing: [
// //     "PO number",
// //     "Supplier",
// //     "Store",
// //     "Order date",
// //     "Total",
// //     "Status",
// //     "Actions",
// //   ],
// //   expenses: ["Category", "Description", "Date", "Store", "Amount"],
// //   supplierPayments: ["Supplier", "Paid at", "Method", "Reference", "Amount"],
// //   transfers: [
// //     "Transfer",
// //     "From → To",
// //     "Requested",
// //     "Items",
// //     "Status",
// //     "Actions",
// //   ],
// //   returns: ["Return", "Order", "Customer", "Date", "Refund", "Status"],
// //   reports: [],
// // };

// // const PAYMENT_METHODS = [
// //   "CASH",
// //   "KBZ_PAY",
// //   "CB_PAY",
// //   "WAVE_PAY",
// //   "CARD",
// //   "BANK_TRANSFER",
// // ];

// // const RECEIVABLE_STATUSES = ["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"];
// // const RECEIVABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

// // const today = () => new Date().toISOString().slice(0, 10);

// // const initialFields = (): Fields => ({
// //   storeId: "",
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
// //   expenseDate: today(),
// //   paymentMethod: "CASH",
// //   referenceNumber: "",
// //   toStoreId: "",
// //   orderId: "",
// //   orderItemId: "",
// //   reason: "",
// //   refundMethod: "CASH",
// // });

// // const errorMessage = (error: unknown) => {
// //   if (typeof error === "string") return error;
// //   const value = error as { data?: { message?: string }; message?: string };
// //   return (
// //     value?.data?.message ||
// //     value?.message ||
// //     "The server could not save this operation."
// //   );
// // };

// // const dateText = (value?: string) =>
// //   value ? new Date(value).toLocaleString() : "—";

// // const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

// // const transferStatusLabel = (status: string) =>
// //   status === "RECEIVED"
// //     ? "Received"
// //     : status === "IN_TRANSIT"
// //       ? "On the way"
// //       : status === "PENDING"
// //         ? "Awaiting dispatch"
// //         : status === "APPROVED"
// //           ? "Ready to send"
// //           : status;

// // const getVariants = (product: Product | undefined): any[] => {
// //   const value = (product as { variants?: unknown } | undefined)?.variants;
// //   return Array.isArray(value) ? value : [];
// // };

// // /* ------------------------------------------------------------------ */
// // /*  Main view                                                          */
// // /* ------------------------------------------------------------------ */

// // export function ERPView(props: Props) {
// //   const {
// //     selectedStoreId,
// //     userRole,
// //     stores,
// //     transferDestinationStores,
// //     products,
// //     suppliers,
// //     orders,
// //     purchaseOrders,
// //     expenses,
// //     expenseCategories,
// //     supplierPayments,
// //     transfers,
// //     returns,
// //     loading,
// //     onCreatePurchaseOrder,
// //     onUpdatePurchaseOrder,
// //     onReceivePurchaseOrder,
// //     onCreateExpense,
// //     onCreateExpenseCategory,
// //     onCreateSupplierPayment,
// //     onCreateTransfer,
// //     onCompleteTransfer,
// //     onCreateReturn,
// //   } = props;

// //   /* ---------------------------- state ---------------------------- */

// //   const [module, setModule] = useState<Module>("purchasing");
// //   const [search, setSearch] = useState("");
// //   const [statusFilter, setStatusFilter] = useState("ALL");

// //   const [dialog, setDialog] = useState(false);
// //   const [fields, setFields] = useState<Fields>(initialFields);
// //   const [transferItems, setTransferItems] = useState<TransferLine[]>([]);
// //   const [sourceSearch, setSourceSearch] = useState("");
// //   const [formError, setFormError] = useState("");
// //   const [saving, setSaving] = useState(false);

// //   const [categoryDialog, setCategoryDialog] = useState(false);
// //   const [categoryName, setCategoryName] = useState("");

// //   const [receiveTarget, setReceiveTarget] = useState<any>(null);
// //   const [receiveStoreId, setReceiveStoreId] = useState("");
// //   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
// //   const [receiveLots, setReceiveLots] = useState<
// //     Record<string, { number: string; expiryDate: string }>
// //   >({});
// //   const [receiveError, setReceiveError] = useState("");
// //   const [receiving, setReceiving] = useState(false);

// //   const [transferTarget, setTransferTarget] = useState<any>(null);
// //   const [transferError, setTransferError] = useState("");
// //   const [completing, setCompleting] = useState(false);

// //   const [busyId, setBusyId] = useState<string | null>(null);

// //   const [toasts, setToasts] = useState<Toast[]>([]);
// //   const toastSeq = useRef(0);
// //   const toastTimers = useRef<number[]>([]);

// //   const pushToast = useCallback((tone: Toast["tone"], message: string) => {
// //     const id = ++toastSeq.current;
// //     setToasts((current) => [...current, { id, tone, message }]);
// //     const timer = window.setTimeout(
// //       () => setToasts((current) => current.filter((toast) => toast.id !== id)),
// //       5000,
// //     );
// //     toastTimers.current.push(timer);
// //   }, []);

// //   const dismissToast = useCallback((id: number) => {
// //     setToasts((current) => current.filter((toast) => toast.id !== id));
// //   }, []);

// //   useEffect(
// //     () => () => {
// //       toastTimers.current.forEach(window.clearTimeout);
// //     },
// //     [],
// //   );

// //   /* -------------------------- derived data ------------------------ */

// //   const selectedOrder = orders.find((order) => order.id === fields.orderId);
// //   const orderItem = selectedOrder?.items?.find(
// //     (item) => item.id === fields.orderItemId,
// //   );
// //   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
// //   const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
// //   const poTotal =
// //     Math.max(0, Math.floor(Number(fields.quantity) || 0)) *
// //     Number(fields.unitCost || 0);
// //   const isReturnable = (order: ApiOrder) =>
// //     order.status === "COMPLETED" || order.paymentStatus === "PAID";

// //   const transferTotalUnits = transferItems.reduce(
// //     (sum, item) => sum + item.quantity,
// //     0,
// //   );

// //   const filteredSourceProducts = useMemo(() => {
// //     const q = sourceSearch.trim().toLowerCase();
// //     if (!q) return products;
// //     return products.filter((product) => {
// //       if (
// //         product.name.toLowerCase().includes(q) ||
// //         (product.sku ?? "").toLowerCase().includes(q)
// //       )
// //         return true;
// //       return getVariants(product).some(
// //         (variant) =>
// //           (variant.name ?? "").toLowerCase().includes(q) ||
// //           (variant.sku ?? "").toLowerCase().includes(q),
// //       );
// //     });
// //   }, [products, sourceSearch]);

// //   const records = useMemo(() => {
// //     const values = (
// //       {
// //         purchasing: purchaseOrders,
// //         expenses: expenses,
// //         supplierPayments: supplierPayments,
// //         transfers: transfers,
// //         returns: returns,
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
// //         item.order?.orderNumber,
// //         item.supplier?.name,
// //         item.customer?.name,
// //         item.description,
// //         item.notes,
// //         item.reason,
// //         item.referenceNumber,
// //         item.category?.name,
// //         item.store?.name,
// //         item.fromStore?.name,
// //         item.toStore?.name,
// //         ...(item.items ?? []).flatMap((line: any) => [
// //           line.product?.name,
// //           line.product?.sku,
// //           line.variant?.name,
// //           line.variant?.sku,
// //         ]),
// //         item.status,
// //         item.refundStatus,
// //       ])
// //         .toLowerCase()
// //         .includes(normalized),
// //     );
// //   }, [
// //     module,
// //     purchaseOrders,
// //     expenses,
// //     supplierPayments,
// //     transfers,
// //     returns,
// //     search,
// //   ]);

// //   const statusOptions = useMemo(() => {
// //     if (
// //       module === "reports" ||
// //       module === "expenses" ||
// //       module === "supplierPayments"
// //     )
// //       return [];
// //     const set = new Set<string>();
// //     records.forEach((record: any) => {
// //       const status = module === "returns" ? record.refundStatus : record.status;
// //       if (status) set.add(status);
// //     });
// //     return ["ALL", ...Array.from(set).sort()];
// //   }, [records, module]);

// //   const visibleRecords = useMemo(() => {
// //     if (statusFilter === "ALL") return records;
// //     return records.filter((record: any) => {
// //       const status = module === "returns" ? record.refundStatus : record.status;
// //       return status === statusFilter;
// //     });
// //   }, [records, statusFilter, module]);

// //   const cols = COLUMNS[module];
// //   const gridStyle = useMemo(
// //     () => ({ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }),
// //     [cols.length],
// //   );

// //   /* ---------------------------- actions --------------------------- */

// //   const resetMessages = () => {
// //     setFormError("");
// //     setReceiveError("");
// //     setTransferError("");
// //   };

// //   const switchModule = (next: Module) => {
// //     setModule(next);
// //     setSearch("");
// //     setStatusFilter("ALL");
// //     resetMessages();
// //     setTransferItems([]);
// //     setSourceSearch("");
// //   };

// //   const openDialog = () => {
// //     const firstOrder = orders.find(isReturnable);
// //     const firstProduct = products[0];
// //     setFields({
// //       ...initialFields(),
// //       storeId: selectedStoreId || stores[0]?.id || "",
// //       supplierId: suppliers[0]?.id || "",
// //       productId: module === "transfers" ? "" : firstProduct?.id || "",
// //       variantId:
// //         module === "transfers" ? "" : getVariants(firstProduct)[0]?.id || "",
// //       categoryId: expenseCategories[0]?.id || "",
// //       toStoreId:
// //         transferDestinationStores.find((store) => store.id !== selectedStoreId)
// //           ?.id || "",
// //       orderId: firstOrder?.id || "",
// //       orderItemId: firstOrder?.items?.[0]?.id || "",
// //     });
// //     resetMessages();
// //     setTransferItems([]);
// //     setSourceSearch("");
// //     setDialog(true);
// //   };

// //   const addTransferItem = (
// //     productId: string,
// //     variantId: string,
// //     qty: number = 1,
// //   ) => {
// //     if (!fields.toStoreId) {
// //       setFormError("Choose a destination store first.");
// //       return;
// //     }
// //     const product = products.find((entry) => entry.id === productId);
// //     const variant = getVariants(product).find(
// //       (entry) => entry.id === variantId,
// //     );
// //     if (!product || !variant) return;

// //     const available = Number(variant.availableStock ?? variant.stock ?? 0);
// //     const existingQuantity =
// //       transferItems.find(
// //         (item) =>
// //           item.productId === product.id && item.variantId === variant.id,
// //       )?.quantity ?? 0;

// //     if (existingQuantity + qty > available) {
// //       setFormError(
// //         `Only ${available} unit(s) of ${product.name} · ${variant.name} are at the source store.`,
// //       );
// //       return;
// //     }

// //     setTransferItems((current) => {
// //       const index = current.findIndex(
// //         (item) =>
// //           item.productId === product.id && item.variantId === variant.id,
// //       );
// //       if (index < 0)
// //         return [
// //           ...current,
// //           { productId: product.id, variantId: variant.id, quantity: qty },
// //         ];
// //       return current.map((item, itemIndex) =>
// //         itemIndex === index ? { ...item, quantity: item.quantity + qty } : item,
// //       );
// //     });
// //     setFormError("");
// //   };

// //   const removeTransferItem = (productId: string, variantId: string) => {
// //     setTransferItems((current) =>
// //       current.filter(
// //         (item) => item.productId !== productId || item.variantId !== variantId,
// //       ),
// //     );
// //   };

// //   const updateTransferItemQuantity = (
// //     productId: string,
// //     variantId: string,
// //     qty: number,
// //   ) => {
// //     const next = Math.floor(qty);
// //     if (!Number.isFinite(next) || next < 1) {
// //       setFormError("Quantity must be at least 1.");
// //       return;
// //     }
// //     const product = products.find((entry) => entry.id === productId);
// //     const variant = getVariants(product).find(
// //       (entry) => entry.id === variantId,
// //     );
// //     const available = Number(variant?.availableStock ?? variant?.stock ?? 0);
// //     if (next > available) {
// //       setFormError(`Only ${available} unit(s) available.`);
// //       return;
// //     }
// //     setTransferItems((current) =>
// //       current.map((item) =>
// //         item.productId === productId && item.variantId === variantId
// //           ? { ...item, quantity: next }
// //           : item,
// //       ),
// //     );
// //     setFormError("");
// //   };

// //   const submit = async (event: FormEvent) => {
// //     event.preventDefault();
// //     setSaving(true);
// //     setFormError("");

// //     try {
// //       if (module === "purchasing") {
// //         if (
// //           !fields.storeId ||
// //           !fields.supplierId ||
// //           !fields.productId ||
// //           quantity < 1 ||
// //           fields.unitCost === "" ||
// //           Number(fields.unitCost) < 0
// //         ) {
// //           throw new Error(
// //             "Select a store, supplier, and product, and enter a valid quantity and unit cost.",
// //           );
// //         }
// //         const product = products.find(
// //           (entry) => entry.id === fields.productId,
// //         )!;
// //         const variants = getVariants(product);
// //         await onCreatePurchaseOrder({
// //           storeId: fields.storeId,
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
// //               variantId: fields.variantId || variants[0]?.id || null,
// //               quantity,
// //               unitCost: Number(fields.unitCost),
// //               totalCost: poTotal,
// //             },
// //           ],
// //         });
// //         pushToast("success", "Purchase order created as draft.");
// //       } else if (module === "expenses") {
// //         if (!selectedStoreId)
// //           throw new Error(
// //             "Select a store from the top bar before recording an expense.",
// //           );
// //         if (!fields.categoryId || Number(fields.amount) <= 0)
// //           throw new Error(
// //             "Select an expense category and enter an amount greater than zero.",
// //           );
// //         await onCreateExpense({
// //           storeId: selectedStoreId,
// //           categoryId: fields.categoryId,
// //           amount: Number(fields.amount),
// //           currencyCode: "MMK",
// //           description: fields.description || undefined,
// //           expenseDate: fields.expenseDate || undefined,
// //         });
// //         pushToast("success", "Expense recorded.");
// //       } else if (module === "supplierPayments") {
// //         if (!fields.supplierId || Number(fields.amount) <= 0)
// //           throw new Error("Select a supplier and enter a payment amount.");
// //         await onCreateSupplierPayment({
// //           supplierId: fields.supplierId,
// //           amount: Number(fields.amount),
// //           currencyCode: "MMK",
// //           paymentMethod: fields.paymentMethod,
// //           referenceNumber: fields.referenceNumber || undefined,
// //           note: fields.notes || undefined,
// //         });
// //         pushToast("success", "Supplier payment recorded.");
// //       } else if (module === "transfers") {
// //         if (!selectedStoreId)
// //           throw new Error("Select a source store from the top bar first.");
// //         if (!fields.toStoreId || transferItems.length === 0) {
// //           throw new Error(
// //             "Choose a destination store and add at least one item.",
// //           );
// //         }
// //         if (fields.toStoreId === selectedStoreId)
// //           throw new Error("Source and destination stores must be different.");
// //         for (const item of transferItems) {
// //           const product = products.find((entry) => entry.id === item.productId);
// //           const variant = getVariants(product).find(
// //             (entry) => entry.id === item.variantId,
// //           );
// //           if (!product || !variant)
// //             throw new Error(
// //               "One of the selected product options is no longer available. Remove it and add it again.",
// //             );
// //           const available = Number(
// //             variant.availableStock ?? variant.stock ?? 0,
// //           );
// //           if (item.quantity > available)
// //             throw new Error(
// //               `Only ${available} unit(s) of ${product.name} · ${variant.name} remain at the source store.`,
// //             );
// //         }
// //         await onCreateTransfer({
// //           fromStoreId: selectedStoreId,
// //           toStoreId: fields.toStoreId,
// //           notes: fields.notes || undefined,
// //           items: transferItems,
// //         });
// //         pushToast(
// //           "success",
// //           `Sent ${transferItems.length} product option(s). The destination store can confirm receipt.`,
// //         );
// //         setTransferItems([]);
// //       } else if (module === "returns") {
// //         if (!selectedOrder || !orderItem)
// //           throw new Error("Choose a completed order and an item to return.");
// //         if (quantity < 1 || !fields.reason.trim())
// //           throw new Error("Enter a quantity and a return reason.");
// //         const remaining =
// //           orderItem.quantity - Number(orderItem.returnedQuantity || 0);
// //         if (quantity > remaining) {
// //           throw new Error(
// //             `Only ${remaining} unit(s) remain returnable on this line.`,
// //           );
// //         }
// //         await onCreateReturn({
// //           orderId: selectedOrder.id,
// //           totalAmount: itemTotal,
// //           refundMethod: fields.refundMethod,
// //           refundStatus: "COMPLETED",
// //           reason: fields.reason.trim(),
// //           items: [
// //             {
// //               orderItemId: orderItem.id,
// //               quantity,
// //               refundAmount: itemTotal,
// //               reason: fields.reason.trim(),
// //             },
// //           ],
// //         });
// //         pushToast("success", "Sales return processed.");
// //       }

// //       setDialog(false);
// //     } catch (cause) {
// //       setFormError(errorMessage(cause));
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   const markOrdered = async (po: any) => {
// //     setBusyId(`po:${po.id}`);
// //     try {
// //       await onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
// //       pushToast("success", `${po.poNumber} marked as ordered.`);
// //     } catch (cause) {
// //       pushToast("error", errorMessage(cause));
// //     } finally {
// //       setBusyId(null);
// //     }
// //   };

// //   const openReceive = (po: any) => {
// //     const target = po.storeId || selectedStoreId || stores[0]?.id || "";
// //     setReceiveStoreId(target);
// //     setReceiveError("");
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
// //     if (!receiveTarget) return;
// //     const targetStore =
// //       receiveStoreId || selectedStoreId || stores[0]?.id || "";
// //     if (!targetStore) {
// //       setReceiveError("Select a store to receive the stock into.");
// //       return;
// //     }

// //     let lots:
// //       | { purchaseOrderItemId: string; number: string; expiryDate?: string }[]
// //       | undefined;

// //     if (trackReceivedLots) {
// //       const lines = (receiveTarget.items ?? []).map((item: any) => ({
// //         id: item.id,
// //         name: item.product?.name || "Product",
// //         number: (receiveLots[item.id]?.number ?? "").trim(),
// //         expiryDate: receiveLots[item.id]?.expiryDate || "",
// //       }));
// //       const missing = lines.find((line: any) => !line.number);
// //       if (missing) {
// //         setReceiveError(
// //           `Enter a batch / lot number for "${missing.name}", or turn lot tracking off.`,
// //         );
// //         return;
// //       }
// //       lots = lines.map((line: any) => ({
// //         purchaseOrderItemId: line.id,
// //         number: line.number,
// //         expiryDate: line.expiryDate || undefined,
// //       }));
// //     }

// //     setReceiving(true);
// //     setReceiveError("");
// //     try {
// //       await onReceivePurchaseOrder(receiveTarget.id, targetStore, lots);
// //       pushToast(
// //         "success",
// //         `${receiveTarget.poNumber} received. Inventory has been updated.`,
// //       );
// //       setReceiveTarget(null);
// //     } catch (cause) {
// //       setReceiveError(errorMessage(cause));
// //     } finally {
// //       setReceiving(false);
// //     }
// //   };

// //   const openCompleteTransfer = (transfer: any) => {
// //     setTransferError("");
// //     setTransferTarget(transfer);
// //   };

// //   const executeCompleteTransfer = async () => {
// //     if (!transferTarget) return;
// //     setCompleting(true);
// //     setTransferError("");
// //     try {
// //       await onCompleteTransfer(transferTarget.id);
// //       pushToast(
// //         "success",
// //         `Transfer ${transferTarget.transferNumber} received. Destination stock has been updated.`,
// //       );
// //       setTransferTarget(null);
// //     } catch (cause) {
// //       setTransferError(errorMessage(cause));
// //     } finally {
// //       setCompleting(false);
// //     }
// //   };

// //   const addExpenseCategory = async (event: FormEvent) => {
// //     event.preventDefault();
// //     const name = categoryName.trim();
// //     if (!name) {
// //       setFormError("Enter a category name.");
// //       return;
// //     }
// //     setSaving(true);
// //     setFormError("");
// //     try {
// //       await onCreateExpenseCategory(name);
// //       setCategoryDialog(false);
// //       setCategoryName("");
// //       pushToast("success", "Expense category created.");
// //     } catch (cause) {
// //       setFormError(errorMessage(cause));
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   /* ----------------------------- render --------------------------- */

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

// //       {/* Toasts */}
// //       <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-80 flex-col gap-2">
// //         {toasts.map((toast) => (
// //           <div
// //             key={toast.id}
// //             role="status"
// //             className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
// //               toast.tone === "success"
// //                 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
// //                 : "border-rose-500/30 bg-rose-500/10 text-rose-200"
// //             }`}
// //           >
// //             {toast.tone === "success" ? (
// //               <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
// //             ) : (
// //               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
// //             )}
// //             <span className="flex-1 leading-5">{toast.message}</span>
// //             <button
// //               type="button"
// //               aria-label="Dismiss notification"
// //               onClick={() => dismissToast(toast.id)}
// //               className="opacity-60 transition-opacity hover:opacity-100"
// //             >
// //               <X className="h-4 w-4" />
// //             </button>
// //           </div>
// //         ))}
// //       </div>

// //       <nav className="mb-5 flex flex-wrap gap-2">
// //         {MODULES.map(({ id, label, icon: Icon }) => (
// //           <button
// //             key={id}
// //             type="button"
// //             onClick={() => switchModule(id)}
// //             aria-current={module === id}
// //             className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors ${
// //               module === id
// //                 ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
// //                 : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
// //             }`}
// //           >
// //             <Icon className="h-4 w-4" />
// //             {label}
// //           </button>
// //         ))}
// //       </nav>

// //       {module === "reports" ? (
// //         <Reports
// //           orders={orders}
// //           expenses={expenses}
// //           purchaseOrders={purchaseOrders}
// //         />
// //       ) : (
// //         <>
// //           <section className="mb-4 flex flex-wrap items-center gap-3">
// //             <input
// //               value={search}
// //               onChange={(event) => setSearch(event.target.value)}
// //               placeholder="Search records"
// //               aria-label="Search records"
// //               className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
// //             />

// //             {module === "expenses" && (
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setCategoryName("");
// //                   setFormError("");
// //                   setCategoryDialog(true);
// //                 }}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
// //               >
// //                 Expense categories
// //               </button>
// //             )}

// //             <button
// //               type="button"
// //               onClick={openDialog}
// //               className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400"
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

// //           {statusOptions.length > 1 && (
// //             <div className="mb-4 flex flex-wrap items-center gap-2">
// //               {statusOptions.map((status) => (
// //                 <button
// //                   key={status}
// //                   type="button"
// //                   onClick={() => setStatusFilter(status)}
// //                   className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
// //                     statusFilter === status
// //                       ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
// //                       : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
// //                   }`}
// //                 >
// //                   {status === "ALL" ? "All" : status.replace(/_/g, " ")}
// //                 </button>
// //               ))}
// //             </div>
// //           )}

// //           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// //             <div className="overflow-x-auto">
// //               <div className="min-w-[980px]">
// //                 <ListHeader cols={cols} />

// //                 {loading ? (
// //                   <p className="flex items-center justify-center gap-2 p-10 text-center text-sm text-slate-400">
// //                     <Loader2 className="h-4 w-4 animate-spin" />
// //                     Loading ERP records…
// //                   </p>
// //                 ) : visibleRecords.length === 0 ? (
// //                   <p className="p-10 text-center text-sm text-slate-400">
// //                     {records.length === 0
// //                       ? "No records found."
// //                       : "No records match the current filter."}
// //                   </p>
// //                 ) : (
// //                   visibleRecords.map((record: any) => (
// //                     <div
// //                       key={record.id}
// //                       style={gridStyle}
// //                       className="grid items-center gap-4 border-b border-slate-800/70 px-5 py-4 text-xs last:border-0"
// //                     >
// //                       {module === "purchasing" ? (
// //                         <>
// //                           <span className="font-bold text-white">
// //                             {record.poNumber}
// //                           </span>
// //                           <span className="truncate text-slate-300">
// //                             {record.supplier?.name || "—"}
// //                           </span>
// //                           <span className="truncate text-slate-300">
// //                             {record.store?.name ||
// //                               stores.find((s) => s.id === record.storeId)
// //                                 ?.name ||
// //                               "—"}
// //                           </span>
// //                           <span className="text-slate-400">
// //                             {dateText(record.orderDate)}
// //                           </span>
// //                           <span className="font-semibold text-white">
// //                             {amount(record.grandTotal)}
// //                           </span>
// //                           <span className="text-amber-300">
// //                             {record.status?.replace(/_/g, " ")}
// //                           </span>
// //                           <span className="flex flex-wrap gap-1">
// //                             {record.status === "DRAFT" && (
// //                               <button
// //                                 type="button"
// //                                 onClick={() => void markOrdered(record)}
// //                                 disabled={busyId === `po:${record.id}`}
// //                                 className="flex items-center gap-1 rounded-lg bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
// //                               >
// //                                 {busyId === `po:${record.id}` && (
// //                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
// //                                 )}
// //                                 Mark ordered
// //                               </button>
// //                             )}
// //                             {RECEIVABLE_STATUSES.includes(record.status) && (
// //                               <button
// //                                 type="button"
// //                                 onClick={() => openReceive(record)}
// //                                 className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
// //                               >
// //                                 <ClipboardCheck className="h-3.5 w-3.5" />
// //                                 Receive
// //                               </button>
// //                             )}
// //                             {record.status === "RECEIVED" && (
// //                               <span className="text-[11px] font-medium text-emerald-400/80">
// //                                 ✓ Received
// //                               </span>
// //                             )}
// //                           </span>
// //                         </>
// //                       ) : module === "expenses" ? (
// //                         <>
// //                           <span className="font-semibold text-white">
// //                             {record.category?.name || "—"}
// //                           </span>
// //                           <span className="truncate text-slate-300">
// //                             {record.description || "—"}
// //                           </span>
// //                           <span className="text-slate-400">
// //                             {dateText(record.expenseDate)}
// //                           </span>
// //                           <span className="truncate text-slate-400">
// //                             {record.store?.name || "—"}
// //                           </span>
// //                           <span className="text-right font-bold text-white">
// //                             {amount(record.amount)}
// //                           </span>
// //                         </>
// //                       ) : module === "supplierPayments" ? (
// //                         <>
// //                           <span className="truncate font-semibold text-white">
// //                             {record.supplier?.name || "—"}
// //                           </span>
// //                           <span className="text-slate-400">
// //                             {dateText(record.paidAt)}
// //                           </span>
// //                           <span className="text-slate-300">
// //                             {record.paymentMethod?.replace(/_/g, " ")}
// //                           </span>
// //                           <span className="truncate text-slate-400">
// //                             {record.referenceNumber || "—"}
// //                           </span>
// //                           <span className="text-right font-bold text-white">
// //                             {amount(record.amount)}
// //                           </span>
// //                         </>
// //                       ) : module === "transfers" ? (
// //                         <>
// //                           <span className="font-bold text-white">
// //                             {record.transferNumber}
// //                           </span>
// //                           <span className="truncate text-slate-300">
// //                             {record.fromStore?.name} → {record.toStore?.name}
// //                           </span>
// //                           <span className="text-slate-400">
// //                             {dateText(record.requestedAt)}
// //                           </span>
// //                           <span className="text-slate-400">
// //                             {record.items?.length || 0} lines
// //                           </span>
// //                           <span
// //                             className={
// //                               record.status === "RECEIVED"
// //                                 ? "font-bold text-emerald-400"
// //                                 : "font-bold text-amber-300"
// //                             }
// //                           >
// //                             {transferStatusLabel(record.status)}
// //                           </span>
// //                           <span>
// //                             {RECEIVABLE_TRANSFER_STATUSES.includes(
// //                               record.status,
// //                             ) &&
// //                             (userRole === "SUPER_ADMIN" ||
// //                               record.toStoreId === selectedStoreId) ? (
// //                               <button
// //                                 type="button"
// //                                 onClick={() => openCompleteTransfer(record)}
// //                                 disabled={
// //                                   completing ||
// //                                   busyId === `transfer:${record.id}`
// //                                 }
// //                                 className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
// //                               >
// //                                 {busyId === `transfer:${record.id}` && (
// //                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
// //                                 )}
// //                                 Receive stock
// //                               </button>
// //                             ) : (
// //                               <span className="text-[11px] font-medium text-slate-400">
// //                                 {record.status === "RECEIVED"
// //                                   ? "✓ Received"
// //                                   : record.status === "IN_TRANSIT"
// //                                     ? "Sent · awaiting receipt"
// //                                     : "Awaiting dispatch"}
// //                               </span>
// //                             )}
// //                           </span>
// //                         </>
// //                       ) : (
// //                         <>
// //                           <span className="font-bold text-white">
// //                             {record.returnNumber}
// //                           </span>
// //                           <span className="text-slate-300">
// //                             {record.order?.orderNumber ||
// //                               record.orderId?.slice(0, 8) ||
// //                               "—"}
// //                           </span>
// //                           <span className="truncate text-slate-400">
// //                             {record.customer?.name || "Walk-in"}
// //                           </span>
// //                           <span className="text-slate-400">
// //                             {dateText(record.createdAt)}
// //                           </span>
// //                           <span className="font-bold text-white">
// //                             {amount(record.totalAmount)}
// //                           </span>
// //                           <span className="text-emerald-300">
// //                             {record.refundStatus}
// //                           </span>
// //                         </>
// //                       )}
// //                     </div>
// //                   ))
// //                 )}
// //               </div>
// //             </div>
// //           </section>
// //         </>
// //       )}

// //       {/* ------------------------------------------------------------ */}
// //       {/*  Receive purchase order modal                                 */}
// //       {/* ------------------------------------------------------------ */}
// //       <Modal
// //         open={Boolean(receiveTarget)}
// //         onClose={() => !receiving && setReceiveTarget(null)}
// //         labelledBy="receive-modal-title"
// //       >
// //         {receiveTarget && (
// //           <>
// //             <h2
// //               id="receive-modal-title"
// //               className="text-xl font-bold text-white"
// //             >
// //               Receive {receiveTarget.poNumber}
// //             </h2>
// //             <p className="mt-1 text-xs text-slate-400">
// //               Record delivered products into the purchase order's destination
// //               store.
// //             </p>

// //             <div className="mt-4">
// //               <label className="mb-1.5 block text-xs font-medium text-slate-300">
// //                 Destination store / branch
// //               </label>
// //               <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
// //                 {stores.find((store) => store.id === receiveStoreId)?.name ||
// //                   receiveTarget.store?.name ||
// //                   "Assigned destination"}
// //               </div>
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

// //             <ErrorNote message={receiveError} />

// //             <div className="mt-6 flex justify-end gap-3">
// //               <button
// //                 type="button"
// //                 onClick={() => setReceiveTarget(null)}
// //                 disabled={receiving}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="button"
// //                 onClick={() => void confirmReceive()}
// //                 disabled={receiving}
// //                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
// //               >
// //                 {receiving && <Loader2 className="h-4 w-4 animate-spin" />}
// //                 {receiving ? "Receiving…" : "Receive stock"}
// //               </button>
// //             </div>
// //           </>
// //         )}
// //       </Modal>

// //       {/* ------------------------------------------------------------ */}
// //       {/*  Complete transfer modal                                      */}
// //       {/* ------------------------------------------------------------ */}
// //       <Modal
// //         open={Boolean(transferTarget)}
// //         onClose={() => !completing && setTransferTarget(null)}
// //         labelledBy="transfer-modal-title"
// //         maxWidth="max-w-lg"
// //       >
// //         {transferTarget && (
// //           <>
// //             <div className="mb-2 flex items-center gap-3 text-emerald-400">
// //               <ArrowLeftRight className="h-6 w-6" />
// //               <h2
// //                 id="transfer-modal-title"
// //                 className="text-xl font-bold text-white"
// //               >
// //                 Accept transfer {transferTarget.transferNumber}
// //               </h2>
// //             </div>
// //             <p className="text-xs text-slate-300">
// //               Confirm the full shipment arrived. Stock is added to this store
// //               only after you receive it. Record any shortage or damage as a
// //               stock adjustment afterward.
// //             </p>

// //             <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
// //               <div className="flex justify-between border-b border-slate-900 py-1">
// //                 <span className="text-slate-400">Source (deducting from):</span>
// //                 <span className="font-semibold text-rose-300">
// //                   {transferTarget.fromStore?.name || "Source store"}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between border-b border-slate-900 py-1">
// //                 <span className="text-slate-400">Destination (adding to):</span>
// //                 <span className="font-semibold text-emerald-300">
// //                   {transferTarget.toStore?.name || "Destination store"}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between border-b border-slate-900 py-1">
// //                 <span className="text-slate-400">Requested:</span>
// //                 <span className="text-slate-200">
// //                   {dateText(transferTarget.requestedAt)}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between py-1">
// //                 <span className="text-slate-400">Total lines:</span>
// //                 <span className="font-semibold text-slate-200">
// //                   {transferTarget.items?.length || 0} items
// //                 </span>
// //               </div>
// //             </div>

// //             {transferTarget.items?.length > 0 && (
// //               <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs">
// //                 <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">
// //                   Items to transfer:
// //                 </p>
// //                 {transferTarget.items.map((item: any) => (
// //                   <div
// //                     key={item.id}
// //                     className="flex justify-between border-b border-slate-900/60 py-0.5 text-slate-300 last:border-0"
// //                   >
// //                     <span className="truncate pr-2">
// //                       {item.product?.name || "Product"}
// //                       {item.variant?.name ? ` (${item.variant.name})` : ""}
// //                     </span>
// //                     <span className="shrink-0 font-bold text-white">
// //                       × {item.quantity}
// //                     </span>
// //                   </div>
// //                 ))}
// //               </div>
// //             )}

// //             <ErrorNote message={transferError} />

// //             <div className="mt-6 flex justify-end gap-3">
// //               <button
// //                 type="button"
// //                 onClick={() => setTransferTarget(null)}
// //                 disabled={completing}
// //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="button"
// //                 onClick={() => void executeCompleteTransfer()}
// //                 disabled={completing}
// //                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
// //               >
// //                 {completing && <Loader2 className="h-4 w-4 animate-spin" />}
// //                 {completing ? "Processing…" : "Confirm & receive stock"}
// //               </button>
// //             </div>
// //           </>
// //         )}
// //       </Modal>

// //       {/* ------------------------------------------------------------ */}
// //       {/*  Create / category dialog                                     */}
// //       {/* ------------------------------------------------------------ */}
// //       <Modal
// //         open={dialog || categoryDialog}
// //         maxWidth={module === "transfers" ? "max-w-5xl" : "max-w-4xl"}
// //         onClose={() => {
// //           if (saving) return;
// //           setDialog(false);
// //           setCategoryDialog(false);
// //         }}
// //         labelledBy="erp-form-title"
// //       >
// //         <form onSubmit={categoryDialog ? addExpenseCategory : submit}>
// //           <h2 id="erp-form-title" className="text-xl font-bold text-white">
// //             {categoryDialog
// //               ? "Add expense category"
// //               : module === "purchasing"
// //                 ? "New purchase order"
// //                 : module === "expenses"
// //                   ? "Record expense"
// //                   : module === "supplierPayments"
// //                     ? "Record supplier payment"
// //                     : module === "transfers"
// //                       ? "Send stock"
// //                       : "Process sales return"}
// //           </h2>
// //           <p className="mb-5 mt-1 text-xs text-slate-400">
// //             This action is recorded on the server and may update inventory or
// //             balances.
// //           </p>

// //           {categoryDialog ? (
// //             <Field
// //               label="Category name"
// //               value={categoryName}
// //               onChange={setCategoryName}
// //               required
// //               disabled={saving}
// //             />
// //           ) : module === "purchasing" ? (
// //             <div className="space-y-3">
// //               <Select
// //                 label="Destination store"
// //                 value={fields.storeId}
// //                 onChange={(value) => setFields({ ...fields, storeId: value })}
// //                 options={stores.map((item) => [item.id, item.name])}
// //               />

// //               <Select
// //                 label="Supplier"
// //                 value={fields.supplierId}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, supplierId: value })
// //                 }
// //                 options={suppliers.map((item) => [
// //                   item.id,
// //                   `${item.name} (${item.code ?? "—"})`,
// //                 ])}
// //               />

// //               <Select
// //                 label="Product"
// //                 value={fields.productId}
// //                 onChange={(value) => {
// //                   const next = products.find((p) => p.id === value);
// //                   setFields({
// //                     ...fields,
// //                     productId: value,
// //                     variantId: getVariants(next)[0]?.id || "",
// //                   });
// //                 }}
// //                 options={products.map((item) => [
// //                   item.id,
// //                   `${item.name} · ${item.sku}`,
// //                 ])}
// //               />

// //               {getVariants(products.find((p) => p.id === fields.productId))
// //                 .length > 0 && (
// //                 <Select
// //                   label="Variant"
// //                   value={fields.variantId}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, variantId: value })
// //                   }
// //                   options={getVariants(
// //                     products.find((p) => p.id === fields.productId),
// //                   ).map((variant) => [
// //                     variant.id,
// //                     `${variant.name}${variant.sku ? ` · ${variant.sku}` : ""}`,
// //                   ])}
// //                 />
// //               )}

// //               <div className="grid grid-cols-2 gap-3">
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
// //                   label="Unit cost"
// //                   type="number"
// //                   min="0"
// //                   step="0.01"
// //                   value={fields.unitCost}
// //                   onChange={(value) =>
// //                     setFields({ ...fields, unitCost: value })
// //                   }
// //                   required
// //                 />
// //               </div>
// //               <p className="text-right text-sm font-bold text-white">
// //                 Subtotal {amount(poTotal)}
// //               </p>
// //               <Field
// //                 label="Expected date"
// //                 type="date"
// //                 value={fields.expectedDate}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, expectedDate: value })
// //                 }
// //               />
// //               <Field
// //                 label="Notes"
// //                 value={fields.notes}
// //                 onChange={(value) => setFields({ ...fields, notes: value })}
// //               />
// //             </div>
// //           ) : module === "expenses" ? (
// //             <div className="space-y-3">
// //               {!selectedStoreId && (
// //                 <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
// //                   Select a store in the top bar before recording an expense.
// //                 </p>
// //               )}
// //               <Select
// //                 label="Expense category"
// //                 value={fields.categoryId}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, categoryId: value })
// //                 }
// //                 options={expenseCategories.map((item) => [item.id, item.name])}
// //               />
// //               <Field
// //                 label="Amount"
// //                 type="number"
// //                 min="0.01"
// //                 step="0.01"
// //                 value={fields.amount}
// //                 onChange={(value) => setFields({ ...fields, amount: value })}
// //                 required
// //               />
// //               <Field
// //                 label="Date"
// //                 type="date"
// //                 value={fields.expenseDate}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, expenseDate: value })
// //                 }
// //                 required
// //               />
// //               <Field
// //                 label="Description"
// //                 value={fields.description}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, description: value })
// //                 }
// //               />
// //             </div>
// //           ) : module === "supplierPayments" ? (
// //             <div className="space-y-3">
// //               <Select
// //                 label="Supplier"
// //                 value={fields.supplierId}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, supplierId: value })
// //                 }
// //                 options={suppliers.map((item) => [item.id, item.name])}
// //               />
// //               <Field
// //                 label="Amount"
// //                 type="number"
// //                 min="0.01"
// //                 step="0.01"
// //                 value={fields.amount}
// //                 onChange={(value) => setFields({ ...fields, amount: value })}
// //                 required
// //               />
// //               <Select
// //                 label="Payment method"
// //                 value={fields.paymentMethod}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, paymentMethod: value })
// //                 }
// //                 options={PAYMENT_METHODS.map((value) => [
// //                   value,
// //                   value.split("_").join(" "),
// //                 ])}
// //               />
// //               <Field
// //                 label="Reference number"
// //                 value={fields.referenceNumber}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, referenceNumber: value })
// //                 }
// //               />
// //               <Field
// //                 label="Note"
// //                 value={fields.notes}
// //                 onChange={(value) => setFields({ ...fields, notes: value })}
// //               />
// //             </div>
// //           ) : module === "transfers" ? (
// //             /* ===================================================== */
// //             /*  NEW TWO-PANEL TRANSFER UI (Store 1 → Store 2)        */
// //             /* ===================================================== */
// //             <div className="space-y-4">
// //               {/* Destination Store Selector */}
// //               <ChoiceCards
// //                 label="Destination"
// //                 value={fields.toStoreId}
// //                 onChange={(value) =>
// //                   setFields((current) => ({ ...current, toStoreId: value }))
// //                 }
// //                 columns={3}
// //                 options={transferDestinationStores
// //                   .filter((item) => item.id !== selectedStoreId)
// //                   .map((item) => ({
// //                     value: item.id,
// //                     label: item.name,
// //                     description: "Receiving branch",
// //                   }))}
// //               />

// //               {/* Two-Panel Layout */}
// //               <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
// //                 {/* -------- Left panel: Source Store -------- */}
// //                 <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
// //                   <div className="border-b border-slate-800 bg-slate-900 p-3">
// //                     <div className="flex items-center justify-between">
// //                       <h3 className="text-sm font-bold text-white">
// //                         Store 1:{" "}
// //                         {stores.find((item) => item.id === selectedStoreId)
// //                           ?.name || "Source"}
// //                       </h3>
// //                       <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
// //                         List & stock
// //                       </span>
// //                     </div>
// //                     <p className="mt-0.5 text-[10px] text-slate-500">
// //                       Available inventory at source
// //                     </p>
// //                     <input
// //                       type="text"
// //                       placeholder="Search name, SKU or barcode..."
// //                       value={sourceSearch}
// //                       onChange={(event) => setSourceSearch(event.target.value)}
// //                       className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
// //                     />
// //                   </div>

// //                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
// //                     {filteredSourceProducts.length === 0 ? (
// //                       <p className="py-8 text-center text-xs text-slate-500">
// //                         No matching products.
// //                       </p>
// //                     ) : (
// //                       filteredSourceProducts.map((product) => {
// //                         const variants = getVariants(product);
// //                         return (
// //                           <div
// //                             key={product.id}
// //                             className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
// //                           >
// //                             <div className="mb-2 flex items-center justify-between gap-2">
// //                               <span className="truncate text-xs font-bold text-white">
// //                                 {product.name}
// //                               </span>
// //                               <span className="shrink-0 text-[10px] text-slate-500">
// //                                 {product.sku}
// //                               </span>
// //                             </div>

// //                             {variants.length === 0 ? (
// //                               <p className="text-[10px] italic text-slate-500">
// //                                 No options available
// //                               </p>
// //                             ) : (
// //                               <div className="space-y-1.5">
// //                                 {variants.map((variant) => {
// //                                   const stock = Number(
// //                                     variant.availableStock ??
// //                                       variant.stock ??
// //                                       0,
// //                                   );
// //                                   const inCart =
// //                                     transferItems.find(
// //                                       (item) => item.variantId === variant.id,
// //                                     )?.quantity || 0;
// //                                   const remaining = stock - inCart;
// //                                   const disabled =
// //                                     remaining <= 0 || !fields.toStoreId;

// //                                   return (
// //                                     <div
// //                                       key={variant.id}
// //                                       className="flex items-center justify-between gap-2 rounded-md border-t border-slate-800/60 pt-1.5 text-[11px] first:border-t-0 first:pt-0"
// //                                     >
// //                                       <div className="min-w-0 flex-1">
// //                                         <p className="truncate text-slate-300">
// //                                           {variant.name}
// //                                         </p>
// //                                         <p className="text-[10px] text-slate-500">
// //                                           {stock} in stock
// //                                           {inCart > 0 && (
// //                                             <span className="text-sky-400">
// //                                               {" "}
// //                                               · {inCart} added
// //                                             </span>
// //                                           )}
// //                                           {remaining !== stock &&
// //                                             inCart > 0 && (
// //                                               <span className="text-slate-400">
// //                                                 {" "}
// //                                                 · {remaining} left
// //                                               </span>
// //                                             )}
// //                                         </p>
// //                                       </div>
// //                                       <button
// //                                         type="button"
// //                                         onClick={() =>
// //                                           addTransferItem(
// //                                             product.id,
// //                                             variant.id,
// //                                             1,
// //                                           )
// //                                         }
// //                                         disabled={disabled}
// //                                         className="shrink-0 rounded-md bg-violet-500/20 px-2 py-1 font-bold text-violet-300 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-30"
// //                                       >
// //                                         Add
// //                                       </button>
// //                                     </div>
// //                                   );
// //                                 })}
// //                               </div>
// //                             )}
// //                           </div>
// //                         );
// //                       })
// //                     )}
// //                   </div>
// //                 </div>

// //                 {/* -------- Middle: Arrows -------- */}
// //                 <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
// //                   <ArrowRight className="h-6 w-6 text-sky-400" />
// //                   <span className="text-center text-[10px] font-bold uppercase tracking-wider text-sky-400">
// //                     to
// //                     <br />
// //                     transfer
// //                   </span>
// //                   <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
// //                 </div>

// //                 {/* -------- Right panel: Destination Store -------- */}
// //                 <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
// //                   <div className="border-b border-slate-800 bg-slate-900 p-3">
// //                     <div className="flex items-center justify-between">
// //                       <h3 className="text-sm font-bold text-white">
// //                         Store 2:{" "}
// //                         {stores.find((item) => item.id === fields.toStoreId)
// //                           ?.name || "Destination"}
// //                       </h3>
// //                       <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
// //                         List
// //                       </span>
// //                     </div>
// //                     <p className="mt-0.5 text-[10px] text-slate-500">
// //                       Items in this shipment
// //                     </p>
// //                   </div>

// //                   <div className="flex-1 space-y-2 overflow-y-auto p-3">
// //                     {transferItems.length === 0 ? (
// //                       <div className="flex h-full flex-col items-center justify-center py-10 text-center">
// //                         <ArrowLeftRight className="mb-3 h-8 w-8 text-slate-700" />
// //                         <p className="text-xs text-slate-500">
// //                           No items to transfer yet.
// //                         </p>
// //                         <p className="mt-1 text-[10px] text-slate-600">
// //                           Add products from the left panel.
// //                         </p>
// //                       </div>
// //                     ) : (
// //                       transferItems.map((item) => {
// //                         const product = products.find(
// //                           (p) => p.id === item.productId,
// //                         );
// //                         const variant = getVariants(product).find(
// //                           (v) => v.id === item.variantId,
// //                         );
// //                         return (
// //                           <div
// //                             key={`${item.productId}:${item.variantId}`}
// //                             className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5"
// //                           >
// //                             <div className="min-w-0 flex-1">
// //                               <p className="truncate text-xs font-bold text-slate-200">
// //                                 {product?.name || "Product"}
// //                               </p>
// //                               <p className="truncate text-[10px] text-slate-500">
// //                                 {variant?.name || "Option"}
// //                               </p>
// //                             </div>
// //                             <div className="flex shrink-0 items-center gap-1.5">
// //                               <input
// //                                 type="number"
// //                                 min="1"
// //                                 value={item.quantity}
// //                                 onChange={(event) =>
// //                                   updateTransferItemQuantity(
// //                                     item.productId,
// //                                     item.variantId,
// //                                     Number(event.target.value),
// //                                   )
// //                                 }
// //                                 className="w-12 rounded-md border border-slate-700 bg-slate-950 py-1 text-center text-[11px] text-white outline-none focus:border-violet-500"
// //                               />
// //                               <button
// //                                 type="button"
// //                                 onClick={() =>
// //                                   removeTransferItem(
// //                                     item.productId,
// //                                     item.variantId,
// //                                   )
// //                                 }
// //                                 className="rounded-md p-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
// //                                 aria-label="Remove item"
// //                               >
// //                                 <X className="h-3.5 w-3.5" />
// //                               </button>
// //                             </div>
// //                           </div>
// //                         );
// //                       })
// //                     )}
// //                   </div>

// //                   {transferItems.length > 0 && (
// //                     <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
// //                       <div className="flex justify-between">
// //                         <span>Total options:</span>
// //                         <span className="font-bold text-white">
// //                           {transferItems.length}
// //                         </span>
// //                       </div>
// //                       <div className="flex justify-between">
// //                         <span>Total units:</span>
// //                         <span className="font-bold text-white">
// //                           {transferTotalUnits}
// //                         </span>
// //                       </div>
// //                     </div>
// //                   )}
// //                 </div>
// //               </div>

// //               <Field
// //                 label="Notes"
// //                 value={fields.notes}
// //                 onChange={(value) => setFields({ ...fields, notes: value })}
// //               />

// //               <ErrorNote message={formError} />
// //             </div>
// //           ) : (
// //             <div className="space-y-3">
// //               <Select
// //                 label="Completed order"
// //                 value={fields.orderId}
// //                 onChange={(value) => {
// //                   const order = orders.find((entry) => entry.id === value);
// //                   setFields({
// //                     ...fields,
// //                     orderId: value,
// //                     orderItemId: order?.items?.[0]?.id || "",
// //                   });
// //                 }}
// //                 options={orders
// //                   .filter(isReturnable)
// //                   .map((order) => [
// //                     order.id,
// //                     `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
// //                   ])}
// //               />
// //               <Select
// //                 label="Returned item"
// //                 value={fields.orderItemId}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, orderItemId: value })
// //                 }
// //                 options={(selectedOrder?.items || []).map((item) => [
// //                   item.id,
// //                   `${item.product?.name || "Product"} · qty ${item.quantity}`,
// //                 ])}
// //               />
// //               {orderItem && (
// //                 <p className="text-xs text-slate-400">
// //                   Remaining returnable:{" "}
// //                   <strong className="text-white">
// //                     {orderItem.quantity -
// //                       Number(orderItem.returnedQuantity || 0)}
// //                   </strong>
// //                 </p>
// //               )}
// //               <Field
// //                 label="Quantity"
// //                 type="number"
// //                 min="1"
// //                 max={Math.max(
// //                   1,
// //                   (orderItem?.quantity || 1) -
// //                     Number(orderItem?.returnedQuantity || 0),
// //                 )}
// //                 value={fields.quantity}
// //                 onChange={(value) => setFields({ ...fields, quantity: value })}
// //                 required
// //               />
// //               <p className="text-right text-sm font-bold text-white">
// //                 Refund total {amount(itemTotal)}
// //               </p>
// //               <Select
// //                 label="Refund method"
// //                 value={fields.refundMethod}
// //                 onChange={(value) =>
// //                   setFields({ ...fields, refundMethod: value })
// //                 }
// //                 options={PAYMENT_METHODS.map((value) => [
// //                   value,
// //                   value.split("_").join(" "),
// //                 ])}
// //               />
// //               <Field
// //                 label="Reason"
// //                 value={fields.reason}
// //                 onChange={(value) => setFields({ ...fields, reason: value })}
// //                 required
// //               />
// //             </div>
// //           )}

// //           {!(module === "transfers" && !categoryDialog) && (
// //             <ErrorNote message={formError} />
// //           )}

// //           <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
// //             <button
// //               type="button"
// //               onClick={() => {
// //                 setDialog(false);
// //                 setCategoryDialog(false);
// //               }}
// //               disabled={saving}
// //               className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:py-2.5"
// //             >
// //               Cancel
// //             </button>
// //             <button
// //               type="submit"
// //               disabled={
// //                 saving ||
// //                 (module === "transfers" &&
// //                   !categoryDialog &&
// //                   (transferItems.length === 0 || !fields.toStoreId))
// //               }
// //               className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
// //             >
// //               {saving && <Loader2 className="h-4 w-4 animate-spin" />}
// //               {saving
// //                 ? module === "transfers"
// //                   ? "Sending…"
// //                   : "Saving…"
// //                 : module === "transfers"
// //                   ? `Send stock${transferTotalUnits ? ` (${transferTotalUnits})` : ""}`
// //                   : "Save"}
// //             </button>
// //           </div>
// //         </form>
// //       </Modal>
// //     </main>
// //   );
// // }

// // /* ------------------------------------------------------------------ */
// // /*  Presentational helpers                                             */
// // /* ------------------------------------------------------------------ */

// // function Modal({
// //   open,
// //   onClose,
// //   labelledBy,
// //   children,
// //   maxWidth = "max-w-xl",
// // }: {
// //   open: boolean;
// //   onClose: () => void;
// //   labelledBy: string;
// //   children: React.ReactNode;
// //   maxWidth?: string;
// // }) {
// //   const panelRef = useRef<HTMLDivElement>(null);
// //   const onCloseRef = useRef(onClose);

// //   useEffect(() => {
// //     onCloseRef.current = onClose;
// //   }, [onClose]);

// //   useEffect(() => {
// //     if (!open) return;

// //     const handleKey = (event: KeyboardEvent) => {
// //       if (event.key === "Escape") onCloseRef.current();
// //     };
// //     document.addEventListener("keydown", handleKey);

// //     const previousOverflow = document.body.style.overflow;
// //     document.body.style.overflow = "hidden";
// //     panelRef.current?.focus();

// //     return () => {
// //       document.removeEventListener("keydown", handleKey);
// //       document.body.style.overflow = previousOverflow;
// //     };
// //   }, [open]);

// //   if (!open) return null;

// //   return createPortal(
// //     <div
// //       className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
// //       onMouseDown={onClose}
// //       role="presentation"
// //     >
// //       <div
// //         ref={panelRef}
// //         role="dialog"
// //         aria-modal="true"
// //         aria-labelledby={labelledBy}
// //         tabIndex={-1}
// //         onMouseDown={(event) => event.stopPropagation()}
// //         className={`max-h-[96dvh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-2xl sm:p-6`}
// //       >
// //         {children}
// //       </div>
// //     </div>,
// //     document.body,
// //   );
// // }

// // function ErrorNote({ message }: { message: string }) {
// //   if (!message) return null;
// //   return (
// //     <p
// //       role="alert"
// //       className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
// //     >
// //       <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
// //       <span>{message}</span>
// //     </p>
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
// //   disabled,
// // }: {
// //   label: string;
// //   value: string;
// //   onChange: (value: string) => void;
// //   type?: string;
// //   required?: boolean;
// //   min?: string;
// //   max?: number;
// //   step?: string;
// //   disabled?: boolean;
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
// //         disabled={disabled}
// //         value={value}
// //         onChange={(event) => onChange(event.target.value)}
// //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400 disabled:opacity-60"
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

// //   const receivedOrders = purchaseOrders.filter(
// //     (po) => po.status === "RECEIVED",
// //   );
// //   const procurement = receivedOrders.reduce(
// //     (sum, po) => sum + Number(po.grandTotal || 0),
// //     0,
// //   );

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
// //       `${receivedOrders.length} purchase orders received`,
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

// // // // tested code ok
// // // import {
// // //   FormEvent,
// // //   useCallback,
// // //   useEffect,
// // //   useMemo,
// // //   useRef,
// // //   useState,
// // // } from "react";
// // // import { createPortal } from "react-dom";
// // // import {
// // //   AlertTriangle,
// // //   ArrowLeftRight,
// // //   BadgeDollarSign,
// // //   CheckCircle2,
// // //   ClipboardCheck,
// // //   FileBarChart2,
// // //   Loader2,
// // //   Plus,
// // //   Receipt,
// // //   Truck,
// // //   Undo2,
// // //   X,
// // // } from "lucide-react";
// // // import { ApiOrder } from "../store/apiSlice";
// // // import { Product } from "../types";
// // // import { WorkflowGuide } from "./WorkflowGuide";
// // // import { SearchableProductPicker } from "./SearchableProductPicker";
// // // import { ChoiceCards } from "./ChoiceCards";

// // // /* ------------------------------------------------------------------ */
// // // /*  Types                                                              */
// // // /* ------------------------------------------------------------------ */

// // // type Module =
// // //   | "purchasing"
// // //   | "expenses"
// // //   | "supplierPayments"
// // //   | "transfers"
// // //   | "returns"
// // //   | "reports";

// // // type Fields = Record<string, string>;

// // // interface Props {
// // //   selectedStoreId?: string;
// // //   userRole?: string;
// // //   stores: { id: string; name: string }[];
// // //   transferDestinationStores: { id: string; name: string }[];
// // //   products: Product[];
// // //   suppliers: any[];
// // //   orders: ApiOrder[];
// // //   purchaseOrders: any[];
// // //   expenses: any[];
// // //   expenseCategories: any[];
// // //   supplierPayments: any[];
// // //   transfers: any[];
// // //   returns: any[];
// // //   loading: boolean;
// // //   onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>;
// // //   onUpdatePurchaseOrder: (
// // //     id: string,
// // //     patch: Record<string, unknown>,
// // //   ) => Promise<unknown>;
// // //   onReceivePurchaseOrder: (
// // //     id: string,
// // //     storeId: string,
// // //     lots?: {
// // //       purchaseOrderItemId: string;
// // //       number: string;
// // //       expiryDate?: string;
// // //     }[],
// // //   ) => Promise<unknown>;
// // //   onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>;
// // //   onCreateExpenseCategory: (name: string) => Promise<unknown>;
// // //   onCreateSupplierPayment: (
// // //     payload: Record<string, unknown>,
// // //   ) => Promise<unknown>;
// // //   onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>;
// // //   onCompleteTransfer: (id: string) => Promise<unknown>;
// // //   onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
// // // }

// // // interface Toast {
// // //   id: number;
// // //   tone: "success" | "error";
// // //   message: string;
// // // }

// // // /* ------------------------------------------------------------------ */
// // // /*  Constants & helpers                                                */
// // // /* ------------------------------------------------------------------ */

// // // const MODULES: { id: Module; label: string; icon: typeof Truck }[] = [
// // //   { id: "purchasing", label: "Purchasing", icon: Truck },
// // //   { id: "expenses", label: "Expenses", icon: Receipt },
// // //   { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
// // //   { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
// // //   { id: "returns", label: "Sales returns", icon: Undo2 },
// // //   { id: "reports", label: "Reports", icon: FileBarChart2 },
// // // ];

// // // const COLUMNS: Record<Module, string[]> = {
// // //   purchasing: [
// // //     "PO number",
// // //     "Supplier",
// // //     "Store",
// // //     "Order date",
// // //     "Total",
// // //     "Status",
// // //     "Actions",
// // //   ],
// // //   expenses: ["Category", "Description", "Date", "Store", "Amount"],
// // //   supplierPayments: ["Supplier", "Paid at", "Method", "Reference", "Amount"],
// // //   transfers: [
// // //     "Transfer",
// // //     "From → To",
// // //     "Requested",
// // //     "Items",
// // //     "Status",
// // //     "Actions",
// // //   ],
// // //   returns: ["Return", "Order", "Customer", "Date", "Refund", "Status"],
// // //   reports: [],
// // // };

// // // const PAYMENT_METHODS = [
// // //   "CASH",
// // //   "KBZ_PAY",
// // //   "CB_PAY",
// // //   "WAVE_PAY",
// // //   "CARD",
// // //   "BANK_TRANSFER",
// // // ];

// // // const RECEIVABLE_STATUSES = ["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"];
// // // const RECEIVABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

// // // const today = () => new Date().toISOString().slice(0, 10);

// // // const initialFields = (): Fields => ({
// // //   storeId: "",
// // //   supplierId: "",
// // //   productId: "",
// // //   variantId: "",
// // //   quantity: "1",
// // //   unitCost: "",
// // //   expectedDate: "",
// // //   notes: "",
// // //   categoryId: "",
// // //   amount: "",
// // //   description: "",
// // //   expenseDate: today(),
// // //   paymentMethod: "CASH",
// // //   referenceNumber: "",
// // //   toStoreId: "",
// // //   orderId: "",
// // //   orderItemId: "",
// // //   reason: "",
// // //   refundMethod: "CASH",
// // // });

// // // const errorMessage = (error: unknown) => {
// // //   if (typeof error === "string") return error;
// // //   const value = error as { data?: { message?: string }; message?: string };
// // //   return (
// // //     value?.data?.message ||
// // //     value?.message ||
// // //     "The server could not save this operation."
// // //   );
// // // };

// // // const dateText = (value?: string) =>
// // //   value ? new Date(value).toLocaleString() : "—";

// // // const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

// // // const transferStatusLabel = (status: string) =>
// // //   status === "RECEIVED"
// // //     ? "Received"
// // //     : status === "IN_TRANSIT"
// // //       ? "On the way"
// // //       : status === "PENDING"
// // //         ? "Awaiting dispatch"
// // //         : status === "APPROVED"
// // //           ? "Ready to send"
// // //           : status;

// // // /** Safe accessor for variant arrays on a product. */
// // // const getVariants = (product: Product | undefined): any[] => {
// // //   const value = (product as { variants?: unknown } | undefined)?.variants;
// // //   return Array.isArray(value) ? value : [];
// // // };

// // // /* ------------------------------------------------------------------ */
// // // /*  Main view                                                          */
// // // /* ------------------------------------------------------------------ */

// // // export function ERPView(props: Props) {
// // //   const {
// // //     selectedStoreId,
// // //     userRole,
// // //     stores,
// // //     transferDestinationStores,
// // //     products,
// // //     suppliers,
// // //     orders,
// // //     purchaseOrders,
// // //     expenses,
// // //     expenseCategories,
// // //     supplierPayments,
// // //     transfers,
// // //     returns,
// // //     loading,
// // //     onCreatePurchaseOrder,
// // //     onUpdatePurchaseOrder,
// // //     onReceivePurchaseOrder,
// // //     onCreateExpense,
// // //     onCreateExpenseCategory,
// // //     onCreateSupplierPayment,
// // //     onCreateTransfer,
// // //     onCompleteTransfer,
// // //     onCreateReturn,
// // //   } = props;

// // //   /* ---------------------------- state ---------------------------- */

// // //   const [module, setModule] = useState<Module>("purchasing");
// // //   const [search, setSearch] = useState("");
// // //   const [statusFilter, setStatusFilter] = useState("ALL");

// // //   const [dialog, setDialog] = useState(false);
// // //   const [fields, setFields] = useState<Fields>(initialFields);
// // //   const [transferItems, setTransferItems] = useState<Array<{
// // //     productId: string;
// // //     variantId: string;
// // //     quantity: number;
// // //   }>>([]);
// // //   const [formError, setFormError] = useState("");
// // //   const [saving, setSaving] = useState(false);

// // //   const [categoryDialog, setCategoryDialog] = useState(false);
// // //   const [categoryName, setCategoryName] = useState("");

// // //   const [receiveTarget, setReceiveTarget] = useState<any>(null);
// // //   const [receiveStoreId, setReceiveStoreId] = useState("");
// // //   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
// // //   const [receiveLots, setReceiveLots] = useState<
// // //     Record<string, { number: string; expiryDate: string }>
// // //   >({});
// // //   const [receiveError, setReceiveError] = useState("");
// // //   const [receiving, setReceiving] = useState(false);

// // //   const [transferTarget, setTransferTarget] = useState<any>(null);
// // //   const [transferError, setTransferError] = useState("");
// // //   const [completing, setCompleting] = useState(false);

// // //   const [busyId, setBusyId] = useState<string | null>(null);

// // //   const [toasts, setToasts] = useState<Toast[]>([]);
// // //   const toastSeq = useRef(0);
// // //   const toastTimers = useRef<number[]>([]);

// // //   const pushToast = useCallback((tone: Toast["tone"], message: string) => {
// // //     const id = ++toastSeq.current;
// // //     setToasts((current) => [...current, { id, tone, message }]);
// // //     const timer = window.setTimeout(
// // //       () => setToasts((current) => current.filter((toast) => toast.id !== id)),
// // //       5000,
// // //     );
// // //     toastTimers.current.push(timer);
// // //   }, []);

// // //   const dismissToast = useCallback((id: number) => {
// // //     setToasts((current) => current.filter((toast) => toast.id !== id));
// // //   }, []);

// // //   useEffect(
// // //     () => () => {
// // //       toastTimers.current.forEach(window.clearTimeout);
// // //     },
// // //     [],
// // //   );

// // //   /* -------------------------- derived data ------------------------ */

// // //   const selectedProduct = products.find(
// // //     (product) => product.id === fields.productId,
// // //   );
// // //   const selectedProductVariants = getVariants(selectedProduct);
// // //   const selectedVariant = selectedProductVariants.find((variant) => variant.id === fields.variantId);
// // //   const sourceOnHand = Number(selectedVariant?.availableStock ?? selectedVariant?.stock ?? 0);
// // //   const alreadyInTransfer = transferItems.find((item) => item.productId === fields.productId && item.variantId === fields.variantId)?.quantity ?? 0;
// // //   const sourceRemaining = Math.max(0, sourceOnHand - alreadyInTransfer);
// // //   const transferQuantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
// // //   const selectedOrder = orders.find((order) => order.id === fields.orderId);
// // //   const orderItem = selectedOrder?.items?.find(
// // //     (item) => item.id === fields.orderItemId,
// // //   );
// // //   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
// // //   const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
// // //   const poTotal = quantity * Number(fields.unitCost || 0);
// // //   const isReturnable = (order: ApiOrder) =>
// // //     order.status === "COMPLETED" || order.paymentStatus === "PAID";

// // //   const records = useMemo(() => {
// // //     const values = (
// // //       {
// // //         purchasing: purchaseOrders,
// // //         expenses: expenses,
// // //         supplierPayments: supplierPayments,
// // //         transfers: transfers,
// // //         returns: returns,
// // //         reports: [],
// // //       } as Record<Module, any[]>
// // //     )[module];

// // //     const normalized = search.trim().toLowerCase();
// // //     if (!normalized) return values;

// // //     return values.filter((item) =>
// // //       JSON.stringify([
// // //         item.poNumber,
// // //         item.transferNumber,
// // //         item.returnNumber,
// // //         item.order?.orderNumber,
// // //         item.supplier?.name,
// // //         item.customer?.name,
// // //         item.description,
// // //         item.notes,
// // //         item.reason,
// // //         item.referenceNumber,
// // //         item.category?.name,
// // //         item.store?.name,
// // //         item.fromStore?.name,
// // //         item.toStore?.name,
// // //         ...(item.items ?? []).flatMap((line: any) => [
// // //           line.product?.name,
// // //           line.product?.sku,
// // //           line.variant?.name,
// // //           line.variant?.sku,
// // //         ]),
// // //         item.status,
// // //         item.refundStatus,
// // //       ])
// // //         .toLowerCase()
// // //         .includes(normalized),
// // //     );
// // //   }, [
// // //     module,
// // //     purchaseOrders,
// // //     expenses,
// // //     supplierPayments,
// // //     transfers,
// // //     returns,
// // //     search,
// // //   ]);

// // //   const statusOptions = useMemo(() => {
// // //     if (
// // //       module === "reports" ||
// // //       module === "expenses" ||
// // //       module === "supplierPayments"
// // //     )
// // //       return [];
// // //     const set = new Set<string>();
// // //     records.forEach((record: any) => {
// // //       const status = module === "returns" ? record.refundStatus : record.status;
// // //       if (status) set.add(status);
// // //     });
// // //     return ["ALL", ...Array.from(set).sort()];
// // //   }, [records, module]);

// // //   const visibleRecords = useMemo(() => {
// // //     if (statusFilter === "ALL") return records;
// // //     return records.filter((record: any) => {
// // //       const status = module === "returns" ? record.refundStatus : record.status;
// // //       return status === statusFilter;
// // //     });
// // //   }, [records, statusFilter, module]);

// // //   const cols = COLUMNS[module];
// // //   const gridStyle = useMemo(
// // //     () => ({ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }),
// // //     [cols.length],
// // //   );

// // //   /* ---------------------------- actions --------------------------- */

// // //   const resetMessages = () => {
// // //     setFormError("");
// // //     setReceiveError("");
// // //     setTransferError("");
// // //   };

// // //   const switchModule = (next: Module) => {
// // //     setModule(next);
// // //     setSearch("");
// // //     setStatusFilter("ALL");
// // //     resetMessages();
// // //     setTransferItems([]);
// // //   };

// // //   const openDialog = () => {
// // //     const firstOrder = orders.find(isReturnable);
// // //     const firstProduct = products[0];
// // //     setFields({
// // //       ...initialFields(),
// // //       // Purchase order: default to the active store, first supplier, first product
// // //       storeId: selectedStoreId || stores[0]?.id || "",
// // //       supplierId: suppliers[0]?.id || "",
// // //       productId: module === "transfers" ? "" : firstProduct?.id || "",
// // //       variantId: module === "transfers" ? "" : getVariants(firstProduct)[0]?.id || "",
// // //       categoryId: expenseCategories[0]?.id || "",
// // //       toStoreId: transferDestinationStores.find((store) => store.id !== selectedStoreId)?.id || "",
// // //       orderId: firstOrder?.id || "",
// // //       orderItemId: firstOrder?.items?.[0]?.id || "",
// // //     });
// // //     resetMessages();
// // //     setTransferItems([]);
// // //     setDialog(true);
// // //   };

// // //   const addTransferItem = () => {
// // //     const product = products.find((entry) => entry.id === fields.productId);
// // //     const variant = getVariants(product).find((entry) => entry.id === fields.variantId);
// // //     const itemQuantity = Math.floor(Number(fields.quantity));
// // //     if (!product || !variant || !Number.isInteger(itemQuantity) || itemQuantity < 1) {
// // //       setFormError("Choose a product option and enter a whole quantity to add it.");
// // //       return;
// // //     }
// // //     const available = Number(variant.availableStock ?? variant.stock ?? 0);
// // //     const existingQuantity = transferItems.find(
// // //       (item) => item.productId === product.id && item.variantId === variant.id,
// // //     )?.quantity ?? 0;
// // //     if (existingQuantity + itemQuantity > available) {
// // //       setFormError(`Only ${available} unit(s) of ${product.name} · ${variant.name} are at the source store.`);
// // //       return;
// // //     }
// // //     setTransferItems((current) => {
// // //       const index = current.findIndex(
// // //         (item) => item.productId === product.id && item.variantId === variant.id,
// // //       );
// // //       if (index < 0) return [...current, { productId: product.id, variantId: variant.id, quantity: itemQuantity }];
// // //       return current.map((item, itemIndex) => itemIndex === index
// // //         ? { ...item, quantity: item.quantity + itemQuantity }
// // //         : item);
// // //     });
// // //     setFormError("");
// // //     setFields((current) => ({ ...current, productId: "", variantId: "", quantity: "1" }));
// // //   };

// // //   const submit = async (event: FormEvent) => {
// // //     event.preventDefault();
// // //     setSaving(true);
// // //     setFormError("");

// // //     try {
// // //       if (module === "purchasing") {
// // //         if (
// // //           !fields.storeId ||
// // //           !fields.supplierId ||
// // //           !fields.productId ||
// // //           quantity < 1 ||
// // //           fields.unitCost === "" ||
// // //           Number(fields.unitCost) < 0
// // //         ) {
// // //           throw new Error(
// // //             "Select a store, supplier, and product, and enter a valid quantity and unit cost.",
// // //           );
// // //         }
// // //         const product = products.find(
// // //           (entry) => entry.id === fields.productId,
// // //         )!;
// // //         const variants = getVariants(product);
// // //         await onCreatePurchaseOrder({
// // //           storeId: fields.storeId,
// // //           supplierId: fields.supplierId,
// // //           status: "DRAFT",
// // //           currencyCode: "MMK",
// // //           expectedDate: fields.expectedDate || undefined,
// // //           subTotal: poTotal,
// // //           taxAmount: 0,
// // //           grandTotal: poTotal,
// // //           notes: fields.notes || undefined,
// // //           items: [
// // //             {
// // //               productId: product.id,
// // //               variantId: fields.variantId || variants[0]?.id || null,
// // //               quantity,
// // //               unitCost: Number(fields.unitCost),
// // //               totalCost: poTotal,
// // //             },
// // //           ],
// // //         });
// // //         pushToast("success", "Purchase order created as draft.");
// // //       } else if (module === "expenses") {
// // //         if (!selectedStoreId)
// // //           throw new Error(
// // //             "Select a store from the top bar before recording an expense.",
// // //           );
// // //         if (!fields.categoryId || Number(fields.amount) <= 0)
// // //           throw new Error(
// // //             "Select an expense category and enter an amount greater than zero.",
// // //           );
// // //         await onCreateExpense({
// // //           storeId: selectedStoreId,
// // //           categoryId: fields.categoryId,
// // //           amount: Number(fields.amount),
// // //           currencyCode: "MMK",
// // //           description: fields.description || undefined,
// // //           expenseDate: fields.expenseDate || undefined,
// // //         });
// // //         pushToast("success", "Expense recorded.");
// // //       } else if (module === "supplierPayments") {
// // //         if (!fields.supplierId || Number(fields.amount) <= 0)
// // //           throw new Error("Select a supplier and enter a payment amount.");
// // //         await onCreateSupplierPayment({
// // //           supplierId: fields.supplierId,
// // //           amount: Number(fields.amount),
// // //           currencyCode: "MMK",
// // //           paymentMethod: fields.paymentMethod,
// // //           referenceNumber: fields.referenceNumber || undefined,
// // //           note: fields.notes || undefined,
// // //         });
// // //         pushToast("success", "Supplier payment recorded.");
// // //       } else if (module === "transfers") {
// // //         if (!selectedStoreId)
// // //           throw new Error("Select a source store from the top bar first.");
// // //         if (!fields.toStoreId || transferItems.length === 0) {
// // //           throw new Error("Choose a destination store and add at least one item.");
// // //         }
// // //         if (fields.toStoreId === selectedStoreId)
// // //           throw new Error("Source and destination stores must be different.");
// // //         for (const item of transferItems) {
// // //           const product = products.find((entry) => entry.id === item.productId);
// // //           const variant = getVariants(product).find((entry) => entry.id === item.variantId);
// // //           if (!product || !variant) throw new Error("One of the selected product options is no longer available. Remove it and add it again.");
// // //           const available = Number(variant.availableStock ?? variant.stock ?? 0);
// // //           if (item.quantity > available) throw new Error(`Only ${available} unit(s) of ${product.name} · ${variant.name} remain at the source store.`);
// // //         }
// // //         await onCreateTransfer({
// // //           fromStoreId: selectedStoreId,
// // //           toStoreId: fields.toStoreId,
// // //           notes: fields.notes || undefined,
// // //           items: transferItems,
// // //         });
// // //         pushToast("success", `Sent ${transferItems.length} product option(s). The destination store can confirm receipt.`);
// // //         setTransferItems([]);
// // //       } else if (module === "returns") {
// // //         if (!selectedOrder || !orderItem)
// // //           throw new Error("Choose a completed order and an item to return.");
// // //         if (quantity < 1 || !fields.reason.trim())
// // //           throw new Error("Enter a quantity and a return reason.");
// // //         const remaining =
// // //           orderItem.quantity - Number(orderItem.returnedQuantity || 0);
// // //         if (quantity > remaining) {
// // //           throw new Error(
// // //             `Only ${remaining} unit(s) remain returnable on this line.`,
// // //           );
// // //         }
// // //         await onCreateReturn({
// // //           orderId: selectedOrder.id,
// // //           totalAmount: itemTotal,
// // //           refundMethod: fields.refundMethod,
// // //           refundStatus: "COMPLETED",
// // //           reason: fields.reason.trim(),
// // //           items: [
// // //             {
// // //               orderItemId: orderItem.id,
// // //               quantity,
// // //               refundAmount: itemTotal,
// // //               reason: fields.reason.trim(),
// // //             },
// // //           ],
// // //         });
// // //         pushToast("success", "Sales return processed.");
// // //       }

// // //       setDialog(false);
// // //     } catch (cause) {
// // //       setFormError(errorMessage(cause));
// // //     } finally {
// // //       setSaving(false);
// // //     }
// // //   };

// // //   const markOrdered = async (po: any) => {
// // //     setBusyId(`po:${po.id}`);
// // //     try {
// // //       await onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
// // //       pushToast("success", `${po.poNumber} marked as ordered.`);
// // //     } catch (cause) {
// // //       pushToast("error", errorMessage(cause));
// // //     } finally {
// // //       setBusyId(null);
// // //     }
// // //   };

// // //   const openReceive = (po: any) => {
// // //     // Prefer the store on the PO itself — fall back to the active store.
// // //     const target = po.storeId || selectedStoreId || stores[0]?.id || "";
// // //     setReceiveStoreId(target);
// // //     setReceiveError("");
// // //     setTrackReceivedLots(false);
// // //     setReceiveLots(
// // //       Object.fromEntries(
// // //         (po.items ?? []).map((item: any) => [
// // //           item.id,
// // //           { number: "", expiryDate: "" },
// // //         ]),
// // //       ),
// // //     );
// // //     setReceiveTarget(po);
// // //   };

// // //   const confirmReceive = async () => {
// // //     if (!receiveTarget) return;
// // //     const targetStore =
// // //       receiveStoreId || selectedStoreId || stores[0]?.id || "";
// // //     if (!targetStore) {
// // //       setReceiveError("Select a store to receive the stock into.");
// // //       return;
// // //     }

// // //     let lots:
// // //       | { purchaseOrderItemId: string; number: string; expiryDate?: string }[]
// // //       | undefined;

// // //     if (trackReceivedLots) {
// // //       const lines = (receiveTarget.items ?? []).map((item: any) => ({
// // //         id: item.id,
// // //         name: item.product?.name || "Product",
// // //         number: (receiveLots[item.id]?.number ?? "").trim(),
// // //         expiryDate: receiveLots[item.id]?.expiryDate || "",
// // //       }));
// // //       const missing = lines.find((line: any) => !line.number);
// // //       if (missing) {
// // //         setReceiveError(
// // //           `Enter a batch / lot number for “${missing.name}”, or turn lot tracking off.`,
// // //         );
// // //         return;
// // //       }
// // //       lots = lines.map((line: any) => ({
// // //         purchaseOrderItemId: line.id,
// // //         number: line.number,
// // //         expiryDate: line.expiryDate || undefined,
// // //       }));
// // //     }

// // //     setReceiving(true);
// // //     setReceiveError("");
// // //     try {
// // //       await onReceivePurchaseOrder(receiveTarget.id, targetStore, lots);
// // //       pushToast(
// // //         "success",
// // //         `${receiveTarget.poNumber} received. Inventory has been updated.`,
// // //       );
// // //       setReceiveTarget(null);
// // //     } catch (cause) {
// // //       setReceiveError(errorMessage(cause));
// // //     } finally {
// // //       setReceiving(false);
// // //     }
// // //   };

// // //   const openCompleteTransfer = (transfer: any) => {
// // //     setTransferError("");
// // //     setTransferTarget(transfer);
// // //   };

// // //   const executeCompleteTransfer = async () => {
// // //     if (!transferTarget) return;
// // //     setCompleting(true);
// // //     setTransferError("");
// // //     try {
// // //       await onCompleteTransfer(transferTarget.id);
// // //       pushToast(
// // //         "success",
// // //         `Transfer ${transferTarget.transferNumber} received. Destination stock has been updated.`,
// // //       );
// // //       setTransferTarget(null);
// // //     } catch (cause) {
// // //       setTransferError(errorMessage(cause));
// // //     } finally {
// // //       setCompleting(false);
// // //     }
// // //   };

// // //   const addExpenseCategory = async (event: FormEvent) => {
// // //     event.preventDefault();
// // //     const name = categoryName.trim();
// // //     if (!name) {
// // //       setFormError("Enter a category name.");
// // //       return;
// // //     }
// // //     setSaving(true);
// // //     setFormError("");
// // //     try {
// // //       await onCreateExpenseCategory(name);
// // //       setCategoryDialog(false);
// // //       setCategoryName("");
// // //       pushToast("success", "Expense category created.");
// // //     } catch (cause) {
// // //       setFormError(errorMessage(cause));
// // //     } finally {
// // //       setSaving(false);
// // //     }
// // //   };

// // //   /* ----------------------------- render --------------------------- */

// // //   return (
// // //     <main className="flex-1 overflow-y-auto p-7">
// // //       <header className="mb-6">
// // //         <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
// // //           Enterprise operations
// // //         </p>
// // //         <h1 className="mt-2 text-3xl font-black text-white">ERP</h1>
// // //         <p className="mt-1 text-sm text-slate-400">
// // //           Purchasing, costs, supplier settlement, branch stock and returns.
// // //         </p>
// // //       </header>

// // //       <WorkflowGuide />

// // //       {/* Toasts */}
// // //       <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-80 flex-col gap-2">
// // //         {toasts.map((toast) => (
// // //           <div
// // //             key={toast.id}
// // //             role="status"
// // //             className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
// // //               toast.tone === "success"
// // //                 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
// // //                 : "border-rose-500/30 bg-rose-500/10 text-rose-200"
// // //             }`}
// // //           >
// // //             {toast.tone === "success" ? (
// // //               <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
// // //             ) : (
// // //               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
// // //             )}
// // //             <span className="flex-1 leading-5">{toast.message}</span>
// // //             <button
// // //               type="button"
// // //               aria-label="Dismiss notification"
// // //               onClick={() => dismissToast(toast.id)}
// // //               className="opacity-60 transition-opacity hover:opacity-100"
// // //             >
// // //               <X className="h-4 w-4" />
// // //             </button>
// // //           </div>
// // //         ))}
// // //       </div>

// // //       <nav className="mb-5 flex flex-wrap gap-2">
// // //         {MODULES.map(({ id, label, icon: Icon }) => (
// // //           <button
// // //             key={id}
// // //             type="button"
// // //             onClick={() => switchModule(id)}
// // //             aria-current={module === id}
// // //             className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors ${
// // //               module === id
// // //                 ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
// // //                 : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
// // //             }`}
// // //           >
// // //             <Icon className="h-4 w-4" />
// // //             {label}
// // //           </button>
// // //         ))}
// // //       </nav>

// // //       {module === "reports" ? (
// // //         <Reports
// // //           orders={orders}
// // //           expenses={expenses}
// // //           purchaseOrders={purchaseOrders}
// // //         />
// // //       ) : (
// // //         <>
// // //           <section className="mb-4 flex flex-wrap items-center gap-3">
// // //             <input
// // //               value={search}
// // //               onChange={(event) => setSearch(event.target.value)}
// // //               placeholder="Search records"
// // //               aria-label="Search records"
// // //               className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
// // //             />

// // //             {module === "expenses" && (
// // //               <button
// // //                 type="button"
// // //                 onClick={() => {
// // //                   setCategoryName("");
// // //                   setFormError("");
// // //                   setCategoryDialog(true);
// // //                 }}
// // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
// // //               >
// // //                 Expense categories
// // //               </button>
// // //             )}

// // //             <button
// // //               type="button"
// // //               onClick={openDialog}
// // //               className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400"
// // //             >
// // //               <Plus className="h-4 w-4" />
// // //               {module === "purchasing"
// // //                 ? "New purchase order"
// // //                 : module === "expenses"
// // //                   ? "Record expense"
// // //                   : module === "supplierPayments"
// // //                     ? "Record payment"
// // //                     : module === "transfers"
// // //                       ? "Request transfer"
// // //                       : "Process return"}
// // //             </button>
// // //           </section>

// // //           {statusOptions.length > 1 && (
// // //             <div className="mb-4 flex flex-wrap items-center gap-2">
// // //               {statusOptions.map((status) => (
// // //                 <button
// // //                   key={status}
// // //                   type="button"
// // //                   onClick={() => setStatusFilter(status)}
// // //                   className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
// // //                     statusFilter === status
// // //                       ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
// // //                       : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
// // //                   }`}
// // //                 >
// // //                   {status === "ALL" ? "All" : status.replace(/_/g, " ")}
// // //                 </button>
// // //               ))}
// // //             </div>
// // //           )}

// // //           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// // //             <div className="overflow-x-auto">
// // //               <div className="min-w-[980px]">
// // //                 <ListHeader cols={cols} />

// // //                 {loading ? (
// // //                   <p className="flex items-center justify-center gap-2 p-10 text-center text-sm text-slate-400">
// // //                     <Loader2 className="h-4 w-4 animate-spin" />
// // //                     Loading ERP records…
// // //                   </p>
// // //                 ) : visibleRecords.length === 0 ? (
// // //                   <p className="p-10 text-center text-sm text-slate-400">
// // //                     {records.length === 0
// // //                       ? "No records found."
// // //                       : "No records match the current filter."}
// // //                   </p>
// // //                 ) : (
// // //                   visibleRecords.map((record: any) => (
// // //                     <div
// // //                       key={record.id}
// // //                       style={gridStyle}
// // //                       className="grid items-center gap-4 border-b border-slate-800/70 px-5 py-4 text-xs last:border-0"
// // //                     >
// // //                       {module === "purchasing" ? (
// // //                         <>
// // //                           <span className="font-bold text-white">
// // //                             {record.poNumber}
// // //                           </span>
// // //                           <span className="truncate text-slate-300">
// // //                             {record.supplier?.name || "—"}
// // //                           </span>
// // //                           <span className="truncate text-slate-300">
// // //                             {record.store?.name ||
// // //                               stores.find((s) => s.id === record.storeId)
// // //                                 ?.name ||
// // //                               "—"}
// // //                           </span>
// // //                           <span className="text-slate-400">
// // //                             {dateText(record.orderDate)}
// // //                           </span>
// // //                           <span className="font-semibold text-white">
// // //                             {amount(record.grandTotal)}
// // //                           </span>
// // //                           <span className="text-amber-300">
// // //                             {record.status?.replace(/_/g, " ")}
// // //                           </span>
// // //                           <span className="flex flex-wrap gap-1">
// // //                             {record.status === "DRAFT" && (
// // //                               <button
// // //                                 type="button"
// // //                                 onClick={() => void markOrdered(record)}
// // //                                 disabled={busyId === `po:${record.id}`}
// // //                                 className="flex items-center gap-1 rounded-lg bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
// // //                               >
// // //                                 {busyId === `po:${record.id}` && (
// // //                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
// // //                                 )}
// // //                                 Mark ordered
// // //                               </button>
// // //                             )}
// // //                             {RECEIVABLE_STATUSES.includes(record.status) && (
// // //                               <button
// // //                                 type="button"
// // //                                 onClick={() => openReceive(record)}
// // //                                 className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
// // //                               >
// // //                                 <ClipboardCheck className="h-3.5 w-3.5" />
// // //                                 Receive
// // //                               </button>
// // //                             )}
// // //                             {record.status === "RECEIVED" && (
// // //                               <span className="text-[11px] font-medium text-emerald-400/80">
// // //                                 ✓ Received
// // //                               </span>
// // //                             )}
// // //                           </span>
// // //                         </>
// // //                       ) : module === "expenses" ? (
// // //                         <>
// // //                           <span className="font-semibold text-white">
// // //                             {record.category?.name || "—"}
// // //                           </span>
// // //                           <span className="truncate text-slate-300">
// // //                             {record.description || "—"}
// // //                           </span>
// // //                           <span className="text-slate-400">
// // //                             {dateText(record.expenseDate)}
// // //                           </span>
// // //                           <span className="truncate text-slate-400">
// // //                             {record.store?.name || "—"}
// // //                           </span>
// // //                           <span className="text-right font-bold text-white">
// // //                             {amount(record.amount)}
// // //                           </span>
// // //                         </>
// // //                       ) : module === "supplierPayments" ? (
// // //                         <>
// // //                           <span className="truncate font-semibold text-white">
// // //                             {record.supplier?.name || "—"}
// // //                           </span>
// // //                           <span className="text-slate-400">
// // //                             {dateText(record.paidAt)}
// // //                           </span>
// // //                           <span className="text-slate-300">
// // //                             {record.paymentMethod?.replace(/_/g, " ")}
// // //                           </span>
// // //                           <span className="truncate text-slate-400">
// // //                             {record.referenceNumber || "—"}
// // //                           </span>
// // //                           <span className="text-right font-bold text-white">
// // //                             {amount(record.amount)}
// // //                           </span>
// // //                         </>
// // //                       ) : module === "transfers" ? (
// // //                         <>
// // //                           <span className="font-bold text-white">
// // //                             {record.transferNumber}
// // //                           </span>
// // //                           <span className="truncate text-slate-300">
// // //                             {record.fromStore?.name} → {record.toStore?.name}
// // //                           </span>
// // //                           <span className="text-slate-400">
// // //                             {dateText(record.requestedAt)}
// // //                           </span>
// // //                           <span className="text-slate-400">
// // //                             {record.items?.length || 0} lines
// // //                           </span>
// // //                           <span
// // //                             className={
// // //                               record.status === "RECEIVED"
// // //                                 ? "font-bold text-emerald-400"
// // //                                 : "font-bold text-amber-300"
// // //                             }
// // //                           >
// // //                             {transferStatusLabel(record.status)}
// // //                           </span>
// // //                           <span>
// // //                             {RECEIVABLE_TRANSFER_STATUSES.includes(record.status) &&
// // //                             (userRole === "SUPER_ADMIN" || record.toStoreId === selectedStoreId) ? (
// // //                               <button
// // //                                 type="button"
// // //                                 onClick={() => openCompleteTransfer(record)}
// // //                                 disabled={
// // //                                   completing ||
// // //                                   busyId === `transfer:${record.id}`
// // //                                 }
// // //                                 className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
// // //                               >
// // //                                 {busyId === `transfer:${record.id}` && (
// // //                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
// // //                                 )}
// // //                                 Receive stock
// // //                               </button>
// // //                             ) : (
// // //                               <span className="text-[11px] font-medium text-slate-400">
// // //                                 {record.status === "RECEIVED"
// // //                                   ? "✓ Received"
// // //                                   : record.status === "IN_TRANSIT"
// // //                                     ? "Sent · awaiting receipt"
// // //                                     : "Awaiting dispatch"}
// // //                               </span>
// // //                             )}
// // //                           </span>
// // //                         </>
// // //                       ) : (
// // //                         <>
// // //                           <span className="font-bold text-white">
// // //                             {record.returnNumber}
// // //                           </span>
// // //                           <span className="text-slate-300">
// // //                             {record.order?.orderNumber ||
// // //                               record.orderId?.slice(0, 8) ||
// // //                               "—"}
// // //                           </span>
// // //                           <span className="truncate text-slate-400">
// // //                             {record.customer?.name || "Walk-in"}
// // //                           </span>
// // //                           <span className="text-slate-400">
// // //                             {dateText(record.createdAt)}
// // //                           </span>
// // //                           <span className="font-bold text-white">
// // //                             {amount(record.totalAmount)}
// // //                           </span>
// // //                           <span className="text-emerald-300">
// // //                             {record.refundStatus}
// // //                           </span>
// // //                         </>
// // //                       )}
// // //                     </div>
// // //                   ))
// // //                 )}
// // //               </div>
// // //             </div>
// // //           </section>
// // //         </>
// // //       )}

// // //       {/* ------------------------------------------------------------ */}
// // //       {/*  Receive purchase order modal                                 */}
// // //       {/* ------------------------------------------------------------ */}
// // //       <Modal
// // //         open={Boolean(receiveTarget)}
// // //         onClose={() => !receiving && setReceiveTarget(null)}
// // //         labelledBy="receive-modal-title"
// // //       >
// // //         {receiveTarget && (
// // //           <>
// // //             <h2
// // //               id="receive-modal-title"
// // //               className="text-xl font-bold text-white"
// // //             >
// // //               Receive {receiveTarget.poNumber}
// // //             </h2>
// // //             <p className="mt-1 text-xs text-slate-400">
// // //               Record delivered products into the purchase order’s destination store.
// // //             </p>

// // //             <div className="mt-4">
// // //               <label className="mb-1.5 block text-xs font-medium text-slate-300">
// // //                 Destination store / branch
// // //               </label>
// // //               <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
// // //                 {stores.find((store) => store.id === receiveStoreId)?.name ||
// // //                   receiveTarget.store?.name || "Assigned destination"}
// // //               </div>
// // //             </div>

// // //             <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
// // //               <input
// // //                 type="checkbox"
// // //                 checked={trackReceivedLots}
// // //                 onChange={(event) => setTrackReceivedLots(event.target.checked)}
// // //                 className="accent-emerald-500"
// // //               />
// // //               Track batch / lot numbers and expiry
// // //             </label>

// // //             {trackReceivedLots && (
// // //               <div className="mt-4 space-y-3">
// // //                 {(receiveTarget.items ?? []).map((item: any) => (
// // //                   <article
// // //                     key={item.id}
// // //                     className="rounded-xl border border-slate-800 p-3"
// // //                   >
// // //                     <p className="mb-3 text-sm font-semibold text-white">
// // //                       {item.product?.name || "Product"}
// // //                       {item.variant?.name ? ` · ${item.variant.name}` : ""}{" "}
// // //                       <span className="text-slate-400">× {item.quantity}</span>
// // //                     </p>
// // //                     <div className="grid gap-3 sm:grid-cols-2">
// // //                       <Field
// // //                         label="Batch / lot number"
// // //                         value={receiveLots[item.id]?.number ?? ""}
// // //                         onChange={(value) =>
// // //                           setReceiveLots((current) => ({
// // //                             ...current,
// // //                             [item.id]: { ...current[item.id], number: value },
// // //                           }))
// // //                         }
// // //                         required
// // //                       />
// // //                       <Field
// // //                         label="Expiry date (optional)"
// // //                         type="date"
// // //                         value={receiveLots[item.id]?.expiryDate ?? ""}
// // //                         onChange={(value) =>
// // //                           setReceiveLots((current) => ({
// // //                             ...current,
// // //                             [item.id]: {
// // //                               ...current[item.id],
// // //                               expiryDate: value,
// // //                             },
// // //                           }))
// // //                         }
// // //                       />
// // //                     </div>
// // //                   </article>
// // //                 ))}
// // //               </div>
// // //             )}

// // //             <ErrorNote message={receiveError} />

// // //             <div className="mt-6 flex justify-end gap-3">
// // //               <button
// // //                 type="button"
// // //                 onClick={() => setReceiveTarget(null)}
// // //                 disabled={receiving}
// // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// // //               >
// // //                 Cancel
// // //               </button>
// // //               <button
// // //                 type="button"
// // //                 onClick={() => void confirmReceive()}
// // //                 disabled={receiving}
// // //                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
// // //               >
// // //                 {receiving && <Loader2 className="h-4 w-4 animate-spin" />}
// // //                 {receiving ? "Receiving…" : "Receive stock"}
// // //               </button>
// // //             </div>
// // //           </>
// // //         )}
// // //       </Modal>

// // //       {/* ------------------------------------------------------------ */}
// // //       {/*  Complete transfer modal                                      */}
// // //       {/* ------------------------------------------------------------ */}
// // //       <Modal
// // //         open={Boolean(transferTarget)}
// // //         onClose={() => !completing && setTransferTarget(null)}
// // //         labelledBy="transfer-modal-title"
// // //         maxWidth="max-w-lg"
// // //       >
// // //         {transferTarget && (
// // //           <>
// // //             <div className="mb-2 flex items-center gap-3 text-emerald-400">
// // //               <ArrowLeftRight className="h-6 w-6" />
// // //               <h2
// // //                 id="transfer-modal-title"
// // //                 className="text-xl font-bold text-white"
// // //               >
// // //                 Accept transfer {transferTarget.transferNumber}
// // //               </h2>
// // //             </div>
// // //             <p className="text-xs text-slate-300">
// // //                 Confirm the full shipment arrived. Stock is added to this
// // //                 store only after you receive it. Record any shortage or damage
// // //                 as a stock adjustment afterward.
// // //             </p>

// // //             <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
// // //               <div className="flex justify-between border-b border-slate-900 py-1">
// // //                 <span className="text-slate-400">Source (deducting from):</span>
// // //                 <span className="font-semibold text-rose-300">
// // //                   {transferTarget.fromStore?.name || "Source store"}
// // //                 </span>
// // //               </div>
// // //               <div className="flex justify-between border-b border-slate-900 py-1">
// // //                 <span className="text-slate-400">Destination (adding to):</span>
// // //                 <span className="font-semibold text-emerald-300">
// // //                   {transferTarget.toStore?.name || "Destination store"}
// // //                 </span>
// // //               </div>
// // //               <div className="flex justify-between border-b border-slate-900 py-1">
// // //                 <span className="text-slate-400">Requested:</span>
// // //                 <span className="text-slate-200">
// // //                   {dateText(transferTarget.requestedAt)}
// // //                 </span>
// // //               </div>
// // //               <div className="flex justify-between py-1">
// // //                 <span className="text-slate-400">Total lines:</span>
// // //                 <span className="font-semibold text-slate-200">
// // //                   {transferTarget.items?.length || 0} items
// // //                 </span>
// // //               </div>
// // //             </div>

// // //             {transferTarget.items?.length > 0 && (
// // //               <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs">
// // //                 <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">
// // //                   Items to transfer:
// // //                 </p>
// // //                 {transferTarget.items.map((item: any) => (
// // //                   <div
// // //                     key={item.id}
// // //                     className="flex justify-between border-b border-slate-900/60 py-0.5 text-slate-300 last:border-0"
// // //                   >
// // //                     <span className="truncate pr-2">
// // //                       {item.product?.name || "Product"}
// // //                       {item.variant?.name ? ` (${item.variant.name})` : ""}
// // //                     </span>
// // //                     <span className="shrink-0 font-bold text-white">
// // //                       × {item.quantity}
// // //                     </span>
// // //                   </div>
// // //                 ))}
// // //               </div>
// // //             )}

// // //             <ErrorNote message={transferError} />

// // //             <div className="mt-6 flex justify-end gap-3">
// // //               <button
// // //                 type="button"
// // //                 onClick={() => setTransferTarget(null)}
// // //                 disabled={completing}
// // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// // //               >
// // //                 Cancel
// // //               </button>
// // //               <button
// // //                 type="button"
// // //                 onClick={() => void executeCompleteTransfer()}
// // //                 disabled={completing}
// // //                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
// // //               >
// // //                 {completing && <Loader2 className="h-4 w-4 animate-spin" />}
// // //                 {completing ? "Processing…" : "Confirm & receive stock"}
// // //               </button>
// // //             </div>
// // //           </>
// // //         )}
// // //       </Modal>

// // //       {/* ------------------------------------------------------------ */}
// // //       {/*  Create / category dialog                                     */}
// // //       {/* ------------------------------------------------------------ */}
// // //       <Modal
// // //         open={dialog || categoryDialog}
// // //         maxWidth={module === "transfers" ? "max-w-5xl" : "max-w-4xl"}
// // //         onClose={() => {
// // //           if (saving) return;
// // //           setDialog(false);
// // //           setCategoryDialog(false);
// // //         }}
// // //         labelledBy="erp-form-title"
// // //       >
// // //         <form onSubmit={categoryDialog ? addExpenseCategory : submit}>
// // //           <h2 id="erp-form-title" className="text-xl font-bold text-white">
// // //             {categoryDialog
// // //               ? "Add expense category"
// // //               : module === "purchasing"
// // //                 ? "New purchase order"
// // //                 : module === "expenses"
// // //                   ? "Record expense"
// // //                   : module === "supplierPayments"
// // //                     ? "Record supplier payment"
// // //                     : module === "transfers"
// // //                       ? "Send stock"
// // //                       : "Process sales return"}
// // //           </h2>
// // //           <p className="mb-5 mt-1 text-xs text-slate-400">
// // //             This action is recorded on the server and may update inventory or
// // //             balances.
// // //           </p>

// // //           {categoryDialog ? (
// // //             <Field
// // //               label="Category name"
// // //               value={categoryName}
// // //               onChange={setCategoryName}
// // //               required
// // //               disabled={saving}
// // //             />
// // //           ) : module === "purchasing" ? (
// // //             <div className="space-y-3">
// // //               {/* Destination store — required so received stock lands in the right branch */}
// // //               <Select
// // //                 label="Destination store"
// // //                 value={fields.storeId}
// // //                 onChange={(value) => setFields({ ...fields, storeId: value })}
// // //                 options={stores.map((item) => [item.id, item.name])}
// // //               />

// // //               <Select
// // //                 label="Supplier"
// // //                 value={fields.supplierId}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, supplierId: value })
// // //                 }
// // //                 options={suppliers.map((item) => [
// // //                   item.id,
// // //                   `${item.name} (${item.code ?? "—"})`,
// // //                 ])}
// // //               />

// // //               <Select
// // //                 label="Product"
// // //                 value={fields.productId}
// // //                 onChange={(value) => {
// // //                   const next = products.find((p) => p.id === value);
// // //                   setFields({
// // //                     ...fields,
// // //                     productId: value,
// // //                     variantId: getVariants(next)[0]?.id || "",
// // //                   });
// // //                 }}
// // //                 options={products.map((item) => [
// // //                   item.id,
// // //                   `${item.name} · ${item.sku}`,
// // //                 ])}
// // //               />

// // //               {selectedProductVariants.length > 0 && (
// // //                 <Select
// // //                   label="Variant"
// // //                   value={fields.variantId}
// // //                   onChange={(value) =>
// // //                     setFields({ ...fields, variantId: value })
// // //                   }
// // //                   options={selectedProductVariants.map((variant) => [
// // //                     variant.id,
// // //                     `${variant.name}${variant.sku ? ` · ${variant.sku}` : ""}`,
// // //                   ])}
// // //                 />
// // //               )}

// // //               <div className="grid grid-cols-2 gap-3">
// // //                 <Field
// // //                   label="Quantity"
// // //                   type="number"
// // //                   min="1"
// // //                   value={fields.quantity}
// // //                   onChange={(value) =>
// // //                     setFields({ ...fields, quantity: value })
// // //                   }
// // //                   required
// // //                 />
// // //                 <Field
// // //                   label="Unit cost"
// // //                   type="number"
// // //                   min="0"
// // //                   step="0.01"
// // //                   value={fields.unitCost}
// // //                   onChange={(value) =>
// // //                     setFields({ ...fields, unitCost: value })
// // //                   }
// // //                   required
// // //                 />
// // //               </div>
// // //               <p className="text-right text-sm font-bold text-white">
// // //                 Subtotal {amount(poTotal)}
// // //               </p>
// // //               <Field
// // //                 label="Expected date"
// // //                 type="date"
// // //                 value={fields.expectedDate}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, expectedDate: value })
// // //                 }
// // //               />
// // //               <Field
// // //                 label="Notes"
// // //                 value={fields.notes}
// // //                 onChange={(value) => setFields({ ...fields, notes: value })}
// // //               />
// // //             </div>
// // //           ) : module === "expenses" ? (
// // //             <div className="space-y-3">
// // //               {!selectedStoreId && (
// // //                 <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
// // //                   Select a store in the top bar before recording an expense.
// // //                 </p>
// // //               )}
// // //               <Select
// // //                 label="Expense category"
// // //                 value={fields.categoryId}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, categoryId: value })
// // //                 }
// // //                 options={expenseCategories.map((item) => [item.id, item.name])}
// // //               />
// // //               <Field
// // //                 label="Amount"
// // //                 type="number"
// // //                 min="0.01"
// // //                 step="0.01"
// // //                 value={fields.amount}
// // //                 onChange={(value) => setFields({ ...fields, amount: value })}
// // //                 required
// // //               />
// // //               <Field
// // //                 label="Date"
// // //                 type="date"
// // //                 value={fields.expenseDate}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, expenseDate: value })
// // //                 }
// // //                 required
// // //               />
// // //               <Field
// // //                 label="Description"
// // //                 value={fields.description}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, description: value })
// // //                 }
// // //               />
// // //             </div>
// // //           ) : module === "supplierPayments" ? (
// // //             <div className="space-y-3">
// // //               <Select
// // //                 label="Supplier"
// // //                 value={fields.supplierId}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, supplierId: value })
// // //                 }
// // //                 options={suppliers.map((item) => [item.id, item.name])}
// // //               />
// // //               <Field
// // //                 label="Amount"
// // //                 type="number"
// // //                 min="0.01"
// // //                 step="0.01"
// // //                 value={fields.amount}
// // //                 onChange={(value) => setFields({ ...fields, amount: value })}
// // //                 required
// // //               />
// // //               <Select
// // //                 label="Payment method"
// // //                 value={fields.paymentMethod}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, paymentMethod: value })
// // //                 }
// // //                 options={PAYMENT_METHODS.map((value) => [
// // //                   value,
// // //                   value.split("_").join(" "),
// // //                 ])}
// // //               />
// // //               <Field
// // //                 label="Reference number"
// // //                 value={fields.referenceNumber}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, referenceNumber: value })
// // //                 }
// // //               />
// // //               <Field
// // //                 label="Note"
// // //                 value={fields.notes}
// // //                 onChange={(value) => setFields({ ...fields, notes: value })}
// // //               />
// // //             </div>
// // //           ) : module === "transfers" ? (
// // //             <div className="space-y-3">
// // //               <p className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs leading-relaxed text-sky-200">Add all options to one shipment. Sending deducts source stock; the destination adds it after confirming delivery.</p>
// // //               <p className="text-xs text-slate-400">
// // //                 Source store:{" "}
// // //                 <strong className="text-white">
// // //                   {stores.find((item) => item.id === selectedStoreId)?.name ||
// // //                     "Select a store first"}
// // //                 </strong>
// // //               </p>
// // //               <ChoiceCards
// // //                 label="Destination"
// // //                 value={fields.toStoreId}
// // //                 onChange={(value) => setFields((current) => ({ ...current, toStoreId: value }))}
// // //                 columns={3}
// // //                 options={transferDestinationStores
// // //                   .filter((item) => item.id !== selectedStoreId)
// // //                   .map((item) => ({
// // //                     value: item.id,
// // //                     label: item.name,
// // //                     description: "Receiving branch",
// // //                   }))}
// // //               />
// // //               <SearchableProductPicker
// // //                 products={products}
// // //                 value={fields.productId}
// // //                 onChange={(value) => {
// // //                   const next = products.find((p) => p.id === value);
// // //                   setFields({
// // //                     ...fields,
// // //                     productId: value,
// // //                     variantId: getVariants(next).length === 1 ? getVariants(next)[0].id : "",
// // //                   });
// // //                 }}
// // //               />
// // //               {selectedProductVariants.length > 0 && (
// // //                 <ChoiceCards
// // //                   label="Variant"
// // //                   value={fields.variantId}
// // //                   onChange={(value) => setFields((current) => ({ ...current, variantId: value }))}
// // //                   columns={2}
// // //                   options={selectedProductVariants.map((variant) => {
// // //                     const available = Number(variant.availableStock ?? variant.stock ?? 0);
// // //                     return {
// // //                       value: variant.id,
// // //                       label: variant.name,
// // //                       description: `${available.toLocaleString()} units available to send`,
// // //                       badge: variant.sku,
// // //                       disabled: available < 1,
// // //                     };
// // //                   })}
// // //                 />
// // //               )}
// // //               {selectedProduct && selectedProductVariants.length === 0 && (
// // //                 <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">This product has no active options to transfer.</p>
// // //               )}
// // //               {selectedVariant && (
// // //                 <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs">
// // //                   <span className="text-slate-400">At source · {selectedVariant.name}</span>
// // //                   <span className={`font-bold ${transferQuantity > sourceRemaining ? "text-rose-300" : "text-white"}`}>
// // //                     {sourceOnHand.toLocaleString()} available to send
// // //                     {alreadyInTransfer > 0 && ` · ${alreadyInTransfer} in shipment`}
// // //                     {transferQuantity > 0 && ` · ${Math.max(0, sourceOnHand - alreadyInTransfer - transferQuantity).toLocaleString()} left`}
// // //                   </span>
// // //                 </div>
// // //               )}
// // //               <Field
// // //                 label="Units to add"
// // //                 type="number"
// // //                 min="1"
// // //                 max={sourceOnHand}
// // //                 value={fields.quantity}
// // //                 onChange={(value) => setFields({ ...fields, quantity: value })}
// // //               />
// // //               <button
// // //                 type="button"
// // //                 onClick={addTransferItem}
// // //                 disabled={!selectedProduct || !selectedVariant || transferQuantity < 1 || transferQuantity > sourceRemaining}
// // //                 className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
// // //               >
// // //                 <Plus className="h-4 w-4" /> Add option to shipment
// // //               </button>
// // //               {transferItems.length > 0 && (
// // //                 <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
// // //                   <div className="mb-2 flex items-center justify-between text-xs">
// // //                     <span className="font-bold text-white">Shipment items</span>
// // //                     <span className="text-slate-500">{transferItems.length} options · {transferItems.reduce((sum, item) => sum + item.quantity, 0)} units</span>
// // //                   </div>
// // //                   <div className="max-h-48 space-y-1 overflow-y-auto">
// // //                     {transferItems.map((item) => {
// // //                       const product = products.find((entry) => entry.id === item.productId);
// // //                       const variant = getVariants(product).find((entry) => entry.id === item.variantId);
// // //                       return (
// // //                         <div key={`${item.productId}:${item.variantId}`} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
// // //                           <span className="min-w-0 flex-1">
// // //                             <span className="block truncate text-xs font-semibold text-slate-200">{product?.name || "Product"} · {variant?.name || "Option"}</span>
// // //                             <span className="block text-[10px] text-slate-500">{product?.sku || ""}</span>
// // //                           </span>
// // //                           <span className="shrink-0 text-xs font-bold text-white">× {item.quantity}</span>
// // //                           <button type="button" aria-label={`Remove ${product?.name || "item"}`} onClick={() => setTransferItems((current) => current.filter((entry) => entry.productId !== item.productId || entry.variantId !== item.variantId))} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
// // //                         </div>
// // //                       );
// // //                     })}
// // //                   </div>
// // //                 </div>
// // //               )}
// // //               <Field
// // //                 label="Notes"
// // //                 value={fields.notes}
// // //                 onChange={(value) => setFields({ ...fields, notes: value })}
// // //               />
// // //             </div>
// // //           ) : (
// // //             <div className="space-y-3">
// // //               <Select
// // //                 label="Completed order"
// // //                 value={fields.orderId}
// // //                 onChange={(value) => {
// // //                   const order = orders.find((entry) => entry.id === value);
// // //                   setFields({
// // //                     ...fields,
// // //                     orderId: value,
// // //                     orderItemId: order?.items?.[0]?.id || "",
// // //                   });
// // //                 }}
// // //                 options={orders
// // //                   .filter(isReturnable)
// // //                   .map((order) => [
// // //                     order.id,
// // //                     `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
// // //                   ])}
// // //               />
// // //               <Select
// // //                 label="Returned item"
// // //                 value={fields.orderItemId}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, orderItemId: value })
// // //                 }
// // //                 options={(selectedOrder?.items || []).map((item) => [
// // //                   item.id,
// // //                   `${item.product?.name || "Product"} · qty ${item.quantity}`,
// // //                 ])}
// // //               />
// // //               {orderItem && (
// // //                 <p className="text-xs text-slate-400">
// // //                   Remaining returnable:{" "}
// // //                   <strong className="text-white">
// // //                     {orderItem.quantity -
// // //                       Number(orderItem.returnedQuantity || 0)}
// // //                   </strong>
// // //                 </p>
// // //               )}
// // //               <Field
// // //                 label="Quantity"
// // //                 type="number"
// // //                 min="1"
// // //                 max={Math.max(
// // //                   1,
// // //                   (orderItem?.quantity || 1) -
// // //                     Number(orderItem?.returnedQuantity || 0),
// // //                 )}
// // //                 value={fields.quantity}
// // //                 onChange={(value) => setFields({ ...fields, quantity: value })}
// // //                 required
// // //               />
// // //               <p className="text-right text-sm font-bold text-white">
// // //                 Refund total {amount(itemTotal)}
// // //               </p>
// // //               <Select
// // //                 label="Refund method"
// // //                 value={fields.refundMethod}
// // //                 onChange={(value) =>
// // //                   setFields({ ...fields, refundMethod: value })
// // //                 }
// // //                 options={PAYMENT_METHODS.map((value) => [
// // //                   value,
// // //                   value.split("_").join(" "),
// // //                 ])}
// // //               />
// // //               <Field
// // //                 label="Reason"
// // //                 value={fields.reason}
// // //                 onChange={(value) => setFields({ ...fields, reason: value })}
// // //                 required
// // //               />
// // //             </div>
// // //           )}

// // //           <ErrorNote message={formError} />

// // //           <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
// // //             <button
// // //               type="button"
// // //               onClick={() => {
// // //                 setDialog(false);
// // //                 setCategoryDialog(false);
// // //               }}
// // //               disabled={saving}
// // //               className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:py-2.5"
// // //             >
// // //               Cancel
// // //             </button>
// // //             <button
// // //               type="submit"
// // //               disabled={saving}
// // //               className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:opacity-50 sm:w-auto sm:py-2.5"
// // //             >
// // //               {saving && <Loader2 className="h-4 w-4 animate-spin" />}
// // //               {saving ? (module === "transfers" ? "Sending…" : "Saving…") : module === "transfers" ? "Send stock" : "Save"}
// // //             </button>
// // //           </div>
// // //         </form>
// // //       </Modal>
// // //     </main>
// // //   );
// // // }

// // // /* ------------------------------------------------------------------ */
// // // /*  Presentational helpers                                             */
// // // /* ------------------------------------------------------------------ */

// // // /**
// // //  * Modal — the `onClose` handler is stored in a ref so that inline
// // //  * callbacks from the parent don't re-run the effect on every keystroke.
// // //  * This is what previously stole focus from text inputs after one character.
// // //  */
// // // function Modal({
// // //   open,
// // //   onClose,
// // //   labelledBy,
// // //   children,
// // //   maxWidth = "max-w-xl",
// // // }: {
// // //   open: boolean;
// // //   onClose: () => void;
// // //   labelledBy: string;
// // //   children: React.ReactNode;
// // //   maxWidth?: string;
// // // }) {
// // //   const panelRef = useRef<HTMLDivElement>(null);
// // //   const onCloseRef = useRef(onClose);

// // //   // Keep the latest handler without re-running the effect.
// // //   useEffect(() => {
// // //     onCloseRef.current = onClose;
// // //   }, [onClose]);

// // //   useEffect(() => {
// // //     if (!open) return;

// // //     const handleKey = (event: KeyboardEvent) => {
// // //       if (event.key === "Escape") onCloseRef.current();
// // //     };
// // //     document.addEventListener("keydown", handleKey);

// // //     const previousOverflow = document.body.style.overflow;
// // //     document.body.style.overflow = "hidden";
// // //     // Focus the panel only once, when the modal opens.
// // //     panelRef.current?.focus();

// // //     return () => {
// // //       document.removeEventListener("keydown", handleKey);
// // //       document.body.style.overflow = previousOverflow;
// // //     };
// // //   }, [open]); // <-- ONLY `open`, not `onClose`

// // //   if (!open) return null;

// // //   return createPortal(
// // //     <div
// // //       className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
// // //       onMouseDown={onClose}
// // //       role="presentation"
// // //     >
// // //       <div
// // //         ref={panelRef}
// // //         role="dialog"
// // //         aria-modal="true"
// // //         aria-labelledby={labelledBy}
// // //         tabIndex={-1}
// // //         onMouseDown={(event) => event.stopPropagation()}
// // //         className={`max-h-[96dvh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-h-[92dvh] sm:rounded-2xl sm:p-6`}
// // //       >
// // //         {children}
// // //       </div>
// // //     </div>,
// // //     document.body,
// // //   );
// // // }

// // // function ErrorNote({ message }: { message: string }) {
// // //   if (!message) return null;
// // //   return (
// // //     <p
// // //       role="alert"
// // //       className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
// // //     >
// // //       <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
// // //       <span>{message}</span>
// // //     </p>
// // //   );
// // // }

// // // function ListHeader({ cols }: { cols: string[] }) {
// // //   return (
// // //     <div
// // //       className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
// // //       style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
// // //     >
// // //       {cols.map((col) => (
// // //         <span key={col}>{col}</span>
// // //       ))}
// // //     </div>
// // //   );
// // // }

// // // function Field({
// // //   label,
// // //   value,
// // //   onChange,
// // //   type = "text",
// // //   required,
// // //   min,
// // //   max,
// // //   step,
// // //   disabled,
// // // }: {
// // //   label: string;
// // //   value: string;
// // //   onChange: (value: string) => void;
// // //   type?: string;
// // //   required?: boolean;
// // //   min?: string;
// // //   max?: number;
// // //   step?: string;
// // //   disabled?: boolean;
// // // }) {
// // //   return (
// // //     <label className="block text-xs text-slate-400">
// // //       {label}
// // //       <input
// // //         required={required}
// // //         type={type}
// // //         min={min}
// // //         max={max}
// // //         step={step}
// // //         disabled={disabled}
// // //         value={value}
// // //         onChange={(event) => onChange(event.target.value)}
// // //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400 disabled:opacity-60"
// // //       />
// // //     </label>
// // //   );
// // // }

// // // function Select({
// // //   label,
// // //   value,
// // //   onChange,
// // //   options,
// // // }: {
// // //   label: string;
// // //   value: string;
// // //   onChange: (value: string) => void;
// // //   options: string[][];
// // // }) {
// // //   return (
// // //     <label className="block text-xs text-slate-400">
// // //       {label}
// // //       <select
// // //         required
// // //         value={value}
// // //         onChange={(event) => onChange(event.target.value)}
// // //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
// // //       >
// // //         <option value="">Choose…</option>
// // //         {options.map(([id, title]) => (
// // //           <option key={id} value={id}>
// // //             {title}
// // //           </option>
// // //         ))}
// // //       </select>
// // //       {options.length === 0 && (
// // //         <span className="mt-1 block text-amber-300">
// // //           Create the required record first.
// // //         </span>
// // //       )}
// // //     </label>
// // //   );
// // // }

// // // function Reports({
// // //   orders,
// // //   expenses,
// // //   purchaseOrders,
// // // }: {
// // //   orders: ApiOrder[];
// // //   expenses: any[];
// // //   purchaseOrders: any[];
// // // }) {
// // //   const revenue = orders
// // //     .filter(
// // //       (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
// // //     )
// // //     .reduce((sum, order) => sum + order.grandTotal, 0);

// // //   const operatingExpenses = expenses.reduce(
// // //     (sum, expense) => sum + Number(expense.amount || 0),
// // //     0,
// // //   );

// // //   const receivedOrders = purchaseOrders.filter(
// // //     (po) => po.status === "RECEIVED",
// // //   );
// // //   const procurement = receivedOrders.reduce(
// // //     (sum, po) => sum + Number(po.grandTotal || 0),
// // //     0,
// // //   );

// // //   const cards = [
// // //     [
// // //       "Recent completed sales",
// // //       amount(revenue),
// // //       `${orders.length} recent order records loaded`,
// // //     ],
// // //     [
// // //       "Recorded expenses",
// // //       amount(operatingExpenses),
// // //       `${expenses.length} expense records loaded`,
// // //     ],
// // //     [
// // //       "Received purchasing",
// // //       amount(procurement),
// // //       `${receivedOrders.length} purchase orders received`,
// // //     ],
// // //   ];

// // //   return (
// // //     <>
// // //       <section className="grid gap-4 md:grid-cols-3">
// // //         {cards.map(([title, total, note]) => (
// // //           <article
// // //             key={title}
// // //             className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
// // //           >
// // //             <p className="text-xs text-slate-400">{title}</p>
// // //             <p className="mt-3 text-2xl font-black text-white">{total}</p>
// // //             <p className="mt-2 text-xs text-slate-500">{note}</p>
// // //           </article>
// // //         ))}
// // //       </section>
// // //       <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
// // //         Operational summary only. This is not a profit-and-loss statement:
// // //         purchase values, unpaid liabilities, taxes, refunds and accounting
// // //         journals are not fully reconciled here. Sales are limited to recent
// // //         orders returned by the API.
// // //       </p>
// // //     </>
// // //   );
// // // }

// // // // import {
// // // //   FormEvent,
// // // //   useCallback,
// // // //   useEffect,
// // // //   useMemo,
// // // //   useRef,
// // // //   useState,
// // // // } from "react";
// // // // import { createPortal } from "react-dom";
// // // // import {
// // // //   AlertTriangle,
// // // //   ArrowLeftRight,
// // // //   BadgeDollarSign,
// // // //   CheckCircle2,
// // // //   ClipboardCheck,
// // // //   FileBarChart2,
// // // //   Loader2,
// // // //   Plus,
// // // //   Receipt,
// // // //   Truck,
// // // //   Undo2,
// // // //   X,
// // // // } from "lucide-react";
// // // // import { ApiOrder } from "../store/apiSlice";
// // // // import { Product } from "../types";
// // // // import { WorkflowGuide } from "./WorkflowGuide";

// // // // /* ------------------------------------------------------------------ */
// // // // /*  Types                                                              */
// // // // /* ------------------------------------------------------------------ */

// // // // type Module =
// // // //   | "purchasing"
// // // //   | "expenses"
// // // //   | "supplierPayments"
// // // //   | "transfers"
// // // //   | "returns"
// // // //   | "reports";

// // // // type Fields = Record<string, string>;

// // // // interface Props {
// // // //   selectedStoreId?: string;
// // // //   stores: { id: string; name: string }[];
// // // //   products: Product[];
// // // //   suppliers: any[];
// // // //   orders: ApiOrder[];
// // // //   purchaseOrders: any[];
// // // //   expenses: any[];
// // // //   expenseCategories: any[];
// // // //   supplierPayments: any[];
// // // //   transfers: any[];
// // // //   returns: any[];
// // // //   loading: boolean;
// // // //   onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>;
// // // //   onUpdatePurchaseOrder: (
// // // //     id: string,
// // // //     patch: Record<string, unknown>,
// // // //   ) => Promise<unknown>;
// // // //   onReceivePurchaseOrder: (
// // // //     id: string,
// // // //     storeId: string,
// // // //     lots?: {
// // // //       purchaseOrderItemId: string;
// // // //       number: string;
// // // //       expiryDate?: string;
// // // //     }[],
// // // //   ) => Promise<unknown>;
// // // //   onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>;
// // // //   onCreateExpenseCategory: (name: string) => Promise<unknown>;
// // // //   onCreateSupplierPayment: (
// // // //     payload: Record<string, unknown>,
// // // //   ) => Promise<unknown>;
// // // //   onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>;
// // // //   onCompleteTransfer: (id: string) => Promise<unknown>;
// // // //   onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
// // // // }

// // // // interface Toast {
// // // //   id: number;
// // // //   tone: "success" | "error";
// // // //   message: string;
// // // // }

// // // // /* ------------------------------------------------------------------ */
// // // // /*  Constants & helpers                                                */
// // // // /* ------------------------------------------------------------------ */

// // // // const MODULES: { id: Module; label: string; icon: typeof Truck }[] = [
// // // //   { id: "purchasing", label: "Purchasing", icon: Truck },
// // // //   { id: "expenses", label: "Expenses", icon: Receipt },
// // // //   { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
// // // //   { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
// // // //   { id: "returns", label: "Sales returns", icon: Undo2 },
// // // //   { id: "reports", label: "Reports", icon: FileBarChart2 },
// // // // ];

// // // // /** Single source of truth for table columns — header and rows always agree. */
// // // // const COLUMNS: Record<Module, string[]> = {
// // // //   purchasing: [
// // // //     "PO number",
// // // //     "Supplier",
// // // //     "Order date",
// // // //     "Total",
// // // //     "Status",
// // // //     "Actions",
// // // //   ],
// // // //   expenses: ["Category", "Description", "Date", "Store", "Amount"],
// // // //   supplierPayments: ["Supplier", "Paid at", "Method", "Reference", "Amount"],
// // // //   transfers: [
// // // //     "Transfer",
// // // //     "From → To",
// // // //     "Requested",
// // // //     "Items",
// // // //     "Status",
// // // //     "Actions",
// // // //   ],
// // // //   returns: ["Return", "Order", "Customer", "Date", "Refund", "Status"],
// // // //   reports: [],
// // // // };

// // // // const PAYMENT_METHODS = [
// // // //   "CASH",
// // // //   "KBZ_PAY",
// // // //   "CB_PAY",
// // // //   "WAVE_PAY",
// // // //   "CARD",
// // // //   "BANK_TRANSFER",
// // // // ];

// // // // const RECEIVABLE_STATUSES = ["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"];
// // // // const COMPLETABLE_TRANSFER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"];

// // // // const today = () => new Date().toISOString().slice(0, 10);

// // // // const initialFields = (): Fields => ({
// // // //   supplierId: "",
// // // //   productId: "",
// // // //   variantId: "",
// // // //   quantity: "1",
// // // //   unitCost: "",
// // // //   expectedDate: "",
// // // //   notes: "",
// // // //   categoryId: "",
// // // //   amount: "",
// // // //   description: "",
// // // //   expenseDate: today(),
// // // //   paymentMethod: "CASH",
// // // //   referenceNumber: "",
// // // //   toStoreId: "",
// // // //   orderId: "",
// // // //   orderItemId: "",
// // // //   reason: "",
// // // //   refundMethod: "CASH",
// // // // });

// // // // const errorMessage = (error: unknown) => {
// // // //   if (typeof error === "string") return error;
// // // //   const value = error as { data?: { message?: string }; message?: string };
// // // //   return (
// // // //     value?.data?.message ||
// // // //     value?.message ||
// // // //     "The server could not save this operation."
// // // //   );
// // // // };

// // // // const dateText = (value?: string) =>
// // // //   value ? new Date(value).toLocaleString() : "—";

// // // // const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

// // // // const transferStatusLabel = (status: string) =>
// // // //   status === "RECEIVED" ? "COMPLETED" : status;

// // // // /* ------------------------------------------------------------------ */
// // // // /*  Main view                                                          */
// // // // /* ------------------------------------------------------------------ */

// // // // export function ERPView(props: Props) {
// // // //   const {
// // // //     selectedStoreId,
// // // //     stores,
// // // //     products,
// // // //     suppliers,
// // // //     orders,
// // // //     purchaseOrders,
// // // //     expenses,
// // // //     expenseCategories,
// // // //     supplierPayments,
// // // //     transfers,
// // // //     returns,
// // // //     loading,
// // // //     onCreatePurchaseOrder,
// // // //     onUpdatePurchaseOrder,
// // // //     onReceivePurchaseOrder,
// // // //     onCreateExpense,
// // // //     onCreateExpenseCategory,
// // // //     onCreateSupplierPayment,
// // // //     onCreateTransfer,
// // // //     onCompleteTransfer,
// // // //     onCreateReturn,
// // // //   } = props;

// // // //   /* ---------------------------- state ---------------------------- */

// // // //   const [module, setModule] = useState<Module>("purchasing");
// // // //   const [search, setSearch] = useState("");
// // // //   const [statusFilter, setStatusFilter] = useState("ALL");

// // // //   // create / edit dialog
// // // //   const [dialog, setDialog] = useState(false);
// // // //   const [fields, setFields] = useState<Fields>(initialFields);
// // // //   const [formError, setFormError] = useState("");
// // // //   const [saving, setSaving] = useState(false);

// // // //   // expense-category dialog
// // // //   const [categoryDialog, setCategoryDialog] = useState(false);
// // // //   const [categoryName, setCategoryName] = useState("");

// // // //   // receive purchase-order dialog
// // // //   const [receiveTarget, setReceiveTarget] = useState<any>(null);
// // // //   const [receiveStoreId, setReceiveStoreId] = useState("");
// // // //   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
// // // //   const [receiveLots, setReceiveLots] = useState<
// // // //     Record<string, { number: string; expiryDate: string }>
// // // //   >({});
// // // //   const [receiveError, setReceiveError] = useState("");
// // // //   const [receiving, setReceiving] = useState(false);

// // // //   // complete-transfer dialog
// // // //   const [transferTarget, setTransferTarget] = useState<any>(null);
// // // //   const [transferError, setTransferError] = useState("");
// // // //   const [completing, setCompleting] = useState(false);

// // // //   // per-row busy marker (e.g. "po:<id>", "transfer:<id>")
// // // //   const [busyId, setBusyId] = useState<string | null>(null);

// // // //   // toasts
// // // //   const [toasts, setToasts] = useState<Toast[]>([]);
// // // //   const toastSeq = useRef(0);
// // // //   const toastTimers = useRef<number[]>([]);

// // // //   const pushToast = useCallback((tone: Toast["tone"], message: string) => {
// // // //     const id = ++toastSeq.current;
// // // //     setToasts((current) => [...current, { id, tone, message }]);
// // // //     const timer = window.setTimeout(
// // // //       () => setToasts((current) => current.filter((toast) => toast.id !== id)),
// // // //       5000,
// // // //     );
// // // //     toastTimers.current.push(timer);
// // // //   }, []);

// // // //   const dismissToast = useCallback((id: number) => {
// // // //     setToasts((current) => current.filter((toast) => toast.id !== id));
// // // //   }, []);

// // // //   useEffect(
// // // //     () => () => {
// // // //       toastTimers.current.forEach(window.clearTimeout);
// // // //     },
// // // //     [],
// // // //   );

// // // //   /* -------------------------- derived data ------------------------ */

// // // //   const selectedProduct = products.find(
// // // //     (product) => product.id === fields.productId,
// // // //   );
// // // //   const selectedOrder = orders.find((order) => order.id === fields.orderId);
// // // //   const orderItem = selectedOrder?.items?.find(
// // // //     (item) => item.id === fields.orderItemId,
// // // //   );
// // // //   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
// // // //   const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
// // // //   const poTotal = quantity * Number(fields.unitCost || 0);
// // // //   const isReturnable = (order: ApiOrder) =>
// // // //     order.status === "COMPLETED" || order.paymentStatus === "PAID";

// // // //   const records = useMemo(() => {
// // // //     const values = (
// // // //       {
// // // //         purchasing: purchaseOrders,
// // // //         expenses: expenses,
// // // //         supplierPayments: supplierPayments,
// // // //         transfers: transfers,
// // // //         returns: returns,
// // // //         reports: [],
// // // //       } as Record<Module, any[]>
// // // //     )[module];

// // // //     const normalized = search.trim().toLowerCase();
// // // //     if (!normalized) return values;

// // // //     return values.filter((item) =>
// // // //       JSON.stringify([
// // // //         item.poNumber,
// // // //         item.transferNumber,
// // // //         item.returnNumber,
// // // //         item.order?.orderNumber,
// // // //         item.supplier?.name,
// // // //         item.customer?.name,
// // // //         item.description,
// // // //         item.notes,
// // // //         item.reason,
// // // //         item.referenceNumber,
// // // //         item.category?.name,
// // // //         item.store?.name,
// // // //         item.fromStore?.name,
// // // //         item.toStore?.name,
// // // //         item.status,
// // // //         item.refundStatus,
// // // //       ])
// // // //         .toLowerCase()
// // // //         .includes(normalized),
// // // //     );
// // // //   }, [
// // // //     module,
// // // //     purchaseOrders,
// // // //     expenses,
// // // //     supplierPayments,
// // // //     transfers,
// // // //     returns,
// // // //     search,
// // // //   ]);

// // // //   const statusOptions = useMemo(() => {
// // // //     if (
// // // //       module === "reports" ||
// // // //       module === "expenses" ||
// // // //       module === "supplierPayments"
// // // //     )
// // // //       return [];
// // // //     const set = new Set<string>();
// // // //     records.forEach((record: any) => {
// // // //       const status = module === "returns" ? record.refundStatus : record.status;
// // // //       if (status) set.add(status);
// // // //     });
// // // //     return ["ALL", ...Array.from(set).sort()];
// // // //   }, [records, module]);

// // // //   const visibleRecords = useMemo(() => {
// // // //     if (statusFilter === "ALL") return records;
// // // //     return records.filter((record: any) => {
// // // //       const status = module === "returns" ? record.refundStatus : record.status;
// // // //       return status === statusFilter;
// // // //     });
// // // //   }, [records, statusFilter, module]);

// // // //   const cols = COLUMNS[module];
// // // //   const gridStyle = useMemo(
// // // //     () => ({ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }),
// // // //     [cols.length],
// // // //   );

// // // //   /* ---------------------------- actions --------------------------- */

// // // //   const resetMessages = () => {
// // // //     setFormError("");
// // // //     setReceiveError("");
// // // //     setTransferError("");
// // // //   };

// // // //   const switchModule = (next: Module) => {
// // // //     setModule(next);
// // // //     setSearch("");
// // // //     setStatusFilter("ALL");
// // // //     resetMessages();
// // // //   };

// // // //   const openDialog = () => {
// // // //     const firstOrder = orders.find(isReturnable);
// // // //     setFields({
// // // //       ...initialFields(),
// // // //       supplierId: suppliers[0]?.id || "",
// // // //       productId: products[0]?.id || "",
// // // //       variantId: products[0]?.variants?.[0]?.id || "",
// // // //       categoryId: expenseCategories[0]?.id || "",
// // // //       toStoreId: stores.find((store) => store.id !== selectedStoreId)?.id || "",
// // // //       orderId: firstOrder?.id || "",
// // // //       orderItemId: firstOrder?.items?.[0]?.id || "",
// // // //     });
// // // //     resetMessages();
// // // //     setDialog(true);
// // // //   };

// // // //   const submit = async (event: FormEvent) => {
// // // //     event.preventDefault();
// // // //     setSaving(true);
// // // //     setFormError("");

// // // //     try {
// // // //       if (module === "purchasing") {
// // // //         if (
// // // //           !fields.supplierId ||
// // // //           !fields.productId ||
// // // //           quantity < 1 ||
// // // //           Number(fields.unitCost) < 0 ||
// // // //           fields.unitCost === ""
// // // //         ) {
// // // //           throw new Error(
// // // //             "Select a supplier and product, and enter a valid quantity and unit cost.",
// // // //           );
// // // //         }
// // // //         const product = products.find(
// // // //           (entry) => entry.id === fields.productId,
// // // //         )!;
// // // //         await onCreatePurchaseOrder({
// // // //           supplierId: fields.supplierId,
// // // //           status: "DRAFT",
// // // //           currencyCode: "MMK",
// // // //           expectedDate: fields.expectedDate || undefined,
// // // //           subTotal: poTotal,
// // // //           taxAmount: 0,
// // // //           grandTotal: poTotal,
// // // //           notes: fields.notes || undefined,
// // // //           items: [
// // // //             {
// // // //               productId: product.id,
// // // //               variantId: fields.variantId || product.variants?.[0]?.id,
// // // //               quantity,
// // // //               unitCost: Number(fields.unitCost),
// // // //               totalCost: poTotal,
// // // //             },
// // // //           ],
// // // //         });
// // // //         pushToast("success", "Purchase order created as draft.");
// // // //       } else if (module === "expenses") {
// // // //         if (!selectedStoreId)
// // // //           throw new Error(
// // // //             "Select a store from the top bar before recording an expense.",
// // // //           );
// // // //         if (!fields.categoryId || Number(fields.amount) <= 0)
// // // //           throw new Error(
// // // //             "Select an expense category and enter an amount greater than zero.",
// // // //           );
// // // //         await onCreateExpense({
// // // //           storeId: selectedStoreId,
// // // //           categoryId: fields.categoryId,
// // // //           amount: Number(fields.amount),
// // // //           currencyCode: "MMK",
// // // //           description: fields.description || undefined,
// // // //           expenseDate: fields.expenseDate || undefined,
// // // //         });
// // // //         pushToast("success", "Expense recorded.");
// // // //       } else if (module === "supplierPayments") {
// // // //         if (!fields.supplierId || Number(fields.amount) <= 0)
// // // //           throw new Error("Select a supplier and enter a payment amount.");
// // // //         await onCreateSupplierPayment({
// // // //           supplierId: fields.supplierId,
// // // //           amount: Number(fields.amount),
// // // //           currencyCode: "MMK",
// // // //           paymentMethod: fields.paymentMethod,
// // // //           referenceNumber: fields.referenceNumber || undefined,
// // // //           note: fields.notes || undefined,
// // // //         });
// // // //         pushToast("success", "Supplier payment recorded.");
// // // //       } else if (module === "transfers") {
// // // //         if (!selectedStoreId)
// // // //           throw new Error("Select a source store from the top bar first.");
// // // //         if (!fields.toStoreId || !fields.productId || quantity < 1) {
// // // //           throw new Error("Choose a destination store, product, and quantity.");
// // // //         }
// // // //         if (fields.toStoreId === selectedStoreId)
// // // //           throw new Error("Source and destination stores must be different.");
// // // //         const product = products.find(
// // // //           (entry) => entry.id === fields.productId,
// // // //         )!;
// // // //         await onCreateTransfer({
// // // //           fromStoreId: selectedStoreId,
// // // //           toStoreId: fields.toStoreId,
// // // //           notes: fields.notes || undefined,
// // // //           items: [
// // // //             {
// // // //               productId: product.id,
// // // //               variantId: fields.variantId || product.variants?.[0]?.id,
// // // //               quantity,
// // // //             },
// // // //           ],
// // // //         });
// // // //         pushToast("success", "Transfer requested.");
// // // //       } else if (module === "returns") {
// // // //         if (!selectedOrder || !orderItem)
// // // //           throw new Error("Choose a completed order and an item to return.");
// // // //         if (quantity < 1 || !fields.reason.trim())
// // // //           throw new Error("Enter a quantity and a return reason.");
// // // //         const remaining =
// // // //           orderItem.quantity - Number(orderItem.returnedQuantity || 0);
// // // //         if (quantity > remaining) {
// // // //           throw new Error(
// // // //             `Only ${remaining} unit(s) remain returnable on this line.`,
// // // //           );
// // // //         }
// // // //         await onCreateReturn({
// // // //           orderId: selectedOrder.id,
// // // //           totalAmount: itemTotal,
// // // //           refundMethod: fields.refundMethod,
// // // //           refundStatus: "COMPLETED",
// // // //           reason: fields.reason.trim(),
// // // //           items: [
// // // //             {
// // // //               orderItemId: orderItem.id,
// // // //               quantity,
// // // //               refundAmount: itemTotal,
// // // //               reason: fields.reason.trim(),
// // // //             },
// // // //           ],
// // // //         });
// // // //         pushToast("success", "Sales return processed.");
// // // //       }

// // // //       setDialog(false);
// // // //     } catch (cause) {
// // // //       setFormError(errorMessage(cause));
// // // //     } finally {
// // // //       setSaving(false);
// // // //     }
// // // //   };

// // // //   const markOrdered = async (po: any) => {
// // // //     setBusyId(`po:${po.id}`);
// // // //     try {
// // // //       await onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
// // // //       pushToast("success", `${po.poNumber} marked as ordered.`);
// // // //     } catch (cause) {
// // // //       pushToast("error", errorMessage(cause));
// // // //     } finally {
// // // //       setBusyId(null);
// // // //     }
// // // //   };

// // // //   const openReceive = (po: any) => {
// // // //     setReceiveStoreId(selectedStoreId || stores[0]?.id || "");
// // // //     setReceiveError("");
// // // //     setTrackReceivedLots(false);
// // // //     setReceiveLots(
// // // //       Object.fromEntries(
// // // //         (po.items ?? []).map((item: any) => [
// // // //           item.id,
// // // //           { number: "", expiryDate: "" },
// // // //         ]),
// // // //       ),
// // // //     );
// // // //     setReceiveTarget(po);
// // // //   };

// // // //   const confirmReceive = async () => {
// // // //     if (!receiveTarget) return;
// // // //     const targetStore =
// // // //       receiveStoreId || selectedStoreId || stores[0]?.id || "";
// // // //     if (!targetStore) {
// // // //       setReceiveError("Select a store to receive the stock into.");
// // // //       return;
// // // //     }

// // // //     let lots:
// // // //       | { purchaseOrderItemId: string; number: string; expiryDate?: string }[]
// // // //       | undefined;

// // // //     if (trackReceivedLots) {
// // // //       const lines = (receiveTarget.items ?? []).map((item: any) => ({
// // // //         id: item.id,
// // // //         name: item.product?.name || "Product",
// // // //         number: (receiveLots[item.id]?.number ?? "").trim(),
// // // //         expiryDate: receiveLots[item.id]?.expiryDate || "",
// // // //       }));
// // // //       const missing = lines.find((line: any) => !line.number);
// // // //       if (missing) {
// // // //         setReceiveError(
// // // //           `Enter a batch / lot number for “${missing.name}”, or turn lot tracking off.`,
// // // //         );
// // // //         return;
// // // //       }
// // // //       lots = lines.map((line: any) => ({
// // // //         purchaseOrderItemId: line.id,
// // // //         number: line.number,
// // // //         expiryDate: line.expiryDate || undefined,
// // // //       }));
// // // //     }

// // // //     setReceiving(true);
// // // //     setReceiveError("");
// // // //     try {
// // // //       await onReceivePurchaseOrder(receiveTarget.id, targetStore, lots);
// // // //       pushToast(
// // // //         "success",
// // // //         `${receiveTarget.poNumber} received. Inventory has been updated.`,
// // // //       );
// // // //       setReceiveTarget(null);
// // // //     } catch (cause) {
// // // //       setReceiveError(errorMessage(cause));
// // // //     } finally {
// // // //       setReceiving(false);
// // // //     }
// // // //   };

// // // //   const openCompleteTransfer = (transfer: any) => {
// // // //     setTransferError("");
// // // //     setTransferTarget(transfer);
// // // //   };

// // // //   const executeCompleteTransfer = async () => {
// // // //     if (!transferTarget) return;
// // // //     setCompleting(true);
// // // //     setTransferError("");
// // // //     try {
// // // //       await onCompleteTransfer(transferTarget.id);
// // // //       pushToast(
// // // //         "success",
// // // //         `Transfer ${transferTarget.transferNumber} completed. Inventories have been updated.`,
// // // //       );
// // // //       setTransferTarget(null);
// // // //     } catch (cause) {
// // // //       setTransferError(errorMessage(cause));
// // // //     } finally {
// // // //       setCompleting(false);
// // // //     }
// // // //   };

// // // //   const addExpenseCategory = async (event: FormEvent) => {
// // // //     event.preventDefault();
// // // //     const name = categoryName.trim();
// // // //     if (!name) {
// // // //       setFormError("Enter a category name.");
// // // //       return;
// // // //     }
// // // //     setSaving(true);
// // // //     setFormError("");
// // // //     try {
// // // //       await onCreateExpenseCategory(name);
// // // //       setCategoryDialog(false);
// // // //       setCategoryName("");
// // // //       pushToast("success", "Expense category created.");
// // // //     } catch (cause) {
// // // //       setFormError(errorMessage(cause));
// // // //     } finally {
// // // //       setSaving(false);
// // // //     }
// // // //   };

// // // //   /* ----------------------------- render --------------------------- */

// // // //   return (
// // // //     <main className="flex-1 overflow-y-auto p-7">
// // // //       <header className="mb-6">
// // // //         <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
// // // //           Enterprise operations
// // // //         </p>
// // // //         <h1 className="mt-2 text-3xl font-black text-white">ERP</h1>
// // // //         <p className="mt-1 text-sm text-slate-400">
// // // //           Purchasing, costs, supplier settlement, branch stock and returns.
// // // //         </p>
// // // //       </header>

// // // //       <WorkflowGuide />

// // // //       {/* Toasts */}
// // // //       <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-80 flex-col gap-2">
// // // //         {toasts.map((toast) => (
// // // //           <div
// // // //             key={toast.id}
// // // //             role="status"
// // // //             className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
// // // //               toast.tone === "success"
// // // //                 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
// // // //                 : "border-rose-500/30 bg-rose-500/10 text-rose-200"
// // // //             }`}
// // // //           >
// // // //             {toast.tone === "success" ? (
// // // //               <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
// // // //             ) : (
// // // //               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
// // // //             )}
// // // //             <span className="flex-1 leading-5">{toast.message}</span>
// // // //             <button
// // // //               type="button"
// // // //               aria-label="Dismiss notification"
// // // //               onClick={() => dismissToast(toast.id)}
// // // //               className="opacity-60 transition-opacity hover:opacity-100"
// // // //             >
// // // //               <X className="h-4 w-4" />
// // // //             </button>
// // // //           </div>
// // // //         ))}
// // // //       </div>

// // // //       <nav className="mb-5 flex flex-wrap gap-2">
// // // //         {MODULES.map(({ id, label, icon: Icon }) => (
// // // //           <button
// // // //             key={id}
// // // //             type="button"
// // // //             onClick={() => switchModule(id)}
// // // //             aria-current={module === id}
// // // //             className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors ${
// // // //               module === id
// // // //                 ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
// // // //                 : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
// // // //             }`}
// // // //           >
// // // //             <Icon className="h-4 w-4" />
// // // //             {label}
// // // //           </button>
// // // //         ))}
// // // //       </nav>

// // // //       {module === "reports" ? (
// // // //         <Reports
// // // //           orders={orders}
// // // //           expenses={expenses}
// // // //           purchaseOrders={purchaseOrders}
// // // //         />
// // // //       ) : (
// // // //         <>
// // // //           <section className="mb-4 flex flex-wrap items-center gap-3">
// // // //             <input
// // // //               value={search}
// // // //               onChange={(event) => setSearch(event.target.value)}
// // // //               placeholder="Search records"
// // // //               aria-label="Search records"
// // // //               className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
// // // //             />

// // // //             {module === "expenses" && (
// // // //               <button
// // // //                 type="button"
// // // //                 onClick={() => {
// // // //                   setCategoryName("");
// // // //                   setFormError("");
// // // //                   setCategoryDialog(true);
// // // //                 }}
// // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
// // // //               >
// // // //                 Expense categories
// // // //               </button>
// // // //             )}

// // // //             <button
// // // //               type="button"
// // // //               onClick={openDialog}
// // // //               className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400"
// // // //             >
// // // //               <Plus className="h-4 w-4" />
// // // //               {module === "purchasing"
// // // //                 ? "New purchase order"
// // // //                 : module === "expenses"
// // // //                   ? "Record expense"
// // // //                   : module === "supplierPayments"
// // // //                     ? "Record payment"
// // // //                     : module === "transfers"
// // // //                       ? "Request transfer"
// // // //                       : "Process return"}
// // // //             </button>
// // // //           </section>

// // // //           {statusOptions.length > 1 && (
// // // //             <div className="mb-4 flex flex-wrap items-center gap-2">
// // // //               {statusOptions.map((status) => (
// // // //                 <button
// // // //                   key={status}
// // // //                   type="button"
// // // //                   onClick={() => setStatusFilter(status)}
// // // //                   className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
// // // //                     statusFilter === status
// // // //                       ? "border-violet-400/50 bg-violet-400/10 text-violet-200"
// // // //                       : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
// // // //                   }`}
// // // //                 >
// // // //                   {status === "ALL" ? "All" : status.replace(/_/g, " ")}
// // // //                 </button>
// // // //               ))}
// // // //             </div>
// // // //           )}

// // // //           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// // // //             <div className="overflow-x-auto">
// // // //               <div className="min-w-[880px]">
// // // //                 <ListHeader cols={cols} />

// // // //                 {loading ? (
// // // //                   <p className="flex items-center justify-center gap-2 p-10 text-center text-sm text-slate-400">
// // // //                     <Loader2 className="h-4 w-4 animate-spin" />
// // // //                     Loading ERP records…
// // // //                   </p>
// // // //                 ) : visibleRecords.length === 0 ? (
// // // //                   <p className="p-10 text-center text-sm text-slate-400">
// // // //                     {records.length === 0
// // // //                       ? "No records found."
// // // //                       : "No records match the current filter."}
// // // //                   </p>
// // // //                 ) : (
// // // //                   visibleRecords.map((record: any) => (
// // // //                     <div
// // // //                       key={record.id}
// // // //                       style={gridStyle}
// // // //                       className="grid items-center gap-4 border-b border-slate-800/70 px-5 py-4 text-xs last:border-0"
// // // //                     >
// // // //                       {module === "purchasing" ? (
// // // //                         <>
// // // //                           <span className="font-bold text-white">
// // // //                             {record.poNumber}
// // // //                           </span>
// // // //                           <span className="truncate text-slate-300">
// // // //                             {record.supplier?.name || "—"}
// // // //                           </span>
// // // //                           <span className="text-slate-400">
// // // //                             {dateText(record.orderDate)}
// // // //                           </span>
// // // //                           <span className="font-semibold text-white">
// // // //                             {amount(record.grandTotal)}
// // // //                           </span>
// // // //                           <span className="text-amber-300">
// // // //                             {record.status?.replace(/_/g, " ")}
// // // //                           </span>
// // // //                           <span className="flex flex-wrap gap-1">
// // // //                             {record.status === "DRAFT" && (
// // // //                               <button
// // // //                                 type="button"
// // // //                                 onClick={() => void markOrdered(record)}
// // // //                                 disabled={busyId === `po:${record.id}`}
// // // //                                 className="flex items-center gap-1 rounded-lg bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
// // // //                               >
// // // //                                 {busyId === `po:${record.id}` && (
// // // //                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
// // // //                                 )}
// // // //                                 Mark ordered
// // // //                               </button>
// // // //                             )}
// // // //                             {RECEIVABLE_STATUSES.includes(record.status) && (
// // // //                               <button
// // // //                                 type="button"
// // // //                                 onClick={() => openReceive(record)}
// // // //                                 className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
// // // //                               >
// // // //                                 <ClipboardCheck className="h-3.5 w-3.5" />
// // // //                                 Receive
// // // //                               </button>
// // // //                             )}
// // // //                             {record.status === "RECEIVED" && (
// // // //                               <span className="text-[11px] font-medium text-emerald-400/80">
// // // //                                 ✓ Received
// // // //                               </span>
// // // //                             )}
// // // //                           </span>
// // // //                         </>
// // // //                       ) : module === "expenses" ? (
// // // //                         <>
// // // //                           <span className="font-semibold text-white">
// // // //                             {record.category?.name || "—"}
// // // //                           </span>
// // // //                           <span className="truncate text-slate-300">
// // // //                             {record.description || "—"}
// // // //                           </span>
// // // //                           <span className="text-slate-400">
// // // //                             {dateText(record.expenseDate)}
// // // //                           </span>
// // // //                           <span className="truncate text-slate-400">
// // // //                             {record.store?.name || "—"}
// // // //                           </span>
// // // //                           <span className="text-right font-bold text-white">
// // // //                             {amount(record.amount)}
// // // //                           </span>
// // // //                         </>
// // // //                       ) : module === "supplierPayments" ? (
// // // //                         <>
// // // //                           <span className="truncate font-semibold text-white">
// // // //                             {record.supplier?.name || "—"}
// // // //                           </span>
// // // //                           <span className="text-slate-400">
// // // //                             {dateText(record.paidAt)}
// // // //                           </span>
// // // //                           <span className="text-slate-300">
// // // //                             {record.paymentMethod?.replace(/_/g, " ")}
// // // //                           </span>
// // // //                           <span className="truncate text-slate-400">
// // // //                             {record.referenceNumber || "—"}
// // // //                           </span>
// // // //                           <span className="text-right font-bold text-white">
// // // //                             {amount(record.amount)}
// // // //                           </span>
// // // //                         </>
// // // //                       ) : module === "transfers" ? (
// // // //                         <>
// // // //                           <span className="font-bold text-white">
// // // //                             {record.transferNumber}
// // // //                           </span>
// // // //                           <span className="truncate text-slate-300">
// // // //                             {record.fromStore?.name} → {record.toStore?.name}
// // // //                           </span>
// // // //                           <span className="text-slate-400">
// // // //                             {dateText(record.requestedAt)}
// // // //                           </span>
// // // //                           <span className="text-slate-400">
// // // //                             {record.items?.length || 0} lines
// // // //                           </span>
// // // //                           <span
// // // //                             className={
// // // //                               record.status === "RECEIVED"
// // // //                                 ? "font-bold text-emerald-400"
// // // //                                 : "font-bold text-amber-300"
// // // //                             }
// // // //                           >
// // // //                             {transferStatusLabel(record.status)}
// // // //                           </span>
// // // //                           <span>
// // // //                             {COMPLETABLE_TRANSFER_STATUSES.includes(
// // // //                               record.status,
// // // //                             ) ? (
// // // //                               <button
// // // //                                 type="button"
// // // //                                 onClick={() => openCompleteTransfer(record)}
// // // //                                 disabled={
// // // //                                   completing ||
// // // //                                   busyId === `transfer:${record.id}`
// // // //                                 }
// // // //                                 className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
// // // //                               >
// // // //                                 {busyId === `transfer:${record.id}` && (
// // // //                                   <Loader2 className="h-3.5 w-3.5 animate-spin" />
// // // //                                 )}
// // // //                                 Accept &amp; Complete
// // // //                               </button>
// // // //                             ) : (
// // // //                               <span className="text-[11px] font-medium text-emerald-400/80">
// // // //                                 ✓ Received
// // // //                               </span>
// // // //                             )}
// // // //                           </span>
// // // //                         </>
// // // //                       ) : (
// // // //                         <>
// // // //                           <span className="font-bold text-white">
// // // //                             {record.returnNumber}
// // // //                           </span>
// // // //                           <span className="text-slate-300">
// // // //                             {record.order?.orderNumber ||
// // // //                               record.orderId?.slice(0, 8) ||
// // // //                               "—"}
// // // //                           </span>
// // // //                           <span className="truncate text-slate-400">
// // // //                             {record.customer?.name || "Walk-in"}
// // // //                           </span>
// // // //                           <span className="text-slate-400">
// // // //                             {dateText(record.createdAt)}
// // // //                           </span>
// // // //                           <span className="font-bold text-white">
// // // //                             {amount(record.totalAmount)}
// // // //                           </span>
// // // //                           <span className="text-emerald-300">
// // // //                             {record.refundStatus}
// // // //                           </span>
// // // //                         </>
// // // //                       )}
// // // //                     </div>
// // // //                   ))
// // // //                 )}
// // // //               </div>
// // // //             </div>
// // // //           </section>
// // // //         </>
// // // //       )}

// // // //       {/* ------------------------------------------------------------ */}
// // // //       {/*  Receive purchase order modal                                 */}
// // // //       {/* ------------------------------------------------------------ */}
// // // //       <Modal
// // // //         open={Boolean(receiveTarget)}
// // // //         onClose={() => !receiving && setReceiveTarget(null)}
// // // //         labelledBy="receive-modal-title"
// // // //       >
// // // //         {receiveTarget && (
// // // //           <>
// // // //             <h2
// // // //               id="receive-modal-title"
// // // //               className="text-xl font-bold text-white"
// // // //             >
// // // //               Receive {receiveTarget.poNumber}
// // // //             </h2>
// // // //             <p className="mt-1 text-xs text-slate-400">
// // // //               Record delivered products into inventory. Select the warehouse or
// // // //               store receiving this delivery.
// // // //             </p>

// // // //             <div className="mt-4">
// // // //               <label className="mb-1.5 block text-xs font-medium text-slate-300">
// // // //                 Destination store / branch
// // // //               </label>
// // // //               <select
// // // //                 value={receiveStoreId}
// // // //                 onChange={(event) => setReceiveStoreId(event.target.value)}
// // // //                 className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
// // // //               >
// // // //                 {stores.map((store) => (
// // // //                   <option key={store.id} value={store.id}>
// // // //                     {store.name}
// // // //                   </option>
// // // //                 ))}
// // // //               </select>
// // // //             </div>

// // // //             <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
// // // //               <input
// // // //                 type="checkbox"
// // // //                 checked={trackReceivedLots}
// // // //                 onChange={(event) => setTrackReceivedLots(event.target.checked)}
// // // //                 className="accent-emerald-500"
// // // //               />
// // // //               Track batch / lot numbers and expiry
// // // //             </label>

// // // //             {trackReceivedLots && (
// // // //               <div className="mt-4 space-y-3">
// // // //                 {(receiveTarget.items ?? []).map((item: any) => (
// // // //                   <article
// // // //                     key={item.id}
// // // //                     className="rounded-xl border border-slate-800 p-3"
// // // //                   >
// // // //                     <p className="mb-3 text-sm font-semibold text-white">
// // // //                       {item.product?.name || "Product"}
// // // //                       {item.variant?.name ? ` · ${item.variant.name}` : ""}{" "}
// // // //                       <span className="text-slate-400">× {item.quantity}</span>
// // // //                     </p>
// // // //                     <div className="grid gap-3 sm:grid-cols-2">
// // // //                       <Field
// // // //                         label="Batch / lot number"
// // // //                         value={receiveLots[item.id]?.number ?? ""}
// // // //                         onChange={(value) =>
// // // //                           setReceiveLots((current) => ({
// // // //                             ...current,
// // // //                             [item.id]: { ...current[item.id], number: value },
// // // //                           }))
// // // //                         }
// // // //                         required
// // // //                       />
// // // //                       <Field
// // // //                         label="Expiry date (optional)"
// // // //                         type="date"
// // // //                         value={receiveLots[item.id]?.expiryDate ?? ""}
// // // //                         onChange={(value) =>
// // // //                           setReceiveLots((current) => ({
// // // //                             ...current,
// // // //                             [item.id]: {
// // // //                               ...current[item.id],
// // // //                               expiryDate: value,
// // // //                             },
// // // //                           }))
// // // //                         }
// // // //                       />
// // // //                     </div>
// // // //                   </article>
// // // //                 ))}
// // // //               </div>
// // // //             )}

// // // //             <ErrorNote message={receiveError} />

// // // //             <div className="mt-6 flex justify-end gap-3">
// // // //               <button
// // // //                 type="button"
// // // //                 onClick={() => setReceiveTarget(null)}
// // // //                 disabled={receiving}
// // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// // // //               >
// // // //                 Cancel
// // // //               </button>
// // // //               <button
// // // //                 type="button"
// // // //                 onClick={() => void confirmReceive()}
// // // //                 disabled={receiving}
// // // //                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
// // // //               >
// // // //                 {receiving && <Loader2 className="h-4 w-4 animate-spin" />}
// // // //                 {receiving ? "Receiving…" : "Receive stock"}
// // // //               </button>
// // // //             </div>
// // // //           </>
// // // //         )}
// // // //       </Modal>

// // // //       {/* ------------------------------------------------------------ */}
// // // //       {/*  Complete transfer modal                                      */}
// // // //       {/* ------------------------------------------------------------ */}
// // // //       <Modal
// // // //         open={Boolean(transferTarget)}
// // // //         onClose={() => !completing && setTransferTarget(null)}
// // // //         labelledBy="transfer-modal-title"
// // // //         maxWidth="max-w-lg"
// // // //       >
// // // //         {transferTarget && (
// // // //           <>
// // // //             <div className="mb-2 flex items-center gap-3 text-emerald-400">
// // // //               <ArrowLeftRight className="h-6 w-6" />
// // // //               <h2
// // // //                 id="transfer-modal-title"
// // // //                 className="text-xl font-bold text-white"
// // // //               >
// // // //                 Accept transfer {transferTarget.transferNumber}
// // // //               </h2>
// // // //             </div>
// // // //             <p className="text-xs text-slate-300">
// // // //               Confirm receiving and applying this stock transfer between
// // // //               branches.
// // // //             </p>

// // // //             <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
// // // //               <div className="flex justify-between border-b border-slate-900 py-1">
// // // //                 <span className="text-slate-400">Source (deducting from):</span>
// // // //                 <span className="font-semibold text-rose-300">
// // // //                   {transferTarget.fromStore?.name || "Source store"}
// // // //                 </span>
// // // //               </div>
// // // //               <div className="flex justify-between border-b border-slate-900 py-1">
// // // //                 <span className="text-slate-400">Destination (adding to):</span>
// // // //                 <span className="font-semibold text-emerald-300">
// // // //                   {transferTarget.toStore?.name || "Destination store"}
// // // //                 </span>
// // // //               </div>
// // // //               <div className="flex justify-between border-b border-slate-900 py-1">
// // // //                 <span className="text-slate-400">Requested:</span>
// // // //                 <span className="text-slate-200">
// // // //                   {dateText(transferTarget.requestedAt)}
// // // //                 </span>
// // // //               </div>
// // // //               <div className="flex justify-between py-1">
// // // //                 <span className="text-slate-400">Total lines:</span>
// // // //                 <span className="font-semibold text-slate-200">
// // // //                   {transferTarget.items?.length || 0} items
// // // //                 </span>
// // // //               </div>
// // // //             </div>

// // // //             {transferTarget.items?.length > 0 && (
// // // //               <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs">
// // // //                 <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">
// // // //                   Items to transfer:
// // // //                 </p>
// // // //                 {transferTarget.items.map((item: any) => (
// // // //                   <div
// // // //                     key={item.id}
// // // //                     className="flex justify-between border-b border-slate-900/60 py-0.5 text-slate-300 last:border-0"
// // // //                   >
// // // //                     <span className="truncate pr-2">
// // // //                       {item.product?.name || "Product"}
// // // //                       {item.variant?.name ? ` (${item.variant.name})` : ""}
// // // //                     </span>
// // // //                     <span className="shrink-0 font-bold text-white">
// // // //                       × {item.quantity}
// // // //                     </span>
// // // //                   </div>
// // // //                 ))}
// // // //               </div>
// // // //             )}

// // // //             <ErrorNote message={transferError} />

// // // //             <div className="mt-6 flex justify-end gap-3">
// // // //               <button
// // // //                 type="button"
// // // //                 onClick={() => setTransferTarget(null)}
// // // //                 disabled={completing}
// // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// // // //               >
// // // //                 Cancel
// // // //               </button>
// // // //               <button
// // // //                 type="button"
// // // //                 onClick={() => void executeCompleteTransfer()}
// // // //                 disabled={completing}
// // // //                 className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
// // // //               >
// // // //                 {completing && <Loader2 className="h-4 w-4 animate-spin" />}
// // // //                 {completing ? "Processing…" : "Confirm & receive stock"}
// // // //               </button>
// // // //             </div>
// // // //           </>
// // // //         )}
// // // //       </Modal>

// // // //       {/* ------------------------------------------------------------ */}
// // // //       {/*  Create / category dialog                                     */}
// // // //       {/* ------------------------------------------------------------ */}
// // // //       <Modal
// // // //         open={dialog || categoryDialog}
// // // //         onClose={() => {
// // // //           if (saving) return;
// // // //           setDialog(false);
// // // //           setCategoryDialog(false);
// // // //         }}
// // // //         labelledBy="erp-form-title"
// // // //       >
// // // //         <form onSubmit={categoryDialog ? addExpenseCategory : submit}>
// // // //           <h2 id="erp-form-title" className="text-xl font-bold text-white">
// // // //             {categoryDialog
// // // //               ? "Add expense category"
// // // //               : module === "purchasing"
// // // //                 ? "New purchase order"
// // // //                 : module === "expenses"
// // // //                   ? "Record expense"
// // // //                   : module === "supplierPayments"
// // // //                     ? "Record supplier payment"
// // // //                     : module === "transfers"
// // // //                       ? "Request stock transfer"
// // // //                       : "Process sales return"}
// // // //           </h2>
// // // //           <p className="mb-5 mt-1 text-xs text-slate-400">
// // // //             This action is recorded on the server and may update inventory or
// // // //             balances.
// // // //           </p>

// // // //           {categoryDialog ? (
// // // //             <Field
// // // //               label="Category name"
// // // //               value={categoryName}
// // // //               onChange={setCategoryName}
// // // //               required
// // // //               disabled={saving}
// // // //             />
// // // //           ) : module === "purchasing" ? (
// // // //             <div className="space-y-3">
// // // //               <Select
// // // //                 label="Supplier"
// // // //                 value={fields.supplierId}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, supplierId: value })
// // // //                 }
// // // //                 options={suppliers.map((item) => [
// // // //                   item.id,
// // // //                   `${item.name} (${item.code ?? "—"})`,
// // // //                 ])}
// // // //               />
// // // //               <Select
// // // //                 label="Product"
// // // //                 value={fields.productId}
// // // //                 onChange={(value) =>
// // // //                   setFields({
// // // //                     ...fields,
// // // //                     productId: value,
// // // //                     variantId:
// // // //                       products.find((product) => product.id === value)
// // // //                         ?.variants?.[0]?.id || "",
// // // //                   })
// // // //                 }
// // // //                 options={products.map((item) => [
// // // //                   item.id,
// // // //                   `${item.name} · ${item.sku}`,
// // // //                 ])}
// // // //               />
// // // //               <Select
// // // //                 label="Variant"
// // // //                 value={fields.variantId}
// // // //                 onChange={(value) => setFields({ ...fields, variantId: value })}
// // // //                 options={(selectedProduct?.variants || []).map((variant) => [
// // // //                   variant.id,
// // // //                   variant.name,
// // // //                 ])}
// // // //               />
// // // //               <div className="grid grid-cols-2 gap-3">
// // // //                 <Field
// // // //                   label="Quantity"
// // // //                   type="number"
// // // //                   min="1"
// // // //                   value={fields.quantity}
// // // //                   onChange={(value) =>
// // // //                     setFields({ ...fields, quantity: value })
// // // //                   }
// // // //                   required
// // // //                 />
// // // //                 <Field
// // // //                   label="Unit cost"
// // // //                   type="number"
// // // //                   min="0"
// // // //                   step="0.01"
// // // //                   value={fields.unitCost}
// // // //                   onChange={(value) =>
// // // //                     setFields({ ...fields, unitCost: value })
// // // //                   }
// // // //                   required
// // // //                 />
// // // //               </div>
// // // //               <p className="text-right text-sm font-bold text-white">
// // // //                 Subtotal {amount(poTotal)}
// // // //               </p>
// // // //               <Field
// // // //                 label="Expected date"
// // // //                 type="date"
// // // //                 value={fields.expectedDate}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, expectedDate: value })
// // // //                 }
// // // //               />
// // // //               <Field
// // // //                 label="Notes"
// // // //                 value={fields.notes}
// // // //                 onChange={(value) => setFields({ ...fields, notes: value })}
// // // //               />
// // // //             </div>
// // // //           ) : module === "expenses" ? (
// // // //             <div className="space-y-3">
// // // //               {!selectedStoreId && (
// // // //                 <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
// // // //                   Select a store in the top bar before recording an expense.
// // // //                 </p>
// // // //               )}
// // // //               <Select
// // // //                 label="Expense category"
// // // //                 value={fields.categoryId}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, categoryId: value })
// // // //                 }
// // // //                 options={expenseCategories.map((item) => [item.id, item.name])}
// // // //               />
// // // //               <Field
// // // //                 label="Amount"
// // // //                 type="number"
// // // //                 min="0.01"
// // // //                 step="0.01"
// // // //                 value={fields.amount}
// // // //                 onChange={(value) => setFields({ ...fields, amount: value })}
// // // //                 required
// // // //               />
// // // //               <Field
// // // //                 label="Date"
// // // //                 type="date"
// // // //                 value={fields.expenseDate}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, expenseDate: value })
// // // //                 }
// // // //                 required
// // // //               />
// // // //               <Field
// // // //                 label="Description"
// // // //                 value={fields.description}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, description: value })
// // // //                 }
// // // //               />
// // // //             </div>
// // // //           ) : module === "supplierPayments" ? (
// // // //             <div className="space-y-3">
// // // //               <Select
// // // //                 label="Supplier"
// // // //                 value={fields.supplierId}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, supplierId: value })
// // // //                 }
// // // //                 options={suppliers.map((item) => [item.id, item.name])}
// // // //               />
// // // //               <Field
// // // //                 label="Amount"
// // // //                 type="number"
// // // //                 min="0.01"
// // // //                 step="0.01"
// // // //                 value={fields.amount}
// // // //                 onChange={(value) => setFields({ ...fields, amount: value })}
// // // //                 required
// // // //               />
// // // //               <Select
// // // //                 label="Payment method"
// // // //                 value={fields.paymentMethod}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, paymentMethod: value })
// // // //                 }
// // // //                 options={PAYMENT_METHODS.map((value) => [
// // // //                   value,
// // // //                   value.split("_").join(" "),
// // // //                 ])}
// // // //               />
// // // //               <Field
// // // //                 label="Reference number"
// // // //                 value={fields.referenceNumber}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, referenceNumber: value })
// // // //                 }
// // // //               />
// // // //               <Field
// // // //                 label="Note"
// // // //                 value={fields.notes}
// // // //                 onChange={(value) => setFields({ ...fields, notes: value })}
// // // //               />
// // // //             </div>
// // // //           ) : module === "transfers" ? (
// // // //             <div className="space-y-3">
// // // //               <p className="text-xs text-slate-400">
// // // //                 Source store:{" "}
// // // //                 <strong className="text-white">
// // // //                   {stores.find((item) => item.id === selectedStoreId)?.name ||
// // // //                     "Select a store first"}
// // // //                 </strong>
// // // //               </p>
// // // //               <Select
// // // //                 label="Destination"
// // // //                 value={fields.toStoreId}
// // // //                 onChange={(value) => setFields({ ...fields, toStoreId: value })}
// // // //                 options={stores
// // // //                   .filter((item) => item.id !== selectedStoreId)
// // // //                   .map((item) => [item.id, item.name])}
// // // //               />
// // // //               <Select
// // // //                 label="Product"
// // // //                 value={fields.productId}
// // // //                 onChange={(value) =>
// // // //                   setFields({
// // // //                     ...fields,
// // // //                     productId: value,
// // // //                     variantId:
// // // //                       products.find((product) => product.id === value)
// // // //                         ?.variants?.[0]?.id || "",
// // // //                   })
// // // //                 }
// // // //                 options={products.map((item) => [
// // // //                   item.id,
// // // //                   `${item.name} · ${item.sku}`,
// // // //                 ])}
// // // //               />
// // // //               <Select
// // // //                 label="Variant"
// // // //                 value={fields.variantId}
// // // //                 onChange={(value) => setFields({ ...fields, variantId: value })}
// // // //                 options={(selectedProduct?.variants || []).map((variant) => [
// // // //                   variant.id,
// // // //                   variant.name,
// // // //                 ])}
// // // //               />
// // // //               <Field
// // // //                 label="Quantity"
// // // //                 type="number"
// // // //                 min="1"
// // // //                 value={fields.quantity}
// // // //                 onChange={(value) => setFields({ ...fields, quantity: value })}
// // // //                 required
// // // //               />
// // // //               <Field
// // // //                 label="Notes"
// // // //                 value={fields.notes}
// // // //                 onChange={(value) => setFields({ ...fields, notes: value })}
// // // //               />
// // // //             </div>
// // // //           ) : (
// // // //             <div className="space-y-3">
// // // //               <Select
// // // //                 label="Completed order"
// // // //                 value={fields.orderId}
// // // //                 onChange={(value) => {
// // // //                   const order = orders.find((entry) => entry.id === value);
// // // //                   setFields({
// // // //                     ...fields,
// // // //                     orderId: value,
// // // //                     orderItemId: order?.items?.[0]?.id || "",
// // // //                   });
// // // //                 }}
// // // //                 options={orders
// // // //                   .filter(isReturnable)
// // // //                   .map((order) => [
// // // //                     order.id,
// // // //                     `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
// // // //                   ])}
// // // //               />
// // // //               <Select
// // // //                 label="Returned item"
// // // //                 value={fields.orderItemId}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, orderItemId: value })
// // // //                 }
// // // //                 options={(selectedOrder?.items || []).map((item) => [
// // // //                   item.id,
// // // //                   `${item.product?.name || "Product"} · qty ${item.quantity}`,
// // // //                 ])}
// // // //               />
// // // //               {orderItem && (
// // // //                 <p className="text-xs text-slate-400">
// // // //                   Remaining returnable:{" "}
// // // //                   <strong className="text-white">
// // // //                     {orderItem.quantity -
// // // //                       Number(orderItem.returnedQuantity || 0)}
// // // //                   </strong>
// // // //                 </p>
// // // //               )}
// // // //               <Field
// // // //                 label="Quantity"
// // // //                 type="number"
// // // //                 min="1"
// // // //                 max={Math.max(
// // // //                   1,
// // // //                   (orderItem?.quantity || 1) -
// // // //                     Number(orderItem?.returnedQuantity || 0),
// // // //                 )}
// // // //                 value={fields.quantity}
// // // //                 onChange={(value) => setFields({ ...fields, quantity: value })}
// // // //                 required
// // // //               />
// // // //               <p className="text-right text-sm font-bold text-white">
// // // //                 Refund total {amount(itemTotal)}
// // // //               </p>
// // // //               <Select
// // // //                 label="Refund method"
// // // //                 value={fields.refundMethod}
// // // //                 onChange={(value) =>
// // // //                   setFields({ ...fields, refundMethod: value })
// // // //                 }
// // // //                 options={PAYMENT_METHODS.map((value) => [
// // // //                   value,
// // // //                   value.split("_").join(" "),
// // // //                 ])}
// // // //               />
// // // //               <Field
// // // //                 label="Reason"
// // // //                 value={fields.reason}
// // // //                 onChange={(value) => setFields({ ...fields, reason: value })}
// // // //                 required
// // // //               />
// // // //             </div>
// // // //           )}

// // // //           <ErrorNote message={formError} />

// // // //           <div className="mt-6 flex justify-end gap-3">
// // // //             <button
// // // //               type="button"
// // // //               onClick={() => {
// // // //                 setDialog(false);
// // // //                 setCategoryDialog(false);
// // // //               }}
// // // //               disabled={saving}
// // // //               className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
// // // //             >
// // // //               Cancel
// // // //             </button>
// // // //             <button
// // // //               type="submit"
// // // //               disabled={saving}
// // // //               className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
// // // //             >
// // // //               {saving && <Loader2 className="h-4 w-4 animate-spin" />}
// // // //               {saving ? "Saving…" : "Save"}
// // // //             </button>
// // // //           </div>
// // // //         </form>
// // // //       </Modal>
// // // //     </main>
// // // //   );
// // // // }

// // // // /* ------------------------------------------------------------------ */
// // // // /*  Presentational helpers                                             */
// // // // /* ------------------------------------------------------------------ */

// // // // function Modal({
// // // //   open,
// // // //   onClose,
// // // //   labelledBy,
// // // //   children,
// // // //   maxWidth = "max-w-xl",
// // // // }: {
// // // //   open: boolean;
// // // //   onClose: () => void;
// // // //   labelledBy: string;
// // // //   children: React.ReactNode;
// // // //   maxWidth?: string;
// // // // }) {
// // // //   const panelRef = useRef<HTMLDivElement>(null);

// // // //   useEffect(() => {
// // // //     if (!open) return;

// // // //     const handleKey = (event: KeyboardEvent) => {
// // // //       if (event.key === "Escape") onClose();
// // // //     };
// // // //     document.addEventListener("keydown", handleKey);

// // // //     const previousOverflow = document.body.style.overflow;
// // // //     document.body.style.overflow = "hidden";
// // // //     panelRef.current?.focus();

// // // //     return () => {
// // // //       document.removeEventListener("keydown", handleKey);
// // // //       document.body.style.overflow = previousOverflow;
// // // //     };
// // // //   }, [open, onClose]);

// // // //   if (!open) return null;

// // // //   return createPortal(
// // // //     <div
// // // //       className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
// // // //       onMouseDown={onClose}
// // // //       role="presentation"
// // // //     >
// // // //       <div
// // // //         ref={panelRef}
// // // //         role="dialog"
// // // //         aria-modal="true"
// // // //         aria-labelledby={labelledBy}
// // // //         tabIndex={-1}
// // // //         onMouseDown={(event) => event.stopPropagation()}
// // // //         className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl outline-none`}
// // // //       >
// // // //         {children}
// // // //       </div>
// // // //     </div>,
// // // //     document.body,
// // // //   );
// // // // }

// // // // function ErrorNote({ message }: { message: string }) {
// // // //   if (!message) return null;
// // // //   return (
// // // //     <p
// // // //       role="alert"
// // // //       className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
// // // //     >
// // // //       <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
// // // //       <span>{message}</span>
// // // //     </p>
// // // //   );
// // // // }

// // // // function ListHeader({ cols }: { cols: string[] }) {
// // // //   return (
// // // //     <div
// // // //       className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
// // // //       style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
// // // //     >
// // // //       {cols.map((col) => (
// // // //         <span key={col}>{col}</span>
// // // //       ))}
// // // //     </div>
// // // //   );
// // // // }

// // // // function Field({
// // // //   label,
// // // //   value,
// // // //   onChange,
// // // //   type = "text",
// // // //   required,
// // // //   min,
// // // //   max,
// // // //   step,
// // // //   disabled,
// // // // }: {
// // // //   label: string;
// // // //   value: string;
// // // //   onChange: (value: string) => void;
// // // //   type?: string;
// // // //   required?: boolean;
// // // //   min?: string;
// // // //   max?: number;
// // // //   step?: string;
// // // //   disabled?: boolean;
// // // // }) {
// // // //   return (
// // // //     <label className="block text-xs text-slate-400">
// // // //       {label}
// // // //       <input
// // // //         required={required}
// // // //         type={type}
// // // //         min={min}
// // // //         max={max}
// // // //         step={step}
// // // //         disabled={disabled}
// // // //         value={value}
// // // //         onChange={(event) => onChange(event.target.value)}
// // // //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400 disabled:opacity-60"
// // // //       />
// // // //     </label>
// // // //   );
// // // // }

// // // // function Select({
// // // //   label,
// // // //   value,
// // // //   onChange,
// // // //   options,
// // // // }: {
// // // //   label: string;
// // // //   value: string;
// // // //   onChange: (value: string) => void;
// // // //   options: string[][];
// // // // }) {
// // // //   return (
// // // //     <label className="block text-xs text-slate-400">
// // // //       {label}
// // // //       <select
// // // //         required
// // // //         value={value}
// // // //         onChange={(event) => onChange(event.target.value)}
// // // //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
// // // //       >
// // // //         <option value="">Choose…</option>
// // // //         {options.map(([id, title]) => (
// // // //           <option key={id} value={id}>
// // // //             {title}
// // // //           </option>
// // // //         ))}
// // // //       </select>
// // // //       {options.length === 0 && (
// // // //         <span className="mt-1 block text-amber-300">
// // // //           Create the required record first.
// // // //         </span>
// // // //       )}
// // // //     </label>
// // // //   );
// // // // }

// // // // function Reports({
// // // //   orders,
// // // //   expenses,
// // // //   purchaseOrders,
// // // // }: {
// // // //   orders: ApiOrder[];
// // // //   expenses: any[];
// // // //   purchaseOrders: any[];
// // // // }) {
// // // //   const revenue = orders
// // // //     .filter(
// // // //       (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
// // // //     )
// // // //     .reduce((sum, order) => sum + order.grandTotal, 0);

// // // //   const operatingExpenses = expenses.reduce(
// // // //     (sum, expense) => sum + Number(expense.amount || 0),
// // // //     0,
// // // //   );

// // // //   const receivedOrders = purchaseOrders.filter(
// // // //     (po) => po.status === "RECEIVED",
// // // //   );
// // // //   const procurement = receivedOrders.reduce(
// // // //     (sum, po) => sum + Number(po.grandTotal || 0),
// // // //     0,
// // // //   );

// // // //   const cards = [
// // // //     [
// // // //       "Recent completed sales",
// // // //       amount(revenue),
// // // //       `${orders.length} recent order records loaded`,
// // // //     ],
// // // //     [
// // // //       "Recorded expenses",
// // // //       amount(operatingExpenses),
// // // //       `${expenses.length} expense records loaded`,
// // // //     ],
// // // //     [
// // // //       "Received purchasing",
// // // //       amount(procurement),
// // // //       `${receivedOrders.length} purchase orders received`,
// // // //     ],
// // // //   ];

// // // //   return (
// // // //     <>
// // // //       <section className="grid gap-4 md:grid-cols-3">
// // // //         {cards.map(([title, total, note]) => (
// // // //           <article
// // // //             key={title}
// // // //             className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
// // // //           >
// // // //             <p className="text-xs text-slate-400">{title}</p>
// // // //             <p className="mt-3 text-2xl font-black text-white">{total}</p>
// // // //             <p className="mt-2 text-xs text-slate-500">{note}</p>
// // // //           </article>
// // // //         ))}
// // // //       </section>
// // // //       <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
// // // //         Operational summary only. This is not a profit-and-loss statement:
// // // //         purchase values, unpaid liabilities, taxes, refunds and accounting
// // // //         journals are not fully reconciled here. Sales are limited to recent
// // // //         orders returned by the API.
// // // //       </p>
// // // //     </>
// // // //   );
// // // // }

// // // // // import { FormEvent, useMemo, useState } from "react";
// // // // // import {
// // // // //   ArrowLeftRight,
// // // // //   BadgeDollarSign,
// // // // //   ClipboardCheck,
// // // // //   FileBarChart2,
// // // // //   Plus,
// // // // //   Receipt,
// // // // //   Truck,
// // // // //   Undo2,
// // // // // } from "lucide-react";
// // // // // import { ApiOrder } from "../store/apiSlice";
// // // // // import { Product } from "../types";
// // // // // import { WorkflowGuide } from "./WorkflowGuide";

// // // // // type Module =
// // // // //   | "purchasing"
// // // // //   | "expenses"
// // // // //   | "supplierPayments"
// // // // //   | "transfers"
// // // // //   | "returns"
// // // // //   | "reports";
// // // // // type Fields = Record<string, string>;
// // // // // interface Props {
// // // // //   selectedStoreId?: string;
// // // // //   stores: { id: string; name: string }[];
// // // // //   products: Product[];
// // // // //   suppliers: any[];
// // // // //   orders: ApiOrder[];
// // // // //   purchaseOrders: any[];
// // // // //   expenses: any[];
// // // // //   expenseCategories: any[];
// // // // //   supplierPayments: any[];
// // // // //   transfers: any[];
// // // // //   returns: any[];
// // // // //   loading: boolean;
// // // // //   onCreatePurchaseOrder: (payload: Record<string, unknown>) => Promise<unknown>;
// // // // //   onUpdatePurchaseOrder: (
// // // // //     id: string,
// // // // //     patch: Record<string, unknown>,
// // // // //   ) => Promise<unknown>;
// // // // //   onReceivePurchaseOrder: (
// // // // //     id: string,
// // // // //     storeId: string,
// // // // //     lots?: {
// // // // //       purchaseOrderItemId: string;
// // // // //       number: string;
// // // // //       expiryDate?: string;
// // // // //     }[],
// // // // //   ) => Promise<unknown>;
// // // // //   onCreateExpense: (payload: Record<string, unknown>) => Promise<unknown>;
// // // // //   onCreateExpenseCategory: (name: string) => Promise<unknown>;
// // // // //   onCreateSupplierPayment: (
// // // // //     payload: Record<string, unknown>,
// // // // //   ) => Promise<unknown>;
// // // // //   onCreateTransfer: (payload: Record<string, unknown>) => Promise<unknown>;
// // // // //   onCompleteTransfer: (id: string) => Promise<unknown>;
// // // // //   onCreateReturn: (payload: Record<string, unknown>) => Promise<unknown>;
// // // // // }

// // // // // const modules: { id: Module; label: string; icon: typeof Truck }[] = [
// // // // //   { id: "purchasing", label: "Purchasing", icon: Truck },
// // // // //   { id: "expenses", label: "Expenses", icon: Receipt },
// // // // //   { id: "supplierPayments", label: "Supplier payments", icon: BadgeDollarSign },
// // // // //   { id: "transfers", label: "Branch transfers", icon: ArrowLeftRight },
// // // // //   { id: "returns", label: "Sales returns", icon: Undo2 },
// // // // //   { id: "reports", label: "Reports", icon: FileBarChart2 },
// // // // // ];
// // // // // const initial: Fields = {
// // // // //   supplierId: "",
// // // // //   productId: "",
// // // // //   variantId: "",
// // // // //   quantity: "1",
// // // // //   unitCost: "",
// // // // //   expectedDate: "",
// // // // //   notes: "",
// // // // //   categoryId: "",
// // // // //   amount: "",
// // // // //   description: "",
// // // // //   expenseDate: new Date().toISOString().slice(0, 10),
// // // // //   paymentMethod: "CASH",
// // // // //   referenceNumber: "",
// // // // //   toStoreId: "",
// // // // //   orderId: "",
// // // // //   orderItemId: "",
// // // // //   reason: "",
// // // // //   refundMethod: "CASH",
// // // // // };
// // // // // const errorMessage = (error: unknown) => {
// // // // //   const value = error as { data?: { message?: string }; message?: string };
// // // // //   return (
// // // // //     value.data?.message ||
// // // // //     value.message ||
// // // // //     "The server could not save this operation."
// // // // //   );
// // // // // };
// // // // // const dateText = (value?: string) =>
// // // // //   value ? new Date(value).toLocaleString() : "—";
// // // // // const amount = (value: unknown) => `${Number(value || 0).toLocaleString()} MMK`;

// // // // // export function ERPView(props: Props) {
// // // // //   const [module, setModule] = useState<Module>("purchasing");
// // // // //   const [dialog, setDialog] = useState(false);
// // // // //   const [categoryDialog, setCategoryDialog] = useState(false);
// // // // //   const [categoryName, setCategoryName] = useState("");
// // // // //   const [fields, setFields] = useState<Fields>({ ...initial });
// // // // //   const [busy, setBusy] = useState(false);
// // // // //   const [error, setError] = useState("");
// // // // //   const [notice, setNotice] = useState("");
// // // // //   const [search, setSearch] = useState("");
// // // // //   const [receiveTarget, setReceiveTarget] = useState<any>(null);
// // // // //   const [receiveStoreId, setReceiveStoreId] = useState("");
// // // // //   const [confirmTransferTarget, setConfirmTransferTarget] = useState<any>(null);
// // // // //   const [trackReceivedLots, setTrackReceivedLots] = useState(false);
// // // // //   const [receiveLots, setReceiveLots] = useState<
// // // // //     Record<string, { number: string; expiryDate: string }>
// // // // //   >({});
// // // // //   const selectedProduct = props.products.find(
// // // // //     (product) => product.id === fields.productId,
// // // // //   );
// // // // //   const selectedOrder = props.orders.find(
// // // // //     (order) => order.id === fields.orderId,
// // // // //   );
// // // // //   const orderItem = selectedOrder?.items?.find(
// // // // //     (item) => item.id === fields.orderItemId,
// // // // //   );
// // // // //   const quantity = Math.max(0, Math.floor(Number(fields.quantity) || 0));
// // // // //   const itemTotal = quantity * Number(orderItem?.unitPrice || 0);
// // // // //   const poTotal = quantity * Number(fields.unitCost || 0);

// // // // //   const records = useMemo(() => {
// // // // //     const values = (
// // // // //       {
// // // // //         purchasing: props.purchaseOrders,
// // // // //         expenses: props.expenses,
// // // // //         supplierPayments: props.supplierPayments,
// // // // //         transfers: props.transfers,
// // // // //         returns: props.returns,
// // // // //         reports: [],
// // // // //       } as Record<Module, any[]>
// // // // //     )[module];
// // // // //     const normalized = search.trim().toLowerCase();
// // // // //     if (!normalized) return values;
// // // // //     return values.filter((item) =>
// // // // //       JSON.stringify([
// // // // //         item.poNumber,
// // // // //         item.transferNumber,
// // // // //         item.returnNumber,
// // // // //         item.supplier?.name,
// // // // //         item.description,
// // // // //         item.notes,
// // // // //         item.category?.name,
// // // // //         item.store?.name,
// // // // //         item.fromStore?.name,
// // // // //         item.toStore?.name,
// // // // //       ])
// // // // //         .toLowerCase()
// // // // //         .includes(normalized),
// // // // //     );
// // // // //   }, [
// // // // //     module,
// // // // //     props.purchaseOrders,
// // // // //     props.expenses,
// // // // //     props.supplierPayments,
// // // // //     props.transfers,
// // // // //     props.returns,
// // // // //     search,
// // // // //   ]);

// // // // //   const openDialog = () => {
// // // // //     setFields({
// // // // //       ...initial,
// // // // //       supplierId: props.suppliers[0]?.id || "",
// // // // //       productId: props.products[0]?.id || "",
// // // // //       categoryId: props.expenseCategories[0]?.id || "",
// // // // //       toStoreId:
// // // // //         props.stores.find((store) => store.id !== props.selectedStoreId)?.id ||
// // // // //         "",
// // // // //       orderId:
// // // // //         props.orders.find((order) => order.status === "COMPLETED")?.id || "",
// // // // //     });
// // // // //     setError("");
// // // // //     setNotice("");
// // // // //     setDialog(true);
// // // // //   };
// // // // //   const submit = async (event: FormEvent) => {
// // // // //     event.preventDefault();
// // // // //     setBusy(true);
// // // // //     setError("");
// // // // //     try {
// // // // //       if (module === "purchasing") {
// // // // //         if (
// // // // //           !fields.supplierId ||
// // // // //           !fields.productId ||
// // // // //           quantity < 1 ||
// // // // //           Number(fields.unitCost) < 0
// // // // //         )
// // // // //           throw new Error(
// // // // //             "Select a supplier and product, quantity, and unit cost.",
// // // // //           );
// // // // //         const product = props.products.find(
// // // // //           (entry) => entry.id === fields.productId,
// // // // //         )!;
// // // // //         await props.onCreatePurchaseOrder({
// // // // //           supplierId: fields.supplierId,
// // // // //           status: "DRAFT",
// // // // //           currencyCode: "MMK",
// // // // //           expectedDate: fields.expectedDate || undefined,
// // // // //           subTotal: poTotal,
// // // // //           taxAmount: 0,
// // // // //           grandTotal: poTotal,
// // // // //           notes: fields.notes || undefined,
// // // // //           items: [
// // // // //             {
// // // // //               productId: product.id,
// // // // //               variantId: fields.variantId || product.variants?.[0]?.id,
// // // // //               quantity,
// // // // //               unitCost: Number(fields.unitCost),
// // // // //               totalCost: poTotal,
// // // // //             },
// // // // //           ],
// // // // //         });
// // // // //       } else if (module === "expenses") {
// // // // //         if (
// // // // //           !props.selectedStoreId ||
// // // // //           !fields.categoryId ||
// // // // //           Number(fields.amount) <= 0
// // // // //         )
// // // // //           throw new Error(
// // // // //             "Select a store and expense category, and enter an amount.",
// // // // //           );
// // // // //         await props.onCreateExpense({
// // // // //           storeId: props.selectedStoreId,
// // // // //           categoryId: fields.categoryId,
// // // // //           amount: Number(fields.amount),
// // // // //           currencyCode: "MMK",
// // // // //           description: fields.description || undefined,
// // // // //           expenseDate: fields.expenseDate || undefined,
// // // // //         });
// // // // //       } else if (module === "supplierPayments") {
// // // // //         if (!fields.supplierId || Number(fields.amount) <= 0)
// // // // //           throw new Error("Select a supplier and enter a payment amount.");
// // // // //         await props.onCreateSupplierPayment({
// // // // //           supplierId: fields.supplierId,
// // // // //           amount: Number(fields.amount),
// // // // //           currencyCode: "MMK",
// // // // //           paymentMethod: fields.paymentMethod,
// // // // //           referenceNumber: fields.referenceNumber || undefined,
// // // // //           note: fields.notes || undefined,
// // // // //         });
// // // // //       } else if (module === "transfers") {
// // // // //         if (
// // // // //           !props.selectedStoreId ||
// // // // //           !fields.toStoreId ||
// // // // //           !fields.productId ||
// // // // //           quantity < 1
// // // // //         )
// // // // //           throw new Error(
// // // // //             "Choose source and destination stores, product, and quantity.",
// // // // //           );
// // // // //         const product = props.products.find(
// // // // //           (entry) => entry.id === fields.productId,
// // // // //         )!;
// // // // //         await props.onCreateTransfer({
// // // // //           fromStoreId: props.selectedStoreId,
// // // // //           toStoreId: fields.toStoreId,
// // // // //           notes: fields.notes || undefined,
// // // // //           items: [
// // // // //             {
// // // // //               productId: product.id,
// // // // //               variantId: fields.variantId || product.variants?.[0]?.id,
// // // // //               quantity,
// // // // //             },
// // // // //           ],
// // // // //         });
// // // // //       } else if (module === "returns") {
// // // // //         if (
// // // // //           !selectedOrder ||
// // // // //           !orderItem ||
// // // // //           quantity < 1 ||
// // // // //           !fields.reason.trim()
// // // // //         )
// // // // //           throw new Error("Choose an order item, quantity and return reason.");
// // // // //         if (
// // // // //           quantity >
// // // // //           orderItem.quantity - Number(orderItem.returnedQuantity || 0)
// // // // //         )
// // // // //           throw new Error(
// // // // //             "Return quantity exceeds the remaining quantity on this order item.",
// // // // //           );
// // // // //         await props.onCreateReturn({
// // // // //           orderId: selectedOrder.id,
// // // // //           totalAmount: itemTotal,
// // // // //           refundMethod: fields.refundMethod,
// // // // //           refundStatus: "COMPLETED",
// // // // //           reason: fields.reason,
// // // // //           items: [
// // // // //             {
// // // // //               orderItemId: orderItem.id,
// // // // //               quantity,
// // // // //               refundAmount: itemTotal,
// // // // //               reason: fields.reason,
// // // // //             },
// // // // //           ],
// // // // //         });
// // // // //       }
// // // // //       setDialog(false);
// // // // //       setNotice("Operation saved successfully.");
// // // // //     } catch (cause) {
// // // // //       setError(errorMessage(cause));
// // // // //     } finally {
// // // // //       setBusy(false);
// // // // //     }
// // // // //   };

// // // // //   const receive = async (po: any) => {
// // // // //     const store = props.selectedStoreId || props.stores[0]?.id || "";
// // // // //     setReceiveStoreId(store);
// // // // //     setError("");
// // // // //     setNotice("");
// // // // //     setTrackReceivedLots(false);
// // // // //     setReceiveLots(
// // // // //       Object.fromEntries(
// // // // //         (po.items ?? []).map((item: any) => [
// // // // //           item.id,
// // // // //           { number: "", expiryDate: "" },
// // // // //         ]),
// // // // //       ),
// // // // //     );
// // // // //     setReceiveTarget(po);
// // // // //   };
// // // // //   const confirmReceive = async () => {
// // // // //     const targetStore =
// // // // //       receiveStoreId || props.selectedStoreId || props.stores[0]?.id;
// // // // //     if (!receiveTarget || !targetStore) {
// // // // //       setError("Please select a store to receive the stock into.");
// // // // //       return;
// // // // //     }
// // // // //     const lots = trackReceivedLots
// // // // //       ? (receiveTarget.items ?? []).map((item: any) => ({
// // // // //           purchaseOrderItemId: item.id,
// // // // //           ...receiveLots[item.id],
// // // // //         }))
// // // // //       : undefined;
// // // // //     if (lots?.some((lot: any) => !lot.number.trim())) {
// // // // //       setError(
// // // // //         "Enter the batch or lot number for every received product, or turn lot tracking off for this delivery.",
// // // // //       );
// // // // //       return;
// // // // //     }
// // // // //     setBusy(true);
// // // // //     setError("");
// // // // //     try {
// // // // //       await props.onReceivePurchaseOrder(
// // // // //         receiveTarget.id,
// // // // //         targetStore,
// // // // //         lots?.map((lot: any) => ({
// // // // //           ...lot,
// // // // //           number: lot.number.trim(),
// // // // //           expiryDate: lot.expiryDate || undefined,
// // // // //         })),
// // // // //       );
// // // // //       setNotice(
// // // // //         `${receiveTarget.poNumber} received. Inventory has been updated.`,
// // // // //       );
// // // // //       setReceiveTarget(null);
// // // // //     } catch (cause) {
// // // // //       setError(errorMessage(cause));
// // // // //     } finally {
// // // // //       setBusy(false);
// // // // //     }
// // // // //   };
// // // // //   const markOrdered = async (po: any) => {
// // // // //     try {
// // // // //       await props.onUpdatePurchaseOrder(po.id, { status: "ORDERED" });
// // // // //       setNotice(`${po.poNumber} marked as ordered.`);
// // // // //     } catch (cause) {
// // // // //       setError(errorMessage(cause));
// // // // //     }
// // // // //   };
// // // // //   const completeTransfer = (transfer: any) => {
// // // // //     setError("");
// // // // //     setNotice("");
// // // // //     setConfirmTransferTarget(transfer);
// // // // //   };

// // // // //   const executeCompleteTransfer = async () => {
// // // // //     if (!confirmTransferTarget) return;
// // // // //     setBusy(true);
// // // // //     setError("");
// // // // //     setNotice("");
// // // // //     try {
// // // // //       await props.onCompleteTransfer(confirmTransferTarget.id);
// // // // //       setNotice(
// // // // //         `Branch transfer ${confirmTransferTarget.transferNumber} completed successfully. Inventories have been updated.`,
// // // // //       );
// // // // //       setConfirmTransferTarget(null);
// // // // //     } catch (cause) {
// // // // //       setError(errorMessage(cause));
// // // // //     } finally {
// // // // //       setBusy(false);
// // // // //     }
// // // // //   };
// // // // //   const addExpenseCategory = async (event: FormEvent) => {
// // // // //     event.preventDefault();
// // // // //     setBusy(true);
// // // // //     setError("");
// // // // //     try {
// // // // //       await props.onCreateExpenseCategory(categoryName.trim());
// // // // //       setCategoryDialog(false);
// // // // //       setCategoryName("");
// // // // //       setNotice("Expense category created.");
// // // // //     } catch (cause) {
// // // // //       setError(errorMessage(cause));
// // // // //     } finally {
// // // // //       setBusy(false);
// // // // //     }
// // // // //   };

// // // // //   return (
// // // // //     <main className="flex-1 overflow-y-auto p-7">
// // // // //       <header className="mb-6">
// // // // //         <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
// // // // //           Enterprise operations
// // // // //         </p>
// // // // //         <h1 className="mt-2 text-3xl font-black text-white">ERP</h1>
// // // // //         <p className="mt-1 text-sm text-slate-400">
// // // // //           Purchasing, costs, supplier settlement, branch stock and returns.
// // // // //         </p>
// // // // //       </header>
// // // // //       <WorkflowGuide />
// // // // //       <nav className="mb-5 flex flex-wrap gap-2">
// // // // //         {modules.map(({ id, label, icon: Icon }) => (
// // // // //           <button
// // // // //             key={id}
// // // // //             onClick={() => {
// // // // //               setModule(id);
// // // // //               setSearch("");
// // // // //               setError("");
// // // // //               setNotice("");
// // // // //             }}
// // // // //             className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${module === id ? "border-violet-400/50 bg-violet-400/10 text-violet-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"}`}
// // // // //           >
// // // // //             <Icon className="h-4 w-4" />
// // // // //             {label}
// // // // //           </button>
// // // // //         ))}
// // // // //       </nav>
// // // // //       {error && !dialog && !categoryDialog && (
// // // // //         <p
// // // // //           role="alert"
// // // // //           className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
// // // // //         >
// // // // //           {error}
// // // // //         </p>
// // // // //       )}
// // // // //       {notice && !dialog && !categoryDialog && (
// // // // //         <p
// // // // //           role="status"
// // // // //           className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
// // // // //         >
// // // // //           {notice}
// // // // //         </p>
// // // // //       )}
// // // // //       {module === "reports" ? (
// // // // //         <Reports
// // // // //           orders={props.orders}
// // // // //           expenses={props.expenses}
// // // // //           purchaseOrders={props.purchaseOrders}
// // // // //         />
// // // // //       ) : (
// // // // //         <>
// // // // //           <section className="mb-4 flex flex-wrap items-center gap-3">
// // // // //             <input
// // // // //               value={search}
// // // // //               onChange={(event) => setSearch(event.target.value)}
// // // // //               placeholder="Search records"
// // // // //               className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
// // // // //             />
// // // // //             {module === "expenses" && (
// // // // //               <button
// // // // //                 onClick={() => {
// // // // //                   setCategoryName("");
// // // // //                   setCategoryDialog(true);
// // // // //                   setError("");
// // // // //                 }}
// // // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
// // // // //               >
// // // // //                 Expense categories
// // // // //               </button>
// // // // //             )}
// // // // //             <button
// // // // //               onClick={openDialog}
// // // // //               className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400"
// // // // //             >
// // // // //               <Plus className="h-4 w-4" />
// // // // //               {module === "purchasing"
// // // // //                 ? "New purchase order"
// // // // //                 : module === "expenses"
// // // // //                   ? "Record expense"
// // // // //                   : module === "supplierPayments"
// // // // //                     ? "Record payment"
// // // // //                     : module === "transfers"
// // // // //                       ? "Request transfer"
// // // // //                       : "Process return"}
// // // // //             </button>
// // // // //           </section>
// // // // //           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// // // // //             {module === "purchasing" ? (
// // // // //               <ListHeader
// // // // //                 cols={[
// // // // //                   "PO number",
// // // // //                   "Supplier",
// // // // //                   "Order date",
// // // // //                   "Total",
// // // // //                   "Status",
// // // // //                   "Actions",
// // // // //                 ]}
// // // // //               />
// // // // //             ) : module === "expenses" ? (
// // // // //               <ListHeader
// // // // //                 cols={["Category", "Description", "Date", "Store", "Amount"]}
// // // // //               />
// // // // //             ) : module === "supplierPayments" ? (
// // // // //               <ListHeader
// // // // //                 cols={["Supplier", "Paid at", "Method", "Reference", "Amount"]}
// // // // //               />
// // // // //             ) : module === "transfers" ? (
// // // // //               <ListHeader
// // // // //                 cols={[
// // // // //                   "Transfer",
// // // // //                   "From → To",
// // // // //                   "Requested",
// // // // //                   "Items",
// // // // //                   "Status",
// // // // //                   "Actions",
// // // // //                 ]}
// // // // //               />
// // // // //             ) : (
// // // // //               <ListHeader
// // // // //                 cols={[
// // // // //                   "Return",
// // // // //                   "Order",
// // // // //                   "Customer",
// // // // //                   "Date",
// // // // //                   "Refund",
// // // // //                   "Status",
// // // // //                 ]}
// // // // //               />
// // // // //             )}
// // // // //             {props.loading ? (
// // // // //               <p className="p-10 text-center text-sm text-slate-400">
// // // // //                 Loading ERP records…
// // // // //               </p>
// // // // //             ) : records.length === 0 ? (
// // // // //               <p className="p-10 text-center text-sm text-slate-400">
// // // // //                 No records found.
// // // // //               </p>
// // // // //             ) : (
// // // // //               records.map((record: any) => (
// // // // //                 <div
// // // // //                   key={record.id}
// // // // //                   className={`grid ${module === "expenses" || module === "supplierPayments" ? "grid-cols-5" : "grid-cols-6"} items-center gap-4 border-b border-slate-800/70 px-5 py-4 last:border-0 text-xs`}
// // // // //                 >
// // // // //                   {module === "purchasing" ? (
// // // // //                     <>
// // // // //                       <span className="font-bold text-white">
// // // // //                         {record.poNumber}
// // // // //                       </span>
// // // // //                       <span className="text-slate-300">
// // // // //                         {record.supplier?.name || "—"}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {dateText(record.orderDate)}
// // // // //                       </span>
// // // // //                       <span className="font-semibold text-white">
// // // // //                         {amount(record.grandTotal)}
// // // // //                       </span>
// // // // //                       <span className="text-amber-300">{record.status}</span>
// // // // //                       <span className="flex gap-1">
// // // // //                         {record.status === "DRAFT" && (
// // // // //                           <button
// // // // //                             onClick={() => markOrdered(record)}
// // // // //                             className="rounded-lg bg-sky-500/15 px-2 py-1.5 font-bold text-sky-300"
// // // // //                           >
// // // // //                             Mark ordered
// // // // //                           </button>
// // // // //                         )}
// // // // //                         {["ORDERED", "APPROVED", "PARTIALLY_RECEIVED"].includes(
// // // // //                           record.status,
// // // // //                         ) && (
// // // // //                           <button
// // // // //                             onClick={() => receive(record)}
// // // // //                             className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300"
// // // // //                           >
// // // // //                             <ClipboardCheck className="h-3.5 w-3.5" />
// // // // //                             Receive
// // // // //                           </button>
// // // // //                         )}
// // // // //                       </span>
// // // // //                     </>
// // // // //                   ) : module === "expenses" ? (
// // // // //                     <>
// // // // //                       <span className="font-semibold text-white">
// // // // //                         {record.category?.name || "—"}
// // // // //                       </span>
// // // // //                       <span className="truncate text-slate-300">
// // // // //                         {record.description || "—"}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {dateText(record.expenseDate)}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {record.store?.name || "—"}
// // // // //                       </span>
// // // // //                       <span className="text-right font-bold text-white">
// // // // //                         {amount(record.amount)}
// // // // //                       </span>
// // // // //                     </>
// // // // //                   ) : module === "supplierPayments" ? (
// // // // //                     <>
// // // // //                       <span className="font-semibold text-white">
// // // // //                         {record.supplier?.name || "—"}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {dateText(record.paidAt)}
// // // // //                       </span>
// // // // //                       <span className="text-slate-300">
// // // // //                         {record.paymentMethod}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {record.referenceNumber || "—"}
// // // // //                       </span>
// // // // //                       <span className="text-right font-bold text-white">
// // // // //                         {amount(record.amount)}
// // // // //                       </span>
// // // // //                     </>
// // // // //                   ) : module === "transfers" ? (
// // // // //                     <>
// // // // //                       <span className="font-bold text-white">
// // // // //                         {record.transferNumber}
// // // // //                       </span>
// // // // //                       <span className="text-slate-300">
// // // // //                         {record.fromStore?.name} → {record.toStore?.name}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {dateText(record.requestedAt)}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {record.items?.length || 0} lines
// // // // //                       </span>
// // // // //                       <span
// // // // //                         className={
// // // // //                           record.status === "RECEIVED"
// // // // //                             ? "font-bold text-emerald-400"
// // // // //                             : "font-bold text-amber-300"
// // // // //                         }
// // // // //                       >
// // // // //                         {record.status === "RECEIVED"
// // // // //                           ? "COMPLETED"
// // // // //                           : record.status}
// // // // //                       </span>
// // // // //                       <span>
// // // // //                         {["PENDING", "APPROVED", "IN_TRANSIT"].includes(
// // // // //                           record.status,
// // // // //                         ) ? (
// // // // //                           <button
// // // // //                             onClick={() => completeTransfer(record)}
// // // // //                             disabled={busy}
// // // // //                             className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
// // // // //                           >
// // // // //                             {busy ? "Completing…" : "Accept & Complete"}
// // // // //                           </button>
// // // // //                         ) : (
// // // // //                           <span className="text-emerald-400/80 font-medium text-[11px]">
// // // // //                             ✓ Received
// // // // //                           </span>
// // // // //                         )}
// // // // //                       </span>
// // // // //                     </>
// // // // //                   ) : (
// // // // //                     <>
// // // // //                       <span className="font-bold text-white">
// // // // //                         {record.returnNumber}
// // // // //                       </span>
// // // // //                       <span className="text-slate-300">
// // // // //                         {record.order?.orderNumber ||
// // // // //                           record.orderId?.slice(0, 8)}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {record.customer?.name || "Walk-in"}
// // // // //                       </span>
// // // // //                       <span className="text-slate-400">
// // // // //                         {dateText(record.createdAt)}
// // // // //                       </span>
// // // // //                       <span className="font-bold text-white">
// // // // //                         {amount(record.totalAmount)}
// // // // //                       </span>
// // // // //                       <span className="text-emerald-300">
// // // // //                         {record.refundStatus}
// // // // //                       </span>
// // // // //                     </>
// // // // //                   )}
// // // // //                 </div>
// // // // //               ))
// // // // //             )}
// // // // //           </section>
// // // // //         </>
// // // // //       )}

// // // // //       {receiveTarget && (
// // // // //         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
// // // // //           <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
// // // // //             <h2 className="text-xl font-bold text-white">
// // // // //               Receive {receiveTarget.poNumber}
// // // // //             </h2>
// // // // //             <p className="mt-1 text-xs text-slate-400">
// // // // //               Record delivered products into inventory. Select the warehouse or
// // // // //               store receiving this delivery.
// // // // //             </p>

// // // // //             <div className="mt-4">
// // // // //               <label className="block text-xs font-medium text-slate-300 mb-1.5">
// // // // //                 Destination Store / Branch
// // // // //               </label>
// // // // //               <select
// // // // //                 value={receiveStoreId}
// // // // //                 onChange={(e) => setReceiveStoreId(e.target.value)}
// // // // //                 className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
// // // // //               >
// // // // //                 {props.stores.map((s) => (
// // // // //                   <option key={s.id} value={s.id}>
// // // // //                     {s.name}
// // // // //                   </option>
// // // // //                 ))}
// // // // //               </select>
// // // // //             </div>

// // // // //             <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
// // // // //               <input
// // // // //                 type="checkbox"
// // // // //                 checked={trackReceivedLots}
// // // // //                 onChange={(event) => setTrackReceivedLots(event.target.checked)}
// // // // //                 className="accent-emerald-500"
// // // // //               />
// // // // //               Track batch / lot numbers and expiry
// // // // //             </label>
// // // // //             {trackReceivedLots && (
// // // // //               <div className="mt-4 space-y-3">
// // // // //                 {(receiveTarget.items ?? []).map((item: any) => (
// // // // //                   <article
// // // // //                     key={item.id}
// // // // //                     className="rounded-xl border border-slate-800 p-3"
// // // // //                   >
// // // // //                     <p className="mb-3 text-sm font-semibold text-white">
// // // // //                       {item.product?.name || "Product"}
// // // // //                       {item.variant?.name ? ` · ${item.variant.name}` : ""}{" "}
// // // // //                       <span className="text-slate-400">× {item.quantity}</span>
// // // // //                     </p>
// // // // //                     <div className="grid gap-3 sm:grid-cols-2">
// // // // //                       <Field
// // // // //                         label="Batch / lot number"
// // // // //                         value={receiveLots[item.id]?.number ?? ""}
// // // // //                         onChange={(value) =>
// // // // //                           setReceiveLots((current) => ({
// // // // //                             ...current,
// // // // //                             [item.id]: { ...current[item.id], number: value },
// // // // //                           }))
// // // // //                         }
// // // // //                         required
// // // // //                       />
// // // // //                       <Field
// // // // //                         label="Expiry date (optional)"
// // // // //                         type="date"
// // // // //                         value={receiveLots[item.id]?.expiryDate ?? ""}
// // // // //                         onChange={(value) =>
// // // // //                           setReceiveLots((current) => ({
// // // // //                             ...current,
// // // // //                             [item.id]: {
// // // // //                               ...current[item.id],
// // // // //                               expiryDate: value,
// // // // //                             },
// // // // //                           }))
// // // // //                         }
// // // // //                       />
// // // // //                     </div>
// // // // //                   </article>
// // // // //                 ))}
// // // // //               </div>
// // // // //             )}
// // // // //             {error && (
// // // // //               <p
// // // // //                 role="alert"
// // // // //                 className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
// // // // //               >
// // // // //                 {error}
// // // // //               </p>
// // // // //             )}
// // // // //             <div className="mt-6 flex justify-end gap-3">
// // // // //               <button
// // // // //                 type="button"
// // // // //                 onClick={() => setReceiveTarget(null)}
// // // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
// // // // //               >
// // // // //                 Cancel
// // // // //               </button>
// // // // //               <button
// // // // //                 type="button"
// // // // //                 onClick={() => void confirmReceive()}
// // // // //                 disabled={busy}
// // // // //                 className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
// // // // //               >
// // // // //                 {busy ? "Receiving…" : "Receive stock"}
// // // // //               </button>
// // // // //             </div>
// // // // //           </div>
// // // // //       {confirmTransferTarget && (
// // // // //         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 animate-in">
// // // // //           <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
// // // // //             <div className="flex items-center gap-3 text-emerald-400 mb-2">
// // // // //               <ArrowLeftRight className="h-6 w-6" />
// // // // //               <h2 className="text-xl font-bold text-white">
// // // // //                 Accept Transfer {confirmTransferTarget.transferNumber}
// // // // //               </h2>
// // // // //             </div>
// // // // //             <p className="text-xs text-slate-300">
// // // // //               Confirm receiving and applying this stock transfer between branches.
// // // // //             </p>

// // // // //             <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
// // // // //               <div className="flex justify-between py-1 border-b border-slate-900">
// // // // //                 <span className="text-slate-400">Source (Deducting from):</span>
// // // // //                 <span className="font-semibold text-rose-300">
// // // // //                   {confirmTransferTarget.fromStore?.name || "Source Store"}
// // // // //                 </span>
// // // // //               </div>
// // // // //               <div className="flex justify-between py-1 border-b border-slate-900">
// // // // //                 <span className="text-slate-400">Destination (Adding to):</span>
// // // // //                 <span className="font-semibold text-emerald-300">
// // // // //                   {confirmTransferTarget.toStore?.name || "Destination Store"}
// // // // //                 </span>
// // // // //               </div>
// // // // //               <div className="flex justify-between py-1 border-b border-slate-900">
// // // // //                 <span className="text-slate-400">Requested:</span>
// // // // //                 <span className="text-slate-200">
// // // // //                   {dateText(confirmTransferTarget.requestedAt)}
// // // // //                 </span>
// // // // //               </div>
// // // // //               <div className="flex justify-between py-1">
// // // // //                 <span className="text-slate-400">Total lines:</span>
// // // // //                 <span className="text-slate-200 font-semibold">
// // // // //                   {confirmTransferTarget.items?.length || 0} items
// // // // //                 </span>
// // // // //               </div>
// // // // //             </div>

// // // // //             {confirmTransferTarget.items?.length > 0 && (
// // // // //               <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs space-y-1.5">
// // // // //                 <p className="text-[11px] font-bold uppercase text-slate-400 mb-1">
// // // // //                   Items to Transfer:
// // // // //                 </p>
// // // // //                 {confirmTransferTarget.items.map((it: any) => (
// // // // //                   <div key={it.id} className="flex justify-between text-slate-300 py-0.5 border-b border-slate-900/60 last:border-0">
// // // // //                     <span className="truncate pr-2">
// // // // //                       {it.product?.name || "Product"}
// // // // //                       {it.variant?.name ? ` (${it.variant.name})` : ""}
// // // // //                     </span>
// // // // //                     <span className="font-bold text-white shrink-0">
// // // // //                       × {it.quantity}
// // // // //                     </span>
// // // // //                   </div>
// // // // //                 ))}
// // // // //               </div>
// // // // //             )}

// // // // //             {error && (
// // // // //               <p
// // // // //                 role="alert"
// // // // //                 className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300"
// // // // //               >
// // // // //                 {error}
// // // // //               </p>
// // // // //             )}

// // // // //             <div className="mt-6 flex justify-end gap-3">
// // // // //               <button
// // // // //                 type="button"
// // // // //                 onClick={() => setConfirmTransferTarget(null)}
// // // // //                 disabled={busy}
// // // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
// // // // //               >
// // // // //                 Cancel
// // // // //               </button>
// // // // //               <button
// // // // //                 type="button"
// // // // //                 onClick={() => void executeCompleteTransfer()}
// // // // //                 disabled={busy}
// // // // //                 className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2"
// // // // //               >
// // // // //                 {busy ? "Processing…" : "Confirm & Receive Stock"}
// // // // //               </button>
// // // // //             </div>
// // // // //           </div>
// // // // //         </div>
// // // // //       )}

// // // // //       {(dialog || categoryDialog) && (
// // // // //         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
// // // // //           <form
// // // // //             onSubmit={categoryDialog ? addExpenseCategory : submit}
// // // // //             className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
// // // // //           >
// // // // //             <h2 className="text-xl font-bold text-white">
// // // // //               {categoryDialog
// // // // //                 ? "Add expense category"
// // // // //                 : module === "purchasing"
// // // // //                   ? "New purchase order"
// // // // //                   : module === "expenses"
// // // // //                     ? "Record expense"
// // // // //                     : module === "supplierPayments"
// // // // //                       ? "Record supplier payment"
// // // // //                       : module === "transfers"
// // // // //                         ? "Request stock transfer"
// // // // //                         : "Process sales return"}
// // // // //             </h2>
// // // // //             <p className="mb-5 mt-1 text-xs text-slate-400">
// // // // //               This action is recorded on the server and may update inventory or
// // // // //               balances.
// // // // //             </p>
// // // // //             {categoryDialog ? (
// // // // //               <Field
// // // // //                 label="Category name"
// // // // //                 value={categoryName}
// // // // //                 onChange={setCategoryName}
// // // // //                 required
// // // // //               />
// // // // //             ) : module === "purchasing" ? (
// // // // //               <div className="space-y-3">
// // // // //                 <Select
// // // // //                   label="Supplier"
// // // // //                   value={fields.supplierId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, supplierId: value })
// // // // //                   }
// // // // //                   options={props.suppliers.map((item) => [
// // // // //                     item.id,
// // // // //                     `${item.name} (${item.code})`,
// // // // //                   ])}
// // // // //                 />
// // // // //                 <Select
// // // // //                   label="Product"
// // // // //                   value={fields.productId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({
// // // // //                       ...fields,
// // // // //                       productId: value,
// // // // //                       variantId:
// // // // //                         props.products.find((product) => product.id === value)
// // // // //                           ?.variants?.[0]?.id || "",
// // // // //                     })
// // // // //                   }
// // // // //                   options={props.products.map((item) => [
// // // // //                     item.id,
// // // // //                     `${item.name} · ${item.sku}`,
// // // // //                   ])}
// // // // //                 />
// // // // //                 <Select
// // // // //                   label="Variant"
// // // // //                   value={fields.variantId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, variantId: value })
// // // // //                   }
// // // // //                   options={(selectedProduct?.variants || []).map((variant) => [
// // // // //                     variant.id,
// // // // //                     variant.name,
// // // // //                   ])}
// // // // //                 />
// // // // //                 <div className="grid grid-cols-2 gap-3">
// // // // //                   <Field
// // // // //                     label="Quantity"
// // // // //                     type="number"
// // // // //                     min="1"
// // // // //                     value={fields.quantity}
// // // // //                     onChange={(value) =>
// // // // //                       setFields({ ...fields, quantity: value })
// // // // //                     }
// // // // //                     required
// // // // //                   />
// // // // //                   <Field
// // // // //                     label="Unit cost"
// // // // //                     type="number"
// // // // //                     min="0"
// // // // //                     step="0.01"
// // // // //                     value={fields.unitCost}
// // // // //                     onChange={(value) =>
// // // // //                       setFields({ ...fields, unitCost: value })
// // // // //                     }
// // // // //                     required
// // // // //                   />
// // // // //                 </div>
// // // // //                 <p className="text-right text-sm font-bold text-white">
// // // // //                   Subtotal {amount(poTotal)}
// // // // //                 </p>
// // // // //                 <Field
// // // // //                   label="Expected date"
// // // // //                   type="date"
// // // // //                   value={fields.expectedDate}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, expectedDate: value })
// // // // //                   }
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Notes"
// // // // //                   value={fields.notes}
// // // // //                   onChange={(value) => setFields({ ...fields, notes: value })}
// // // // //                 />
// // // // //               </div>
// // // // //             ) : module === "expenses" ? (
// // // // //               <div className="space-y-3">
// // // // //                 <Select
// // // // //                   label="Expense category"
// // // // //                   value={fields.categoryId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, categoryId: value })
// // // // //                   }
// // // // //                   options={props.expenseCategories.map((item) => [
// // // // //                     item.id,
// // // // //                     item.name,
// // // // //                   ])}
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Amount"
// // // // //                   type="number"
// // // // //                   min="0.01"
// // // // //                   step="0.01"
// // // // //                   value={fields.amount}
// // // // //                   onChange={(value) => setFields({ ...fields, amount: value })}
// // // // //                   required
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Date"
// // // // //                   type="date"
// // // // //                   value={fields.expenseDate}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, expenseDate: value })
// // // // //                   }
// // // // //                   required
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Description"
// // // // //                   value={fields.description}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, description: value })
// // // // //                   }
// // // // //                 />
// // // // //               </div>
// // // // //             ) : module === "supplierPayments" ? (
// // // // //               <div className="space-y-3">
// // // // //                 <Select
// // // // //                   label="Supplier"
// // // // //                   value={fields.supplierId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, supplierId: value })
// // // // //                   }
// // // // //                   options={props.suppliers.map((item) => [item.id, item.name])}
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Amount"
// // // // //                   type="number"
// // // // //                   min="0.01"
// // // // //                   step="0.01"
// // // // //                   value={fields.amount}
// // // // //                   onChange={(value) => setFields({ ...fields, amount: value })}
// // // // //                   required
// // // // //                 />
// // // // //                 <Select
// // // // //                   label="Payment method"
// // // // //                   value={fields.paymentMethod}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, paymentMethod: value })
// // // // //                   }
// // // // //                   options={[
// // // // //                     "CASH",
// // // // //                     "KBZ_PAY",
// // // // //                     "CB_PAY",
// // // // //                     "WAVE_PAY",
// // // // //                     "CARD",
// // // // //                     "BANK_TRANSFER",
// // // // //                   ].map((value) => [value, value.split("_").join(" ")])}
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Reference number"
// // // // //                   value={fields.referenceNumber}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, referenceNumber: value })
// // // // //                   }
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Note"
// // // // //                   value={fields.notes}
// // // // //                   onChange={(value) => setFields({ ...fields, notes: value })}
// // // // //                 />
// // // // //               </div>
// // // // //             ) : module === "transfers" ? (
// // // // //               <div className="space-y-3">
// // // // //                 <p className="text-xs text-slate-400">
// // // // //                   Source store:{" "}
// // // // //                   <strong className="text-white">
// // // // //                     {props.stores.find(
// // // // //                       (item) => item.id === props.selectedStoreId,
// // // // //                     )?.name || "Select a store"}
// // // // //                   </strong>
// // // // //                 </p>
// // // // //                 <Select
// // // // //                   label="Destination"
// // // // //                   value={fields.toStoreId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, toStoreId: value })
// // // // //                   }
// // // // //                   options={props.stores
// // // // //                     .filter((item) => item.id !== props.selectedStoreId)
// // // // //                     .map((item) => [item.id, item.name])}
// // // // //                 />
// // // // //                 <Select
// // // // //                   label="Product"
// // // // //                   value={fields.productId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({
// // // // //                       ...fields,
// // // // //                       productId: value,
// // // // //                       variantId:
// // // // //                         props.products.find((product) => product.id === value)
// // // // //                           ?.variants?.[0]?.id || "",
// // // // //                     })
// // // // //                   }
// // // // //                   options={props.products.map((item) => [item.id, item.name])}
// // // // //                 />
// // // // //                 <Select
// // // // //                   label="Variant"
// // // // //                   value={fields.variantId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, variantId: value })
// // // // //                   }
// // // // //                   options={(selectedProduct?.variants || []).map((variant) => [
// // // // //                     variant.id,
// // // // //                     variant.name,
// // // // //                   ])}
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Quantity"
// // // // //                   type="number"
// // // // //                   min="1"
// // // // //                   value={fields.quantity}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, quantity: value })
// // // // //                   }
// // // // //                   required
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Notes"
// // // // //                   value={fields.notes}
// // // // //                   onChange={(value) => setFields({ ...fields, notes: value })}
// // // // //                 />
// // // // //               </div>
// // // // //             ) : (
// // // // //               <div className="space-y-3">
// // // // //                 <Select
// // // // //                   label="Completed order"
// // // // //                   value={fields.orderId}
// // // // //                   onChange={(value) => {
// // // // //                     const order = props.orders.find(
// // // // //                       (entry) => entry.id === value,
// // // // //                     );
// // // // //                     setFields({
// // // // //                       ...fields,
// // // // //                       orderId: value,
// // // // //                       orderItemId: order?.items?.[0]?.id || "",
// // // // //                     });
// // // // //                   }}
// // // // //                   options={props.orders
// // // // //                     .filter(
// // // // //                       (order) =>
// // // // //                         order.status === "COMPLETED" ||
// // // // //                         order.paymentStatus === "PAID",
// // // // //                     )
// // // // //                     .map((order) => [
// // // // //                       order.id,
// // // // //                       `${order.orderNumber || order.id.slice(0, 8)} · ${amount(order.grandTotal)}`,
// // // // //                     ])}
// // // // //                 />
// // // // //                 <Select
// // // // //                   label="Returned item"
// // // // //                   value={fields.orderItemId}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, orderItemId: value })
// // // // //                   }
// // // // //                   options={(selectedOrder?.items || []).map((item) => [
// // // // //                     item.id,
// // // // //                     `${item.product?.name || "Product"} · qty ${item.quantity}`,
// // // // //                   ])}
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Quantity"
// // // // //                   type="number"
// // // // //                   min="1"
// // // // //                   max={orderItem?.quantity || 1}
// // // // //                   value={fields.quantity}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, quantity: value })
// // // // //                   }
// // // // //                   required
// // // // //                 />
// // // // //                 <p className="text-right text-sm font-bold text-white">
// // // // //                   Refund total {amount(itemTotal)}
// // // // //                 </p>
// // // // //                 <Select
// // // // //                   label="Refund method"
// // // // //                   value={fields.refundMethod}
// // // // //                   onChange={(value) =>
// // // // //                     setFields({ ...fields, refundMethod: value })
// // // // //                   }
// // // // //                   options={[
// // // // //                     "CASH",
// // // // //                     "KBZ_PAY",
// // // // //                     "CB_PAY",
// // // // //                     "WAVE_PAY",
// // // // //                     "CARD",
// // // // //                     "BANK_TRANSFER",
// // // // //                   ].map((value) => [value, value.split("_").join(" ")])}
// // // // //                 />
// // // // //                 <Field
// // // // //                   label="Reason"
// // // // //                   value={fields.reason}
// // // // //                   onChange={(value) => setFields({ ...fields, reason: value })}
// // // // //                   required
// // // // //                 />
// // // // //               </div>
// // // // //             )}
// // // // //             {error && (
// // // // //               <p
// // // // //                 role="alert"
// // // // //                 className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
// // // // //               >
// // // // //                 {error}
// // // // //               </p>
// // // // //             )}
// // // // //             <div className="mt-6 flex justify-end gap-3">
// // // // //               <button
// // // // //                 type="button"
// // // // //                 onClick={() => {
// // // // //                   setDialog(false);
// // // // //                   setCategoryDialog(false);
// // // // //                 }}
// // // // //                 className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300"
// // // // //               >
// // // // //                 Cancel
// // // // //               </button>
// // // // //               <button
// // // // //                 disabled={busy}
// // // // //                 className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
// // // // //               >
// // // // //                 {busy ? "Saving…" : "Save"}
// // // // //               </button>
// // // // //             </div>
// // // // //           </form>
// // // // //         </div>
// // // // //       )}
// // // // //     </main>
// // // // //   );
// // // // // }

// // // // // function ListHeader({ cols }: { cols: string[] }) {
// // // // //   return (
// // // // //     <div
// // // // //       className="grid gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"
// // // // //       style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
// // // // //     >
// // // // //       {cols.map((col) => (
// // // // //         <span key={col}>{col}</span>
// // // // //       ))}
// // // // //     </div>
// // // // //   );
// // // // // }
// // // // // function Field({
// // // // //   label,
// // // // //   value,
// // // // //   onChange,
// // // // //   type = "text",
// // // // //   required,
// // // // //   min,
// // // // //   max,
// // // // //   step,
// // // // // }: {
// // // // //   label: string;
// // // // //   value: string;
// // // // //   onChange: (value: string) => void;
// // // // //   type?: string;
// // // // //   required?: boolean;
// // // // //   min?: string;
// // // // //   max?: number;
// // // // //   step?: string;
// // // // // }) {
// // // // //   return (
// // // // //     <label className="block text-xs text-slate-400">
// // // // //       {label}
// // // // //       <input
// // // // //         required={required}
// // // // //         type={type}
// // // // //         min={min}
// // // // //         max={max}
// // // // //         step={step}
// // // // //         value={value}
// // // // //         onChange={(event) => onChange(event.target.value)}
// // // // //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
// // // // //       />
// // // // //     </label>
// // // // //   );
// // // // // }
// // // // // function Select({
// // // // //   label,
// // // // //   value,
// // // // //   onChange,
// // // // //   options,
// // // // // }: {
// // // // //   label: string;
// // // // //   value: string;
// // // // //   onChange: (value: string) => void;
// // // // //   options: string[][];
// // // // // }) {
// // // // //   return (
// // // // //     <label className="block text-xs text-slate-400">
// // // // //       {label}
// // // // //       <select
// // // // //         required
// // // // //         value={value}
// // // // //         onChange={(event) => onChange(event.target.value)}
// // // // //         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
// // // // //       >
// // // // //         <option value="">Choose…</option>
// // // // //         {options.map(([id, title]) => (
// // // // //           <option key={id} value={id}>
// // // // //             {title}
// // // // //           </option>
// // // // //         ))}
// // // // //       </select>
// // // // //       {options.length === 0 && (
// // // // //         <span className="mt-1 block text-amber-300">
// // // // //           Create the required record first.
// // // // //         </span>
// // // // //       )}
// // // // //     </label>
// // // // //   );
// // // // // }
// // // // // function Reports({
// // // // //   orders,
// // // // //   expenses,
// // // // //   purchaseOrders,
// // // // // }: {
// // // // //   orders: ApiOrder[];
// // // // //   expenses: any[];
// // // // //   purchaseOrders: any[];
// // // // // }) {
// // // // //   const revenue = orders
// // // // //     .filter(
// // // // //       (order) => order.status === "COMPLETED" || order.paymentStatus === "PAID",
// // // // //     )
// // // // //     .reduce((sum, order) => sum + order.grandTotal, 0);
// // // // //   const operatingExpenses = expenses.reduce(
// // // // //     (sum, expense) => sum + Number(expense.amount || 0),
// // // // //     0,
// // // // //   );
// // // // //   const procurement = purchaseOrders
// // // // //     .filter((po) => po.status === "RECEIVED")
// // // // //     .reduce((sum, po) => sum + Number(po.grandTotal || 0), 0);
// // // // //   const cards = [
// // // // //     [
// // // // //       "Recent completed sales",
// // // // //       amount(revenue),
// // // // //       `${orders.length} recent order records loaded`,
// // // // //     ],
// // // // //     [
// // // // //       "Recorded expenses",
// // // // //       amount(operatingExpenses),
// // // // //       `${expenses.length} expense records loaded`,
// // // // //     ],
// // // // //     [
// // // // //       "Received purchasing",
// // // // //       amount(procurement),
// // // // //       `${purchaseOrders.filter((po) => po.status === "RECEIVED").length} purchase orders received`,
// // // // //     ],
// // // // //   ];
// // // // //   return (
// // // // //     <>
// // // // //       <section className="grid gap-4 md:grid-cols-3">
// // // // //         {cards.map(([title, total, note]) => (
// // // // //           <article
// // // // //             key={title}
// // // // //             className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
// // // // //           >
// // // // //             <p className="text-xs text-slate-400">{title}</p>
// // // // //             <p className="mt-3 text-2xl font-black text-white">{total}</p>
// // // // //             <p className="mt-2 text-xs text-slate-500">{note}</p>
// // // // //           </article>
// // // // //         ))}
// // // // //       </section>
// // // // //       <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/80">
// // // // //         Operational summary only. This is not a profit-and-loss statement:
// // // // //         purchase values, unpaid liabilities, taxes, refunds and accounting
// // // // //         journals are not fully reconciled here. Sales are limited to recent
// // // // //         orders returned by the API.
// // // // //       </p>
// // // // //     </>
// // // // //   );
// // // // // }
