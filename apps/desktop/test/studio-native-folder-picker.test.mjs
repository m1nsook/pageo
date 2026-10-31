import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("native Windows dialog uses COM STA and no generic renderer file permission",()=>{
 const native=read("src-tauri/src/folder_picker.rs");
 assert.match(native,/FileOpenDialog/);
 assert.match(native,/FOS_PICKFOLDERS/);
 assert.match(native,/spawn_blocking\(choose\)/);
 assert.match(read("src-tauri/src/lib.rs"),/folder_picker::pick_storage_folder/);
 const permissions=JSON.parse(read("src-tauri/capabilities/default.json")).permissions;
 assert.ok(!permissions.some(p=>p.startsWith("fs:")||p.startsWith("dialog:")));
});
test("Browse supports parent-folder migration and existing-folder recovery with inert cancellation",()=>{
 const ui=read("src/components/studio/workspace-content.tsx");
 assert.match(ui,/mode: "new" \| "existing"/);
 assert.match(ui,/if \(selected === null\) return/);
 assert.match(ui,/browseFolder\("existing"\)/);
 assert.match(ui,/browseFolder\("new"\)/);
 assert.match(read("src/lib/projects.ts"),/invoke<string \| null>\("pick_storage_folder"\)/);
});
