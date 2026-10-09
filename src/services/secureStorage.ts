// Secure storage helper with fallback to localStorage
// Uses Tauri plugin-store / OS Keychain when running inside Tauri Desktop, 
// and seamlessly falls back to localStorage when running in standard Web browser.

const TOKEN_KEY = "kanitt_token";

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      // Dynamic import Tauri Store if in Tauri runtime
      const { LazyStore } = await import("@tauri-apps/plugin-store");
      const store = new LazyStore(".settings.dat");
      await store.set(key, value);
      await store.save();
    }
  } catch (err) {
    console.warn("Tauri secure store write error, falling back to localStorage:", err);
  }
  // Standard localStorage persistence
  localStorage.setItem(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { LazyStore } = await import("@tauri-apps/plugin-store");
      const store = new LazyStore(".settings.dat");
      const val = await store.get<string>(key);
      if (val) return val;
    }
  } catch (err) {
    console.warn("Tauri secure store read error, falling back to localStorage:", err);
  }
  return localStorage.getItem(key);
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { LazyStore } = await import("@tauri-apps/plugin-store");
      const store = new LazyStore(".settings.dat");
      await store.delete(key);
      await store.save();
    }
  } catch (err) {
    console.warn("Tauri secure store delete error, falling back to localStorage:", err);
  }
  localStorage.removeItem(key);
}

// Convenience helpers specifically for Auth Tokens
export const setAuthToken = (token: string) => setSecureItem(TOKEN_KEY, token);
export const getAuthToken = () => getSecureItem(TOKEN_KEY);
export const removeAuthToken = () => removeSecureItem(TOKEN_KEY);
