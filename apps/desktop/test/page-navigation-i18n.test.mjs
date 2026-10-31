import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page = readFileSync(new URL("../src/components/editor/page-navigation.tsx", import.meta.url), "utf8");
const packs = Object.fromEntries(["en", "pl", "ko"].map(locale =>
 [locale, JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), "utf8"))]));
const placeholders = value => [...value.matchAll(/\{([a-z][a-zA-Z0-9_]*)\}/g)].map(m => m[1]).sort();
test("page navigation dialogs, accessibility labels and actions use translation keys", () => {
  assert.match(page, /useTranslation\(\)/);
  for (const id of ["createTitle","renameTitle","createDescription","deleteDescription","deleteQuestion","pageLayout","makePrivate","makePublic","publicCount","dragHint","expandGroup","collapseGroup","dragToReorder","privatePage"]) {
    assert.match(page, new RegExp('studio\\.pages\\.'+id),id);
  }
  assert.doesNotMatch(page, /aria-label="(?:Create page|Page navigation|Documentation pages|Private page)"/);
  assert.doesNotMatch(page, />Delete page<|>Rename page<|>Create page</);
});
test("page-management catalogs preserve the full reviewed message contract", () => {
  const en = packs.en.messages;
  const keys = Object.keys(en).filter(k => k.startsWith("studio.pages."));
  assert.equal(keys.length,39);
  for (const locale of ["pl","ko"]) for (const key of keys) {
    assert.equal(typeof packs[locale].messages[key],"string",locale+" "+key);
    assert.deepEqual(placeholders(packs[locale].messages[key]),placeholders(en[key]),key);
  }
});
