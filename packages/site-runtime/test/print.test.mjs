import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const rust = readFileSync(new URL("../../../apps/desktop/src-tauri/src/sites.rs", import.meta.url), "utf8");

function fixture() {
  const listeners = new Map();
  const disclosures = [{ open: false }, { open: true }, { open: false }];
  const panels = [{ hidden: true }, { hidden: false }, { hidden: true }];
  const doc = {
    documentElement: { dataset: { colorMode: "dark" } },
    querySelector(selector) {
      if (selector === ".top-bar") return { appendChild() {} };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".docs details") return disclosures;
      if (selector === ".docs .paglora-code-group-item, .docs .paglora-tabs-item") return panels;
      return [];
    },
    getElementById() { return null; },
    createElement() { return { setAttribute() {}, addEventListener() {}, textContent: "" }; },
  };
  vm.runInNewContext(script, {
    document: doc, URL, location: { href: "https://docs.example.test/index.html" },
    localStorage: { getItem() { return null; } },
    addEventListener(name, fn) { if (name !== "storage") throw new Error("unexpected global listener " + name); },
    window: { addEventListener(name, fn) { listeners.set(name, fn); } },
    requestAnimationFrame(fn) { fn(); },
  });
  return { listeners, disclosures, panels };
}

test("browser print expands every article disclosure and code/content tab without touching navigation", () => {
  const { listeners, disclosures, panels } = fixture();
  assert.equal(typeof listeners.get("beforeprint"), "function");
  assert.equal(typeof listeners.get("afterprint"), "function");
  listeners.get("beforeprint")();
  assert.deepEqual(disclosures.map(node => node.open), [true, true, true]);
  assert.deepEqual(panels.map(node => node.hidden), [false, false, false]);
  listeners.get("beforeprint")();
  listeners.get("afterprint")();
  assert.deepEqual(disclosures.map(node => node.open), [false, true, false]);
  assert.deepEqual(panels.map(node => node.hidden), [true, false, true]);
});

test("print state can be restored and printed again without losing reader selections", () => {
  const { listeners, disclosures, panels } = fixture();
  listeners.get("afterprint")(); // no beforeprint: harmless
  listeners.get("beforeprint")();
  listeners.get("afterprint")();
  disclosures[0].open = true;
  panels[0].hidden = false;
  panels[1].hidden = true;
  listeners.get("beforeprint")();
  listeners.get("afterprint")();
  assert.deepEqual(disclosures.map(node => node.open), [true, true, false]);
  assert.deepEqual(panels.map(node => node.hidden), [false, true, true]);
});

test("exported site has print-only, high-contrast, layout-independent article styling", () => {
  const css = rust.match(/const SITE_CSS: &str = r#"([\s\S]*?)"#;/)?.[1];
  assert.ok(css, "site CSS must be embedded in the native export");
  const print = css.slice(css.indexOf("@media print{"));
  assert.ok(print.startsWith("@media print{"), "print rules must exist");
  for (const selector of [
    ".site-header", ".mobile-nav", ".site-nav", ".on-this-page",
    ".mobile-toc", ".site-footer", ".page-pager", ".paglora-copy-code",
  ]) assert.ok(print.includes(selector), selector + " must be hidden in print");
  assert.match(print, /:root \.site-body\.nav-right/);
  assert.match(print, /:root \.site-body\.nav-top/);
  assert.match(print, /:root \.layout-landing \.site-main/);
  assert.match(print, /\.docs pre[\s\S]*?white-space:pre-wrap!important/);
  assert.match(print, /\.docs table\{display:table!important/);
  assert.match(print, /\.docs \.paglora-code-group-item\[hidden\],\.docs \.paglora-tabs-item\[hidden\]\{display:block!important\}/);
  assert.match(print, /color-scheme:light!important/);
});
