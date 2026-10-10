import { useState, useEffect } from "react";
import {
  useGetHealthQuery,
  useGetProductsQuery,
  useGetStoresQuery,
  useGetSessionsQuery,
  useCreateOrderMutation,
  useQuoteOrderMutation,
  useCompleteOrderMutation,
  useGetOrdersQuery,
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
  useCreateStockTransferMutation,
  useCompleteStockTransferMutation,
  useGetReturnsQuery,
  useCreateReturnMutation,
  useOpenSessionMutation,
  useCloseSessionMutation,
  Store as ApiStore,
} from "./store/apiSlice";
import { Product, CartItem } from "./types";

import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { PosView } from "./components/PosView";
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
import { AdminView } from "./components/AdminView";
import { ReportsView } from "./components/ReportsView";
import { ReceiptModal, ReceiptData } from "./components/ReceiptModal";
import { queueSale, readQueuedSales, removeQueuedSale, updateQueuedSaleError, type QueuedSale } from "./services/offlineSalesQueue";

// ── POS Shell (rendered only when authenticated) ───────────────────────────
function PosShell({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "pos"
    | "orders"
    | "inventory"
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
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "kpay" | "wave" | "card"
  >("cash");
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
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [queuedSales, setQueuedSales] = useState<QueuedSale[]>(() => readQueuedSales());
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(null);

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
  const {
    data: apiStores,
    isError: isStoresError,
    refetch: refetchStores,
  } = useGetStoresQuery();
  const { data: apiSessions, refetch: refetchSessions } = useGetSessionsQuery({
    storeId: selectedStore?.id,
  });
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
  } = useGetPurchaseOrdersQuery();
  const {
    data: expenses = [],
    isLoading: isExpensesLoading,
    refetch: refetchExpenses,
  } = useGetExpensesQuery();
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
  const {
    data: returns = [],
    isLoading: isReturnsLoading,
    refetch: refetchReturns,
  } = useGetReturnsQuery();
  const [createOrderApi, { isLoading: isCheckoutLoading }] =
    useCreateOrderMutation();
  const [quoteOrder, { isLoading: isPricingLoading }] = useQuoteOrderMutation();
  const [completeOrderApi, { isLoading: isCompletingOrder }] =
    useCompleteOrderMutation();

  // Global Keyboard Shortcuts (F1: Search, F2: Checkout, Esc: Cancel Modals)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setActiveTab("pos");
        // Focus search input
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="barcode"]');
        searchInput?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (activeTab === "pos" && cart.length > 0 && !isPricingLoading && !pricingError) {
          setPaymentModalOpen(true);
        }
      } else if (e.key === "Escape") {
        if (paymentModalOpen) {
          e.preventDefault();
          setPaymentModalOpen(false);
        } else if (currentReceipt) {
          e.preventDefault();
          setCurrentReceipt(null);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeTab, cart.length, isPricingLoading, pricingError, paymentModalOpen, currentReceipt]);
  const [createCatalogProduct] = useCreateCatalogProductMutation();
  const [updateCatalogProduct] = useUpdateCatalogProductMutation();
  const [createCategory] = useCreateCategoryMutation();
  const [createBrand] = useCreateBrandMutation();
  const [createSupplier] = useCreateSupplierMutation();
  const [createCustomer] = useCreateCustomerMutation();
  const [createStaff] = useCreateStaffMutation();
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
        if (order?.id && order.status === "PENDING") await completeOrderApi(order.id).unwrap();
        setQueuedSales(removeQueuedSale(sale.id));
      } catch (error) {
        const failure = error as { data?: { message?: string }; error?: string };
        const message = failure.data?.message || failure.error || "Sale could not sync. Check its price and register session.";
        setQueuedSales(updateQueuedSaleError(sale.id, message));
        break;
      }
    }
  };

  useEffect(() => {
    if (isConnected && queuedSales.length > 0) void flushQueuedSales();
  }, [isConnected]);

  // Normalize API products — fix category union type to plain string
  const products: Product[] = (() => {
    if (!apiProducts) return [];
    return apiProducts.map((p) => ({
      ...p,
      category:
        typeof p.category === "object" && p.category !== null
          ? (p.category as { name: string }).name
          : (p.category as string) || "General",
      stock: p.stock ?? 0,
      barcode: p.barcode || "",
    })) as Product[];
  })();

  const stores = apiStores || [];

  useEffect(() => {
    let stale = false;
    if (!selectedStore?.id || cart.length === 0) {
      setOrderPricing(null);
      setPricingError(null);
      if (cart.length === 0) {
        setPromotionCode("");
        setPromotionInput("");
      }
      return () => { stale = true; };
    }
    const timer = window.setTimeout(() => {
      setOrderPricing(null);
      setPricingError(null);
      void quoteOrder({
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        ...(promotionCode ? { promotionCode } : {}),
      }).unwrap().then((result) => {
        if (!stale) setOrderPricing({ ...result.quote, quoteToken: result.quoteToken });
      }).catch((error: unknown) => {
        if (stale) return;
        const value = error as { data?: { message?: string }; error?: string };
        setPricingError(value.data?.message || value.error || "Could not calculate the current sale total.");
      });
    }, 160);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [cart, selectedStore?.id, promotionCode, quoteOrder]);

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0]);
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

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
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
      selectedCategory === "All" || product.category === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
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

  const handleCheckoutSuccess = async () => {
    if (!orderPricing || pricingError) {
      setCheckoutError(pricingError || "Wait for the server to calculate this sale before taking payment.");
      return;
    }
    if (isConnected && selectedStore) {
      const activeSession = (apiSessions ?? []).find(
        (session) => session.storeId === selectedStore.id && session.status === "OPEN",
      );
      if (!activeSession) {
        setCheckoutError("Open a register session for this store before completing a sale.");
        return;
      }
      try {
        const payload = {
          orderNumber: checkoutOrderNumber,
          pricingToken: orderPricing.quoteToken,
          storeId: selectedStore.id,
          sessionId: activeSession.id,
          items: orderPricing.items.map((item: { productId: string; variantId?: string; quantity: number; unitPrice: number; subTotal: number }) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subTotal: item.subTotal,
          })),
          promotionCode: promotionCode || undefined,
          discountAmount: discount,
          subTotal: subtotal,
          taxAmount: tax,
          grandTotal: total,
          currencyCode: "MMK",
          paidAmount: paymentMethod === "cash" ? Number(receivedAmount) : total,
          changeAmount: changeAmount,
          paymentMethod: (
            {
              cash: "CASH",
              kpay: "KBZ_PAY",
              wave: "WAVE_PAY",
              card: "CARD",
            } as const
          )[paymentMethod],
        };
        let result: any;
        try {
          result = await createOrderApi(payload).unwrap();
        } catch (error) {
          const failure = error as { status?: string | number; data?: { message?: string }; error?: string };
          const transportFailure = failure.status === "FETCH_ERROR" || failure.status === "TIMEOUT_ERROR" || (typeof failure.status === "number" && failure.status >= 500);
          if (!transportFailure) throw error;
          const updatedQueue = queueSale(payload);
          setQueuedSales(updatedQueue);
          alert("Sale saved on this device and queued for sync. Keep this register session open until it syncs.");
          setCart([]);
          setCheckoutOrderNumber(`POS-${crypto.randomUUID()}`);
          setPaymentModalOpen(false);
          setCheckoutError(null);
          setReceivedAmount("");
          return;
        }
        const order = result?.order ?? result?.data?.order ?? result;
        if (order?.id && order.status === "PENDING") await completeOrderApi(order.id).unwrap();
      } catch (e) {
        const apiError = e as { data?: { message?: string }; error?: string };
        setCheckoutError(
          apiError.data?.message ||
            apiError.error ||
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
      createdAt: new Date().toISOString(),
      storeName: selectedStore?.name,
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
      paymentMethod,
      receivedAmount: Number(receivedAmount) || total,
      changeAmount,
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
    <div className="flex h-screen h-dvh min-h-0 w-full min-w-0 bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
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
          storeId={selectedStore?.id}
          stores={stores}
          loading={isProductsLoading}
          onCreateProduct={(payload) => createCatalogProduct(payload).unwrap()}
          onCreateEntity={(section, payload) => {
            if (section === "staff") return createStaff(payload).unwrap();
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
            if (section === "products") return updateCatalogProduct({ id, patch: payload }).unwrap();
            if (section === "staff") return updateStaff({ id, patch: payload }).unwrap();
            if (section === "brands") return updateBrand({ id, patch: payload }).unwrap();
            if (section === "categories") return updateCategory({ id, patch: payload }).unwrap();
            if (section === "suppliers") return updateSupplier({ id, patch: payload }).unwrap();
            return updateCustomer({ id, patch: payload }).unwrap();
          }}
          onAdjustStock={(productId, variantId, quantity, reason) =>
            adjustStock({
              storeId: selectedStore!.id,
              productId,
              variantId,
              quantity,
              reason,
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
          stores={stores}
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
          onReceivePurchaseOrder={(id, storeId) =>
            receivePurchaseOrder({ id, storeId }).unwrap()
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
      {activeTab === "commerce" && <BusinessToolsView storeId={selectedStore?.id} />}
      {activeTab === "admin" && <AdminView stores={stores} />}
      {activeTab === "sync" && (
        <SyncView
          connected={isConnected}
          loading={isRTKLoading || isOrdersLoading}
          lastSync={lastSync}
          onSync={syncWithServer}
          queuedSales={queuedSales}
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
            applyPromotion={() => { setCheckoutError(null); setPricingError(null); setOrderPricing(null); setPromotionCode(promotionInput.trim()); }}
            pricingLoading={isPricingLoading || (!!selectedStore?.id && cart.length > 0 && !orderPricing && !pricingError)}
            pricingError={pricingError}
          />
        </>
      )}

      {activeTab === "inventory" && <InventoryView products={products} />}
      {activeTab === "sessions" && <SessionsView sessions={apiSessions} storeId={selectedStore?.id} storeName={selectedStore?.name} onOpen={(storeId, openingBalance) => openRegisterSession({ storeId, openingBalance }).unwrap()} onClose={(sessionId, closingBalance) => {
        if (queuedSales.some((sale) => sale.payload.sessionId === sessionId)) throw new Error("This register has offline sales waiting to sync. Reconnect and sync them before closing the session.");
        return closeRegisterSession({ sessionId, closingBalance }).unwrap();
      }} />}
      {activeTab === "settings" && (
        <SettingsView connected={isConnected} storeName={selectedStore?.name} />
      )}

      <PaymentModal
        paymentModalOpen={paymentModalOpen}
        setPaymentModalOpen={setPaymentModalOpen}
        total={total}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
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
