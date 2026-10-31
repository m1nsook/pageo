import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const js = ts.transpileModule(read("src/lib/studio-text-edit.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const editing = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

class Input {
  constructor(value = "", type = "text") {
    this._value = value;
    this.type = type;
    this.disabled = false;
    this.readOnly = false;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.events = [];
  }
  get value() { return this._value; }
  set value(value) { this._value = value; }
  focus() { this.focused = true; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  dispatchEvent(event) { this.events.push(event); return true; }
}
class Textarea extends Input {}
globalThis.HTMLInputElement = Input;
globalThis.HTMLTextAreaElement = Textarea;
globalThis.InputEvent = class {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
};
globalThis.document = { execCommand: () => false };

test("text-only context menu never captures passwords, specialized inputs or non-editors", () => {
  assert.equal(editing.isStudioTextTarget(new Input("hello", "text")), true);
  assert.equal(editing.isStudioTextTarget(new Textarea("hello")), true);
  for (const type of ["password", "file", "date", "checkbox", "number"]) {
    assert.equal(editing.isStudioTextTarget(new Input("hello", type)), false, type);
  }
  assert.equal(editing.isStudioTextTarget({}), false);
});

test("right-click paste preserves selected text outside selection and notifies React", () => {
  const input = new Input("Paglora Studio");
  const range = { start: 0, end: 7 };
  editing.replaceText(input, range, "Great");
  assert.equal(input.value, "Great Studio");
  assert.deepEqual([input.selectionStart, input.selectionEnd], [5, 5]);
  assert.equal(input.events.length, 1);
  assert.equal(input.events[0].type, "input");
  assert.equal(input.events[0].bubbles, true);
  assert.equal(input.events[0].inputType, "insertText");
  assert.equal(input.focused, true);
});

test("read-only fields refuse changes and preserve their contents", () => {
  const field = new Textarea("sensitive");
  field.readOnly = true;
  assert.equal(editing.canModify(field), false);
  assert.equal(editing.selectedText(field, { start: 0, end: 4 }), "sens");
  assert.throws(() => editing.replaceText(field, { start: 0, end: 4 }, "oops"));
  assert.equal(field.value, "sensitive");
});

test("new Studio context menu uses explicit clipboard actions and avoids Monaco/TipTap", () => {
  const menu = read("src/components/studio/studio-text-context-menu.tsx");
  assert.match(menu, /document\.addEventListener\("contextmenu", onContext, \{ capture: true \}\)/);
  assert.match(menu, /data-paglora-source-editor/);
  assert.match(menu, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(menu, /navigator\.clipboard\.readText\(\)/);
  assert.match(menu, /<DropdownMenuItem[^>]*onSelect=\{\(\) => void action\("paste"\)\}/);
  const app = read("src/App.tsx");
  assert.match(app, /<StudioTextContextMenu \/>/);
  assert.match(app, /<StudioSurfaceMenu/);
});

test("Milestone A avoids native title tooltips and dead navigation promises", () => {
  const app = read("src/App.tsx");
  assert.doesNotMatch(app, /\btitle=\{showPages|\btitle=\{showInspector|\btitle=\{showBlockTools/);
  assert.match(app, /<StudioTooltip label=\{showPages/);
  const card = read("src/components/studio/workspace-content.tsx");
  assert.doesNotMatch(card, /title=\{project\.name\}/);
  const sidebar = read("src/components/studio/workspace-sidebar.tsx");
  assert.doesNotMatch(sidebar, /Templates are planned|studio\.nav\.soon/);
  assert.match(sidebar, /studio\.nav\.documentation/);
  for (const locale of ["en", "ko", "pl"]) {
    const messages = JSON.parse(read(`src/i18n/locales/${locale}.json`)).messages;
    assert.equal(typeof messages["studio.nav.documentation"], "string");
    assert.doesNotMatch(messages["studio.settings.storageFuture"], /planned|future releases|예정|przyszłych wydań/i);
  }
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  assert.equal(config.app.windows[0].decorations, false);
  assert.match(read("src/App.tsx"), /<StudioTitlebar activeProject=\{active\?\.project\.name\}/);
  assert.match(read("src/main.tsx"), /setTheme\(resolvedTheme === "dark" \? "dark" : "light"\)/);
});

test("every remaining Studio toolbar and outline native tooltip uses Paglora's shared component", () => {
  const outline = read("src/components/editor/block-outline.tsx");
  assert.doesNotMatch(outline, /\btitle=/);
  assert.match(outline, /StudioTooltip label="Delete block/);
  assert.match(outline, /StudioTooltip label="Undo"/);
  const builder = read("src/components/editor/site-builder.tsx");
  assert.doesNotMatch(builder, /title="Copy export directory"/);
  assert.match(builder, /StudioTooltip label="Copy export directory"/);
  const preview = read("src/components/editor/site-preview.tsx");
  assert.doesNotMatch(preview, /title="Refresh preview"/);
  assert.match(preview, /StudioTooltip label="Refresh preview"/);
  const designer = read("src/components/editor/site-designer.tsx");
  assert.doesNotMatch(designer, /title=\{t\(color\.name\)\}/);
  assert.match(designer, /StudioTooltip key=\{color\.name\}/);
  const trash = read("src/components/studio/project-trash-panel.tsx");
  assert.doesNotMatch(trash, /title=\{item\.project\.name\}/);
  assert.match(trash, /StudioTooltip label=\{item\.project\.name\}/);
  // iframe title remains mandatory for accessibility; never remove it.
  assert.match(preview, /title=\{\`Public website:/);
});
