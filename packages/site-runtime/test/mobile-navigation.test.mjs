import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function fixture() {
  const listeners = {};
  const documentListeners = {};
  const navListeners = {};
  const css = new Map();
  let headerHeight = 64;
  let focused = 0;
  let resizeObserver;
  const summary = { focus() { focused++; } };
  const insideLink = { closest(selector) { return selector === "a[href]" ? this : null; } };
  const nav = {
    open: false,
    style: { setProperty(key, value) { css.set(key, value); } },
    querySelector(selector) { assert.equal(selector, ":scope > summary"); return summary; },
    addEventListener(name, fn) { navListeners[name] = fn; },
    contains(target) { return target === summary || target === insideLink || target === this; },
  };
  const header = { getBoundingClientRect() { return { height: headerHeight }; } };
  const appearance = { setAttribute() {}, addEventListener() {} };
  const context = {
    URL,
    location: { href: "https://example.test/docs/index.html" },
    localStorage: { getItem() { return null; } },
    document: {
      documentElement: { dataset: { colorMode: "system" } },
      querySelector(selector) {
        if (selector === ".top-bar") return { appendChild() {} };
        if (selector === ".mobile-nav") return nav;
        if (selector === ".site-header") return header;
        return null;
      },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      createElement() { return appearance; },
      addEventListener(name, fn) { documentListeners[name] = fn; },
    },
    ResizeObserver: class {
      constructor(fn) { resizeObserver = fn; }
      observe(target) { assert.equal(target, header); }
    },
    addEventListener(name, fn) { listeners[name] = fn; },
    requestAnimationFrame(fn) { fn(); },
    innerWidth: 390,
  };
  vm.runInNewContext(source, context);
  return {
    nav, navListeners, documentListeners, listeners, css, summary, insideLink,
    focused: () => focused,
    setHeaderHeight(value) { headerHeight = value; resizeObserver(); },
    setWidth(value) { context.innerWidth = value; listeners.resize(); },
  };
}

test("mobile navigation measures a wrapping header and follows its height", () => {
  const app = fixture();
  assert.equal(app.css.get("--paglora-header-height"), "64px");
  app.setHeaderHeight(93.3);
  assert.equal(app.css.get("--paglora-header-height"), "94px");
  app.setHeaderHeight(1000);
  assert.equal(app.css.get("--paglora-header-height"), "94px", "invalid measurements do not shift the panel");
});

test("Escape dismisses an open Browse panel and returns keyboard focus", () => {
  const app = fixture();
  app.nav.open = true;
  let prevented = 0;
  app.navListeners.keydown({ key: "Escape", preventDefault() { prevented++; } });
  assert.equal(app.nav.open, false);
  assert.equal(app.focused(), 1);
  assert.equal(prevented, 1);
  app.navListeners.keydown({ key: "Escape", preventDefault() { prevented++; } });
  assert.equal(prevented, 1, "closed navigation does not consume Escape");
});

test("outside pointer clicks dismiss Browse without interfering with internal controls", () => {
  const app = fixture();
  app.nav.open = true;
  app.documentListeners.pointerdown({ target: app.insideLink });
  assert.equal(app.nav.open, true);
  app.documentListeners.pointerdown({ target: {} });
  assert.equal(app.nav.open, false);
  app.nav.open = true;
  app.navListeners.click({ target: app.insideLink });
  assert.equal(app.nav.open, false, "selecting a page closes the navigation panel");
  app.nav.open = true;
  app.navListeners.click({ target: { closest() { return null; } } });
  assert.equal(app.nav.open, true, "expanding a navigation group does not close Browse");
});

test("switching to desktop width closes the hidden mobile panel", () => {
  const app = fixture();
  app.nav.open = true;
  app.setWidth(801);
  assert.equal(app.nav.open, false);
});

test("static export includes script-free mobile navigation styles", () => {
  const rust = readFileSync(new URL("../../../apps/desktop/src-tauri/src/sites.rs", import.meta.url), "utf8");
  assert.match(rust, /<details class=\\"mobile-nav\\"><summary>/);
  assert.match(rust, /\.mobile-nav-inner\{position:absolute;top:100%/);
  assert.match(rust, /\.mobile-nav:not\(\[open\]\) \.mobile-nav-inner\{display:none\}/);
  assert.match(rust, /\.mobile-nav summary:focus-visible\{outline:/);
});
