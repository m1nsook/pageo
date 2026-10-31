import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectProject, initProject, run } from "../bin/paglora.mjs";

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

test("init creates a fully valid Paglora project with source files", () => {
  const root = mkdtempSync(join(tmpdir(), "paglora-init-"));
  const target = join(root, "new-docs");
  try {
    const project = initProject(target, "My New Docs");
    assert.equal(project.name, "My New Docs");
    assert.equal(project.pages[0].layout, "docs");
    assert.equal(project.pages[0].navGroup, "Documentation");
    assert.equal(project.pageCount, 1);
    assert.match(readFileSync(join(target, "docs", "index.md"), "utf8"), /# My New Docs/);
    assert.match(readFileSync(join(target, "theme", "custom.css"), "utf8"), /Paglora/);
    assert.deepEqual(inspectProject(target), project);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("init never overwrites an existing directory", () => {
  const root = mkdtempSync(join(tmpdir(), "paglora-init-"));
  try {
    const target = join(root, "existing");
    mkdirSync(target);
    writeFileSync(join(target, "do-not-touch.txt"), "keep");
    assert.throws(() => initProject(target), /already exists/);
    assert.equal(readFileSync(join(target, "do-not-touch.txt"), "utf8"), "keep");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("init validates folder names and display names before writing", () => {
  const root = mkdtempSync(join(tmpdir(), "paglora-init-"));
  try {
    assert.throws(() => initProject(join(root, "Bad Name")), /lowercase slug/);
    assert.throws(() => initProject(join(root, "valid"), "   "), /Project name/);
    assert.equal(existsSync(join(root, "Bad Name")), false);
    assert.equal(existsSync(join(root, "valid")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("init CLI and validate --json round trip", () => {
  const root = mkdtempSync(join(tmpdir(), "paglora-init-"));
  const target = join(root, "my-docs");
  try {
    let out = "", err = "";
    const output = { write: value => { out += value; } };
    const errors = { write: value => { err += value; } };
    assert.equal(run(["init", target, "--name", "My Docs"], output, errors), 0);
    assert.match(out, /Created Paglora project: My Docs/);
    out = "";
    assert.equal(run(["validate", target, "--json"], output, errors), 0);
    assert.equal(JSON.parse(out).pages[0].navGroup, "Documentation");
    assert.equal(err, "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("CLI validation rejects control characters and overlong project labels", () => fixture(folder => {
  const config = JSON.parse(readFileSync(join(folder, "paglora.json"), "utf8"));
  config.name = "Docs\u0085Secret";
  writeFileSync(join(folder, "paglora.json"), JSON.stringify(config));
  assert.throws(() => inspectProject(folder), /Invalid paglora.json/);
  config.name = "My Docs";
  writeFileSync(join(folder, "paglora.json"), JSON.stringify(config));

  const manifest = JSON.parse(readFileSync(join(folder, "pages.json"), "utf8"));
  manifest.pages[0].title = "Title\u0000Hidden";
  writeFileSync(join(folder, "pages.json"), JSON.stringify(manifest));
  assert.throws(() => inspectProject(folder), /Invalid page identifier/);
  manifest.pages[0].title = "Overview";
  manifest.pages[0].navGroup = "Docs\u0085Secret";
  writeFileSync(join(folder, "pages.json"), JSON.stringify(manifest));
  assert.throws(() => inspectProject(folder), /Invalid navigation group/);

  manifest.pages[0].navGroup = "Documentation";
  writeFileSync(join(folder, "pages.json"), JSON.stringify(manifest));
  writeFileSync(join(folder, "site.json"), JSON.stringify({ title: "S".repeat(101) }));
  assert.throws(() => inspectProject(folder), /Invalid site.json/);
}));

test("CLI counts Unicode characters rather than UTF-16 units", () => fixture(folder => {
  const manifest = JSON.parse(readFileSync(join(folder, "pages.json"), "utf8"));
  manifest.pages[0].title = "📘".repeat(100);
  manifest.pages[0].navGroup = "🗂".repeat(60);
  writeFileSync(join(folder, "pages.json"), JSON.stringify(manifest));
  const info = inspectProject(folder);
  assert.equal(info.pages[0].title, manifest.pages[0].title);
  assert.equal(info.pages[0].navGroup, manifest.pages[0].navGroup);
}));


test("init accepts --name before the project folder without confusing its value for a path", () => {
  const root = mkdtempSync(join(tmpdir(), "paglora-init-flags-"));
  const target = join(root, "flagged-docs");
  try {
    let output = "", errors = "";
    assert.equal(run(["init", "--name", "My Flagged Docs", target], { write: text => { output += text; } }, { write: text => { errors += text; } }), 0);
    assert.equal(inspectProject(target).name, "My Flagged Docs");
    assert.match(output, /Created Paglora project/);
    assert.equal(errors, "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("init rejects missing folders, duplicate flags and extra positional arguments before writing", () => {
  const root = mkdtempSync(join(tmpdir(), "paglora-init-flags-"));
  const target = join(root, "safe-docs");
  try {
    for (const args of [
      ["init", "--name", "Only a name"],
      ["init", target, "--name"],
      ["init", target, "--name", "First", "--name", "Second"],
      ["init", target, "--unknown"],
      ["init", target, "extra-folder"],
    ]) {
      let errors = "";
      assert.equal(run(args, { write() {} }, { write: text => { errors += text; } }), 1);
      assert.match(errors, /Usage: paglora init/);
      assert.equal(existsSync(target), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("inspect and validate reject unknown flags, duplicate flags and extra folders", () => fixture(folder => {
  for (const args of [
    ["inspect", folder, "--unknown"],
    ["inspect", folder, "--json", "--json"],
    ["inspect", folder, "extra-folder"],
    ["validate", folder, "extra-folder"],
    ["validate", "--unknown", folder],
  ]) {
    let output = "", errors = "";
    assert.equal(run(args, { write: value => { output += value; } }, { write: value => { errors += value; } }), 1);
    assert.equal(output, "");
    assert.match(errors, /Usage: paglora (inspect|validate)/);
  }
  let output = "", errors = "";
  assert.equal(run(["validate", "--json", folder], { write: value => { output += value; } }, { write: value => { errors += value; } }), 0);
  assert.equal(JSON.parse(output).id, "my-docs");
  assert.equal(errors, "");
}));
