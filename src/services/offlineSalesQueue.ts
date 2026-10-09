import type { OrderInput } from "../store/apiSlice";

export interface QueuedSale {
  id: string;
  queuedAt: string;
  payload: OrderInput;
  error?: string;
}

const currentTenantId = () => {
  const token = localStorage.getItem("kanitt_token");
  const part = token?.split(".")[1];
  if (!part) throw new Error("Sign in again before saving an offline sale.");
  try {
    const binary = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload.tenantId) throw new Error("The signed-in account has no business workspace.");
    return String(payload.tenantId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("business workspace")) throw error;
    throw new Error("The offline queue could not verify the business account. Sign in again when online.");
  }
};

const storageKey = () => `kanitt_offline_sales:${currentTenantId()}`;

export const readQueuedSales = (): QueuedSale[] => {
  try {
    const value = localStorage.getItem(storageKey());
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (entries: QueuedSale[]) => localStorage.setItem(storageKey(), JSON.stringify(entries));

export const queueSale = (payload: OrderInput): QueuedSale[] => {
  if (!payload.orderNumber || !payload.pricingToken || !payload.sessionId) {
    throw new Error("An offline sale needs an order number, verified price quote and open register session.");
  }
  const entries = readQueuedSales();
  if (!entries.some((entry) => entry.payload.orderNumber === payload.orderNumber)) {
    entries.push({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), payload });
    write(entries);
  }
  return entries;
};

export const removeQueuedSale = (id: string): QueuedSale[] => {
  const entries = readQueuedSales().filter((entry) => entry.id !== id);
  write(entries);
  return entries;
};

export const updateQueuedSaleError = (id: string, error: string): QueuedSale[] => {
  const entries = readQueuedSales().map((entry) => entry.id === id ? { ...entry, error } : entry);
  write(entries);
  return entries;
};
