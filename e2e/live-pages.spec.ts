import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(`demo-${role}`);
  await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD ?? "demo-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
  const paths: Record<string, string> = { trader: "/trade", risk: "/risk", ops: "/ops/recon", admin: "/system" };
  await expect(page).toHaveURL(new RegExp(paths[role] + "$"));
}
async function headers(page: Page) {
  return { Authorization: `Bearer ${await page.evaluate(() => sessionStorage.getItem("authToken"))}` };
}

test("LIVE-P3/P4: Portfolio displays API decimal values and a real order has a journal timeline", async ({ page }) => {
  await login(page, "trader");
  const account = await page.request.get("/api/v1/me", { headers: await headers(page) });
  const me = await account.json();
  const balances = await page.request.get(`/api/v1/accounts/${me.accountIds[0]}/balances`, { headers: await headers(page) });
  expect(balances.status()).toBe(200);
  const money = await balances.json();
  await page.goto("/portfolio");
  await expect(page.getByText(`₹${money.cash}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Invalid", { exact: true })).toHaveCount(0);
  const positions = await page.request.get(`/api/v1/accounts/${me.accountIds[0]}/positions`, { headers: await headers(page) });
  expect(positions.status()).toBe(200);
  expect((await positions.json()).length).toBeGreaterThan(0);
  const instruments = await page.request.get("/api/v1/instruments", { headers: await headers(page) });
  const [{ symbol }] = await instruments.json();
  const submitted = await page.request.post("/api/v1/orders", {
    headers: await headers(page),
    data: { clientOrderId: `live-timeline-${Date.now()}`, symbol, side: "BUY", type: "LIMIT", timeInForce: "GTC", quantity: "1", price: "0.01" },
  });
  expect(submitted.status()).toBe(202);
  const { orderId: id } = await submitted.json();
  await expect.poll(async () => {
    const timeline = await page.request.get(`/api/v1/orders/${id}/events`, { headers: await headers(page) });
    if (!timeline.ok()) return 0;
    return (await timeline.json()).length;
  }).toBeGreaterThan(0);
  page.on("response", response => {
    if (response.status() >= 400 && response.url().includes("/api/v1/orders/")) {
      console.log(`Order detail request returned ${response.status()} for ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto(`/orders/${id}`);
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByText("Invalid Date", { exact: false })).toHaveCount(0);
});

test("LIVE-P2: trader can cancel an open order from the trading page", async ({ page }) => {
  await login(page, "trader");
  const authHeaders = await headers(page);
  const instruments = await page.request.get("/api/v1/instruments", { headers: authHeaders });
  expect(instruments.status()).toBe(200);
  const [{ symbol }] = await instruments.json();
  const submitted = await page.request.post("/api/v1/orders", {
    headers: authHeaders,
    data: { clientOrderId: `live-cancel-${Date.now()}`, symbol, side: "BUY", type: "LIMIT", timeInForce: "GTC", quantity: "1", price: "0.01" },
  });
  expect(submitted.status()).toBe(202);
  const { orderId } = await submitted.json();

  await page.goto("/trade");
  const orderRow = page.getByRole("row").filter({ has: page.locator(`a[href="/orders/${encodeURIComponent(orderId)}"]`) });
  await expect(orderRow).toBeVisible();
  const cancelled = page.waitForResponse(response => response.request().method() === "DELETE" && response.url().endsWith(`/api/v1/orders/${encodeURIComponent(orderId)}`));
  await orderRow.getByRole("button", { name: "Cancel" }).click();
  expect((await cancelled).status()).toBe(202);
  await expect(orderRow.getByText(/cancel/i)).toBeVisible();
});

for (const [role, path, endpoint, loading] of [
  ["trader", "/portfolio", "accounts/**", "Loading portfolio..."],
  ["risk", "/risk", "risk/**", "Loading risk data..."],
  ["ops", "/ops/recon", "recon/**", "Loading reconciliation data..."],
  ["admin", "/system", "system/**", "Loading system data..."],
] as const) {
  test(`LIVE-STATES ${path}: delayed real response shows loading and network outage shows an error`, async ({ page }) => {
    await login(page, role);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const pattern = `**/api/v1/${endpoint}`;
    await page.route(pattern, async route => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    await page.goto(path);
    try { await expect(page.getByText(loading, { exact: true })).toBeVisible(); }
    finally { release(); }
    await expect(page.getByText(loading, { exact: true })).toHaveCount(0);
    await page.unroute(pattern);
    await page.route(pattern, route => route.abort("failed"));
    await page.goto(path);
    await expect(page.getByRole("alert")).toBeVisible();
    await page.unroute(pattern);
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
}

test("LIVE-P6: real reconciliation breaks endpoint returns data rather than an internal error", async ({ page }) => {
  await login(page, "ops");
  const response = await page.request.get("/api/v1/recon/breaks", { headers: await headers(page) });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.breaks)).toBe(true);
  await expect(page.getByRole("heading", { name: "Reconciliation", exact: true })).toBeVisible();
});

test("LIVE-P6: operator resolves a real reconciliation break and the audit row appears", async ({ page }) => {
  await login(page, "ops");
  const authHeaders = await headers(page);
  const csv = "tradeId,symbol,quantity,price,tradeTs,settlementDate\nmissing-from-ledger,ACME,1,123.45,1700000000000,2023-11-16\n";
  const upload = await page.request.post("/api/v1/recon/runs", {
    headers: authHeaders,
    multipart: { file: { name: "resolve-e2e.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
  });
  expect(upload.status()).toBe(202);
  const { runId } = await upload.json();
  const breaksResponse = await page.request.get(`/api/v1/recon/breaks?runId=${encodeURIComponent(runId)}`, { headers: authHeaders });
  expect(breaksResponse.status()).toBe(200);
  const [breakItem] = (await breaksResponse.json()).breaks;
  expect(breakItem).toBeDefined();

  await page.goto("/ops/recon");
  const row = page.getByRole("row").filter({ hasText: breakItem.breakId });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Resolve" }).click();
  await page.getByLabel(/Resolution Reason/).fill("Verified against the uploaded statement");
  await page.locator(".panel-warning").getByRole("button", { name: "Resolve" }).click();
  await expect(row.getByText("RESOLVED")).toBeVisible();
  const auditResponse = await page.request.get(`/api/v1/recon/breaks/${encodeURIComponent(breakItem.breakId)}/audit`, { headers: authHeaders });
  expect(auditResponse.status()).toBe(200);
  expect((await auditResponse.json()).audit).toEqual(expect.arrayContaining([
    expect.objectContaining({ newStatus: "RESOLVED", reason: "Verified against the uploaded statement" }),
  ]));
});
