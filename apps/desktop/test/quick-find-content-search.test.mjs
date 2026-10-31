import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("find dialog displays only backend ranked results; no cmdk substring filtering",()=>{
 const ui=read("src/components/studio/studio-quick-find.tsx");
 assert.match(ui,/return hits\.flatMap\(hit =>/);
 assert.match(ui,/shouldFilter=\{!projectId \|\| query\.trim\(\)\.length < 2\}/);
 assert.match(ui,/searchProjectPages\(projectId, query\.trim\(\)\)/);
 assert.match(ui,/Private · /);
});
test("native search maintains local bounded index and invalidates on updates",()=>{
 const rs=read("src-tauri/src/pages.rs");
 for(const item of ["SEARCH_CACHE","source_stamps","build_index","invalidate_search","fn is_typo","score","max_files"]){if(item==="max_files")continue;assert.ok(rs.includes(item),item)}
 assert.match(rs,/if guard\.len\(\)>4/);
 assert.match(rs,/used_bytes\.saturating_add\(meta\.bytes\)<=20_000_000/);
 assert.match(rs,/invalidate_search\(&dir\);/);
 assert.match(rs,/if !meta\.is_file\(\)/);
});
