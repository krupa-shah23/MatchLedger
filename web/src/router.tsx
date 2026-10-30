/**
 * Route table and nav. PAGE_ROLES only decides what's shown here; the
 * server's ENDPOINT_ROLES is what actually refuses a write either way.
 */
import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { PAGE_ROLES } from "@matchledger/common";
import { useAuth } from "./auth/AuthProvider.js";
import { RequireRole, NotAvailable } from "./auth/guards.js";
import { LoginPage } from "./pages/Login.js";
import { TradingPage } from "./pages/Trading.js";
import { PortfolioPage } from "./pages/Portfolio.js";
import { OrderDetailPage } from "./pages/OrderDetail.js";
import { RiskPage } from "./pages/Risk.js";
import { ReconPage } from "./pages/Recon.js";
import { SystemPage } from "./pages/System.js";

const LANDING_PAGE: Record<string, string> = {
  TRADER: "/trade",
  RISK: "/risk",
  OPS: "/ops/recon",
  ADMIN: "/system",
};

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const links: Array<{ to: string; label: string }> = [
    { to: "/trade", label: "Trading" },
    { to: "/portfolio", label: "Portfolio" },
    { to: "/risk", label: "Risk" },
    { to: "/ops/recon", label: "Recon" },
    { to: "/system", label: "System" },
  ];

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", padding: 10, borderBottom: "1px solid #ddd" }}>
      <div style={{ display: "flex", gap: 15 }}>
        <strong>MatchLedger</strong>
        {links
          .filter((l) => PAGE_ROLES[l.to]?.visible.includes(user.role))
          .map((l) => (
            <a key={l.to} href={l.to} onClick={(e) => { e.preventDefault(); navigate(l.to); }}>
              {l.label}
            </a>
          ))}
      </div>
      <div>
        <span style={{ marginRight: 10 }}>
          {user.username} ({user.role})
        </span>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export function AppRoutes() {
  const { user } = useAuth();
  const demoMode = import.meta.env.VITE_PROFILE === "demo";

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage demoMode={demoMode} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to={LANDING_PAGE[user.role] ?? "/trade"} replace />} />
        <Route path="/login" element={<Navigate to={LANDING_PAGE[user.role] ?? "/trade"} replace />} />
        <Route
          path="/trade"
          element={
            <RequireRole page="/trade">
              <TradingPage />
            </RequireRole>
          }
        />
        <Route
          path="/portfolio"
          element={
            <RequireRole page="/portfolio">
              <PortfolioPage />
            </RequireRole>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <RequireRole page="/orders">
              <OrderDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/risk"
          element={
            <RequireRole page="/risk">
              <RiskPage />
            </RequireRole>
          }
        />
        <Route
          path="/ops/recon"
          element={
            <RequireRole page="/ops/recon">
              <ReconPage />
            </RequireRole>
          }
        />
        <Route
          path="/system"
          element={
            <RequireRole page="/system">
              <SystemPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotAvailable role={user.role} />} />
      </Routes>
    </>
  );
}
