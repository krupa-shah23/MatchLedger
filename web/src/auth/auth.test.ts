import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccessPage, canWritePage, PAGE_ROLES } from "@matchledger/common";
import { ApiClient, ApiError } from "../api/client.js";

describe("UG: route guards (real PAGE_ROLES)", () => {
  it("UG1: visible-to set from PAGE_ROLES decides access per role", () => {
    expect(canAccessPage("/trade", "TRADER")).toBe(true);
    expect(canAccessPage("/trade", "OPS")).toBe(false);
    expect(canAccessPage("/risk", "RISK")).toBe(true);
    expect(canAccessPage("/risk", "ADMIN")).toBe(true);
    expect(canAccessPage("/system", "ADMIN")).toBe(true);
    expect(canAccessPage("/system", "TRADER")).toBe(false);
  });

  it("UG2: unauthenticated (null role) is not granted any protected page", () => {
    expect(canAccessPage("/portfolio", null)).toBe(false);
    expect(canAccessPage("/login", null)).toBe(true);
  });

  it("UG3: writable is always a subset of visible, and ADMIN is read-only on P2", () => {
    for (const entry of Object.values(PAGE_ROLES)) {
      for (const role of entry.writable) {
        expect(entry.visible).toContain(role);
      }
    }
    expect(canWritePage("/trade", "ADMIN")).toBe(false);
    expect(canWritePage("/trade", "TRADER")).toBe(true);
  });

  it("UG4: nav visibility matches PAGE_ROLES for each role", () => {
    const pagesVisibleTo = (role: "TRADER" | "RISK" | "OPS" | "ADMIN") =>
      Object.entries(PAGE_ROLES)
        .filter(([, entry]) => entry.visible.includes(role))
        .map(([page]) => page);

    expect(pagesVisibleTo("TRADER")).toContain("/trade");
    expect(pagesVisibleTo("TRADER")).not.toContain("/risk");
    expect(pagesVisibleTo("ADMIN")).toContain("/system");
  });
});

describe("UA: API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("UA1: adds the bearer header and never puts the token in the URL", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), headers: init.headers as Record<string, string> });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    const client = new ApiClient({ baseUrl: "/api/v1", getToken: () => "secret-token" });
    await client.get("/orders");

    expect(calls[0]!.url).not.toContain("secret-token");
    expect(calls[0]!.headers.Authorization).toBe("Bearer secret-token");
  });

  it("UA2: a 401 triggers exactly one refresh, then retries once", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return new Response(JSON.stringify({ code: "unauthenticated" }), { status: 401 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    const onUnauthorized = vi.fn(async () => {});
    const client = new ApiClient({ baseUrl: "/api/v1", getToken: () => "t", onUnauthorized });
    const result = await client.get<{ ok: boolean }>("/orders");

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(call).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("UA2: a second consecutive 401 after refresh logs out (throws, no infinite retry)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "unauthenticated" }), { status: 401 }))
    );

    const onUnauthorized = vi.fn(async () => {});
    const client = new ApiClient({ baseUrl: "/api/v1", getToken: () => "t", onUnauthorized });

    await expect(client.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("UA3: problem+json is parsed into code, detail, requestId, and field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            type: "about:blank#validation_failed",
            title: "Validation error",
            status: 400,
            code: "validation_failed",
            detail: "Quantity must be positive",
            instance: "/orders",
            requestId: "req-123",
            errors: [{ path: "quantity", message: "Must be positive" }],
          }),
          { status: 400 }
        )
      )
    );

    const client = new ApiClient({ baseUrl: "/api/v1", getToken: () => null });
    try {
      await client.post("/orders", {});
      throw new Error("expected ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.code).toBe("validation_failed");
      expect(apiError.message).toBe("Quantity must be positive");
      expect(apiError.requestId).toBe("req-123");
      expect(apiError.fieldErrors).toEqual([{ path: "quantity", message: "Must be positive" }]);
    }
  });

  it("UA4: 429 surfaces Retry-After in milliseconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "rate_limited", detail: "too many" }), {
          status: 429,
          headers: { "Retry-After": "2" },
        })
      )
    );

    const client = new ApiClient({ baseUrl: "/api/v1", getToken: () => null });
    try {
      await client.post("/orders", {});
      throw new Error("expected ApiError");
    } catch (err) {
      expect((err as ApiError).retryAfterMs).toBe(2000);
    }
  });

  it("UA4: 503 is surfaced as an ApiError distinct from 429, with no retry attempted", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(JSON.stringify({ code: "unavailable", detail: "nothing was submitted" }), { status: 503 });
      })
    );

    const client = new ApiClient({ baseUrl: "/api/v1", getToken: () => null });
    await expect(client.post("/orders", {})).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });
});
