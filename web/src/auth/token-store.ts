/**
 * Token persistence. sessionStorage only (decision 4): survives a reload for
 * the demo, cleared when the tab closes, never a cookie or a URL parameter.
 */

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export interface StoredUser {
  id: string;
  username: string;
  role: "TRADER" | "RISK" | "OPS" | "ADMIN";
  accountIds: string[];
}

export function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode, quota) — demo keeps running without persistence
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function loadUser(): StoredUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: StoredUser): void {
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}
