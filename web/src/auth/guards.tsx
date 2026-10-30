import React from "react";
import { Navigate, useLocation } from "react-router";
import { canAccessPage, canWritePage, type Role } from "@matchledger/common";
import { useAuth } from "./AuthProvider.js";

/**
 * Hides a page the way the server would refuse it. This is UI convenience
 * only — the API's own role check (ENDPOINT_ROLES) is what actually
 * protects every write, guard or no guard (section 9, 13).
 */
export function RequireRole({ page, children }: { page: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!canAccessPage(page, user.role)) {
    return <NotAvailable role={user.role} />;
  }

  return <>{children}</>;
}

export function useCanWrite(page: string): boolean {
  const { user } = useAuth();
  return canWritePage(page, user?.role ?? null);
}

export function NotAvailable({ role }: { role: Role }) {
  return (
    <div style={{ padding: 40 }}>
      <h1>Not available for your role</h1>
      <p>Your role ({role}) does not have access to this page.</p>
    </div>
  );
}
