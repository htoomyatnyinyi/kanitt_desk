let _base = import.meta.env.VITE_API_URL || "https://pos.oasislab.de5.net";
if (!_base.endsWith("/api")) _base = `${_base}/api`;
const SERVER_URL = _base;

export interface ApiProduct {
  id: string;
  name: string;
  category?: { name: string } | string;
  price: number;
  sku: string;
  stock?: number;
  barcode?: string;
  imageUrl?: string;
}

export interface ApiStore {
  id: string;
  name: string;
  code?: string;
}

export interface ApiSession {
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

class ApiService {
  private token: string | null = localStorage.getItem("kanitt_token");

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("kanitt_token", token);
  }

  getToken() {
    return this.token;
  }

  logout() {
    this.token = null;
    localStorage.removeItem("kanitt_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${SERVER_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `HTTP error ${response.status}`,
      );
    }

    return data.data || data;
  }

  // Health check
  async checkHealth() {
    const res = await fetch(`${SERVER_URL}/health`);
    return res.json();
  }

  // Login
  async login(email: string, pass: string) {
    const data = await this.request<{ token: string; user: any }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      },
    );
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  // Fetch Stores
  async getStores() {
    return this.request<ApiStore[]>("/tenant/stores");
  }

  // Fetch Products
  async getProducts() {
    return this.request<ApiProduct[]>("/tenant/products");
  }

  // Fetch Active/All Sessions
  async getSessions() {
    return this.request<ApiSession[]>("/tenant/sessions");
  }

  // Open Session
  async openSession(storeId: string, openingBalance: number) {
    return this.request<ApiSession>("/tenant/sessions", {
      method: "POST",
      body: JSON.stringify({ storeId, openingBalance }),
    });
  }

  // Close Session
  async closeSession(sessionId: string, closingBalance: number) {
    return this.request<ApiSession>(`/tenant/sessions/${sessionId}/close`, {
      method: "POST",
      body: JSON.stringify({ closingBalance }),
    });
  }

  // Create Order
  async createOrder(orderData: {
    storeId: string;
    sessionId?: string;
    orderNumber?: string;
    items: { productId: string; variantId?: string; quantity: number }[];
    subTotal: number;
    taxAmount: number;
    grandTotal: number;
    paidAmount: number;
    changeAmount: number;
    paymentMethod: string;
  }) {
    return this.request("/tenant/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  }
}

export const apiService = new ApiService();
