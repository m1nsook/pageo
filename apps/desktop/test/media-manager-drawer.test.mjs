import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("local media uses an accessible right drawer with full-width browser", () => {
  const ui = read("src/components/editor/asset-library.tsx");
  assert.match(ui, /<Drawer direction="right"/);
  assert.match(ui, /<DrawerContent className="h-dvh/);
  assert.match(ui, /<DrawerClose asChild>/);
  assert.match(ui, /aria-label="Close media manager"/);
  assert.match(ui, /aria-label="Project images"/);
  assert.doesNotMatch(ui, /<DialogContent/);
});

test("drawer preserves bounded importing, lazy previews and safe Markdown insertion", () => {
  const ui = read("src/components/editor/asset-library.tsx");
  assert.match(ui, /5 \* 1024 \* 1024/);
  assert.match(ui, /asset\.bytes <= INLINE_THUMBNAIL_LIMIT/);
  assert.match(ui, /filterSiteAssets\(assets, query\)/);
  assert.match(ui, /defaultImageAlt\(url\)/);
  assert.match(ui, /imageMarkdown\(alt\.trim\(\), selected\)/);
  assert.match(ui, /onInsertImage\(selected, alt\.trim\(\)\)/);
  assert.match(ui, /generation\.current/);
});
