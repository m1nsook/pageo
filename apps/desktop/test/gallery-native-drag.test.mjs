import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("only the Gallery dialog becomes non-modal, preserving other native dialog overlays",()=>{
 const dialog=read("src/components/ui/dialog.tsx"),gallery=read("src/components/editor/block-component-gallery.tsx");
 assert.match(dialog,/showOverlay = true/);
 assert.match(dialog,/\{showOverlay && <DialogOverlay \/>\}/);
 assert.match(gallery,/<Dialog modal=\{false\}/);
 assert.match(gallery,/<DialogContent showOverlay=\{false\}/);
 assert.match(gallery,/aria-label=\{\`Drag \$\{item\.title\} example into the editor\`\}/);
});
test("gallery drag uses a closed native payload and editor-only destination validation",()=>{
 const gallery=read("src/components/editor/block-component-gallery.tsx");
 const palette=read("src/components/editor/block-palette.tsx");
 assert.match(gallery,/dataTransfer\.setData\("application\/x-paglora-block", kind\)/);
 assert.match(gallery,/effectAllowed = "copy"/);
 assert.match(gallery,/onDragStart=\{event => dragExample\(event,kind\)\}/);
 assert.match(palette,/closest\("\[data-editor-drop-zone\]"\)/);
 assert.match(palette,/BLOCKS\.some\(block => block\.kind === kind\)/);
 assert.match(palette,/insert\(kind as BlockKind, \{ y: event\.clientY \}\)/);
 assert.match(palette,/new Event\("paglora:gallery-block-dropped"\)/);
 assert.match(gallery,/setOpen\(false\)/);
});
test("source insertion reuses undoable Tiptap pipeline without an HTML parser",()=>{
 const palette=read("src/components/editor/block-palette.tsx");
 assert.match(palette,/createMarkdownBlock\(kind\)/);
 assert.match(palette,/insertContentAt\(topLevelDropPos\(editor, point\.y\), node\)/);
 assert.doesNotMatch(palette,/innerHTML|DOMParser/);
});
