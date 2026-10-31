import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Run under xvfb-run on a headless host. Default Playwright focus emulation
// deliberately keeps pages visible, so connect to an ordinary browser with
// noDefaults:true and test real tabs without overriding document properties.
if (!process.env.E2E_PASSWORD) throw new Error("Set E2E_PASSWORD for the seeded demo user");
const profile = await mkdtemp(join(tmpdir(), "matchledger-visibility-"));
const child = spawn(chromium.executablePath(), ["--no-sandbox", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
let browser;
try {
  let port;
  const deadline = Date.now() + 30000;
  while (!port) {
    try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; }
    catch { if (Date.now() > deadline) throw new Error("Browser startup timed out"); await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
  const context = browser.contexts()[0];
  assert(context);
  const page = await context.newPage();
  await page.goto((process.env.BASE_URL ?? "http://localhost:5173") + "/login");
  await page.getByPlaceholder("Username").fill(process.env.E2E_USERNAME ?? "demo-admin");
  await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.getByRole("heading", { name: "System" }).waitFor();
  let polls = 0;
  page.on("request", request => { if (request.url().includes("/system/shards")) polls++; });
  const cdp = await context.newCDPSession(page);
  const info = await cdp.send("Target.getTargetInfo");
  const browserCdp = await browser.newBrowserCDPSession();
  const other = await browserCdp.send("Target.createTarget", { url: "about:blank", newWindow: false, background: false });
  await browserCdp.send("Target.activateTarget", { targetId: other.targetId });
  await page.waitForFunction(() => document.visibilityState === "hidden");
  const before = polls;
  await new Promise(resolve => setTimeout(resolve, 6000));
  assert.equal(polls, before, "P7 polled while its real tab was hidden");
  const resumed = page.waitForRequest(request => request.url().includes("/system/shards"));
  await browserCdp.send("Target.activateTarget", { targetId: info.targetInfo.targetId });
  await page.waitForFunction(() => document.visibilityState === "visible");
  await resumed;
  assert(polls > before);
  console.log(JSON.stringify({ hiddenTabPolls: 0, resumedPolling: true, realBrowserVisibility: true }));
} catch (error) {
  console.error("Visibility verification failed:", error);
  throw error;
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGTERM");
    const fallback = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }, 3000);
    await exited;
    clearTimeout(fallback);
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
