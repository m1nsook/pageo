import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

test("desktop entry HTML contains no escaped newline visible above the app", () => {
  // Browsers move non-whitespace text found in <head> into <body>.
  // A literal \\n after the favicon previously appeared at the very top
  // of WebView, pushing the entire Studio below the visible characters.
  const favicon = /<link\b[^>]*href="\/paglora\.svg"[^>]*>/i.exec(source);
  assert.ok(favicon, "desktop favicon link should be present");
  const following = source.slice(favicon.index + favicon[0].length);
  assert.match(following, /^\s*<title>/, "only whitespace is allowed between the favicon and title");
});

test("desktop React mount is the only non-script body element", () => {
  const body = /<body>([\s\S]*?)<\/body>/i.exec(source)?.[1];
  assert.ok(body, "desktop entry HTML must have a body");
  const withoutRootAndScript = body
    .replace(/<div\s+id="root"\s*><\/div>/i, "")
    .replace(/<script\b[^>]*src="\/src\/main\.tsx"[^>]*><\/script>/i, "");
  assert.equal(withoutRootAndScript.trim(), "", "unexpected text nodes outside the React root");
});
