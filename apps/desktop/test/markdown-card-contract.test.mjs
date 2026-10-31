import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/components/editor/block-catalog.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("card insertion uses a Markdown-round-trippable blockquote, not a custom project schema", () => {
  assert.match(catalog, /kind: "card", title: "Card"/);
  assert.match(catalog, /case "card": return \{\s*type: "blockquote"/);
  assert.match(catalog, /paragraph\("\[!CARD\] Card title"\)/);
});

test("cards are enhanced only after HTML sanitization for preview and export", () => {
  assert.match(site, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container\)/);
  assert.match(site, /WARNING\|CAUTION\|CARD/);
  assert.match(site, /if \(type === "CARD"\) \{/);
  assert.match(site, /heading\.textContent = text\.slice\(match\[0\]\.length\)\.trim\(\) \|\| "Card"/);
  assert.match(site, /card\.appendChild\(quote\.firstChild\)/);
  assert.doesNotMatch(site.match(/if \(type === "CARD"\)[\s\S]*?continue;/)?.[0] ?? "", /innerHTML|setAttribute\("style"/);
});

test("exported CSS styles documentation cards and keyboard focus", () => {
  assert.match(exporter, /\.docs \.paglora-card\{/);
  assert.match(exporter, /\.docs \.paglora-card-title\{/);
  assert.match(exporter, /\.docs \.paglora-card a:focus-visible/);
});
