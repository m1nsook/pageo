import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function element(tag = "div") {
  const attrs = new Map();
  const classes = new Set();
  return {
    tag, attrs, classes, children: [], listeners: {}, textContent: "",
    className: "", hidden: false, tabIndex: 0, focused: false,
    classList: { add(name) { classes.add(name); } },
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    appendChild(child) { this.children.push(child); },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    focus() { this.focused = true; },
  };
}

function run({ rtl = false, groups = 1, labels = null, stored = null, storageThrows = false } = {}) {
  const root = { dataset: { colorMode: "light" }, dir: rtl ? "rtl" : "ltr" };
  const header = element("header");
  const fixtures = Array.from({ length: groups }, (_, groupIndex) => {
    const group = element("section");
    group.attrs.set("aria-label", "Install");
    const container = element("div");
    const panels = (labels?.[groupIndex] ?? ["Bash", "PowerShell"]).map(labelText => {
      const panel = element("div");
      const label = element("div");
      label.textContent = labelText;
      panel.querySelector = selector => selector === ".paglora-code-group-label" ? label : null;
      return panel;
    });
    group.querySelectorAll = selector => selector === ".paglora-code-group-item" ? panels : [];
    group.querySelector = selector => selector === ".paglora-code-group-panels" ? container : null;
    container.before = node => { group.children.unshift(node); };
    group.children.push(container);
    return { group, panels };
  });
  const document = {
    documentElement: root,
    querySelector(selector) { return selector === ".top-bar" ? header : null; },
    querySelectorAll(selector) { return selector === ".docs .paglora-code-group" ? fixtures.map(f => f.group) : []; },
    createElement: element,
  };
  const storage = new Map();
  const listeners = {};
  const context = {
    document, URL, location: { href: "https://example.test/docs/index.html" },
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error("Storage disabled");
        return key.startsWith("paglora:code-language:") ? stored : null;
      },
      setItem(key, value) {
        if (storageThrows) throw new Error("Storage disabled");
        storage.set(key, value);
      },
    },
    addEventListener(name, fn) { listeners[name] = fn; },
    requestAnimationFrame(fn) { fn(); },
  };
  vm.runInNewContext(source, context);
  const rendered = fixtures.map(f => ({ ...f, tabs: f.group.children[0].children }));
  rendered.storage = storage;
  rendered.listeners = listeners;
  return rendered;
}

test("published code group starts with one accessible visible panel", () => {
  const [{ group, panels, tabs }] = run();
  assert.equal(group.classes.has("paglora-code-group-enhanced"), true);
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].attrs.get("role"), "tab");
  assert.equal(tabs[0].attrs.get("aria-selected"), "true");
  assert.equal(tabs[1].attrs.get("aria-selected"), "false");
  assert.equal(tabs[0].textContent, "Bash");
  assert.equal(tabs[1].textContent, "PowerShell");
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[1].hidden, true);
  assert.equal(panels[0].attrs.get("role"), "tabpanel");
  assert.equal(panels[0].attrs.get("aria-labelledby"), tabs[0].id);
  assert.equal(tabs[0].attrs.get("aria-controls"), panels[0].id);
  tabs[1].listeners.click();
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);
  assert.equal(tabs[1].tabIndex, 0);
  assert.equal(tabs[0].tabIndex, -1);
});

test("arrow keys, Home and End change tabs and move focus", () => {
  const [{ panels, tabs }] = run();
  let prevented = 0;
  const key = (tab, value) => tab.listeners.keydown({ key: value, preventDefault() { prevented++; } });
  key(tabs[0], "ArrowRight");
  assert.equal(panels[1].hidden, false);
  assert.equal(tabs[1].focused, true);
  key(tabs[1], "Home");
  assert.equal(panels[0].hidden, false);
  key(tabs[0], "End");
  assert.equal(panels[1].hidden, false);
  key(tabs[1], "ArrowRight");
  assert.equal(panels[0].hidden, false);
  assert.equal(prevented, 4);
});

test("RTL arrow direction reverses and multiple groups have unique IDs", () => {
  const [first, second] = run({ rtl: true, groups: 2 });
  first.tabs[0].listeners.keydown({ key: "ArrowLeft", preventDefault() {} });
  assert.equal(first.panels[1].hidden, false);
  assert.notEqual(first.tabs[0].id, second.tabs[0].id);
  assert.notEqual(first.panels[0].id, second.panels[0].id);
});

test("selecting a code language synchronizes matching groups and saves a site-scoped preference", () => {
  const rendered = run({
    groups: 3,
    labels: [["Bash", "PowerShell"], ["bash", "powershell"], ["Bash", "Fish"]],
  });
  rendered[0].tabs[1].listeners.click();
  assert.equal(rendered[0].panels[1].hidden, false);
  assert.equal(rendered[1].panels[1].hidden, false);
  assert.equal(rendered[1].tabs[1].attrs.get("aria-selected"), "true");
  assert.equal(rendered[1].tabs[1].focused, false, "synchronizing must not steal focus");
  assert.equal(rendered[2].panels[0].hidden, false, "unmatched groups stay unchanged");
  assert.equal(rendered.storage.get("paglora:code-language:/docs/"), "powershell");
  rendered[1].tabs[0].listeners.keydown({ key: "End", preventDefault() {} });
  assert.equal(rendered[0].panels[1].hidden, false);
  assert.equal(rendered[1].tabs[1].focused, true);
});

test("stored language preference restores on reload and storage failure never breaks tabs", () => {
  const restored = run({ stored: "  POWERSHELL  ", groups: 2 });
  assert.equal(restored[0].panels[1].hidden, false);
  assert.equal(restored[1].panels[1].hidden, false);
  const blocked = run({ storageThrows: true, groups: 2 });
  blocked[0].tabs[1].listeners.click();
  assert.equal(blocked[1].panels[1].hidden, false);
  assert.equal(blocked.storage.size, 0);
});

test("cross-tab preferences stay site-scoped and never apply invalid or missing labels", () => {
  const rendered = run({ groups: 2 });
  rendered.listeners.storage({ key: "paglora:code-language:/elsewhere/", newValue: "powershell" });
  assert.equal(rendered[0].panels[0].hidden, false);
  rendered.listeners.storage({ key: "paglora:code-language:/docs/", newValue: "powershell" });
  assert.equal(rendered[0].panels[1].hidden, false);
  assert.equal(rendered[1].panels[1].hidden, false);
  rendered.listeners.storage({ key: "paglora:code-language:/docs/", newValue: "not-an-example" });
  assert.equal(rendered[0].panels[1].hidden, false, "unknown labels must not hide examples");
  rendered.listeners.storage({ key: "paglora:code-language:/docs/", newValue: null });
  assert.equal(rendered[0].panels[0].hidden, false, "clearing preference resets to first example");
  assert.equal(rendered[1].panels[0].hidden, false);
});

test("a group with no valid labels keeps local keyboard navigation without persisting", () => {
  const rendered = run({ labels: [["", ""]] });
  rendered[0].tabs[1].listeners.keydown({ key: "ArrowLeft", preventDefault() {} });
  rendered[0].tabs[1].listeners.click();
  assert.equal(rendered[0].panels[1].hidden, false);
  assert.equal(rendered.storage.size, 0);
});

test("an unmatched saved language still starts with exactly one visible example", () => {
  const rendered = run({ stored: "python", groups: 2 });
  for (const { panels, tabs } of rendered) {
    assert.equal(panels[0].hidden, false);
    assert.equal(panels[1].hidden, true);
    assert.equal(tabs[0].attrs.get("aria-selected"), "true");
    assert.equal(tabs[1].attrs.get("aria-selected"), "false");
  }
  const oversized = run({ stored: "x".repeat(1000) });
  assert.equal(oversized[0].panels[0].hidden, false);
  assert.equal(oversized[0].panels[1].hidden, true);
});
