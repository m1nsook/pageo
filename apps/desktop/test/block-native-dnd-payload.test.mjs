import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const catalog=read("src/components/editor/block-catalog.ts");
const kinds=[...catalog.matchAll(/\{ kind: "([a-zA-Z0-9]+)", title:/g)].map(x=>x[1]);
assert.ok(kinds.length>15);
const source=read("src/lib/block-drag.ts")
  .replace('import { BLOCKS, type BlockKind } from "@/components/editor/block-catalog";',
    'const BLOCKS = globalThis.__dragTestBlocks;');
globalThis.__dragTestBlocks=kinds.map(kind=>({kind}));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const d=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
function data(){
 const items=new Map();
 return {types:[],effectAllowed:"all",setData(type,value){items.set(type,value);this.types=[...items.keys()];},
 getData(type){return items.get(type)??"";}};
}
test("native palette/gallery drop accepts only the active known block",()=>{
 const a=data();
 assert.equal(d.beginBlockDrag(a,"note"),true);
 assert.equal(a.effectAllowed,"copy");
 assert.equal(d.canAcceptBlockDrag(a),true);
 assert.equal(d.readBlockDrop(a),"note");
 d.finishBlockDrag();
 assert.equal(d.canAcceptBlockDrag(a),false);
 assert.equal(d.readBlockDrop(a),null);
});
test("external links, files, arbitrary text and another block cannot forge a drop",()=>{
 const external=data();external.setData("text/plain","note");
 assert.equal(d.canAcceptBlockDrag(external),false);
 assert.equal(d.readBlockDrop(external),null);
 const active=data();d.beginBlockDrag(active,"warning");
 const forged=data();forged.setData("text/plain","paglora:block:card");
 assert.equal(d.readBlockDrop(forged),null);
 const fallback=data();fallback.setData("text/plain","paglora:block:warning");
 assert.equal(d.canAcceptBlockDrag(fallback),true);
 assert.equal(d.readBlockDrop(fallback),"warning");
 d.finishBlockDrag();
});
test("unknown block names are rejected before an OS drag begins",()=>{
 const a=data();
 assert.equal(d.beginBlockDrag(a,"made-up"),false);
 assert.equal(d.canAcceptBlockDrag(a),false);
});
test("dragstart, drop and dragend route to native editor and clean all state",()=>{
 const palette=read("src/components/editor/block-palette.tsx"),gallery=read("src/components/editor/block-component-gallery.tsx");
 assert.match(palette,/onDragStart=\{\(event\) => dragStart\(event,kind\)\}/);
 assert.match(palette,/onDragEnd=\{dragEnd\}/);
 assert.match(palette,/document\.addEventListener\("dragover",over,true\)/);
 assert.match(palette,/document\.addEventListener\("drop",drop,true\)/);
 assert.match(palette,/finishBlockDrag\(\)/);
 assert.match(gallery,/onDragEnd=\{finishBlockDrag\}/);
});
