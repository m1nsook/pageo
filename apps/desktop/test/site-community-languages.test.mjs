import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const i18n = readFileSync(new URL("../src/i18n/index.tsx", import.meta.url),"utf8");
const designer = readFileSync(new URL("../src/components/editor/site-designer.tsx", import.meta.url),"utf8");
const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url),"utf8");
const backend = readFileSync(new URL("../src-tauri/src/sites.rs", import.meta.url),"utf8");

test("reviewed locale packs automatically appear alongside legacy website languages", () => {
  assert.match(i18n,/export const DOCUMENT_LANGUAGES/);
  assert.match(i18n,/\.\.\.BUILT_IN_DOCUMENT_LANGUAGES/);
  assert.match(i18n,/LANGUAGES\.map\(\(\{ locale, nativeName \}\)/);
  assert.match(designer,/DOCUMENT_LANGUAGES\.map\(\(\{ code, label \}\)/);
  assert.match(site,/language: string;/);
  assert.doesNotMatch(designer,/\["en", "English"\], \["ko", "한국어"\]/);
});

test("Rust only accepts safe built-in or bundled language codes and reads direction metadata", () => {
  assert.match(backend,/fn safe_site_language_tag\(code: &str\) -> bool/);
  assert.match(backend,/PAGLORA_LOCALE_SOURCES\.iter\(\)\.any/);
  assert.match(backend,/!supported_site_language\(&settings\.language\)/);
  assert.match(backend,/fn site_text_direction\(language: &str\)/);
  assert.match(backend,/get\("direction"\)/);
  assert.match(backend,/let direction = site_text_direction\(language\)/);
  assert.match(backend,/return language\.replace\('-', "_"\)/);
  assert.match(backend,/Unsupported website content language/);
});
