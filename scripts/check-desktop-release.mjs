import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const version=process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("A real release requires an explicit stable version X.Y.Z.");
  process.exit(1);
}
const file=path=>readFileSync(join(root,path),"utf8");
const cargo=file("apps/desktop/src-tauri/Cargo.toml");
const cargoVer=/^\[package\]\r?\n(?:[^\[]|\[(?!))*/m.exec(cargo)?.[0].match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions={
  workspace:JSON.parse(file("package.json")).version,
  desktop:JSON.parse(file("apps/desktop/package.json")).version,
  tauri:JSON.parse(file("apps/desktop/src-tauri/tauri.conf.json")).version,
  rust:cargoVer
};
for(const [name,v] of Object.entries(versions))if(v!==version)throw Error(name+" version "+v+" does not match "+version);
const release=join(root,".github/releases/v"+version+".md");
if(!existsSync(release))throw Error("Curated release notes missing: "+release);
const text=file(".github/releases/v"+version+".md");
for(const name of ["Added","Improved","Fixed","Deprecated","Removed","Known limitations"]) {
  if(!text.split("\n").some(line=>line.trim()==="## "+name))throw Error("Missing release notes section: "+name);
}
if(/\b(TODO|TBD|INSERT HERE)\b/i.test(text))throw Error("Unfinished release notes");
console.log("Studio version and release notes ready: v"+version);
