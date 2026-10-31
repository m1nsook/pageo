import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../src/components/editor/site-designer.tsx",import.meta.url),"utf8");
test("real video: designer never swaps a visible iframe srcDoc while changing presets",()=>{
 assert.match(src,/const \[previewFrames, setPreviewFrames\] = useState/);
 assert.match(src,/const \[visiblePreviewSlot, setVisiblePreviewSlot\] = useState/);
 assert.match(src,/pendingPreview\.current = \{ slot, request, generation: startedGeneration \}/);
 assert.match(src,/onLoad=\{\(\) => finishPreviewLoad\(index as 0 \| 1, frame\.revision\)\}/);
 assert.match(src,/setVisiblePreviewSlot\(slot\)/);
 assert.match(src,/requestAnimationFrame\(\(\) => requestAnimationFrame/);
 assert.doesNotMatch(src,/srcDoc=\{preview\}/);
 assert.match(src,/sandbox="allow-same-origin"/);
});
test("newer edits and different projects cannot reveal stale iframe content",()=>{
 assert.match(src,/request !== previewRequest\.current/);
 assert.match(src,/startedGeneration !== generation\.current/);
 assert.match(src,/setPreviewFrames\(\[\{ html: "", revision: 0 \}, \{ html: "", revision: 0 \}\]\)/);
 assert.match(src,/pending\.generation !== generation\.current/);
 assert.match(src,/opacity: visiblePreviewSlot === index \? 1 : 0/);
});
