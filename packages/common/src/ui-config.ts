/**
 * Page-level role configuration derived from ENDPOINT_ROLES.
 * Maps routes to the roles that can access them.
 */

type Role = "TRADER" | "RISK" | "OPS" | "ADMIN";

export const PAGE_ROLES: Record<string, Role[]> = {
  // Public pages (no auth required)
  "/login": [],
  "/register": [],

  // Authenticated pages
  "/": ["TRADER", "RISK", "OPS", "ADMIN"],
  "/dashboard": ["TRADER", "RISK", "OPS", "ADMIN"],

  // Order management (TRADER primary, but RISK/OPS/ADMIN can view all)
  "/orders": ["TRADER", "RISK", "OPS", "ADMIN"],
  "/orders/:id": ["TRADER", "RISK", "OPS", "ADMIN"],

  // Risk pages (RISK and ADMIN only)
  "/risk": ["RISK", "ADMIN"],
  "/risk/positions": ["RISK", "ADMIN"],
  "/risk/limits": ["RISK", "ADMIN"],

  // Operations pages (OPS and ADMIN only)
  "/system": ["OPS", "ADMIN"],
  "/system/health": ["OPS", "ADMIN"],

  // Admin pages (ADMIN only)
  "/admin": ["ADMIN"],
  "/admin/users": ["ADMIN"],
  "/admin/config": ["ADMIN"],

  // Fallback for unauthorized access
  "/not-available": ["TRADER", "RISK", "OPS", "ADMIN"],
};

export function canAccessPage(page: string, userRole: Role | null): boolean {
  if (!userRole) {
    // Only public pages accessible without auth
    return page === "/login" || page === "/register";
  }

  const requiredRoles = PAGE_ROLES[page];
  if (!requiredRoles) {
    return false; // Page not found
  }

  if (requiredRoles.length === 0) {
    // Public page
    return true;
  }

  return requiredRoles.includes(userRole);
}
