/**
 * P1 Login. Demo role buttons call the same /auth/login endpoint with the
 * seeded demo credentials (scripts/seed-demo.mjs) — RBAC is real, not a
 * client-side shortcut. Test: UP1.
 */
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import { Brand, Icon, type IconName } from "../components/Ui.js";
import { useToast } from "../components/Toast.js";

const DEMO_ROLES = ["TRADER", "RISK", "OPS", "ADMIN"] as const;

const LANDING_PAGE: Record<string, string> = {
  TRADER: "/trade",
  RISK: "/risk",
  OPS: "/ops/recon",
  ADMIN: "/system",
};

export function LoginPage({ demoMode }: { demoMode: boolean }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function doLogin(user: string, role: string, pass: string) {
    try {
      setIsLoading(true);
      setError(null);
      await login(user, pass);
      navigate(location.state?.from ?? LANDING_PAGE[role] ?? "/trade");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      showToast("We couldn't log you in. Check your username and password and try again.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const roleDetails: Record<string, { label: string; detail: string; icon: IconName }> = {
    TRADER: { label: "Trader", detail: "Orders & portfolio", icon: "trade" },
    RISK: { label: "Risk Officer", detail: "Limits & breakers", icon: "risk" },
    OPS: { label: "Ops", detail: "Reconciliation", icon: "recon" },
    ADMIN: { label: "Admin", detail: "System & recovery", icon: "system" },
  };

  return (
    <div className="auth-layout">
      <section className="auth-story" aria-label="About MatchLedger">
        <Brand />
        <div className="auth-story-content">
          <p className="eyebrow">A CLEARER VIEW OF THE TRADE</p>
          <h2>Every order.<br /><span>Accounted for.</span></h2>
          <p className="auth-story-description">From a live order book to the final ledger. One workspace for trading, risk, and reconciliation.</p>
          <div className="ledger-art" aria-hidden="true"><div className="ledger-orbit orbit-one" /><div className="ledger-orbit orbit-two" /><div className="ledger-orbit orbit-three" /><div className="ledger-art-center"><Icon name="layers" /></div><div className="ledger-orbit-track"><span className="ledger-node node-one"><Icon name="trade" /></span><span className="ledger-node node-two"><Icon name="check" /></span><span className="ledger-node node-three"><Icon name="recon" /></span></div></div>
          <div className="auth-capabilities"><span><Icon name="trade" />Live order flow</span><span><Icon name="risk" />Risk controls</span><span><Icon name="recon" />Audit trail</span></div>
        </div>
        <p className="auth-story-footer">Precision at every step.</p>
      </section>
      <main className="auth-main">
        <div className="auth-form-container">
          <div className="auth-form-heading"><span className="auth-icon"><Icon name="lock" /></span><p className="eyebrow">YOUR WORKSPACE</p><h1>Welcome back.</h1><p>Log in to see the complete picture.</p></div>
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); doLogin(username, "", password); }}>
            <div className="field"><label htmlFor="username">Username</label><input id="username" type="text" autoComplete="username" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} disabled={isLoading} required /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} required /></div>
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <button className="primary-button full-width" type="submit" disabled={isLoading}>{isLoading ? <><span className="spinner" aria-hidden="true" />Logging in...</> : <>Login<Icon name="arrow" /></>}</button>
          </form>
          {demoMode && <section id="demo-access" className="demo-access" aria-label="Demo access"><div className="section-divider"><span>OR EXPLORE THE DEMO</span></div><div className="demo-role-grid">{DEMO_ROLES.map(role => <button className="demo-role" key={role} onClick={() => doLogin(`demo-${role.toLowerCase()}`, role, "demo-password")} disabled={isLoading}><Icon name={roleDetails[role]!.icon} /><span><strong>Login as {roleDetails[role]!.label}</strong><small>{roleDetails[role]!.detail}</small></span><Icon name="arrow" className="demo-arrow" /></button>)}</div><p className="demo-note">Simulated markets. Explore each role with a seeded account.</p></section>}
          <p className="auth-help">Need an account? <a href="/signup">About access <span aria-hidden="true">↗</span></a></p>
        </div>
        <p className="auth-footer">MatchLedger <span>Trading · Risk · Reconciliation</span></p>
      </main>
    </div>
  );
}
