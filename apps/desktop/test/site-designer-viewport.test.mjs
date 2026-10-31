import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/editor/site-designer.tsx", import.meta.url), "utf8");

test("designer offers desktop, tablet and mobile responsive preview widths", () => {
  assert.match(source, /useState<"desktop" \| "tablet" \| "mobile">/);
  assert.match(source, /width === "tablet" \? "min\(100%,768px\)"/);
  assert.match(source, /"min\(100%,390px\)"/);
  for (const mode of ["desktop", "tablet", "mobile"]) {
    assert.ok(source.includes(`aria-pressed={width === "${mode}"}`));
    assert.ok(source.includes(`setWidth("${mode}")`));
  }
});

test("designer preview remains script-disabled at every viewport size", () => {
  assert.match(source, /sandbox="allow-same-origin"/);
  assert.match(source, /srcDoc=\{frame\.html\}/);
  assert.match(source, /onLoad=\{\(\) => finishPreviewLoad/);
  assert.doesNotMatch(source, /sandbox="[^"]*allow-scripts/);
  assert.match(source, /motion-reduce:transition-none/);
});
