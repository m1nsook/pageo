import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function createDom({ clipboardAvailable = true } = {}) {
  const attributes = new Map();
  const pre = { children: [], appendChild(child) { this.children.push(child); } };
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
      if (selector === ".docs h2[id], .docs h3[id]") return [heading];
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
  const context = {
    document, URL, location: { href: "https://example.test/docs/index.html" },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: { clipboard: clipboardAvailable ? { async writeText(value) { clipboard.push(value); } } : undefined },
  };
  vm.runInNewContext(source, context);
  return { pre, code, heading, controls, clipboard, attributes };
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
