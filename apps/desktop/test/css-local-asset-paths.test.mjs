import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("local CSS images ship with public exports and are inlined for scriptless preview",()=>{
 const s=read("src-tauri/src/sites.rs");
 assert.match(s,/fn css_image_refs\(css:&str\)/);
 assert.match(s,/fn inline_css_images\(project:&Path, css:&str\)/);
 assert.match(s,/css_image_refs\(css\)\.into_iter\(\)\.map/);
 assert.match(s,/let \(embedded, bytes\)=inline_css_images\(&dir,&css\)\?/);
 assert.match(s,/let mut total_bytes = css_bytes/);
 assert.match(s,/if total>MAX_PREVIEW_ASSET_BYTES/);
 assert.match(s,/if valid_asset_name\(name\)/);
});
test("media audit includes every CSS source file, not just custom.css",()=>{
 const ui=read("src/components/editor/asset-library.tsx");
 assert.match(ui,/listThemeStyles\(projectId\)/);
 assert.match(ui,/files\.map\(name => loadThemeStyle\(projectId,name\)\)/);
 assert.match(ui,/styles\.join\("\\n"\)/);
 assert.match(ui,/No files are deleted/);
});
