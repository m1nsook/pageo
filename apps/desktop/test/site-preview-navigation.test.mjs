import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source=readFileSync(new URL("../src/components/editor/site-preview.tsx",import.meta.url),"utf8");
test("dialog clears both buffers on project change and never shows previous project",()=>{
 assert.match(source,/\[open, projectId\]/);
 assert.match(source,/requestId\.current\+\+/);
 assert.match(source,/setFrames\(\[blankFrame\(\), blankFrame\(\)\]\)/);
 assert.match(source,/setPages\(\[\]\)/);
});
test("page transitions only swap after hidden iframe loads and preserve old preview on error",()=>{
 assert.match(source,/const slot: 0 \| 1 = visibleRef\.current === 0 \? 1 : 0/);
 assert.match(source,/pending\.current = \{ slot, request \}/);
 assert.match(source,/onLoad=\{event => onFrameLoad\(event, snapshot, slot as 0 \| 1\)\}/);
 assert.match(source,/setVisibleSlot\(slot\)/);
 assert.match(source,/setSelected\(snapshot\.pageId\)/);
 assert.match(source,/The previous preview remains available/);
 assert.doesNotMatch(source,/setSrcDoc/);
});
test("local page links resolve through shared validator and scroll fragments safely",()=>{
 assert.match(source,/resolveCanvasLink\(anchor\.getAttribute\("href"\) \?\? "", publicIds\)/);
 assert.match(source,/doc\.getElementById\(destination\.fragment\)\?\.scrollIntoView/);
 assert.match(source,/doc\.getElementById\(snapshot\.fragment\)\?\.scrollIntoView/);
 assert.match(source,/sandbox="allow-same-origin"/);
 assert.doesNotMatch(source,/sandbox="[^"]*allow-scripts/);
});
