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
  // Validate the complete body, rather than stripping tags out of HTML:
  // multi-character replacements may reveal new tags and are not sanitizers.
  assert.match(
    body,
    /^\s*<div\s+id="root"\s*><\/div>\s*<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="\/src\/main\.tsx")[^>]*><\/script>\s*$/i,
    "only the React root and entry module are allowed in the desktop body",
  );
});
