import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function createDom({ clipboardAvailable = true, headingLevel = 2 } = {}) {
  const attributes = new Map();
  const pre = { children: [], classList: { add(name) { assert.equal(name, "paglora-has-copy"); } }, appendChild(child) { this.children.push(child); } };
  const code = { parentElement: pre, textContent: "curl https://example.test\n" };
  const heading = {
    textContent: "Getting Started",
    children: [],
    getAttribute(name) { return name === "id" ? "getting-started" : null; },
    appendChild(child) { this.children.push(child); },
  };
  const controls = [];
  const header = { appendChild(node) { controls.push(node); } };
  const document = {
    documentElement: { dataset: { colorMode: "system" } },
    querySelector(name) { return name === ".top-bar" ? header : null; },
    querySelectorAll(selector) {
      if (selector === ".docs pre > code") return [code];
      if (selector === ".docs h2[id], .docs h3[id], .docs h4[id]") return [2, 3, 4].includes(headingLevel) ? [heading] : [];
      return [];
    },
    createElement(tag) {
      return {
        tag, className: "", type: "", textContent: "",
        attributes: new Map(), listeners: {},
        setAttribute(name, value) { this.attributes.set(name, value); },
        addEventListener(name, fn) { this.listeners[name] = fn; },
      };
    },
  };
  const clipboard = [];
  const timers = new Map();
  let nextTimer = 0;
  const context = {
    document, URL, location: { href: "https://example.test/docs/index.html" },
    setTimeout(fn, delay) { assert.equal(delay, 2000); const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: { clipboard: clipboardAvailable ? { async writeText(value) { clipboard.push(value); } } : undefined },
  };
  vm.runInNewContext(source, context);
  return { pre, code, heading, controls, clipboard, attributes,
    flushTimers() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) fn(); },
    get pendingTimers() { return timers.size; },
  };
}

test("runtime adds a copy button to code with exact text", async () => {
  const { pre, code, clipboard } = createDom();
  const button = pre.children[0];
  assert.equal(button.textContent, "Copy");
  await button.listeners.click();
  assert.deepEqual(clipboard, [code.textContent]);
  assert.equal(button.textContent, "Copied");
});

test("copy button fails safely without clipboard access", async () => {
  const { pre } = createDom({ clipboardAvailable: false });
  await pre.children[0].listeners.click();
  assert.equal(pre.children[0].textContent, "Unavailable");
});

test("heading links use stable sanitized IDs and accessible names", () => {
  const { heading } = createDom();
  const link = heading.children[0];
  assert.equal(link.href, "#getting-started");
  assert.equal(link.textContent, "#");
  assert.equal(link.attributes.get("aria-label"), "Link to Getting Started");
});

test("copy feedback resets after two seconds, including unavailable clipboard", async () => {
  const app = createDom();
  const button = app.pre.children[0];
  await button.listeners.click();
  assert.equal(button.textContent, "Copied");
  assert.equal(button.attributes.get("aria-label"), "Code copied to clipboard");
  await button.listeners.click();
  assert.equal(app.pendingTimers, 1, "repeated clicks replace the existing reset timer");
  app.flushTimers();
  assert.equal(button.textContent, "Copy");
  assert.equal(button.attributes.get("aria-label"), "Copy code block");

  const missing = createDom({ clipboardAvailable: false });
  const missingButton = missing.pre.children[0];
  await missingButton.listeners.click();
  assert.equal(missingButton.textContent, "Unavailable");
  assert.equal(missingButton.attributes.get("aria-label"), "Clipboard unavailable");
  missing.flushTimers();
  assert.equal(missingButton.textContent, "Copy");
});


test("fourth-level headings receive shareable anchors without entering the TOC", () => {
  const { heading } = createDom({ headingLevel: 4 });
  assert.equal(heading.children.length, 1);
  assert.equal(heading.children[0].href, "#getting-started");
  assert.equal(heading.children[0].attributes.get("aria-label"), "Link to Getting Started");
  assert.equal(createDom({ headingLevel: 1 }).heading.children.length, 0);
});
