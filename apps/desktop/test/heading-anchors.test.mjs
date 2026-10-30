import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const rust = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("headings in all documentation languages get stable anchors through h4", () => {
  assert.match(site, /querySelectorAll\("h2, h3, h4"\)/);
  assert.match(site, /normalize\("NFKC"\)/);
  assert.match(site, /\[\^\\p\{L\}\\p\{N\}\]/);
  assert.match(site, /if \(heading\.tagName !== "H4"\) toc\.push/);
  assert.match(rust, /heading\.id\.chars\(\)\.all\(/);
});
