import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("workspace exposes truthful loading state and prevents duplicate imports/exports",()=>{
 const app=read("src/App.tsx"),ui=read("src/components/studio/workspace-content.tsx");
 for(const key of ["openingRef.current","backupRef.current","setBackupBusy(\"import\")","setBackupBusy(\"export\")","setOpeningProjectId(id)"]) assert.ok(app.includes(key));
 assert.match(app,/finally \{ backupRef\.current = false; setBackupBusy\(null\); setBackupProjectId\(null\); \}/);
 assert.match(app,/finally \{ openingRef\.current = false; setOpeningProjectId\(null\); \}/);
 assert.match(ui,/aria-busy=\{Boolean\(operation\)\}/);
 assert.match(ui,/aria-live="polite"/);
 assert.match(ui,/Importing and verifying project backup/);
 assert.match(ui,/Creating and verifying portable project backup/);
 assert.match(ui,/disabled=\{Boolean\(backupBusy\) \|\| Boolean\(openingProjectId\)\}/);
});
test("existing backup validation and local refresh are still authoritative",()=>{
 const app=read("src/App.tsx");
 assert.match(app,/file\.name\.toLowerCase\(\)\.endsWith\("\.paglora"\)/);
 assert.match(app,/file\.size > 96 \* 1024 \* 1024/);
 assert.match(app,/const id = await importProjectBackup\(archive\)/);
 assert.match(app,/await refresh\(\)/);
 assert.match(app,/const path = await exportProjectBackup\(id\)/);
});
