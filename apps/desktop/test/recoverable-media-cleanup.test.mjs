import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("asset cleanup is a verified Rust recheck with user confirmation and recoverability",()=>{
 const rust=read("src-tauri/src/sites.rs");
 for(const token of ["read_candidate_sources","unused_candidates_at","move_unused_at","restore_image_at","recoverable_assets_at","confirmation!=name","candidate.fingerprint","fs::rename(source,target)"])assert.ok(rust.includes(token),token);
 assert.match(rust,/read_pages\(project\)/);
 assert.match(rust,/crate::source::portable_theme_files\(project\)/);
 assert.match(rust,/MAX_ASSET_SOURCE_AUDIT/);
 assert.match(rust,/source\.contains\(name\)/);
 assert.doesNotMatch(rust,/fs::remove_file\(source\)/);
 const native=read("src-tauri/src/lib.rs");
 for(const command of ["review_unused_site_assets","move_unused_site_asset","list_recoverable_site_assets","restore_site_asset"])assert.ok(native.includes(command));
});
test("media drawer flushes unsaved Markdown, only moves individually confirmed candidates, supports restore",()=>{
 const ui=read("src/components/editor/asset-library.tsx");
 assert.match(ui,/await onBeforeCleanup\(\)/);
 assert.match(ui,/await reviewUnusedSiteAssets\(projectId\)/);
 assert.match(ui,/typedFilename!==item\.url\.slice\(7\)/);
 assert.match(ui,/moveUnusedSiteAsset\(projectId,item\.url,item\.fingerprint,typedFilename\)/);
 assert.match(ui,/restoreSiteAsset\(projectId,url\)/);
 assert.match(ui,/Recoverable image cleanup/);
 assert.match(ui,/Move to recovery/);
 assert.match(read("src/App.tsx"),/onBeforeCleanup=\{persist\}/);
});
test("recoverable images are part of the portable backup archive",()=>{
 const backup=read("src-tauri/src/backup.rs");
 assert.match(backup,/"docs", "assets", "removed-assets"/);
 assert.match(backup,/name\.strip_prefix\("removed-assets\/"\)/);
});
