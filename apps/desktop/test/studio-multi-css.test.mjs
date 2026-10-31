import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("stylesheets are a closed ordered cascade shared by preview and static Build",()=>{
 const s=read("src-tauri/src/source.rs"),site=read("src-tauri/src/sites.rs");
 for(const v of ["style_order","write_style_order","safe_style_name","source_style","MAX_TOTAL_CSS_BYTES","MAX_EXTRA_STYLES","site_css"]) assert.ok(s.includes(v),v);
 assert.match(s,/stem!="custom"/);
 assert.match(s,/source: theme\/\{name\}/);
 assert.match(s,/collect::<HashSet<_>>\(\)\.len\(\)/);
 assert.match(site,/crate::source::site_css\(&dir\)/);
 assert.match(site,/fs::write\(staged\.join\("custom\.css"\), css\)/);
 assert.match(site,/let override_css = theme\.map/);
});
test("Monaco can create, edit and re-order only validated stylesheets",()=>{
 const src=read("src/components/editor/theme-source-editor.tsx");
 for(const v of ["listThemeStyles","createThemeStyle","reorderThemeStyles","loadThemeStyle","saveThemeStyle"])assert.ok(src.includes(v),v);
 assert.match(src,/index<1 \|\| index\+delta<1/);
 assert.match(src,/Stylesheet cascade order/);
 assert.match(src,/Discard unsaved changes in/);
 const native=read("src-tauri/src/lib.rs");
 for(const v of ["list_theme_styles","create_theme_style","reorder_theme_styles","save_theme_style"])assert.ok(native.includes(v),v);
});
