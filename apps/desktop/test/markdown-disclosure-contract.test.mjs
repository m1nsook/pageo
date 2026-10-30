import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("native details and summary are sanitized but remain interactive without scripts", () => {
  assert.match(site, /"details", "summary"/);
  const branch = site.match(/if \(tag === "details"\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(branch, "details sanitizer branch should exist");
  assert.match(branch, /next\.className = "paglora-disclosure"/);
  assert.match(branch, /element\.hasAttribute\("open"\)/);
  assert.match(branch, /next\.setAttribute\("open", ""\)/);
  assert.doesNotMatch(branch, /(?:onclick|onload|innerHTML|setAttribute\("style")/);
  assert.match(site, /\["script", "style", "iframe", "object", "embed"/);
});

test("published CSS styles keyboard focus and disclosure state", () => {
  assert.match(exporter, /\.docs details\.paglora-disclosure\[open\]>summary/);
  assert.match(exporter, /\.docs details\.paglora-disclosure>summary:focus-visible/);
});
