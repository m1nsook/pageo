import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const backend = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url), "utf8");
const browser = readFileSync(new URL("../../../packages/site-runtime/src/index.js", import.meta.url), "utf8");
const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"));
const pl = JSON.parse(readFileSync(new URL("../src/i18n/locales/pl.json", import.meta.url), "utf8"));

test("website localizes static chrome using reviewed catalogs, never untrusted code", () => {
  assert.match(backend, /include!\("locale_catalogs.rs"\)/);
  assert.match(backend, /website_messages\(&settings\.language\)/);
  assert.match(backend, /id="paglora-i18n"/);
  assert.match(backend, /\.replace\('<',/);
  assert.match(browser, /getElementById\?\.\("paglora-i18n"\)/);
  assert.match(browser, /site\.copy\.copyLabel/);
  assert.equal(pl.messages["site.navigation.browse"], "Przeglądaj dokumentację");
  assert.equal(en.messages["site.navigation.skip"], "Skip to content");
});
test("Markdown callout headings follow site content language, not Studio preference", () => {
  assert.match(site, /enhanceCallouts\(container, language\)/);
  assert.match(site, /translate\(language, "docs\.callout\.note"\)/);
  assert.match(site, /renderPageContent\(html, settings\.language\)/);
});
