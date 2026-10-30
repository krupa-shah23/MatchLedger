# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo.spec.ts >> DEMO Scenarios >> DEMO1: Trader places limit order and sees it in open orders
- Location: demo.spec.ts:25:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('input[placeholder="Username"]') to be visible

```

# Page snapshot

```yaml
- main [ref=e7]:
  - log [ref=e8]
  - generic [ref=e11]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - img "Grafana" [ref=e15]
        - heading "Welcome to Grafana" [level=1] [ref=e17]
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]: Email or username
          - textbox "Email or username" [active] [ref=e30]:
            - /placeholder: email or username
        - generic [ref=e31]:
          - generic [ref=e32]: Password
          - generic [ref=e38]:
            - textbox "Password" [ref=e39]:
              - /placeholder: password
            - switch "Show password" [ref=e41] [cursor=pointer]
        - button "Log in" [ref=e44] [cursor=pointer]
        - link "Forgot your password?" [ref=e47] [cursor=pointer]:
          - /url: /user/password/send-reset-email
    - list [ref=e51]:
      - listitem [ref=e52]:
        - link "Documentation" [ref=e55] [cursor=pointer]:
          - /url: https://grafana.com/docs/grafana/latest/?utm_source=grafana_footer
        - text: "|"
      - listitem [ref=e56]:
        - link "Support" [ref=e59] [cursor=pointer]:
          - /url: https://grafana.com/products/enterprise/?utm_source=grafana_footer
        - text: "|"
      - listitem [ref=e60]:
        - link "Community" [ref=e63] [cursor=pointer]:
          - /url: https://community.grafana.com/?utm_source=grafana_footer
        - text: "|"
      - listitem [ref=e64]:
        - link "Open Source" [ref=e65] [cursor=pointer]:
          - /url: https://grafana.com/oss/grafana?utm_source=grafana_footer
        - text: "|"
      - listitem [ref=e66]:
        - link "Grafana v13.1.3 (45a27d64b6)" [ref=e67] [cursor=pointer]:
          - /url: https://github.com/grafana/grafana/blob/main/CHANGELOG.md
```

# Test source

```ts
  1   | /**
  2   |  * DEMO1-DEMO5: End-to-end demo scenarios
  3   |  * Tests real trading workflows against live Docker Compose stack
  4   |  * Uses fixed simulator seed for determinism
  5   |  */
  6   | 
  7   | import { test, expect, Page } from '@playwright/test';
  8   | 
  9   | // Helper: wait for element without fixed sleeps
  10  | async function waitForElement(page: Page, selector: string, timeout = 5000) {
> 11  |   await page.waitForSelector(selector, { timeout });
      |              ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  12  | }
  13  | 
  14  | async function login(page: Page, username: string) {
  15  |   await page.goto('/');
  16  |   // Wait for login page to load
  17  |   await waitForElement(page, 'input[placeholder="Username"]');
  18  |   await page.fill('input[placeholder="Username"]', username);
  19  |   await page.click('button:has-text("Login")');
  20  |   // Wait for successful login - check for navigation
  21  |   await page.waitForURL('/', { waitUntil: 'networkidle' });
  22  | }
  23  | 
  24  | test.describe('DEMO Scenarios', () => {
  25  |   test('DEMO1: Trader places limit order and sees it in open orders', async ({ page }) => {
  26  |     // Scenario 1: Basic order placement
  27  |     await login(page, 'trader1');
  28  | 
  29  |     // Wait for trading page to load
  30  |     await waitForElement(page, 'text=Place Order');
  31  | 
  32  |     // Fill order form
  33  |     await page.selectOption('select', { label: 'ACME' });
  34  |     await page.selectOption('select', { label: 'BUY' });
  35  |     await page.fill('input[type="number"]', '100');
  36  |     await page.fill('input[type="text"][value*="100"]', '150.00');
  37  | 
  38  |     // Submit order
  39  |     await page.click('button:has-text("Place Order")');
  40  | 
  41  |     // Wait for success alert
  42  |     await page.waitForEvent('dialog');
  43  | 
  44  |     // Verify order appears in open orders
  45  |     await waitForElement(page, 'text=ACME');
  46  |     const orderRows = await page.$$('tbody tr');
  47  |     expect(orderRows.length).toBeGreaterThan(0);
  48  |   });
  49  | 
  50  |   test('DEMO2: Risk officer halts symbol and sees breaker', async ({ page }) => {
  51  |     // Scenario 2: Risk halt with reason
  52  |     await login(page, 'risk1');
  53  | 
  54  |     // Wait for risk page
  55  |     await waitForElement(page, 'text=Risk Console');
  56  | 
  57  |     // Halt ACME with reason
  58  |     await page.fill('input[placeholder="AAPL"]', 'ACME');
  59  |     await page.fill('textarea[placeholder*="Why are you halting"]', 'Suspicious trading activity');
  60  | 
  61  |     const haltButton = page.locator('button:has-text("Halt")').first();
  62  |     await haltButton.click();
  63  | 
  64  |     // Wait for success
  65  |     await page.waitForEvent('dialog');
  66  | 
  67  |     // Verify breaker appears
  68  |     await waitForElement(page, 'text=Breakers');
  69  |     const breakerRows = await page.$$('table tr');
  70  |     const acmeBreaker = breakerRows.some(row => row.textContent?.includes('ACME'));
  71  |     expect(acmeBreaker).toBe(true);
  72  |   });
  73  | 
  74  |   test('DEMO3: Risk resumes halted symbol with mandatory reason', async ({ page }) => {
  75  |     // Scenario 3: Resume from HALTED → HALF_OPEN
  76  |     await login(page, 'risk1');
  77  | 
  78  |     await waitForElement(page, 'text=Risk Console');
  79  | 
  80  |     // Click resume on a breaker
  81  |     const resumeButtons = page.locator('button:has-text("Resume")');
  82  |     const count = await resumeButtons.count();
  83  | 
  84  |     if (count > 0) {
  85  |       await resumeButtons.first().click();
  86  | 
  87  |       // Fill mandatory reason
  88  |       await page.fill('textarea[placeholder*="Why are you resuming"]', 'Issue resolved');
  89  | 
  90  |       // Submit resume
  91  |       const confirmButton = page.locator('button:has-text("Resume (→ HALF_OPEN)")');
  92  |       await confirmButton.click();
  93  | 
  94  |       // Wait for success
  95  |       await page.waitForEvent('dialog');
  96  | 
  97  |       // Verify HALF_OPEN message
  98  |       await page.waitForSelector('text=HALF_OPEN', { timeout: 3000 });
  99  |     }
  100 |   });
  101 | 
  102 |   test('DEMO4: Ops uploads statement and sees reconciliation run', async ({ page }) => {
  103 |     // Scenario 4: Statement upload with duplicate detection
  104 |     await login(page, 'ops1');
  105 | 
  106 |     await waitForElement(page, 'text=Reconciliation');
  107 | 
  108 |     // Create a dummy CSV file
  109 |     const fileData = 'account,asset,balance\nacc1,USD,100000\n';
  110 |     const fileName = 'statement.csv';
  111 | 
```