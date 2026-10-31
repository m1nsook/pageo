import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/editor/site-designer.tsx", import.meta.url), "utf8");

// Source-level guard checks; native Windows UI verification remains necessary.
test("site designer invalidates in-flight work on dialog/project changes", () => {
  assert.match(source, /generation\.current\+\+;\s*if \(!open\) return/);
  assert.match(source, /setBusy\(false\);\s*setUploading\(false\);\s*setLoading\(true\)/);
});

test("late image imports cannot attach a previous project's logo to a new project", () => {
  assert.match(source, /const startedGeneration = generation\.current;\s*const isCurrent =/);
  assert.match(source, /if \(!isCurrent\(\)\) return;\s*const url = await importSiteAsset/);
  assert.match(source, /if \(isCurrent\(\)\) patch\("logoUrl", url\)/);
  assert.match(source, /if \(isCurrent\(\)\) setUploading\(false\)/);
});

test("late save results cannot mark a different project saved", () => {
  assert.match(source, /if \(generation\.current === startedGeneration\) setSaved\(editVersion\.current === savingVersion\)/);
  assert.match(source, /if \(generation\.current === startedGeneration\) setBusy\(false\)/);
});

test("failed live previews do not leave stale published content on screen", () => {
  assert.match(source, /\.catch\(cause => \{ if \(mounted\) \{ setPreview\(""\); setError\(String\(cause\)\); \} \}\);/);
});
