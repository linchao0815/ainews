// High-card e2e: two real browser pages play against the Colyseus server.
// Plumbing (browsers, waiting, reporting, offline, extra server, cleanup) is in kit/test.
import { createHarness } from "../kit/test/harness.mjs";

const h = await createHarness({ outDir: "logs/e2e" });
const { check, sleep, d, waitFor, pages, consoleErrors, serverLog } = h;
// Wait until the button is enabled and its position has settled (two equal readings) before
// clicking: right after a reload the layout may not be final yet and the click would miss.
async function clickButton(name) {
  let prev = "";
  await waitFor(name, () => window.__demo?.buttonCenter?.().enabled, `${name} button enabled`, 8000).catch(() => {});
  for (let i = 0; i < 30; i++) {
    const c = JSON.stringify(await d(name, () => window.__demo.buttonCenter()));
    if (c === prev) break;
    prev = c;
    await sleep(100);
  }
  return h.clickAt(name, () => window.__demo.buttonCenter());
}
const page_screens = (tag) => h.screenshot(tag, ["A", "B"]);

for (const name of ["A", "B"]) {
  await h.openPlayer(name);
  await sleep(300);
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
  const keys = await d("A", () => ({ game: sessionStorage.getItem("high-card:reconnectionToken"), legacy: sessionStorage.getItem("pixi-colyseus-card:reconnectionToken") }));
  check("重連憑證以遊戲 ID 為 key 儲存（high-card:reconnectionToken）", !!keys.game && keys.legacy === null, keys);

  const counters = countersA;
  check("GSAP 翻牌動畫有執行", counters.flipCount >= 4, counters);
  check("一般設定下翻牌有動畫（時長 > 0）", counters.lastFlipDuration > 0, counters);

  // --- reduced motion: a second pair joins a new room with prefers-reduced-motion ---
  for (const name of ["C", "D"]) await h.openPlayer(name, { contextOptions: { reducedMotion: "reduce" } });
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
  const countRejects = () => h.countServerLog(/REJECT claim_win from A/);
  const before = countRejects();
  await d("A", () => { for (let i = 0; i < 50; i++) window.__demo.rawSend("claim_win"); });
  await sleep(800);
  const after = countRejects();
  check("連續 50 筆作弊訊息，REJECT 日誌最多增加 2 行（頻率限制）",
    before !== null && after !== null && after - before <= 2,
    before === null ? `未評估：找不到伺服器日誌 ${serverLog}` : { before, after });
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

// --- seat release after the reconnection window: extra server with RECONNECT_SECONDS=2 ---
try {
  const short = await h.spawnServer({ port: 2568, env: { RECONNECT_SECONDS: "2" } });
  for (const name of ["E", "F"]) await h.openPlayer(name, { query: { server: short.url } });
  for (const n of ["E", "F"]) await waitFor(n, () => window.__demo?.machine() === "myChoice", "myChoice (short server)");
  const sidE = await d("E", () => window.__demo.sessionId);
  await sleep(5500); // past the SDK's 5 s minUptime, so this is a real drop (not an early-join failure)
  await h.setOffline("E", true);
  let released = true;
  try { await waitFor("F", () => window.__demo.state().players.length === 1 && window.__demo.machine() === "waiting", "F sees seat released", 12000); } catch { released = false; }
  check("斷線超過保留時間（2 秒）後座位被釋放，對手回到等待", released, await d("F", () => ({ players: window.__demo.state().players.map((p) => p.name), machine: window.__demo.machine() })));
  await h.setOffline("E", false);
  await pages.E.reload();
  let rejoined = true;
  try { await waitFor("E", () => window.__demo?.machine() === "myChoice", "E rejoined", 15000); } catch { rejoined = false; }
  const connE = rejoined ? await d("E", () => ({ sid: window.__demo.sessionId, c: window.__demo.connection() })) : null;
  check("過期憑證接回失敗後改為重新加入，並能再次與對手配對", rejoined && connE.c.resumed === false && connE.sid !== sidE, connE && { resumed: connE.c.resumed, newSid: connE.sid !== sidE });
  const lines = short.log().split(/\r?\n/);
  check("短保留伺服器有記錄座位逾時離開", lines.some((l) => /leave E/.test(l)), lines.filter((l) => /drop E|leave E/.test(l)));
} catch (e) {
  check("座位釋放流程", false, String(e));
}

await h.finish();
