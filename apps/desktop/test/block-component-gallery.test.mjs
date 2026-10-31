import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { marked } from "marked";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const output = ts.transpileModule(read("src/lib/block-examples.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { BLOCK_MARKDOWN_EXAMPLES: examples } =
  await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));

test("component library has a portable Markdown example for every offered block", () => {
  const catalog = read("src/components/editor/block-catalog.ts");
  const offered = [...catalog.matchAll(/kind: "([a-zA-Z0-9]+)", title:/g)].map(x => x[1]);
  assert.equal(offered.length, 20);
  assert.deepEqual(Object.keys(examples).sort(), offered.sort());
  for (const [name, markdown] of Object.entries(examples)) {
    assert.equal(typeof markdown, "string", name);
    assert.ok(markdown.trim().length > 2, name);
    assert.ok(marked.lexer(markdown).length >= 1, name);
  }
});

test("special documentation blocks use Paglora's existing portable callout markers", () => {
  for (const [kind, marker] of [
    ["card", "[!CARD]"], ["steps", "[!STEPS]"], ["accordion", "[!ACCORDION]"],
    ["tabs", "[!TABS]"], ["codeGroup", "[!CODEGROUP]"], ["badges", "[!BADGES]"],
    ["note", "[!NOTE]"], ["tip", "[!TIP]"], ["important", "[!IMPORTANT]"],
    ["warning", "[!WARNING]"], ["caution", "[!CAUTION]"],
  ]) {
    assert.ok(examples[kind].includes(marker), `${kind} must round-trip as Paglora Markdown`);
  }
  assert.match(examples.tabs, /\[!TAB\]/);
});

test("gallery renders through the shared safe site renderer, with a scriptless iframe", () => {
  const gallery = read("src/components/editor/block-component-gallery.tsx");
  assert.match(gallery, /renderPageContent\(html, "en"\)/);
  assert.match(gallery, /<iframe/);
  assert.match(gallery, /sandbox=""/);
  assert.match(gallery, /default-src 'none'/);
  assert.match(gallery, /onInsert\(selected\)/);
  assert.match(gallery, /navigator\.clipboard\.writeText\(example\)/);
  assert.match(read("src/lib/site.ts"), /export function renderPageContent\(/);
  assert.match(read("src/components/editor/block-palette.tsx"), /<BlockComponentGallery/);
});
