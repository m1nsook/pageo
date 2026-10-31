// Validate the actual npm tarball, not just the source checkout.
// This script is deliberately separate from the normal unit-test glob.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const metadata = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const temporary = mkdtempSync(join(tmpdir(), "paglora-pack-smoke-"));
try {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const packed = JSON.parse(execFileSync(npm, [
    "pack", "--json", "--pack-destination", temporary, packageDir,
  ], { encoding: "utf8", shell: process.platform === "win32" }));
  assert.equal(packed.length, 1);
  assert.equal(packed[0].name, metadata.name);
  assert.equal(packed[0].version, metadata.version);
  const entries = new Set(packed[0].files.map(file => file.path));
  for (const path of ["package.json", "README.md", "bin/paglora.mjs"]) {
    assert.ok(entries.has(path), `Missing file in npm archive: ${path}`);
  }
  const tarball = join(temporary, packed[0].filename);
  assert.ok(existsSync(tarball), "npm pack did not produce a tarball");
  execFileSync("tar", ["-xzf", tarball, "-C", temporary]);
  const bin = join(temporary, "package", "bin", "paglora.mjs");
  const version = execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" }).trim();
  assert.equal(version, metadata.version);
  const project = join(temporary, "packed-docs");
  execFileSync(process.execPath, [bin, "init", project, "--name", "Packed CLI"], { encoding: "utf8" });
  const validation = execFileSync(process.execPath, [bin, "validate", project], { encoding: "utf8" });
  assert.match(validation, /Valid documentation project: Packed CLI/);
  console.log(`Packed ${metadata.name}@${metadata.version}: CLI entrypoint and project round trip passed`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
