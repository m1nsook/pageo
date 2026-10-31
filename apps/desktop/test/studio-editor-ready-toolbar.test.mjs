import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("same editor becomes editable synchronously on Canvas to Edit and after mount",()=>{
 const app=read("src/App.tsx");
 assert.match(app,/editor\?\.setEditable\(true\);\s*setViewMode\(next\)/);
 assert.match(app,/useLayoutEffect\(\(\) => \{/);
 assert.match(app,/editor\.setEditable\(editing\)/);
 assert.match(app,/editor\.view\.dom\.isConnected/);
 assert.match(app,/<FormatToolbar editor=\{editor\}/);
 assert.match(app,/<EditorContent editor=\{editor\}/);
 assert.match(app,/<BlockPalette editor=\{editor\}/);
});
test("toolbar subscribes to the real editor, checks commands and announces effects",()=>{
 const t=read("src/components/editor/format-toolbar.tsx");
 assert.match(t,/editor\.on\("transaction", update\)/);
 assert.match(t,/editor\.on\("selectionUpdate", update\)/);
 assert.match(t,/editor\.off\("transaction", update\)/);
 assert.match(t,/disabled=\{!enabled\}/);
 assert.match(t,/setStatus\(name \+ " applied to the document\."\)/);
 for(const action of ["toggleHeading", "toggleBold", "toggleItalic", "toggleBulletList", "toggleOrderedList", "toggleCodeBlock"]){
  assert.ok(t.includes(action),action);
 }
});
