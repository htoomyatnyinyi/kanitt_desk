import { useState, useEffect, useMemo } from "react";
import {
  useGetHealthQuery,
  useGetProductsQuery,
  useGetStoresQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useGetSessionsQuery,
  useCreateOrderMutation,
  useQuoteOrderMutation,
  useCompleteOrderMutation,
  useCreateDigitalReceiptLinkMutation,
  useIssueOfflineLicenseMutation,
  useGetOrdersQuery,
  useGetStoreSettingsQuery,
  useGetCategoriesQuery,
  useGetBrandsQuery,
  useGetSuppliersQuery,
  useGetCustomersQuery,
  useGetStaffQuery,
  useCreateCatalogProductMutation,
  useUpdateCatalogProductMutation,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useAdjustStockMutation,
  useGetInventoryMovementsQuery,
  useGetPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useGetExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useGetStockTransfersQuery,
  useGetTransferDestinationStoresQuery,
  useCreateStockTransferMutation,
  useCompleteStockTransferMutation,
  useGetReturnsQuery,
  useCreateReturnMutation,
  useOpenSessionMutation,
  useCloseSessionMutation,
  Store as ApiStore,
} from "./store/apiSlice";
import { Product, CartItem } from "./types";
import { decodeAuthToken } from "./services/secureStorage";

import { LoginScreen } from "./components/LoginScreen";
import { Sidebar, canAccessTab } from "./components/Sidebar";
import { PosView, type Variant } from "./components/PosView";
import { CartView } from "./components/CartView";
import { InventoryView } from "./components/InventoryView";
import { SessionsView } from "./components/SessionsView";
import { SettingsView } from "./components/SettingsView";
import { PaymentModal } from "./components/PaymentModal";
import { DashboardView } from "./components/DashboardView";
import { OrdersView } from "./components/OrdersView";
import { ManageView } from "./components/ManageView";
import { SyncView } from "./components/SyncView";
import { ERPView } from "./components/ERPView";
import { ActivityLogView } from "./components/ActivityLogView";
import { BusinessToolsView } from "./components/BusinessToolsView";
import { AdminView, NotificationsView } from "./components/AdminView";
import { StockRequestsView } from "./components/StockRequestsView";
import { ChatView } from "./components/ChatView";
import { ReportsView } from "./components/ReportsView";
import { ReceiptModal, ReceiptData } from "./components/ReceiptModal";
import {
  queueSale,
  cacheOfflineLicense,
  getCachedOfflineLicense,
  getOfflineDeviceId,
  readQueuedSales,
  removeQueuedSale,
  updateQueuedSaleError,
  type QueuedSale,
} from "./services/offlineSalesQueue";
import { useSystemBack } from "./hooks/SystemBackProvider";

// ── POS Shell (rendered only when authenticated) ───────────────────────────
function PosShell({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "pos"
    | "orders"
    | "inventory"
    | "requests"
    | "notifications"
    | "chat"
    | "sessions"
    | "manage"
    | "erp"
    | "reports"
    | "activity"
    | "commerce"
    | "sync"
    | "settings"
    | "admin"
  >("dashboard");
  const authUser = decodeAuthToken();
  const userRole = String(authUser?.role || "CASHIER").toUpperCase();
  const userPermissions = authUser?.permissions ?? [];
  const allowedStoreIds =
    userRole === "CASHIER"
      ? (authUser?.storeIds?.slice(0, 1) ?? [])
      : (authUser?.storeIds ?? []);
  useEffect(() => {
    if (!canAccessTab(activeTab, userRole, userPermissions)) {
      setActiveTab(userRole === "ACCOUNTANT" ? "dashboard" : "pos");
    }
  }, [activeTab, userRole, userPermissions.join("|")]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod] = useState<"cash" | "kpay" | "wave" | "card">("cash"); // remove setPayment Methods
  const [receivedAmount, setReceivedAmount] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderPricing, setOrderPricing] = useState<any>(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionInput, setPromotionInput] = useState("");
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState(
    () => `POS-${crypto.randomUUID()}`,
  );
  const [selectedStore, setSelectedStore] = useState<ApiStore | null>(null);
  const [offlineLicense, setOfflineLicense] = useState<any>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [queuedSales, setQueuedSales] = useState<QueuedSale[]>(() =>
    readQueuedSales(),
  );
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(
    null,
  );
  useSystemBack(paymentModalOpen, () => setPaymentModalOpen(false), 40);
  useSystemBack(!!currentReceipt, () => setCurrentReceipt(null), 50);

  // RTK Query — live data from kanitt_server
  const {
    data: healthData,
    isError: isHealthError,
    isLoading: isHealthLoading,
    refetch: refetchHealth,
  } = useGetHealthQuery();
  const {
    data: apiProducts,
    isLoading: isProductsLoading,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useGetProductsQuery({ storeId: selectedStore?.id });
  const { data: inventoryMovements = [] } = useGetInventoryMovementsQuery(
    { storeId: selectedStore?.id },
    { skip: !selectedStore?.id },
  );
  const {
    data: apiStores,
    isError: isStoresError,
    refetch: refetchStores,
  } = useGetStoresQuery();
  const { data: apiSessions, refetch: refetchSessions } = useGetSessionsQuery(
    { storeId: selectedStore?.id },
    { pollingInterval: 5000, refetchOnFocus: true, refetchOnReconnect: true },
  );
  const { data: apiStoreSettings = [] } = useGetStoreSettingsQuery(
    { storeId: selectedStore?.id },
    { skip: !selectedStore?.id },
  );
  const registerSessionMode = String(
    apiStoreSettings.find((setting: any) => setting.settingKey === "register_session_mode")?.settingValue ?? "SHARED",
  ).toUpperCase() === "INDIVIDUAL" ? "INDIVIDUAL" : "SHARED";
  const {
    data: apiOrders = [],
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
  } = useGetOrdersQuery({ storeId: selectedStore?.id });
  const { data: apiCategories = [], refetch: refetchCategories } =
    useGetCategoriesQuery();
  const { data: brands = [], refetch: refetchBrands } = useGetBrandsQuery();
  const { data: suppliers = [], refetch: refetchSuppliers } =
    useGetSuppliersQuery();
  const { data: customers = [], refetch: refetchCustomers } =
    useGetCustomersQuery();
  const { data: staff = [], refetch: refetchStaff } = useGetStaffQuery({
    storeId: selectedStore?.id,
  });
  const {
    data: purchaseOrders = [],
    isLoading: isPoLoading,
    refetch: refetchPurchaseOrders,
  } = useGetPurchaseOrdersQuery({ storeId: selectedStore?.id });
  const {
    data: expenses = [],
    isLoading: isExpensesLoading,
    refetch: refetchExpenses,
  } = useGetExpensesQuery({ storeId: selectedStore?.id });
  const { data: expenseCategories = [], refetch: refetchExpenseCategories } =
    useGetExpenseCategoriesQuery();
  const {
    data: supplierPayments = [],
    isLoading: isSupplierPaymentsLoading,
    refetch: refetchSupplierPayments,
  } = useGetSupplierPaymentsQuery();
  const {
    data: transfers = [],
    isLoading: isTransfersLoading,
    refetch: refetchTransfers,
  } = useGetStockTransfersQuery();
  const { data: transferDestinationStores = [] } =
    useGetTransferDestinationStoresQuery(undefined, {
      skip: !canAccessTab("erp", userRole, userPermissions),
    });
  const {
    data: returns = [],
    isLoading: isReturnsLoading,
    refetch: refetchReturns,
  } = useGetReturnsQuery({ storeId: selectedStore?.id });
  const [createOrderApi, { isLoading: isCheckoutLoading }] =
    useCreateOrderMutation();
  const [quoteOrder, { isLoading: isPricingLoading }] = useQuoteOrderMutation();
  const [completeOrderApi, { isLoading: isCompletingOrder }] =
    useCompleteOrderMutation();
  const [createDigitalReceiptLinkApi] = useCreateDigitalReceiptLinkMutation();
  const [issueOfflineLicense] = useIssueOfflineLicenseMutation();

  // Global Keyboard Shortcuts (F1: Search, F2: Checkout, Esc: Cancel Modals)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setActiveTab("pos");
        // Focus search input
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="barcode"]',
        );
        searchInput?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (
          activeTab === "pos" &&
          cart.length > 0 &&
          !isPricingLoading &&
          !pricingError
        ) {
          setPaymentModalOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    activeTab,
    cart.length,
    isPricingLoading,
    pricingError,
  ]);
  const [createCatalogProduct] = useCreateCatalogProductMutation();
  const [updateCatalogProduct] = useUpdateCatalogProductMutation();
  const [createCategory] = useCreateCategoryMutation();
  const [createBrand] = useCreateBrandMutation();
  const [createSupplier] = useCreateSupplierMutation();
  const [createCustomer] = useCreateCustomerMutation();
  const [createStaff] = useCreateStaffMutation();
  const [createStore] = useCreateStoreMutation();
  const [updateStore] = useUpdateStoreMutation();
  const [adjustStock] = useAdjustStockMutation();
  const [createPurchaseOrder] = useCreatePurchaseOrderMutation();
  const [updatePurchaseOrder] = useUpdatePurchaseOrderMutation();
  const [receivePurchaseOrder] = useReceivePurchaseOrderMutation();
  const [createExpense] = useCreateExpenseMutation();
  const [createExpenseCategory] = useCreateExpenseCategoryMutation();
  const [createSupplierPayment] = useCreateSupplierPaymentMutation();
  const [createTransfer] = useCreateStockTransferMutation();
  const [completeTransfer] = useCompleteStockTransferMutation();
  const [createReturn] = useCreateReturnMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [updateBrand] = useUpdateBrandMutation();
  const [updateSupplier] = useUpdateSupplierMutation();
  const [updateCustomer] = useUpdateCustomerMutation();
  const [updateStaff] = useUpdateStaffMutation();
  const [openRegisterSession] = useOpenSessionMutation();
  const [closeRegisterSession] = useCloseSessionMutation();

  const isConnected =
    !isHealthError && !isProductsError && healthData?.status === "ok";
  const isRTKLoading = isHealthLoading || isProductsLoading;

  const flushQueuedSales = async (force = false) => {
    if ((!isConnected && !force) || queuedSales.length === 0) return;
    for (const sale of queuedSales) {
      try {
        const result: any = await createOrderApi(sale.payload).unwrap();
        const order = result?.order ?? result?.data?.order ?? result;
        const used = result?.offlineLicenseSalesUsed ?? result?.data?.offlineLicenseSalesUsed;
        if (Number.isFinite(used) && sale.payload.offlineLicenseId) {
          const cached = getCachedOfflineLicense(sale.payload.storeId);
          if (cached?.id === sale.payload.offlineLicenseId) {
            const updatedLicense = { ...cached, salesUsed: used };
            cacheOfflineLicense(updatedLicense);
            setOfflineLicense(updatedLicense);
          }
        }
        if (order?.id && order.status === "PENDING")
          await completeOrderApi(order.id).unwrap();
        setQueuedSales(removeQueuedSale(sale.id));
      } catch (error) {
        const failure = error as {
          data?: { message?: string };
          error?: string;
        };
        const message =
          failure.data?.message ||
          failure.error ||
          "Sale could not sync. Check its price and register session.";
        setQueuedSales(updateQueuedSaleError(sale.id, message));
        break;
      }
    }
  };

  useEffect(() => {
    if (isConnected && queuedSales.length > 0) void flushQueuedSales();
  }, [isConnected]);

  useEffect(() => {
    setOfflineLicense(getCachedOfflineLicense(selectedStore?.id));
    if (!isConnected || !selectedStore?.id) return;
    try {
      const deviceId = getOfflineDeviceId();
      void issueOfflineLicense({ storeId: selectedStore.id, deviceId })
        .unwrap()
        .then((response: any) => {
          const license = response?.license ?? response?.data?.license;
          if (license) {
            cacheOfflineLicense(license);
            setOfflineLicense(license);
          }
        })
        .catch(() => {
          // Retain the last signed lease for a bounded offline period.
        });
    } catch {
      setOfflineLicense(null);
    }
  }, [isConnected, selectedStore?.id, issueOfflineLicense]);

  // Normalize API products — fix category union type to plain string
  const products: Product[] = (() => {
    if (!apiProducts) return [];
    return apiProducts.map((p) => ({
      ...p,
      category:
        typeof p.category === "object" && p.category !== null
          ? (p.category as { name: string }).name
          : (p.category as string) || "General",
      variants: (p.variants ?? []).map((variant: any) => ({
        ...variant,
        stock: Number(variant.stock ?? 0),
      })),
      barcode: p.barcode || "",
    })) as Product[];
  })();

  const stores = useMemo(() => {
    const available = apiStores || [];
    if (
      userRole === "ADMIN" ||
      userRole === "SUPER_ADMIN" ||
      userRole === "ACCOUNTANT"
    )
      return available;
    return available.filter((store) => allowedStoreIds.includes(store.id));
  }, [apiStores, userRole, allowedStoreIds.join("|")]);

  useEffect(() => {
    let stale = false;
    if (!selectedStore?.id || cart.length === 0) {
      setOrderPricing(null);
      setPricingError(null);
      if (cart.length === 0) {
        setPromotionCode("");
        setPromotionInput("");
      }
      return () => {
        stale = true;
      };
    }
    const timer = window.setTimeout(() => {
      setOrderPricing(null);
      setPricingError(null);
      void quoteOrder({
        storeId: selectedStore.id,
        items: cart.map((item) => ({
          productId: item.productId || item.id,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        ...(promotionCode ? { promotionCode } : {}),
      })
        .unwrap()
        .then((result) => {
          if (!stale)
            setOrderPricing({ ...result.quote, quoteToken: result.quoteToken });
        })
        .catch((error: unknown) => {
          if (stale) return;
          const value = error as {
            data?: { message?: string };
            error?: string;
          };
          setPricingError(
            value.data?.message ||
              value.error ||
              "Could not calculate the current sale total.",
          );
        });
    }, 160);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [cart, selectedStore?.id, promotionCode, quoteOrder]);

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0]);
    } else if (
      selectedStore &&
      !stores.some((store) => store.id === selectedStore.id)
    ) {
      setSelectedStore(stores[0] ?? null);
    }
  }, [stores, selectedStore]);

  const syncWithServer = async () => {
    const health = await refetchHealth();
    if (health.data?.status === "ok") await flushQueuedSales(true);
    await Promise.all([
      refetchHealth(),
      refetchProducts(),
      refetchStores(),
      refetchSessions(),
      refetchOrders(),
      refetchCategories(),
      refetchBrands(),
      refetchSuppliers(),
      refetchCustomers(),
      refetchStaff(),
      refetchPurchaseOrders(),
      refetchExpenses(),
      refetchExpenseCategories(),
      refetchSupplierPayments(),
      refetchTransfers(),
      refetchReturns(),
    ]);
    setLastSync(new Date());
  };

  const liveCategories = [
    "All",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];
  const categories = liveCategories;

  const addToCart = (product: Product, variant?: Variant) => {
    if (!variant) return;
    const cartProduct: CartItem = {
      ...product,
      id: `${product.id}::variant::${variant.id}`,
      productId: product.id,
      variantId: variant.id,
      name: `${product.name} · ${variant.name}`,
      sku: variant.sku || product.sku,
      barcode: variant.barcode || product.barcode,
      price: Number(variant.price ?? product.price ?? 0),
      costPrice: variant.costPrice ?? product.costPrice,
      stock: Number(variant.availableStock ?? variant.stock ?? 0),
      quantity: 1,
      variants: [
        {
          ...variant,
          sku: variant.sku || product.sku,
          price: Number(variant.price ?? product.price ?? 0),
        },
      ],
    };
    setCart((prev) => {
      const existing = prev.find((item) => item.id === cartProduct.id);
      if (existing) {
        return prev.map((item) =>
          item.id === cartProduct.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...cartProduct, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(
      (prev) =>
        prev
          .map((item) => {
            if (item.id === id) {
              const newQty = item.quantity + delta;
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean) as CartItem[],
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !selectedCategory ||
      selectedCategory === "All" ||
      product.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (product.name || "").toLowerCase().includes(q) ||
      (product.barcode || "").toLowerCase().includes(q) ||
      (product.sku || "").toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const subtotal = orderPricing?.subTotal ?? cartSubtotal;
  const tax = orderPricing?.taxAmount ?? 0;
  const discount = orderPricing?.discountAmount ?? 0;
  const total = orderPricing?.grandTotal ?? subtotal;
  const changeAmount = Math.max(0, (Number(receivedAmount) || 0) - total);

  const handleCheckoutSuccess = async (
    payments?: { method: string; amount: number }[],
  ) => {
    let completedOrderId: string | undefined;
    let digitalReceipt: { url: string; expiresAt: string } | undefined;
    const cachedLicense = selectedStore
      ? (offlineLicense?.storeId === selectedStore.id ? offlineLicense : getCachedOfflineLicense(selectedStore.id))
      : null;
    if (!orderPricing || (pricingError && isConnected)) {
      setCheckoutError(
        pricingError ||
          "Wait for the server to calculate this sale before taking payment.",
      );
      return;
    }
    if (selectedStore) {
      let currentSessions = apiSessions ?? [];
      let activeSession = currentSessions.find(
        (session) =>
          session.storeId === selectedStore.id && session.status === "OPEN" &&
          (registerSessionMode === "SHARED" || session.userId === authUser?.id),
      );
      if (!activeSession && isConnected) {
        const refreshed = await refetchSessions();
        currentSessions = refreshed.data ?? currentSessions;
        activeSession = currentSessions.find(
          (session) => session.storeId === selectedStore.id && session.status === "OPEN" &&
            (registerSessionMode === "SHARED" || session.userId === authUser?.id),
        );
      }
      if (!activeSession) {
        setCheckoutError(
          registerSessionMode === "SHARED"
            ? "There is no open register session for this store. Open the register before checkout."
            : "Open your own register session before completing a sale.",
        );
        return;
      }
      try {
        const payload = {
          orderNumber: checkoutOrderNumber,
          pricingToken: orderPricing.quoteToken,
          quotedPricing: (({ quoteToken: _quoteToken, ...quote }: any) =>
            quote)(orderPricing),
          storeId: selectedStore.id,
          sessionId: activeSession.id,
          items: orderPricing.items.map(
            (item: {
              productId: string;
              variantId?: string;
              quantity: number;
              unitPrice: number;
              subTotal: number;
            }) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subTotal: item.subTotal,
            }),
          ),
          promotionCode: promotionCode || undefined,
          discountAmount: discount,
          subTotal: subtotal,
          taxAmount: tax,
          grandTotal: total,
          currencyCode: "MMK",
          paidAmount: payments?.length
            ? total
            : paymentMethod === "cash"
              ? Number(receivedAmount)
              : total,
          changeAmount: payments?.length ? 0 : changeAmount,
          paymentMethod:
            payments && payments.length > 1
              ? "MIXED_PAYMENT"
              : (
                  {
                    cash: "CASH",
                    kpay: "KBZ_PAY",
                    wave: "WAVE_PAY",
                    card: "CARD",
                  } as const
                )[paymentMethod],
          payments,
        };
        let result: any;
        try {
          // Do not rely only on the health indicator here: it can lag behind
          // the actual network. Try the authoritative online checkout first.
          result = await createOrderApi(payload).unwrap();
        } catch (error) {
          const failure = error as {
            status?: string | number;
            data?: { message?: string };
            error?: string;
          };
          const transportFailure =
            failure.status === "FETCH_ERROR" ||
            failure.status === "TIMEOUT_ERROR";
          if (!transportFailure) throw error;
          let updatedQueue: QueuedSale[];
          try {
            updatedQueue = queueSale(payload, cachedLicense);
          } catch (queueError) {
            throw new Error(
              queueError instanceof Error
                ? `${queueError.message} Connect while online and retry checkout so this register can receive its offline allowance.`
                : "This register has no valid offline checkout license. Reconnect and retry checkout.",
            );
          }
          setQueuedSales(updatedQueue);
          alert(
            "Sale saved on this device and queued for sync. Keep this register session open until it syncs.",
          );
          setCart([]);
          setCheckoutOrderNumber(`POS-${crypto.randomUUID()}`);
          setPaymentModalOpen(false);
          setCheckoutError(null);
          setReceivedAmount("");
          return;
        }
        const order = result?.order ?? result?.data?.order ?? result;
        completedOrderId = order?.id;
        digitalReceipt = result?.digitalReceipt ?? result?.data?.digitalReceipt;
        if (order?.id && order.status === "PENDING")
          await completeOrderApi(order.id).unwrap();
      } catch (e) {
        const apiError = e as any;
        const responseData = apiError?.data;
        const serverMessage = [
          responseData?.message,
          responseData?.data?.message,
          responseData?.error,
          responseData?.data?.error,
          typeof responseData === "string" ? responseData : undefined,
          apiError?.error?.data?.message,
          apiError?.error?.message,
          typeof apiError?.error === "string" ? apiError.error : undefined,
          apiError?.message,
        ].find((message) => typeof message === "string" && message.trim());
        const statusHint =
          apiError?.status === 403
            ? "Checkout was denied. Check the workspace subscription status and your account permissions."
            : typeof apiError?.status === "number"
              ? `The server could not complete checkout (HTTP ${apiError.status}).`
              : undefined;
        setCheckoutError(
          serverMessage ||
            statusHint ||
            (e instanceof Error ? e.message : "") ||
            "Could not complete the order. Please try again.",
        );
        return;
      }
    } else {
      setCheckoutError(
        isConnected
          ? "Choose a store before checkout."
          : "Connect to the server before taking payment.",
      );
      return;
    }
    const completedReceiptData: ReceiptData = {
      orderNumber: checkoutOrderNumber,
      orderId: completedOrderId,
      digitalReceiptUrl: digitalReceipt?.url,
      digitalReceiptExpiresAt: digitalReceipt?.expiresAt,
      createdAt: new Date().toISOString(),
      storeName: selectedStore?.name,
      storeId: selectedStore?.id,
      storeAddress: selectedStore?.address,
      storePhone: selectedStore?.phone,
      receiptHeader: String(
        apiStoreSettings.find(
          (setting: any) => setting.settingKey === "receipt_header",
        )?.settingValue ||
          selectedStore?.name ||
          "KANITT RETAIL",
      ),
      receiptFooter: String(
        apiStoreSettings.find(
          (setting: any) => setting.settingKey === "receipt_footer",
        )?.settingValue || "Thank you for shopping with us!",
      ),
      allowAutoPrint: true,
      items: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        subTotal: item.price * item.quantity,
      })),
      subTotal: subtotal,
      taxAmount: tax,
      discountAmount: discount,
      grandTotal: total,
      paymentMethod:
        payments && payments.length > 1 ? "MIXED_PAYMENT" : paymentMethod,
      payments,
      receivedAmount: payments?.length
        ? total
        : Number(receivedAmount) || total,
      changeAmount: payments?.length ? 0 : changeAmount,
    };
    setCurrentReceipt(completedReceiptData);
    setCart([]);
    setPromotionCode("");
    setPromotionInput("");
    setOrderPricing(null);
    setCheckoutOrderNumber(`POS-${crypto.randomUUID()}`);
    setPaymentModalOpen(false);
    setCheckoutError(null);
    setReceivedAmount("");
  };

  return (
    <div className="flex h-screen min-h-0 w-full min-w-0 bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        isLoading={isRTKLoading}
        syncWithServer={syncWithServer}
        stores={stores}
        selectedStore={selectedStore}
        setSelectedStore={setSelectedStore}
        storeError={isStoresError}
        hasQueuedSales={queuedSales.length > 0}
        onLogout={onLogout}
      />

      {activeTab === "dashboard" && (
        <DashboardView
          orders={apiOrders}
          products={products}
          loading={isRTKLoading || isOrdersLoading}
          onOpenOrders={() => setActiveTab("orders")}
          onOpenInventory={() => setActiveTab("inventory")}
        />
      )}
      {activeTab === "orders" && (
        <OrdersView orders={apiOrders} isLoading={isOrdersLoading} />
      )}
      {activeTab === "manage" && (
        <ManageView
          products={products}
          categories={apiCategories}
          brands={brands}
          suppliers={suppliers}
          customers={customers}
          staff={staff}
          userRole={userRole}
          storeId={selectedStore?.id}
          stores={stores}
          loading={isProductsLoading}
          onCreateProduct={(payload) => createCatalogProduct(payload).unwrap()}
          onCreateEntity={(section, payload) => {
            if (section === "staff") return createStaff(payload).unwrap();
            if (section === "stores") return createStore(payload).unwrap();
            if (section === "brands")
              return createBrand(
                payload as { name: string; description?: string },
              ).unwrap();
            if (section === "categories")
              return createCategory(
                payload as { name: string; description?: string },
              ).unwrap();
            if (section === "suppliers")
              return createSupplier(payload).unwrap();
            return createCustomer(payload).unwrap();
          }}
          onUpdateEntity={(section, id, payload) => {
            if (section === "products")
              return updateCatalogProduct({ id, patch: payload }).unwrap();
            if (section === "staff")
              return updateStaff({ id, patch: payload }).unwrap();
            if (section === "stores")
              return updateStore({ id, patch: payload }).unwrap();
            if (section === "brands")
              return updateBrand({ id, patch: payload }).unwrap();
            if (section === "categories")
              return updateCategory({ id, patch: payload }).unwrap();
            if (section === "suppliers")
              return updateSupplier({ id, patch: payload }).unwrap();
            return updateCustomer({ id, patch: payload }).unwrap();
          }}
          onAdjustStock={(
            productId,
            variantId,
            quantity,
            reason,
            movementType,
          ) =>
            adjustStock({
              storeId: selectedStore!.id,
              productId,
              variantId,
              quantity,
              reason,
              movementType,
            }).unwrap()
          }
          onAssignBarcode={(productId, barcode) =>
            updateCatalogProduct({ id: productId, patch: { barcode } }).unwrap()
          }
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === "erp" && (
        <ERPView
          selectedStoreId={selectedStore?.id}
          userRole={userRole}
          stores={stores}
          transferDestinationStores={transferDestinationStores}
          products={products}
          suppliers={suppliers}
          orders={apiOrders}
          purchaseOrders={purchaseOrders}
          expenses={expenses}
          expenseCategories={expenseCategories}
          supplierPayments={supplierPayments}
          transfers={transfers}
          returns={returns}
          loading={
            isPoLoading ||
            isExpensesLoading ||
            isSupplierPaymentsLoading ||
            isTransfersLoading ||
            isReturnsLoading
          }
          onCreatePurchaseOrder={(payload) =>
            createPurchaseOrder(payload).unwrap()
          }
          onUpdatePurchaseOrder={(id, patch) =>
            updatePurchaseOrder({ id, patch }).unwrap()
          }
          onReceivePurchaseOrder={(id, storeId, lots) =>
            receivePurchaseOrder({ id, storeId, lots }).unwrap()
          }
          onCreateExpense={(payload) => createExpense(payload).unwrap()}
          onCreateExpenseCategory={(name) =>
            createExpenseCategory({ name }).unwrap()
          }
          onCreateSupplierPayment={(payload) =>
            createSupplierPayment(payload).unwrap()
          }
          onCreateTransfer={(payload) => createTransfer(payload).unwrap()}
          onCompleteTransfer={(id) => completeTransfer(id).unwrap()}
          onCreateReturn={(payload) => createReturn(payload).unwrap()}
        />
      )}
      {activeTab === "activity" && <ActivityLogView />}
      {activeTab === "reports" && (
        <ReportsView
          orders={apiOrders}
          products={products}
          expenses={expenses}
          returns={returns}
          purchaseOrders={purchaseOrders}
          isLoading={isOrdersLoading}
        />
      )}
      {activeTab === "commerce" && (
        <BusinessToolsView storeId={selectedStore?.id} />
      )}
      {activeTab === "admin" && <AdminView stores={stores} />}
      {activeTab === "notifications" && <NotificationsView />}
      {activeTab === "chat" && (
        <ChatView storeId={selectedStore?.id} storeName={selectedStore?.name} />
      )}
      {activeTab === "requests" && (
        <StockRequestsView
          storeId={selectedStore?.id}
          stores={stores}
          userRole={userRole}
          userPermissions={userPermissions}
          allowedTransferStoreIds={allowedStoreIds}
        />
      )}
      {activeTab === "sync" && (
        <SyncView
          connected={isConnected}
          loading={isRTKLoading || isOrdersLoading}
          lastSync={lastSync}
          onSync={syncWithServer}
          queuedSales={queuedSales}
          offlineLicense={offlineLicense ?? getCachedOfflineLicense(selectedStore?.id)}
          onDiscardSale={(id) => setQueuedSales(removeQueuedSale(id))}
        />
      )}

      {activeTab === "pos" && (
        <>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <PosView
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
              filteredProducts={filteredProducts}
              allProducts={products}
              addToCart={addToCart}
            />
          </main>
          <CartView
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            setCart={setCart}
            subtotal={subtotal}
            tax={tax}
            total={total}
            setPaymentModalOpen={setPaymentModalOpen}
            discount={discount}
            promotionCode={promotionCode}
            promotionInput={promotionInput}
            setPromotionInput={setPromotionInput}
            applyPromotion={() => {
              setCheckoutError(null);
              setPricingError(null);
              setOrderPricing(null);
              setPromotionCode(promotionInput.trim());
            }}
            pricingLoading={
              isPricingLoading ||
              (!!selectedStore?.id &&
                cart.length > 0 &&
                !orderPricing &&
                !pricingError)
            }
            pricingError={pricingError}
          />
        </>
      )}

      {activeTab === "inventory" && (
        <InventoryView
          storeId={selectedStore?.id}
          userRole={userRole}
          userPermissions={userPermissions}
          stores={transferDestinationStores.map((store) => ({ id: store.id, name: store.name }))}
          suppliers={suppliers.map((supplier: any) => ({
            id: supplier.id,
            name: supplier.name,
            leadTimeDays: supplier.leadTimeDays,
          }))}
          movements={inventoryMovements}
          onAdjustStock={(payload) =>
            adjustStock({
              storeId: selectedStore!.id,
              productId: payload.productId,
              variantId: payload.variantId,
              lotId: payload.lotId,
              quantityIsBaseUnit: payload.quantityIsBaseUnit,
              quantity: payload.quantity,
              movementType: payload.reason.toLowerCase().includes("expired")
                ? "EXPIRED"
                : payload.reason.toLowerCase().includes("damage") || payload.reason.toLowerCase().includes("quarantine")
                  ? "DAMAGE"
                  : "ADJUSTMENT",
              reason: [payload.reason, payload.notes].filter(Boolean).join(" · "),
            }).unwrap()
          }
          onDisposeStock={(payload) =>
            adjustStock({
              storeId: selectedStore!.id,
              productId: payload.productId,
              variantId: payload.variantId,
              lotId: payload.lotId,
              quantityIsBaseUnit: true,
              quantity: payload.quantity,
              movementType: payload.reason === "expired_disposal" ? "EXPIRED" : "DAMAGE",
              reason: [payload.reason, payload.notes].filter(Boolean).join(" · "),
            }).unwrap()
          }
          onTransferStock={(payload) =>
            createTransfer({
              fromStoreId: payload.fromStoreId,
              toStoreId: payload.toStoreId,
              notes: payload.notes,
              items: [{
                productId: payload.productId,
                variantId: payload.variantId,
                quantity: payload.quantity,
              }],
            }).unwrap()
          }
          onCreatePurchaseOrder={(po) =>
            createPurchaseOrder({
              storeId: po.storeId,
              supplierId: po.supplierId,
              status: po.status,
              expectedDate: po.expectedDate,
              subTotal: po.subtotal,
              taxAmount: 0,
              grandTotal: po.total,
              currencyCode: "MMK",
              notes: po.notes,
              items: po.lines.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                quantity: line.quantity,
                unitCost: line.unitCost,
                totalCost: line.quantity * line.unitCost,
              })),
            }).unwrap()
          }
          onRequestSubmitted={() => setActiveTab("requests")}
          products={products.flatMap((product) =>
            (product.variants ?? []).map((variant) => ({
              ...product,
              productId: product.id,
              variantId: variant.id,
              id: `${product.id}:${variant.id}`,
              name: `${product.name} · ${variant.name}`,
              sku: variant.sku || product.sku,
              price: variant.price,
              costPrice: variant.costPrice ?? product.costPrice,
              stock: variant.stock ?? 0,
              variants: [variant],
              inventories: product.inventories?.filter(
                (inventory: any) =>
                  inventory.variantId ===
                  (product.baseUnitName && product.baseUnitVariantId
                    ? product.baseUnitVariantId
                    : variant.id),
              ),
            })),
          )}
          isLoading={isProductsLoading}
        />
      )}
      {activeTab === "sessions" && (
        <SessionsView
          sessions={apiSessions}
          orders={apiOrders}
          storeId={selectedStore?.id}
          storeName={selectedStore?.name}
          userId={authUser?.id}
          userRole={userRole}
          sessionMode={registerSessionMode}
          onOpen={(storeId, openingBalance) =>
            openRegisterSession({ storeId, openingBalance }).unwrap()
          }
          onClose={(sessionId, closingBalance) => {
            if (
              queuedSales.some((sale) => sale.payload.sessionId === sessionId)
            )
              throw new Error(
                "This register has offline sales waiting to sync. Reconnect and sync them before closing the session.",
              );
            return closeRegisterSession({ sessionId, closingBalance }).unwrap();
          }}
        />
      )}
      {activeTab === "settings" && (
        <SettingsView
          connected={isConnected}
          storeName={selectedStore?.name}
          storeId={selectedStore?.id}
          canEditStoreSettings={["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(
            userRole,
          )}
          canEditRegisterSessionMode={["ADMIN", "SUPER_ADMIN"].includes(userRole)}
        />
      )}

      <PaymentModal
        paymentModalOpen={paymentModalOpen}
        setPaymentModalOpen={setPaymentModalOpen}
        total={total}
        receivedAmount={receivedAmount}
        setReceivedAmount={setReceivedAmount}
        changeAmount={changeAmount}
        handleCheckoutSuccess={handleCheckoutSuccess}
        isLoading={isCheckoutLoading || isCompletingOrder}
        error={checkoutError}
        onDismissError={() => setCheckoutError(null)}
      />

      <ReceiptModal
        receipt={currentReceipt}
        onClose={() => setCurrentReceipt(null)}
        onRefreshDigitalReceipt={async (orderId) => {
          const response: any = await createDigitalReceiptLinkApi(orderId).unwrap();
          return response?.digitalReceipt ?? response?.data?.digitalReceipt ?? null;
        }}
      />
    </div>
  );
}

import { getAuthToken, removeAuthToken } from "./services/secureStorage";

// ── Root App — auth gate only, no other hooks ──────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("kanitt_token"),
  );

  useEffect(() => {
    void getAuthToken().then((t) => {
      if (t && t !== token) setToken(t);
    });
  }, []);

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    void removeAuthToken();
    setToken(null);
  };

  if (!token) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return <PosShell onLogout={handleLogout} />;
}
