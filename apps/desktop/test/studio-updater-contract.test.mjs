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
const packs = Object.fromEntries(["en", "pl", "ko"].map(l => [l, JSON.parse(src("../src/i18n/locales/"+l+".json")).messages]));
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
  assert.match(frontend,/startupChecked\.current = true; void check\(false\)/);
  assert.match(frontend,/if \(!desktop \|\| import\.meta\.env\.DEV\)/);
  assert.match(frontend,/onClick=\{\(\) => void updater\.install\(\)\}/);
  assert.match(settings,/updater\.check\(true\)/);
});

test("reviewed updater translations preserve placeholders",()=>{
 const english=packs.en;
 const keys=Object.keys(english).filter(k=>k.startsWith("studio.updater."));
 assert.equal(keys.length,14);
 const placeholders=s=>[...s.matchAll(/\{([a-z]+)\}/g)].map(x=>x[1]).sort();
 for(const key of keys){
   for(const lang of ["pl","ko"]){
     assert.equal(typeof packs[lang][key],"string",lang+" "+key);
     assert.deepEqual(placeholders(packs[lang][key]),placeholders(english[key]),key);
   }
 }
 assert.match(frontend,/useTranslation\(\)/);
});

test("nightly artifacts never require a stable signing key",()=>{
 const config=JSON.parse(src("../src-tauri/tauri.nightly.conf.json"));
 const nightly=src("../../../.github/workflows/nightly-studio.yml");
 assert.equal(config.bundle.createUpdaterArtifacts,false);
 assert.match(nightly,/tauri\.nightly\.conf\.json/);
});
