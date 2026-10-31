import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marked } from "marked";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/components/editor/block-catalog.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("nested Markdown tab blockquotes are ordinary, portable Markdown", async () => {
  const source = [
    "> [!TABS] Platform", ">",
    "> > [!TAB] Windows", "> >", "> > Download an installer.", ">",
    "> > [!TAB] Linux", "> >", "> > Run the CLI.",
  ].join("\n");
  const html = await marked.parse(source);
  assert.equal((html.match(/<blockquote>/g) || []).length, 3);
  assert.match(html, /<p>\[!TABS\] Platform<\/p>/);
  assert.match(html, /<p>\[!TAB\] Windows<\/p>/);
  assert.match(html, /<p>\[!TAB\] Linux<\/p>/);
  assert.match(html, /Download an installer/);
  assert.match(html, /Run the CLI/);
});

test("Studio inserts nested, editable Markdown blockquotes", () => {
  assert.match(catalog, /kind: "tabs", title: "Tabs"/);
  const branch = catalog.split('case "tabs": return {')[1].split('case "codeGroup"')[0];
  assert.match(branch, /type: "blockquote"/);
  assert.match(branch, /paragraph\("\[!TABS\] Choose a platform"\)/);
  assert.match(branch, /paragraph\("\[!TAB\] Windows"\)/);
  assert.match(branch, /paragraph\("\[!TAB\] macOS"\)/);
});

test("tabs are constructed from sanitized nodes in the shared preview/export path", () => {
  assert.match(site, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container, language\)/);
  assert.match(site, /WARNING\|CAUTION\|CARD\|STEPS\|TABS\|CODEGROUP/);
  const branch = site.split('if (type === "TABS")')[1].split('if (type === "CODEGROUP")')[0];
  assert.match(branch, /sources\.length < 2 \|\| sources\.length > 8/);
  assert.match(branch, /source\.tagName !== "BLOCKQUOTE"/);
  assert.match(branch, /marker\.childNodes\.length !== 1/);
  assert.match(branch, /marker\.firstChild\?\.nodeType !== Node\.TEXT_NODE/);
  assert.match(branch, /names\.some\(\(name\) => !name\)/);
  assert.match(branch, /caption\.textContent = names\[index\]!/);
  assert.match(branch, /while \(source\.firstChild\) panel\.appendChild\(source\.firstChild\)/);
  assert.match(branch, /quote\.replaceWith\(group\)/);
  assert.doesNotMatch(branch, /innerHTML|outerHTML|insertAdjacentHTML|setAttribute\("style"/);
});

test("exported CSS retains script-free panels and hides only enhanced inactive panels", () => {
  assert.match(exporter, /\.docs \.paglora-tabs-item\{/);
  assert.match(exporter, /\.docs \.paglora-tabs-label\{/);
  assert.match(exporter, /\.docs \.paglora-tabs-tablist>button:focus-visible/);
  assert.match(exporter, /\.docs \.paglora-tabs-enhanced \.paglora-tabs-item\[hidden\]\{display:none\}/);
});
