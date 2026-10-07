// Shared e2e harness for games built on this kit (Playwright + a running game server).
// A game's test keeps its own, specific assertions; the harness owns the plumbing that every
// multiplayer game needs: browsers, players, waiting, reporting, offline/reload, a second
// server with custom env, and cleanup that does not leak held seats into the next run.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { spawn } from "node:child_process";

// Expected while a page is deliberately offline: the SDK's reconnection attempts fail until
// the network is back. Anything else logged as an error still fails the run.
export const EXPECTED_RECONNECT_ERROR = /WebSocket connection to 'ws:\/\/[^']+reconnectionToken=[^']+' failed/;

export async function createHarness({
  outDir,
  base = process.env.BASE ?? "http://localhost:5173",
  serverLog = process.env.SERVER_LOG ?? "logs/server.log",
  viewport = { width: 760, height: 680 },
  expectedErrors = [EXPECTED_RECONNECT_ERROR],
} = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const report = { checks: [], pass: true };
  const check = (name, ok, detail) => {
    report.checks.push({ name, ok: !!ok, detail });
    if (!ok) report.pass = false;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  " + JSON.stringify(detail) : ""}`);
  };

  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const pages = {};
  const consoleErrors = {};
  const servers = [];

  /** Open a player page: `${base}/${path}?name=<name>&<query>`. */
  async function openPlayer(name, { query = {}, path = "", contextOptions = {} } = {}) {
    const ctx = await browser.newContext({ viewport, ...contextOptions });
    const page = await ctx.newPage();
    consoleErrors[name] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !expectedErrors.some((re) => re.test(m.text()))) consoleErrors[name].push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors[name].push(`pageerror: ${e.message}`));
    const qs = new URLSearchParams({ name, ...query }).toString();
    await page.goto(`${base}/${path}?${qs}`);
    pages[name] = page;
    return page;
  }

  const d = (name, fn, arg) => pages[name].evaluate(fn, arg);
  async function waitFor(name, fn, label, timeout = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await pages[name].evaluate(fn)) return true; } catch { /* page reloading */ }
      await sleep(100);
    }
    throw new Error(`timeout waiting for ${label} on ${name}`);
  }
  /** Click at a point the page reports (e.g. () => window.__demo.buttonCenter()). */
  async function clickAt(name, pointFn) {
    const c = await d(name, pointFn);
    await pages[name].mouse.click(c.x, c.y);
    return c;
  }
  const setOffline = (name, offline) => pages[name].context().setOffline(offline);
  async function screenshot(tag, names = Object.keys(pages)) {
    for (const n of names) await pages[n].screenshot({ path: `${outDir}/${tag}-${n}.png` }).catch(() => {});
  }
  /** Count lines of the main server log matching a pattern (null = log not readable). */
  const countServerLog = (re) => fs.existsSync(serverLog)
    ? fs.readFileSync(serverLog, "utf8").split(/\r?\n/).filter((l) => re.test(l)).length
    : null;

  /** Start an extra game server (e.g. PORT=2568, RECONNECT_SECONDS=2). */
  async function spawnServer({ port, env = {}, entry = "server/index.ts" }) {
    const child = spawn(process.execPath, ["--import", "tsx", entry],
      { env: { ...process.env, ...env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (b) => { out += b; });
    child.stderr.on("data", (b) => { out += b; });
    for (let i = 0; i < 150 && !out.includes("listening"); i++) await sleep(100);
    const srv = { url: `ws://localhost:${port}`, log: () => out, kill: () => child.kill() };
    servers.push(srv);
    return srv;
  }

  /** Free every seat now (consented leave, fire-and-forget: leave() never resolves for a
   *  kicked client), stop extra servers, write the report, exit non-zero on failure. */
  async function finish() {
    for (const page of Object.values(pages)) await page.evaluate(() => { window.__demo?.leave?.(); }).catch(() => {});
    await sleep(300);
    for (const s of servers) s.kill();
    fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
    console.log(report.pass ? "\nALL PASS" : "\nSOME FAILED");
    await browser.close();
    process.exit(report.pass ? 0 : 1);
  }

  return { base, outDir, serverLog, sleep, report, check, browser, pages, consoleErrors,
    openPlayer, d, waitFor, clickAt, setOffline, screenshot, countServerLog, spawnServer, finish };
}
