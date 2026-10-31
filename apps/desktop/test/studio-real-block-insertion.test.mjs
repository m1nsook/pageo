import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EditorState, TextSelection } from "@tiptap/pm/state";
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
// Use exactly the same StarterKit node definitions as the production Studio.
// The previous hand-written schema missed real extension constraints.
const schema = getSchema([StarterKit]);

const p = value => schema.nodes.paragraph.create(null, schema.text(value));
function realDocument(initial = [p("Before"), p("After")]) {
  let state = EditorState.create({
    doc: schema.nodes.doc.create(null, initial),
    plugins: [history()],
  });
  let scrolls = 0, changed = 0;
  const editor = {
    isEditable: true,
    isDestroyed: false,
    get state() { return state; },
    view: {
      nodeDOM(offset) {
        const rects = { 0: [100, 30], [p("Before").nodeSize]: [180, 30] };
        const [top, height] = rects[offset] ?? [1000, 30];
        return Object.assign(new globalThis.HTMLElement(), {
          getBoundingClientRect: () => ({ top, height }),
        });
      },
      focus() {},
      dispatch(tr) {
        const previous = state.doc;
        if (tr.scrolledIntoView) scrolls++;
        state = state.apply(tr);
        if (!state.doc.eq(previous)) changed++;
      },
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

test("sidebar click inserts REAL ProseMirror heading, updates document and is undoable", () => {
  const ctx = realDocument();
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "heading3"), true);
  assert.equal(ctx.state.doc.childCount, 3);
  assert.ok(ctx.texts.includes("New subsection"));
  assert.equal(ctx.scrolls, 1);
  assert.equal(ctx.changed, 1);
  assert.equal(ctx.undo(), true);
  assert.deepEqual(ctx.texts, ["Before", "After"]);
  assert.equal(ctx.redo(), true);
  assert.ok(ctx.texts.includes("New subsection"));
});

test("every published palette template inserts through runtime schema into valid document", () => {
  const kinds = catalog.BLOCKS.map(item => item.kind);
  assert.equal(kinds.length, 20);
  for (const kind of kinds) {
    const ctx = realDocument();
    assert.equal(insertion.insertBlockIntoEditor(ctx.editor, kind), true, kind);
    assert.equal(ctx.state.doc.childCount, 3, kind);
    assert.doesNotThrow(() => ctx.state.doc.check(), kind);
    assert.equal(ctx.changed, 1, kind);
    assert.equal(ctx.undo(), true, kind);
    assert.deepEqual(ctx.texts, ["Before", "After"], kind);
  }
});

test("Quote inserts into a populated documentation page with nested cards and lists", () => {
  const card = schema.nodeFromJSON(catalog.createMarkdownBlock("card"));
  const steps = schema.nodeFromJSON(catalog.createMarkdownBlock("steps"));
  const ctx = realDocument([p("Welcome"), card, steps, p("End")]);
  assert.doesNotThrow(() => ctx.state.doc.check());
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "blockquote"), true);
  assert.equal(ctx.state.doc.childCount, 5);
  assert.equal(ctx.state.doc.child(1).type.name, "blockquote");
  assert.equal(ctx.state.doc.child(1).textContent, "Your quote");
  assert.doesNotThrow(() => ctx.state.doc.check());
  assert.equal(ctx.undo(), true);
  assert.equal(ctx.state.doc.childCount, 4);
});

test("dropping a real Markdown Card at a rendered top-level boundary preserves structure", () => {
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
test("read-only editor cannot mutate the document", () => {
  const ctx = realDocument();
  ctx.editor.isEditable = false;
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "note"), false);
  assert.equal(ctx.changed, 0);
  assert.deepEqual(ctx.texts, ["Before", "After"]);
});
test("unknown component never dispatches or changes existing content", () => {
  const ctx = realDocument();
  const original = ctx.state.doc;
  const failures = [];
  assert.doesNotThrow(() => {
    assert.equal(insertion.insertBlockIntoEditor(
      ctx.editor, "made-up", undefined, reason => failures.push(reason),
    ), false);
  });
  assert.ok(failures.length > 0);
  assert.equal(ctx.state.doc.eq(original), true);
  assert.equal(ctx.changed, 0);
});
test("already-invalid Markdown document does not crash or lose any saved content", () => {
  const invalid = schema.nodes.listItem.create(null, [p("Original content")]);
  const ctx = realDocument([invalid, p("After")]);
  assert.throws(() => ctx.state.doc.check());
  const failures = [];
  assert.doesNotThrow(() => assert.equal(
    insertion.insertBlockIntoEditor(ctx.editor, "card", undefined, reason => failures.push(reason)), false,
  ));
  assert.match(failures.join(" "), /invalid editor structure.*Source view/i);
  assert.equal(ctx.changed, 0);
  assert.equal(ctx.state.doc.child(0).textContent, "Original content");
});
test("nested cursor inserts after its top-level ancestor without splitting it", () => {
  const quote = schema.nodes.blockquote.create(null, [p("Inside")]);
  const ctx = realDocument([quote, p("After")]);
  ctx.editor.view.dispatch(ctx.state.tr.setSelection(TextSelection.create(ctx.state.doc, 2)));
  assert.equal(insertion.insertBlockIntoEditor(ctx.editor, "heading2"), true);
  assert.equal(ctx.state.doc.child(0).type.name, "blockquote");
  assert.equal(ctx.state.doc.child(0).textContent, "Inside");
  assert.equal(ctx.state.doc.child(1).type.name, "heading");
  assert.equal(ctx.state.doc.child(2).textContent, "After");
  assert.doesNotThrow(() => ctx.state.doc.check());
});
test("click and pointer-release flow share a single validated transaction", () => {
  const source = read("src/components/editor/block-palette.tsx");
  const insert = read("src/lib/block-insertion.ts");
  assert.match(source, /insertBlockIntoEditor\(editor, kind, point\?\.y, reason =>/);
  assert.match(source, /window\.addEventListener\("pointerup", release, true\)/);
  assert.match(source, /event\.clientX, event\.clientY/);
  assert.match(source, /clearDropHighlight\(\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(insert, /state\.schema\.nodeFromJSON\(createMarkdownBlock\(kind\)\)/);
  assert.match(insert, /view\.dispatch\(transaction\)/);
  assert.match(insert, /transaction\.doc\.check\(\)/);
  assert.doesNotMatch(insert, /\.insertContentAt\(/);
});
test.after(() => {
  if (oldHTMLElement === undefined) delete globalThis.HTMLElement;
  else globalThis.HTMLElement = oldHTMLElement;
});
