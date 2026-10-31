import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { history, undo, redo } from "@tiptap/pm/history";

// Execute the actual TypeScript implementation, not a duplicate test algorithm.
// CommonJS transpilation permits loading it in the existing Node CI suite.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/lib/block-operations.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", js)(require, module, module.exports);
const { moveBlock, duplicateBlock, deleteBlock } = module.exports;

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { attrs: { level: { default: 1 } }, content: "inline*", group: "block" },
    text: { group: "inline" },
  },
  marks: { strong: {} },
});
const paragraph = text => schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);
const heading = (text, level = 2) => schema.nodes.heading.create({ level }, schema.text(text));
function setup(nodes) {
  let state = EditorState.create({ schema, doc: schema.nodes.doc.create(null, nodes), plugins: [history()] });
  const editor = {
    isEditable: true,
    get state() { return state; },
    view: { dispatch(transaction) { state = state.apply(transaction); } },
  };
  return {
    editor,
    get state() { return state; },
    get nodes() { return state.doc.content.content; },
    undo() { return undo(state, transaction => { state = state.apply(transaction); }); },
    redo() { return redo(state, transaction => { state = state.apply(transaction); }); },
  };
}
const texts = ctx => ctx.nodes.map(node => node.textContent);

test("moving blocks preserves nested content, heading levels, caret and undo history", () => {
  const ctx = setup([paragraph("first"), heading("Important", 3), paragraph("last")]);
  const offset = ctx.nodes[0].nodeSize;
  ctx.editor.view.dispatch(ctx.state.tr.setSelection(TextSelection.create(ctx.state.doc, offset + 4)));
  assert.equal(moveBlock(ctx.editor, 1, 0), true);
  assert.deepEqual(texts(ctx), ["Important", "first", "last"]);
  assert.equal(ctx.nodes[0].attrs.level, 3);
  assert.equal(ctx.state.selection.from, 4);
  assert.equal(ctx.undo(), true);
  assert.deepEqual(texts(ctx), ["first", "Important", "last"]);
  assert.equal(ctx.redo(), true);
  assert.deepEqual(texts(ctx), ["Important", "first", "last"]);
});

test("duplicate preserves rich marks without sharing mutable editor state", () => {
  const rich = schema.nodes.paragraph.create(null, schema.text("Bold", [schema.marks.strong.create()]));
  const ctx = setup([rich, paragraph("next")]);
  assert.equal(duplicateBlock(ctx.editor, 0), true);
  assert.deepEqual(texts(ctx), ["Bold", "Bold", "next"]);
  assert.deepEqual(ctx.nodes[0].toJSON(), ctx.nodes[1].toJSON());
  assert.equal(ctx.undo(), true);
  assert.deepEqual(texts(ctx), ["Bold", "next"]);
});

test("delete keeps the document valid, selects the next block and supports undo", () => {
  const ctx = setup([paragraph("one"), paragraph("two")]);
  assert.equal(deleteBlock(ctx.editor, 0), true);
  assert.deepEqual(texts(ctx), ["two"]);
  assert.equal(ctx.state.selection.from, 1);
  assert.equal(ctx.undo(), true);
  assert.deepEqual(texts(ctx), ["one", "two"]);
  assert.equal(deleteBlock(ctx.editor, 0), true);
  assert.equal(deleteBlock(ctx.editor, 0), true);
  assert.deepEqual(texts(ctx), [""]);
  assert.equal(deleteBlock(ctx.editor, 0), false);
});

test("invalid indices and read-only state do not dispatch transactions", () => {
  const ctx = setup([paragraph("one"), paragraph("two")]);
  for (const [fn, args] of [
    [moveBlock, [-1, 0]], [moveBlock, [0, 2]], [moveBlock, [0, 0]],
    [duplicateBlock, [99]], [deleteBlock, [-1]],
  ]) assert.equal(fn(ctx.editor, ...args), false);
  ctx.editor.isEditable = false;
  assert.equal(duplicateBlock(ctx.editor, 0), false);
  assert.deepEqual(texts(ctx), ["one", "two"]);
});

test("outline exposes keyboard, pointer and accessible action controls", () => {
  const ui = readFileSync(new URL("../src/components/editor/block-outline.tsx", import.meta.url), "utf8");
  assert.match(ui, /onPointerUp=\{end\}/);
  assert.match(ui, /event\.altKey/);
  assert.match(ui, /event\.isComposing/);
  assert.match(ui, /duplicateBlock\(editor, row\.index\)/);
  assert.match(ui, /deleteBlock\(editor, row\.index\)/);
  assert.match(ui, /editor\?\.chain\(\)\.undo\(\)\.run\(\)/);
  assert.match(ui, /aria-label="Undo editor change"/);
});
