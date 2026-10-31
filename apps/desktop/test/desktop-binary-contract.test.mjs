import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const cargo=readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url),"utf8");
const config=JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json",import.meta.url),"utf8"));
test("Tauri dev selects the desktop binary even when headless builder is present",()=>{
  assert.match(cargo,/^\[package\][\s\S]*?^default-run\s*=\s*"paglora"/m);
  assert.match(cargo,/^name\s*=\s*"paglora"/m);
  assert.equal(config.productName,"Paglora");
});
