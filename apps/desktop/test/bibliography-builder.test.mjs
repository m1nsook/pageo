import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { marked } from "marked";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const inline = ts.transpileModule(read("src/lib/inline-citation.ts"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
globalThis.__bibliographyCitation = (await import("data:text/javascript;base64," + Buffer.from(inline).toString("base64"))).formatInlineCitation;
const raw = read("src/lib/bibliography.ts").replace('import { formatInlineCitation } from "./inline-citation";', 'const formatInlineCitation = globalThis.__bibliographyCitation;');
const result = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { formatBibliography } = await import("data:text/javascript;base64," + Buffer.from(result).toString("base64"));
const a = { author: "Org B", title: "Example", url: "https://example.com/docs", year: "2026", accessed: "2026-10-31" };
const b = { author: "Org A", title: "Another", url: "https://example.com/another", year: "2024", accessed: "" };
test("basic web bibliography remains portable and rendered as semantic Markdown", () => {
  for (const style of ["apa", "mla", "chicago"]) {
    const markdown = formatBibliography([a, b], style);
    const blocks = marked.lexer(markdown);
    assert.equal(blocks[0].type, "heading");
    assert.equal(blocks[1].type, "list");
    assert.equal(blocks[1].items.length, 2);
    assert.match(markdown, /\[Example\]\(https:\/\/example.com\/docs "Accessed 2026-10-31"\)/);
  }
  assert.ok(formatBibliography([a, b], "apa").indexOf("Org A") < formatBibliography([a, b], "apa").indexOf("Org B"));
});
test("reject invalid years, injection, non-HTTPS, excessive sources and styles", () => {
  assert.throws(() => formatBibliography([{ ...a, url: "javascript:alert(1)" }], "apa"));
  assert.throws(() => formatBibliography([{ ...a, author: "<script>" }], "apa"));
  assert.throws(() => formatBibliography([{ ...a, year: "NOW" }], "mla"));
  assert.throws(() => formatBibliography([{ ...a, accessed: "yesterday" }], "chicago"));
  assert.throws(() => formatBibliography(Array(31).fill(a), "apa"));
  assert.throws(() => formatBibliography([a], "wrong"));
});
test("toolbar uses Tiptap Markdown insertion and keeps references editable", () => {
  const source = read("src/components/editor/bibliography-popover.tsx");
  assert.match(source, /insertContent\(markdown, \{ contentType: "markdown" \}\)/);
  assert.match(source, /formatBibliography\(entries, style\)/);
  assert.match(read("src/components/editor/format-toolbar.tsx"), /<BibliographyPopover editor=\{editor\}/);
});
