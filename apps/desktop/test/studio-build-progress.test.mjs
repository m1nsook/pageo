import assert from "node:assert/strict";import { readFileSync } from "node:fs";import { test } from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("publication progress is based on completed operations, not timers",()=>{
 const src=read("src/lib/site.ts");assert.match(src,/stage: "loading"/);assert.match(src,/stage: "rendering"/);assert.match(src,/completed: rendered\.length/);assert.match(src,/stage: "exporting"/);assert.match(src,/await invoke<SiteBuildResult>\("build_site"/);assert.match(src,/stage: "complete"/);assert.doesNotMatch(src,/setInterval|setTimeout/);
});
test("publishing UI uses measured Markdown page count and a nonpercent Rust stage",()=>{
 const src=read("src/components/editor/site-builder.tsx");
 assert.match(src,/buildPublicSite\(projectId, progress =>/);assert.match(src,/pageProgress\.completed \/ pageProgress\.total/);assert.match(src,/Native export in progress/);assert.match(src,/Skeleton className/);assert.match(src,/role="status"/);
});