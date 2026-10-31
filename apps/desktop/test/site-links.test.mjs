import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const functionSource = source.match(/function safeLink\(raw: string\): string \| null \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionSource, "site.ts must export the shared Markdown link sanitizer");
const safeLink = vm.runInNewContext(
  "(" + functionSource.replace("raw: string", "raw").replace(": string | null", "") + ")",
);

test("Markdown links to local pages resolve to static HTML", () => {
  for (const [input, expected] of [
    ["guide", "guide.html"],
    ["./guide", "./guide.html"],
    ["guide.md", "guide.html"],
    ["./guide.md#install", "./guide.html#install"],
    ["guide.html", "guide.html"],
    ["guide#section-2", "guide.html#section-2"],
    ["#overview", "#overview"],
    ["#설치", "#설치"],
    ["guide.md#사용-방법", "guide.html#사용-방법"],
    ["guide#日本語", "guide.html#日本語"],
  ]) assert.equal(safeLink(input), expected, input);
});

test("Markdown links never export filesystem or executable URLs", () => {
  for (const link of ["../secret", "/etc/passwd", "javascript:alert(1)", "data:text/html,hi", "file:///tmp/a", "guide/other", "guide#bad\"onclick", "#bad<script>"]) {
    assert.equal(safeLink(link), null, link);
  }
  assert.equal(safeLink("https://example.test/guide"), "https://example.test/guide");
  assert.equal(safeLink("mailto:team@example.test"), "mailto:team@example.test");
});

const imageFunction = source.match(/function safeImage\(raw: string\): string \| null \{[\s\S]*?\n\}/)?.[0];
assert.ok(imageFunction, "site.ts must expose the shared image URL sanitizer");
const safeImage = vm.runInNewContext(
  "(" + imageFunction.replace("raw: string", "raw").replace(": string | null", "") + ")",
);

test("Markdown images accept only flat local passive assets or remote HTTPS", () => {
  for (const url of ["assets/guide.png", "assets/photo.jpg", "assets/logo.webp", "assets/animation.gif"]) {
    assert.equal(safeImage(url), url);
  }
  assert.equal(safeImage("https://example.test/logo.png"), "https://example.test/logo.png");
  for (const url of ["assets/../secret.png", "assets/private.svg", "assets/a.png?x=1",
                    "assets/folder/a.png", "data:image/svg+xml,hi", "file:///tmp/a.png",
                    "http://example.test/a.png"]) {
    assert.equal(safeImage(url), null, url);
  }
});
