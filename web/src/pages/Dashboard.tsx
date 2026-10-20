/**
 * Role-based dashboard landing page.
 * Routes to appropriate page based on user role.
 */

import React from "react";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  userRole: string;
}

export function Dashboard({ userRole }: DashboardProps) {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Redirect to role-specific page
    const routes: Record<string, string> = {
      TRADER: "/portfolio",
      RISK: "/risk",
      OPS: "/system",
      ADMIN: "/admin",
    };
    const path = routes[userRole] || "/portfolio";
    navigate(path, { replace: true });
  }, [userRole, navigate]);

  return <div>Redirecting...</div>;
}

// Stub pages for each role
export function TradingPage() {
  return <div style={{ padding: 20 }}>Trading Page (P2)</div>;
}

export function RiskPage() {
  return <div style={{ padding: 20 }}>Risk Page</div>;
}

export function SystemPage() {
  return <div style={{ padding: 20 }}>System Page</div>;
}

export function AdminPage() {
  return <div style={{ padding: 20 }}>Admin Page</div>;
}

export function NotAvailablePage() {
  return <div style={{ padding: 20, color: "red" }}>You do not have access to this page.</div>;
}
