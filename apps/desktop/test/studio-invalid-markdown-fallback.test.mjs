import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { marked } from "marked";
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function load(source, resolver = require) {
  const exports = {};
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", js)(resolver, exports);
  return exports;
}
const examples = load(read("src/lib/block-examples.ts"));
const positioned = load(read("src/lib/source-block-insert.ts"), id =>
  id === "@/lib/block-examples" ? examples :
    id === "marked" ? { marked } : require(id)).insertComponentAtMarkdownBoundary;
const catalog = load(read("src/components/editor/block-catalog.ts"));

const original = "# Docs\n\nAn introduction.\n\n## Middle\n\nA conclusion.\n";
const visible = [
  { text: "Docs" }, { text: "An introduction." },
  { text: "Middle" }, { text: "A conclusion." },
];
test("all 20 components insert at the selected Markdown boundary, not document end", () => {
  assert.equal(catalog.BLOCKS.length, 20);
  for (const item of catalog.BLOCKS) {
    const snippet = examples.BLOCK_MARKDOWN_EXAMPLES[item.kind];
    const next = positioned(original, item.kind, visible, 2);
    assert.equal(next, "# Docs\n\nAn introduction.\n\n" + snippet + "\n\n## Middle\n\nA conclusion.\n", item.kind);
    assert.ok(next.indexOf(snippet) < next.indexOf("## Middle"), item.kind);
  }
});
test("top, middle, end and caret-mapped insertion preserve every original source byte", () => {
  assert.equal(positioned(original, "paragraph", visible, 0),
    "Write something...\n\n" + original);
  assert.equal(positioned(original, "paragraph", visible, 1),
    "# Docs\n\nWrite something...\n\nAn introduction.\n\n## Middle\n\nA conclusion.\n");
  assert.equal(positioned(original, "paragraph", visible, 4),
    original + "\nWrite something...\n");
});
test("keep CRLF and Unicode unchanged when inserting between blocks", () => {
  const doc = "# 漢字 😀\r\n\r\nBefore\r\n\r\nAfter\r\n";
  const result = positioned(doc, "orderedList",
    [{text:"漢字 😀"}, {text:"Before"}, {text:"After"}], 2);
  assert.equal(result, "# 漢字 😀\r\n\r\nBefore\r\n\r\n1. First step\r\n\r\nAfter\r\n");
});
test("a malformed visual alignment or unknown block refuses placement; never silently appends", () => {
  const badVisual = [{ text: "Docs" }, { text: "Something missing from source" }];
  assert.throws(() => positioned(original, "note", badVisual, 1),
    /Cannot safely map|unique Markdown section/i);
  assert.throws(() => positioned(original, "note", visible, 8), /outside the document/i);
  assert.throws(() => positioned(original, "invented-component", visible, 1),
    /Unknown documentation component/i);
});
test("source-position fingerprints never pretend to sanitize HTML or change original markup", () => {
  const source = "# Docs\n\n<script>alert(1)</script>\n\n## Next\n";
  const visibleBlocks = [{ text: "Docs" }, { text: "alert(1)" }, { text: "Next" }];
  // Positioning compares text only. It must keep existing Markdown bytes,
  // including HTML, unchanged; the publishing renderer owns sanitization.
  const result = positioned(source, "paragraph", visibleBlocks, 2);
  assert.equal(result, "# Docs\n\n<script>alert(1)</script>\n\nWrite something...\n\n## Next\n");
  assert.ok(!read("src/lib/source-block-insert.ts").includes("replace(/<"));
});

test("an omitted visual tail never silently appends after unrepresented Markdown", () => {
  const doc = "# Intro\n\nLast visible paragraph.\n\n## Hidden tail\n\nPrivate details.\n";
  const partial = [{ text: "Intro" }, { text: "Last visible paragraph." }];
  assert.throws(() => positioned(doc, "paragraph", partial, partial.length),
    /last visible block cannot be mapped safely/i);
  const repeated = "# Intro\n\nRepeat text\n\nRepeat text\n";
  assert.throws(() => positioned(repeated, "paragraph",
    [{ text: "Intro" }, { text: "Repeat text" }], 2),
    /last visible block cannot be mapped safely/i);
});

test("first visible block maps to its real source offset after unsupported leading Markdown", () => {
  const doc = "# Hidden\n\nVisible paragraph.\n\n## End\n";
  const partial = [{ text: "Visible paragraph." }, { text: "End" }];
  assert.equal(positioned(doc, "paragraph", partial, 0),
    "# Hidden\n\nWrite something...\n\nVisible paragraph.\n\n## End\n");
  assert.throws(() => positioned("# Hidden\n\nRepeat text\n\nRepeat text\n",
    "paragraph", [{ text: "Repeat text" }], 0),
    /cannot safely identify the first visible/i);
});

test("empty or ambiguous editor anchors fail closed", () => {
  assert.equal(positioned("", "paragraph", [], 0), "Write something...\n");
  assert.throws(() => positioned("# Real source\n", "paragraph", [], 0),
    /no visible editor blocks/i);
  assert.throws(() => positioned("# \n\n---\n", "paragraph",
    [{ text: "" }, { text: "" }], 1),
    /cannot safely map|unique markdown section/i);
});

test("failed Tiptap parse routes click/pointer to exact source placement, not old append fallback", () => {
  const insert = read("src/lib/block-insertion.ts");
  const palette = read("src/components/editor/block-palette.tsx");
  const app = read("src/App.tsx");
  assert.match(insert, /blockDropBoundary\(editor: Editor, clientY: number\)/);
  assert.match(insert, /selectionBlockBoundary\(editor: Editor\)/);
  assert.match(palette, /invalidDocumentRef\.current\?\.\(kind, point\)/);
  assert.match(palette, /\}, \[editor, disabled\]\);/);
  assert.match(app, /insertComponentAtMarkdownBoundary\(latest\.current, kind, visibleBlocks, boundary\)/);
  assert.match(app, /rawSourceFallbackActive\.current = true/);
  assert.doesNotMatch(app, /appendComponentToMarkdown/);
  assert.match(palette, /window\.addEventListener\("mousemove", mouseMove, true\)/);
  assert.match(palette, /window\.addEventListener\("mouseup", mouseUp, true\)/);
  assert.match(palette, /dragPoint && <div aria-hidden="true"/);
  assert.match(palette, /dropLine && <div aria-hidden="true"/);
});
