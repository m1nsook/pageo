import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Monaco source tree uses only pages from project manifest", () => {
  const workspace = read("src/components/editor/theme-source-editor.tsx");
  assert.match(workspace, /pages\.map\(page => \(\{ path: safeFile\(page\.id\)/);
  assert.match(workspace, /listPages\(projectId\)/);
  assert.match(workspace, /loadPage\(projectId, id\)/);
  assert.match(workspace, /loadThemeCss\(projectId\)/);
  assert.match(workspace, /listThemeStyles\(projectId\)/);
  assert.match(workspace, /loadThemeStyle\(projectId,next\.slice\(6\)\)/);
  assert.match(workspace, /loadSiteSettings\(projectId\)/);
  assert.match(workspace, /aria-label="Project source files"/);
});

test("source changes are explicitly saved and rehydrated into visual editor", () => {
  const workspace = read("src/components/editor/theme-source-editor.tsx");
  assert.match(workspace, /savePage\(projectId, pageId, value\)/);
  assert.match(workspace, /pageSavedRef\.current\(pageId, value\)/);
  assert.match(workspace, /window\.confirm\("Discard unsaved changes in " \+ file/);
  const app = read("src/App.tsx");
  assert.match(app, /editor\.commands\.setContent\(markdown, \{ contentType: "markdown", emitUpdate: false \}\)/);
  assert.match(app, /revision\.current \+= 1/);
  assert.match(app, /if \(saveTimer\.current\) clearTimeout\(saveTimer\.current\)/);
});

test("source metadata cannot be directly edited and no raw path is forwarded", () => {
  const workspace = read("src/components/editor/theme-source-editor.tsx");
  assert.match(workspace, /readOnly = file === "pages\.json" \|\| file === "site\.json"/);
  assert.match(workspace, /<MonacoCodeEditor key=\{file\}/);
  assert.match(workspace, /readOnly=\{readOnly\}/);
  assert.match(read("src/components/editor/monaco-code-editor.tsx"), /readOnly,\s*theme:/);
  assert.match(workspace, /onBeforePreview/);
});
