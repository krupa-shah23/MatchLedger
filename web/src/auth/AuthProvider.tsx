import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ApiClient, ApiError } from "../api/client.js";
import { clearToken, loadToken, loadUser, saveToken, saveUser, type StoredUser } from "./token-store.js";

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: { userId: string; username: string; role: StoredUser["role"]; accountIds: string[] };
}

export interface AuthContextValue {
  token: string | null;
  user: StoredUser | null;
  client: ApiClient;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, baseUrl = "/api/v1" }: { children: React.ReactNode; baseUrl?: string }) {
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [user, setUser] = useState<StoredUser | null>(() => loadUser());

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  // One automatic refresh on 401; if it fails, log out (section 4.9 / edge cases).
  const refreshOnce = useCallback(async () => {
    const current = loadToken();
    if (!current) {
      logout();
      return;
    }
    try {
      const refreshed = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${current}` },
      });
      if (!refreshed.ok) {
        logout();
        return;
      }
      const body = (await refreshed.json()) as { token: string };
      saveToken(body.token);
      setToken(body.token);
    } catch {
      logout();
    }
  }, [baseUrl, logout]);

  const client = useMemo(
    () =>
      new ApiClient({
        baseUrl,
        getToken: () => loadToken(),
        onUnauthorized: refreshOnce,
      }),
    [baseUrl, refreshOnce]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await client.post<LoginResponse>("/auth/login", { username, password });
      const storedUser: StoredUser = {
        id: response.user.userId,
        username: response.user.username,
        role: response.user.role,
        accountIds: response.user.accountIds,
      };
      saveToken(response.token);
      saveUser(storedUser);
      setToken(response.token);
      setUser(storedUser);
    },
    [client]
  );

  const value = useMemo<AuthContextValue>(() => ({ token, user, client, login, logout }), [token, user, client, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
