import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const designer = readFileSync(new URL("../src/components/editor/site-designer.tsx", import.meta.url), "utf8");
const packs = Object.fromEntries(["en", "pl", "ko"].map(locale => [
  locale, JSON.parse(readFileSync(new URL("../src/i18n/locales/" + locale + ".json", import.meta.url), "utf8")),
]));
const placeholders = s => [...s.matchAll(/\{([a-z][a-zA-Z0-9_]*)\}/g)].map(match => match[1]).sort();

test("all reviewed Design site messages have consistent EN/PL/KO placeholders", () => {
  const en = packs.en.messages;
  const designKeys = Object.keys(en).filter(key => key.startsWith("studio.design."));
  assert.equal(designKeys.length, 91);
  for (const code of ["pl", "ko"]) {
    for (const key of designKeys) {
      assert.equal(typeof packs[code].messages[key], "string", code + " " + key);
      assert.deepEqual(placeholders(packs[code].messages[key]), placeholders(en[key]), key);
    }
  }
});

test("every designer message is used, including link editing and accessibility", () => {
  const keys = Object.keys(packs.en.messages).filter(key => key.startsWith("studio.design."));
  for (const key of keys) assert.ok(designer.includes(key), "Unused designer translation: " + key);
  assert.equal((designer.match(/useTranslation\(\)/g) ?? []).length, 2);
  assert.match(designer, /t\(layout\.name\)/);
  assert.match(designer, /t\(layout\.detail\)/);
  assert.match(designer, /t\(palette\.name\)/);
  assert.match(designer, /t\(color\.name\)/);
  assert.match(designer, /t\("studio\.design\.linkAria", \{ section: label, index: index \+ 1 \}\)/);
  assert.match(designer, /t\("studio\.design\.linkRemoveAria", \{ section: label, index: index \+ 1 \}\)/);
  assert.doesNotMatch(designer, /aria-label="(?:Website color mode|Website layout presets|Documentation card layout|Accent color presets|Article width)"/);
});

test("designer still saves the original site data, never translated enum IDs", () => {
  for (const key of ["siteLayout", "sitePalette", "cardLayout", "themeMode",
    "accentColor", "navigationPosition", "headerLinks", "footerLinks", "language"]) {
    assert.match(designer, new RegExp('patch\\("' + key + '"'));
  }
  assert.match(designer, /saveSiteSettings\(projectId, settings\)/);
  assert.match(designer, /previewPublicPage\(projectId, "index", settings\)/);
});
