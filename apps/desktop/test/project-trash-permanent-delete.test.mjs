import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const get = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("permanent deletion requires app-owned trash entry and exact project name", () => {
 const rust = get("../src-tauri/src/projects.rs");
 const panel = get("../src/components/studio/project-trash-panel.tsx");
 const app = get("../src/App.tsx");
 assert.match(rust, /fn permanently_delete_trashed_project/);
 assert.match(rust, /confirmation != item.project.name/);
 assert.match(rust, /parse_trashed_project\(trash_id, &entry\)/);
 assert.match(rust, /ensure_regular_project_tree\(&entry, 0, &mut files\)/);
 assert.match(panel, /confirmation !== selected.project.name/);
 assert.match(app, /permanentlyDeleteTrashedProject\(trashId, confirmation\)/);
 assert.match(get("../src-tauri/src/lib.rs"), /projects::permanently_delete_trashed_project/);
});
