// End-to-end check: two real browser pages play two rounds against the Colyseus server.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:5173";
const OUT = "logs/e2e";
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
  page.on("console", (m) => { if (m.type() === "error") consoleErrors[name].push(m.text()); });
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

  const counters = await d("A", () => window.__demo.counters());
  check("GSAP 翻牌動畫有執行", counters.flipCount >= 4, counters);
  check("開牌音效有播放（無例外）", counters.soundPlays >= 2, counters);
  const trans = await d("A", () => window.__demo.transitions.join(" > "));
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
await browser.close();
process.exit(report.pass ? 0 : 1);
