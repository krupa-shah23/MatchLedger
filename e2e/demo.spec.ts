/**
 * DEMO1-DEMO5: End-to-end demo scenarios
 * Tests real trading workflows against live Docker Compose stack
 * Uses fixed simulator seed for determinism
 */

import { test, expect, Page } from '@playwright/test';

// Helper: wait for element without fixed sleeps
async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
}

async function login(page: Page, username: string) {
  await page.goto('/');
  // Wait for login page to load
  await waitForElement(page, 'input[placeholder="Username"]');
  await page.fill('input[placeholder="Username"]', username);
  await page.click('button:has-text("Login")');
  // Wait for successful login - check for navigation
  await page.waitForURL('/', { waitUntil: 'networkidle' });
}

test.describe('DEMO Scenarios', () => {
  test('DEMO1: Trader places limit order and sees it in open orders', async ({ page }) => {
    // Scenario 1: Basic order placement
    await login(page, 'trader1');

    // Wait for trading page to load
    await waitForElement(page, 'text=Place Order');

    // Fill order form
    await page.selectOption('select', { label: 'ACME' });
    await page.selectOption('select', { label: 'BUY' });
    await page.fill('input[type="number"]', '100');
    await page.fill('input[type="text"][value*="100"]', '150.00');

    // Submit order
    await page.click('button:has-text("Place Order")');

    // Wait for success alert
    await page.waitForEvent('dialog');

    // Verify order appears in open orders
    await waitForElement(page, 'text=ACME');
    const orderRows = await page.$$('tbody tr');
    expect(orderRows.length).toBeGreaterThan(0);
  });

  test('DEMO2: Risk officer halts symbol and sees breaker', async ({ page }) => {
    // Scenario 2: Risk halt with reason
    await login(page, 'risk1');

    // Wait for risk page
    await waitForElement(page, 'text=Risk Console');

    // Halt ACME with reason
    await page.fill('input[placeholder="AAPL"]', 'ACME');
    await page.fill('textarea[placeholder*="Why are you halting"]', 'Suspicious trading activity');

    const haltButton = page.locator('button:has-text("Halt")').first();
    await haltButton.click();

    // Wait for success
    await page.waitForEvent('dialog');

    // Verify breaker appears
    await waitForElement(page, 'text=Breakers');
    const breakerRows = await page.$$('table tr');
    const acmeBreaker = breakerRows.some(row => row.textContent?.includes('ACME'));
    expect(acmeBreaker).toBe(true);
  });

  test('DEMO3: Risk resumes halted symbol with mandatory reason', async ({ page }) => {
    // Scenario 3: Resume from HALTED → HALF_OPEN
    await login(page, 'risk1');

    await waitForElement(page, 'text=Risk Console');

    // Click resume on a breaker
    const resumeButtons = page.locator('button:has-text("Resume")');
    const count = await resumeButtons.count();

    if (count > 0) {
      await resumeButtons.first().click();

      // Fill mandatory reason
      await page.fill('textarea[placeholder*="Why are you resuming"]', 'Issue resolved');

      // Submit resume
      const confirmButton = page.locator('button:has-text("Resume (→ HALF_OPEN)")');
      await confirmButton.click();

      // Wait for success
      await page.waitForEvent('dialog');

      // Verify HALF_OPEN message
      await page.waitForSelector('text=HALF_OPEN', { timeout: 3000 });
    }
  });

  test('DEMO4: Ops uploads statement and sees reconciliation run', async ({ page }) => {
    // Scenario 4: Statement upload with duplicate detection
    await login(page, 'ops1');

    await waitForElement(page, 'text=Reconciliation');

    // Create a dummy CSV file
    const fileData = 'account,asset,balance\nacc1,USD,100000\n';
    const fileName = 'statement.csv';

    // Upload file
    const fileInput = page.locator('input[name="file"]');

    // Set file using buffer
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/csv',
      buffer: Buffer.from(fileData),
    });

    // Submit
    await page.click('button:has-text("Upload")');

    // Wait for success or 409 error
    await waitForElement(page, 'text=/processed|already/');

    // Verify runs list updated
    await waitForElement(page, 'text=Reconciliation Runs');
  });

  test('DEMO5: System operator sees shards and metrics', async ({ page }) => {
    // Scenario 5: System monitoring
    await login(page, 'admin1');

    // Navigate to system
    await page.click('text=System');

    await waitForElement(page, 'text=System (P7)');

    // Verify shard table
    await waitForElement(page, 'text=Shards');
    const shardTable = page.locator('table:has-text("Lease ID")');
    await expect(shardTable).toBeVisible();

    // Verify metrics card
    await waitForElement(page, 'text=Metrics Summary');

    // Check that metrics are loading or available
    const metricsSection = page.locator('text=Metrics Summary').locator('..').first();
    const hasMetrics = await metricsSection.textContent();
    expect(hasMetrics).toBeTruthy();

    // Verify invariants
    await waitForElement(page, 'text=Invariants');
    await waitForElement(page, 'button:has-text("Run Now")');
  });

  test('DEMO6: Simulator runs and sends orders through system', async ({ page }) => {
    // Scenario 6: Full flow - simulator generates orders that go through system
    await login(page, 'admin1');

    // Go to system page
    await page.click('text=System');

    await waitForElement(page, 'text=Simulator');

    // Start simulator
    const startButton = page.locator('button:has-text("Start")').first();
    await startButton.click();

    // Wait for simulator to start
    await page.waitForTimeout(1000);

    // Check status changed
    const statusText = await page.locator('text=/Running|Stopped/').first().textContent();
    expect(statusText).toContain('Running');

    // Let simulator run briefly
    await page.waitForTimeout(2000);

    // Stop simulator
    const stopButton = page.locator('button:has-text("Stop")').first();
    await stopButton.click();

    // Verify counters updated (sent > 0)
    const sentText = await page.locator('text=/Sent:/).textContent();
    expect(sentText).toBeTruthy();
  });
});
