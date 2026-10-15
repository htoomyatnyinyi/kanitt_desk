import type { OrderInput } from "../store/apiSlice";

export interface QueuedSale {
  id: string;
  queuedAt: string;
  payload: OrderInput;
  error?: string;
}

export interface OfflineLicense {
  id: string;
  tenantId: string;
  storeId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
  syncDeadline: string;
  maxSales: number;
  salesUsed: number;
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
const licenseKey = (storeId: string) => `kanitt_offline_license:${currentTenantId()}:${storeId}`;

export const getOfflineDeviceId = () => {
  const key = `kanitt_offline_device:${currentTenantId()}`;
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
};

export const cacheOfflineLicense = (license: OfflineLicense) => {
  localStorage.setItem(licenseKey(license.storeId), JSON.stringify(license));
};

export const getCachedOfflineLicense = (storeId?: string) => {
  if (!storeId) return null;
  try {
    const value = localStorage.getItem(licenseKey(storeId));
    return value ? JSON.parse(value) as OfflineLicense : null;
  } catch {
    return null;
  }
};

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

export const queueSale = (payload: OrderInput, license: OfflineLicense | null): QueuedSale[] => {
  if (!payload.orderNumber || !payload.pricingToken || !payload.sessionId) {
    throw new Error("An offline sale needs an order number, verified price quote and open register session.");
  }
  if (!license || license.storeId !== payload.storeId || new Date(license.expiresAt).getTime() <= Date.now()) {
    throw new Error("This device has no valid offline checkout license. Reconnect to the internet before selling.");
  }
  const entries = readQueuedSales();
  const waitingWithLicense = entries.filter((entry) => entry.payload.offlineLicenseId === license.id).length;
  if (license.salesUsed + waitingWithLicense >= license.maxSales) {
    throw new Error(`This offline license allows ${license.maxSales} sales. Reconnect and sync your queued sales before continuing.`);
  }
  if (!entries.some((entry) => entry.payload.orderNumber === payload.orderNumber)) {
    entries.push({
      id: crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
      payload: { ...payload, offlineSale: true, offlineLicenseId: license.id, offlineLicenseToken: license.token },
    });
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
