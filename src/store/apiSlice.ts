import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Use VITE_API_URL env var, or fall back to the live Cloudflare tunnel (same as kanitt_app)
let BASE = import.meta.env.VITE_API_URL || "https://pos.oasislab.de5.net";
if (!BASE.endsWith("/api")) BASE = `${BASE}/api`;
const API_BASE_URL = BASE;

export interface Product {
  id: string;
  name: string;
  category?: { name: string } | string;
  price: number;
  sku: string;
  stock?: number;
  barcode?: string;
  imageUrl?: string;
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

export interface OrderInput {
  storeId: string;
  items: { productId: string; quantity: number; price: number }[];
  totalAmount: number;
  paymentMethod: string;
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
  tagTypes: ["Products", "Stores", "Sessions", "Orders", "Categories"],
  endpoints: (builder) => ({
    // Health Check
    getHealth: builder.query<{ success: boolean; status: string; service: string }, void>({
      query: () => "/health",
    }),

    // Products
    getProducts: builder.query<Product[], void>({
      query: () => "/tenant/products",
      transformResponse: (response: any) => {
        const list = response?.data || response || [];
        return Array.isArray(list)
          ? list.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: typeof p.category === "object" ? p.category?.name || "General" : p.category || "General",
              price: Number(p.price) || 0,
              sku: p.sku || `SKU-${p.id.slice(0, 4)}`,
              stock: p.stock ?? 100,
              barcode: p.barcode || "",
            }))
          : [];
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

    // Stores
    getStores: builder.query<Store[], void>({
      query: () => "/tenant/stores",
      transformResponse: (res: any) => res?.data || res || [],
      providesTags: ["Stores"],
    }),

    // Sessions
    getSessions: builder.query<Session[], void>({
      query: () => "/tenant/sessions",
      transformResponse: (res: any) => res?.data || res || [],
      providesTags: ["Sessions"],
    }),

    openSession: builder.mutation<Session, { storeId: string; openingBalance: number }>({
      query: (body) => ({
        url: "/tenant/sessions",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sessions"],
    }),

    closeSession: builder.mutation<Session, { sessionId: string; closingBalance: number }>({
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
  }),
});

export const {
  useGetHealthQuery,
  useGetProductsQuery,
  useCreateProductMutation,
  useGetStoresQuery,
  useGetSessionsQuery,
  useOpenSessionMutation,
  useCloseSessionMutation,
  useCreateOrderMutation,
  useLoginMutation,
} = kanittApi;
