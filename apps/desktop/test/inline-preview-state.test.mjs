import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/editor/inline-site-preview.tsx", import.meta.url), "utf8");

// Contract test for the script-disabled React/Tauri canvas. Native UI testing
// remains necessary to verify the actual transition on Windows.
test("canvas clears the old project/page before loading a different preview", () => {
  assert.match(source, /previewIdentity = JSON\.stringify\(\[projectId, previewPageId\]\)/);
  assert.match(source, /lastPreviewIdentity\.current !== previewIdentity/);
  assert.match(source, /lastPreviewIdentity\.current = previewIdentity;\s*setHtml\(""\)/);
  assert.match(source, /\[projectId, previewPageId, previewIdentity,/);
});

test("canvas still ignores late responses and keeps the preview script-disabled", () => {
  assert.match(source, /if \(active\) setHtml\(result\)/);
  assert.match(source, /return \(\) => \{ active = false; \}/);
  assert.doesNotMatch(source, /sandbox="[^"]*allow-scripts/);
});
