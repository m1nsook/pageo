import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const packs = Object.fromEntries(["en","pl","ko"].map(locale =>
  [locale,JSON.parse(readFileSync(new URL("../src/i18n/locales/"+locale+".json",import.meta.url),"utf8"))]));
const vars = s => [...s.matchAll(/\{([a-z][a-zA-Z0-9_]*)\}/g)].map(x=>x[1]).sort();
test("editor shell and project creation use reviewed locale keys",()=>{
  assert.match(source, /useTranslation\(\)/);
  for (const key of ["savedLocally","saving","saveFailed","unsaved","hidePages","showPages",
      "showTools","hideTools","hideProperties","showProperties","edit","split","canvas","saveError"]) {
    assert.ok(source.includes('studio.editor.'+key),key);
  }
  for(const key of ["createTitle","createDescription","projectName","cancel","create","desktopRequired"]) {
    assert.ok(source.includes('studio.projects.'+key),key);
  }
  assert.doesNotMatch(source, /aria-label="Back to projects"|aria-label="Editor view"|>Saved locally<|>Canvas<\/Button>/);
});
test("editor locale catalogs preserve dynamic error messages",()=>{
  const en=packs.en.messages;
  for(const lang of ["pl","ko"]) {
    for(const [key,value] of Object.entries(packs[lang].messages)) {
      assert.ok(Object.hasOwn(en,key),key);
      assert.deepEqual(vars(value),vars(en[key]),key);
    }
    assert.match(packs[lang].messages["studio.editor.saveError"],/\{message\}/);
  }
});
