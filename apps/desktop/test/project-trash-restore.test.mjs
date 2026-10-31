import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("restore always validates identifiers, folders and avoids overwrite", () => {
  const rust = read("src-tauri/src/projects.rs");
  assert.match(rust, /fn restore_from\(/);
  assert.match(rust, /ensure_regular_project_tree\(&entry, 0, &mut files\)/);
  assert.match(rust, /A project with this ID already exists/);
  assert.match(rust, /fs::symlink_metadata\(&destination\)/);
  assert.match(rust, /fn restore_collision_never_overwrites_an_existing_project\(/);
  assert.match(rust, /fn list_and_restore_trashed_project_preserves_files\(/);
});

test("new trash paths share the volume with custom project storage", () => {
  const rust = read("src-tauri/src/projects.rs");
  assert.match(rust, /root\.parent\(\).*join\("\.paglora-trash"\)/);
  assert.match(rust, /list_trash_at\(&legacy\)/);
  assert.match(rust, /move_project_to_trash\(&projects, &trash_folder_for\(&projects\)\?, &id\)/);
});

test("restore action is wired through Tauri, project list and frontend", () => {
  assert.match(read("src-tauri/src/lib.rs"), /projects::restore_trashed_project/);
  assert.match(read("src-tauri/src/lib.rs"), /projects::list_trashed_projects/);
  assert.match(read("src/lib/projects.ts"), /invoke<ProjectSummary>\("restore_trashed_project"/);
  assert.match(read("src/App.tsx"), /await restoreTrashedProject\(trashId\)/);
  assert.match(read("src/components/studio/workspace-content.tsx"), /<ProjectTrashPanel/);
  const ui = read("src/components/studio/project-trash-panel.tsx");
  assert.match(ui, /Recently removed/);
  assert.match(ui, /onRestore\(item\.trashId\)/);
});
