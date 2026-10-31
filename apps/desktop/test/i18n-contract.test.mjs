import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/i18n/index.tsx",import.meta.url),"utf8");
const settings = readFileSync(new URL("../src/components/studio/workspace-content.tsx",import.meta.url),"utf8");
const main = readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const packs = ["en","pl","ko"].map(locale=>JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`,import.meta.url),"utf8")));
test("bundled translations use common placeholders and canonical keys",()=>{
  const en=packs[0].messages;
  const placeholders=s=>[...s.matchAll(/\{([a-z][a-zA-Z0-9_]*)\}/g)].map(x=>x[1]).sort();
  for(const pack of packs.slice(1))for(const [key,value] of Object.entries(pack.messages)){
    assert.ok(Object.hasOwn(en,key),key);
    assert.deepEqual(placeholders(value),placeholders(en[key]));
  }
});
test("Studio language picker is persistent and falls back to English",()=>{
  assert.match(source,/import\.meta\.glob<LocaleCatalog>/);
  assert.match(source,/paglora:studio-locale/);
  assert.match(source,/catalogs\.en\?\.messages\[key\]/);
  assert.match(settings,/onValueChange=\{setLocale\}/);
  assert.match(main,/<TranslationProvider>/);
});
