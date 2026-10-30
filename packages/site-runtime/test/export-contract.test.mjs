import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rust = readFileSync(fileURLToPath(new URL("../../../apps/desktop/src-tauri/src/sites.rs", import.meta.url)), "utf8");
const names = ["paglora.js", "paglora-search.js"];

test("website asset registry keeps script paths local and unique", () => {
  const block = rust.match(/const SITE_RUNTIME_ASSETS:[\s\S]*?\];/)?.[0];
  assert.ok(block, "Rust exporter should have a first-party asset registry");
  for (const filename of names) {
    const occurrences = block.split('filename: "' + filename + '"').length - 1;
    assert.equal(occurrences, 1, filename + " should appear once in the asset registry");
  }
  assert.doesNotMatch(block, /https?:\/\//);
});

test("preview strips every registered script while export writes all assets", () => {
  assert.match(rust, /for asset in SITE_RUNTIME_ASSETS \{[\s\S]*?doc = doc\.replace\(&tag, ""\)/);
  assert.match(rust, /for asset in SITE_RUNTIME_ASSETS \{[\s\S]*?fs::write\(staged\.join\(asset\.filename\), asset\.source\)/);
  assert.match(rust, /let runtime_scripts = site_runtime_script_tags\(\)/);
});
