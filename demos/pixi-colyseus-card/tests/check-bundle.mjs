// Production-bundle check: builds with the default (production) mode into dist-prod/
// and fails if test-only hooks leaked into the shipped JavaScript.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = "dist-prod";
const FORBIDDEN = ["__demo", "rawSend"];

execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, { stdio: "inherit" });

const hits = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html)$/.test(name)) {
      const text = fs.readFileSync(p, "utf8");
      for (const word of FORBIDDEN) if (text.includes(word)) hits.push(`${p}: ${word}`);
    }
  }
};
walk(OUT);

let failed = false;
if (hits.length) {
  console.log(`FAIL  正式版打包含有測試掛鉤：\n  ${hits.join("\n  ")}`);
  failed = true;
} else {
  console.log(`PASS  正式版打包不含 ${FORBIDDEN.join("、")}`);
}

// Entry-chunk budget: the script index.html loads first must stay small; decorative and
// late-needed modules (Spine character, sound) load via dynamic import().
// History: baseline ~956 KB. The first budget (700 KB) assumed Spine could be lazy-loaded,
// but spine-pixi-v8 must be imported before app.init() (it registers renderer pipes that a
// Pixi renderer only collects at creation), so only @pixi/sound is lazy -> ~723 KB.
// Budget raised to 750 KB deliberately; going lower would mean dropping the Spine
// character or calling Pixi's private AbstractRenderer._addPipes.
const ENTRY_BUDGET_KB = 750;
const html = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
const entry = html.match(/<script[^>]+src="\/?([^"]+\.js)"/)?.[1];
const entryKB = entry ? fs.statSync(path.join(OUT, entry)).size / 1024 : Infinity;
const ok = entryKB <= ENTRY_BUDGET_KB;
console.log(`${ok ? "PASS" : "FAIL"}  主程式 ${entry} ${entryKB.toFixed(0)} KB（預算 ${ENTRY_BUDGET_KB} KB）`);
if (!ok) failed = true;
process.exit(failed ? 1 : 0);
