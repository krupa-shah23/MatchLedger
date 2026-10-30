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
