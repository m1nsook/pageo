import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const packs=["en","ko","pl"].map(name=>JSON.parse(read(`src/i18n/locales/${name}.json`)).messages);
test("three bundled languages have complete storage/shortcut messages and matching interpolation",()=>{
 const en=packs[0],keys=Object.keys(en).filter(k=>k.startsWith("studio.shortcuts.")||k.startsWith("studio.storage."));
 assert.ok(keys.length>40);
 const tokens=s=>[...s.matchAll(/\{([a-z][a-zA-Z0-9_]*)\}/g)].map(x=>x[1]).sort();
 for(const catalog of packs)for(const key of keys) {
  assert.ok(typeof catalog[key]==="string"&&catalog[key].trim(),key);
  assert.deepEqual(tokens(catalog[key]),tokens(en[key]),key);
 }
});
test("recorder and Settings use localized strings without changing keyboard logic",()=>{
 const source=read("src/components/studio/studio-shortcut-settings.tsx");
 assert.match(source,/useTranslation/);
 assert.match(source,/localizedCommand/);
 assert.match(source,/shortcutFromEvent\(event\.nativeEvent\)/);
 assert.match(read("src/components/studio/workspace-content.tsx"),/t\("studio\.storage\.offlineHelp"\)/);
});
