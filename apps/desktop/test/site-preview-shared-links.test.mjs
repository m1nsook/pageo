import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const content=readFileSync(new URL("../src/lib/site-preview-links.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {resolveCanvasLink}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
test("preview rejects external protocols, path traversal, private pages and malformed fragments",()=>{
 const ids=["index","guide"];
 for(const href of ["https://example.com","javascript:alert(1)","../guide.html","/guide.html","private.html","guide.html#%NO"])assert.equal(resolveCanvasLink(href,ids),null,href);
 assert.deepEqual(resolveCanvasLink("guide.html#my%20section",ids),{kind:"page",pageId:"guide",fragment:"my section"});
 assert.deepEqual(resolveCanvasLink("#introduction",ids),{kind:"fragment",fragment:"introduction"});
});
