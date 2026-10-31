import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

test("Studio finder uses configurable shortcut dispatch and respects Monaco", () => {
  const app = read("src/App.tsx");
  assert.match(app, /commandForEvent\(event, shortcuts\)/);
  assert.match(app, /\[data-paglora-source-editor\]/);
  assert.match(app, /<StudioQuickFind open=\{findOpen\}/);
  const finder = read("src/components/studio/studio-quick-find.tsx");
  assert.match(finder, /<CommandDialog/);
  assert.match(finder, /onSelect=\{\(\) =>/);
});

test("project removal moves local project files instead of erasing them", () => {
  const rust = read("src-tauri/src/projects.rs").replace(/\r\n/g, "\n");
  assert.match(rust, /fn move_project_to_trash\(/);
  assert.match(rust, /fs::rename\(&folder, &destination\)/);
  assert.doesNotMatch(rust.slice(rust.indexOf("fn move_project_to_trash"), rust.indexOf("fn purge_from")), /remove_dir_all/);
  assert.match(read("src-tauri/src/lib.rs"), /projects::trash_project/);
  assert.match(read("src/lib/projects.ts"), /invoke<string>\("trash_project"/);
  assert.match(read("src/components/studio/workspace-content.tsx"), /Move to trash/);
});

test("Studio-only browser context menu and notifications", () => {
  const menu = read("src/components/studio/studio-surface-menu.tsx");
  assert.match(menu, /document\.addEventListener\("contextmenu", onContext, \{ capture: true \}\)/);
  assert.match(menu, /event\.preventDefault\(\)/);
  assert.match(menu, /\[data-paglora-source-editor\]/);
  const app = read("src/App.tsx");
  assert.match(app, /<StudioSurfaceMenu/);
  assert.match(app, /<Toaster position="top-center"/);
});

test("Studio settings have compact appearance, keybinds, storage and docs", () => {
  const src = read("src/components/studio/workspace-content.tsx");
  assert.match(src, /<ThemeSwitcher showLabel \/>/);
  assert.match(src, /Keyboard shortcuts/);
  assert.match(src, /Copy path/);
  assert.match(src, /Documentation<\/a>/);
  assert.match(read("src/components/studio/theme-switcher.tsx"), /aria-pressed=\{theme === value\}/);
});
