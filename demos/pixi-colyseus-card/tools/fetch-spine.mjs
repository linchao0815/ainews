// Downloads the official Spine "spineboy" example (4.3 branch) into public/assets/spine.
// Not committed to the repo: the example assets are covered by Spine's own license terms.
import fs from "node:fs";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3/examples/spineboy/export/";
const FILES = ["spineboy-pro.skel", "spineboy.atlas", "spineboy.png"];
const OUT = path.join("public", "assets", "spine");

fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const res = await fetch(BASE + f);
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT, f), buf);
  console.log(`${f} ${buf.length} bytes`);
}
