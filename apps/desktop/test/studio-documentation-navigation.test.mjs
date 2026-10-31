import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const load = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("documentation buttons use the fixed native command and show opening failures", () => {
 const helper = load("../src/lib/external-links.ts");
 const sidebar = load("../src/components/studio/workspace-sidebar.tsx");
 const settings = load("../src/components/studio/workspace-content.tsx");
 const native = load("../src-tauri/src/external_links.rs");
 assert.match(helper, /invoke\("open_documentation"\)/);
 assert.match(native, /const DOCUMENTATION_URL: &str = "https:\/\/github.com\/m1nsook\/paglora#readme"/);
 assert.match(load("../src-tauri/src/lib.rs"), /external_links::open_documentation/);
 for (const ui of [sidebar, settings]) {
   assert.match(ui, /openDocumentation\(\)\.catch/);
   assert.doesNotMatch(ui, /href="https:\/\/m1nsook.github.io\/paglora-docs/);
 }
});
