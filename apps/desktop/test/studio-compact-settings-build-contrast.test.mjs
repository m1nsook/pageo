import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("storage path is visible but migration/reconnect form is collapsed when online",()=>{
 const s=read("src/components/studio/workspace-content.tsx");
 assert.match(s,/defaultValue=\{storageStatus\?\.available \? undefined : "advanced"\}/);
 assert.match(s,/key=\{storageStatus\?\.available \? "online" : "offline"\}/);
 assert.match(s,/AccordionTrigger className="py-2 text-sm hover:no-underline" disabled=\{storageMigrating\}/);
 assert.match(s,/aria-busy=\{storageMigrating\}/);
 assert.match(s,/onReconnectStorage\(recoverPath\.trim\(\), recoverConfirmation\)/);
 assert.match(s,/onReturnStorage\(returnConfirmation\)/);
 assert.match(s,/onMigrateStorage\(storageDestination\.trim\(\)\)/);
});
test("publishing status and warnings are readable in dark studio too",()=>{
 const s=read("src/components/editor/site-builder.tsx");
 for(const className of ["dark:bg-emerald-400/10","dark:text-emerald-100","dark:bg-background/60","dark:border-amber-400/25","dark:text-amber-100"])assert.ok(s.includes(className));
});
