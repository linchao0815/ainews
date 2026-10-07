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

if (hits.length) {
  console.log(`FAIL  正式版打包含有測試掛鉤：\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS  正式版打包不含 ${FORBIDDEN.join("、")}`);
