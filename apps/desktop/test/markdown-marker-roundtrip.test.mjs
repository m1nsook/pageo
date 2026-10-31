import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync(new URL("../src/lib/markdown-markers.ts", import.meta.url),"utf8");
const editor = readFileSync(new URL("../src/App.tsx", import.meta.url),"utf8");
test("editor normalizes serialized first-party markers before autosave",()=>{
  assert.match(helper,/function preservePagloraMarkers/);
  assert.match(helper,/NOTE\|TIP\|IMPORTANT\|WARNING\|CAUTION\|CARD\|STEPS/);
  assert.match(editor,/latest\.current = preservePagloraMarkers\(current\.getMarkdown\(\)\)/);
});
test("normalized markers restore card and callout syntax without changing normal links",()=>{
  const normalize = markdown => markdown.replace(
    /^([ \t]{0,3}>[ \t]*)\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|CARD|STEPS)\\\]/gim,
    (_whole,prefix,kind)=>prefix+"[!"+kind.toUpperCase()+"]",
  );
  const input = [
    "> \\[!NOTE\\]","> Important information.","",
    "> \\[!CARD\\] Getting started","> [Install](installation.md)","",
    "> \\[!STEPS\\] Checklist","",
    "> \\[!SOMETHING\\] Custom escaped text","",
    "A literal \\[!NOTE\\] outside a quote"
  ].join("\n");
  const result = normalize(input);
  assert.match(result,/^> \[!NOTE\]$/m);
  assert.match(result,/^> \[!CARD\] Getting started$/m);
  assert.match(result,/^> \[!STEPS\] Checklist$/m);
  assert.match(result,/^> \[Install\]\(installation\.md\)$/m);
  assert.match(result,/^> \\\[!SOMETHING\\\]/m);
  assert.match(result,/^A literal \\\[!NOTE\\\]/m);
  assert.equal(normalize(result),result);
});
