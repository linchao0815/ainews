// Responsive layout check: portrait + landscape phone viewports, touch-target size,
// everything inside the viewport and the (simulated) safe area.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:5173";
const OUT = "logs/responsive";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = true;
const check = (name, ok, detail) => {
  if (!ok) pass = false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  " + JSON.stringify(detail) : ""}`);
};

const MIN_TOUCH = 44; // CSS px (Apple HIG 44pt / Material 48dp / WCAG 2.5.5)
const VIEWPORTS = [
  { name: "iphone-portrait", width: 390, height: 844, expect: "portrait" },
  { name: "iphone-landscape", width: 844, height: 390, expect: "landscape" },
  { name: "small-android-portrait", width: 360, height: 640, expect: "portrait" },
  { name: "small-android-landscape", width: 640, height: 360, expect: "landscape" },
];
// Simulated notch / home indicator: overrides the env(safe-area-inset-*) probe element.
const SAFE = { top: 47, right: 0, bottom: 34, left: 0 };

const browser = await chromium.launch();
const pages = [];
const inside = (r, box) => r.x >= box.x - 0.5 && r.y >= box.y - 0.5 && r.x + r.width <= box.x + box.w + 0.5 && r.y + r.height <= box.y + box.h + 0.5;

async function measure(vp, safe) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/?name=L-${vp.name}`);
  pages.push(page);
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.__demo?.ui)); i++) await sleep(100);
  if (safe) {
    await page.addStyleTag({ content: `#safe-area-probe{padding:${safe.top}px ${safe.right}px ${safe.bottom}px ${safe.left}px !important}` });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  }
  await sleep(400);
  const ui = await page.evaluate(() => window.__demo?.ui?.());
  await page.screenshot({ path: `${OUT}/${vp.name}${safe ? "-safe" : ""}.png` });
  return { ui, errors };
}

for (const vp of VIEWPORTS) {
  const { ui, errors } = await measure(vp);
  if (!ui) { check(`${vp.name}: 有版面資訊（__demo.ui）`, false, "未提供 ui()"); continue; }
  const view = { x: 0, y: 0, w: vp.width, h: vp.height };
  check(`${vp.name}: 方向判斷為 ${vp.expect}`, ui.orientation === vp.expect, ui.orientation);
  check(`${vp.name}: 按鈕至少 ${MIN_TOUCH}×${MIN_TOUCH} CSS px`, ui.button.width >= MIN_TOUCH && ui.button.height >= MIN_TOUCH, ui.button);
  check(`${vp.name}: 按鈕與兩張牌完整在畫面內`, [ui.button, ...ui.cards].every((r) => inside(r, view)), { button: ui.button, cards: ui.cards });
  check(`${vp.name}: 標題（含長名稱）完整在畫面內`, !!ui.title && inside(ui.title, view), ui.title);
  // Legibility: the 26px title must wrap, not be shrunk to fit (one line >= 16 CSS px tall).
  check(`${vp.name}: 標題沒有被縮小（每行高度 >= 16px）`, !!ui.title && ui.titleLineHeight >= 16, { lineHeight: ui.titleLineHeight, lines: ui.titleLines });
  if (vp.expect === "landscape") {
    const tableRight = Math.max(...ui.cards.map((c) => c.x + c.width));
    check(`${vp.name}: 橫式時按鈕在牌桌右側`, ui.button.x >= tableRight - 1, { tableRight, buttonX: ui.button.x });
  } else {
    const tableBottom = Math.max(...ui.cards.map((c) => c.y + c.height));
    check(`${vp.name}: 直式時按鈕在牌桌下方`, ui.button.y >= tableBottom - 1, { tableBottom, buttonY: ui.button.y });
  }
  check(`${vp.name}: 沒有頁面錯誤`, errors.length === 0, errors);
}

// Safe area: content must stay out of the notch / home-indicator strips.
{
  const vp = VIEWPORTS[0];
  const { ui } = await measure(vp, SAFE);
  const safeBox = { x: SAFE.left, y: SAFE.top, w: vp.width - SAFE.left - SAFE.right, h: vp.height - SAFE.top - SAFE.bottom };
  check(`${vp.name}（模擬瀏海 ${SAFE.top}px、底部 ${SAFE.bottom}px）: 按鈕與牌都在安全區內`,
    !!ui && [ui.button, ...ui.cards].every((r) => inside(r, safeBox)), ui && { safe: ui.safe, button: ui.button, cards: ui.cards });
}

for (const page of pages) await page.evaluate(() => { window.__demo?.leave?.(); }).catch(() => {});
await sleep(300);
console.log(pass ? "\nALL PASS" : "\nSOME FAILED");
await browser.close();
process.exit(pass ? 0 : 1);
