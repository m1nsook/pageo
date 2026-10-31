import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("clicking a current project page title opens accessible Radix editing controls", () => {
  const ui = read("src/components/editor/inline-page-title.tsx");
  assert.match(ui, /<PopoverTrigger asChild>/);
  assert.match(ui, /<PopoverContent align="start"/);
  assert.match(ui, /aria-label=\{`Rename page/);
  assert.match(ui, /<Label htmlFor="studio-quick-page-title">Page title<\/Label>/);
  assert.match(ui, /\[\.\.\.next\]\.length > 100/);
  assert.match(ui, /await onRename\(next\)/);
});

test("inline rename flushes Markdown before modifying page manifest", () => {
  const app = read("src/App.tsx");
  assert.match(app, /async function renamePageInline\(/);
  assert.match(app, /await persist\(\);\s*await onModify\("rename", current\.page\.id, title\)/);
  assert.match(app, /<InlinePageTitle title=\{current\.page\.title\}/);
  assert.match(read("src-tauri/src/pages.rs"), /pub fn rename_page\(/);
  assert.match(read("src-tauri/src/pages.rs"), /let new_title = title\(&name\)\?/);
});
