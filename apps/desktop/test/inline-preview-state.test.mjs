import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/editor/inline-site-preview.tsx", import.meta.url), "utf8");

// Windows Tauri desktop testing remains required for a fully rendered transition.
test("canvas retains its previous frame while staging the next srcDoc", () => {
 assert.match(source, /const \[frames, setFrames\]/);
 assert.match(source, /visibleSlotRef\.current === 0 \? 1 : 0/);
 assert.match(source, /pendingFrame\.current = \{ revision, slot \}/);
 assert.match(source, /key=\{\`\$\{index\}-\$\{frame\.revision\}\`\}/);
 assert.match(source, /onLoad=\{event => frameReady\(event, index as 0 \| 1, frame\.revision\)\}/);
 assert.match(source, /setVisibleSlot\(slot\)/);
 assert.doesNotMatch(source, /setHtml\("?"?"?\)/);
});

test("canvas ignores stale render responses and keeps script execution disabled", () => {
 assert.match(source, /revision !== previewRequest\.current/);
 assert.match(source, /if \(!active \|\| revision !== previewRequest\.current\) return/);
 assert.match(source, /return \(\) => \{ active = false; \}/);
 assert.doesNotMatch(source, /sandbox="[^"]*allow-scripts/);
});
