import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marked } from "marked";

const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/components/editor/block-catalog.ts", import.meta.url), "utf8");
const exporter = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");

test("Markdown parser preserves fenced code blocks inside a CODEGROUP quote", async () => {
  const source = [
    "> [!CODEGROUP] Install", ">",
    "> ```bash", "> bun install", "> ```", ">",
    "> ```powershell", "> bun install", "> ```",
  ].join("\n");
  const html = await marked.parse(source);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<p>\[!CODEGROUP\] Install<\/p>/);
  assert.match(html, /<code class="language-bash">/);
  assert.match(html, /<code class="language-powershell">/);
  assert.equal((html.match(/<pre>/g) || []).length, 2);
});

test("Studio inserts a round-trippable CODEGROUP with two fenced examples", () => {
  assert.match(catalog, /kind: "codeGroup", title: "Code group"/);
  assert.match(catalog, /case "codeGroup": return \{\s*type: "blockquote"/);
  assert.match(catalog, /paragraph\("\[!CODEGROUP\] Install"\)/);
  assert.match(catalog, /attrs: \{ language: "bash" \}/);
  assert.match(catalog, /attrs: \{ language: "powershell" \}/);
});

test("code groups are constructed after sanitization in both preview and export", () => {
  assert.match(site, /container\.innerHTML = renderSafeMarkdown\(markdownHtml\);\s*enhanceCallouts\(container, language\)/);
  assert.match(site, /WARNING\|CAUTION\|CARD\|STEPS\|CODEGROUP/);
  assert.match(site, /if \(type === "CODEGROUP"\)/);
  assert.match(site, /blocks\.length < 2 \|\| blocks\.length > 12/);
  assert.match(site, /child\.tagName !== "PRE" \|\| child\.firstElementChild\?\.tagName !== "CODE"/);
  assert.match(site, /next\.setAttribute\("class", codeClass\.toLowerCase\(\)\)/);
  assert.match(site, /\^language-\[a-z\]/);
  const transform = site.split('if (type === "CODEGROUP")')[1].split('const callout =')[0];
  assert.doesNotMatch(transform, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.match(transform, /caption\.textContent = label/);
  assert.match(transform, /quote\.replaceWith\(group\)/);
});

test("CSS provides readable script-free fallback and keyboard-visible tabs", () => {
  assert.match(exporter, /\.docs \.paglora-code-group-label\{/);
  assert.match(exporter, /\.docs \.paglora-code-group-tabs>button:focus-visible/);
  assert.match(exporter, /\.docs \.paglora-code-group-enhanced \.paglora-code-group-item\[hidden\]/);
  assert.match(exporter, /\.docs \.paglora-code-group-item>pre\{margin:0/);
});
