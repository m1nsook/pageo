import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("library dialog overrides the small shadcn modal cap at desktop widths", () => {
  const dialog = read("src/components/ui/dialog.tsx");
  assert.match(dialog, /sm:max-w-sm/);
  const library = read("src/components/editor/block-component-gallery.tsx");
  assert.match(library, /sm:max-w-\[min\(96vw,980px\)\]/);
  assert.match(library, /sm:grid-cols-\[240px_minmax\(0,1fr\)\]/);
  assert.match(library, /w-\[calc\(100vw-2rem\)\]/);
  assert.match(library, /min-w-0 w-full rounded-md border/);
});
test("responsive component gallery still provides preview and source, copy and insert", () => {
  const library = read("src/components/editor/block-component-gallery.tsx");
  assert.match(library, /<TabsTrigger value="preview">Preview<\/TabsTrigger>/);
  assert.match(library, /<TabsTrigger value="markdown">Markdown<\/TabsTrigger>/);
  assert.match(library, /sandbox=""/);
  assert.match(library, /onInsert\(selected\)/);
  assert.match(library, /writeText\(example\)/);
});
