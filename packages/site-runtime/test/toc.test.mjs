import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function fixture() {
  const listeners = {};
  const headings = new Map();
  const links = [];
  function link(href) {
    const attrs = new Map([["href", href]]);
    const node = {
      attrs,
      getAttribute(name) { return attrs.get(name); },
      setAttribute(name, value) { attrs.set(name, value); },
      removeAttribute(name) { attrs.delete(name); },
    };
    links.push(node);
    return node;
  }
  const desktopLinks = [link("#first"), link("#cafe%CC%81"), link("#%ZZ")];
  const mobileLinks = [link("#first"), link("#cafe%CC%81")];
  let secondTop = 200;
  headings.set("first", { getBoundingClientRect() { return { top: 50 }; } });
  headings.set("café", { getBoundingClientRect() { return { top: secondTop }; } });
  const desktop = { querySelectorAll() { return desktopLinks; } };
  const mobile = {
    open: true, events: {},
    querySelectorAll() { return mobileLinks; },
    addEventListener(name, fn) { this.events[name] = fn; },
  };
  const document = {
    documentElement: { dataset: { colorMode: "system" } },
    querySelector(selector) {
      if (selector === ".top-bar") return { appendChild() {} };
      if (selector === ".toc-inner") return desktop;
      if (selector === ".mobile-toc") return mobile;
      return null;
    },
    querySelectorAll() { return []; },
    getElementById(id) { return headings.get(id) ?? null; },
    createElement() { return { setAttribute() {}, addEventListener() {} }; },
  };
  vm.runInNewContext(source, {
    document, URL, decodeURIComponent,
    location: { href: "https://example.test/docs/index.html" },
    localStorage: { getItem() { return null; } },
    addEventListener(name, fn) { listeners[name] = fn; },
    requestAnimationFrame(fn) { fn(); },
  });
  return { desktopLinks, mobileLinks, mobile, listeners,
    moveSecond(top) { secondTop = top; listeners.scroll(); } };
}

test("desktop and mobile TOCs track the same active heading", () => {
  const app = fixture();
  assert.equal(app.desktopLinks[0].attrs.get("aria-current"), "location");
  assert.equal(app.mobileLinks[0].attrs.get("aria-current"), "location");
  app.moveSecond(90);
  assert.equal(app.desktopLinks[1].attrs.get("aria-current"), "location");
  assert.equal(app.mobileLinks[1].attrs.get("aria-current"), "location");
  assert.equal(app.desktopLinks[0].attrs.has("aria-current"), false);
  assert.equal(app.mobileLinks[0].attrs.has("aria-current"), false);
  assert.equal(app.desktopLinks[2].attrs.has("aria-current"), false, "malformed percent escapes are ignored");
});

test("mobile TOC closes after selecting a heading", () => {
  const app = fixture();
  app.mobile.events.click({ target: { closest(selector) { assert.equal(selector, 'a[href^="#"]'); return app.mobileLinks[1]; } } });
  assert.equal(app.mobile.open, false);
});
