import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectProject, run } from "../bin/paglora.mjs";

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "paglora-cli-"));
  const project = join(root, "my-docs");
  mkdirSync(join(project, "docs"), { recursive: true });
  writeFileSync(join(project, "paglora.json"), JSON.stringify({
    formatVersion: 1, id: "my-docs", name: "My Docs", createdAt: 1, updatedAt: 1,
  }));
  writeFileSync(join(project, "docs", "index.md"), "# Welcome\n");
  writeFileSync(join(project, "pages.json"), JSON.stringify({
    formatVersion: 1, pages: [{ id: "index", title: "Overview", isPublic: true, layout: "docs" }],
  }));
  try { fn(project); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test("Paglora projects are inspected using both manifests", () => fixture(folder => {
  const info = inspectProject(folder);
  assert.equal(info.id, "my-docs");
  assert.equal(info.pageCount, 1);
  assert.equal(info.publicCount, 1);
  assert.equal(info.pages[0].id, "index");
}));

test("inspect records privacy and the configured public website title", () => fixture(folder => {
  writeFileSync(join(folder, "docs", "internal.md"), "# Internal\n");
  writeFileSync(join(folder, "pages.json"), JSON.stringify({
    formatVersion: 1, pages: [
      { id: "index", title: "Overview", isPublic: true, layout: "docs" },
      { id: "internal", title: "Private draft", isPublic: false, layout: "docs" },
    ],
  }));
  writeFileSync(join(folder, "site.json"), JSON.stringify({ title: "Docs Website" }));
  const info = inspectProject(folder);
  assert.equal(info.pageCount, 2);
  assert.equal(info.publicCount, 1);
  assert.equal(info.siteTitle, "Docs Website");
}));

test("missing Markdown files fail validation", () => fixture(folder => {
  unlinkSync(join(folder, "docs", "index.md"));
  assert.throws(() => inspectProject(folder), /Missing docs\/index.md/);
}));

test("duplicate and invalid IDs fail validation", () => fixture(folder => {
  writeFileSync(join(folder, "pages.json"), JSON.stringify({
    formatVersion: 1, pages: [
      { id: "index", title: "Home", isPublic: true, layout: "docs" },
      { id: "index", title: "Oops", isPublic: true, layout: "docs" },
    ],
  }));
  assert.throws(() => inspectProject(folder), /Invalid page identifier/);
}));

test("command provides JSON output and successful validate exit code", () => fixture(folder => {
  let out = "", err = "";
  const output = { write: text => { out += text; } };
  const errors = { write: text => { err += text; } };
  assert.equal(run(["inspect", folder, "--json"], output, errors), 0);
  assert.equal(JSON.parse(out).pageCount, 1);
  out = "";
  assert.equal(run(["validate", folder], output, errors), 0);
  assert.match(out, /Valid documentation project/);
  assert.equal(err, "");
}));

test("older manifest filenames are not accepted", () => fixture(folder => {
  unlinkSync(join(folder, "paglora.json"));
  writeFileSync(join(folder, "page" + "o.json"), JSON.stringify({ formatVersion: 1, id: "my-docs", name: "Old" }));
  assert.throws(() => inspectProject(folder), /No paglora\.json found/);
}));

test("a pages manifest is required", () => fixture(folder => {
  unlinkSync(join(folder, "pages.json"));
  assert.throws(() => inspectProject(folder), /No pages\.json found/);
}));

test("navigation group metadata can be inspected", () => fixture(folder => {
  writeFileSync(join(folder, "pages.json"), JSON.stringify({
    formatVersion: 1,
    pages: [{ id: "index", title: "Overview", isPublic: true, layout: "docs", navGroup: "Getting Started" }],
  }));
  const info = inspectProject(folder);
  assert.equal(info.pageCount, 1);
}));

test("invalid group metadata fails CLI validation", () => fixture(folder => {
  writeFileSync(join(folder, "pages.json"), JSON.stringify({
    formatVersion: 1,
    pages: [{ id: "index", title: "Overview", isPublic: true, layout: "docs", navGroup: "" }],
  }));
  assert.throws(() => inspectProject(folder), /Invalid navigation group/);
}));
