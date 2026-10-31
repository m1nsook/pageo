import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rust = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");
const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const designer = readFileSync(new URL("../src/components/editor/site-designer.tsx", import.meta.url), "utf8");

test("published sites expose validated theme presets and legacy defaults", () => {
  for (const name of ["classic", "inset", "reading"]) {
    assert.ok(rust.includes(`"${name}"`), `Rust must know ${name}`);
    assert.ok(designer.includes(`id: "${name}"`), `designer must offer ${name}`);
  }
  for (const name of ["original", "graphite", "lavender", "linen"]) {
    assert.ok(rust.includes(`"${name}"`), `Rust must know ${name}`);
    assert.ok(designer.includes(`id: "${name}"`), `designer must offer ${name}`);
  }
  assert.match(rust, /site_layout_default\(\) -> String \{ "classic"\.into\(\) \}/);
  assert.match(rust, /site_palette_default\(\) -> String \{ "original"\.into\(\) \}/);
  assert.match(rust, /Unsupported website layout preset/);
  assert.match(rust, /Unsupported website color palette/);
  assert.match(rust, /data-site-layout="\{site_layout\}" data-site-palette="\{site_palette\}"/);
});

test("palette CSS handles explicit and system dark without disabling custom accent", () => {
  for (const name of ["graphite", "lavender", "linen"]) {
    assert.ok(rust.includes(`data-site-palette="${name}"][data-color-mode="dark"]`));
    assert.ok(rust.includes(`data-site-palette="${name}"]:not([data-color-mode="light"])`));
  }
  assert.match(rust, /let accent_style = format!\(/);
  assert.match(rust, /--brand:\{\};--brand-light:/);
  assert.match(rust, /@media\(max-width:800px\)/);
});

test("designer changes actual Rust preview settings, not a standalone mockup", () => {
  assert.match(site, /siteLayout: "classic" \| "inset" \| "reading"/);
  assert.match(site, /sitePalette: "original" \| "graphite" \| "lavender" \| "linen"/);
  assert.match(designer, /patch\("siteLayout", layout\.id\)/);
  assert.match(designer, /patch\("sitePalette", palette\.id\)/);
  assert.match(designer, /previewPublicPage\(projectId, "index", settings\)/);
  assert.match(designer, /sandbox="allow-same-origin" srcDoc=\{preview\}/);
  assert.doesNotMatch(designer, /sandbox="[^"]*allow-scripts/);
  assert.match(designer, /aria-pressed=\{settings\.siteLayout === layout\.id\}/);
  assert.match(designer, /aria-pressed=\{settings\.sitePalette === palette\.id\}/);
});

test("Studio card layout controls are persisted through the validated Rust site shell", () => {
  assert.match(site, /cardLayout: "stacked" \| "grid"/);
  assert.match(rust, /card_layout_default\(\) -> String \{ "stacked"\.into\(\) \}/);
  assert.match(rust, /Unsupported documentation card layout/);
  assert.match(rust, /data-card-layout="\{card_layout\}"/);
  assert.match(designer, /patch\("cardLayout", layout\.id\)/);
  assert.match(designer, /aria-pressed=\{settings\.cardLayout === layout\.id\}/);
  assert.match(rust, /:root\[data-card-layout="grid"\] \.docs \.paglora-card-grid/);
});
