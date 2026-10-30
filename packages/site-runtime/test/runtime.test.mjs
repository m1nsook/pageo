import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const script = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function execute({ mode = "system", stored = null, storageThrows = false } = {}) {
  const attributes = new Map();
  const listeners = {};
  const storage = new Map();
  const button = {
    textContent: "", title: "", className: "", type: "",
    setAttribute(key, value) { attributes.set(key, value); },
    addEventListener(event, fn) { this["on_" + event] = fn; },
  };
  const root = { dataset: { colorMode: mode } };
  const header = { appendChild(child) { assert.equal(child, button); } };
  const context = {
    document: {
      documentElement: root,
      querySelector(selector) { return selector === ".top-bar" ? header : null; },
      createElement(tag) { assert.equal(tag, "button"); return button; },
    },
    location: { href: "https://example.test/docs/index.html" },
    URL,
    localStorage: {
      getItem() { if (storageThrows) throw new Error("blocked"); return stored; },
      setItem(key, value) { if (storageThrows) throw new Error("blocked"); storage.set(key, value); },
    },
    addEventListener(name, fn) { listeners[name] = fn; },
    requestAnimationFrame(fn) { fn(); },
  };
  vm.runInNewContext(script, context);
  return { root, button, attributes, storage };
}

test("site runtime restores allowed stored appearance preferences", () => {
  const { root, button } = execute({ stored: "dark" });
  assert.equal(root.dataset.colorMode, "dark");
  assert.match(button.textContent, /Dark/);
});

test("site runtime refuses unknown stored values", () => {
  assert.equal(execute({ mode: "light", stored: "<script>" }).root.dataset.colorMode, "light");
});

test("site runtime cycles system, light, dark without a server", () => {
  const { root, button, storage } = execute();
  button.on_click();
  assert.equal(root.dataset.colorMode, "light");
  button.on_click();
  assert.equal(root.dataset.colorMode, "dark");
  assert.equal([...storage.values()][0], "dark");
});

test("site runtime works when browser storage is unavailable", () => {
  const { root, button } = execute({ storageThrows: true });
  button.on_click();
  assert.equal(root.dataset.colorMode, "light");
});
