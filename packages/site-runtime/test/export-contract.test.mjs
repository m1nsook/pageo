import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rust = readFileSync(fileURLToPath(new URL("../../../apps/desktop/src-tauri/src/sites.rs", import.meta.url)), "utf8");
const names = ["paglora.js", "paglora-search.js"];
const buildScript = readFileSync(new URL("../../../apps/desktop/src-tauri/build.rs", import.meta.url), "utf8");
const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");

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

test("Rust export embeds minified browser bundles, not unbundled source", () => {
  assert.match(rust, /include_str!\("\.\.\/\.\.\/\.\.\/\.\.\/packages\/site-runtime\/dist\/index\.js"\)/);
  assert.match(rust, /include_str!\("\.\.\/\.\.\/\.\.\/\.\.\/packages\/site-runtime\/dist\/search\.js"\)/);
  assert.doesNotMatch(rust, /include_str!\("[^"]*packages\/site-runtime\/src\//);
  assert.match(buildScript, /Command::new\("bun"\)/);
  assert.match(buildScript, /tauri_build::build\(\)/);
  const rustJob = ci.split(/\r?\n  rust:\r?\n/)[1];
  assert.ok(rustJob, "CI must include the Rust job");
  assert.match(rustJob, /Set up Bun for embedded site runtime/);
});
