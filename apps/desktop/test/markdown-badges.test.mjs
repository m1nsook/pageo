import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marked } from "marked";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const studio = read("src/lib/site.ts");
const headless = read("../../tools/headless/render.mjs");
const catalog = read("src/components/editor/block-catalog.ts");
const examples = read("src/lib/block-examples.ts");
const markers = read("src/lib/markdown-markers.ts");
const css = read("src-tauri/src/sites.rs");

test("badges are ordinary Markdown, inserted in both Studio and gallery", async () => {
  const source = "> [!BADGES] Release status\n>\n> - [success] Stable\n> - [info] Offline\n> - [warning] Preview";
  const html = await marked.parse(source);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ul>/);
  assert.match(html, /\[success\] Stable/);
  assert.match(catalog, /kind: "badges", title: "Badges"/);
  assert.match(catalog, /case "badges": return \{\s*type: "blockquote"/);
  assert.match(examples, /badges: "> \[!BADGES\]/);
  assert.match(markers, /TAB\|BADGES/);
});

test("Studio and headless share strict bounded, non-destructive badge parsing", () => {
  for (const [source, kind] of [[studio, "type"], [headless, "kind"]]) {
    const branch = source.split(`if (${kind} === "BADGES")`)[1]?.split(`if (${kind} === "TABS")`)[0] ?? "";
    assert.match(branch, /quote\.children\.length\s*!==\s*2/);
    assert.match(branch, /items\.length\s*>\s*12/);
    assert.match(branch, /title(?:Text)?\.length\s*>\s*160/);
    assert.match(branch, /neutral\|info\|success\|warning\|danger/);
    assert.match(branch, /source\.childNodes\.length\s*!==\s*1/);
    assert.match(branch, /createElement\("span"\)/);
    assert.match(branch, /badge\.textContent\s*=/);
    assert.match(branch, /quote\.replaceWith\(group\)/);
    assert.doesNotMatch(branch, /innerHTML|outerHTML|insertAdjacentHTML/);
  }
  assert.match(studio, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container, language\)/);
});

test("export styles use color modes and wrap status labels without scripts", () => {
  assert.match(css, /\.docs \.paglora-badges-row\{display:flex;flex-wrap:wrap/);
  assert.match(css, /\.docs \.paglora-badge-info\{--badge-color:var\(--brand\)\}/);
  assert.match(css, /data-color-mode="dark"\] \.docs \.paglora-badge-success/);
  assert.match(css, /prefers-color-scheme:dark/);
  assert.match(css, /\.docs \.paglora-badge-danger/);
});
