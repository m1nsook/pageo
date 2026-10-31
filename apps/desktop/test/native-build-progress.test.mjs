import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("native progress is emitted only after completed validated export operations",()=>{
 const r=read("src-tauri/src/sites.rs");
 for(const token of ['report("checking",count+1,rendered.len())','report("assets",count+1,image_names.len())','report("indexing",1,1)','report("html",count+1,public_pages.len())','report("installing",0,0)','report("native-complete",1,1)']) assert.ok(r.includes(token),token);
 assert.match(r,/build_site_from_disk_progress\(dir,project_name,target,rendered,&mut \|_,_,_\| \{\}\)/);
 assert.match(r,/app\.emit\("paglora:build-progress"/);
 assert.match(r,/fs::rename\(&staged, &target\)/);
});
test("frontend subscribes before Rust invocation and removes listener after failure or success",()=>{
 const src=read("src/lib/site.ts");
 assert.match(src,/await listen<NativeBuildProgress>\("paglora:build-progress"/);
 assert.ok(src.indexOf('await listen<NativeBuildProgress>')<src.indexOf('await invoke<SiteBuildResult>("build_site"'));
 assert.match(src,/if \(next\.projectId !== projectId/);
 assert.match(src,/unsubscribe\?\.\(\)/);
 assert.match(src,/stage: "exporting", completed: 0, total: 0/);
});
test("build dialog shows real stage counts and indeterminate atomic install",()=>{
 const s=read("src/components/editor/site-builder.tsx");
 assert.match(s,/buildPhase === "assets"/);
 assert.match(s,/buildPhase === "html"/);
 assert.match(s,/buildPhase === "installing"/);
 assert.match(s,/pageProgress\.completed \/ pageProgress\.total/);
 assert.match(s,/Atomic install stays indeterminate/);
});
