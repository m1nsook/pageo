import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const tool = fileURLToPath(new URL("../render.mjs", import.meta.url));

function prepare(markdown) {
  const temp = mkdtempSync(join(tmpdir(), "paglora-badges-"));
  const project = join(temp, "project");
  const output = join(temp, "rendered.json");
  mkdirSync(join(project, "docs"), { recursive: true });
  writeFileSync(join(project, "paglora.json"), JSON.stringify({
    formatVersion: 1, id: "project", name: "Badge Docs", createdAt: 1, updatedAt: 1,
  }));
  writeFileSync(join(project, "pages.json"), JSON.stringify({
    formatVersion: 1, pages: [
      { id: "index", title: "Public", isPublic: true, layout: "docs", navGroup: "Guide" },
      { id: "secret", title: "Secret", isPublic: false, layout: "docs", navGroup: "Guide" },
    ],
  }));
  writeFileSync(join(project, "site.json"), JSON.stringify({ title: "Badge Docs", language: "en" }));
  writeFileSync(join(project, "docs", "index.md"), markdown);
  writeFileSync(join(project, "docs", "secret.md"), "# Private\n\nInternal release token");
  try {
    execFileSync(process.execPath, [tool, project, output], { encoding: "utf8" });
    return JSON.parse(readFileSync(output, "utf8"));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("headless publishes five accessible badge variants and excludes private text", () => {
  const pages = prepare([
    "# Releases", "",
    "> [!BADGES] Release status", ">",
    "> - [success] Stable", "> - [info] Offline ready",
    "> - [warning] Experimental", "> - [danger] Deprecated",
    "> - Plain status", "",
    "## More details", "",
    "<script>alert('unsafe')</script>",
  ].join("\n"));
  assert.equal(pages.length, 1);
  const { html, searchText } = pages[0];
  assert.match(html, /class="paglora-badges"/);
  assert.match(html, /aria-label="Release status"/);
  for (const variant of ["success", "info", "warning", "danger", "neutral"]) {
    assert.match(html, new RegExp("paglora-badge-" + variant));
  }
  assert.equal((html.match(/class="paglora-badge paglora-badge-/g) || []).length, 5);
  assert.match(searchText, /Offline ready/);
  assert.doesNotMatch(html, /<script|onclick=|onerror=/i);
  assert.doesNotMatch(searchText, /Internal release token/);
});

test("malformed badges stay readable instead of discarding author content", () => {
  const pages = prepare([
    "# Bad badges", "",
    "> [!BADGES] Keep this visible", ">",
    "> - [unsupported] Custom label", "> - [success] Valid label", "",
    "> [!BADGES] Invalid rich label", ">",
    "> - [success] **Important**", "",
    "> [!BADGES] Empty", "",
    "> - [success] ", "",
    "> [!BADGES] Valid", ">",
    "> - [success] Visible",
  ].join("\n"));
  const html = pages[0].html;
  assert.match(html, /\[!BADGES\] Keep this visible/);
  assert.match(html, /\[unsupported\] Custom label/);
  assert.match(html, /Important/);
  assert.match(html, /\[!BADGES\] Empty/);
  assert.match(html, /paglora-badge-success/);
  assert.equal((html.match(/class="paglora-badges"/g) || []).length, 1);
});
