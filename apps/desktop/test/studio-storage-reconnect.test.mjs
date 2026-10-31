import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("an offline custom drive never silently selects an empty workspace",()=>{
 const native=read("src-tauri/src/storage.rs");
 for(const name of ["project_storage_status","reconnect_project_storage","status_at","reconnect_at","validate_project_folders","safe_tree"]) assert.ok(native.includes(name),name);
 assert.match(native,/!status\.is_custom \|\| status\.available/);
 assert.match(native,/confirmation!="RECONNECT"/);
 assert.match(native,/An empty folder is not an existing Paglora workspace/);
 assert.match(native,/project-storage\.pre-reconnect-/);
});
test("Settings exposes a guarded existing-folder recovery only when custom storage is unavailable",()=>{
 const ui=read("src/components/studio/workspace-content.tsx");
 assert.match(ui,/storageStatus\?\.isCustom && !storageStatus\.available/);
 assert.match(ui,/studio\.storage\.retry/);
 assert.match(ui,/recoverConfirmation !== "RECONNECT"/);
 assert.match(ui,/onReconnectStorage\(recoverPath\.trim\(\), recoverConfirmation\)/);
 assert.match(read("src/App.tsx"),/await inspectStorage\(\)/);
});
