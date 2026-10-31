import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=path=>readFileSync(join(root,path),"utf8");
const tauri=JSON.parse(read("apps/desktop/src-tauri/tauri.conf.json"));
const cargo=read("apps/desktop/src-tauri/Cargo.toml");
const rust=read("apps/desktop/src-tauri/src/lib.rs");
const missing=[];
if(tauri.bundle?.createUpdaterArtifacts!==true)missing.push("Tauri bundle.createUpdaterArtifacts must be true");
if(typeof tauri.plugins?.updater?.pubkey!=="string"||tauri.plugins.updater.pubkey.trim().length<20)
  missing.push("Tauri updater requires a real embedded public signing key");
if(!tauri.plugins?.updater?.endpoints?.some(s=>s==="https://github.com/m1nsook/paglora/releases/latest/download/latest.json"))
  missing.push("Tauri updater must target stable GitHub Releases latest.json");
const frontend=read("apps/desktop/src/components/studio/studio-updater.tsx");
if(!frontend.includes("checkStudioUpdate") || !frontend.includes("installStudioUpdate"))
  missing.push("Studio signed-update UI is missing");
if(!cargo.includes("tauri-plugin-updater"))missing.push("Rust updater plugin is not installed");
if(!rust.includes("tauri_plugin_updater") || !rust.includes("updates::check_studio_update"))
  missing.push("Rust updater plugin or commands are not initialized");
if(!process.env.TAURI_SIGNING_PRIVATE_KEY)
  missing.push("GitHub Actions TAURI_SIGNING_PRIVATE_KEY secret is missing");
if(missing.length) {
 console.error("Refusing an unsigned or non-updateable stable release:\n- "+missing.join("\n- "));
 process.exit(1);
}
console.log("Updater key and plugin configuration present; proceed with signed stable installer.");
