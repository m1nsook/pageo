import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const catalog=read("src/components/editor/block-catalog.ts");
const kinds=[...catalog.matchAll(/\{ kind: "([a-zA-Z0-9]+)", title:/g)].map(x=>x[1]);
assert.ok(kinds.length>=18);
const source=read("src/lib/block-drag.ts").replace(
 'import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";',
 'const BLOCKS = globalThis.__dragTestBlocks;');
globalThis.__dragTestBlocks=kinds.map(kind=>({kind}));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const drag=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
test("pointer movement only inserts after a real gesture and correct pointer release",()=>{
 assert.equal(drag.beginPointerBlock("note",12,100,100),true);
 assert.equal(drag.updatePointerBlock(21,250,100),null);
 assert.equal(drag.updatePointerBlock(12,103,100).moved,false);
 assert.equal(drag.finishPointerBlock(12,103,100).moved,false);
 assert.equal(drag.beginPointerBlock("card",4,10,10),true);
 assert.equal(drag.updatePointerBlock(4,30,30).moved,true);
 const completed=drag.finishPointerBlock(4,40,40);
 assert.equal(completed.kind,"card");
 assert.equal(completed.moved,true);
 assert.equal(drag.activePointerBlock(),null);
});
test("only one Paglora-owned gesture, no unknown blocks or forged second pointer",()=>{
 assert.equal(drag.beginPointerBlock("unknown",1,0,0),false);
 assert.equal(drag.beginPointerBlock("warning",1,5,5),true);
 assert.equal(drag.beginPointerBlock("card",2,5,5),false);
 assert.equal(drag.finishPointerBlock(2,20,20),null);
 assert.equal(drag.activePointerBlock().kind,"warning");
 drag.cancelPointerBlock(1);
 assert.equal(drag.activePointerBlock(),null);
});
test("pointer capture and explicit editor-only drop area replace WebView2 native drag",()=>{
 const ui=read("src/components/editor/block-palette.tsx");
 assert.match(ui,/\.setPointerCapture\(event\.pointerId\)/);
 assert.match(ui,/event\.clientX, event\.clientY/);
 assert.match(ui,/if \(editorDropZone\(x, y\) &&/);
 assert.match(ui,/clearDropHighlight\(\)/);
 assert.match(ui,/window\.addEventListener\("pointercancel", cancel, true\)/);
});
