import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("GFM task checkbox sanitizer never passes through interactive input attributes", () => {
  const branch = site.match(/if \(tag === "input"\) \{[\s\S]*?return checkbox;\r?\n    \}/)?.[0];
  assert.ok(branch, "checkbox sanitizer branch must exist");
  assert.match(branch, /getAttribute\("type"\)\?\.toLowerCase\(\) !== "checkbox"/);
  assert.match(branch, /setAttribute\("type", "checkbox"\)/);
  assert.match(branch, /setAttribute\("disabled", ""\)/);
  assert.match(branch, /hasAttribute\("checked"\)/);
  assert.doesNotMatch(branch, /setAttribute\("(?:name|value|onclick|onchange)"/);
});

test("task list items have first-party styling in published CSS", () => {
  assert.match(site, /paglora-task-item/);
  assert.match(exporter, /\.docs li\.paglora-task-item/);
  assert.match(exporter, /\.docs \.paglora-task-checkbox/);
});
