import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("canvas attaches anchored popover only for uniquely source-mapped plain text",()=>{
 const canvas=read("src/components/editor/inline-site-preview.tsx");
 assert.match(canvas,/data-canvas-artboard/);
 assert.match(canvas,/canInlineRef\.current\(selected\)/);
 assert.match(canvas,/element\.childNodes\.length === 1/);
 assert.match(canvas,/setTextAnchor\(\{/);
 assert.match(canvas,/<CanvasTextPopover/);
 assert.match(canvas,/onCommit=\{commitText\}/);
});
test("draft preview never overwrites Markdown and Cancel restores original iframe text",()=>{
 const canvas=read("src/components/editor/inline-site-preview.tsx");
 const popover=read("src/components/editor/canvas-text-popover.tsx");
 assert.match(canvas,/preview\.node\.textContent = preview\.source/);
 assert.match(canvas,/entry\.node\.textContent = next/);
 assert.match(canvas,/const applied = applyInlineRef\.current\(selection, next\)/);
 assert.match(popover,/onDraft\(event\.target\.value\)/);
 assert.match(popover,/onDismiss\(\)/);
 assert.match(popover,/if \(!onCommit\(target\.selection, draft\)\)/);
 assert.match(popover,/onCompositionStart/);
 assert.match(read("src/lib/canvas-blocks.ts"),/findCanvasSourcePosition/);
});
test("sandbox remains script-disabled and original double-click edit is preserved",()=>{
 const canvas=read("src/components/editor/inline-site-preview.tsx");
 assert.match(canvas,/doc\.addEventListener\("dblclick"/);
 assert.match(canvas,/beginInlineText\(source\.block/);
 assert.match(canvas,/sandbox="allow-same-origin"/);
 assert.doesNotMatch(canvas,/sandbox="[^"]*allow-scripts/);
});
