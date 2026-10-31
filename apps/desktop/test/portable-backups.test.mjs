import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/studio/workspace-content.tsx", import.meta.url), "utf8");
const projects = readFileSync(new URL("../src/lib/projects.ts", import.meta.url), "utf8");
const rust = readFileSync(new URL("../src-tauri/src/backup.rs", import.meta.url), "utf8");

test("Studio offers offline backup export and non-destructive archive import", () => {
  assert.match(workspace, /studio\.backup\.export/);
  assert.match(workspace, /studio\.backup\.import/);
  assert.match(workspace, /type="file" accept="\.paglora"/);
  assert.match(app, /exportProjectBackup\(id\)/);
  assert.match(app, /importProjectBackup\(archive\)/);
  assert.match(projects, /invoke<string>\("export_project_backup"/);
  assert.match(projects, /invoke<string>\("import_project_backup"/);
});
test("portable archive has a version, bounds, safe paths and collision avoidance", () => {
  assert.match(rust, /archive_version: u8/);
  assert.match(rust, /MAX_ARCHIVE/);
  assert.match(rust, /valid_source_path/);
  assert.match(rust, /is_symlink\(\)/);
  assert.match(rust, /create_dir\(&folder\)/);
  assert.match(rust, /example-import-1/);
  assert.match(rust, /docs\/hidden\.md/);
});
