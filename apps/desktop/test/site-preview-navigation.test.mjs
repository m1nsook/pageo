import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Contract tests for the script-disabled iframe's parent-side navigation.
// React/Tauri interaction still requires manual verification on Windows.
const source = readFileSync(new URL("../src/components/editor/site-preview.tsx", import.meta.url), "utf8");

test("preview reloads when the project changes while the dialog is open", () => {
  assert.match(source, /\[open, projectId\]/);
  assert.match(source, /setPages\(\[\]\)/);
  assert.match(source, /setSrcDoc\(""\)/);
  assert.match(source, /requestId\.current\+\+/);
});

test("cross-page links preserve decoded heading fragments in the script-disabled iframe", () => {
  assert.match(source, /decodeURIComponent\(hash\.join\("#"\)\)/);
  assert.match(source, /pendingFragment\.current = fragment/);
  assert.match(source, /doc\.getElementById\(fragment\)\?\.scrollIntoView/);
  assert.match(source, /target === selected/);
  assert.match(source, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(source, /sandbox="[^"]*allow-scripts/);
});
