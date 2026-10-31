import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/components/editor/block-catalog.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("Steps insertion persists as ordinary blockquote and ordered list Markdown", () => {
  assert.match(catalog, /kind: "steps", title: "Steps"/);
  assert.match(catalog, /case "steps": return \{\s*type: "blockquote"/);
  assert.match(catalog, /paragraph\("\[!STEPS\] Getting started"\)/);
  assert.match(catalog, /type: "orderedList", content:/);
  assert.match(catalog, /type: "listItem", content:/);
});

test("Steps enhancement is shared by sanitized Studio preview and static export", () => {
  assert.match(site, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container\)/);
  assert.match(site, /WARNING\|CAUTION\|CARD\|STEPS/);
  const branch = site.match(/if \(type === "STEPS"\) \{[\s\S]*?continue;\s*\}/)?.[0] ?? "";
  assert.match(branch, /tagName === "OL"/);
  assert.match(branch, /tagName === "LI"/);
  assert.match(branch, /if \(!list \|\| .*\) continue/);
  assert.match(branch, /steps\.setAttribute\("aria-label"/);
  assert.match(branch, /list\.classList\.add\("paglora-steps-list"\)/);
  assert.match(branch, /quote\.replaceWith\(steps\)/);
  assert.doesNotMatch(branch, /innerHTML|outerHTML|setAttribute\("style"/);
});

test("Static CSS renders a semantic, RTL-friendly step timeline without runtime scripts", () => {
  assert.match(exporter, /\.docs \.paglora-steps-list>li\{[^\n]*counter-increment:paglora-step/);
  assert.match(exporter, /\.docs \.paglora-steps-list>li::before\{content:counter\(paglora-step\)/);
  assert.match(exporter, /border-inline-start/);
  assert.match(exporter, /inset-inline-start/);
  assert.match(exporter, /margin-inline-start/);
  assert.match(exporter, /padding-inline-start/);
});
