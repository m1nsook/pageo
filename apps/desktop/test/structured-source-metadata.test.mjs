import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Page Source metadata stays read-only JSON while exposing a typed, safe form",()=>{
 const s=read("src/components/editor/theme-source-editor.tsx");
 assert.match(s,/readOnly = file === "pages\.json" \|\| file === "site\.json"/);
 assert.match(s,/readOnly=\{readOnly\}/);
 assert.match(s,/StructuredMetadataEditor/);
 assert.match(s,/onPageMetadataSaved/);
 assert.match(s,/pages: await listPages\(projectId\)/);
 assert.match(read("src/components/editor/structured-metadata-editor.tsx"),/data-structured-metadata/);
 assert.match(read("src/components/editor/structured-metadata-editor.tsx"),/draftPage\.id==="index" && !draftPage\.isPublic/);
});
test("native metadata commit updates one manifest with all validation before write",()=>{
 const r=read("src-tauri/src/pages.rs");
 assert.match(r,/fn update_page_metadata_at/);
 assert.match(r,/let new_title=title\(new_title\)\?/);
 assert.match(r,/if !valid_layout\(layout\)/);
 assert.match(r,/if !valid_navigation_group\(group\)/);
 assert.match(r,/page_id==HOME && !is_public/);
 assert.match(r,/save_pages\(dir,&manifest\)/);
 assert.match(r,/structured_metadata_updates_are_atomic_and_keep_page_privacy_guards/);
 assert.match(read("src-tauri/src/lib.rs"),/pages::update_page_metadata/);
});
test("public metadata edit uses the existing validated Tauri APIs and live project UI",()=>{
 const form=read("src/components/editor/structured-metadata-editor.tsx");
 assert.match(form,/await onBeforeSave\(\)/);
 assert.match(form,/await updatePageMetadata\(projectId,draftPage\)/);
 assert.match(form,/await onPageSaved\(updated\)/);
 assert.match(form,/await saveSiteSettings\(projectId,\{/);
 assert.match(form,/await onSiteSaved\(\)/);
 assert.match(read("src/App.tsx"),/onPageMetadataSaved=\{updated =>/);
 assert.match(read("src/lib/pages.ts"),/invoke<Page>\("update_page_metadata"/);
});
