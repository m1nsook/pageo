import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const workspace = read("src/components/editor/theme-source-editor.tsx");
const app = read("src/App.tsx");
const monaco = read("src/components/editor/monaco-code-editor.tsx");

test("Page source opens actual current Markdown instead of default CSS", () => {
  assert.match(workspace, /const selectedPageFile = safeFile\(currentPageId\)/);
  assert.match(workspace, /setFile\(selectedPageFile\)/);
  assert.match(workspace, /await loadSelected\(selectedPageFile, version\)/);
  assert.doesNotMatch(workspace, /setFile\("theme\/custom\.css"\)/);
  assert.match(workspace, /aria-label="Edit current page Markdown source"/);
  assert.match(workspace, /Page source<\/Button>/);
});
test("Markdown files are loaded and saved as real .md source using Tauri, including private drafts", () => {
  assert.match(workspace, /content = \(await loadPage\(projectId, id\)\)\.markdown/);
  assert.match(workspace, /await savePage\(projectId, pageId, value\)/);
  assert.match(workspace, /file\.endsWith\("\.md"\) \? "markdown"/);
  assert.match(workspace, /<MonacoCodeEditor key=\{file\}/);
  assert.match(workspace, /onChange=\{next => \{ if \(!readOnly\) \{ setValue\(next\)/);
  assert.match(app, /currentPageId=\{current\.page\.id\}/);
  assert.match(app, /previewPageId=\{current\.page\.isPublic \? current\.page\.id : "index"\}/);
  assert.match(workspace, /previewPublicPage\(projectId,previewPageId\)/);
});
test("source editor is functional even if the preview fails after native save", () => {
  assert.match(workspace, /setSavedValue\(value\);\s*setMessage\(`Saved/);
  assert.match(workspace, /catch \(previewError\)/);
  assert.match(workspace, /Source was saved, but site preview could not refresh/);
  assert.match(workspace, /onSave=\{\(\) => void save\(\)\}/);
  assert.match(monaco, /language\?: SourceLanguage/);
  assert.match(monaco, /instance\.addCommand\(monaco\.KeyMod\.CtrlCmd \| monaco\.KeyCode\.KeyS/);
});
