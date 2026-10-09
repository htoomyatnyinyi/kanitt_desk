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

// Convenience helpers specifically for Auth Tokens
export const setAuthToken = (token: string) => setSecureItem(TOKEN_KEY, token);
export const getAuthToken = () => getSecureItem(TOKEN_KEY);
export const removeAuthToken = () => removeSecureItem(TOKEN_KEY);
