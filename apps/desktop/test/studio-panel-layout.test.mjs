import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const js = ts.transpileModule(read("src/lib/studio-panel-layout.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const layout = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};

test("source and website widths default to a balanced split", () => {
  memory.clear();
  assert.deepEqual(layout.readStudioSplitLayout(), { source: "45%", preview: "55%" });
});
test("persisted panel widths restore without changing project files", () => {
  memory.set(layout.STUDIO_SPLIT_LAYOUT_KEY, JSON.stringify({ source: "38%", preview: "62%" }));
  assert.deepEqual(layout.readStudioSplitLayout(), { source: "38%", preview: "62%" });
  assert.match(layout.STUDIO_SPLIT_LAYOUT_KEY, /studio-split/);
});
test("corrupted, unsafe and too-narrow layouts revert to defaults", () => {
  for (const value of [
    "{", "null", "[]", '{"source":"10%","preview":"90%"}',
    '{"source":"NaN%","preview":"50%"}',
    '{"source":"40%","preview":"40%"}',
    '{"source":"300px","preview":"700px"}',
    '{"source":{},"preview":"50%"}',
  ]) {
    memory.set(layout.STUDIO_SPLIT_LAYOUT_KEY, value);
    assert.deepEqual(layout.readStudioSplitLayout(), layout.DEFAULT_SPLIT_LAYOUT, value);
  }
});
test("source/canvas split uses installed resizable panels without touching iframe", () => {
  const resizable = read("src/components/editor/studio-resizable-split.tsx");
  assert.match(resizable, /<ResizablePanelGroup/);
  assert.match(resizable, /onLayoutChanged=/);
  assert.match(resizable, /minSize="25%"/);
  const editor = read("src/App.tsx");
  assert.match(editor, /<StudioResizableSplit source=\{editorPane\} preview=\{previewPane\}/);
  assert.match(editor, /<div className="hidden" aria-hidden="true">\{editorPane\}/);
  assert.match(editor, /localStorage\.removeItem\(STUDIO_SPLIT_LAYOUT_KEY\)/);
});
