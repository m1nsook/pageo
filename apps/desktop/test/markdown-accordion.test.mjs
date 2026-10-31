import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marked } from "marked";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/components/editor/block-catalog.ts", import.meta.url), "utf8");
const markers = readFileSync(new URL("../src/lib/markdown-markers.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");
const headless = readFileSync(new URL("../../../tools/headless/render.mjs", import.meta.url), "utf8");

test("FAQ authoring uses ordinary blockquote Markdown and a palette insertion", async () => {
  const markdown = "> [!ACCORDION] Can I publish offline?\n>\n> Yes, with static HTML.";
  const html = await marked.parse(markdown);
  assert.match(html, /<blockquote>/);
  assert.match(html, /\[!ACCORDION\] Can I publish offline\?/);
  assert.match(html, /Yes, with static HTML/);
  assert.match(catalog, /kind: "accordion", title: "Accordion"/);
  assert.match(catalog, /case "accordion": return \{\s*type: "blockquote"/);
  assert.match(catalog, /paragraph\("\[!ACCORDION\] How does this work\?"\)/);
  assert.match(markers, /CODEGROUP\|ACCORDION\|TAB/);
});

test("Studio and headless enhance only safe nonempty FAQ questions after sanitization", () => {
  assert.match(site, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container, language\)/);
  for (const [source, kind] of [[site, "type"], [headless, "kind"]]) {
    const branch = source.split(`if (${kind} === "ACCORDION")`)[1]?.split(`if (${kind} === "TABS")`)[0] ?? "";
    assert.match(branch, /childNodes\.length\s*!==?\s*1/);
    assert.match(branch, /children\.length\s*<\s*2/);
    assert.match(branch, /question\.length\s*>\s*160/);
    assert.match(branch, /createElement\("details"\)/);
    assert.match(branch, /createElement\("summary"\)/);
    assert.match(branch, /summary\.textContent\s*=\s*question/);
    assert.match(branch, /quote\.replaceWith\(details\)/);
    assert.doesNotMatch(branch, /innerHTML|outerHTML|insertAdjacentHTML|setAttribute\("style"/);
  }
});

test("adjacent FAQ groups and accessible static styles work without browser runtime", () => {
  assert.match(site, /function groupAdjacentAccordions\(container: HTMLElement\)/);
  assert.match(site, /groupAdjacentAccordions\(container\);/);
  assert.match(headless, /group\.className="paglora-accordion-group"/);
  assert.match(exporter, /\.docs \.paglora-accordion>summary:focus-visible/);
  assert.match(exporter, /\.docs \.paglora-accordion\[open\]>summary/);
  assert.match(exporter, /\.docs \.paglora-accordion-group>\.paglora-accordion/);
  assert.match(exporter, /margin-inline:18px/);
});
