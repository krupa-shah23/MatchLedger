/**
 * Page-level role configuration (WEEK-11.md 4.8). `visible` decides what the
 * UI shows for a role; `writable` is always a subset of `visible`. Neither
 * set enforces anything — ENDPOINT_ROLES and the server are what actually
 * refuse a request; this table only decides what a client renders.
 */

export type Role = "TRADER" | "RISK" | "OPS" | "ADMIN";

export interface PageRoleEntry {
  visible: Role[];
  writable: Role[];
}

export const PAGE_ROLES: Record<string, PageRoleEntry> = {
  "/login": { visible: [], writable: [] },
  "/trade": { visible: ["TRADER", "ADMIN"], writable: ["TRADER"] },
  "/portfolio": { visible: ["TRADER", "RISK", "OPS", "ADMIN"], writable: [] },
  "/orders": { visible: ["TRADER", "RISK", "OPS", "ADMIN"], writable: [] },
  "/risk": { visible: ["RISK", "ADMIN"], writable: ["RISK"] },
  "/ops/recon": { visible: ["OPS", "ADMIN"], writable: ["OPS"] },
  "/system": { visible: ["ADMIN"], writable: ["ADMIN"] },
};

export function canAccessPage(page: string, userRole: Role | null): boolean {
  const entry = PAGE_ROLES[page];
  if (!entry) return false;

  if (entry.visible.length === 0) {
    return page === "/login"; // the only zero-role entry is the public login page
  }

  return userRole !== null && entry.visible.includes(userRole);
}

export function canWritePage(page: string, userRole: Role | null): boolean {
  const entry = PAGE_ROLES[page];
  if (!entry) return false;
  return userRole !== null && entry.writable.includes(userRole);
}

/**
 * Every mutating endpoint a page's write controls ultimately call. Used to
 * cross-check PAGE_ROLES.writable against ENDPOINT_ROLES: a role the UI
 * lets write a page must also be allowed by every endpoint that page's
 * write controls call, or the two tables have drifted apart.
 */
export const PAGE_WRITE_ENDPOINTS: Record<string, string[]> = {
  "/trade": ["POST /orders", "DELETE /orders/{id}"],
  "/risk": ["POST /risk/symbols/{symbol}/halt", "POST /risk/symbols/{symbol}/resume"],
  "/ops/recon": ["POST /recon/runs", "POST /recon/breaks/{id}/status", "POST /recon/breaks/{id}/resolve"],
  "/system": ["POST /system/verify-replay", "POST /system/simulator/start", "POST /system/simulator/stop"],
};

/**
 * Returns every (page, role) pair where PAGE_ROLES says a role can write a
 * page, but at least one of that page's endpoints (per PAGE_WRITE_ENDPOINTS)
 * doesn't allow that role in endpointRoles. Empty means the two tables agree.
 */
export function findPageRoleDrift(endpointRoles: Record<string, ReadonlySet<Role>>): Array<{ page: string; role: Role; endpoint: string }> {
  const drift: Array<{ page: string; role: Role; endpoint: string }> = [];
  for (const [page, entry] of Object.entries(PAGE_ROLES)) {
    const endpoints = PAGE_WRITE_ENDPOINTS[page] ?? [];
    for (const role of entry.writable) {
      for (const endpoint of endpoints) {
        const allowed = endpointRoles[endpoint];
        if (!allowed || !allowed.has(role)) {
          drift.push({ page, role, endpoint });
        }
      }
    }
  }
  return drift;
}
