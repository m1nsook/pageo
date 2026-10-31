import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), "utf8");
test("canvas and inspector icon controls use Radix and preserve accessible labels", () => {
  const canvas = read("editor/inline-site-preview.tsx");
  assert.match(canvas, /<StudioTooltip label="Zoom out">/);
  assert.match(canvas, /<StudioTooltip label="Zoom in">/);
  assert.match(canvas, /<StudioTooltip label="Fit canvas to window">/);
  assert.match(canvas, /<StudioTooltip label="Save and refresh site">/);
  assert.doesNotMatch(canvas, /title="Zoom/);
  assert.match(canvas, /aria-label="Save and refresh site preview"/);
  const inspector = read("editor/page-inspector.tsx");
  assert.match(inspector, /<StudioTooltip label="Clear selection">/);
  assert.match(inspector, /<StudioTooltip label="Save page title">/);
});
test("Paglora tooltip primitive and source editor retain accessibility and iframe titles", () => {
  const tooltip = read("studio/studio-tooltip.tsx");
  assert.match(tooltip, /<TooltipTrigger asChild>/);
  assert.match(tooltip, /<TooltipContent side=\{side\}>/);
  assert.match(read("editor/theme-source-editor.tsx"), /<StudioTooltip label="Refresh from saved files">/);
  assert.match(read("editor/inline-site-preview.tsx"), /title=\{`Paglora/);
});
