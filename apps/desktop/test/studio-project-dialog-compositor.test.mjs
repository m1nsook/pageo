import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("compositor mitigation is enabled only while a project editor exists",()=>{
 const app=read("src/App.tsx"),css=read("src/index.css");
 assert.match(app,/<main data-paglora-project-root /);
 assert.match(css,/:root:has\(\[data-paglora-project-root\]\)/);
 assert.match(css,/\[data-slot="dialog-overlay"\]/);
 assert.match(css,/\[data-slot="alert-dialog-overlay"\]/);
 assert.match(css,/\[data-slot="sheet-overlay"\]/);
 assert.match(css,/\[data-slot="drawer-overlay"\]/);
 assert.match(css,/backdrop-filter: none !important/);
 assert.match(css,/animation: none !important/);
});
test("document and portal background are not transparent or browser-default white",()=>{
 const css=read("src/index.css");
 assert.match(css,/:root\s*\{\s*background-color: var\(--background\)/);
 assert.match(css,/:root\.dark\s*\{/);
 assert.match(css,/:root:has\(\[data-paglora-project-root\]\) body/);
 assert.match(css,/:root:has\(\[data-paglora-project-root\]\) #root/);
 assert.match(css,/background-color: var\(--studio-surface-1\)/);
 const tauri=JSON.parse(read("src-tauri/tauri.conf.json"));
 assert.equal(tauri.app.windows[0].transparent ?? false,false);
 assert.equal(tauri.app.windows[0].backgroundColor,"#141418");
});
test("dialog remains modal and correctly centered and no iframe site styles are changed",()=>{
 const dialog=read("src/components/ui/dialog.tsx");
 assert.match(dialog,/DialogPrimitive\.Root/);
 assert.match(dialog,/DialogPrimitive\.Overlay/);
 assert.match(dialog,/DialogPrimitive\.Content/);
 assert.match(dialog,/-translate-x-1\/2 -translate-y-1\/2/);
 const css=read("src/index.css");
 assert.doesNotMatch(css,/iframe\s*\{/);
 const site=read("src-tauri/src/sites.rs");
 assert.ok(!site.includes("data-paglora-project-root"));
});
