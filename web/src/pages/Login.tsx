/**
 * P1 Login. Demo role buttons call the same /auth/login endpoint with the
 * seeded demo credentials (scripts/seed-demo.mjs) — RBAC is real, not a
 * client-side shortcut. Test: UP1.
 */
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";

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
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
      <h1>MatchLedger</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          doLogin(username, "", password);
        }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          style={{ display: "block", width: "100%", marginBottom: 10, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          style={{ display: "block", width: "100%", marginBottom: 10, padding: 8 }}
        />
        <button type="submit" disabled={isLoading} style={{ width: "100%", padding: 8 }}>
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>

      {demoMode && (
        <>
          <p style={{ margin: "20px 0 10px" }}>Demo Mode: Select a role to login</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DEMO_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => doLogin(`demo-${role.toLowerCase()}`, role, "demo-password")}
                disabled={isLoading}
                style={{ padding: "10px 20px", fontSize: 16, cursor: isLoading ? "not-allowed" : "pointer" }}
              >
                Login as {role === "TRADER" ? "Trader" : role === "RISK" ? "Risk Officer" : role === "OPS" ? "Ops" : "Admin"}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p style={{ color: "red", marginTop: 20 }}>{error}</p>}
    </div>
  );
}
