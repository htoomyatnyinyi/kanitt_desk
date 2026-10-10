import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Use VITE_API_URL env var, or fall back to the live Cloudflare tunnel (same as kanitt_app)
let BASE = import.meta.env.VITE_API_URL || "https://pos.oasislab.de5.net";
if (!BASE.endsWith("/api")) BASE = `${BASE}/api`;
const API_BASE_URL = BASE;

const unwrapList = (response: any, key: string) => {
  const payload = response?.data ?? response;
  const list = Array.isArray(payload)
    ? payload
    : (payload?.[key] ?? payload?.data);
  return Array.isArray(list) ? list : [];
};

export interface Product {
  id: string;
  name: string;
  category?: { name: string } | string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  costPrice?: number;
  price: number;
  sku: string;
  stock?: number;
  inventories?: { quantity: number; lot?: { number: string; expiryDate?: string | null; manufacturingDate?: string | null } | null }[];
  barcode?: string;
  imageUrl?: string;
  variants?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    price: number;
    costPrice?: number;
  }[];
}

export interface Store {
  id: string;
  name: string;
  code?: string;
  address?: string;
  status?: string;
}

export interface Session {
  id: string;
  storeId: string;
  cashierName?: string;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingBalance?: number | null;
  status: "OPEN" | "CLOSED";
  store?: { name: string };
}

export interface ApiOrder {
  id: string;
  orderNumber?: string;
  storeId: string;
  createdAt: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  subTotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  items?: {
    id: string;
    productId?: string;
    variantId?: string;
    quantity: number;
    returnedQuantity?: number;
    unitPrice: number;
    subTotal: number;
    product?: { name?: string };
  }[];
  user?: { name?: string; email?: string };
}

export interface OrderInput {
  orderNumber?: string;
  promotionCode?: string;
  pricingToken?: string;
  quotedPricing?: Record<string, unknown>;
  discountAmount?: number;
  currencyCode?: string;
  storeId: string;
  sessionId?: string;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    subTotal: number;
  }[];
  subTotal: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  payments?: { method: string; amount: number; referenceNumber?: string }[];
}

export const kanittApi = createApi({
  reducerPath: "kanittApi",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("kanitt_token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    "Products",
    "Stores",
    "Sessions",
    "Orders",
    "Categories",
    "Brands",
    "Suppliers",
    "Customers",
    "Staff",
    "Inventory",
    "PurchaseOrders",
    "Expenses",
    "ExpenseCategories",
    "SupplierPayments",
    "StockTransfers",
    "Returns",
    "AuditLogs",
    "Promotions",
    "TaxRates",
    "CashRegisters",
    "GiftCards",
    "Wallets",
    "TenantProfile",
    "StoreSettings",
    "ApiKeys",
    "Subscription",
    "Notifications",
  ],
  endpoints: (builder) => ({
    // Health Check
    getHealth: builder.query<
      { success: boolean; status: string; service: string },
      void
    >({
      query: () => "/health",
    }),

    // Products
    getProducts: builder.query<Product[], { storeId?: string }>({
      query: ({ storeId }) => ({
        url: "/tenant/products",
        params: { limit: 100, ...(storeId ? { storeId } : {}) },
      }),
      transformResponse: (response: any) => {
        const list = unwrapList(response, "products");
        return list.map((p: any) => ({
          id: p.id,
          name: p.name,
          category:
            typeof p.category === "object"
              ? p.category?.name || "General"
              : p.category || "General",
          categoryId: p.categoryId,
          brandId: p.brandId,
          supplierId: p.supplierId,
          costPrice: Number(p.costPrice) || 0,
          price:
            Number(
              p.price ?? p.variants?.find((v: any) => v.isActive)?.price,
            ) || 0,
          sku: p.sku || `SKU-${p.id.slice(0, 4)}`,
          stock: Number(p.totalStock ?? p.stock ?? 0),
          inventories: Array.isArray(p.inventories) ? p.inventories.map((inventory: any) => ({
            quantity: Number(inventory.quantity) || 0,
            lot: inventory.lot ? { number: inventory.lot.number, expiryDate: inventory.lot.expiryDate, manufacturingDate: inventory.lot.manufacturingDate } : null,
          })) : [],
          barcode: p.barcode || "",
          variants: Array.isArray(p.variants)
            ? p.variants.map((v: any) => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                barcode: v.barcode || "",
                price: Number(v.price) || 0,
                costPrice: Number(v.costPrice) || 0,
              }))
            : [],
        }));
      },
      providesTags: ["Products"],
    }),

    createProduct: builder.mutation<Product, Partial<Product>>({
      query: (body) => ({
        url: "/tenant/products",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Products"],
    }),
    createCatalogProduct: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/products", method: "POST", body }),
      invalidatesTags: ["Products", "Inventory"],
    }),
    updateCatalogProduct: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/products/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Products", "Inventory"],
    }),

    getCategories: builder.query<any[], void>({
      query: () => ({ url: "/tenant/categories", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "categories"),
      providesTags: ["Categories"],
    }),
    createCategory: builder.mutation<
      any,
      { name: string; description?: string }
    >({
      query: (body) => ({ url: "/tenant/categories", method: "POST", body }),
      invalidatesTags: ["Categories"],
    }),
    updateCategory: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/categories/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Categories", "Products"],
    }),
    getBrands: builder.query<any[], void>({
      query: () => ({ url: "/tenant/brands", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "brands"),
      providesTags: ["Brands"],
    }),
    createBrand: builder.mutation<any, { name: string; description?: string }>({
      query: (body) => ({ url: "/tenant/brands", method: "POST", body }),
      invalidatesTags: ["Brands"],
    }),
    updateBrand: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/brands/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Brands"],
    }),
    getSuppliers: builder.query<any[], void>({
      query: () => ({ url: "/tenant/suppliers", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "suppliers"),
      providesTags: ["Suppliers"],
    }),
    createSupplier: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/suppliers", method: "POST", body }),
      invalidatesTags: ["Suppliers"],
    }),
    updateSupplier: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/suppliers/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Suppliers"],
    }),
    getCustomers: builder.query<any[], void>({
      query: () => ({ url: "/tenant/customers", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "customers"),
      providesTags: ["Customers"],
    }),
    createCustomer: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/customers", method: "POST", body }),
      invalidatesTags: ["Customers"],
    }),
    updateCustomer: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/customers/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Customers"],
    }),
    getStaff: builder.query<any[], { storeId?: string }>({
      query: ({ storeId }) => ({
        url: "/tenant/staff",
        params: { limit: 100, ...(storeId ? { storeId } : {}) },
      }),
      transformResponse: (r: any) => unwrapList(r, "staff"),
      providesTags: ["Staff"],
    }),
    createStaff: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/staff", method: "POST", body }),
      invalidatesTags: ["Staff"],
    }),
    updateStaff: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/staff/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Staff"],
    }),
    adjustStock: builder.mutation<
      any,
      {
        storeId: string;
        productId: string;
        variantId?: string;
        quantity: number;
        reason: string;
      }
    >({
      query: ({ storeId, productId, variantId, quantity, reason }) => ({
        url: "/tenant/inventory/movements",
        method: "POST",
        body: {
          storeId,
          productId,
          variantId,
          quantity,
          type: "ADJUSTMENT",
          referenceId: `DESKTOP-${crypto.randomUUID()}`,
          referenceType: "ManualAdjustment",
          reason,
        },
      }),
      invalidatesTags: ["Products", "Inventory"],
    }),
    getPurchaseOrders: builder.query<any[], void>({
      query: () => ({ url: "/tenant/purchase-orders", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "purchaseOrders"),
      providesTags: ["PurchaseOrders"],
    }),
    createPurchaseOrder: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({
        url: "/tenant/purchase-orders",
        method: "POST",
        body,
      }),
      invalidatesTags: ["PurchaseOrders"],
    }),
    updatePurchaseOrder: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/purchase-orders/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["PurchaseOrders"],
    }),
    receivePurchaseOrder: builder.mutation<
      any,
      { id: string; storeId: string; lots?: { purchaseOrderItemId: string; number: string; expiryDate?: string; manufacturingDate?: string; bestBeforeDate?: string }[] }
    >({
      query: ({ id, storeId }) => ({
        url: `/tenant/purchase-orders/${id}/receive`,
        method: "POST",
        body: { storeId, lots },
      }),
      invalidatesTags: ["PurchaseOrders", "Products", "Inventory"],
    }),
    getExpenses: builder.query<any[], void>({
      query: () => "/tenant/expenses",
      transformResponse: (r: any) => unwrapList(r, "expenses"),
      providesTags: ["Expenses"],
    }),
    createExpense: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/expenses", method: "POST", body }),
      invalidatesTags: ["Expenses"],
    }),
    getExpenseCategories: builder.query<any[], void>({
      query: () => "/tenant/expense-categories",
      transformResponse: (r: any) => unwrapList(r, "categories"),
      providesTags: ["ExpenseCategories"],
    }),
    createExpenseCategory: builder.mutation<
      any,
      { name: string; description?: string }
    >({
      query: (body) => ({
        url: "/tenant/expense-categories",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ExpenseCategories"],
    }),
    getSupplierPayments: builder.query<any[], void>({
      query: () => ({
        url: "/tenant/supplier-payments",
        params: { limit: 100 },
      }),
      transformResponse: (r: any) => unwrapList(r, "payments"),
      providesTags: ["SupplierPayments"],
    }),
    createSupplierPayment: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({
        url: "/tenant/supplier-payments",
        method: "POST",
        body,
      }),
      invalidatesTags: ["SupplierPayments", "Suppliers"],
    }),
    getStockTransfers: builder.query<any[], void>({
      query: () => ({ url: "/tenant/stock-transfers", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "stockTransfers"),
      providesTags: ["StockTransfers"],
    }),
    createStockTransfer: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({
        url: "/tenant/stock-transfers",
        method: "POST",
        body,
      }),
      invalidatesTags: ["StockTransfers"],
    }),
    completeStockTransfer: builder.mutation<any, string>({
      query: (id) => ({
        url: `/tenant/stock-transfers/${id}/complete`,
        method: "POST",
      }),
      invalidatesTags: ["StockTransfers", "Products", "Inventory"],
    }),
    getReturns: builder.query<any[], void>({
      query: () => ({ url: "/tenant/returns", params: { limit: 100 } }),
      transformResponse: (r: any) => unwrapList(r, "returns"),
      providesTags: ["Returns"],
    }),
    getAuditLogs: builder.query<
      {
        logs: any[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      },
      {
        page?: number;
        limit?: number;
        action?: string;
        entity?: string;
        userId?: string;
      }
    >({
      query: ({ page = 1, limit = 50, ...filters }) => ({
        url: "/tenant/audit-logs",
        params: { page, limit, ...filters },
      }),
      transformResponse: (response: any) => ({
        logs: response?.logs ?? response?.data?.logs ?? [],
        meta: response?.meta ??
          response?.data?.meta ?? {
            total: 0,
            page: 1,
            limit: 50,
            totalPages: 0,
          },
      }),
      providesTags: ["AuditLogs"],
    }),
    getPromotions: builder.query<any[], void>({
      query: () => ({
        url: "/tenant/promotions",
        params: { page: 1, limit: 100 },
      }),
      transformResponse: (r: any) => unwrapList(r, "promotions"),
      providesTags: ["Promotions"],
    }),
    createPromotion: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/promotions", method: "POST", body }),
      invalidatesTags: ["Promotions"],
    }),
    updatePromotion: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/promotions/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Promotions"],
    }),
    getTaxRates: builder.query<any[], void>({
      query: () => "/tenant/tax-rates",
      transformResponse: (r: any) => unwrapList(r, "taxRates"),
      providesTags: ["TaxRates"],
    }),
    createTaxRate: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/tax-rates", method: "POST", body }),
      invalidatesTags: ["TaxRates"],
    }),
    updateTaxRate: builder.mutation<
      any,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/tenant/tax-rates/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["TaxRates"],
    }),
    getCashRegisters: builder.query<any[], { storeId?: string }>({
      query: ({ storeId }) => ({
        url: "/tenant/cash-registers",
        params: { page: 1, limit: 100, ...(storeId ? { storeId } : {}) },
      }),
      transformResponse: (r: any) => unwrapList(r, "cashRegisters"),
      providesTags: ["CashRegisters"],
    }),
    createCashRegister: builder.mutation<
      any,
      { storeId: string; name: string }
    >({
      query: (body) => ({
        url: "/tenant/cash-registers",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CashRegisters"],
    }),
    getGiftCards: builder.query<any[], void>({
      query: () => ({
        url: "/tenant/gift-cards",
        params: { page: 1, limit: 100 },
      }),
      transformResponse: (r: any) => unwrapList(r, "giftCards"),
      providesTags: ["GiftCards"],
    }),
    issueGiftCard: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/gift-cards", method: "POST", body }),
      invalidatesTags: ["GiftCards"],
    }),
    reloadGiftCard: builder.mutation<any, { id: string; amount: number }>({
      query: ({ id, amount }) => ({
        url: `/tenant/gift-cards/${id}/reload`,
        method: "POST",
        body: { amount },
      }),
      invalidatesTags: ["GiftCards"],
    }),
    updateGiftCardStatus: builder.mutation<any, { id: string; status: string }>(
      {
        query: ({ id, status }) => ({
          url: `/tenant/gift-cards/${id}/status`,
          method: "PATCH",
          body: { status },
        }),
        invalidatesTags: ["GiftCards"],
      },
    ),
    getWallets: builder.query<any[], void>({
      query: () => ({
        url: "/tenant/wallets",
        params: { page: 1, limit: 100 },
      }),
      transformResponse: (r: any) => unwrapList(r, "wallets"),
      providesTags: ["Wallets"],
    }),
    createWalletTransaction: builder.mutation<
      any,
      {
        customerId: string;
        amount: number;
        type: "DEPOSIT" | "WITHDRAWAL" | "REFUND" | "PAYMENT";
        description?: string;
      }
    >({
      query: (body) => ({
        url: "/tenant/wallets/transactions",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Wallets", "Customers"],
    }),
    createReturn: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/tenant/returns", method: "POST", body }),
      invalidatesTags: ["Returns", "Orders", "Products", "Inventory"],
    }),

    // Stores
    getStores: builder.query<Store[], void>({
      query: () => "/tenant/stores",
      transformResponse: (res: any) => unwrapList(res, "stores"),
      providesTags: ["Stores"],
    }),

    // Sessions
    getSessions: builder.query<Session[], { storeId?: string }>({
      query: ({ storeId }) => ({
        url: "/tenant/sessions",
        params: { limit: 100, ...(storeId ? { storeId } : {}) },
      }),
      transformResponse: (res: any) =>
        unwrapList(res, "sessions").map((s: any) => ({
          ...s,
          cashierName: s.cashierName ?? s.user?.name ?? s.user?.email ?? "—",
        })),
      providesTags: ["Sessions"],
    }),

    getOrders: builder.query<ApiOrder[], { storeId?: string }>({
      query: ({ storeId }) => ({
        url: "/tenant/orders",
        params: { limit: 100, ...(storeId ? { storeId } : {}) },
      }),
      transformResponse: (response: any) =>
        unwrapList(response, "orders").map((order: any) => ({
          ...order,
          grandTotal: Number(order.grandTotal) || 0,
        })),
      providesTags: ["Orders"],
    }),

    openSession: builder.mutation<
      Session,
      { storeId: string; openingBalance: number }
    >({
      query: (body) => ({
        url: "/tenant/sessions/open",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sessions"],
    }),

    closeSession: builder.mutation<
      Session,
      { sessionId: string; closingBalance: number }
    >({
      query: ({ sessionId, closingBalance }) => ({
        url: `/tenant/sessions/${sessionId}/close`,
        method: "POST",
        body: { closingBalance },
      }),
      invalidatesTags: ["Sessions"],
    }),

    // Orders
    createOrder: builder.mutation<any, OrderInput>({
      query: (body) => ({
        url: "/tenant/orders",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Orders", "Products", "Sessions"],
    }),
    quoteOrder: builder.mutation<
      any,
      {
        storeId?: string;
        items: { productId: string; variantId?: string; quantity: number }[];
        promotionCode?: string;
      }
    >({
      query: (body) => ({ url: "/tenant/orders/quote", method: "POST", body }),
    }),
    completeOrder: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/tenant/orders/${orderId}/complete`,
        method: "PATCH",
      }),
      invalidatesTags: ["Orders", "Products", "Sessions"],
    }),

    // Auth
    login: builder.mutation<
      { token: string; user: any },
      { email: string; password: string; tenantCode?: string }
    >({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
    }),

    // ── Admin: Tenant Profile ────────────────────────────────────────────
  getTenantProfile: builder.query<any, void>({
    query: () => "/tenant/profile",
    transformResponse: (r: any) => r?.tenant ?? r,
    providesTags: ["TenantProfile"],
  }),
  updateTenantProfile: builder.mutation<
    any,
    { name?: string; email?: string; phone?: string }
  >({
    query: (body) => ({ url: "/tenant/profile", method: "PUT", body }),
    invalidatesTags: ["TenantProfile"],
  }),

  // ── Admin: Store Settings ────────────────────────────────────────────
  getStoreSettings: builder.query<any[], { storeId?: string }>({
    query: ({ storeId }) => ({
      url: "/tenant/store-settings",
      params: { ...(storeId ? { storeId } : {}) },
    }),
    transformResponse: (r: any) => (Array.isArray(r) ? r : (r?.settings ?? [])),
    providesTags: ["StoreSettings"],
  }),
  upsertStoreSetting: builder.mutation<
    any,
    {
      storeId: string;
      settingKey: string;
      settingValue: unknown;
      description?: string;
    }
  >({
    query: (body) => ({ url: "/tenant/store-settings", method: "POST", body }),
    invalidatesTags: ["StoreSettings"],
  }),
  deleteStoreSetting: builder.mutation<any, string>({
    query: (id) => ({ url: `/tenant/store-settings/${id}`, method: "DELETE" }),
    invalidatesTags: ["StoreSettings"],
  }),

  // ── Admin: API Keys ──────────────────────────────────────────────────
  getApiKeys: builder.query<any[], void>({
    query: () => "/tenant/api-keys",
    transformResponse: (r: any) => (Array.isArray(r) ? r : (r?.apiKeys ?? [])),
    providesTags: ["ApiKeys"],
  }),
  createApiKey: builder.mutation<
    any,
    { userId: string; name: string; permissions?: string[]; expiresAt?: string }
  >({
    query: (body) => ({ url: "/tenant/api-keys", method: "POST", body }),
    invalidatesTags: ["ApiKeys"],
  }),
  revokeApiKey: builder.mutation<any, string>({
    query: (id) => ({ url: `/tenant/api-keys/${id}`, method: "DELETE" }),
    invalidatesTags: ["ApiKeys"],
  }),

  // ── Admin: Subscription ──────────────────────────────────────────────
  getSubscription: builder.query<any, void>({
    query: () => "/tenant/subscription",
    providesTags: ["Subscription"],
  }),
  requestSubscription: builder.mutation<
    any,
    {
      planId: string;
      billingCycle: "MONTHLY" | "YEARLY";
      paymentMethod: string;
      paymentReference: string;
    }
  >({
    query: (body) => ({
      url: "/tenant/subscription/requests",
      method: "POST",
      body,
    }),
    invalidatesTags: ["Subscription"],
  }),

  // ── Admin: Notifications ─────────────────────────────────────────────
  getNotifications: builder.query<
    { notifications: any[]; meta: any },
    { page?: number; isRead?: string }
  >({
    query: ({ page = 1, isRead }) => ({
      url: "/tenant/notifications",
      params: { page, limit: 20, ...(isRead !== undefined ? { isRead } : {}) },
    }),
    transformResponse: (r: any) => ({
      notifications: r?.notifications ?? [],
      meta: r?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
    }),
    providesTags: ["Notifications"],
  }),
  getNotificationUnreadCount: builder.query<number, void>({
    query: () => "/tenant/notifications/unread-count",
    transformResponse: (r: any) => r?.count ?? 0,
    providesTags: ["Notifications"],
  }),
  markNotificationRead: builder.mutation<any, string>({
    query: (id) => ({
      url: `/tenant/notifications/${id}/read`,
      method: "PATCH",
    }),
    invalidatesTags: ["Notifications"],
  }),
  markAllNotificationsRead: builder.mutation<any, void>({
    query: () => ({ url: "/tenant/notifications/read-all", method: "PATCH" }),
    invalidatesTags: ["Notifications"],
  }),
  deleteNotification: builder.mutation<any, string>({
    query: (id) => ({ url: `/tenant/notifications/${id}`, method: "DELETE" }),
    invalidatesTags: ["Notifications"],
  }),
  }),
});

export const {
  useGetHealthQuery,
  useGetProductsQuery,
  useCreateProductMutation,
  useCreateCatalogProductMutation,
  useUpdateCatalogProductMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useGetCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useGetStaffQuery,
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
  useGetAuditLogsQuery,
  useGetPromotionsQuery,
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
  useGetTaxRatesQuery,
  useCreateTaxRateMutation,
  useUpdateTaxRateMutation,
  useGetCashRegistersQuery,
  useCreateCashRegisterMutation,
  useGetGiftCardsQuery,
  useIssueGiftCardMutation,
  useReloadGiftCardMutation,
  useUpdateGiftCardStatusMutation,
  useGetWalletsQuery,
  useCreateWalletTransactionMutation,
  useGetStoresQuery,
  useGetSessionsQuery,
  useGetOrdersQuery,
  useOpenSessionMutation,
  useCloseSessionMutation,
  useCreateOrderMutation,
  useQuoteOrderMutation,
  useCompleteOrderMutation,
  useLoginMutation,
  // Admin
  useGetTenantProfileQuery,
  useUpdateTenantProfileMutation,
  useGetStoreSettingsQuery,
  useUpsertStoreSettingMutation,
  useDeleteStoreSettingMutation,
  useGetApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useGetSubscriptionQuery,
  useRequestSubscriptionMutation,
  useGetNotificationsQuery,
  useGetNotificationUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} = kanittApi;
