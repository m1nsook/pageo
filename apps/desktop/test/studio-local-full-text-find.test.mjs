import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("local search enforces bounded reads, safe regular files and results", () => {
  const rust = read("src-tauri/src/pages.rs");
  assert.match(rust, /pub fn search_project_pages\(/);
  assert.match(rust, /search_pages_at\(&folder\(&app, &project_id\)\?, &query\)/);
  assert.match(rust, /meta\.file_type\(\)\.is_file\(\)/);
  assert.match(rust, /scanned_bytes\.saturating_add\(meta\.len\(\)\) <= 20_000_000/);
  assert.match(rust, /take\(40\)/);
  assert.match(rust, /fn full_text_search_matches_private_local_markdown_without_exposing_filesystem_paths\(/);
});

test("finder debounces content search and keeps native project quick finder separate", () => {
  const finder = read("src/components/studio/studio-quick-find.tsx");
  assert.match(finder, /searchProjectPages\(projectId, query\.trim\(\)\)/);
  assert.match(finder, /180\)/);
  assert.match(finder, /if \(active\) setHits\(result\)/);
  assert.match(finder, /projectId \? "Search pages and content/);
  assert.match(finder, /match\.isPublic \? "" : "Private/);
  const app = read("src/App.tsx");
  assert.match(app, /projectId=\{document\.project\.id\} shortcut=\{findShortcut\}/);
  assert.match(read("src-tauri/src/lib.rs"), /pages::search_project_pages/);
});
