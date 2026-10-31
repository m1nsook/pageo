import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { history, undo, redo } from "@tiptap/pm/history";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function execute(source, load = require) {
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "exports", compiled)(load, exports);
  return exports;
}
const catalog = execute(read("src/components/editor/block-catalog.ts"));
const insertion = execute(read("src/lib/block-insertion.ts"), id => {
  if (id === "@/components/editor/block-catalog") return catalog;
  return require(id);
});
const drag = execute(read("src/lib/block-drag.ts"), id => {
  if (id === "@/components/editor/block-catalog") return catalog;
  return require(id);
});
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { content: "inline*", group: "block", attrs: { level: { default: 1 } } },
    blockquote: { content: "block+", group: "block" },
    bulletList: { content: "listItem+", group: "block" },
    orderedList: { content: "listItem+", group: "block" },
    listItem: { content: "paragraph block*" },
    text: { group: "inline" },
  },
});
const p = value => schema.nodes.paragraph.create(null, schema.text(value));
function realDocument() {
  let state = EditorState.create({
    doc: schema.nodes.doc.create(null, [p("Before"), p("After")]),
    plugins: [history()],
  });
  let scrolls = 0;
  let changed = 0;
  const editor = {
    isEditable: true,
    isDestroyed: false,
    get state() { return state; },
    view: { nodeDOM(offset) {
      const rects = { 0: [100, 30], [p("Before").nodeSize]: [180, 30] };
      const [top, height] = rects[offset] ?? [1000, 30];
      return Object.assign(new globalThis.HTMLElement(), {
        getBoundingClientRect: () => ({ top, height }),
      });
    } },
    chain() {
      let position, json;
      const chain = {
        focus() { return chain; },
        insertContentAt(at, block) {
          position = at;
          json = block;
          return chain;
        },
        scrollIntoView() { scrolls++; return chain; },
        run() {
          if (position === undefined || !json) return false;
          const previous = state.doc;
          const tr = state.tr.replaceWith(position, position, schema.nodeFromJSON(json));
          state = state.apply(tr);
          if (!state.doc.eq(previous)) changed++;
          return true;
        },
      };
      return chain;
    },
  };
  return {
    editor,
    get state() { return state; },
    get texts() { return state.doc.content.content.map(node => node.textContent); },
    get scrolls() { return scrolls; },
    get changed() { return changed; },
    undo() { return undo(state, tr => { state = state.apply(tr); }); },
    redo() { return redo(state, tr => { state = state.apply(tr); }); },
  };
}
const oldHTMLElement = globalThis.HTMLElement;
globalThis.HTMLElement = class HTMLElement {};

test("a sidebar click inserts a REAL ProseMirror heading, updates document and is undoable", () => {
  const ctx = realDocument();
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "heading3"), true);
  assert.equal(ctx.state.doc.childCount, 3);
  assert.ok(ctx.texts.includes("New subsection"));
  assert.equal(ctx.scrolls, 1, "newly inserted caret must become visible");
  assert.equal(ctx.changed, 1);
  assert.equal(ctx.undo(), true);
  assert.deepEqual(ctx.texts, ["Before", "After"]);
  assert.equal(ctx.redo(), true);
  assert.ok(ctx.texts.includes("New subsection"));
});
test("dropping a real Markdown card at a rendered node boundary retains the block structure", () => {
  const ctx = realDocument();
  assert.equal(insertion.blockDropPosition(ctx.editor, 160), p("Before").nodeSize);
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "card", 160), true);
  assert.equal(ctx.state.doc.child(1).type.name, "blockquote");
  assert.equal(ctx.state.doc.child(1).child(0).textContent, "[!CARD] Card title");
  assert.equal(ctx.state.doc.child(1).child(1).textContent, "Describe this feature or link to a guide.");
  assert.equal(ctx.state.doc.child(0).textContent, "Before");
  assert.equal(ctx.state.doc.child(2).textContent, "After");
  assert.equal(ctx.undo(), true);
  assert.deepEqual(ctx.texts, ["Before", "After"]);
});
test("read-only mode never mutates the page or pretends an insertion succeeded", () => {
  const ctx = realDocument();
  ctx.editor.isEditable = false;
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "note"), false);
  assert.equal(ctx.changed, 0);
  assert.deepEqual(ctx.texts, ["Before", "After"]);
});
test("WebView2 missing drag MIME can still insert only a source-owned block", () => {
  const data = () => {
    const values = new Map();
    return {
      types: [],
      setData(name, value) { values.set(name, value); this.types = [...values.keys()]; },
      getData(name) { return values.get(name) ?? ""; },
      effectAllowed: "all",
    };
  };
  const item = data();
  assert.equal(drag.beginBlockDrag(item, "note"), true);
  const emptyNativePayload = data(); // WebView2 strips MIME on dragover/drop.
  assert.equal(drag.canAcceptBlockDrag(emptyNativePayload), true);
  assert.equal(drag.readBlockDrop(emptyNativePayload), "note");
  const ctx = realDocument();
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, drag.readBlockDrop(emptyNativePayload)), true);
  assert.equal(ctx.state.doc.childCount, 3);
  drag.finishBlockDrag();
  assert.equal(drag.canAcceptBlockDrag(emptyNativePayload), false);
  const external = data();
  external.setData("text/plain", "paglora:block:note");
  assert.equal(drag.readBlockDrop(external), null, "external drags cannot forge a source session");
});
test("contradictory external payloads and OS file drags are never inserted", () => {
  const fake = {
    types: ["Files"], getData: () => "", setData() {}, effectAllowed: "copy",
  };
  drag.beginBlockDrag(fake, "warning");
  assert.equal(drag.canAcceptBlockDrag(fake), false);
  assert.equal(drag.readBlockDrop(fake), null);
  const mismatch = {
    types: ["text/plain"], getData: type => type === "text/plain" ? "paglora:block:card" : "",
  };
  assert.equal(drag.readBlockDrop(mismatch), null);
  drag.finishBlockDrag();
});
test("both click and drag flows share the same persistent source-owned insertion pipeline", () => {
  const source = read("src/components/editor/block-palette.tsx");
  assert.match(source, /insertBlockIntoEditor\(editor, kind, point\?\.y\)/);
  assert.match(source, /document\.addEventListener\("drop", drop, true\)/);
  assert.match(source, /window\.addEventListener\("pointerup", onPointerUp, true\)/);
  assert.match(source, /document\.addEventListener\("dragend", endNative, true\)/);
  assert.match(source, /suppressClick\.current = true/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /event\.preventDefault\(\)/);
});
test.after(() => {
  if (oldHTMLElement === undefined) delete globalThis.HTMLElement;
  else globalThis.HTMLElement = oldHTMLElement;
});
