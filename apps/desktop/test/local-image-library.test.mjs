import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { marked } from "marked";

// Run actual image helper code, not a duplicated regex.
const source = readFileSync(new URL("../src/lib/image-markdown.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const { imageMarkdown, isSafeImageSource, defaultImageAlt } = module.exports;

test("local image Markdown serializes and parses with accessible alt text", () => {
  const markdown = imageMarkdown("A [diagram]", "assets/guide-2.webp");
  assert.equal(markdown, "![A \\[diagram\\]](assets/guide-2.webp)");
  const tokens = marked.lexer(markdown);
  assert.equal(tokens[0].tokens[0].type, "image");
  assert.equal(tokens[0].tokens[0].href, "assets/guide-2.webp");
  assert.equal(tokens[0].tokens[0].text, "A [diagram]");
  assert.equal(defaultImageAlt("assets/first-screen-123.png"), "first screen 123");
  const titled = marked.lexer(imageMarkdown("Screenshot", "assets/guide.png", "The setup screen"));
  assert.equal(titled[0].tokens[0].title, "The setup screen");
  assert.equal(defaultImageAlt("assets/setup-screen-18b45ff0a21e3-0.png"), "setup screen");
});

test("image URLs reject script schemes, traversal, SVG and query injection", () => {
  assert.equal(isSafeImageSource("https://example.org/image.png"), true);
  for (const url of ["javascript:alert(1)", "data:image/svg+xml,foo", "assets/../secret.png",
    "assets/private.svg", "assets/foo.png?x=1", "file:///C:/secret.jpg",
    "http://example.org/a.png", "https://example.org/a.png\" onerror=alert(1)"]) {
    assert.equal(isSafeImageSource(url), false, url);
    assert.throws(() => imageMarkdown("test", url), /Unsafe image URL/);
  }
});

test("Studio image nodes preserve Markdown instead of writing HTML or project metadata", () => {
  const node = readFileSync(new URL("../src/components/editor/local-image-node.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const gallery = readFileSync(new URL("../src/components/editor/asset-library.tsx", import.meta.url), "utf8");
  assert.match(node, /markdownTokenName: "image"/);
  assert.match(node, /parseMarkdown\(token, helpers\)/);
  assert.match(node, /renderMarkdown\(node\)/);
  assert.match(app, /extensions: \[StarterKit, LocalImageNode, Markdown\]/);
  assert.match(app, /insertContent\(\{ type: "pagloraImage"/);
  assert.match(gallery, /previewSiteAsset\(projectId, selected\)/);
  assert.match(gallery, /navigator\.clipboard\.writeText\(imageMarkdown\(alt\.trim\(\), selected\)\)/);
});

test("actual Tiptap image handlers round-trip safe tokens and reject unsafe sources", () => {
  const nodeSource = readFileSync(new URL("../src/components/editor/local-image-node.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(nodeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imageModule = { exports: {} };
  const fakeRequire = name => {
    if (name === "@tiptap/core") return { Node: { create: config => config } };
    if (name === "@/lib/image-markdown") return module.exports;
    throw new Error("Unexpected import: " + name);
  };
  new Function("require", "module", "exports", js)(fakeRequire, imageModule, imageModule.exports);
  const node = imageModule.exports.LocalImageNode;
  const helpers = { createTextNode: text => ({ type: "text", text }) };
  const parsed = node.parseMarkdown({ href: "assets/guide.png", text: "Diagram" }, helpers);
  assert.deepEqual(parsed, { type: "pagloraImage", attrs: { src: "assets/guide.png", alt: "Diagram", title: null } });
  assert.equal(node.renderMarkdown(parsed), "![Diagram](assets/guide.png)");
  assert.equal(node.renderMarkdown({ attrs: { src: "assets/guide.png", alt: "Diagram", title: "Setup" } }), "![Diagram](assets/guide.png \"Setup\")");
  assert.deepEqual(node.parseMarkdown({ href: "javascript:alert(1)", text: "Unsafe" }, helpers),
    { type: "text", text: "Unsafe" });
  assert.equal(node.renderMarkdown({ attrs: { src: "data:text/html,evil", alt: "Unsafe" } }), "Unsafe");
});

test("Rust asset listing verifies real image headers and never follows symlinks", () => {
  const rust = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");
  const commands = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
  assert.match(rust, /fn list_project_assets\(project: &Path\)/);
  assert.match(rust, /fs::symlink_metadata\(entry\.path\(\)\)/);
  assert.match(rust, /image_type\(&header\[\.\.count\]\)/);
  assert.match(rust, /read_asset\(&project, name\)/);
  assert.match(commands, /sites::list_site_assets, sites::preview_site_asset/);
});
