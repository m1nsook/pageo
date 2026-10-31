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
 assert.match(app,/<BlockPalette disabled=\{leaving \|\| switchingView \|\| componentMode !== "compose"\}/);
 assert.match(app,/const editing = viewMode !== "site" && componentMode === "write"/);
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
test("Canvas and Edit keep a single connected editor while changing active views",()=>{
 const app=read("src/App.tsx");
 const split=read("src/components/editor/studio-resizable-split.tsx");
 const outer=read("src/components/editor/studio-navigation-layout.tsx");
 assert.match(app,/center=\{<StudioResizableSplit source=\{editorPane\} preview=\{viewMode === "edit" \? null : previewPane\}/);
 assert.match(app,/mode=\{viewMode\} resetToken=\{splitResetToken\}/);
 assert.match(split,/mode: "edit" \| "split" \| "site"/);
 assert.match(split,/aria-hidden=\{mode === "site"\}/);
 assert.match(split,/aria-hidden=\{mode === "edit"\}/);
 assert.match(split,/mode === "split" \? "flex min-h-0/);
 assert.match(outer,/const key = \`\$\{Boolean\(left\)\}-\$\{Boolean\(right\)\}\`/);
 assert.match(outer,/const persistenceKey = \`\$\{mode\}-\$\{key\}\`/);
});

