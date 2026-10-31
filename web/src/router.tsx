/**
 * Route table and nav. PAGE_ROLES only decides what's shown here; the
 * server's ENDPOINT_ROLES is what actually refuses a write either way.
 */
import React from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { PAGE_ROLES } from "@matchledger/common";
import { useAuth } from "./auth/AuthProvider.js";
import { RequireRole, NotAvailable } from "./auth/guards.js";
import { LoginPage } from "./pages/Login.js";
import { SignUpPage } from "./pages/SignUp.js";
import { TradingPage } from "./pages/Trading.js";
import { PortfolioPage } from "./pages/Portfolio.js";
import { OrderDetailPage } from "./pages/OrderDetail.js";
import { RiskPage } from "./pages/Risk.js";
import { ReconPage } from "./pages/Recon.js";
import { SystemPage } from "./pages/System.js";
import { LandingPage } from "./pages/Landing.js";
import { Brand, Icon, type IconName } from "./components/Ui.js";

const LANDING_PAGE: Record<string, string> = {
  TRADER: "/trade",
  RISK: "/risk",
  OPS: "/ops/recon",
  ADMIN: "/system",
};

const WORKSPACE_LINKS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/trade", label: "Trading", icon: "trade" },
  { to: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { to: "/risk", label: "Risk", icon: "risk" },
  { to: "/ops/recon", label: "Recon", icon: "recon" },
  { to: "/system", label: "System", icon: "system" },
];

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <aside className="sidebar">
      <a className="brand-link" href={LANDING_PAGE[user.role]} aria-label="MatchLedger home"><Brand /></a>
      <p className="nav-label">WORKSPACE</p>
      <nav className="workspace-nav" aria-label="Main navigation">
        {WORKSPACE_LINKS.filter(link => PAGE_ROLES[link.to]?.visible.includes(user.role)).map(link => (
          <NavLink key={link.to} to={link.to} aria-label={link.label} title={link.label} className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <Icon name={link.icon} /><span>{link.label}</span><span className="nav-active-dot" />
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-card"><span className="user-avatar">{user.username.slice(0, 2).toUpperCase()}</span><div><strong>{user.username}</strong><span>{user.role.toLowerCase()} workspace</span></div></div>
        <button className="logout-button" onClick={() => { logout(); navigate("/login"); }}><Icon name="logout" />Logout</button>
      </div>
    </aside>
  );
}

export function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const activeLabel = WORKSPACE_LINKS.find(link => location.pathname.startsWith(link.to))?.label ?? "Order detail";
  const demoMode = import.meta.env.VITE_PROFILE === "demo";

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage demoMode={demoMode} />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Nav />
      <div className="app-workspace">
        <header className="topbar"><span className="breadcrumb">Workspace <span>/</span> <strong>{activeLabel}</strong></span><div className="topbar-meta">{demoMode && <span className="badge badge-neutral">Demo environment</span>}<span className="role-label"><Icon name="lock" />{user.role}</span></div></header>
        <main id="main-content" className="page-stage" key={location.pathname}>
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
        </main>
      </div>
    </div>
  );
}
