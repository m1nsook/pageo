import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("storage return is only possible through a typed, validated, current-file copy",()=>{
 const rust=read("src-tauri/src/storage.rs");
 assert.match(rust,/fn return_to_previous_at/);
 assert.match(rust,/confirmation!="RETURN"/);
 assert.match(rust,/migrate_at\(data_dir,&new_folder\)/);
 assert.match(rust,/remember_root\(data_dir, &source\)/);
 assert.match(rust,/let current=root_at\(data_dir\)\?/);
 assert.match(read("src-tauri/src/lib.rs"),/storage::return_to_previous_storage/);
});
test("return is only shown when previous storage exists and requires confirmation",()=>{
 const ui=read("src/components/studio/workspace-content.tsx");
 assert.match(ui,/storageStatus\?\.available && storageStatus\.previousLocation/);
 assert.match(ui,/returnConfirmation !== "RETURN"/);
 assert.match(ui,/onReturnStorage\(returnConfirmation\)/);
 assert.match(read("src/App.tsx"),/returnToPreviousStorage\(confirmation\)/);
});
