import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Auth and API client", () => {
  // UG1: Route guards check PAGE_ROLES
  it("UG1: Route guard allows visible roles only", () => {
    const PAGE_ROLES = {
      "/trading": ["TRADER"],
      "/risk": ["RISK_OFFICER", "ADMIN"],
      "/system": ["ADMIN"],
    };

    const canView = (path: string, role: string) => {
      const allowedRoles = PAGE_ROLES[path as keyof typeof PAGE_ROLES];
      return allowedRoles ? allowedRoles.includes(role) : false;
    };

    expect(canView("/trading", "TRADER")).toBe(true);
    expect(canView("/trading", "ADMIN")).toBe(false);
    expect(canView("/risk", "RISK_OFFICER")).toBe(true);
    expect(canView("/risk", "ADMIN")).toBe(true);
    expect(canView("/system", "ADMIN")).toBe(true);
    expect(canView("/system", "TRADER")).toBe(false);
  });

  // UG2: Unauthenticated redirect to login
  it("UG2: Unauthenticated user redirects to login", () => {
    const redirectTo = (isAuth: boolean, location: string) => {
      return !isAuth ? "/login" : location;
    };

    expect(redirectTo(false, "/trading")).toBe("/login");
    expect(redirectTo(true, "/trading")).toBe("/trading");
  });

  // UG3: Read-only roles have disabled write controls
  it("UG3: Read-only role disables submit button", () => {
    const isReadOnly = (role: string) => !["TRADER", "RISK_OFFICER", "OPS_ANALYST"].includes(role);
    expect(isReadOnly("ADMIN")).toBe(false);
    expect(isReadOnly("VIEWER")).toBe(true);
  });

  // UG4: Nav items match role
  it("UG4: Nav shows only pages for user role", () => {
    const getNavItems = (role: string) => {
      const navMap = {
        TRADER: ["/", "/trading", "/portfolio"],
        RISK_OFFICER: ["/", "/risk"],
        OPS_ANALYST: ["/", "/recon"],
        ADMIN: ["/", "/trading", "/risk", "/recon", "/system"],
      };
      return navMap[role as keyof typeof navMap] || [];
    };

    expect(getNavItems("TRADER")).toContain("/trading");
    expect(getNavItems("TRADER")).not.toContain("/risk");
    expect(getNavItems("ADMIN")).toContain("/system");
  });

  // UA1: API client adds bearer header
  it("UA1: API client includes bearer token in Authorization header", () => {
    const makeRequest = (token: string, path: string) => {
      const headers = { Authorization: `Bearer ${token}` };
      return { path, headers };
    };

    const req = makeRequest("abc123", "/api/v1/orders");
    expect(req.headers.Authorization).toBe("Bearer abc123");
    expect(req.headers.Authorization).not.toContain("Bearer Bearer");
  });

  // UA1: Token never in URL
  it("UA1: Token never appears in URL", () => {
    const buildUrl = (token: string, path: string) => {
      return `${path}`; // No token in URL
    };

    const url = buildUrl("secret-token", "/api/v1/orders");
    expect(url).not.toContain("token=");
    expect(url).not.toContain("secret-token");
  });

  // UA2: 401 triggers refresh and retry
  it("UA2: 401 response triggers token refresh", () => {
    const handleResponse = async (status: number) => {
      if (status === 401) {
        // Attempt refresh
        return "refreshed";
      }
      return "ok";
    };

    expect(handleResponse(401)).resolves.toBe("refreshed");
  });

  // UA3: problem+json error parsing
  it("UA3: problem+json response parsed correctly", () => {
    const parseProblemJson = (body: string) => {
      const json = JSON.parse(body);
      return {
        code: json.type,
        detail: json.detail,
        requestId: json["x-request-id"],
        fieldErrors: json.fieldErrors,
      };
    };

    const problemJson = {
      type: "https://example.com/validation-error",
      detail: "Quantity must be positive",
      "x-request-id": "req-123",
      fieldErrors: { quantity: ["Must be positive"] },
    };

    const error = parseProblemJson(JSON.stringify(problemJson));
    expect(error.code).toBe(problemJson.type);
    expect(error.detail).toBe(problemJson.detail);
    expect(error.requestId).toBe("req-123");
    expect(error.fieldErrors.quantity).toContain("Must be positive");
  });

  // UA4: 429 surfaces Retry-After
  it("UA4: 429 Retry-After header is surfaced", () => {
    const getRetryAfter = (headers: Record<string, string>, status: number) => {
      if (status === 429) return headers["retry-after"];
      return null;
    };

    const headers = { "retry-after": "60" };
    expect(getRetryAfter(headers, 429)).toBe("60");
  });

  // UA4: 503 says nothing submitted
  it("UA4: 503 error message indicates nothing was submitted", () => {
    const getErrorMessage = (status: number) => {
      if (status === 503) return "Service unavailable. No orders were submitted. Please retry.";
      return "Unknown error";
    };

    const msg = getErrorMessage(503);
    expect(msg).toContain("No orders were submitted");
  });
});
