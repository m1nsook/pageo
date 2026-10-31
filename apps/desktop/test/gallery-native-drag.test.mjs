import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const gallery = read("src/components/editor/block-component-gallery.tsx");
const palette = read("src/components/editor/block-palette.tsx");
test("Gallery drag uses exactly the same handler and source boundary as palette", () => {
  assert.match(gallery, /onBeginDrag: \(event: React\.PointerEvent<HTMLElement>, kind: BlockKind\)/);
  assert.match(gallery, /onPointerDown=\{event => onBeginDrag\(event, kind\)\}/);
  assert.match(palette, /onBeginDrag=\{start\}/);
  assert.match(palette, /onInsert=\{kind => insert\(kind, callbacks\.current\.selectedBoundary\)\}/);
  assert.match(gallery, /onDragStart=\{event => event\.preventDefault\(\)\}/);
  assert.doesNotMatch(gallery, /dataTransfer/);
});
test("Gallery remains a non-modal portal and closes only after successful drop", () => {
  assert.match(gallery, /<Dialog modal=\{false\}/);
  assert.match(gallery, /<DialogContent showOverlay=\{false\}/);
  assert.match(gallery, /paglora:component-library-dropped/);
  assert.match(palette, /new Event\("paglora:component-library-dropped"\)/);
  assert.match(gallery, /if \(!disabled && onInsert\(selected\)\) setOpen\(false\)/);
});
