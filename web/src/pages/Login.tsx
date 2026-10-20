/**
 * Login page with demo role buttons (shown only when server says demo mode).
 * Test: UP1
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiClient } from "../api/client.js";

interface LoginPageProps {
  apiBaseUrl: string;
  demoMode: boolean;
  onLoginSuccess: (token: string, user: any) => void;
}

export function LoginPage({ apiBaseUrl, demoMode, onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getToken: () => null,
  });

  async function handleLogin(user: string, pass: string) {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.post<any>("/auth/login", {
        username: user,
        password: pass,
      });
      onLoginSuccess(response.token, response.user);
      navigate(getLandingPageForRole(response.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDemoLogin(role: string) {
    // Demo login with hardcoded credentials
    await handleLogin(`demo-${role.toLowerCase()}`, "demo-password");
  }

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
      <h1>MatchLedger</h1>

      {!demoMode ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin(username, password);
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
        </>
      ) : (
        <>
          <p style={{ marginBottom: 20 }}>Demo Mode: Select a role to login</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["TRADER", "RISK", "OPS", "ADMIN"].map((role) => (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  fontSize: 16,
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                Login as {role}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p style={{ color: "red", marginTop: 20 }}>{error}</p>}
    </div>
  );
}

function getLandingPageForRole(role: string): string {
  switch (role) {
    case "TRADER":
      return "/trading";
    case "RISK":
      return "/risk";
    case "OPS":
      return "/system";
    case "ADMIN":
      return "/admin";
    default:
      return "/dashboard";
  }
}

// Test: UP1
