import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const src = (path) => readFileSync(new URL(path, import.meta.url),"utf8");
const config = JSON.parse(src("../src-tauri/tauri.conf.json"));
const rust = src("../src-tauri/src/updates.rs");
const lib = src("../src-tauri/src/lib.rs");
const app = src("../src/App.tsx");
const frontend = src("../src/components/studio/studio-updater.tsx");
const settings = src("../src/components/studio/workspace-content.tsx");
test("signed stable updates use a real embedded minisign key, HTTPS and NSIS",()=>{
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.endpoints[0],
    "https://github.com/m1nsook/paglora/releases/latest/download/latest.json");
  const key = config.plugins.updater.pubkey;
  const decoded = Buffer.from(key,"base64").toString("utf8");
  assert.match(decoded,/^untrusted comment: minisign public key:/);
  assert.match(decoded,/\nRW[a-zA-Z0-9+/=]+\n?$/);
  assert.deepEqual(config.bundle.targets,["nsis"]);
});
test("Rust validates available release again and downloads only signed update",()=>{
  assert.match(lib,/tauri_plugin_updater::Builder::new\(\)\.build\(\)/);
  assert.match(lib,/updates::check_studio_update, updates::install_studio_update/);
  assert.match(rust,/expected_version/);
  assert.match(rust,/available\.version != expected_version/);
  assert.match(rust,/download_and_install/);
});
test("installed Studio checks on launch and offers explicit installation",()=>{
  assert.match(app,/<StudioUpdateDialog updater=\{updater\}\/>/);
  assert.match(frontend,/useEffect\(\(\) => \{ void check\(false\); \}/);
  assert.match(frontend,/if \(!desktop \|\| import\.meta\.env\.DEV\)/);
  assert.match(frontend,/onClick=\{\(\) => void updater\.install\(\)\}/);
  assert.match(settings,/updater\.check\(true\)/);
});
