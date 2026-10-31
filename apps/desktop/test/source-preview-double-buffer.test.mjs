import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../src/components/editor/theme-source-editor.tsx",import.meta.url),"utf8");
test("Monaco Source modal double-buffers real website preview without white blank",()=>{
 assert.match(src,/const \[previewFrames, setPreviewFrames\] = useState/);
 assert.match(src,/const \[previewSlot, setPreviewSlot\] = useState/);
 assert.match(src,/pendingPreview\.current=\{revision,slot\}/);
 assert.match(src,/setPreviewFrames\(previous=>/);
 assert.match(src,/onLoad=\{\(\)=>finishPreviewLoad\(slot as 0\|1,snapshot\.revision\)\}/);
 assert.match(src,/setPreviewSlot\(slot\)/);
 assert.doesNotMatch(src,/setHtml\(/);
});
test("reloading or changing projects preserves/isolates correct preview frame",()=>{
 assert.match(src,/previewRevision\.current\+\+/);
 assert.match(src,/if \(revision!==previewRevision\.current\) return/);
 assert.match(src,/setPreviewFrames\(\[emptyPreview\(\),emptyPreview\(\)\]\)/);
 assert.match(src,/pendingPreview\.current=null/);
 assert.match(src,/await refresh\(\)/);
 // Private page Source may edit the current draft while the preview safely uses a public page.
 assert.match(src,/previewPublicPage\(projectId,previewPageId\)/);
 assert.match(src,/\[projectId, previewPageId\]/);
});
test("preview scripts remain disabled and Studio-only matte never changes published site",()=>{
 assert.match(src,/sandbox="allow-same-origin"/);
 assert.doesNotMatch(src,/sandbox="[^"]*allow-scripts/);
 assert.match(src,/paglora-preview-stage/);
 assert.match(src,/paglora-preview-frame/);
 const site=readFileSync(new URL("../src-tauri/src/sites.rs",import.meta.url),"utf8");
 assert.ok(!site.includes("paglora-preview-stage"));
});
