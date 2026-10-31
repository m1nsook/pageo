import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/editor/inline-site-preview.tsx", import.meta.url), "utf8");

// Source contracts only: wheel/keyboard behavior still needs Windows UI testing.
test("Studio zoom keeps ordinary wheel scrolling inside the site iframe", () => {
  assert.match(source, /event\.target\.closest\("\[data-canvas-artboard\]"\)/);
  assert.match(source, /if \(!event\.ctrlKey && !event\.metaKey\) return;\s*event\.preventDefault\(\);\s*wheelZoomRef\.current\(event\.deltaY\)/);
  assert.match(source, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(source, /sandbox="[^"]*allow-scripts/);
});

test("focused canvas and iframe expose Ctrl/Cmd plus/minus and fit shortcuts", () => {
  assert.match(source, /tabIndex=\{0\}\s*aria-label="Website design canvas viewport"/);
  assert.match(source, /viewport\.addEventListener\("keydown", onKey\)/);
  assert.match(source, /doc\.addEventListener\("keydown", event =>/);
  assert.match(source, /event\.isComposing/);
  assert.match(source, /\["\+", "=", "-", "_", "0"\]/);
  assert.match(source, /if \(key === "0"\) setFit\(true\)/);
  assert.match(source, /changeZoom\(key === "\+" \|\| key === "=" \? 10 : -10\)/);
});
