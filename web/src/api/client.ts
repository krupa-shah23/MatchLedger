/**
 * Typed HTTP client for the MatchLedger API.
 * Handles bearer token auth, error parsing, 401 retry, and Retry-After.
 */

import type { ErrorResponse, LoginResponse } from "@matchledger/common";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => Promise<void>;
}

export class ApiClient {
  private config: ApiClientConfig;
  private refreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  private parseError(status: number, body: unknown): { code: string; message: string } {
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = body as ErrorResponse;
      return { code: "API_ERROR", message: error.error };
    }
    return { code: `HTTP_${status}`, message: `HTTP ${status}` };
  }

  private getRetryAfter(headers: Headers): number | undefined {
    const retryAfter = headers.get("Retry-After");
    if (!retryAfter) return undefined;

    // Retry-After can be seconds (number) or HTTP-date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return undefined;
  }

  async fetch<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const token = this.config.getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 429 (rate limited) and 503 (service unavailable)
    if (response.status === 429 || response.status === 503) {
      const retryAfterMs = this.getRetryAfter(response.headers);
      const errorBody = await response.json().catch(() => ({}));
      const { message } = this.parseError(response.status, errorBody);
      throw new ApiError(response.status, "RATE_LIMITED", message, retryAfterMs);
    }

    // Handle 401 (unauthorized)
    if (response.status === 401) {
      // Call onUnauthorized to trigger logout/redirect
      if (this.config.onUnauthorized && !this.refreshing) {
        this.refreshing = true;
        this.refreshPromise = this.config.onUnauthorized().finally(() => {
          this.refreshing = false;
          this.refreshPromise = null;
        });
      }

      // Wait for any in-flight unauthorized handling
      if (this.refreshPromise) {
        await this.refreshPromise;
      }

      const errorBody = await response.json().catch(() => ({}));
      const { message } = this.parseError(response.status, errorBody);
      throw new ApiError(response.status, "UNAUTHORIZED", message);
    }

    // Handle other errors
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const { code, message } = this.parseError(response.status, errorBody);
      throw new ApiError(response.status, code, message);
    }

    // Success
    return (await response.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.fetch<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.fetch<T>("POST", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.fetch<T>("PATCH", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.fetch<T>("DELETE", path);
  }

  // Helper to load token from storage
  static loadTokenFromStorage(storageKey = "authToken"): string | null {
    try {
      return sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  // Helper to save token to storage
  static saveTokenToStorage(token: string, storageKey = "authToken"): void {
    try {
      sessionStorage.setItem(storageKey, token);
    } catch {
      // Storage quota exceeded or in private mode
    }
  }

  // Helper to clear token from storage
  static clearTokenFromStorage(storageKey = "authToken"): void {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore errors
    }
  }
}

// Tests: UA1-UA4
