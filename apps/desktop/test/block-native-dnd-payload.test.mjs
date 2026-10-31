import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const palette = read("src/components/editor/block-palette.tsx");
test("one source-backed drag controller handles pointer and mouse events", () => {
  assert.match(palette, /function hitTest\(x: number, y: number\)/);
  assert.match(palette, /function movement\(id: number, x: number, y: number\)/);
  assert.match(palette, /function finish\(id: number, x: number, y: number\)/);
  assert.match(palette, /window\.addEventListener\("pointerup", pointerUp, true\)/);
  assert.match(palette, /window\.addEventListener\("mouseup", mouseUp, true\)/);
  assert.match(palette, /window\.addEventListener\("blur", cancel\)/);
  assert.match(palette, /callbacks\.current\.onInsert\(kind, boundary\)/);
});
test("dragging uses no native HTML5 payload or invalid ProseMirror coordinates", () => {
  assert.match(palette, /onDragStart=\{event => event\.preventDefault\(\)\}/);
  assert.match(palette, /data-component-drop-canvas/);
  assert.match(palette, /data-component-block-index/);
  assert.doesNotMatch(palette, /dataTransfer|prosemirror|insertContentAt/);
  assert.match(palette, /pointer-events-none fixed z-\[9999\]/);
});
