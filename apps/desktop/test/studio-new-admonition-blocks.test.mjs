import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marked } from "marked";
import ts from "typescript";
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const output = ts.transpileModule(read("src/lib/block-examples.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { BLOCK_MARKDOWN_EXAMPLES: examples } =
  await import("data:text/javascript;base64,"+Buffer.from(output).toString("base64"));
test("all five new admonitions parse as blockquotes and preserve their actual marker",()=>{
 for(const [kind,marker] of Object.entries({note:"NOTE",tip:"TIP",important:"IMPORTANT",warning:"WARNING",caution:"CAUTION"})){
  const tokens=marked.lexer(examples[kind]);
  assert.equal(tokens[0].type,"blockquote",kind);
  assert.match(tokens[0].text,new RegExp("^\\[!"+marker+"\\]"),kind);
  assert.match(read("src/lib/markdown-markers.ts"),new RegExp(marker),kind);
  assert.match(read("src/lib/site.ts"),new RegExp(marker),kind);
 }
});
test("new heading and admonitions have matching Tiptap source templates",()=>{
 const source=read("src/components/editor/block-catalog.ts");
 assert.match(source,/case "heading3": return \{ type: "heading", attrs: \{ level: 3 \}/);
 for(const kind of ["note","tip","important","warning","caution"]){
  assert.ok(source.includes(`case "${kind}"`),kind);
  assert.ok(examples[kind].startsWith("> [!"),kind);
 }
});
