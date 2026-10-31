import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, role: 'trader' | 'risk' | 'ops' | 'admin') {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(`demo-${role}`);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD ?? 'demo-password');
  const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  expect((await response).status()).toBe(200);
  const paths = { trader: '/trade', risk: '/risk', ops: '/ops/recon', admin: '/system' };
  await expect(page).toHaveURL(new RegExp(paths[role] + '$'));
}

async function headers(page: Page) {
  return { Authorization: `Bearer ${await page.evaluate(() => sessionStorage.getItem('authToken'))}` };
}

async function haltThroughApi(page: Page) {
  const response = await page.request.post('/api/v1/risk/symbols/ACME/halt', {
    headers: await headers(page), data: { reason: 'Independent resume scenario setup' },
  });
  expect(response.status()).toBe(202);
}

test('DEMO1: trader sees a durable limit order progress to RESTING', async ({ page }) => {
  const risk = await page.request.post('/api/v1/auth/login', { data: { username: 'demo-risk', password: process.env.E2E_PASSWORD ?? 'demo-password' } });
  expect(risk.status()).toBe(200);
  const { token } = await risk.json();
  expect((await page.request.post('/api/v1/risk/symbols/ACME/resume', { headers: { Authorization: `Bearer ${token}` }, data: { reason: 'Independent trading scenario setup' } })).status()).toBe(202);
  await login(page, 'trader');
  await page.getByLabel('Trading symbol').selectOption('ACME');
  await page.getByLabel('Order side').selectOption('BUY');
  await page.getByLabel('Order type').selectOption('LIMIT');
  await page.getByLabel('Order quantity').fill('1');
  await page.getByLabel('Order price').fill('50.00');
  await page.getByLabel('Client order ID').fill(`e2e-${randomUUID()}`);
  const response = page.waitForResponse(r => r.url().endsWith('/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit BUY' }).click();
  const received = await response;
  expect(received.status()).toBe(202);
  expect(await received.json()).toMatchObject({ status: 'RECEIVED' });
  const { orderId } = await received.json();
  await expect(page.getByText(orderId.slice(0, 8) + '...', { exact: true }).first()).toBeVisible();
  await expect.poll(async () => {
    const order = await page.request.get(`/api/v1/orders/${orderId}`, { headers: await headers(page) });
    return order.status() === 200 ? (await order.json()).status : `HTTP ${order.status()}`;
  }).toBe('RESTING');
  await expect(page.getByText('resting in the book').first()).toBeVisible();
});

test('DEMO2: risk officer halts ACME and observes the real breaker state', async ({ page }) => {
  await login(page, 'risk');
  await page.getByPlaceholder('AAPL').fill('ACME');
  await page.getByPlaceholder('Why are you halting this symbol?').fill('E2E risk halt');
  const response = page.waitForResponse(r => r.url().endsWith('/ACME/halt') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Halt', exact: true }).click();
  expect((await response).status()).toBe(202);
  await expect(page.getByRole('row').filter({ hasText: 'ACME' }).filter({ hasText: 'OPEN' }).first()).toBeVisible({ timeout: 15000 });
});

test('DEMO3: resume requires a reason and the outcome displays HALF_OPEN', async ({ page }) => {
  await login(page, 'risk');
  await haltThroughApi(page);
  const row = page.getByRole('row').filter({ hasText: 'ACME' }).filter({ hasText: 'OPEN' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole('button', { name: 'Resume', exact: true }).click();
  const submit = page.getByRole('button', { name: 'Resume (→ HALF_OPEN)' });
  await expect(submit).toBeDisabled();
  await page.getByPlaceholder('Why are you resuming this symbol?').fill('E2E incident reviewed');
  const response = page.waitForResponse(r => r.url().endsWith('/ACME/resume') && r.request().method() === 'POST');
  await submit.click();
  expect((await response).status()).toBe(202);
  await expect(page.getByRole('row').filter({ hasText: 'ACME' }).filter({ hasText: 'HALF_OPEN' }).first()).toBeVisible({ timeout: 15000 });
});

test('DEMO4: ops uploads a real statement and sees its persisted reconciliation run', async ({ page }) => {
  await login(page, 'ops');
  const csv = `tradeId,symbol,quantity,price,tradeTs,settlementDate\nexternal-${randomUUID()},ACME,1,50.00,${Date.now()},2026-11-02\n`;
  await page.locator('input[name="file"]').setInputFiles({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const response = page.waitForResponse(r => r.url().endsWith('/recon/runs') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  const uploaded = await response;
  expect(uploaded.status()).toBe(202);
  const { runId } = await uploaded.json();
  await expect(page.getByRole('cell', { name: runId, exact: true })).toBeVisible({ timeout: 15000 });
  const persisted = await page.request.get('/api/v1/recon/runs', { headers: await headers(page) });
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).runs).toEqual(expect.arrayContaining([expect.objectContaining({ runId, breaksFound: expect.any(Number) })]));
});

test('DEMO5: admin sees actual shard heartbeat, metrics availability and invariants', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.getByRole('heading', { name: 'System' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'inproc-engine', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Metrics Summary' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Now' })).toBeVisible();
  for (const path of ['/system/shards', '/system/metrics/summary', '/system/invariants', '/system/recovery']) {
    const response = await page.request.get('/api/v1' + path, { headers: await headers(page) });
    expect(response.status(), path).toBe(200);
    const data = await response.json();
    if (path.endsWith('/summary')) expect(typeof data.available).toBe('boolean');
    if (path.endsWith('/shards')) expect(data.shards).toEqual(expect.arrayContaining([expect.objectContaining({ leaseId: 'inproc-engine', isStale: false })]));
  }
});

test('DEMO6: simulator submits through the authenticated order handler', async ({ page }) => {
  await login(page, 'admin');
  const auth = await headers(page);
  const start = await page.request.post('/api/v1/system/simulator/start', { headers: auth, data: { seed: 4242 } });
  expect(start.status()).toBe(200);
  try {
    await expect.poll(async () => (await (await page.request.get('/api/v1/system/simulator', { headers: auth })).json()).sent).toBeGreaterThan(0);
  } finally {
    expect((await page.request.post('/api/v1/system/simulator/stop', { headers: auth })).status()).toBe(200);
  }
});
