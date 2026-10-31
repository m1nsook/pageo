import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function load(source, resolver = require) {
  const exports = {};
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", js)(resolver, exports);
  return exports;
}
const examples = load(read("src/lib/block-examples.ts"));
const append = load(read("src/lib/source-block-append.ts"),
  id => id === "@/lib/block-examples" ? examples : require(id)).appendComponentToMarkdown;
const catalog = load(read("src/components/editor/block-catalog.ts"));

test("all 20 reusable components append valid portable Markdown without altering original bytes", () => {
  assert.equal(catalog.BLOCKS.length, 20);
  const original = "# Docs\n\n\n> [!NOTE] preserve this\n> **raw syntax**\n\n<some-unsupported-tag>\n";
  for (const item of catalog.BLOCKS) {
    const result = append(original, item.kind);
    assert.ok(result.startsWith(original), item.kind);
    assert.equal(result, original + "\n" + examples.BLOCK_MARKDOWN_EXAMPLES[item.kind] + "\n", item.kind);
  }
});
test("blank and line-ending edge cases preserve source verbatim", () => {
  assert.equal(append("", "orderedList"), "1. First step\n");
  assert.equal(append("hello", "paragraph"), "hello\n\nWrite something...\n");
  assert.equal(append("hello\n", "paragraph"), "hello\n\nWrite something...\n");
  assert.equal(append("hello\n\n", "paragraph"), "hello\n\nWrite something...\n");
  assert.equal(append("hello\r\n", "paragraph"), "hello\r\n\nWrite something...\n");
  assert.throws(() => append("", "not-a-block"), /unknown documentation component/i);
});
test("the editor only uses source fallback after a failed full document check", () => {
  const insert = read("src/lib/block-insertion.ts");
  const palette = read("src/components/editor/block-palette.tsx");
  const app = read("src/App.tsx");
  assert.match(insert, /"invalidDocument"/);
  assert.match(insert, /state\.doc\.check\(\)/);
  assert.match(palette, /invalidVisualTree && onInvalidDocument\?\.\(kind\)/);
  assert.match(app, /appendComponentToMarkdown\(latest\.current, kind\)/);
  assert.match(app, /rawSourceFallbackActive\.current = true/);
  assert.match(app, /return; \/\/ Never serialize malformed Tiptap content over valid \.md/);
  assert.match(app, /void persist\(\)\.catch/);
});
