// End-to-end check: two real browser pages play two rounds against the Colyseus server.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:5173";
const OUT = "logs/e2e";
// The server's stdout must be redirected here for the log rate-limit check.
const SERVER_LOG = process.env.SERVER_LOG ?? "logs/server.log";
// Expected while a page is deliberately offline: the SDK's reconnection attempts fail
// until the network is back. Anything else logged as an error still fails the run.
const EXPECTED_ERROR = /WebSocket connection to 'ws:\/\/[^']+reconnectionToken=[^']+' failed/;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { checks: [], pass: true };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: !!ok, detail });
  if (!ok) report.pass = false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  " + JSON.stringify(detail) : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const pages = {};
const consoleErrors = { A: [], B: [] };
for (const name of ["A", "B"]) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 680 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !EXPECTED_ERROR.test(m.text())) consoleErrors[name].push(m.text()); });
  page.on("pageerror", (e) => consoleErrors[name].push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/?name=${name}`);
  pages[name] = page;
  await sleep(300);
}

const d = (name, expr) => pages[name].evaluate(expr);
async function waitFor(name, fn, label, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await pages[name].evaluate(fn)) return true; } catch {}
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${label} on ${name}`);
}
async function clickButton(name) {
  const c = await d(name, () => window.__demo.buttonCenter());
  await pages[name].mouse.click(c.x, c.y);
  return c;
}

try {
  for (const n of ["A", "B"]) await waitFor(n, () => window.__demo?.machine() === "myChoice", "myChoice");
  check("兩位玩家都進入 myChoice（發牌完成）", true);

  // --- private card visibility (StateView) ---
  const sA = await d("A", () => window.__demo.state());
  const sB = await d("B", () => window.__demo.state());
  const own = (s, sid) => s.players.find((p) => p.sid === sid);
  const other = (s, sid) => s.players.find((p) => p.sid !== sid);
  const sidA = await d("A", () => window.__demo.sessionId);
  const sidB = await d("B", () => window.__demo.sessionId);
  check("A 看得到自己的牌", own(sA, sidA).card > 0, own(sA, sidA).card);
  check("A 看不到 B 的牌（資料沒送到 A）", !other(sA, sidA).card, other(sA, sidA).card);
  check("B 看得到自己的牌", own(sB, sidB).card > 0, own(sB, sidB).card);
  check("B 看不到 A 的牌（資料沒送到 B）", !other(sB, sidB).card, other(sB, sidB).card);

  // --- Spine / sound / layout sanity ---
  // Spine + sound are lazy-loaded after the first render: wait for them (bounded).
  await waitFor("A", () => window.__demo.spine().loaded && window.__demo.soundExists(), "lazy extras", 10000).catch(() => {});
  const spine = await d("A", () => window.__demo.spine());
  check("Spine 角色載入並播放 idle", spine.loaded && spine.current === "idle", spine);
  check("@pixi/sound 音效已註冊", await d("A", () => window.__demo.soundExists()));
  const btn = await d("A", () => window.__demo.buttonCenter());
  check("@pixi/layout 排版後按鈕位置在畫面內且可按", btn.enabled && btn.x > 0 && btn.x < 720 && btn.y > 0 && btn.y < 640, btn);

  // --- cheat attempts from A before anyone is ready ---
  await d("A", () => { window.__demo.rawSend("claim_win"); window.__demo.rawSend("set_card", 13); });
  await sleep(300);
  const afterCheat = await d("A", () => window.__demo.state());
  check("作弊訊息後分數沒變、牌沒變", afterCheat.players.every((p) => p.score === 0) && own(afterCheat, sidA).card === own(sA, sidA).card);

  await page_screens("round1-dealt");

  // --- round 1: A clicks, then tries ready again; B clicks ---
  await clickButton("A");
  await waitFor("A", () => window.__demo.machine() === "waitingOpponent", "waitingOpponent");
  check("A 按開牌後進入 waitingOpponent，按鈕停用", !(await d("A", () => window.__demo.buttonCenter().enabled)));
  await d("A", () => window.__demo.rawSend("ready"));   // duplicate ready (cheat)
  await sleep(200);
  await clickButton("B");
  for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.machine() === "revealed", "revealed");
  await sleep(500); // let GSAP flip finish
  const r1A = await d("A", () => window.__demo.state());
  const r1B = await d("B", () => window.__demo.state());
  check("兩邊看到相同的勝負結果", r1A.winner === r1B.winner && r1A.round === 1, { winner: r1A.winner });
  const pa = own(r1A, sidA), pb = other(r1A, sidA);
  const expected = pa.shownCard === pb.shownCard ? "draw" : pa.shownCard > pb.shownCard ? sidA : sidB;
  check("勝負由伺服器依牌面正確判定", r1A.winner === expected, { A: pa.shownCard, B: pb.shownCard });
  const cardsA = await d("A", () => window.__demo.cards());
  check("開牌後 A 畫面上兩張牌都翻開，且對手牌面正確", cardsA.opp.faceUp && cardsA.opp.value === pb.shownCard, cardsA);
  const scoreSum = r1A.players.reduce((s, p) => s + p.score, 0);
  check("重複 ready 沒有造成重複計分", scoreSum === (r1A.winner === "draw" ? 0 : 1), scoreSum);
  await page_screens("round1-revealed");

  // --- round 2 auto-deal, both click ---
  for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.state().round === 2 && window.__demo.machine() === "myChoice", "round2");
  check("第 2 局自動發牌，雙方回到 myChoice", true);
  await clickButton("B");
  await clickButton("A");
  for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.machine() === "revealed", "revealed r2");
  await sleep(500);
  const r2 = await d("B", () => window.__demo.state());
  check("第 2 局完成開牌", r2.round === 2 && r2.phase === "revealed", { winner: r2.winner, players: r2.players.map((p) => [p.name, p.shownCard, p.score]) });
  await page_screens("round2-revealed");

  // --- reconnection: A goes offline for 3 s during round 3, then comes back ---
  for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.state().round === 3 && window.__demo.machine() === "myChoice", "round3");
  const beforeDrop = await d("A", () => ({ sid: window.__demo.sessionId, s: window.__demo.state() }));
  const myBefore = beforeDrop.s.players.find((p) => p.sid === beforeDrop.sid);
  await pages.A.context().setOffline(true);
  let oppSawDrop = true;
  try { await waitFor("B", () => window.__demo.state().players.some((p) => p.name === "A" && p.connected === false), "B sees A disconnected", 8000); } catch { oppSawDrop = false; }
  check("A 斷線時，B 看到對手斷線（connected=false）", oppSawDrop, await d("B", () => window.__demo.state().players.map((p) => [p.name, p.connected])));
  await sleep(3000);
  await pages.A.context().setOffline(false);
  let reconnected = true;
  try { await waitFor("A", () => window.__demo.connection?.().reconnects >= 1 && !window.__demo.connection().reconnecting, "A reconnected", 15000); } catch { reconnected = false; }
  const afterRe = await d("A", () => ({ sid: window.__demo.sessionId, s: window.__demo.state(), c: window.__demo.connection?.() }));
  const myAfter = afterRe.s.players.find((p) => p.name === "A");
  check("A 恢復網路後自動重連（同一 sessionId）", reconnected && afterRe.c?.drops >= 1 && myAfter?.sid === beforeDrop.sid, afterRe.c);
  check("重連後手牌與分數不變", myAfter && myAfter.card === myBefore.card && myAfter.score === myBefore.score, { before: [myBefore.card, myBefore.score], after: [myAfter?.card, myAfter?.score] });
  let oppSawBack = true;
  try { await waitFor("B", () => window.__demo.state().players.some((p) => p.name === "A" && p.connected === true), "B sees A back", 8000); } catch { oppSawBack = false; }
  check("A 回來後，B 看到對手恢復連線", oppSawBack);
  await clickButton("A");
  await clickButton("B");
  let r3 = true;
  try { for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.machine() === "revealed" && window.__demo.state().round === 3, "revealed r3", 8000); } catch { r3 = false; }
  check("重連後雙方能完成第 3 局", r3);

  // A's page-level counters reset on reload, so snapshot them for the later checks.
  const countersA = await d("A", () => window.__demo.counters());
  const transA = await d("A", () => window.__demo.transitions.join(" > "));

  // --- reload: A refreshes the page mid-round and must get its seat back via the stored token ---
  for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.state().round === 4 && window.__demo.machine() === "myChoice", "round4");
  const beforeReload = await d("A", () => ({ sid: window.__demo.sessionId, s: window.__demo.state() }));
  const meBefore = beforeReload.s.players.find((p) => p.sid === beforeReload.sid);
  await pages.A.reload();
  let reloadedBack = true;
  try { await waitFor("A", () => window.__demo?.machine() === "myChoice", "A back after reload", 15000); } catch { reloadedBack = false; }
  const afterReload = reloadedBack ? await d("A", () => ({ sid: window.__demo.sessionId, s: window.__demo.state(), c: window.__demo.connection() })) : null;
  const meAfter = afterReload?.s.players.find((p) => p.sid === afterReload.sid);
  check("重新整理後用同一 sessionId 接回座位", reloadedBack && afterReload.sid === beforeReload.sid && afterReload.c.resumed === true,
    { before: beforeReload.sid, after: afterReload?.sid, resumed: afterReload?.c?.resumed });
  check("重新整理後手牌與分數不變", !!meAfter && meAfter.card === meBefore.card && meAfter.score === meBefore.score,
    { before: [meBefore.card, meBefore.score], after: [meAfter?.card, meAfter?.score] });
  let bSeesA = true;
  try { await waitFor("B", () => window.__demo.state().players.length === 2 && window.__demo.state().players.every((p) => p.connected !== false), "B sees A after reload", 8000); } catch { bSeesA = false; }
  check("A 重新整理後，B 仍在同一局且看到 A 已連線", bSeesA, await d("B", () => window.__demo.state().players.map((p) => [p.name, p.connected])));
  await clickButton("A");
  await clickButton("B");
  let r4 = true;
  try { for (const n of ["A", "B"]) await waitFor(n, () => window.__demo.machine() === "revealed" && window.__demo.state().round === 4, "revealed r4", 8000); } catch { r4 = false; }
  check("重新整理後雙方能完成第 4 局", r4);

  const counters = countersA;
  check("GSAP 翻牌動畫有執行", counters.flipCount >= 4, counters);
  check("一般設定下翻牌有動畫（時長 > 0）", counters.lastFlipDuration > 0, counters);

  // --- reduced motion: a second pair joins a new room with prefers-reduced-motion ---
  for (const name of ["C", "D"]) {
    const ctx = await browser.newContext({ viewport: { width: 760, height: 680 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    consoleErrors[name] = [];
    page.on("console", (m) => { if (m.type() === "error" && !EXPECTED_ERROR.test(m.text())) consoleErrors[name].push(m.text()); });
    page.on("pageerror", (e) => consoleErrors[name].push(`pageerror: ${e.message}`));
    await page.goto(`${BASE}/?name=${name}`);
    pages[name] = page;
  }
  for (const n of ["C", "D"]) await waitFor(n, () => window.__demo?.machine() === "myChoice", "myChoice (reduced motion)");
  const cC = await d("C", () => window.__demo.counters());
  check("減少動態效果時翻牌立即完成（時長 = 0）", cC.lastFlipDuration === 0, cC);

  // --- malformed payload: schema validation must drop the sender (CloseCode.WITH_ERROR = 4002) ---
  await d("C", () => window.__demo.rawSend("set_card", "not-a-number"));
  let kicked = true;
  try { await waitFor("C", () => window.__demo.connection?.().leaveCode != null, "C leaveCode", 5000); } catch { kicked = false; }
  const connC = kicked ? await d("C", () => window.__demo.connection()) : null;
  check("格式錯誤的訊息會讓送出者被踢出（WITH_ERROR 4002）", kicked && connC.leaveCode === 4002, connC);
  let dWaiting = true;
  try { await waitFor("D", () => window.__demo.machine() === "waiting", "D waiting", 5000); } catch { dWaiting = false; }
  check("對手被踢出後，另一方回到等待狀態", dWaiting, await d("D", () => window.__demo.machine()));

  // --- REJECT log rate limit: a 50-message burst may add at most 2 log lines ---
  const countRejects = () => fs.existsSync(SERVER_LOG)
    ? fs.readFileSync(SERVER_LOG, "utf8").split("\n").filter((l) => l.includes("REJECT claim_win from A")).length
    : null;
  const before = countRejects();
  await d("A", () => { for (let i = 0; i < 50; i++) window.__demo.rawSend("claim_win"); });
  await sleep(800);
  const after = countRejects();
  check("連續 50 筆作弊訊息，REJECT 日誌最多增加 2 行（頻率限制）",
    before !== null && after !== null && after - before <= 2,
    before === null ? `未評估：找不到伺服器日誌 ${SERVER_LOG}` : { before, after });
  check("開牌音效有播放（無例外）", counters.soundPlays >= 2, counters);
  const trans = transA;
  check("xstate 流程轉換正確", trans.startsWith("connecting > waiting > myChoice > waitingOpponent > revealed > myChoice"), trans);
  for (const n of ["A", "B"]) {
    const appErr = await d(n, () => window.__demo.errors);
    check(`${n} 頁面沒有錯誤`, appErr.length === 0 && consoleErrors[n].length === 0, { appErr, console: consoleErrors[n] });
  }
} catch (e) {
  check("流程執行", false, String(e));
  await page_screens("failure");
}

async function page_screens(tag) {
  for (const n of ["A", "B"]) await pages[n].screenshot({ path: `${OUT}/${tag}-${n}.png` });
}

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(report.pass ? "\nALL PASS" : "\nSOME FAILED");
// Consented leave first, so the server frees seats now instead of holding them
// 20 s for reconnection (which would leak into the next run's matchmaking).
// Fire-and-forget: leave() never resolves for a client the server already kicked.
for (const page of Object.values(pages)) await page.evaluate(() => { window.__demo?.leave?.(); }).catch(() => {});
await sleep(300);
await browser.close();
process.exit(report.pass ? 0 : 1);
