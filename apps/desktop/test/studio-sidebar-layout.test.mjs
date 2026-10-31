import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {test} from "node:test";const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("outer layout is independent from existing source/canvas split",()=>{
 const app=read("src/App.tsx");assert.match(app,/<StudioNavigationLayout mode=\{viewMode\}/);assert.match(app,/<StudioResizableSplit source=\{editorPane\}/);
 const src=read("src/components/editor/studio-navigation-layout.tsx");assert.match(src,/onLayoutChanged=/);assert.match(src,/Resize page navigation/);assert.match(src,/Resize page properties or tools/);
});
test("navigation and inspector fill resizable widths and reject corrupt preference",()=>{
 for(const p of ["page-navigation","page-inspector","block-palette"]){const s=read("src/components/editor/"+p+".tsx");assert.match(s,/h-full w-full min-w-0/);}
 const s=read("src/components/editor/studio-navigation-layout.tsx");assert.match(s,/Number\.isFinite/);assert.match(s,/Math\.abs/);assert.match(s,/localStorage\.setItem/);
});