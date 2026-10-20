export type ApiRole = "TRADER" | "RISK" | "OPS" | "ADMIN";

export const ENDPOINT_ROLES: Record<string, Set<ApiRole>> = {
  // Auth
  "POST /auth/login": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "POST /auth/refresh": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /me": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),

  // Orders
  "POST /orders": new Set(["TRADER"]),
  "DELETE /orders/{id}": new Set(["TRADER"]),
  "GET /orders/{id}": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /orders/{id}/events": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /orders": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),

  // Market data
  "GET /instruments": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /instruments/{symbol}": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /symbols/{symbol}/book": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /trades": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /status": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),

  // Accounts
  "GET /accounts/{id}/balances": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /accounts/{id}/positions": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /accounts/{id}/pnl": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /accounts/{id}/reservations": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),
  "GET /accounts/{id}/ledger": new Set(["TRADER", "RISK", "OPS", "ADMIN"]),

  // Risk
  "GET /risk/rejections": new Set(["RISK", "ADMIN"]),
  "GET /risk/breakers": new Set(["RISK", "ADMIN"]),
  "POST /risk/symbols/{symbol}/halt": new Set(["RISK"]),
  "POST /risk/symbols/{symbol}/resume": new Set(["RISK"]),

  // Recon
  "POST /recon/runs": new Set(["OPS"]),
  "GET /recon/runs": new Set(["OPS", "ADMIN"]),
  "GET /recon/runs/{id}": new Set(["OPS", "ADMIN"]),
  "GET /recon/breaks": new Set(["OPS", "ADMIN"]),
  "GET /recon/breaks/{id}": new Set(["OPS", "ADMIN"]),
  "GET /recon/breaks/{id}/audit": new Set(["OPS", "ADMIN"]),
  "POST /recon/breaks/{id}/status": new Set(["OPS"]),
  "POST /recon/breaks/{id}/resolve": new Set(["OPS"]),

  // Admin
  "GET /admin/users": new Set(["ADMIN"]),
  "POST /admin/users": new Set(["ADMIN"]),
  "GET /admin/accounts": new Set(["ADMIN"]),
  "POST /admin/accounts": new Set(["ADMIN"]),
  "POST /admin/accounts/{id}/deposit": new Set(["ADMIN"]),
  "POST /admin/demo/reset": new Set(["ADMIN"]),
  "POST /admin/demo/chaos/kill/{symbol}": new Set(["ADMIN"]),
  "POST /admin/demo/chaos/freeze/{symbol}": new Set(["ADMIN"]),

  // System
  "GET /system/invariants": new Set(["ADMIN"]),
  "GET /system/health": new Set(["ADMIN"]),
  "GET /system/shards": new Set(["ADMIN"]),
  "GET /system/recovery": new Set(["ADMIN"]),
  "GET /system/metrics/summary": new Set(["ADMIN"]),
  "POST /system/verify-replay": new Set(["ADMIN"]),
  "GET /system/simulator": new Set(["ADMIN"]),
  "POST /system/simulator/start": new Set(["ADMIN"]),
  "POST /system/simulator/stop": new Set(["ADMIN"]),
};
