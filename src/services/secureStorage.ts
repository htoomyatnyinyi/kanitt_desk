// Secure storage helper with fallback to localStorage
// Uses localStorage for reliable web & desktop app token persistence

const TOKEN_KEY = "kanitt_token";

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn("Storage write error:", err);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn("Storage read error:", err);
    return null;
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("Storage delete error:", err);
  }
}

export interface AuthUser {
  id?: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

export function decodeAuthToken(token?: string | null): AuthUser | null {
  const jwtToken = token || localStorage.getItem(TOKEN_KEY);
  if (!jwtToken) return null;
  try {
    const parts = jwtToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  } catch {
    return null;
  }
}

// Convenience helpers specifically for Auth Tokens
export const setAuthToken = (token: string) => setSecureItem(TOKEN_KEY, token);
export const getAuthToken = () => getSecureItem(TOKEN_KEY);
export const removeAuthToken = () => removeSecureItem(TOKEN_KEY);
