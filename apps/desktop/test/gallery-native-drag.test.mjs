import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const palette=read("src/components/editor/block-palette.tsx");
const gallery=read("src/components/editor/block-component-gallery.tsx");
test("Gallery and Palette use pointer gestures, never forbidden native browser drag",()=>{
 assert.match(palette,/beginPointerBlock\(kind, event\.pointerId/);
 assert.match(palette,/window\.addEventListener\("pointerup", release, true\)/);
 assert.match(palette,/editorDropZone\(event\.clientX, event\.clientY\)/);
 assert.match(gallery,/beginPointerBlock\(kind, event\.pointerId/);
 assert.match(gallery,/beginPointerBlock\(kind, event\.pointerId/);
 assert.doesNotMatch(gallery,/onDragStart|dataTransfer/);
 assert.doesNotMatch(palette,/onDragStart|dataTransfer/);
 assert.match(gallery,/draggable=\{false\}/);
 assert.match(palette,/draggable=\{false\}/);
});
test("component click and pointer drop share one verified editor insertion path",()=>{
 const ins=read("src/lib/block-insertion.ts");
 assert.match(ins,/state\.schema\.nodeFromJSON\(createMarkdownBlock\(kind\)\)/);
 assert.match(ins,/view\.dispatch\(transaction\)/);
 assert.match(ins,/transaction\.doc\.check\(\)/);
 assert.doesNotMatch(ins,/\.insertContentAt\(/);
 assert.match(palette,/insertBlockIntoEditor\(editor, kind, point\?\.y, reason =>/);
 assert.match(palette,/onClick=\{\(\) => click\(kind\)\}/);
 assert.match(palette,/document\.dispatchEvent\(new Event\("paglora:gallery-block-dropped"\)\)/);
});

test("the Gallery stays non-modal without changing ordinary dialog overlays", () => {
  const dialog = read("src/components/ui/dialog.tsx");
  assert.match(dialog, /showOverlay = true/);
  assert.match(dialog, /\{showOverlay && <DialogOverlay \/>\}/);
  assert.match(gallery, /<Dialog modal=\{false\}/);
  assert.match(gallery, /<DialogContent showOverlay=\{false\}/);
});
