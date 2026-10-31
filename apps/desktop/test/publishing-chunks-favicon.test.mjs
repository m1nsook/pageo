import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const rust = read("src-tauri/src/sites.rs");
const ui = read("src/components/editor/site-designer.tsx");
const convert = read("src/lib/favicon.ts");
test("content-addressed runtime and CSS chunks are used by page renderer and exporter", () => {
  assert.match(rust, /fn chunk_hash\(bytes: &\[u8\]\)/);
  assert.match(rust, /_paglora\/chunks\/\{\}\.js/);
  assert.match(rust, /_paglora\/chunks\/css\/\{\}\.css/);
  assert.match(rust, /staged\.join\(runtime_chunk_name\(asset\)\)/);
  assert.match(rust, /staged\.join\(stylesheet_chunk_name\(\)\)/);
  assert.match(rust, /let stylesheet_chunk = stylesheet_chunk_name\(\)/);
  assert.match(rust, /runtime_chunk_name\(asset\)/);
});
test("favicon setting is optional, validated and included in static/preview assets", () => {
  assert.match(rust, /favicon_url: String/);
  assert.match(rust, /favicon_url: String::new\(\)/);
  assert.match(rust, /<link rel=\\?"icon/);
  assert.match(rust, /settings\.favicon_url\.strip_prefix\("assets\/"\)/);
  assert.match(ui, /id="designer-favicon"/);
  assert.match(ui, /id="designer-favicon-upload"/);
  assert.match(ui, /importSiteAsset\(projectId, "favicon\.png", bytes\)/);
});
test("uploads are converted locally without executing remote code or SVG", () => {
  assert.match(convert, /createImageBitmap\(file\)/);
  assert.match(convert, /canvas\.width = 64/);
  assert.match(convert, /canvas\.height = 64/);
  assert.match(convert, /canvas\.toBlob\(/);
  assert.match(convert, /image\.close\(\)/);
  assert.doesNotMatch(convert, /fetch\(|\.svg|http:|eval\(/);
});
