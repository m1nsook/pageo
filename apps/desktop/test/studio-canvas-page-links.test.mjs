import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
// Runtime checks exercise the actual TypeScript resolver through Bun's native TS loader.
const { resolveCanvasLink } = await import("../src/lib/site-preview-links.ts");
const publicIds = ["index", "intro", "foo-bar"];
test("local public links and encoded anchors resolve", () => {
 assert.deepEqual(resolveCanvasLink("intro.html", publicIds), {kind:"page",pageId:"intro",fragment:""});
 assert.deepEqual(resolveCanvasLink("./foo-bar.html#intro%20guide", publicIds), {kind:"page",pageId:"foo-bar",fragment:"intro guide"});
 assert.deepEqual(resolveCanvasLink("#configuration", publicIds), {kind:"fragment",fragment:"configuration"});
});
test("private, malformed, absolute and external destinations are rejected", () => {
 for(const href of ["secret.html", "../intro.html", "/intro.html", "https://example.com", "javascript:alert(1)", "intro.html#%XX"]) {
   assert.equal(resolveCanvasLink(href,publicIds),null,href);
 }
});
test("canvas handles links before source block selection", () => {
 const source = readFileSync(new URL("../src/components/editor/inline-site-preview.tsx", import.meta.url), "utf8");
 const listener = source.slice(source.indexOf('doc.addEventListener("click"'));
 assert.ok(listener.indexOf('const anchor =') < listener.indexOf('const source ='));
 assert.match(listener, /resolveCanvasLink/);
});
