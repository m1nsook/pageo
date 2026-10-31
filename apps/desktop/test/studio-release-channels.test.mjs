import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const script=fileURLToPath(new URL("../../../scripts/check-desktop-release.mjs",import.meta.url));
test("stable release requires matching actual version and curated content",()=>{
  const good=spawnSync(process.execPath,[script,"0.2.0"],{cwd:root,encoding:"utf8"});
  assert.equal(good.status,0,good.stderr);
  for(const bad of ["nightly","0.2.1","0.2.0-nightly.17",""]){
    const checked=spawnSync(process.execPath,[script,bad],{cwd:root,encoding:"utf8"});
    assert.notEqual(checked.status,0,bad);
  }
});
test("nightly creates no releases; stable always dispatches and drafts",()=>{
  const nightly=read("../../../.github/workflows/nightly-studio.yml");
  const release=read("../../../.github/workflows/release-studio.yml");
  assert.match(nightly,/upload-artifact@v4/);
  assert.doesNotMatch(nightly,/tauri-apps\/tauri-action|action-gh-release/);
  assert.match(release,/workflow_dispatch:/);
  assert.doesNotMatch(release,/on:\s*\n\s*push:/);
  assert.match(release,/releaseDraft: true/);
  assert.match(release,/check-desktop-release\.mjs/);
});
test("What's New shows actual curated release notes, including deprecated and removed",()=>{
  const info=read("../src/lib/release-notes.ts");
  const settings=read("../src/components/studio/workspace-content.tsx");
  const md=read("../../../.github/releases/v0.2.0.md");
  assert.match(info,/parseReleaseNotes/);
  assert.match(settings,/RELEASE_NOTES\.map/);
  for(const heading of ["Added","Improved","Fixed","Deprecated","Removed","Known limitations"]){
    assert.ok(md.includes("## "+heading),heading);
  }
});
