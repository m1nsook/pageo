import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("project visuals are optional in the v1 manifest and portable in backups", () => {
  const rust = read("src-tauri/src/projects.rs");
  assert.match(rust, /serde\(default, skip_serializing_if = "ProjectVisual::is_default"\)/);
  assert.match(rust, /fn project_visual_defaults_are_backward_compatible_and_validated\(/);
  assert.match(rust, /pub fn update_project_visual\(/);
  assert.match(read("src-tauri/src/backup.rs"), /fn backup_roundtrip_preserves_project_organization_metadata\(/);
});
test("organizer UI uses validated native project metadata rather than browser-only storage", () => {
  const source = read("src/components/studio/workspace-content.tsx");
  assert.match(source, /<ProjectAppearanceDialog/);
  assert.match(source, /groups\.map\(/);
  assert.match(source, /onUpdateVisual\(p\.id, visual\)/);
  assert.match(read("src/App.tsx"), /await updateProjectVisual\(id, visual\)/);
  assert.match(read("src-tauri/src/lib.rs"), /projects::update_project_visual/);
});
test("accent and icon choices use a finite enum, no arbitrary CSS, URLs, or disk paths", () => {
  const ui = read("src/components/studio/project-appearance.tsx");
  const colors = [...ui.matchAll(/^  (blue|violet|cyan|green|amber|rose): \{/gm)].map(x => x[1]);
  const icons = [...ui.matchAll(/^  (book|code|package|rocket|globe|folder): \{/gm)].map(x => x[1]);
  assert.equal(new Set(colors).size, 6);
  assert.equal(new Set(icons).size, 6);
  const rust = read("src-tauri/src/projects.rs");
  assert.match(rust, /Unsupported project accent/);
  assert.match(rust, /Unsupported project icon/);
  assert.match(rust, /Category must be at most 40 characters/);
});
