import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("design canvas, public preview and live site designer share a Studio-only matte",()=>{
 const canvas=read("src/components/editor/inline-site-preview.tsx");
 const preview=read("src/components/editor/site-preview.tsx");
 const designer=read("src/components/editor/site-designer.tsx");
 const css=read("src/index.css");
 for(const src of [canvas,preview,designer]) {
   assert.match(src,/paglora-preview-stage/);
   assert.match(src,/paglora-preview-frame/);
   assert.match(src,/sandbox="allow-same-origin"/);
   assert.doesNotMatch(src,/sandbox="[^"]*allow-scripts/);
 }
 assert.match(css,/\.dark \.paglora-preview-stage/);
 assert.match(css,/\.dark \.paglora-preview-frame/);
 assert.match(canvas,/loadSiteSettings\(projectId\)/);
 assert.match(designer,/Site: \{settings\?\.themeMode/);
});
test("only editor chrome changes; static export uses separate HTML/CSS",()=>{
 const css=read("src/index.css");
 assert.ok(css.includes("ONLY to Studio's surround"));
 const page=read("src/lib/site.ts");
 assert.ok(!page.includes("paglora-preview-stage"));
 const builder=read("src-tauri/src/sites.rs");
 assert.ok(!builder.includes("paglora-preview-stage"));
});
