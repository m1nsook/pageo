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
  assert.match(site, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container, language\)/);
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

test("adjacent documentation cards group safely without changing a lone card", () => {
  assert.match(site, /function groupAdjacentCards\(container: HTMLElement\)/);
  assert.match(site, /groupAdjacentCards\(container\);/);
  assert.match(site, /current\.classList\.contains\("paglora-card"\)/);
  assert.match(site, /next\?\.classList\.contains\("paglora-card"\)/);
  assert.match(site, /grid\.className = "paglora-card-grid"/);
  assert.match(site, /grid\.appendChild\(current\)/);
  assert.match(site, /grid\.appendChild\(next\)/);
  assert.doesNotMatch(site.match(/function groupAdjacentCards[\s\S]*?export type TocHeading/)?.[0] ?? "", /innerHTML|outerHTML/);
  assert.match(exporter, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,245px\),1fr\)\)/);
  assert.match(exporter, /@media\(prefers-reduced-motion:reduce\)/);
});
