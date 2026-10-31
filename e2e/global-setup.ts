import type { FullConfig } from "@playwright/test";

export default async function checkApi(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("E2E frontend baseURL is required");
  const url = new URL("/api/v1/auth/login", baseURL);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`E2E API unavailable through ${url.pathname}. Start the API and check the Vite proxy; Docker infrastructure alone does not start the API.`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 400 || !type.includes("json")) {
    throw new Error(`E2E API readiness failed: POST ${url.pathname} returned ${response.status} (${type}). Start the API and check the Vite proxy and route prefix.`);
  }
}
